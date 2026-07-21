(function (global) {
  'use strict';

  var STORAGE_KEY_DOWNLOAD = 'download_secret';
  var STORAGE_KEY_ADMIN_PASSWORD = 'admin_password';

  function getConfig() {
    return global.PriscillaConfig || {};
  }

  function getDefaultDownloadKey() {
    return (getConfig().defaultDownloadKey || '').trim();
  }

  function getStoredDownloadKey() {
    try {
      return (global.localStorage.getItem(STORAGE_KEY_DOWNLOAD) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function getEffectiveDownloadKey() {
    return getStoredDownloadKey() || getDefaultDownloadKey();
  }

  function getAdminPassword() {
    try {
      var stored = (global.localStorage.getItem(STORAGE_KEY_ADMIN_PASSWORD) || '').trim();
      if (stored) return stored;
    } catch (e) {}
    return (getConfig().adminPassword || '').trim();
  }

  function showMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('msg-error', !!isError);
    el.classList.toggle('msg-ok', !isError);
    el.hidden = false;
    global.setTimeout(function () {
      el.hidden = true;
    }, 3000);
  }

  function initDownloadKeyForm() {
    var form = document.getElementById('formChiaveDownload');
    var input = document.getElementById('downloadKey');
    var msg = document.getElementById('msgChiave');
    var hint = document.getElementById('downloadKeyHint');
    if (!form || !input) return;

    input.value = getStoredDownloadKey();
    if (hint) {
      var fallback = getDefaultDownloadKey();
      hint.textContent = fallback
        ? 'Se il campo è vuoto, i clienti useranno la chiave predefinita: «' + fallback + '».'
        : 'Imposta una chiave: senza di essa l\'area Scarica resterà inaccessibile.';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = (input.value || '').trim();
      try {
        if (key) {
          global.localStorage.setItem(STORAGE_KEY_DOWNLOAD, key);
        } else {
          global.localStorage.removeItem(STORAGE_KEY_DOWNLOAD);
        }
        showMessage(
          msg,
          key ? 'Chiave salvata.' : 'Chiave personalizzata rimossa: verrà usata quella predefinita.',
          false
        );
      } catch (err) {
        showMessage(msg, 'Impossibile salvare la chiave in questo browser.', true);
      }
    });
  }

  function initAdminPasswordForm() {
    var form = document.getElementById('formAdminPassword');
    var input = document.getElementById('adminPassword');
    var confirmInput = document.getElementById('adminPasswordConfirm');
    var msg = document.getElementById('msgAdminPassword');
    if (!form || !input) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var password = (input.value || '').trim();
      var confirm = confirmInput ? (confirmInput.value || '').trim() : password;

      if (!password) {
        showMessage(msg, 'Inserisci una password admin.', true);
        return;
      }
      if (password !== confirm) {
        showMessage(msg, 'Le password non coincidono.', true);
        return;
      }
      if (password.length < 6) {
        showMessage(msg, 'Usa almeno 6 caratteri.', true);
        return;
      }

      try {
        global.localStorage.setItem(STORAGE_KEY_ADMIN_PASSWORD, password);
        input.value = '';
        if (confirmInput) confirmInput.value = '';
        showMessage(msg, 'Password admin aggiornata.', false);
      } catch (err) {
        showMessage(msg, 'Impossibile salvare la password in questo browser.', true);
      }
    });
  }

  global.PriscillaImpostazioni = {
    STORAGE_KEY_DOWNLOAD: STORAGE_KEY_DOWNLOAD,
    STORAGE_KEY_ADMIN_PASSWORD: STORAGE_KEY_ADMIN_PASSWORD,
    getDefaultDownloadKey: getDefaultDownloadKey,
    getStoredDownloadKey: getStoredDownloadKey,
    getEffectiveDownloadKey: getEffectiveDownloadKey,
    getAdminPassword: getAdminPassword
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initDownloadKeyForm();
      initAdminPasswordForm();
    });
  } else {
    initDownloadKeyForm();
    initAdminPasswordForm();
  }
})(typeof window !== 'undefined' ? window : this);
