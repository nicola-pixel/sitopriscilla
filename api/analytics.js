'use strict';

/**
 * Analytics condivise tra browser via Vercel Blob (file JSON, non un DB).
 * Richiede BLOB_READ_WRITE_TOKEN (store Blob collegato al progetto Vercel).
 */

var PATHNAME = 'priscilla-analytics.json';
var MAX_EVENTS = 5000;
var RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
var ALLOWED_TYPES = {
  download: true,
  cv_download: true,
  sede_click: true,
  area_unlock: true
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function blobConfigured() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function pruneEvents(events) {
  var cutoff = Date.now() - RETENTION_MS;
  var pruned = (events || []).filter(function (ev) {
    return ev && typeof ev.ts === 'number' && ev.ts >= cutoff && ALLOWED_TYPES[ev.type];
  });
  if (pruned.length > MAX_EVENTS) {
    pruned = pruned.slice(pruned.length - MAX_EVENTS);
  }
  return pruned;
}

function emptyStore() {
  return { events: [], version: 1 };
}

async function streamToText(stream) {
  if (!stream) return '';
  return new Response(stream).text();
}

async function loadStore(blob) {
  try {
    var meta = await blob.head(PATHNAME);
    if (!meta || !meta.url) return emptyStore();
    var bust = meta.url.indexOf('?') >= 0 ? '&' : '?';
    var res = await fetch(meta.url + bust + 'v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return emptyStore();
    var text = await res.text();
    if (!text) return emptyStore();
    var parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.events)) return emptyStore();
    return { events: pruneEvents(parsed.events), version: parsed.version || 1 };
  } catch (err) {
    var msg = (err && err.message) || '';
    if (/not found|404|does not exist|400|Access denied/i.test(msg) || (err && (err.status === 404 || err.statusCode === 404))) {
      return emptyStore();
    }
    throw err;
  }
}

async function saveStore(blob, store) {
  store.events = pruneEvents(store.events);
  await blob.put(PATHNAME, JSON.stringify(store), {
    access: 'public',
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 60
  });
}

function normalizeEvent(body) {
  if (!body || !ALLOWED_TYPES[body.type]) return null;
  var ts = typeof body.ts === 'number' ? body.ts : Date.now();
  var id = typeof body.id === 'string' && body.id ? body.id : ('evt_' + ts + '_' + Math.random().toString(36).slice(2, 8));
  var meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
  return { id: id, type: body.type, ts: ts, meta: meta };
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!blobConfigured()) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      available: false,
      error: 'Blob non configurato. Collega un Blob Store al progetto Vercel (BLOB_READ_WRITE_TOKEN).'
    }));
    return;
  }

  var blob;
  try {
    blob = require('@vercel/blob');
  } catch (e) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, available: false, error: 'Dipendenza @vercel/blob mancante.' }));
    return;
  }

  try {
    if (req.method === 'GET') {
      var store = await loadStore(blob);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({
        ok: true,
        available: true,
        source: 'blob',
        version: store.version,
        events: store.events
      }));
      return;
    }

    if (req.method === 'POST') {
      var body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      var event = normalizeEvent(body);
      if (!event) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Evento non valido' }));
        return;
      }

      var current = await loadStore(blob);
      var exists = current.events.some(function (ev) { return ev.id === event.id; });
      if (!exists) {
        current.events.push(event);
        await saveStore(blob, current);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, id: event.id }));
      return;
    }

    if (req.method === 'DELETE') {
      await saveStore(blob, emptyStore());
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  } catch (err) {
    console.error('[analytics]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      available: false,
      error: (err && err.message) || 'Errore analytics'
    }));
  }
};
