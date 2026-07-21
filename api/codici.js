'use strict';

/**
 * Codici sconto condivisi via Vercel Blob.
 * Richiede BLOB_READ_WRITE_TOKEN.
 *
 *   content/discount-codes/{id}.json
 *
 * GET  → elenco pubblico { items: [{ id, name, code, createdAt }] }
 * POST → save / delete — richiede password admin
 */

var CODES_PREFIX = 'content/discount-codes/';
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

function normalizeCode(item) {
  if (!item || typeof item !== 'object') return null;
  var id = sanitizeId(item.id);
  var name = String(item.name || '').trim().slice(0, 120);
  var code = String(item.code || '').trim().slice(0, 80);
  if (!id || !name || !code) return null;
  return {
    id: id,
    name: name,
    code: code,
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

async function listCodes(blob) {
  var entries = await listAllBlobs(blob, CODES_PREFIX);
  var items = [];
  for (var i = 0; i < entries.length; i++) {
    var parsed = await readJsonUrl(entries[i].url);
    var item = normalizeCode(parsed);
    if (item) items.push(item);
  }
  items.sort(function (a, b) {
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
      var items = await listCodes(blob);
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
      var item = normalizeCode(body.item);
      if (!item) {
        json(res, 400, { ok: false, error: 'Codice sconto non valido. Nome e codice sono obbligatori.' });
        return;
      }
      item.updatedAt = Date.now();
      await putJson(blob, CODES_PREFIX + item.id + '.json', item);
      json(res, 200, { ok: true, item: item });
      return;
    }

    if (action === 'delete') {
      var id = sanitizeId(body && body.id);
      if (!id) {
        json(res, 400, { ok: false, error: 'ID codice mancante.' });
        return;
      }
      await deletePath(blob, CODES_PREFIX + id + '.json');
      json(res, 200, { ok: true, id: id });
      return;
    }

    json(res, 400, { ok: false, error: 'Azione non riconosciuta.' });
  } catch (err) {
    console.error('[codici]', err);
    if (err && err.code === 'too_large') {
      json(res, 400, { ok: false, error: err.message });
      return;
    }
    json(res, 500, {
      ok: false,
      available: false,
      error: (err && err.message) || 'Errore codici sconto'
    });
  }
};
