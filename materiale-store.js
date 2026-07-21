(function (global) {
  'use strict';

  var STORAGE_KEY_PDFS = 'scarica_pdfs';
  var API_URL = '/api/materiale';
  var remoteAvailable = null;

  function getAdminPassword() {
    try {
      var stored = (global.localStorage.getItem('admin_password') || '').trim();
      if (stored) return stored;
    } catch (e) {}
    var config = global.PriscillaConfig || {};
    return (config.adminPassword || '').trim();
  }

  function getLocalPdfs() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY_PDFS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setLocalPdfs(pdfs) {
    global.localStorage.setItem(STORAGE_KEY_PDFS, JSON.stringify(pdfs));
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    return {
      id: item.id || '',
      title: item.title || 'Senza titolo',
      filename: item.filename || 'documento',
      mimeType: item.mimeType || 'application/pdf',
      url: item.url || '',
      dataBase64: item.dataBase64 || '',
      size: item.size || 0,
      createdAt: item.createdAt || 0,
      source: item.source || (item.url ? 'blob' : 'local')
    };
  }

  function listLocal() {
    return getLocalPdfs().map(normalizeItem).filter(Boolean);
  }

  function fetchRemoteList() {
    return global.fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (res) {
      if (res.status === 503) {
        remoteAvailable = false;
        return null;
      }
      if (!res.ok) {
        remoteAvailable = false;
        return null;
      }
      return res.json().then(function (data) {
        if (!data || !data.ok || !Array.isArray(data.items)) {
          remoteAvailable = false;
          return null;
        }
        remoteAvailable = true;
        return data.items.map(function (item) {
          var n = normalizeItem(item);
          if (n) n.source = 'blob';
          return n;
        }).filter(Boolean);
      });
    }).catch(function () {
      remoteAvailable = false;
      return null;
    });
  }

  function mergeLocalExtras(remoteItems) {
    var remote = Array.isArray(remoteItems) ? remoteItems : [];
    var remoteIds = {};
    remote.forEach(function (it) {
      if (it && it.id) remoteIds[String(it.id)] = true;
    });
    var extras = listLocal().filter(function (it) {
      return it && it.id && !remoteIds[String(it.id)];
    });
    if (!extras.length) {
      return { items: remote, source: 'blob', available: true };
    }
    return {
      items: remote.concat(extras),
      source: 'mixed',
      available: true
    };
  }

  function list() {
    return fetchRemoteList().then(function (remote) {
      // Array (anche vuoto) = Blob ok; null = API non disponibile
      if (Array.isArray(remote)) return mergeLocalExtras(remote);
      return { items: listLocal(), source: 'local', available: false };
    });
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        var result = ev.target && ev.target.result ? String(ev.target.result) : '';
        var base64 = result.split(',')[1] || '';
        if (!base64) {
          reject(new Error('Impossibile leggere il file.'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = function () {
        reject(new Error('Errore nella lettura del file.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function guessMime(file) {
    var type = (file && file.type) || '';
    if (type === 'application/pdf' || type === 'image/png') return type;
    var name = ((file && file.name) || '').toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.pdf')) return 'application/pdf';
    return type;
  }

  function isAllowedFile(file) {
    var mime = guessMime(file);
    return mime === 'application/pdf' || mime === 'image/png';
  }

  function addLocal(file, title) {
    return fileToBase64(file).then(function (base64) {
      var mime = guessMime(file);
      var cleanName = String(file.name || 'documento').replace(/\.(pdf|png)$/i, '');
      var item = normalizeItem({
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        title: title || cleanName,
        filename: cleanName,
        mimeType: mime,
        dataBase64: base64,
        size: file.size || 0,
        createdAt: Date.now(),
        source: 'local'
      });
      var listItems = getLocalPdfs();
      listItems.push({
        id: item.id,
        title: item.title,
        filename: item.filename,
        mimeType: item.mimeType,
        dataBase64: item.dataBase64,
        size: item.size,
        createdAt: item.createdAt
      });
      try {
        setLocalPdfs(listItems);
      } catch (err) {
        var quota = err && (err.name === 'QuotaExceededError' || err.code === 22);
        throw new Error(
          quota
            ? 'Spazio nel browser esaurito. Collega Vercel Blob oppure rimuovi file/immagini dall\'admin e riprova con un file più piccolo.'
            : ((err && err.message) || 'Impossibile salvare il file nel browser.')
        );
      }
      return item;
    });
  }

  function addRemote(file, title) {
    return fileToBase64(file).then(function (base64) {
      var mime = guessMime(file);
      var cleanName = String(file.name || 'documento').replace(/\.(pdf|png)$/i, '');
      return global.fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': getAdminPassword()
        },
        body: JSON.stringify({
          title: title || cleanName,
          filename: cleanName,
          mimeType: mime,
          dataBase64: base64,
          password: getAdminPassword()
        })
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.status === 503 || res.status === 404) {
            remoteAvailable = false;
            var err503 = new Error('remote_unavailable');
            err503.code = 'remote_unavailable';
            throw err503;
          }
          if (!res.ok || !data || !data.ok) {
            remoteAvailable = true;
            throw new Error((data && data.error) || 'Caricamento non riuscito.');
          }
          remoteAvailable = true;
          return normalizeItem(data.item);
        });
      });
    });
  }

  function add(file, title) {
    if (!file) return Promise.reject(new Error('Seleziona un file.'));
    if (!isAllowedFile(file)) {
      return Promise.reject(new Error('Sono ammessi solo PDF e PNG.'));
    }
    if (remoteAvailable === false) {
      return addLocal(file, title);
    }
    return addRemote(file, title).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return addLocal(file, title);
      }
      // Offline / server statico locale senza API
      if (remoteAvailable !== true && err && /failed to fetch|networkerror|load failed/i.test(String(err.message || err))) {
        remoteAvailable = false;
        return addLocal(file, title);
      }
      throw err;
    });
  }

  function removeLocal(idOrIndex) {
    var listItems = getLocalPdfs();
    var idx = -1;
    if (typeof idOrIndex === 'number') {
      idx = idOrIndex;
    } else {
      idx = listItems.findIndex(function (it) { return it && it.id === idOrIndex; });
      if (idx < 0) {
        // compat: vecchi item senza id → usa indice stringa numerica
        var asNum = parseInt(idOrIndex, 10);
        if (String(asNum) === String(idOrIndex) && asNum >= 0 && asNum < listItems.length) {
          idx = asNum;
        }
      }
    }
    if (idx < 0 || idx >= listItems.length) {
      return Promise.reject(new Error('File non trovato.'));
    }
    listItems.splice(idx, 1);
    setLocalPdfs(listItems);
    return Promise.resolve();
  }

  function removeRemote(id) {
    return global.fetch(API_URL + '?id=' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify({ id: id, password: getAdminPassword() })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 503 || res.status === 404) {
          remoteAvailable = false;
          var err503 = new Error('remote_unavailable');
          err503.code = 'remote_unavailable';
          throw err503;
        }
        if (!res.ok || !data || !data.ok) {
          remoteAvailable = true;
          throw new Error((data && data.error) || 'Eliminazione non riuscita.');
        }
        remoteAvailable = true;
      });
    });
  }

  function remove(itemOrId, index) {
    var id = typeof itemOrId === 'object' && itemOrId ? itemOrId.id : itemOrId;
    var source = typeof itemOrId === 'object' && itemOrId ? itemOrId.source : '';

    if (source === 'local' || !id || String(id).indexOf('local_') === 0) {
      return removeLocal(id || index);
    }
    if (remoteAvailable === false) {
      return removeLocal(id || index);
    }
    return removeRemote(id).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return removeLocal(id || index);
      }
      if (remoteAvailable !== true && err && /failed to fetch|networkerror|load failed/i.test(String(err.message || err))) {
        remoteAvailable = false;
        return removeLocal(id || index);
      }
      throw err;
    });
  }

  function getFileHref(item) {
    if (!item) return '#';
    if (item.url) return item.url;
    if (item.dataBase64) {
      return 'data:' + (item.mimeType || 'application/pdf') + ';base64,' + item.dataBase64;
    }
    return '#';
  }

  function canPreview(item) {
    return !!(item && (item.url || item.dataBase64));
  }

  global.PriscillaMateriale = {
    list: list,
    add: add,
    remove: remove,
    guessMime: guessMime,
    isAllowedFile: isAllowedFile,
    getFileHref: getFileHref,
    canPreview: canPreview,
    getAdminPassword: getAdminPassword,
    isRemoteAvailable: function () { return remoteAvailable; }
  };
})(typeof window !== 'undefined' ? window : this);
