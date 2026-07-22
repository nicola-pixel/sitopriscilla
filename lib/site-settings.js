'use strict';

/**
 * Impostazioni sito condivise via Vercel Blob.
 * La password admin è salvata come hash (mai in chiaro).
 */

var crypto = require('crypto');

var SETTINGS_PATH = 'content/meta/site-settings.json';
/** Allineata a config.js — usata solo finché non viene impostata una password in Impostazioni / env. */
var BOOTSTRAP_PASSWORD = 'priscilla';

function blobConfigured() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function getEnvAdminPassword() {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.PRISCILLA_ADMIN_PASSWORD ||
    ''
  ).trim();
}

function hashPassword(password) {
  var salt = (process.env.ADMIN_PASSWORD_SALT || 'priscilla-castellani-tarabini').trim();
  return crypto
    .createHash('sha256')
    .update(salt + '\0' + String(password || ''), 'utf8')
    .digest('hex');
}

function safeEqualString(a, b) {
  try {
    var ba = Buffer.from(String(a || ''), 'utf8');
    var bb = Buffer.from(String(b || ''), 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch (e) {
    return false;
  }
}

async function loadSettings(blob) {
  if (!blob) return {};
  try {
    var meta = await blob.head(SETTINGS_PATH);
    if (!meta || !meta.url) return {};
    var bust = meta.url.indexOf('?') >= 0 ? '&' : '?';
    var res = await fetch(meta.url + bust + 'v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return {};
    var parsed = await res.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    var msg = (e && e.message) || '';
    if (/not found|404|does not exist|Access denied/i.test(msg)) return {};
    if (e && (e.status === 404 || e.statusCode === 404)) return {};
    return {};
  }
}

async function saveSettings(blob, settings) {
  await blob.put(SETTINGS_PATH, JSON.stringify(settings || {}), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0
  });
}

/**
 * Verifica la password admin.
 * Priorità: hash in Blob → env ADMIN_PASSWORD → password di bootstrap (config.js).
 */
async function isValidAdminPassword(blob, provided) {
  var password = String(provided || '').trim();
  if (!password) return false;

  if (blob) {
    var settings = await loadSettings(blob);
    if (settings.adminPasswordHash) {
      return safeEqualString(hashPassword(password), settings.adminPasswordHash);
    }
  }

  var env = getEnvAdminPassword();
  if (env) return password === env;

  return password === BOOTSTRAP_PASSWORD;
}

async function getDownloadKey(blob) {
  var settings = await loadSettings(blob);
  return String(settings.downloadKey || '').trim();
}

module.exports = {
  SETTINGS_PATH: SETTINGS_PATH,
  BOOTSTRAP_PASSWORD: BOOTSTRAP_PASSWORD,
  blobConfigured: blobConfigured,
  getEnvAdminPassword: getEnvAdminPassword,
  hashPassword: hashPassword,
  loadSettings: loadSettings,
  saveSettings: saveSettings,
  isValidAdminPassword: isValidAdminPassword,
  getDownloadKey: getDownloadKey
};
