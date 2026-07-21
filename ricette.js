(function () {
  'use strict';

  var STORAGE_KEY_RICETTE = 'ricette';
  var STORAGE_KEY_CATEGORIE_RICETTE = 'ricette_categorie';
  var STORAGE_KEY_TAG_RICETTE = 'ricette_tag';
  var RICETTE_CATEGORIE = [
    'Pre-workout',
    'Post-workout',
    'Snack',
    'Colazione',
    'Pranzo',
    'Cena',
    'Primi',
    'Secondi',
    'Dessert',
    'Bevande',
    'Altro',
  ];

  function getRecipes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_RICETTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function readJsonArray(key) {
    try {
      var raw = localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function uniqueSorted(values) {
    var out = [];
    values.forEach(function (value) {
      var name = String(value || '').trim();
      if (name && out.indexOf(name) < 0) out.push(name);
    });
    return out.sort(function (a, b) {
      return a.localeCompare(b, 'it');
    });
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

  function recipeCategory(recipe) {
    if (!recipe) return '';
    var cat = String(recipe.category || '').trim();
    if (cat) return cat;
    if (!Object.prototype.hasOwnProperty.call(recipe, 'category')) {
      return String(recipe.tag || '').trim();
    }
    return '';
  }

  function recipeTags(recipe) {
    if (!recipe) return [];
    if (Array.isArray(recipe.tags)) {
      return recipe.tags
        .map(function (t) {
          return String(t || '').trim();
        })
        .filter(Boolean);
    }
    var tag = String(recipe.tag || '').trim();
    if (!tag) return [];
    var cat = String(recipe.category || '').trim();
    if (cat && tag === cat) return [];
    if (!Object.prototype.hasOwnProperty.call(recipe, 'category')) return [];
    return [tag];
  }

  function recipeTag(recipe) {
    var tags = recipeTags(recipe);
    return tags.length ? tags[0] : '';
  }

  function recipeMetaHtml(recipe) {
    var cat = recipeCategory(recipe);
    var tags = recipeTags(recipe);
    var tagsHtml = tags
      .map(function (t) {
        return '<span class="blog-meta-tag">' + escapeHtml(t) + '</span>';
      })
      .join('');
    if (!cat && !tags.length) return '';
    return (
      '<div class="blog-meta blog-meta--split">' +
      (cat ? '<span class="blog-meta-category">' + escapeHtml(cat) + '</span>' : '<span class="blog-meta-category"></span>') +
      (tagsHtml ? '<span class="blog-meta-tags">' + tagsHtml + '</span>' : '') +
      '</div>'
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

  function getRecipeCategoryOptions(recipes) {
    var fromRecipes = recipes.map(recipeCategory).filter(Boolean);
    return uniqueSorted(
      RICETTE_CATEGORIE.concat(readJsonArray(STORAGE_KEY_CATEGORIE_RICETTE), fromRecipes)
    );
  }

  function getRecipeTagOptions(recipes) {
    var fromRecipes = [];
    recipes.forEach(function (recipe) {
      recipeTags(recipe).forEach(function (tag) {
        fromRecipes.push(tag);
      });
    });
    return uniqueSorted(readJsonArray(STORAGE_KEY_TAG_RICETTE).concat(fromRecipes));
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
  var tagFilterSelect = document.getElementById('filtroTagRicette');
  var allRecipes = getPublishedRecipes();

  applyListingSeo(allRecipes);

  function fillSelect(selectEl, placeholderHtml, values, current) {
    if (!selectEl) return;
    selectEl.innerHTML = placeholderHtml;
    values.forEach(function (value) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      selectEl.appendChild(opt);
    });
    if (current && values.indexOf(current) >= 0) {
      selectEl.value = current;
    } else {
      selectEl.value = '';
    }
  }

  function renderGrid(filterCategory, filterTag) {
    if (!grid) return;
    var recipes = allRecipes.filter(function (recipe) {
      if (filterCategory && recipeCategory(recipe) !== filterCategory) return false;
      if (filterTag && recipeTags(recipe).indexOf(filterTag) < 0) return false;
      return true;
    });

    if (countEl) {
      countEl.textContent =
        recipes.length === 1 ? '1 ricetta' : recipes.length + ' ricette';
    }

    if (recipes.length === 0) {
      grid.innerHTML = '';
      if (toolbar) toolbar.hidden = allRecipes.length === 0;
      if (emptyEl) {
        emptyEl.hidden = false;
        var msg = 'Non ci sono ancora ricette pubblicate.';
        if (filterTag) msg = 'Nessuna ricetta con questo tag.';
        else if (filterCategory) msg = 'Nessuna ricetta in questa categoria.';
        emptyEl.querySelector('p').textContent = msg;
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
        recipeMetaHtml(recipe) +
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
    fillSelect(
      filterSelect,
      '<option value="">Tutte le categorie</option>',
      getRecipeCategoryOptions(allRecipes),
      filterSelect ? filterSelect.value || '' : ''
    );
    fillSelect(
      tagFilterSelect,
      '<option value="">Tutti i tag</option>',
      getRecipeTagOptions(allRecipes),
      tagFilterSelect ? tagFilterSelect.value || '' : ''
    );
  }

  function paint() {
    renderGrid(
      filterSelect ? filterSelect.value || '' : '',
      tagFilterSelect ? tagFilterSelect.value || '' : ''
    );
  }

  function bindFilterEvents() {
    if (filterSelect && !filterSelect.dataset.bound) {
      filterSelect.dataset.bound = '1';
      filterSelect.addEventListener('change', paint);
    }
    if (tagFilterSelect && !tagFilterSelect.dataset.bound) {
      tagFilterSelect.dataset.bound = '1';
      tagFilterSelect.addEventListener('change', paint);
    }
  }

  function reloadRecipes() {
    allRecipes = getPublishedRecipes();
    applyListingSeo(allRecipes);
    resetFilters();
    paint();
  }

  bindFilterEvents();
  resetFilters();
  paint();

  window.addEventListener('priscilla-recipes-changed', reloadRecipes);
  window.addEventListener('storage', function (e) {
    if (
      e.key === STORAGE_KEY_RICETTE ||
      e.key === STORAGE_KEY_CATEGORIE_RICETTE ||
      e.key === STORAGE_KEY_TAG_RICETTE
    ) {
      reloadRecipes();
    }
  });
})();
