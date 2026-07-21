(function () {
  'use strict';

  var store = window.PriscillaCodici || null;
  var form = document.getElementById('formCodiceSconto');
  var nameInput = document.getElementById('codiceName');
  var codeInput = document.getElementById('codiceValue');
  var editIdInput = document.getElementById('codiceEditId');
  var msg = document.getElementById('msgCodice');
  var lista = document.getElementById('listaCodiciAdmin');
  var btnSubmit = document.getElementById('btnSalvaCodice');
  var btnCancel = document.getElementById('btnAnnullaModificaCodice');
  var storageHint = document.getElementById('codiciStorageHint');

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showMsg(text, type) {
    if (!msg) return;
    msg.hidden = !text;
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' msg-' + type : '');
  }

  function resetForm() {
    if (form) form.reset();
    if (editIdInput) editIdInput.value = '';
    if (btnSubmit) btnSubmit.textContent = 'Aggiungi codice';
    if (btnCancel) btnCancel.hidden = true;
  }

  function setEditing(item) {
    if (!item) {
      resetForm();
      return;
    }
    if (editIdInput) editIdInput.value = item.id || '';
    if (nameInput) nameInput.value = item.name || '';
    if (codeInput) codeInput.value = item.code || '';
    if (btnSubmit) btnSubmit.textContent = 'Salva modifiche';
    if (btnCancel) btnCancel.hidden = false;
    if (nameInput) nameInput.focus();
  }

  function renderList(items) {
    if (!lista) return;
    lista.innerHTML = '';

    if (!items || !items.length) {
      lista.innerHTML = '<p class="empty">Nessun codice sconto. Aggiungine uno qui sopra.</p>';
      return;
    }

    var ul = document.createElement('ul');
    ul.className = 'lista-pdf-admin';

    items.forEach(function (item) {
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="pdf-meta">' +
          '<span class="pdf-title">' + escapeHtml(item.name || 'Senza nome') + '</span>' +
          '<span class="pdf-description">Codice: <strong>' + escapeHtml(item.code || '') + '</strong></span>' +
        '</div>' +
        '<div class="pdf-actions">' +
          '<button type="button" class="btn-edit" data-edit="' + escapeHtml(item.id) + '">Modifica</button>' +
          '<button type="button" class="btn-remove" data-remove="' + escapeHtml(item.id) + '">Elimina</button>' +
        '</div>';
      ul.appendChild(li);
    });

    lista.appendChild(ul);

    lista.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        var found = items.find(function (it) { return it && it.id === id; });
        if (found) setEditing(found);
      });
    });

    lista.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-remove');
        if (!id || !store) return;
        if (!window.confirm('Eliminare questo codice sconto?')) return;
        btn.disabled = true;
        store.remove(id).then(function () {
          showMsg('Codice eliminato.', 'ok');
          return refresh();
        }).catch(function (err) {
          showMsg((err && err.message) || 'Eliminazione non riuscita.', 'error');
          btn.disabled = false;
        });
      });
    });
  }

  function refresh() {
    if (!store) {
      renderList([]);
      return Promise.resolve();
    }
    if (lista) lista.innerHTML = '<p class="empty">Caricamento…</p>';
    return store.list().then(function (result) {
      var items = result && result.items ? result.items : [];
      if (storageHint) {
        if (result && result.source === 'local') {
          storageHint.hidden = false;
          storageHint.textContent = 'Salvataggio locale: i codici restano su questo browser finché Vercel Blob non è collegato.';
        } else {
          storageHint.hidden = true;
        }
      }
      renderList(items);
    }).catch(function () {
      renderList([]);
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!store) {
        showMsg('Store non disponibile.', 'error');
        return;
      }
      var name = (nameInput && nameInput.value || '').trim();
      var code = (codeInput && codeInput.value || '').trim();
      var editId = (editIdInput && editIdInput.value || '').trim();
      if (!name || !code) {
        showMsg('Inserisci nome e codice.', 'error');
        return;
      }
      if (btnSubmit) btnSubmit.disabled = true;
      showMsg('Salvataggio…');
      store.save({
        id: editId || undefined,
        name: name,
        code: code
      }).then(function () {
        showMsg(editId ? 'Codice aggiornato.' : 'Codice aggiunto.', 'ok');
        resetForm();
        return refresh();
      }).catch(function (err) {
        showMsg((err && err.message) || 'Salvataggio non riuscito.', 'error');
      }).then(function () {
        if (btnSubmit) btnSubmit.disabled = false;
      });
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', function () {
      resetForm();
      showMsg('');
    });
  }

  refresh();
})();
