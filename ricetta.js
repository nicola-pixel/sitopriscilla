(function () {
  'use strict';

  var STORAGE_KEY_RICETTE = 'ricette';
  var fmt = window.PriscillaContentFormat;

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
    return fmt ? fmt.escapeHtml(text) : String(text || '');
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
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

  function formatDate(ts) {
    if (!ts) return '';
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  }

  function toIsoDate(ts) {
    try {
      var d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toISOString();
    } catch (e) {
      return '';
    }
  }

  function revealPage() {
    document.body.classList.add('page-loaded');
  }

  /** Garantisce che titolo/corpo siano leggibili anche con CSS in cache vecchio. */
  function forceContentVisible() {
    var style = document.getElementById('ricetta-visibility-fix');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ricetta-visibility-fix';
      style.textContent =
        '.article-header,.article-title,.article-excerpt,.article-category,.article-tag,.article-meta-chips,.article-body.prose,.article-cover{' +
        'opacity:1!important;transform:none!important;animation:none!important;visibility:visible!important}' +
        '.article-title,.article-body.prose{color:#111!important}';
      document.head.appendChild(style);
    }
  }

  function plainTextFromRecipe(recipe) {
    if (!recipe) return '';
    if (Array.isArray(recipe.blocks) && recipe.blocks.length) {
      return recipe.blocks
        .map(function (b) {
          if (!b) return '';
          if (b.type === 'text') return String(b.content || '').trim();
          if (b.type === 'ingredients' || b.type === 'steps') {
            return (Array.isArray(b.items) ? b.items : [])
              .map(function (item) {
                return String(item || '').trim();
              })
              .filter(Boolean)
              .join(' ');
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');
    }
    return recipe.body || '';
  }

  function readingMinutes(recipe) {
    var text = plainTextFromRecipe(recipe);
    var words = text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }

  function applySeo(recipe, id) {
    var seo = window.PriscillaSeo;
    if (!seo) return;
    var title = (recipe && recipe.title) || 'Ricetta';
    var description =
      (recipe && recipe.excerpt && String(recipe.excerpt).trim()) ||
      'Ricetta salutare di ' + seo.SITE_NAME + ', Biologa Nutrizionista sportiva.';
    var path = '/ricetta?id=' + encodeURIComponent(id);
    seo.applyPageMeta({
      title: title + ' | ' + seo.SITE_NAME,
      description: description,
      path: path,
      type: 'article',
      image: (recipe && recipe.imageUrl) || undefined,
    });
    seo.injectRecipeSchema({
      title: title,
      description: description,
      path: path,
      category: recipeCategory(recipe) || '',
    });
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
    if (!Object.prototype.hasOwnProperty.call(recipe, 'category')) return [];
    var cat = String(recipe.category || '').trim();
    if (cat && tag === cat) return [];
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

  function renderRelated(currentId) {
    var relatedSection = document.getElementById('ricettaRelated');
    var relatedGrid = document.getElementById('ricettaRelatedGrid');
    if (!relatedSection || !relatedGrid) return;

    var others = getPublishedRecipes()
      .filter(function (recipe) {
        return recipe.id !== currentId;
      })
      .slice(0, 3);

    if (!others.length) {
      setHidden(relatedSection, true);
      relatedGrid.innerHTML = '';
      return;
    }

    var html = '';
    var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
    others.forEach(function (recipe, i) {
      var hasImage = !!recipe.imageUrl;
      var imgClass = 'blog-card-image' + (imageClasses[i % 3] || '');
      var imgStyle = hasImage ? bgImageStyle(recipe.imageUrl) : '';
      html +=
        '<a class="article-related-card' +
        (hasImage ? '' : ' article-related-card--text') +
        '" href="/ricetta?id=' +
        encodeURIComponent(recipe.id) +
        '">' +
        (hasImage ? '<div class="' + imgClass + '"' + imgStyle + '></div>' : '') +
        '<div class="article-related-card-body">' +
        recipeMetaHtml(recipe) +
        '<h3>' +
        escapeHtml(recipe.title) +
        '</h3>' +
        '<span class="article-related-link">Apri ricetta →</span>' +
        '</div></a>';
    });
    relatedGrid.innerHTML = html;
    setHidden(relatedSection, false);
  }

  function renderRecipe(id) {
    var wrap = document.getElementById('ricettaWrap');
    var errorEl = document.getElementById('ricettaError');
    var titleEl = document.getElementById('ricettaTitle');
    var excerptEl = document.getElementById('ricettaExcerpt');
    var bodyEl = document.getElementById('ricettaBody');
    var coverEl = document.getElementById('ricettaCover');
    var coverImg = document.getElementById('ricettaCoverImg');
    var dateEl = document.getElementById('ricettaDate');
    var readEl = document.getElementById('ricettaRead');

    try {
      if (!id) {
        if (wrap) wrap.hidden = true;
        if (errorEl) {
          errorEl.hidden = false;
          var msg = errorEl.querySelector('p');
          if (msg) msg.textContent = 'Nessuna ricetta selezionata.';
        }
        return;
      }

      var recipes = getRecipes();
      var recipe = recipes.find(function (r) {
        return r.id === id;
      });

      if (!recipe) {
        if (wrap) wrap.hidden = true;
        if (errorEl) errorEl.hidden = false;
        return;
      }

      if (errorEl) errorEl.hidden = true;
      if (wrap) wrap.hidden = false;
      applySeo(recipe, id);

      if (titleEl) titleEl.textContent = recipe.title || '';
      var categoryEl = document.getElementById('ricettaCategory');
      var chipsEl = document.getElementById('ricettaMetaChips');
      var cat = recipeCategory(recipe);
      var tags = recipeTags(recipe);
      if (categoryEl) {
        categoryEl.textContent = cat;
        setHidden(categoryEl, !cat);
      }
      if (chipsEl) {
        chipsEl.querySelectorAll('.article-tag').forEach(function (el) {
          el.parentNode.removeChild(el);
        });
        tags.forEach(function (tag) {
          var span = document.createElement('span');
          span.className = 'article-tag';
          span.textContent = tag;
          chipsEl.appendChild(span);
        });
        setHidden(chipsEl, !cat && !tags.length);
      }

      var excerpt = String(recipe.excerpt || '').trim();
      if (excerptEl) {
        if (excerpt) {
          excerptEl.textContent = excerpt;
          setHidden(excerptEl, false);
        } else {
          excerptEl.textContent = '';
          setHidden(excerptEl, true);
        }
      }

      var dateLabel = formatDate(recipe.createdAt);
      var dateIso = dateLabel ? toIsoDate(recipe.createdAt) : '';
      if (dateEl) {
        if (dateLabel && dateIso) {
          dateEl.textContent = dateLabel;
          dateEl.setAttribute('datetime', dateIso);
          setHidden(dateEl, false);
        } else {
          dateEl.textContent = '';
          dateEl.removeAttribute('datetime');
          setHidden(dateEl, true);
        }
      }

      if (readEl) {
        var mins = readingMinutes(recipe);
        readEl.textContent = mins + ' min';
      }

      if (coverEl && coverImg) {
        if (recipe.imageUrl) {
          coverImg.src = recipe.imageUrl;
          coverImg.alt = recipe.title ? 'Copertina: ' + recipe.title : '';
          coverEl.classList.add('is-visible');
          setHidden(coverEl, false);
        } else {
          coverImg.removeAttribute('src');
          coverImg.alt = '';
          coverEl.classList.remove('is-visible');
          setHidden(coverEl, true);
        }
      }

      if (bodyEl && fmt) {
        bodyEl.innerHTML = fmt.renderBodyHtml(recipe);
      } else if (bodyEl) {
        bodyEl.textContent = plainTextFromRecipe(recipe);
      }

      renderRelated(id);
    } catch (err) {
      console.error('Errore rendering ricetta', err);
      if (wrap) wrap.hidden = true;
      if (errorEl) {
        errorEl.hidden = false;
        var errMsg = errorEl.querySelector('p');
        if (errMsg) errMsg.textContent = 'Impossibile caricare la ricetta.';
      }
    } finally {
      forceContentVisible();
      revealPage();
    }
  }

  forceContentVisible();

  function bootRicetta() {
    renderRecipe(getParam('id'));
  }

  function loadAndBoot() {
    var store = window.PriscillaContent;
    if (store && typeof store.load === 'function') {
      store.load().then(bootRicetta).catch(bootRicetta);
    } else {
      bootRicetta();
    }
  }

  loadAndBoot();
  // Failsafe: se qualcosa blocca il render, mostra comunque header/contenuti
  setTimeout(revealPage, 1200);

  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_RICETTE) {
      bootRicetta();
    }
  });
  window.addEventListener('priscilla-content-changed', bootRicetta);
})();
