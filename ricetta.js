(function () {
  'use strict';

  var STORAGE_KEY_RICETTE = 'ricette';

  function getRecipes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_RICETTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
  }

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function textToHtml(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  var id = getParam('id');
  var wrap = document.getElementById('ricettaWrap');
  var errorEl = document.getElementById('ricettaError');
  var titleEl = document.getElementById('ricettaTitle');
  var tagEl = document.getElementById('ricettaTag');
  var excerptEl = document.getElementById('ricettaExcerpt');
  var bodyEl = document.getElementById('ricettaBody');

  if (!id) {
    if (wrap) wrap.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.querySelector('p').textContent = 'Nessuna ricetta selezionata.';
    }
  } else {
    var recipes = getRecipes();
    var recipe = recipes.find(function (r) { return r.id === id; });
    if (!recipe) {
      if (wrap) wrap.hidden = true;
      if (errorEl) errorEl.hidden = false;
    } else {
      if (errorEl) errorEl.hidden = true;
      if (wrap) wrap.hidden = false;
      document.title = (recipe.title || 'Ricetta') + ' | Pristilla Castellani';
      if (titleEl) titleEl.textContent = recipe.title || '';
      if (tagEl) tagEl.textContent = recipe.category || recipe.tag || '';
      if (excerptEl) {
        excerptEl.textContent = recipe.excerpt || '';
        excerptEl.style.display = recipe.excerpt ? '' : 'none';
      }
      if (bodyEl) bodyEl.innerHTML = textToHtml(recipe.body || '');
    }
  }
})();
