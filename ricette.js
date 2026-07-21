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

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function bgImageStyle(url) {
    if (!url) return '';
    var safe = String(url)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[\r\n\u2028\u2029]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
    return (
      ' style="background-image:url(&quot;' +
      safe +
      '&quot;);background-size:cover;background-position:center;"'
    );
  }

  function getPublishedRecipes() {
    return getRecipes()
      .filter(function (recipe) {
        return recipe && String(recipe.title || '').trim();
      })
      .sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function getRecipeCategories(recipes) {
    var categories = [];
    recipes.forEach(function (recipe) {
      var cat = String(recipe.category || recipe.tag || '').trim();
      if (cat && categories.indexOf(cat) < 0) categories.push(cat);
    });
    return categories.sort(function (a, b) {
      return a.localeCompare(b, 'it');
    });
  }

  function applyListingSeo(recipes) {
    var seo = window.PriscillaSeo;
    if (!seo) return;
    seo.applyPageMeta({
      title: 'Ricette salutari | ' + seo.SITE_NAME,
      description:
        'Ricette salutari per atleti e sportivi: colazioni, snack, pre e post allenamento — ' +
        seo.SITE_NAME +
        ', Biologa Nutrizionista.',
      path: '/ricette.html',
      type: 'website',
    });
    seo.injectBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog.html' },
      { name: 'Ricette', path: '/ricette.html' },
    ]);
    if (recipes.length > 0 && typeof seo.injectItemListSchema === 'function') {
      seo.injectItemListSchema({
        name: 'Ricette salutari — ' + seo.SITE_NAME,
        description:
          'Collezione di ricette salutari per sportivi pubblicate nel blog di ' + seo.SITE_NAME + '.',
        path: '/ricette.html',
        items: recipes.map(function (recipe) {
          return {
            name: recipe.title,
            url: '/ricetta?id=' + encodeURIComponent(recipe.id),
            description: recipe.excerpt || recipe.category || '',
          };
        }),
      });
    }
  }

  var grid = document.getElementById('ricetteGrid');
  var emptyEl = document.getElementById('ricetteEmpty');
  var toolbar = document.getElementById('ricetteToolbar');
  var countEl = document.getElementById('ricetteCount');
  var filterSelect = document.getElementById('filtroCategoriaRicette');
  var allRecipes = getPublishedRecipes();

  applyListingSeo(allRecipes);

  function renderGrid(filterCategory) {
    if (!grid) return;
    var recipes = allRecipes.filter(function (recipe) {
      if (!filterCategory) return true;
      var cat = String(recipe.category || recipe.tag || '').trim();
      return cat === filterCategory;
    });

    if (countEl) {
      countEl.textContent =
        recipes.length === 1 ? '1 ricetta' : recipes.length + ' ricette';
    }

    if (recipes.length === 0) {
      grid.innerHTML = '';
      if (toolbar) toolbar.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.querySelector('p').textContent = filterCategory
          ? 'Nessuna ricetta in questa categoria.'
          : 'Non ci sono ancora ricette pubblicate.';
      }
      return;
    }

    if (toolbar) toolbar.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
    var html = '';
    recipes.forEach(function (recipe, i) {
      var imgStyle = recipe.imageUrl ? bgImageStyle(recipe.imageUrl) : '';
      var imgClass = 'blog-card-image blog-card-image--compact' + (imageClasses[i % 3] || '');
      var category = recipe.category || recipe.tag || 'Ricetta';
      var href = '/ricetta?id=' + encodeURIComponent(recipe.id);
      html +=
        '<a href="' +
        href +
        '" class="blog-card blog-card--recipe blog-card--link">' +
        '<div class="' +
        imgClass +
        '"' +
        imgStyle +
        '></div>' +
        '<div class="blog-card-content">' +
        '<span class="blog-meta">Ricetta · ' +
        escapeHtml(category) +
        '</span>' +
        '<h2 class="blog-card-title">' +
        escapeHtml(recipe.title) +
        '</h2>' +
        '<p>' +
        escapeHtml(recipe.excerpt || '') +
        '</p>' +
        '<span class="blog-link">Leggi la ricetta →</span>' +
        '</div></a>';
    });
    grid.innerHTML = html;
  }

  function resetFilters() {
    if (!filterSelect) return;
    while (filterSelect.options.length > 1) {
      filterSelect.remove(1);
    }
    getRecipeCategories(allRecipes).forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      filterSelect.appendChild(opt);
    });
  }

  function bindFilterEvents() {
    if (!filterSelect || filterSelect.dataset.bound) return;
    filterSelect.dataset.bound = '1';
    filterSelect.addEventListener('change', function () {
      renderGrid(filterSelect.value || '');
    });
  }

  function reloadRecipes() {
    allRecipes = getPublishedRecipes();
    applyListingSeo(allRecipes);
    resetFilters();
    renderGrid(filterSelect ? filterSelect.value || '' : '');
  }

  bindFilterEvents();
  resetFilters();
  renderGrid('');

  window.addEventListener('priscilla-recipes-changed', reloadRecipes);
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_RICETTE) reloadRecipes();
  });
})();
