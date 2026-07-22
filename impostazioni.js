(function (global) {
  'use strict';

  var STORAGE_KEY_DOWNLOAD = 'download_secret';
  var STORAGE_KEY_ADMIN_PASSWORD = 'admin_password';
  var SETTINGS_API = '/api/settings';

  function getConfig() {
    return global.PriscillaConfig || {};
  }

  function getDefaultDownloadKey() {
    return (getConfig().defaultDownloadKey || '').trim();
  }

  function getStoredAdminPassword() {
    try {
      return (global.localStorage.getItem(STORAGE_KEY_ADMIN_PASSWORD) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function setStoredAdminPassword(password) {
    try {
      if (password) {
        global.localStorage.setItem(STORAGE_KEY_ADMIN_PASSWORD, password);
      }
    } catch (e) {}
  }

  function getAdminPassword() {
    var stored = getStoredAdminPassword();
    if (stored) return stored;
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
    }, 4000);
  }

  function postSettings(payload) {
    return fetch(SETTINGS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    }).then(function (res) {
      return res.json().then(function (data) {
        return { res: res, data: data || {} };
      }).catch(function () {
        return { res: res, data: {} };
      });
    });
  }

  function initDownloadKeyForm() {
    var form = document.getElementById('formChiaveDownload');
    var input = document.getElementById('downloadKey');
    var msg = document.getElementById('msgChiave');
    var hint = document.getElementById('downloadKeyHint');
    if (!form || !input) return;

    var fallback = getDefaultDownloadKey();
    if (hint) {
      hint.textContent = fallback
        ? 'Se il campo è vuoto, i clienti useranno la chiave predefinita: «' + fallback + '».'
        : 'Imposta una chiave: senza di essa l\'area Scarica resterà inaccessibile.';
    }

    fetch(SETTINGS_API, { cache: 'no-store' })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok && data.downloadKey) {
          input.value = data.downloadKey;
        }
      })
      .catch(function () {});

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = (input.value || '').trim();
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      postSettings({
        action: 'setDownloadKey',
        password: getAdminPassword(),
        downloadKey: key
      })
        .then(function (result) {
          if (result.data && result.data.ok) {
            try {
              if (key) {
                global.localStorage.setItem(STORAGE_KEY_DOWNLOAD, key);
              } else {
                global.localStorage.removeItem(STORAGE_KEY_DOWNLOAD);
              }
            } catch (err) {}
            showMessage(
              msg,
              key
                ? 'Chiave salvata per tutti i clienti.'
                : 'Chiave personalizzata rimossa: verrà usata quella predefinita.',
              false
            );
            return;
          }
          showMessage(
            msg,
            (result.data && result.data.error) || 'Impossibile salvare la chiave.',
            true
          );
        })
        .catch(function () {
          showMessage(msg, 'Errore di rete: riprova.', true);
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function initAdminPasswordForm() {
    var form = document.getElementById('formAdminPassword');
    var currentInput = document.getElementById('adminPasswordCurrent');
    var input = document.getElementById('adminPassword');
    var confirmInput = document.getElementById('adminPasswordConfirm');
    var msg = document.getElementById('msgAdminPassword');
    if (!form || !input) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var currentPassword = currentInput
        ? (currentInput.value || '').trim()
        : getAdminPassword();
      var password = (input.value || '').trim();
      var confirm = confirmInput ? (confirmInput.value || '').trim() : password;

      if (!currentPassword) {
        showMessage(msg, 'Inserisci la password attuale.', true);
        return;
      }
      if (!password) {
        showMessage(msg, 'Inserisci una nuova password admin.', true);
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

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      postSettings({
        action: 'setAdminPassword',
        currentPassword: currentPassword,
        newPassword: password
      })
        .then(function (result) {
          if (result.data && result.data.ok) {
            setStoredAdminPassword(password);
            if (currentInput) currentInput.value = '';
            input.value = '';
            if (confirmInput) confirmInput.value = '';
            showMessage(msg, 'Password admin aggiornata per tutti i dispositivi.', false);
            return;
          }
          showMessage(
            msg,
            (result.data && result.data.error) || 'Impossibile salvare la password.',
            true
          );
        })
        .catch(function () {
          showMessage(msg, 'Errore di rete: riprova.', true);
        })
        .then(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  global.PriscillaImpostazioni = {
    STORAGE_KEY_DOWNLOAD: STORAGE_KEY_DOWNLOAD,
    STORAGE_KEY_ADMIN_PASSWORD: STORAGE_KEY_ADMIN_PASSWORD,
    getDefaultDownloadKey: getDefaultDownloadKey,
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
