'use strict';

/**
 * Impostazioni condivise (password admin + chiave download) via Vercel Blob.
 *
 * GET  → { downloadKey } (chiave clienti; fallback gestito dal client su config.js)
 * POST → verify | setAdminPassword | setDownloadKey
 */

var settingsLib = require('../lib/site-settings');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
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

function readAdminPassword(req, body) {
  var header = (req.headers['x-admin-password'] || '').toString().trim();
  if (header) return header;
  if (body && typeof body.password === 'string') return body.password.trim();
  if (body && typeof body.currentPassword === 'string') return body.currentPassword.trim();
  return '';
}

async function loadBlob() {
  if (!settingsLib.blobConfigured()) return null;
  try {
    return require('@vercel/blob');
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    var blob = await loadBlob();

    if (req.method === 'GET') {
      var downloadKey = blob ? await settingsLib.getDownloadKey(blob) : '';
      json(res, 200, {
        ok: true,
        available: !!blob,
        downloadKey: downloadKey
      });
      return;
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    var body = parseBody(req);
    var action = body && body.action ? String(body.action) : '';

    if (action === 'verify') {
      var candidate = body && typeof body.password === 'string' ? body.password.trim() : '';
      var valid = await settingsLib.isValidAdminPassword(blob, candidate);
      if (!valid) {
        json(res, 401, { ok: false, error: 'Password non valida.' });
        return;
      }
      json(res, 200, { ok: true, available: !!blob });
      return;
    }

    if (action === 'setAdminPassword') {
      if (!blob) {
        json(res, 503, {
          ok: false,
          available: false,
          error: 'Salvataggio cloud non disponibile. Collega un Blob Store al progetto Vercel.'
        });
        return;
      }

      var currentPassword = readAdminPassword(req, body);
      var newPassword =
        body && typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

      if (!(await settingsLib.isValidAdminPassword(blob, currentPassword))) {
        json(res, 401, { ok: false, error: 'Password attuale non valida.' });
        return;
      }
      if (!newPassword) {
        json(res, 400, { ok: false, error: 'Inserisci una nuova password admin.' });
        return;
      }
      if (newPassword.length < 6) {
        json(res, 400, { ok: false, error: 'Usa almeno 6 caratteri.' });
        return;
      }

      var settings = await settingsLib.loadSettings(blob);
      settings.adminPasswordHash = settingsLib.hashPassword(newPassword);
      settings.updatedAt = Date.now();
      await settingsLib.saveSettings(blob, settings);

      json(res, 200, { ok: true, available: true });
      return;
    }

    if (action === 'setDownloadKey') {
      if (!blob) {
        json(res, 503, {
          ok: false,
          available: false,
          error: 'Salvataggio cloud non disponibile. Collega un Blob Store al progetto Vercel.'
        });
        return;
      }

      var adminPassword = readAdminPassword(req, body);
      if (!(await settingsLib.isValidAdminPassword(blob, adminPassword))) {
        json(res, 401, { ok: false, error: 'Password admin non valida.' });
        return;
      }

      var key =
        body && typeof body.downloadKey === 'string' ? body.downloadKey.trim() : '';
      var next = await settingsLib.loadSettings(blob);
      if (key) {
        next.downloadKey = key.slice(0, 120);
      } else {
        delete next.downloadKey;
      }
      next.updatedAt = Date.now();
      await settingsLib.saveSettings(blob, next);

      json(res, 200, {
        ok: true,
        available: true,
        downloadKey: key
      });
      return;
    }

    json(res, 400, { ok: false, error: 'Azione non riconosciuta.' });
  } catch (err) {
    console.error('[settings]', err);
    json(res, 500, {
      ok: false,
      available: false,
      error: (err && err.message) || 'Errore impostazioni'
    });
  }
};
