(function () {
  'use strict';

  var STORAGE_KEY_BLOG = 'blog_articoli';
  var STORAGE_KEY_RICETTE = 'ricette';

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
    return String((post && post.meta) || 'Articolo').trim() || 'Articolo';
  }

  /** Per le ricette «Ricetta» è la categoria di default (filtrabile). */
  function recipeCategory(recipe) {
    return String((recipe && (recipe.category || recipe.tag)) || 'Ricetta').trim() || 'Ricetta';
  }

  function itemCategory(item) {
    if (item.type === 'recipe') return recipeCategory(item.recipe);
    return postCategory(item.post);
  }

  function getCategories(items) {
    var categories = [];
    items.forEach(function (item) {
      var cat = itemCategory(item);
      if (cat && categories.indexOf(cat) < 0) categories.push(cat);
    });
    return categories.sort(function (a, b) {
      return a.localeCompare(b, 'it');
    });
  }

  function renderListing() {
    var listing = document.getElementById('blogListing');
    var articleMain = document.getElementById('articleMain');
    var grid = document.getElementById('blogGrid');
    var emptyEl = document.getElementById('blogEmpty');
    var toolbar = document.getElementById('blogToolbar');
    var countEl = document.getElementById('blogCount');
    var filterEl = document.getElementById('filtroCategoriaBlog');

    if (listing) listing.hidden = false;
    if (articleMain) {
      articleMain.hidden = true;
      articleMain.classList.remove('article-main--open');
    }

    var allItems = buildItems();
    applyListingSeo(allItems);

    if (filterEl) {
      var current = filterEl.value || '';
      filterEl.innerHTML = '<option value="">Tutte le categorie</option>';
      getCategories(allItems).forEach(function (cat) {
        var opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterEl.appendChild(opt);
      });
      if (current) filterEl.value = current;
    }

    function paint() {
      var filter = filterEl ? filterEl.value : '';
      var items = allItems.filter(function (item) {
        if (!filter) return true;
        return itemCategory(item) === filter;
      });

      if (toolbar) toolbar.hidden = allItems.length === 0;
      if (countEl) {
        countEl.textContent =
          items.length === 1 ? '1 contenuto' : items.length + ' contenuti';
      }

      if (!items.length) {
        if (grid) grid.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      var html = '';
      var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
      var showFeatured = !filter && items.length >= 3;
      items.forEach(function (item, i) {
        var imgClass = 'blog-card-image' + (imageClasses[i % 3] || '');
        var featuredClass = showFeatured && i === 0 ? ' blog-card--featured' : '';
        var revealDelay = ' style="--card-i:' + i + '"';
        if (item.type === 'post') {
          var post = item.post;
          var imgStyle = post.imageUrl ? bgImageStyle(post.imageUrl) : '';
          var postHref = '/blog?id=' + encodeURIComponent(post.id);
          var postCat = postCategory(post);
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
          var recipeCat = recipeCategory(recipe);
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
            '<span class="blog-meta">' +
            escapeHtml(recipeCat) +
            '</span>' +
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
      if (grid) grid.innerHTML = html;
    }

    if (filterEl && !filterEl._blogBound) {
      filterEl._blogBound = true;
      filterEl.addEventListener('change', paint);
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
        escapeHtml(post.meta || 'Articolo') +
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
    if (metaEl) metaEl.textContent = post.meta || 'Articolo';

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


  var id = getParam('id');
  if (id) {
    renderArticle(id);
  } else {
    renderListing();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_BLOG || e.key === STORAGE_KEY_RICETTE) {
      if (getParam('id')) renderArticle(getParam('id'));
      else renderListing();
    }
  });
})();
