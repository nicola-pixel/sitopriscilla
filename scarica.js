(function () {
  'use strict';

  var STORAGE_KEY_UNLOCK = 'scarica_unlocked';
  var STORAGE_KEY_PDFS = 'scarica_pdfs';
  var STORAGE_KEY_DOWNLOAD_KEY = 'download_secret';

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

  function getPdfs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_PDFS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
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

  function closePreview() {
    if (!previewModal || previewModal.hidden) return;
    previewModal.hidden = true;
    document.body.classList.remove('preview-modal-open');
    revokePreviewUrl();
    if (previewBody) previewBody.innerHTML = '';
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
    if (!previewModal || !previewBody || !item || !item.dataBase64) return;

    var mime = item.mimeType || 'application/pdf';
    var isPng = mime === 'image/png';
    var title = item.title || 'Documento ' + (index + 1);
    var ext = isPng ? '.png' : '.pdf';
    var filename = (item.filename || item.title || 'documento') + ext;

    lastFocusEl = triggerEl || document.activeElement;
    revokePreviewUrl();
    previewObjectUrl = base64ToObjectUrl(item.dataBase64, mime);

    if (previewTitle) previewTitle.textContent = title;

    if (previewDownload) {
      previewDownload.href = previewObjectUrl;
      previewDownload.setAttribute('download', filename);
      previewDownload.setAttribute('data-file-title', title);
      previewDownload.setAttribute('data-file-name', filename);
      previewDownload.setAttribute('data-file-mime', mime);
    }

    previewBody.innerHTML = '';
    if (isPng) {
      var img = document.createElement('img');
      img.className = 'preview-modal-image';
      img.src = previewObjectUrl;
      img.alt = title;
      previewBody.appendChild(img);
      previewBody.className = 'preview-modal-body preview-modal-body--image';
    } else {
      var iframe = document.createElement('iframe');
      iframe.className = 'preview-modal-frame';
      iframe.src = previewObjectUrl + '#toolbar=1&navpanes=0&view=FitH';
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
    if (mime === 'image/png') return { label: 'PNG', kind: 'png' };
    return { label: 'PDF', kind: 'pdf' };
  }

  function renderListaPdf() {
    var pdfs = getPdfs();
    listaPdf.innerHTML = '';
    if (pdfs.length === 0) {
      listaPdf.innerHTML = '<li class="download-empty">Nessun file disponibile al momento.</li>';
      return;
    }
    pdfs.forEach(function (item, index) {
      var mime = item.mimeType || 'application/pdf';
      var meta = fileMeta(item);
      var isPng = meta.kind === 'png';
      var ext = isPng ? '.png' : '.pdf';
      var title = item.title || 'Documento ' + (index + 1);
      var filename = (item.filename || item.title || 'documento') + ext;
      var href = item.dataBase64 ? 'data:' + mime + ';base64,' + item.dataBase64 : '#';
      var canPreview = !!item.dataBase64;

      var li = document.createElement('li');
      li.className = 'download-card download-card--' + meta.kind;
      li.style.setProperty('--card-i', String(index));
      li.setAttribute('data-file-index', String(index));
      li.setAttribute('data-file-title', title);
      li.setAttribute('data-file-name', filename);
      li.setAttribute('data-file-mime', mime);

      li.innerHTML =
        '<div class="download-card-badge" aria-hidden="true">' +
          '<span class="download-card-badge-label">' + meta.label + '</span>' +
        '</div>' +
        '<div class="download-card-body">' +
          '<div class="download-card-copy">' +
            '<span class="download-card-title">' + escapeHtml(title) + '</span>' +
            '<span class="download-card-type">' + meta.label + ' · Documento riservato</span>' +
          '</div>' +
          '<div class="download-card-actions">' +
            '<button type="button" class="download-card-btn download-card-btn--apri"' +
              (canPreview ? '' : ' disabled') +
              ' data-action-preview="1">Apri</button>' +
            '<a href="' + href + '" download="' + escapeHtml(filename) +
              '" class="download-card-btn download-card-btn--scarica" data-track-download="1">Scarica</a>' +
          '</div>' +
        '</div>';

      listaPdf.appendChild(li);
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
      var previewBtn = e.target.closest('[data-action-preview]');
      if (previewBtn) {
        e.preventDefault();
        if (previewBtn.disabled) return;
        var card = previewBtn.closest('[data-file-index]');
        if (!card) return;
        var index = parseInt(card.getAttribute('data-file-index'), 10);
        var pdfs = getPdfs();
        if (!pdfs[index]) return;
        openPreview(pdfs[index], index, previewBtn);
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
