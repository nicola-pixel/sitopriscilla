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

  function renderListaPdf() {
    var pdfs = getPdfs();
    listaPdf.innerHTML = '';
    if (pdfs.length === 0) {
      listaPdf.innerHTML = '<li class="download-empty">Nessun file disponibile al momento.</li>';
      return;
    }
    pdfs.forEach(function (item, index) {
      var mime = item.mimeType || 'application/pdf';
      var isPng = mime === 'image/png';
      var ext = isPng ? '.png' : '.pdf';
      var title = item.title || 'Documento ' + (index + 1);
      var li = document.createElement('li');
      li.className = 'download-card ' + (isPng ? 'download-card--png' : 'download-card--pdf');
      var href = item.dataBase64 ? 'data:' + mime + ';base64,' + item.dataBase64 : '#';
      var filename = (item.filename || item.title || 'documento') + ext;
      li.innerHTML =
        '<span class="download-card-icon" aria-hidden="true">' + (isPng ? '🖼️' : '📄') + '</span>' +
        '<div class="download-card-body">' +
          '<span class="download-card-title">' + escapeHtml(title) + '</span>' +
          '<a href="' + href + '" download="' + escapeHtml(filename) + '" class="download-card-btn">Scarica</a>' +
        '</div>';
      listaPdf.appendChild(li);
    });
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showForm() {
    formSection.hidden = false;
    listaSection.hidden = true;
    erroreChiave.hidden = true;
    chiaveInput.value = '';
  }

  function showLista() {
    formSection.hidden = true;
    listaSection.hidden = false;
    renderListaPdf();
  }

  if (formChiave) {
    formChiave.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = (chiaveInput.value || '').trim();
      var expected = getDownloadKey();
      erroreChiave.hidden = true;
      if (key && expected && key === expected) {
        setUnlocked(true);
        showLista();
      } else {
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
