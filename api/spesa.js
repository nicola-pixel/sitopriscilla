'use strict';

/**
 * Suggerimenti spesa condivisi via Vercel Blob.
 * Richiede BLOB_READ_WRITE_TOKEN.
 *
 *   content/spesa/{id}.json
 *
 * GET  → elenco pubblico { items: [{ id, city, storeName, description, createdAt }] }
 * POST → save / delete — richiede password admin
 */

var SPESA_PREFIX = 'content/spesa/';
var MAX_JSON_BYTES = 64 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
}

function blobConfigured() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function getExpectedAdminPassword() {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.PRISCILLA_ADMIN_PASSWORD ||
    ''
  ).trim();
}

function readAdminPassword(req, body) {
  var header = (req.headers['x-admin-password'] || '').toString().trim();
  if (header) return header;
  if (body && typeof body.password === 'string') return body.password.trim();
  return '';
}

function isAuthorized(req, body) {
  var expected = getExpectedAdminPassword();
  var provided = readAdminPassword(req, body);
  if (!expected) return !!provided;
  return provided === expected;
}

function parseBody(req) {
  var body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sanitizeId(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 80);
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object') return null;
  var id = sanitizeId(item.id);
  var city = String(item.city || '').trim().slice(0, 80);
  var storeName = String(item.storeName || item.name || '').trim().slice(0, 120);
  var description = String(item.description || '').trim().slice(0, 500);
  if (!id || !city || !storeName || !description) return null;
  return {
    id: id,
    city: city,
    storeName: storeName,
    description: description,
    createdAt: Number(item.createdAt) || Date.now(),
    updatedAt: Number(item.updatedAt) || Date.now()
  };
}

async function listAllBlobs(blob, prefix) {
  var out = [];
  var cursor;
  do {
    var page = await blob.list({ prefix: prefix, cursor: cursor, limit: 1000 });
    out = out.concat(page.blobs || []);
    cursor = page.hasMore ? page.cursor : null;
  } while (cursor);
  return out;
}

async function readJsonUrl(url) {
  try {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function listItems(blob) {
  var entries = await listAllBlobs(blob, SPESA_PREFIX);
  var items = [];
  for (var i = 0; i < entries.length; i++) {
    var parsed = await readJsonUrl(entries[i].url);
    var item = normalizeItem(parsed);
    if (item) items.push(item);
  }
  items.sort(function (a, b) {
    var cityCmp = String(a.city || '').localeCompare(String(b.city || ''), 'it', { sensitivity: 'base' });
    if (cityCmp !== 0) return cityCmp;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return items;
}

async function putJson(blob, pathname, data) {
  var payload = JSON.stringify(data);
  if (Buffer.byteLength(payload, 'utf8') > MAX_JSON_BYTES) {
    var err = new Error('Contenuto troppo grande.');
    err.code = 'too_large';
    throw err;
  }
  await blob.put(pathname, payload, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60
  });
}

async function deletePath(blob, pathname) {
  try {
    var head = await blob.head(pathname);
    if (head && head.url) {
      await blob.del(head.url);
      return;
    }
  } catch (e) {}
  try {
    await blob.del(pathname);
  } catch (e2) {}
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!blobConfigured()) {
    json(res, 503, {
      ok: false,
      available: false,
      error: 'Blob non configurato. Collega un Blob Store al progetto Vercel (BLOB_READ_WRITE_TOKEN).'
    });
    return;
  }

  var blob;
  try {
    blob = require('@vercel/blob');
  } catch (e) {
    json(res, 503, { ok: false, available: false, error: 'Dipendenza @vercel/blob mancante.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      var items = await listItems(blob);
      json(res, 200, {
        ok: true,
        available: true,
        source: 'blob',
        items: items
      });
      return;
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    var body = parseBody(req);
    if (!isAuthorized(req, body)) {
      json(res, 401, { ok: false, error: 'Password admin non valida.' });
      return;
    }

    var action = body && body.action ? String(body.action) : '';

    if (action === 'save') {
      var item = normalizeItem(body.item);
      if (!item) {
        json(res, 400, {
          ok: false,
          error: 'Suggerimento non valido. Città, negozio e descrizione sono obbligatori.'
        });
        return;
      }
      item.updatedAt = Date.now();
      await putJson(blob, SPESA_PREFIX + item.id + '.json', item);
      json(res, 200, { ok: true, item: item });
      return;
    }

    if (action === 'delete') {
      var id = sanitizeId(body && body.id);
      if (!id) {
        json(res, 400, { ok: false, error: 'ID suggerimento mancante.' });
        return;
      }
      await deletePath(blob, SPESA_PREFIX + id + '.json');
      json(res, 200, { ok: true, id: id });
      return;
    }

    json(res, 400, { ok: false, error: 'Azione non riconosciuta.' });
  } catch (err) {
    console.error('[spesa]', err);
    if (err && err.code === 'too_large') {
      json(res, 400, { ok: false, error: err.message });
      return;
    }
    json(res, 500, {
      ok: false,
      available: false,
      error: (err && err.message) || 'Errore suggerimenti spesa'
    });
  }
};
