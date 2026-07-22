(function (global) {
  'use strict';

  var STORAGE_KEY_PDFS = 'scarica_pdfs';
  var STORAGE_KEY_FOLDERS = 'scarica_folders';
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

  function getLocalFolders() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY_FOLDERS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setLocalFolders(folders) {
    global.localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
  }

  function normalizeFolder(folder) {
    if (!folder || typeof folder !== 'object') return null;
    var name = String(folder.name || '').trim();
    if (!name) return null;
    return {
      id: folder.id || '',
      name: name,
      createdAt: folder.createdAt || 0,
      source: folder.source || (folder.id && String(folder.id).indexOf('local_') === 0 ? 'local' : 'blob')
    };
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    return {
      id: item.id || '',
      title: item.title || 'Senza titolo',
      description: item.description ? String(item.description) : '',
      filename: item.filename || 'documento',
      mimeType: item.mimeType || 'application/pdf',
      url: item.url || '',
      dataBase64: item.dataBase64 || '',
      size: item.size || 0,
      createdAt: item.createdAt || 0,
      folderId: item.folderId || '',
      source: item.source || (item.url ? 'blob' : 'local')
    };
  }

  function listLocalFolders() {
    return getLocalFolders().map(normalizeFolder).filter(Boolean);
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
        var folders = Array.isArray(data.folders) ? data.folders : [];
        return {
          folders: folders.map(function (folder) {
            var n = normalizeFolder(folder);
            if (n) n.source = 'blob';
            return n;
          }).filter(Boolean),
          items: data.items.map(function (item) {
            var n = normalizeItem(item);
            if (n) n.source = 'blob';
            return n;
          }).filter(Boolean)
        };
      });
    }).catch(function () {
      remoteAvailable = false;
      return null;
    });
  }

  function mergeLocalExtras(remote) {
    var remoteFolders = (remote && Array.isArray(remote.folders)) ? remote.folders : [];
    var remoteItems = (remote && Array.isArray(remote.items)) ? remote.items : [];
    var remoteFolderIds = {};
    remoteFolders.forEach(function (it) {
      if (it && it.id) remoteFolderIds[String(it.id)] = true;
    });
    var remoteIds = {};
    remoteItems.forEach(function (it) {
      if (it && it.id) remoteIds[String(it.id)] = true;
    });
    var extraFolders = listLocalFolders().filter(function (it) {
      return it && it.id && !remoteFolderIds[String(it.id)];
    });
    var extras = listLocal().filter(function (it) {
      return it && it.id && !remoteIds[String(it.id)];
    });
    var source = (extraFolders.length || extras.length) ? 'mixed' : 'blob';
    return {
      folders: remoteFolders.concat(extraFolders),
      items: remoteItems.concat(extras),
      source: source,
      available: true
    };
  }

  function list() {
    return fetchRemoteList().then(function (remote) {
      if (remote) return mergeLocalExtras(remote);
      return {
        folders: listLocalFolders(),
        items: listLocal(),
        source: 'local',
        available: false
      };
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

  function createFolderLocal(name) {
    var clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!clean) {
      return Promise.reject(new Error('Nome cartella obbligatorio.'));
    }
    var folder = normalizeFolder({
      id: 'local_fld_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: clean,
      createdAt: Date.now(),
      source: 'local'
    });
    var folders = getLocalFolders();
    folders.push({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt
    });
    setLocalFolders(folders);
    return Promise.resolve(folder);
  }

  function createFolderRemote(name) {
    return global.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify({
        action: 'createFolder',
        name: name,
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
          throw new Error((data && data.error) || 'Creazione cartella non riuscita.');
        }
        remoteAvailable = true;
        return normalizeFolder(data.folder);
      });
    });
  }

  function createFolder(name) {
    if (remoteAvailable === false) {
      return createFolderLocal(name);
    }
    return createFolderRemote(name).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return createFolderLocal(name);
      }
      if (remoteAvailable !== true && err && /failed to fetch|networkerror|load failed/i.test(String(err.message || err))) {
        remoteAvailable = false;
        return createFolderLocal(name);
      }
      throw err;
    });
  }

  function deleteFolderLocal(id) {
    var folders = getLocalFolders();
    var idx = folders.findIndex(function (it) { return it && it.id === id; });
    if (idx < 0) {
      return Promise.reject(new Error('Cartella non trovata.'));
    }
    var files = getLocalPdfs();
    var hasFiles = files.some(function (it) {
      return it && String(it.folderId || '') === String(id);
    });
    if (hasFiles) {
      return Promise.reject(new Error('La cartella non è vuota. Rimuovi prima i file al suo interno.'));
    }
    folders.splice(idx, 1);
    setLocalFolders(folders);
    return Promise.resolve();
  }

  function deleteFolderRemote(id) {
    return global.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify({
        action: 'deleteFolder',
        id: id,
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
          throw new Error((data && data.error) || 'Eliminazione cartella non riuscita.');
        }
        remoteAvailable = true;
      });
    });
  }

  function deleteFolder(folderOrId) {
    var id = typeof folderOrId === 'object' && folderOrId ? folderOrId.id : folderOrId;
    var source = typeof folderOrId === 'object' && folderOrId ? folderOrId.source : '';
    if (!id) return Promise.reject(new Error('ID cartella mancante.'));

    if (source === 'local' || String(id).indexOf('local_') === 0) {
      return deleteFolderLocal(id);
    }
    if (remoteAvailable === false) {
      return deleteFolderLocal(id);
    }
    return deleteFolderRemote(id).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return deleteFolderLocal(id);
      }
      if (remoteAvailable !== true && err && /failed to fetch|networkerror|load failed/i.test(String(err.message || err))) {
        remoteAvailable = false;
        return deleteFolderLocal(id);
      }
      throw err;
    });
  }

  function addLocal(file, title, folderId, description) {
    var folders = getLocalFolders();
    var folderOk = folders.some(function (f) { return f && f.id === folderId; });
    if (!folderId || !folderOk) {
      return Promise.reject(new Error('Seleziona una cartella per il file.'));
    }
    description = description ? String(description).trim() : '';
    return fileToBase64(file).then(function (base64) {
      var mime = guessMime(file);
      var cleanName = String(file.name || 'documento').replace(/\.(pdf|png)$/i, '');
      var item = normalizeItem({
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        title: title || cleanName,
        description: description,
        filename: cleanName,
        mimeType: mime,
        dataBase64: base64,
        size: file.size || 0,
        createdAt: Date.now(),
        folderId: folderId,
        source: 'local'
      });
      var listItems = getLocalPdfs();
      listItems.push({
        id: item.id,
        title: item.title,
        description: item.description,
        filename: item.filename,
        mimeType: item.mimeType,
        dataBase64: item.dataBase64,
        size: item.size,
        createdAt: item.createdAt,
        folderId: item.folderId
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

  function addRemote(file, title, folderId, description) {
    description = description ? String(description).trim() : '';
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
          description: description,
          filename: cleanName,
          mimeType: mime,
          dataBase64: base64,
          folderId: folderId,
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

  function add(file, title, folderId, description) {
    if (!file) return Promise.reject(new Error('Seleziona un file.'));
    if (!isAllowedFile(file)) {
      return Promise.reject(new Error('Sono ammessi solo PDF e PNG.'));
    }
    folderId = String(folderId || '').trim();
    if (!folderId) {
      return Promise.reject(new Error('Seleziona una cartella per il file.'));
    }
    description = description ? String(description).trim() : '';
    if (remoteAvailable === false) {
      return addLocal(file, title, folderId, description);
    }
    return addRemote(file, title, folderId, description).catch(function (err) {
      if (err && err.code === 'remote_unavailable') {
        return addLocal(file, title, folderId, description);
      }
      // Offline / server statico locale senza API
      if (remoteAvailable !== true && err && /failed to fetch|networkerror|load failed/i.test(String(err.message || err))) {
        remoteAvailable = false;
        return addLocal(file, title, folderId, description);
      }
      throw err;
    });
  }

  function updateLocal(id, patch) {
    var listItems = getLocalPdfs();
    var idx = listItems.findIndex(function (it) { return it && it.id === id; });
    if (idx < 0) {
      return Promise.reject(new Error('File non trovato.'));
    }
    var current = listItems[idx] || {};
    var nextTitle = patch && patch.title != null
      ? String(patch.title).trim()
      : (current.title || '');
    var nextDescription = patch && patch.description != null
      ? String(patch.description).trim()
      : (current.description || '');
    var nextFolderId = patch && patch.folderId != null
      ? String(patch.folderId).trim()
      : (current.folderId || '');
    if (!nextFolderId) {
      return Promise.reject(new Error('Seleziona una cartella per il file.'));
    }
    listItems[idx] = Object.assign({}, current, {
      title: nextTitle || current.filename || 'Senza titolo',
      description: nextDescription,
      folderId: nextFolderId
    });
    setLocalPdfs(listItems);
    return Promise.resolve(normalizeItem(listItems[idx]));
  }

  function updateRemote(id, patch) {
    return global.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify({
        action: 'update',
        id: id,
        title: patch && patch.title,
        description: patch && patch.description,
        folderId: patch && patch.folderId,
        password: getAdminPassword()
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 404 && data && data.error === 'File non trovato.') {
          var err404 = new Error('File non trovato.');
          err404.code = 'not_found';
          throw err404;
        }
        if (res.status === 503 || res.status === 404) {
          remoteAvailable = false;
          var err503 = new Error('remote_unavailable');
          err503.code = 'remote_unavailable';
          throw err503;
        }
        if (!res.ok || !data || !data.ok) {
          remoteAvailable = true;
          throw new Error((data && data.error) || 'Modifica non riuscita.');
        }
        remoteAvailable = true;
        return normalizeItem(data.item);
      });
    });
  }

  function update(itemOrId, patch) {
    var id = typeof itemOrId === 'object' && itemOrId ? itemOrId.id : itemOrId;
    var source = typeof itemOrId === 'object' && itemOrId ? itemOrId.source : '';
    if (!id) return Promise.reject(new Error('File non trovato.'));
    patch = patch || {};

    if (source === 'local' || String(id).indexOf('local_') === 0) {
      return updateLocal(id, patch);
    }
    if (remoteAvailable === false) {
      return updateLocal(id, patch);
    }
    return updateRemote(id, patch).catch(function (err) {
      // Solo offline/503 → localStorage. not_found remoto non va "salvato" in locale
      // (altrimenti l'admin vede successo ma Blob resta invariato).
      if (err && err.code === 'remote_unavailable') {
        return updateLocal(id, patch);
      }
      if (remoteAvailable !== true && err && /failed to fetch|networkerror|load failed/i.test(String(err.message || err))) {
        remoteAvailable = false;
        return updateLocal(id, patch);
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
    update: update,
    remove: remove,
    createFolder: createFolder,
    deleteFolder: deleteFolder,
    guessMime: guessMime,
    isAllowedFile: isAllowedFile,
    getFileHref: getFileHref,
    canPreview: canPreview,
    getAdminPassword: getAdminPassword,
    isRemoteAvailable: function () { return remoteAvailable; }
  };
})(typeof window !== 'undefined' ? window : this);
