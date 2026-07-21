(function () {
  'use strict';

  var store = window.PriscillaSpesa || null;
  var form = document.getElementById('formSuggerimentoSpesa');
  var cityInput = document.getElementById('spesaCity');
  var storeInput = document.getElementById('spesaStore');
  var descInput = document.getElementById('spesaDescription');
  var editIdInput = document.getElementById('spesaEditId');
  var cityList = document.getElementById('spesaCityList');
  var msg = document.getElementById('msgSpesa');
  var lista = document.getElementById('listaSpesaAdmin');
  var btnSubmit = document.getElementById('btnSalvaSpesa');
  var btnCancel = document.getElementById('btnAnnullaModificaSpesa');
  var storageHint = document.getElementById('spesaStorageHint');
  var cachedItems = [];

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
    if (btnSubmit) btnSubmit.textContent = 'Aggiungi suggerimento';
    if (btnCancel) btnCancel.hidden = true;
  }

  function setEditing(item) {
    if (!item) {
      resetForm();
      return;
    }
    if (editIdInput) editIdInput.value = item.id || '';
    if (cityInput) cityInput.value = item.city || '';
    if (storeInput) storeInput.value = item.storeName || '';
    if (descInput) descInput.value = item.description || '';
    if (btnSubmit) btnSubmit.textContent = 'Salva modifiche';
    if (btnCancel) btnCancel.hidden = false;
    if (cityInput) cityInput.focus();
  }

  function updateCityOptions(items) {
    if (!cityList) return;
    var cities = [];
    var seen = {};
    (items || []).forEach(function (item) {
      var city = String(item && item.city || '').trim();
      if (!city) return;
      var key = city.toLocaleLowerCase('it');
      if (seen[key]) return;
      seen[key] = true;
      cities.push(city);
    });
    cities.sort(function (a, b) {
      return a.localeCompare(b, 'it', { sensitivity: 'base' });
    });
    cityList.innerHTML = cities.map(function (city) {
      return '<option value="' + escapeHtml(city) + '"></option>';
    }).join('');
  }

  function renderList(items) {
    if (!lista) return;
    lista.innerHTML = '';
    cachedItems = Array.isArray(items) ? items : [];

    if (!cachedItems.length) {
      lista.innerHTML = '<p class="empty">Nessun suggerimento spesa. Aggiungine uno qui sopra.</p>';
      return;
    }

    var ul = document.createElement('ul');
    ul.className = 'lista-pdf-admin';

    cachedItems.forEach(function (item) {
      var li = document.createElement('li');
      li.innerHTML =
        '<div class="pdf-meta">' +
          '<span class="pdf-title">' + escapeHtml(item.storeName || 'Negozio') + '</span>' +
          '<span class="pdf-description"><strong>' + escapeHtml(item.city || '') + '</strong> — ' +
            escapeHtml(item.description || '') + '</span>' +
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
        var found = cachedItems.find(function (it) { return it && it.id === id; });
        if (found) setEditing(found);
      });
    });

    lista.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-remove');
        if (!id || !store) return;
        if (!window.confirm('Eliminare questo suggerimento spesa?')) return;
        btn.disabled = true;
        store.remove(id).then(function () {
          showMsg('Suggerimento eliminato.', 'ok');
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
      updateCityOptions([]);
      return Promise.resolve();
    }
    if (lista) lista.innerHTML = '<p class="empty">Caricamento…</p>';
    return store.list().then(function (result) {
      var items = result && result.items ? result.items : [];
      if (storageHint) {
        if (result && result.source === 'local') {
          storageHint.hidden = false;
          storageHint.textContent = 'Salvataggio locale: i suggerimenti restano su questo browser finché Vercel Blob non è collegato.';
        } else {
          storageHint.hidden = true;
        }
      }
      updateCityOptions(items);
      renderList(items);
    }).catch(function () {
      renderList([]);
      updateCityOptions([]);
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!store) {
        showMsg('Store non disponibile.', 'error');
        return;
      }
      var city = (cityInput && cityInput.value || '').trim();
      var storeName = (storeInput && storeInput.value || '').trim();
      var description = (descInput && descInput.value || '').trim();
      var editId = (editIdInput && editIdInput.value || '').trim();
      if (!city || !storeName || !description) {
        showMsg('Inserisci città, negozio e descrizione.', 'error');
        return;
      }
      if (btnSubmit) btnSubmit.disabled = true;
      showMsg('Salvataggio…');
      store.save({
        id: editId || undefined,
        city: city,
        storeName: storeName,
        description: description
      }).then(function () {
        showMsg(editId ? 'Suggerimento aggiornato.' : 'Suggerimento aggiunto.', 'ok');
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
