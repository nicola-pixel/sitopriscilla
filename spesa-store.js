(function (global) {
  'use strict';

  var STORAGE_KEY = 'scarica_consigli_spesa';
  var API_URL = '/api/spesa';
  var remoteAvailable = null;

  function getAdminPassword() {
    try {
      var stored = (global.localStorage.getItem('admin_password') || '').trim();
      if (stored) return stored;
    } catch (e) {}
    var config = global.PriscillaConfig || {};
    return (config.adminPassword || '').trim();
  }

  function getLocal() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function setLocal(items) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    var city = String(item.city || '').trim();
    var storeName = String(item.storeName || item.name || '').trim();
    var description = String(item.description || '').trim();
    if (!city || !storeName || !description) return null;
    return {
      id: item.id || '',
      city: city,
      storeName: storeName,
      description: description,
      createdAt: Number(item.createdAt) || Date.now(),
      updatedAt: Number(item.updatedAt) || Date.now(),
      source: item.source || (item.id && String(item.id).indexOf('local_') === 0 ? 'local' : 'blob')
    };
  }

  function listLocal() {
    return getLocal().map(normalizeItem).filter(Boolean);
  }

  function fetchRemote() {
    return global.fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (res) {
      if (res.status === 503 || res.status === 404) {
        remoteAvailable = false;
        return null;
      }
      if (!res.ok) {
        remoteAvailable = false;
        return null;
      }
      return res.json().then(function (data) {
        if (!data || !data.ok) {
          remoteAvailable = false;
          return null;
        }
        remoteAvailable = true;
        return (Array.isArray(data.items) ? data.items : []).map(normalizeItem).filter(Boolean);
      });
    }).catch(function () {
      remoteAvailable = false;
      return null;
    });
  }

  function postAction(action, payload) {
    var body = Object.assign({ action: action, password: getAdminPassword() }, payload || {});
    return global.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 503 || res.status === 404) {
          remoteAvailable = false;
          var err503 = new Error('Salvataggio cloud non disponibile. Controlla Blob su Vercel.');
          err503.code = 'remote_unavailable';
          throw err503;
        }
        if (!res.ok || !data || !data.ok) {
          throw new Error((data && data.error) || 'Operazione non riuscita.');
        }
        remoteAvailable = true;
        return data;
      });
    });
  }

  function sortItems(items) {
    return (items || []).slice().sort(function (a, b) {
      var cityCmp = String(a.city || '').localeCompare(String(b.city || ''), 'it', { sensitivity: 'base' });
      if (cityCmp !== 0) return cityCmp;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function list() {
    return fetchRemote().then(function (remote) {
      if (remote) {
        setLocal(remote);
        return { items: sortItems(remote), source: 'blob' };
      }
      return { items: sortItems(listLocal()), source: 'local' };
    }).catch(function () {
      return { items: sortItems(listLocal()), source: 'local' };
    });
  }

  function makeId() {
    return 'spesa_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function save(item) {
    var city = String(item && item.city || '').trim();
    var storeName = String(item && (item.storeName || item.name) || '').trim();
    var description = String(item && item.description || '').trim();
    if (!city || !storeName || !description) {
      return Promise.reject(new Error('Città, negozio e descrizione sono obbligatori.'));
    }

    var next = {
      id: (item && item.id) || makeId(),
      city: city,
      storeName: storeName,
      description: description,
      createdAt: (item && item.createdAt) || Date.now(),
      updatedAt: Date.now()
    };

    var local = listLocal();
    var idx = local.findIndex(function (it) { return it && it.id === next.id; });
    if (idx >= 0) local[idx] = Object.assign({}, local[idx], next, { source: 'local' });
    else local.unshift(Object.assign({}, next, { source: 'local' }));
    setLocal(local);

    return postAction('save', { item: next }).then(function (data) {
      var saved = normalizeItem(data.item || next);
      if (!saved) throw new Error('Risposta non valida.');
      saved.source = 'blob';
      var synced = listLocal().filter(function (it) { return it.id !== saved.id; });
      synced.unshift(saved);
      setLocal(synced);
      return { item: saved, source: 'blob' };
    }).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return { item: Object.assign({}, next, { source: 'local' }), source: 'local' };
      }
      throw err;
    });
  }

  function remove(id) {
    var cleanId = String(id || '').trim();
    if (!cleanId) return Promise.reject(new Error('ID mancante.'));

    setLocal(listLocal().filter(function (it) { return !it || it.id !== cleanId; }));

    return postAction('delete', { id: cleanId }).then(function () {
      return { id: cleanId, source: 'blob' };
    }).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return { id: cleanId, source: 'local' };
      }
      throw err;
    });
  }

  function isRemoteAvailable() {
    return remoteAvailable;
  }

  global.PriscillaSpesa = {
    list: list,
    save: save,
    remove: remove,
    isRemoteAvailable: isRemoteAvailable
  };
})(typeof window !== 'undefined' ? window : globalThis);
