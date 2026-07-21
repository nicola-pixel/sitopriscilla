'use strict';

/**
 * Materiale (PDF/PNG) condiviso tra browser via Vercel Blob.
 * Richiede BLOB_READ_WRITE_TOKEN (store Blob collegato al progetto Vercel).
 *
 * Ogni file ha:
 *   materiale/files/{id}.{ext}  → contenuto
 *   materiale/meta/{id}.json    → metadati (immutabili, niente overwrite → niente cache stale)
 *
 * Ogni cartella ha:
 *   materiale/folders/{id}.json → metadati cartella
 *
 * I file devono appartenere a una cartella (folderId obbligatorio in upload).
 *
 * GET    → elenco cartelle + file
 * POST   → crea cartella / elimina cartella / carica file — richiede password admin
 * DELETE → rimuove file — richiede password admin
 */

var FILES_PREFIX = 'materiale/files/';
var META_PREFIX = 'materiale/meta/';
var FOLDERS_PREFIX = 'materiale/folders/';
var LEGACY_INDEX = 'priscilla-materiale.json';
var MAX_SIZE_BYTES = 4 * 1024 * 1024;
var ALLOWED_MIME = {
  'application/pdf': true,
  'image/png': true
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

function extForMime(mime) {
  if (mime === 'image/png') return 'png';
  return 'pdf';
}

function sanitizeFilename(name) {
  return String(name || 'documento')
    .replace(/\.(pdf|png)$/i, '')
    .replace(/[^a-zA-Z0-9._\-\sàèéìòù]/gi, '')
    .trim()
    .slice(0, 80) || 'documento';
}

function sanitizeFolderName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function guessMime(filename, mime) {
  if (mime && ALLOWED_MIME[mime]) return mime;
  var lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return mime || '';
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

function publicItem(item) {
  return {
    id: item.id,
    title: item.title,
    filename: item.filename,
    mimeType: item.mimeType,
    url: item.url,
    size: item.size || 0,
    createdAt: item.createdAt || 0,
    folderId: item.folderId || ''
  };
}

function publicFolder(folder) {
  return {
    id: folder.id,
    name: folder.name,
    createdAt: folder.createdAt || 0
  };
}

function metaPath(id) {
  return META_PREFIX + id + '.json';
}

function folderPath(id) {
  return FOLDERS_PREFIX + id + '.json';
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

async function readMetaBlob(entry) {
  try {
    var res = await fetch(entry.url, { cache: 'no-store' });
    if (!res.ok) return null;
    var parsed = await res.json();
    if (!parsed || !parsed.id || !parsed.url) return null;
    return publicItem(parsed);
  } catch (e) {
    return null;
  }
}

async function readFolderBlob(entry) {
  try {
    var res = await fetch(entry.url, { cache: 'no-store' });
    if (!res.ok) return null;
    var parsed = await res.json();
    if (!parsed || !parsed.id || !parsed.name) return null;
    return publicFolder(parsed);
  } catch (e) {
    return null;
  }
}

async function listItems(blob) {
  var metas = await listAllBlobs(blob, META_PREFIX);
  var items = [];
  for (var i = 0; i < metas.length; i++) {
    var item = await readMetaBlob(metas[i]);
    if (item) items.push(item);
  }
  items.sort(function (a, b) {
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  return items;
}

async function listFolders(blob) {
  var entries = await listAllBlobs(blob, FOLDERS_PREFIX);
  var folders = [];
  for (var i = 0; i < entries.length; i++) {
    var folder = await readFolderBlob(entries[i]);
    if (folder) folders.push(folder);
  }
  folders.sort(function (a, b) {
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  return folders;
}

async function folderExists(blob, folderId) {
  if (!folderId) return false;
  try {
    var head = await blob.head(folderPath(folderId));
    return !!(head && head.url);
  } catch (e) {
    return false;
  }
}

async function cleanupLegacyIndex(blob) {
  try {
    await blob.del(LEGACY_INDEX);
  } catch (e) {}
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
      var folders = await listFolders(blob);
      var items = await listItems(blob);
      json(res, 200, {
        ok: true,
        available: true,
        source: 'blob',
        version: 3,
        folders: folders,
        items: items
      });
      return;
    }

    var body = parseBody(req);

    if (req.method === 'POST') {
      if (!isAuthorized(req, body)) {
        json(res, 401, { ok: false, error: 'Password admin non valida.' });
        return;
      }

      var action = body && body.action ? String(body.action) : 'upload';

      if (action === 'createFolder') {
        var folderName = sanitizeFolderName(body && body.name);
        if (!folderName) {
          json(res, 400, { ok: false, error: 'Nome cartella obbligatorio.' });
          return;
        }
        var folderId = 'fld_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        var folder = {
          id: folderId,
          name: folderName,
          createdAt: Date.now()
        };
        await blob.put(folderPath(folderId), JSON.stringify(folder), {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'application/json',
          cacheControlMaxAge: 60
        });
        cleanupLegacyIndex(blob);
        json(res, 200, { ok: true, folder: publicFolder(folder) });
        return;
      }

      if (action === 'deleteFolder') {
        var folderIdToRemove = String((body && body.id) || '').trim();
        if (!folderIdToRemove) {
          json(res, 400, { ok: false, error: 'ID cartella mancante.' });
          return;
        }
        var allItems = await listItems(blob);
        var hasFiles = allItems.some(function (it) {
          return it && String(it.folderId || '') === folderIdToRemove;
        });
        if (hasFiles) {
          json(res, 400, {
            ok: false,
            error: 'La cartella non è vuota. Rimuovi prima i file al suo interno.'
          });
          return;
        }
        var folderUrl = null;
        try {
          var folderHead = await blob.head(folderPath(folderIdToRemove));
          folderUrl = folderHead && folderHead.url;
        } catch (e) {}
        try {
          await blob.del(folderUrl || folderPath(folderIdToRemove));
        } catch (delFolderErr) {
          console.warn('[materiale] deleteFolder', delFolderErr);
        }
        cleanupLegacyIndex(blob);
        json(res, 200, { ok: true, id: folderIdToRemove });
        return;
      }

      var title = (body && body.title ? String(body.title) : '').trim();
      var filename = sanitizeFilename(body && body.filename);
      var mimeType = guessMime(
        (body && body.filename) || filename,
        body && body.mimeType
      );
      var dataBase64 = body && typeof body.dataBase64 === 'string' ? body.dataBase64 : '';
      var folderIdUpload = String((body && body.folderId) || '').trim();

      if (!folderIdUpload) {
        json(res, 400, { ok: false, error: 'Seleziona una cartella per il file.' });
        return;
      }
      if (!(await folderExists(blob, folderIdUpload))) {
        json(res, 400, { ok: false, error: 'Cartella non trovata. Creane una prima di caricare.' });
        return;
      }
      if (!ALLOWED_MIME[mimeType]) {
        json(res, 400, { ok: false, error: 'Sono ammessi solo PDF e PNG.' });
        return;
      }
      if (!dataBase64) {
        json(res, 400, { ok: false, error: 'File mancante.' });
        return;
      }

      var buffer;
      try {
        buffer = Buffer.from(dataBase64, 'base64');
      } catch (e) {
        json(res, 400, { ok: false, error: 'File non valido.' });
        return;
      }

      if (!buffer.length) {
        json(res, 400, { ok: false, error: 'File vuoto.' });
        return;
      }
      if (buffer.length > MAX_SIZE_BYTES) {
        json(res, 400, { ok: false, error: 'File troppo grande (max 4 MB).' });
        return;
      }

      var id = 'mat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      var filePath = FILES_PREFIX + id + '.' + extForMime(mimeType);
      var uploaded = await blob.put(filePath, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: mimeType,
        cacheControlMaxAge: 60 * 60 * 24 * 30
      });

      var item = {
        id: id,
        title: title || filename,
        filename: filename,
        mimeType: mimeType,
        url: uploaded.url,
        pathname: uploaded.pathname || filePath,
        size: buffer.length,
        createdAt: Date.now(),
        folderId: folderIdUpload
      };

      await blob.put(metaPath(id), JSON.stringify(item), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 60
      });

      cleanupLegacyIndex(blob);

      json(res, 200, { ok: true, item: publicItem(item) });
      return;
    }

    if (req.method === 'DELETE') {
      if (!isAuthorized(req, body)) {
        json(res, 401, { ok: false, error: 'Password admin non valida.' });
        return;
      }

      var idToRemove =
        (body && body.id) ||
        (req.query && req.query.id) ||
        '';
      idToRemove = String(idToRemove || '').trim();
      if (!idToRemove) {
        try {
          var reqUrl = new URL(req.url, 'http://localhost');
          idToRemove = (reqUrl.searchParams.get('id') || '').trim();
        } catch (e) {}
      }
      if (!idToRemove) {
        json(res, 400, { ok: false, error: 'ID file mancante.' });
        return;
      }

      var metaUrl = null;
      var fileUrl = null;
      try {
        var metaHead = await blob.head(metaPath(idToRemove));
        metaUrl = metaHead && metaHead.url;
        if (metaUrl) {
          var metaRes = await fetch(metaUrl, { cache: 'no-store' });
          if (metaRes.ok) {
            var metaJson = await metaRes.json();
            fileUrl = metaJson && metaJson.url;
          }
        }
      } catch (e) {}

      var toDelete = [];
      if (metaUrl) toDelete.push(metaUrl);
      else toDelete.push(metaPath(idToRemove));
      if (fileUrl) toDelete.push(fileUrl);
      toDelete.push(FILES_PREFIX + idToRemove + '.pdf');
      toDelete.push(FILES_PREFIX + idToRemove + '.png');

      try {
        await blob.del(toDelete);
      } catch (delErr) {
        console.warn('[materiale] delete', delErr);
      }

      cleanupLegacyIndex(blob);

      json(res, 200, { ok: true, id: idToRemove });
      return;
    }

    json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[materiale]', err);
    json(res, 500, {
      ok: false,
      available: false,
      error: (err && err.message) || 'Errore materiale'
    });
  }
};
