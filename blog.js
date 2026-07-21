(function () {
  'use strict';

  var STORAGE_KEY_BLOG = 'blog_articoli';
  var STORAGE_KEY_RICETTE = 'ricette';
  var STORAGE_KEY_CATEGORIE_RICETTE = 'ricette_categorie';
  var STORAGE_KEY_CATEGORIE_NASCOSTE = 'ricette_categorie_nascoste';
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
  var ARTICOLI_CATEGORIE = [
    'Nutrizione',
    'Sport',
    'Alimentazione',
    'Salute',
    'Approfondimenti',
  ];

  function getBlogPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_BLOG);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

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

  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
  }

  function escapeHtml(text) {
    if (window.PriscillaContentFormat) {
      return window.PriscillaContentFormat.escapeHtml(text);
    }
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

  function textToHtml(text) {
    if (window.PriscillaContentFormat) {
      return window.PriscillaContentFormat.textToHtml(text);
    }
    if (!text) return '';
    return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
  }

  function normalizeBlocks(post) {
    if (window.PriscillaContentFormat) {
      return window.PriscillaContentFormat.normalizeBlocks(post);
    }
    if (post && Array.isArray(post.blocks) && post.blocks.length) {
      return post.blocks;
    }
    var body = (post && post.body) || '';
    if (!body) return [];
    return [{ type: 'text', content: body }];
  }

  function blocksToHtml(blocks) {
    if (window.PriscillaContentFormat) {
      return window.PriscillaContentFormat.blocksToHtml(blocks);
    }
    return '';
  }

  function plainTextFromPost(post) {
    if (!post) return '';
    if (Array.isArray(post.blocks) && post.blocks.length) {
      return post.blocks
        .filter(function (b) { return b && b.type === 'text' && (b.content || '').trim(); })
        .map(function (b) { return String(b.content).trim(); })
        .join(' ');
    }
    return post.body || '';
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  }

  function readingMinutes(postOrBody) {
    var text =
      typeof postOrBody === 'object' && postOrBody !== null
        ? plainTextFromPost(postOrBody)
        : String(postOrBody || '');
    var words = text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  function listingSkeletonHtml(count) {
    var n = count || 6;
    var html = '';
    var i;
    for (i = 0; i < n; i++) {
      var featured = i === 0 ? ' blog-card--featured' : '';
      html +=
        '<div class="blog-card blog-card--listing blog-card--skeleton' +
        featured +
        '" aria-hidden="true" style="--card-i:' +
        i +
        '">' +
        '<div class="blog-card-media">' +
        '<div class="content-skeleton content-skeleton--media"></div>' +
        '</div>' +
        '<div class="blog-card-content">' +
        '<span class="content-skeleton content-skeleton--chip"></span>' +
        '<span class="content-skeleton content-skeleton--title"></span>' +
        '<span class="content-skeleton content-skeleton--line"></span>' +
        '<span class="content-skeleton content-skeleton--line content-skeleton--line-short"></span>' +
        '</div></div>';
    }
    return html;
  }

  function showListingSkeleton() {
    var listing = document.getElementById('blogListing');
    var articleMain = document.getElementById('articleMain');
    var grid = document.getElementById('blogGrid');
    var emptyEl = document.getElementById('blogEmpty');
    var toolbar = document.getElementById('blogToolbar');

    if (listing) listing.hidden = false;
    if (articleMain) {
      articleMain.hidden = true;
      articleMain.classList.remove('article-main--open');
    }
    if (toolbar) toolbar.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    if (grid) {
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = listingSkeletonHtml(6);
    }
  }

  function clearListingBusy() {
    var grid = document.getElementById('blogGrid');
    if (grid) grid.removeAttribute('aria-busy');
  }

  function excerptFromBody(body, maxLen) {
    var plain = String(body || '').replace(/\s+/g, ' ').trim();
    if (!plain) return '';
    if (plain.length <= maxLen) return plain;
    return plain.slice(0, maxLen).trim() + '…';
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

  function getPublishedPosts() {
    return getBlogPosts()
      .filter(function (post) {
        return post && String(post.title || '').trim();
      })
      .sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function applyArticleSeo(post, id) {
    var seo = window.PriscillaSeo;
    if (!seo) return;
    var title = (post && post.title) || 'Articolo';
    var description =
      (post && post.excerpt && String(post.excerpt).trim()) ||
      excerptFromBody(plainTextFromPost(post), 160) ||
      seo.DEFAULT_DESCRIPTION;
    var path = '/blog?id=' + encodeURIComponent(id);
    seo.applyPageMeta({
      title: title + ' | ' + seo.SITE_NAME,
      description: description,
      path: path,
      type: 'article',
      image: (post && post.imageUrl) || undefined,
    });
    seo.injectArticleSchema({
      title: title,
      description: description,
      path: path,
      schemaType: 'BlogPosting',
      breadcrumbLabel: title,
    });
  }

  function applyListingSeo(items) {
    var seo = window.PriscillaSeo;
    if (!seo) return;
    seo.applyPageMeta({
      title: 'Blog — ricette e approfondimenti | ' + seo.SITE_NAME,
      description:
        'Ricette salutari e approfondimenti di nutrizione sportiva — ' +
        seo.SITE_NAME +
        ', Biologa Nutrizionista.',
      path: '/blog.html',
      type: 'website',
    });
    seo.injectBreadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Blog', path: '/blog.html' },
    ]);
    if (items.length > 0 && typeof seo.injectItemListSchema === 'function') {
      seo.injectItemListSchema({
        name: 'Blog — ' + seo.SITE_NAME,
        description:
          'Ricette e articoli di nutrizione sportiva pubblicati nel blog di ' + seo.SITE_NAME + '.',
        path: '/blog.html',
        items: items.map(function (item) {
          if (item.type === 'recipe') {
            return {
              name: item.recipe.title,
              url: '/ricetta?id=' + encodeURIComponent(item.recipe.id),
              description: item.recipe.excerpt || item.recipe.category || '',
            };
          }
          return {
            name: item.post.title,
            url: '/blog?id=' + encodeURIComponent(item.post.id),
            description: item.post.excerpt || item.post.meta || '',
          };
        }),
      });
    }
  }

  function buildItems() {
    var items = [];
    getPublishedPosts().forEach(function (post) {
      items.push({ type: 'post', sortDate: post.createdAt || 0, post: post });
    });
    getPublishedRecipes().forEach(function (recipe) {
      items.push({ type: 'recipe', sortDate: recipe.createdAt || 0, recipe: recipe });
    });
    items.sort(function (a, b) {
      return b.sortDate - a.sortDate;
    });
    return items;
  }

  function postCategory(post) {
    var raw = String((post && post.meta) || '').trim();
    if (!raw) return '';
    // Meta admin: "Categoria · 5 min" → usa solo la categoria
    var cat = raw.split(/\s*[·|]\s*/)[0].trim();
    return cat || raw;
  }

  function postMetaLabel(post) {
    return postCategory(post) || 'Articolo';
  }

  /** Categoria ricetta (non usa il tag; gestisce il vecchio mirror tag === categoria). */
  function recipeCategory(recipe) {
    if (!recipe) return '';
    var cat = String(recipe.category || '').trim();
    if (cat) return cat;
    if (!Object.prototype.hasOwnProperty.call(recipe, 'category')) {
      return String(recipe.tag || '').trim();
    }
    return '';
  }

  /** Tag dedicati; ignora il vecchio mirror tag === categoria. Supporta tags[] e tag singolo. */
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

  function metaTagHtml(name, className) {
    var fmt = window.PriscillaContentFormat;
    if (fmt && typeof fmt.metaTagHtml === 'function') {
      return fmt.metaTagHtml(name, className);
    }
    var label = String(name || '')
      .trim()
      .toLowerCase();
    if (!label) return '';
    return '<span class="' + (className || 'blog-meta-tag') + '">' + escapeHtml(label) + '</span>';
  }

  function recipeMetaHtml(recipe) {
    var cat = recipeCategory(recipe);
    var tags = recipeTags(recipe);
    var tagsHtml = tags
      .map(function (t) {
        return metaTagHtml(t, 'blog-meta-tag');
      })
      .join('');
    /* Badge «Ricetta» resta sull'immagine; sopra il titolo solo categoria (sx) + tag (dx). */
    if (!cat && !tags.length) return '';
    return (
      '<div class="blog-meta blog-meta--split">' +
      (cat ? metaTagHtml(cat, 'blog-meta-category') : '<span class="blog-meta-category"></span>') +
      (tagsHtml ? '<span class="blog-meta-tags">' + tagsHtml + '</span>' : '') +
      '</div>'
    );
  }

  function itemCategory(item) {
    if (item.type === 'recipe') return recipeCategory(item.recipe);
    return postCategory(item.post);
  }

  function getPostCategoriesFromItems(items) {
    var fromPosts = [];
    items.forEach(function (item) {
      if (item.type !== 'post') return;
      var cat = postCategory(item.post);
      if (cat) fromPosts.push(cat);
    });
    return uniqueSorted(ARTICOLI_CATEGORIE.concat(fromPosts));
  }

  function getRecipeCategoryOptions(items) {
    var hidden = readJsonArray(STORAGE_KEY_CATEGORIE_NASCOSTE);
    var fromRecipes = [];
    items.forEach(function (item) {
      if (item.type !== 'recipe') return;
      var cat = recipeCategory(item.recipe);
      if (cat) fromRecipes.push(cat);
    });
    return uniqueSorted(
      RICETTE_CATEGORIE.concat(readJsonArray(STORAGE_KEY_CATEGORIE_RICETTE), fromRecipes)
    ).filter(function (name) {
      return hidden.indexOf(name) < 0;
    });
  }

  function getRecipeTagOptions(items) {
    var fromRecipes = [];
    items.forEach(function (item) {
      if (item.type !== 'recipe') return;
      recipeTags(item.recipe).forEach(function (tag) {
        fromRecipes.push(tag);
      });
    });
    return uniqueSorted(readJsonArray(STORAGE_KEY_TAG_RICETTE).concat(fromRecipes));
  }

  function countLabel(count, typeFilter) {
    if (typeFilter === 'recipe') {
      return count === 1 ? '1 ricetta' : count + ' ricette';
    }
    if (typeFilter === 'post') {
      return count === 1 ? '1 articolo' : count + ' articoli';
    }
    return count === 1 ? '1 contenuto' : count + ' contenuti';
  }

  function emptyMessage(typeFilter, categoryFilter, tagFilter) {
    if (tagFilter) return 'Nessuna ricetta con questo tag.';
    if (categoryFilter) {
      if (typeFilter === 'recipe') return 'Nessuna ricetta in questa categoria.';
      if (typeFilter === 'post') return 'Nessun articolo in questa categoria.';
      return 'Nessun contenuto in questa categoria.';
    }
    if (typeFilter === 'recipe') return 'Non ci sono ancora ricette pubblicate.';
    if (typeFilter === 'post') return 'Non ci sono ancora articoli pubblicati.';
    return 'Non ci sono ancora contenuti pubblicati.';
  }

  function renderListing() {
    var listing = document.getElementById('blogListing');
    var articleMain = document.getElementById('articleMain');
    var grid = document.getElementById('blogGrid');
    var emptyEl = document.getElementById('blogEmpty');
    var emptyTextEl = document.getElementById('blogEmptyText');
    var toolbar = document.getElementById('blogToolbar');
    var countEl = document.getElementById('blogCount');
    var typeFilterEl = document.getElementById('filtroTipoBlog');
    var categoryFilterWrap = document.getElementById('blogCategoryFilterWrap');
    var categoryFilterLabel = document.getElementById('blogCategoryFilterLabel');
    var filterEl = document.getElementById('filtroCategoriaBlog');
    var tagFilterWrap = document.getElementById('blogTagFilterWrap');
    var tagFilterEl = document.getElementById('filtroTagBlog');

    if (listing) listing.hidden = false;
    if (articleMain) {
      articleMain.hidden = true;
      articleMain.classList.remove('article-main--open');
    }

    var allItems = buildItems();
    applyListingSeo(allItems);

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

    function syncFilters(typeFilter) {
      if (!typeFilter) {
        if (categoryFilterWrap) categoryFilterWrap.hidden = true;
        if (tagFilterWrap) tagFilterWrap.hidden = true;
        if (filterEl) filterEl.value = '';
        if (tagFilterEl) tagFilterEl.value = '';
        return;
      }

      if (categoryFilterWrap) categoryFilterWrap.hidden = false;
      if (categoryFilterLabel) {
        categoryFilterLabel.textContent =
          typeFilter === 'recipe' ? 'Categoria ricetta' : 'Categoria articolo';
      }

      var categories =
        typeFilter === 'recipe'
          ? getRecipeCategoryOptions(allItems)
          : getPostCategoriesFromItems(allItems);
      fillSelect(
        filterEl,
        '<option value="">Tutte le categorie</option>',
        categories,
        filterEl ? filterEl.value || '' : ''
      );

      if (typeFilter === 'recipe') {
        if (tagFilterWrap) tagFilterWrap.hidden = false;
        fillSelect(
          tagFilterEl,
          '<option value="">Tutti i tag</option>',
          getRecipeTagOptions(allItems),
          tagFilterEl ? tagFilterEl.value || '' : ''
        );
      } else {
        if (tagFilterWrap) tagFilterWrap.hidden = true;
        if (tagFilterEl) tagFilterEl.value = '';
      }
    }

    function paint() {
      var typeFilter = typeFilterEl ? typeFilterEl.value : '';
      syncFilters(typeFilter);

      var categoryFilter = filterEl ? filterEl.value : '';
      var tagFilter = tagFilterEl && typeFilter === 'recipe' ? tagFilterEl.value : '';
      var items = allItems.filter(function (item) {
        if (typeFilter && item.type !== typeFilter) return false;
        if (categoryFilter && itemCategory(item) !== categoryFilter) return false;
        if (tagFilter) {
          if (item.type !== 'recipe') return false;
          if (recipeTags(item.recipe).indexOf(tagFilter) < 0) return false;
        }
        return true;
      });

      if (toolbar) toolbar.hidden = allItems.length === 0;
      if (countEl) {
        countEl.textContent = countLabel(items.length, typeFilter);
      }

      if (!items.length) {
        if (grid) {
          grid.innerHTML = '';
          clearListingBusy();
        }
        if (emptyEl) emptyEl.hidden = false;
        if (emptyTextEl) {
          emptyTextEl.textContent = emptyMessage(typeFilter, categoryFilter, tagFilter);
        }
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      var html = '';
      var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
      var showFeatured = !typeFilter && !categoryFilter && !tagFilter && items.length >= 3;
      items.forEach(function (item, i) {
        var imgClass = 'blog-card-image' + (imageClasses[i % 3] || '');
        var featuredClass = showFeatured && i === 0 ? ' blog-card--featured' : '';
        var revealDelay = ' style="--card-i:' + i + '"';
        if (item.type === 'post') {
          var post = item.post;
          var imgStyle = post.imageUrl ? bgImageStyle(post.imageUrl) : '';
          var postHref = '/blog?id=' + encodeURIComponent(post.id);
          var postCat = postMetaLabel(post);
          var postDate = formatDate(post.createdAt);
          var postRead = readingMinutes(post);
          html +=
            '<a href="' +
            postHref +
            '" class="blog-card blog-card--link blog-card--listing' +
            featuredClass +
            '"' +
            revealDelay +
            '>' +
            '<div class="blog-card-media">' +
            '<div class="' +
            imgClass +
            '"' +
            imgStyle +
            '></div>' +
            '<span class="blog-card-badge">Articolo</span>' +
            '</div>' +
            '<div class="blog-card-content">' +
            '<span class="blog-meta">' +
            escapeHtml(postCat) +
            '</span>' +
            '<h2>' +
            escapeHtml(post.title) +
            '</h2>' +
            '<p>' +
            escapeHtml(post.excerpt || '') +
            '</p>' +
            '<div class="blog-card-footer">' +
            (postDate
              ? '<span class="blog-card-date">' + escapeHtml(postDate) + '</span>'
              : '') +
            '<span class="blog-card-read">' +
            postRead +
            ' min</span>' +
            '<span class="blog-link">Leggi l\'articolo <span aria-hidden="true">→</span></span>' +
            '</div>' +
            '</div></a>';
        } else {
          var recipe = item.recipe;
          var recipeImgStyle = recipe.imageUrl ? bgImageStyle(recipe.imageUrl) : '';
          var recipeHref = '/ricetta?id=' + encodeURIComponent(recipe.id);
          var recipeDate = formatDate(recipe.createdAt);
          html +=
            '<a href="' +
            recipeHref +
            '" class="blog-card blog-card--recipe blog-card--link blog-card--listing' +
            featuredClass +
            '"' +
            revealDelay +
            '>' +
            '<div class="blog-card-media">' +
            '<div class="' +
            imgClass +
            '"' +
            recipeImgStyle +
            '></div>' +
            '<span class="blog-card-badge">Ricetta</span>' +
            '</div>' +
            '<div class="blog-card-content">' +
            recipeMetaHtml(recipe) +
            '<h2>' +
            escapeHtml(recipe.title) +
            '</h2>' +
            '<p>' +
            escapeHtml(recipe.excerpt || '') +
            '</p>' +
            '<div class="blog-card-footer">' +
            (recipeDate
              ? '<span class="blog-card-date">' + escapeHtml(recipeDate) + '</span>'
              : '') +
            '<span class="blog-link">Leggi la ricetta <span aria-hidden="true">→</span></span>' +
            '</div>' +
            '</div></a>';
        }
      });
      if (grid) {
        grid.innerHTML = html;
        clearListingBusy();
      }
    }

    if (typeFilterEl && !typeFilterEl._blogBound) {
      typeFilterEl._blogBound = true;
      typeFilterEl.addEventListener('change', paint);
    }
    if (filterEl && !filterEl._blogBound) {
      filterEl._blogBound = true;
      filterEl.addEventListener('change', paint);
    }
    if (tagFilterEl && !tagFilterEl._blogBound) {
      tagFilterEl._blogBound = true;
      tagFilterEl.addEventListener('change', paint);
    }
    paint();
  }

  function renderRelated(currentId) {
    var relatedSection = document.getElementById('articleRelated');
    var relatedGrid = document.getElementById('articleRelatedGrid');
    if (!relatedSection || !relatedGrid) return;

    var others = getPublishedPosts()
      .filter(function (post) {
        return post.id !== currentId;
      })
      .slice(0, 3);

    if (!others.length) {
      setHidden(relatedSection, true);
      relatedGrid.innerHTML = '';
      return;
    }

    var html = '';
    var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
    others.forEach(function (post, i) {
      var hasImage = !!post.imageUrl;
      var imgClass = 'blog-card-image' + (imageClasses[i % 3] || '');
      var imgStyle = hasImage ? bgImageStyle(post.imageUrl) : '';
      html +=
        '<a class="article-related-card' +
        (hasImage ? '' : ' article-related-card--text') +
        '" href="/blog?id=' +
        encodeURIComponent(post.id) +
        '">' +
        (hasImage
          ? '<div class="' + imgClass + '"' + imgStyle + '></div>'
          : '') +
        '<div class="article-related-card-body">' +
        '<span class="blog-meta">' +
        escapeHtml(postMetaLabel(post)) +
        '</span>' +
        '<h3>' +
        escapeHtml(post.title) +
        '</h3>' +
        '<span class="article-related-link">Leggi →</span>' +
        '</div></a>';
    });
    relatedGrid.innerHTML = html;
    setHidden(relatedSection, false);
  }

  function renderArticle(id) {
    var listing = document.getElementById('blogListing');
    var articleMain = document.getElementById('articleMain');
    var wrap = document.getElementById('articleWrap');
    var errorEl = document.getElementById('articleError');
    var titleEl = document.getElementById('articleTitle');
    var metaEl = document.getElementById('articleMeta');
    var dateEl = document.getElementById('articleDate');
    var readEl = document.getElementById('articleRead');
    var excerptEl = document.getElementById('articleExcerpt');
    var bodyEl = document.getElementById('articleBody');
    var coverEl = document.getElementById('articleCover');
    var coverImg = document.getElementById('articleCoverImg');

    if (listing) listing.hidden = true;
    if (articleMain) articleMain.hidden = false;
    if (articleMain) articleMain.classList.add('article-main--open');

    var posts = getBlogPosts();
    var post = posts.find(function (p) {
      return p.id === id;
    });
    if (!post) {
      if (wrap) wrap.hidden = true;
      if (errorEl) errorEl.hidden = false;
      return;
    }
    if (errorEl) errorEl.hidden = true;
    if (wrap) wrap.hidden = false;
    applyArticleSeo(post, id);

    if (titleEl) titleEl.textContent = post.title || '';
    if (metaEl) metaEl.textContent = postMetaLabel(post);

    var dateLabel = formatDate(post.createdAt);
    if (dateEl) {
      if (dateLabel && post.createdAt) {
        dateEl.textContent = dateLabel;
        dateEl.setAttribute('datetime', new Date(post.createdAt).toISOString());
        setHidden(dateEl, false);
      } else {
        dateEl.textContent = '';
        dateEl.removeAttribute('datetime');
        setHidden(dateEl, true);
      }
    }

    if (readEl) {
      var mins = readingMinutes(post);
      readEl.textContent = mins + (mins === 1 ? ' min' : ' min');
    }

    var excerpt = String(post.excerpt || '').trim();
    if (excerptEl) {
      if (excerpt) {
        excerptEl.textContent = excerpt;
        setHidden(excerptEl, false);
      } else {
        excerptEl.textContent = '';
        setHidden(excerptEl, true);
      }
    }

    if (coverEl && coverImg) {
      if (post.imageUrl) {
        coverImg.src = post.imageUrl;
        coverImg.alt = post.title ? 'Copertina: ' + post.title : '';
        coverEl.classList.add('is-visible');
        setHidden(coverEl, false);
      } else {
        coverImg.removeAttribute('src');
        coverImg.alt = '';
        coverEl.classList.remove('is-visible');
        setHidden(coverEl, true);
      }
    }

    if (bodyEl) {
      var blocksHtml = blocksToHtml(normalizeBlocks(post));
      bodyEl.innerHTML = blocksHtml || textToHtml(post.body || '');
    }
    renderRelated(id);

    document.body.classList.add('page-loaded');
    requestAnimationFrame(function () {
      window.dispatchEvent(new Event('resize'));
      setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, 80);
    });
  }


  function bootBlog() {
    var id = getParam('id');
    if (id) {
      renderArticle(id);
    } else {
      renderListing();
    }
  }

  function loadAndBoot() {
    var id = getParam('id');
    if (!id) showListingSkeleton();

    var store = window.PriscillaContent;
    if (store && typeof store.load === 'function') {
      store.load().then(bootBlog).catch(bootBlog);
    } else {
      bootBlog();
    }
  }

  loadAndBoot();

  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_BLOG || e.key === STORAGE_KEY_RICETTE) {
      bootBlog();
    }
  });
  window.addEventListener('priscilla-content-changed', bootBlog);
})();
