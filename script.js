(function () {
  'use strict';

  document.body.classList.add('page-loaded');
  requestAnimationFrame(function () {
    document.body.classList.add('page-loaded');
  });

  var STORAGE_KEY_BLOG = 'blog_articoli';
  var STORAGE_KEY_RICETTE = 'ricette';
  var revealSelector = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger';
  var revealObserver = null;

  function revealIfInView(el) {
    if (!el || el.classList.contains('is-visible') || el.closest('.hero')) return false;
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (rect.height <= 0 && rect.width <= 0) return false;
    if (rect.bottom > 0 && rect.top < vh + 80) {
      el.classList.add('is-visible');
      if (revealObserver) {
        try { revealObserver.unobserve(el); } catch (e) {}
      }
      return true;
    }
    return false;
  }

  function revealElementsInView() {
    document.querySelectorAll(revealSelector).forEach(revealIfInView);
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

  function getPublishedBlogPosts() {
    return getBlogPosts().filter(function (post) {
      return post && String(post.title || '').trim();
    });
  }

  function getPublishedRecipes() {
    return getRecipes().filter(function (recipe) {
      return recipe && String(recipe.title || '').trim();
    });
  }

  /** Voce Blog sempre visibile in navbar/footer (non dipende dai contenuti). */
  function setBlogNavVisible() {
    document.querySelectorAll('a[href="#blog"], a[href$="#blog"], a[href="blog.html"], a[href="/blog"]').forEach(function (link) {
      var li = link.closest('li');
      if (li) li.hidden = false;
    });
  }

  function setBlogSectionVisible(visible) {
    var section = document.getElementById('blog');
    if (!section) return;
    section.hidden = !visible;
    section.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function getHomepageBlogItems() {
    var items = [];
    getPublishedBlogPosts().forEach(function (post) {
      items.push({
        type: 'post',
        createdAt: post.createdAt || 0,
        post: post
      });
    });
    getPublishedRecipes().forEach(function (recipe) {
      items.push({
        type: 'recipe',
        createdAt: recipe.createdAt || 0,
        recipe: recipe
      });
    });
    items.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return items.slice(0, 6);
  }

  function homepageBlogSkeletonHtml() {
    var html = '';
    var i;
    for (i = 0; i < 3; i++) {
      html +=
        '<div class="blog-card blog-card--skeleton" aria-hidden="true">' +
        '<div class="content-skeleton content-skeleton--media"></div>' +
        '<div class="blog-card-content">' +
        '<span class="content-skeleton content-skeleton--chip"></span>' +
        '<span class="content-skeleton content-skeleton--title"></span>' +
        '<span class="content-skeleton content-skeleton--line"></span>' +
        '<span class="content-skeleton content-skeleton--line content-skeleton--line-short"></span>' +
        '</div></div>';
    }
    return html;
  }

  function showHomepageBlogSkeleton() {
    var grid = document.getElementById('blogGrid');
    if (!grid || !document.getElementById('blog')) return;
    setBlogNavVisible();
    setBlogSectionVisible(true);
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = homepageBlogSkeletonHtml();
  }

  function renderBlogGrid() {
    // Solo homepage: evita di sovrascrivere la griglia di blog.html / altre pagine
    if (!document.getElementById('blog')) return;
    var grid = document.getElementById('blogGrid');
    var items = getHomepageBlogItems();
    setBlogNavVisible();
    if (items.length === 0) {
      setBlogSectionVisible(false);
      if (grid) {
        grid.innerHTML = '';
        grid.removeAttribute('aria-busy');
      }
      return;
    }
    setBlogSectionVisible(true);
    if (!grid) return;
    var html = '';
    var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
    items.forEach(function (item, i) {
      var imgClass = 'blog-card-image' + (imageClasses[i % 3] || '');
      if (item.type === 'recipe') {
        var recipe = item.recipe;
        var recipeImgStyle = recipe.imageUrl ? bgImageStyle(recipe.imageUrl) : '';
        var recipeHref = '/ricetta?id=' + encodeURIComponent(recipe.id);
        var recipeMetaHtml = (function () {
          var cat = '';
          if (recipe.category != null && recipe.category !== undefined) {
            cat = String(recipe.category).trim();
          } else {
            cat = String(recipe.tag || '').trim();
          }
          var tags = [];
          if (Array.isArray(recipe.tags)) {
            tags = recipe.tags
              .map(function (t) {
                return String(t || '').trim();
              })
              .filter(Boolean);
          } else if (recipe.category != null && recipe.category !== undefined) {
            var tag = String(recipe.tag || '').trim();
            if (tag && !(cat && tag === cat)) tags = [tag];
          }
          var metaTagHtml = function (name, className) {
            var fmt = window.PriscillaContentFormat;
            if (fmt && typeof fmt.metaTagHtml === 'function') {
              return fmt.metaTagHtml(name, className);
            }
            var label = String(name || '')
              .trim()
              .toLowerCase();
            if (!label) return '';
            return (
              '<span class="' + (className || 'blog-meta-tag') + '">' + escapeHtml(label) + '</span>'
            );
          };
          var tagsHtml = tags
            .map(function (t) {
              return metaTagHtml(t, 'blog-meta-tag');
            })
            .join('');
          if (!cat && !tags.length) {
            return '';
          }
          return (
            '<div class="blog-meta blog-meta--split">' +
            (cat ? metaTagHtml(cat, 'blog-meta-category') : '<span class="blog-meta-category"></span>') +
            (tagsHtml ? '<span class="blog-meta-tags">' + tagsHtml + '</span>' : '') +
            '</div>'
          );
        })();
        html +=
          '<a href="' +
          recipeHref +
          '" class="blog-card blog-card--recipe blog-card--link">' +
          '<div class="' +
          imgClass +
          '"' +
          recipeImgStyle +
          '></div>' +
          '<div class="blog-card-content">' +
          recipeMetaHtml +
          '<h3>' +
          escapeHtml(recipe.title) +
          '</h3>' +
          '<p>' +
          escapeHtml(recipe.excerpt || '') +
          '</p>' +
          '<span class="blog-link">Leggi la ricetta →</span>' +
          '</div></a>';
        return;
      }
      var post = item.post;
      var imgStyle = post.imageUrl ? bgImageStyle(post.imageUrl) : '';
      var href = '/blog?id=' + encodeURIComponent(post.id);
      html +=
        '<a href="' +
        href +
        '" class="blog-card blog-card--link">' +
        '<div class="' +
        imgClass +
        '"' +
        imgStyle +
        '></div>' +
        '<div class="blog-card-content">' +
        '<span class="blog-meta">' +
        escapeHtml(post.meta || '') +
        '</span>' +
        '<h3>' +
        escapeHtml(post.title) +
        '</h3>' +
        '<p>' +
        escapeHtml(post.excerpt || '') +
        '</p>' +
        '<span class="blog-link">Leggi l\'articolo →</span>' +
        '</div></a>';
    });
    html +=
      '<p class="blog-section-footer">' +
      '<a href="blog.html" class="blog-link blog-link--all">Vedi tutto il blog →</a>' +
      '</p>';
    grid.innerHTML = html;
    grid.removeAttribute('aria-busy');
    if (typeof initRevealAnimations === 'function') initRevealAnimations();
  }

  function loadHomepageBlog() {
    showHomepageBlogSkeleton();
    var store = window.PriscillaContent;
    if (store && typeof store.load === 'function') {
      store.load().then(renderBlogGrid).catch(renderBlogGrid);
    } else {
      renderBlogGrid();
    }
  }

  loadHomepageBlog();
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_BLOG || e.key === STORAGE_KEY_RICETTE) renderBlogGrid();
  });
  window.addEventListener('priscilla-content-changed', renderBlogGrid);

  const header = document.querySelector('.header');
  const navToggle = document.getElementById('navToggle');
  const mainNav = document.getElementById('mainNav');

  if (header) {
    function updateHeaderScroll() {
      if (window.scrollY > 30) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }
    window.addEventListener('scroll', updateHeaderScroll, { passive: true });
    updateHeaderScroll();
  }

  var waFloat = document.querySelector('.wa-float');
  if (waFloat) {
    var WA_SHOW_AFTER = 120;
    function updateWaFloat() {
      var show = window.scrollY > WA_SHOW_AFTER;
      waFloat.classList.toggle('is-visible', show);
      waFloat.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (show) waFloat.removeAttribute('tabindex');
      else waFloat.setAttribute('tabindex', '-1');
    }
    window.addEventListener('scroll', updateWaFloat, { passive: true });
    updateWaFloat();
  }

  if (navToggle && mainNav) {
    var navBackdrop = document.getElementById('navBackdrop');

    function setNavOpen(isOpen) {
      mainNav.classList.toggle('is-open', isOpen);
      navToggle.classList.toggle('is-active', isOpen);
      document.body.classList.toggle('nav-open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? 'Chiudi menu' : 'Apri menu');
      if (navBackdrop) {
        navBackdrop.classList.toggle('is-visible', isOpen);
        navBackdrop.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      }
    }

    navToggle.addEventListener('click', function () {
      setNavOpen(!mainNav.classList.contains('is-open'));
    });

    if (navBackdrop) {
      navBackdrop.addEventListener('click', function () {
        setNavOpen(false);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mainNav.classList.contains('is-open')) {
        setNavOpen(false);
      }
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setNavOpen(false);
      });
    });
  }

  // Prenota: sedi dinamiche, Calendly in modal brandizzato
  var prenotaSediEl = document.getElementById('prenotaSedi');
  var CALENDLY_SCRIPT_URL = 'https://assets.calendly.com/assets/external/widget.js';
  var calendlyScriptPromise = null;
  var prenotaEventsBound = false;
  var calendlyModal = document.getElementById('calendlyModal');
  var calendlyModalOverlay = document.getElementById('calendlyModalOverlay');
  var calendlyModalClose = document.getElementById('calendlyModalClose');
  var calendlyModalTitle = document.getElementById('calendlyModalTitle');
  var calendlyModalMeta = document.getElementById('calendlyModalMeta');
  var calendlyModalLoading = document.getElementById('calendlyModalLoading');
  var calendlyInline = document.getElementById('calendlyInline');
  var calendlyModalLastFocus = null;
  var calendlyLoadingTimer = null;

  var ICON_LOCATION = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var ICON_VIDEO = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';

  function getActiveSedi() {
    if (window.PriscillaSedi) return window.PriscillaSedi.getActiveSedi();
    return [];
  }

  function isCalendlyUrl(url) {
    if (window.PriscillaSedi) return window.PriscillaSedi.isCalendlyUrl(url);
    return /calendly\.com/i.test(url || '');
  }

  function isCalendlyReady() {
    return typeof window.Calendly !== 'undefined' && typeof window.Calendly.initInlineWidget === 'function';
  }

  function trackSedeClick(el) {
    if (!window.PriscillaAnalytics || !el) return;
    var sedeId = el.getAttribute('data-sede') || '';
    var sedeName = el.getAttribute('data-sede-name') || '';
    var online = el.getAttribute('data-sede-online') === '1';
    var url = el.getAttribute('data-url') || el.getAttribute('href') || '';
    if (!sedeName && sedeId) {
      var match = getActiveSedi().find(function (s) { return s.id === sedeId; });
      if (match) {
        sedeName = match.name || '';
        online = !!match.online;
        url = url || match.url || '';
      }
    }
    window.PriscillaAnalytics.trackSedeClick(sedeId, sedeName, url, online);
  }

  function buildSedeCardHtml(sede) {
    var online = !!sede.online;
    var calendly = isCalendlyUrl(sede.url);
    var cardClass = 'prenota-sede-card' + (online ? ' prenota-sede-card--online' : '');
    var badgeClass = 'prenota-sede-badge' + (online ? ' prenota-sede-badge--online' : '');
    var badge = online ? 'Online' : 'In presenza';
    var icon = online ? ICON_VIDEO : ICON_LOCATION;
    var inner =
      '<span class="prenota-sede-icon" aria-hidden="true">' + icon + '</span>' +
      '<span class="' + badgeClass + '">' + escapeHtml(badge) + '</span>' +
      '<span class="prenota-sede-nome">' + escapeHtml(sede.name) + '</span>' +
      '<span class="prenota-sede-indirizzo">' + escapeHtml(sede.address) + '</span>';
    var attrs =
      ' data-sede="' + escapeHtml(sede.id) + '"' +
      ' data-sede-name="' + escapeHtml(sede.name) + '"' +
      ' data-sede-address="' + escapeHtml(sede.address || '') + '"' +
      ' data-sede-online="' + (online ? '1' : '0') + '"';

    if (calendly) {
      return '<button type="button" class="' + cardClass + '"' + attrs + ' data-url="' + escapeHtml(sede.url) + '">' + inner + '</button>';
    }
    return '<a href="' + escapeHtml(sede.url) + '" class="' + cardClass + '" target="_blank" rel="noopener noreferrer"' + attrs + '>' + inner + '</a>';
  }

  function renderFooterSedi() {
    var list = document.getElementById('footerSediList');
    if (!list) return;
    var html = '';
    getActiveSedi().forEach(function (sede) {
      if (sede.online || !sede.address) return;
      var label = sede.name ? sede.name + ' — ' + sede.address : sede.address;
      html += '<li>' + escapeHtml(label) + '</li>';
    });
    list.innerHTML = html;
  }

  function ensureCalendlyScript() {
    if (isCalendlyReady()) {
      return Promise.resolve();
    }
    if (calendlyScriptPromise) return calendlyScriptPromise;

    calendlyScriptPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src*="assets/external/widget.js"]');
      if (existing) {
        if (existing.getAttribute('data-calendly-ready') === 'true' || isCalendlyReady()) {
          existing.setAttribute('data-calendly-ready', 'true');
          resolve();
          return;
        }
        existing.addEventListener('load', function () {
          existing.setAttribute('data-calendly-ready', 'true');
          resolve();
        });
        existing.addEventListener('error', reject);
        return;
      }

      var script = document.createElement('script');
      script.src = CALENDLY_SCRIPT_URL;
      script.async = true;
      script.addEventListener('load', function () {
        script.setAttribute('data-calendly-ready', 'true');
        resolve();
      });
      script.addEventListener('error', reject);
      document.head.appendChild(script);
    });

    return calendlyScriptPromise;
  }

  function buildCalendlyEmbedUrl(url) {
    try {
      var u = new URL(url, window.location.origin);
      u.searchParams.set('hide_gdpr_banner', '1');
      u.searchParams.set('hide_event_type_details', '1');
      u.searchParams.set('hide_landing_page_details', '1');
      u.searchParams.set('primary_color', '6b8cff');
      u.searchParams.set('text_color', '111111');
      u.searchParams.set('background_color', 'ffffff');
      u.searchParams.set('locale', 'it');
      return u.toString();
    } catch (err) {
      return url;
    }
  }

  function setCalendlyLoading(isLoading) {
    if (!calendlyModalLoading) return;
    calendlyModalLoading.classList.toggle('is-hidden', !isLoading);
  }

  function closeCalendlyModal() {
    if (!calendlyModal || calendlyModal.hidden) return;
    calendlyModal.hidden = true;
    document.body.classList.remove('calendly-modal-open');
    if (calendlyLoadingTimer) {
      clearTimeout(calendlyLoadingTimer);
      calendlyLoadingTimer = null;
    }
    if (calendlyInline) calendlyInline.innerHTML = '';
    setCalendlyLoading(true);
    if (calendlyModalLastFocus && typeof calendlyModalLastFocus.focus === 'function') {
      calendlyModalLastFocus.focus();
    }
  }

  function openCalendlyPopup(options) {
    var url = typeof options === 'string' ? options : (options && options.url);
    if (!url) return;

    var name = typeof options === 'object' && options ? (options.name || '') : '';
    var address = typeof options === 'object' && options ? (options.address || '') : '';
    var online = typeof options === 'object' && options ? !!options.online : false;

    if (!calendlyModal || !calendlyInline) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    calendlyModalLastFocus = document.activeElement;
    if (calendlyModalTitle) {
      calendlyModalTitle.textContent = name || 'Scegli data e orario';
    }
    if (calendlyModalMeta) {
      calendlyModalMeta.textContent = online
        ? (address || 'Videochiamata')
        : (address || '');
    }

    setCalendlyLoading(true);
    if (calendlyInline) calendlyInline.innerHTML = '';
    calendlyModal.hidden = false;
    document.body.classList.add('calendly-modal-open');
    if (calendlyModalClose) calendlyModalClose.focus();

    ensureCalendlyScript().then(function () {
      if (!isCalendlyReady() || calendlyModal.hidden) {
        closeCalendlyModal();
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      calendlyInline.style.minWidth = '320px';
      calendlyInline.style.height = '100%';
      window.Calendly.initInlineWidget({
        url: buildCalendlyEmbedUrl(url),
        parentElement: calendlyInline
      });

      if (calendlyLoadingTimer) clearTimeout(calendlyLoadingTimer);
      calendlyLoadingTimer = setTimeout(function () {
        setCalendlyLoading(false);
      }, 900);
    }).catch(function () {
      closeCalendlyModal();
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  function warmCalendlyScript() {
    ensureCalendlyScript().catch(function () {});
  }

  function renderPrenotaSedi() {
    if (!prenotaSediEl) return;

    var cardsHtml = '';
    getActiveSedi().forEach(function (sede) {
      cardsHtml += buildSedeCardHtml(sede);
    });

    prenotaSediEl.innerHTML = cardsHtml;
    renderFooterSedi();

    if (typeof initRevealAnimations === 'function') initRevealAnimations();
    bindPrenotaEvents();
  }

  function bindPrenotaEvents() {
    if (!prenotaSediEl || prenotaEventsBound) return;
    prenotaEventsBound = true;

    prenotaSediEl.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-sede]');
      if (!btn) return;
      trackSedeClick(btn);
      if (btn.tagName === 'A') return;
      event.preventDefault();
      openCalendlyPopup({
        url: btn.getAttribute('data-url'),
        name: btn.getAttribute('data-sede-name') || '',
        address: btn.getAttribute('data-sede-address') || '',
        online: btn.getAttribute('data-sede-online') === '1'
      });
    });

    prenotaSediEl.addEventListener('mouseenter', warmCalendlyScript, { capture: true, once: true });
    prenotaSediEl.addEventListener('focus', warmCalendlyScript, { capture: true, once: true });
    prenotaSediEl.addEventListener('touchstart', warmCalendlyScript, { capture: true, passive: true, once: true });
  }

  if (calendlyModalClose) {
    calendlyModalClose.addEventListener('click', closeCalendlyModal);
  }
  if (calendlyModalOverlay) {
    calendlyModalOverlay.addEventListener('click', closeCalendlyModal);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && calendlyModal && !calendlyModal.hidden) {
      closeCalendlyModal();
    }
  });
  window.addEventListener('message', function (event) {
    if (!calendlyModal || calendlyModal.hidden) return;
    if (event.origin !== 'https://calendly.com') return;
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.event === 'calendly.event_type_viewed' || data.event === 'calendly.date_and_time_selected') {
      setCalendlyLoading(false);
    }
  });

  document.querySelectorAll('a[href="#prenota"]').forEach(function (link) {
    link.addEventListener('mouseenter', warmCalendlyScript, { once: true });
    link.addEventListener('focus', warmCalendlyScript, { once: true });
  });

  renderPrenotaSedi();

  window.addEventListener('storage', function (event) {
    if (event.key === (window.PriscillaSedi && window.PriscillaSedi.STORAGE_KEY)) renderPrenotaSedi();
  });

  window.addEventListener('sedi-updated', renderPrenotaSedi);

  function initRevealAnimations() {
    var revealTargets = document.querySelectorAll(revealSelector);
    if (!revealTargets.length) return;

    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { root: null, rootMargin: '0px 0px -48px 0px', threshold: 0 }
      );
    }

    revealTargets.forEach(function (el) {
      if (el.closest('.hero') || el.classList.contains('is-visible')) return;
      if (el.dataset.revealObserved !== 'true') {
        el.dataset.revealObserved = 'true';
        revealObserver.observe(el);
      }
      revealIfInView(el);
    });
  }

  initRevealAnimations();
  revealElementsInView();
  [50, 200, 500, 1000].forEach(function (ms) {
    setTimeout(revealElementsInView, ms);
  });
  window.addEventListener('hashchange', function () {
    requestAnimationFrame(function () {
      initRevealAnimations();
      revealElementsInView();
      setTimeout(revealElementsInView, 300);
    });
  });
  window.addEventListener('load', revealElementsInView);
  var revealScrollQueued = false;
  window.addEventListener('scroll', function () {
    if (revealScrollQueued) return;
    revealScrollQueued = true;
    requestAnimationFrame(function () {
      revealScrollQueued = false;
      revealElementsInView();
    });
  }, { passive: true });

  // Hero stagger: mark list visible on load
  var heroStagger = document.querySelector('.hero .reveal-stagger');
  if (heroStagger) {
    requestAnimationFrame(function () {
      heroStagger.classList.add('is-visible');
    });
  }

  // Subtle parallax on scroll
  var parallaxTargets = document.querySelectorAll('.parallax-target');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (parallaxTargets.length && !prefersReducedMotion) {
    var parallaxTicking = false;

    function updateParallax() {
      parallaxTargets.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        var viewH = window.innerHeight;
        if (rect.bottom < 0 || rect.top > viewH) return;
        var progress = (rect.top + rect.height * 0.5 - viewH * 0.5) / viewH;
        var offset = progress * -18;
        el.style.transform = 'translate3d(0, ' + offset + 'px, 0)';
      });
      parallaxTicking = false;
    }

    window.addEventListener('scroll', function () {
      if (!parallaxTicking) {
        parallaxTicking = true;
        requestAnimationFrame(updateParallax);
      }
    }, { passive: true });
    updateParallax();
  }

  // Active nav link on scroll (solo link nel menu, non CTA mobile)
  var navLinks = document.querySelectorAll('.nav ul a[href^="#"]');
  var sections = [];
  var seenSectionIds = Object.create(null);

  navLinks.forEach(function (link) {
    var id = link.getAttribute('href');
    if (!id || id === '#' || seenSectionIds[id]) return;
    var section = document.querySelector(id);
    if (!section) return;
    seenSectionIds[id] = true;
    sections.push({ id: id, el: section, link: link });
  });

  if (sections.length) {
    function updateActiveNav() {
      var scrollPos = window.scrollY + (header ? header.offsetHeight + 40 : 120);
      var current = sections[0];

      sections.forEach(function (item) {
        if (item.el.offsetTop <= scrollPos) current = item;
      });

      navLinks.forEach(function (link) {
        link.classList.remove('is-active');
      });
      if (current && current.link) {
        current.link.classList.add('is-active');
      }
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();
  }

  function initReviewsSlider() {
    var track = document.getElementById('reviewsTrack');
    if (!track) return;

    var cards = track.querySelectorAll('.review-card');
    if (!cards.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (var i = 0; i < cards.length; i++) {
      var clone = cards[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }

    function setDuration() {
      var halfWidth = track.scrollWidth / 2;
      var speed = 42;
      var duration = Math.max(halfWidth / speed, 40);
      track.style.setProperty('--reviews-duration', duration + 's');
    }

    setDuration();
    window.addEventListener('resize', setDuration);
  }

  initReviewsSlider();

  // CV modal (Esperienze professionali)
  var cvModal = document.getElementById('cvModal');
  var btnEsperienze = document.getElementById('btnEsperienze');
  var cvModalClose = document.getElementById('cvModalClose');
  var cvModalOverlay = document.getElementById('cvModalOverlay');
  var cvModalLastFocus = null;

  function openCvModal() {
    if (!cvModal || !btnEsperienze) return;
    cvModalLastFocus = document.activeElement;
    cvModal.hidden = false;
    document.body.classList.add('cv-modal-open');
    if (cvModalClose) cvModalClose.focus();
  }

  function closeCvModal() {
    if (!cvModal) return;
    cvModal.hidden = true;
    document.body.classList.remove('cv-modal-open');
    if (cvModalLastFocus && typeof cvModalLastFocus.focus === 'function') {
      cvModalLastFocus.focus();
    }
  }

  if (btnEsperienze) {
    btnEsperienze.addEventListener('click', openCvModal);
  }
  if (cvModalClose) {
    cvModalClose.addEventListener('click', closeCvModal);
  }
  if (cvModalOverlay) {
    cvModalOverlay.addEventListener('click', closeCvModal);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && cvModal && !cvModal.hidden) {
      closeCvModal();
    }
  });
})();
