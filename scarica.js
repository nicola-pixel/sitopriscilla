(function () {
  'use strict';

  var STORAGE_KEY_UNLOCK = 'scarica_unlocked';
  var STORAGE_KEY_DOWNLOAD_KEY = 'download_secret';
  var materialeStore = window.PriscillaMateriale || null;
  var cachedPdfs = [];
  var cachedFolders = [];
  var flatPreviewItems = [];
  var folderGroupsById = {};

  var formSection = document.getElementById('scarica-form-section');
  var listaSection = document.getElementById('scarica-lista-section');
  var formChiave = document.getElementById('formChiave');
  var chiaveInput = document.getElementById('chiave');
  var erroreChiave = document.getElementById('erroreChiave');
  var listaPdf = document.getElementById('listaPdf');
  var btnEsci = document.getElementById('btnEsci');

  var previewModal = document.getElementById('previewModal');
  var previewOverlay = document.getElementById('previewModalOverlay');
  var previewBody = document.getElementById('previewModalBody');
  var previewTitle = document.getElementById('previewModalTitle');
  var previewDescription = document.getElementById('previewModalDescription');
  var previewDownload = document.getElementById('previewModalDownload');
  var previewClose = document.getElementById('previewModalClose');
  var previewObjectUrl = null;
  var lastFocusEl = null;

  function getDownloadKey() {
    return localStorage.getItem(STORAGE_KEY_DOWNLOAD_KEY) ||
      (window.PriscillaConfig && window.PriscillaConfig.defaultDownloadKey) ||
      '';
  }

  function isUnlocked() {
    return sessionStorage.getItem(STORAGE_KEY_UNLOCK) === '1';
  }

  function setUnlocked(value) {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY_UNLOCK, '1');
    } else {
      sessionStorage.removeItem(STORAGE_KEY_UNLOCK);
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function revokePreviewUrl() {
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
  }

  function base64ToObjectUrl(base64, mime) {
    var binary = atob(base64);
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  function itemPreviewUrl(item) {
    if (!item) return '';
    if (item.url) return item.url;
    if (item.dataBase64) {
      return base64ToObjectUrl(item.dataBase64, item.mimeType || 'application/pdf');
    }
    return '';
  }

  function itemHref(item) {
    if (materialeStore && typeof materialeStore.getFileHref === 'function') {
      return materialeStore.getFileHref(item);
    }
    if (item && item.url) return item.url;
    if (item && item.dataBase64) {
      return 'data:' + (item.mimeType || 'application/pdf') + ';base64,' + item.dataBase64;
    }
    return '#';
  }

  function itemCanPreview(item) {
    if (materialeStore && typeof materialeStore.canPreview === 'function') {
      return materialeStore.canPreview(item);
    }
    return !!(item && (item.url || item.dataBase64));
  }

  function trackDownloadFromEl(el) {
    if (!el || !window.PriscillaAnalytics) return;
    var card = el.closest('[data-file-title]');
    if (!card) return;
    window.PriscillaAnalytics.trackDownload(
      card.getAttribute('data-file-title'),
      card.getAttribute('data-file-name'),
      card.getAttribute('data-file-mime')
    );
  }

  function fileDescription(item, meta) {
    var description = (item && item.description ? String(item.description) : '').trim();
    if (description) return description;
    var label = (meta && meta.label) || 'PDF';
    return 'Formato ' + label + ' · documento pronto da aprire in anteprima oppure da scaricare sul tuo dispositivo.';
  }

  function closePreview() {
    if (!previewModal || previewModal.hidden) return;
    previewModal.hidden = true;
    document.body.classList.remove('preview-modal-open');
    revokePreviewUrl();
    if (previewBody) previewBody.innerHTML = '';
    if (previewDescription) previewDescription.textContent = '';
    if (previewDownload) {
      previewDownload.removeAttribute('href');
      previewDownload.removeAttribute('download');
      previewDownload.removeAttribute('data-file-title');
      previewDownload.removeAttribute('data-file-name');
      previewDownload.removeAttribute('data-file-mime');
    }
    if (lastFocusEl && typeof lastFocusEl.focus === 'function') {
      lastFocusEl.focus();
    }
    lastFocusEl = null;
  }

  function openPreview(item, index, triggerEl) {
    if (!previewModal || !previewBody || !item || !itemCanPreview(item)) return;

    var mime = item.mimeType || 'application/pdf';
    var isPng = mime === 'image/png';
    var meta = fileMeta(item);
    var title = item.title || 'Documento ' + (index + 1);
    var description = fileDescription(item, meta);
    var ext = isPng ? '.png' : '.pdf';
    var filename = (item.filename || item.title || 'documento') + ext;

    lastFocusEl = triggerEl || document.activeElement;
    revokePreviewUrl();
    var src = itemPreviewUrl(item);
    if (!src) return;
    if (item.dataBase64 && !item.url) {
      previewObjectUrl = src;
    }

    if (previewTitle) previewTitle.textContent = title;
    if (previewDescription) previewDescription.textContent = description;

    if (previewDownload) {
      previewDownload.href = item.url || src;
      previewDownload.setAttribute('download', filename);
      previewDownload.setAttribute('data-file-title', title);
      previewDownload.setAttribute('data-file-name', filename);
      previewDownload.setAttribute('data-file-mime', mime);
    }

    previewBody.innerHTML = '';
    if (isPng) {
      var img = document.createElement('img');
      img.className = 'preview-modal-image';
      img.src = src;
      img.alt = title;
      previewBody.appendChild(img);
      previewBody.className = 'preview-modal-body preview-modal-body--image';
    } else {
      var iframe = document.createElement('iframe');
      iframe.className = 'preview-modal-frame';
      iframe.src = src + (src.indexOf('#') >= 0 ? '' : '#toolbar=1&navpanes=0&view=FitH');
      iframe.title = 'Anteprima di ' + title;
      iframe.setAttribute('allow', 'fullscreen');
      previewBody.appendChild(iframe);
      previewBody.className = 'preview-modal-body preview-modal-body--pdf';
    }

    previewModal.hidden = false;
    document.body.classList.add('preview-modal-open');
    if (previewClose) previewClose.focus();
  }

  function fileMeta(item) {
    var mime = item.mimeType || 'application/pdf';
    if (mime === 'image/png') {
      return { label: 'PNG', kind: 'png', hint: 'Immagine' };
    }
    return { label: 'PDF', kind: 'pdf', hint: 'Documento' };
  }

  function fileIconSvg(kind) {
    if (kind === 'png') {
      return (
        '<svg class="download-card-icon" viewBox="0 0 48 56" fill="none" aria-hidden="true">' +
          '<path class="download-card-icon-sheet" d="M8 4h22l10 10v38a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"/>' +
          '<path class="download-card-icon-fold" d="M30 4v8a2 2 0 0 0 2 2h8"/>' +
          '<rect class="download-card-icon-preview" x="12" y="22" width="24" height="16" rx="2"/>' +
          '<circle class="download-card-icon-dot" cx="17" cy="27" r="2"/>' +
          '<path class="download-card-icon-mount" d="M12 34l6-5 5 4 4-3 9 7H12Z"/>' +
        '</svg>'
      );
    }
    return (
      '<svg class="download-card-icon" viewBox="0 0 48 56" fill="none" aria-hidden="true">' +
        '<path class="download-card-icon-sheet" d="M8 4h22l10 10v38a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"/>' +
        '<path class="download-card-icon-fold" d="M30 4v8a2 2 0 0 0 2 2h8"/>' +
        '<path class="download-card-icon-line" d="M14 24h20M14 30h20M14 36h12"/>' +
      '</svg>'
    );
  }

  function sanitizeZipName(name) {
    return String(name || 'cartella')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'cartella';
  }

  function uniqueZipEntryName(baseName, usedNames) {
    var name = baseName;
    var n = 2;
    while (usedNames[name]) {
      var dot = baseName.lastIndexOf('.');
      if (dot > 0) {
        name = baseName.slice(0, dot) + ' (' + n + ')' + baseName.slice(dot);
      } else {
        name = baseName + ' (' + n + ')';
      }
      n += 1;
    }
    usedNames[name] = true;
    return name;
  }

  function itemToBlob(item) {
    if (!item) return Promise.reject(new Error('File non valido.'));
    if (item.url) {
      return fetch(item.url, { cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('Impossibile scaricare un file della cartella.');
        return res.blob();
      });
    }
    if (item.dataBase64) {
      var binary = atob(item.dataBase64);
      var len = binary.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return Promise.resolve(new Blob([bytes], { type: item.mimeType || 'application/octet-stream' }));
    }
    return Promise.reject(new Error('File non disponibile.'));
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function downloadFolderZip(folderId, triggerBtn) {
    var group = folderGroupsById[String(folderId || '')];
    if (!group || !group.files || !group.files.length) return Promise.resolve();
    if (typeof JSZip === 'undefined') {
      window.alert('Download cartella non disponibile. Ricarica la pagina e riprova.');
      return Promise.resolve();
    }

    var folderName = sanitizeZipName(group.folder && group.folder.name);
    var zipFilename = folderName + '.zip';
    var originalLabel = triggerBtn ? triggerBtn.innerHTML : '';

    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.classList.add('is-loading');
      triggerBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v4m0 8v4m8-8h-4M8 12H4m11.3-5.3-2.8 2.8M9.5 14.5l-2.8 2.8m10.6 0-2.8-2.8M9.5 9.5 6.7 6.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
        '<span>Preparazione…</span>';
    }

    var zip = new JSZip();
    var usedNames = {};
    var chain = Promise.resolve();

    group.files.forEach(function (item) {
      chain = chain.then(function () {
        var mime = item.mimeType || 'application/pdf';
        var ext = mime === 'image/png' ? '.png' : '.pdf';
        var base = sanitizeZipName(item.filename || item.title || 'documento') + ext;
        var entryName = uniqueZipEntryName(base, usedNames);
        return itemToBlob(item).then(function (blob) {
          zip.file(entryName, blob);
        });
      });
    });

    return chain.then(function () {
      return zip.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      downloadBlob(blob, zipFilename);
      if (window.PriscillaAnalytics) {
        window.PriscillaAnalytics.trackDownload(
          group.folder && group.folder.name ? group.folder.name : 'Cartella',
          zipFilename,
          'application/zip'
        );
      }
    }).catch(function (err) {
      window.alert((err && err.message) || 'Impossibile scaricare la cartella. Riprova.');
    }).then(function () {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.classList.remove('is-loading');
        triggerBtn.innerHTML = originalLabel;
      }
    });
  }

  function renderListaPdfFromItems(pdfs, folders) {
    cachedPdfs = Array.isArray(pdfs) ? pdfs : [];
    cachedFolders = Array.isArray(folders) ? folders : [];
    flatPreviewItems = [];
    folderGroupsById = {};
    listaPdf.innerHTML = '';

    var groups = [];
    var used = {};
    cachedFolders.forEach(function (folder) {
      if (!folder || !folder.id) return;
      var files = cachedPdfs.filter(function (it) {
        return it && String(it.folderId || '') === String(folder.id);
      });
      if (!files.length) return;
      files.forEach(function (it) {
        if (it && it.id) used[String(it.id)] = true;
      });
      groups.push({ folder: folder, files: files });
    });

    // Solo file in cartella: i legacy senza folderId non compaiono nell'area pubblica
    if (groups.length === 0) {
      listaPdf.innerHTML =
        '<li class="download-empty">' +
          '<span class="download-empty-icon" aria-hidden="true"></span>' +
          '<span class="download-empty-title">Nessun file disponibile</span>' +
          '<span class="download-empty-text">Al momento non ci sono documenti in quest’area.</span>' +
        '</li>';
      return;
    }

    var cardIndex = 0;
    groups.forEach(function (group, groupIndex) {
      folderGroupsById[String(group.folder.id)] = group;

      var folderLi = document.createElement('li');
      folderLi.className = 'download-folder';
      folderLi.style.setProperty('--folder-i', String(groupIndex));
      folderLi.setAttribute('data-folder-id', group.folder.id);
      folderLi.innerHTML =
        '<div class="download-folder-header">' +
          '<span class="download-folder-icon" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
          '</span>' +
          '<div class="download-folder-copy">' +
            '<h3 class="download-folder-title">' + escapeHtml(group.folder.name || 'Cartella') + '</h3>' +
            '<p class="download-folder-meta">' + group.files.length + (group.files.length === 1 ? ' file' : ' file') + '</p>' +
          '</div>' +
          '<button type="button" class="download-card-btn download-card-btn--scarica download-folder-download" data-action-download-folder="1" aria-label="Scarica cartella ' + escapeHtml(group.folder.name || '') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '<span>Scarica cartella</span>' +
          '</button>' +
        '</div>';

      var filesUl = document.createElement('ul');
      filesUl.className = 'download-folder-files';

      group.files.forEach(function (item) {
        var previewIndex = flatPreviewItems.length;
        flatPreviewItems.push(item);
        var mime = item.mimeType || 'application/pdf';
        var meta = fileMeta(item);
        var isPng = meta.kind === 'png';
        var ext = isPng ? '.png' : '.pdf';
        var title = item.title || 'Documento ' + (previewIndex + 1);
        var description = fileDescription(item, meta);
        var filename = (item.filename || item.title || 'documento') + ext;
        var href = itemHref(item);
        var canPreview = itemCanPreview(item);

        var li = document.createElement('li');
        li.className = 'download-card download-card--' + meta.kind;
        li.style.setProperty('--card-i', String(cardIndex));
        cardIndex += 1;
        li.setAttribute('data-file-index', String(previewIndex));
        li.setAttribute('data-file-title', title);
        li.setAttribute('data-file-name', filename);
        li.setAttribute('data-file-mime', mime);

        li.innerHTML =
          '<div class="download-card-visual" aria-hidden="true">' +
            '<div class="download-card-glyph">' +
              fileIconSvg(meta.kind) +
              '<span class="download-card-ext">' + meta.label + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="download-card-body">' +
            '<div class="download-card-copy">' +
              '<div class="download-card-meta">' +
                '<span class="download-card-pill">' + meta.hint + '</span>' +
                '<span class="download-card-pill download-card-pill--lock">Riservato</span>' +
              '</div>' +
              '<span class="download-card-title">' + escapeHtml(title) + '</span>' +
              '<p class="download-card-description">' + escapeHtml(description) + '</p>' +
            '</div>' +
            '<div class="download-card-actions">' +
              '<button type="button" class="download-card-btn download-card-btn--apri"' +
                (canPreview ? '' : ' disabled') +
                ' data-action-preview="1">' +
                '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>' +
                '<span>Apri</span>' +
              '</button>' +
              '<a href="' + href + '" download="' + escapeHtml(filename) +
                '" class="download-card-btn download-card-btn--scarica" data-track-download="1"' +
                (item.url ? ' target="_blank" rel="noopener"' : '') +
                '>' +
                '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                '<span>Scarica</span>' +
              '</a>' +
            '</div>' +
          '</div>';

        filesUl.appendChild(li);
      });

      folderLi.appendChild(filesUl);
      listaPdf.appendChild(folderLi);
    });
  }

  function renderListaPdf() {
    if (!listaPdf) return Promise.resolve();
    listaPdf.innerHTML = '<li class="download-empty">Caricamento file…</li>';
    if (!materialeStore) {
      renderListaPdfFromItems([], []);
      return Promise.resolve();
    }
    return materialeStore.list().then(function (result) {
      renderListaPdfFromItems(
        result && result.items ? result.items : [],
        result && result.folders ? result.folders : []
      );
    }).catch(function () {
      renderListaPdfFromItems([], []);
    });
  }

  function showForm() {
    formSection.hidden = false;
    listaSection.hidden = true;
    erroreChiave.hidden = true;
    chiaveInput.value = '';
    closePreview();
  }

  function showLista() {
    formSection.hidden = true;
    listaSection.hidden = false;
    renderListaPdf();
  }

  if (listaPdf) {
    listaPdf.addEventListener('click', function (e) {
      var folderBtn = e.target.closest('[data-action-download-folder]');
      if (folderBtn) {
        e.preventDefault();
        if (folderBtn.disabled) return;
        var folderEl = folderBtn.closest('[data-folder-id]');
        if (!folderEl) return;
        downloadFolderZip(folderEl.getAttribute('data-folder-id'), folderBtn);
        return;
      }

      var previewBtn = e.target.closest('[data-action-preview]');
      if (previewBtn) {
        e.preventDefault();
        if (previewBtn.disabled) return;
        var card = previewBtn.closest('[data-file-index]');
        if (!card) return;
        var index = parseInt(card.getAttribute('data-file-index'), 10);
        if (!flatPreviewItems[index]) return;
        openPreview(flatPreviewItems[index], index, previewBtn);
        return;
      }

      var link = e.target.closest('[data-track-download]');
      if (!link) return;
      trackDownloadFromEl(link);
    });
  }

  if (previewDownload) {
    previewDownload.addEventListener('click', function () {
      if (!window.PriscillaAnalytics) return;
      window.PriscillaAnalytics.trackDownload(
        previewDownload.getAttribute('data-file-title'),
        previewDownload.getAttribute('data-file-name'),
        previewDownload.getAttribute('data-file-mime')
      );
    });
  }

  if (previewClose) {
    previewClose.addEventListener('click', closePreview);
  }
  if (previewOverlay) {
    previewOverlay.addEventListener('click', closePreview);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && previewModal && !previewModal.hidden) {
      e.preventDefault();
      closePreview();
    }
  });

  if (formChiave) {
    formChiave.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = (chiaveInput.value || '').trim();
      var expected = getDownloadKey();
      erroreChiave.hidden = true;
      if (key && expected && key === expected) {
        setUnlocked(true);
        if (window.PriscillaAnalytics) window.PriscillaAnalytics.trackAreaUnlock(true);
        showLista();
      } else {
        if (window.PriscillaAnalytics) window.PriscillaAnalytics.trackAreaUnlock(false);
        erroreChiave.hidden = false;
        chiaveInput.focus();
      }
    });
  }

  if (btnEsci) {
    btnEsci.addEventListener('click', function () {
      setUnlocked(false);
      showForm();
    });
  }

  if (isUnlocked()) {
    showLista();
  } else {
    showForm();
  }
})();
