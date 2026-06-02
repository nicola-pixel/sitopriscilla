(function () {
  'use strict';

  requestAnimationFrame(function () {
    document.body.classList.add('page-loaded');
  });

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

  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPublishedBlogPosts() {
    return getBlogPosts().filter(function (post) {
      return post && String(post.title || '').trim();
    });
  }

  function setBlogNavVisible(visible) {
    document.querySelectorAll('a[href="#blog"]').forEach(function (link) {
      var li = link.closest('li');
      if (li) li.hidden = !visible;
    });
  }

  function setBlogSectionVisible(visible) {
    var section = document.getElementById('blog');
    if (!section) return;
    section.hidden = !visible;
    section.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function renderBlogGrid() {
    var grid = document.getElementById('blogGrid');
    var posts = getPublishedBlogPosts();
    if (posts.length === 0) {
      setBlogSectionVisible(false);
      if (grid) grid.innerHTML = '';
      setBlogNavVisible(false);
      return;
    }
    setBlogSectionVisible(true);
    setBlogNavVisible(true);
    if (!grid) return;
    var html = '';
    var imageClasses = ['', ' blog-card-image--2', ' blog-card-image--3'];
    posts.forEach(function (post, i) {
      var imgStyle = post.imageUrl ? ' style="background-image: url(' + escapeHtml(post.imageUrl) + '); background-size: cover;"' : '';
      var imgClass = 'blog-card-image' + (imageClasses[i % 3] || '');
      html += '<article class="blog-card">' +
        '<div class="' + imgClass + '"' + imgStyle + '></div>' +
        '<div class="blog-card-content">' +
        '<span class="blog-meta">' + escapeHtml(post.meta || '') + '</span>' +
        '<h3>' + escapeHtml(post.title) + '</h3>' +
        '<p>' + escapeHtml(post.excerpt || '') + '</p>' +
        '<a href="blog.html?id=' + encodeURIComponent(post.id) + '" class="blog-link">Leggi l\'articolo →</a>' +
        '</div></article>';
    });
    grid.innerHTML = html;
    if (typeof initRevealAnimations === 'function') initRevealAnimations();
  }

  function renderRecipesGrid() {
    var grid = document.getElementById('recipesGrid');
    if (!grid) return;
    var recipes = getRecipes();
    if (recipes.length === 0) return;
    var html = '';
    var imageClasses = [' recipe-card-image--1', ' recipe-card-image--2', ' recipe-card-image--3'];
    recipes.forEach(function (recipe, i) {
      var imgStyle = recipe.imageUrl ? ' style="background-image: url(' + escapeHtml(recipe.imageUrl) + '); background-size: cover;"' : '';
      var imgClass = 'recipe-card-image' + (imageClasses[i % 3] || '');
      var link = 'ricetta.html?id=' + encodeURIComponent(recipe.id);
      html += '<article class="recipe-card">' +
        '<div class="' + imgClass + '"' + imgStyle + '></div>' +
        '<div class="recipe-card-content">' +
        '<span class="recipe-tag">' + escapeHtml(recipe.category || recipe.tag || '') + '</span>' +
        '<h3>' + escapeHtml(recipe.title) + '</h3>' +
        '<p>' + escapeHtml(recipe.excerpt || '') + '</p>' +
        '<a href="' + link + '" class="recipe-link">Vedi ricetta →</a>' +
        '</div></article>';
    });
    grid.innerHTML = html;
    if (typeof initRevealAnimations === 'function') initRevealAnimations();
  }

  renderBlogGrid();
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY_BLOG) renderBlogGrid();
  });
  renderRecipesGrid();

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

  // Prenota: scelta sede (Milano, Modena, Trezzo, Online) poi mostra il calendario
  var prenotaScelta = document.getElementById('prenotaScelta');
  var calendari = {
    milano: document.getElementById('calendarioMilano'),
    modena: document.getElementById('calendarioModena'),
    trezzo: document.getElementById('calendarioTrezzo'),
    online: document.getElementById('calendarioOnline')
  };
  var CALENDLY_SCRIPT_URL = 'https://assets.calendly.com/assets/external/widget.js';
  var calendlyScriptPromise = null;
  var calendlyPanelsPreloaded = false;

  function ensureCalendlyScript() {
    if (typeof window.Calendly !== 'undefined' && window.Calendly.initInlineWidget) {
      return Promise.resolve();
    }
    if (calendlyScriptPromise) return calendlyScriptPromise;

    calendlyScriptPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src*="assets/external/widget.js"]');
      if (existing) {
        if (existing.getAttribute('data-calendly-ready') === 'true') {
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

  function preparePanelForPreload(panel) {
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('prenota-calendario-wrap--preload');
  }

  function isCalendlyRendered(widgetEl, minHeight) {
    if (!widgetEl) return false;
    if (widgetEl.getAttribute('data-calendly-rendered') === 'true') return true;
    var iframe = widgetEl.querySelector('iframe');
    return !!(iframe && iframe.offsetHeight >= (minHeight || 320));
  }

  function markCalendlyRendered(widgetEl) {
    if (!widgetEl) return;
    widgetEl.setAttribute('data-calendly-rendered', 'true');
  }

  function preloadCalendlyPanel(panel) {
    if (!panel) return;
    var widgetEl = panel.querySelector('.calendly-inline-widget');
    if (isCalendlyRendered(widgetEl)) return;
    preparePanelForPreload(panel);
    initCalendlyInPanel(panel, { silent: true });
  }

  function preloadAllCalendlyPanels() {
    if (calendlyPanelsPreloaded || !prenotaScelta) return;
    calendlyPanelsPreloaded = true;

    ensureCalendlyScript().then(function () {
      preloadCalendlyPanel(calendari.milano);
      ['modena', 'trezzo', 'online'].forEach(function (key, index) {
        setTimeout(function () {
          preloadCalendlyPanel(calendari[key]);
        }, (index + 1) * 250);
      });
    }).catch(function () {});
  }

  function scheduleCalendlyPreload() {
    if (!prenotaScelta) return;
    if (window.matchMedia('(prefers-reduced-data: reduce)').matches) return;

    ensureCalendlyScript().then(function () {
      preloadCalendlyPanel(calendari.milano);
    }).catch(function () {});

    function preloadRest() {
      preloadAllCalendlyPanels();
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(preloadRest, { timeout: 1200 });
    } else {
      setTimeout(preloadRest, 300);
    }

    var prenotaSection = document.getElementById('prenota');
    if (prenotaSection && 'IntersectionObserver' in window) {
      var prenotaObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          preloadAllCalendlyPanels();
          prenotaObserver.disconnect();
        });
      }, { rootMargin: '1200px 0px', threshold: 0 });
      prenotaObserver.observe(prenotaSection);
    }
  }

  function warmCalendlyOnNavIntent() {
    ensureCalendlyScript().then(function () {
      preloadCalendlyPanel(calendari.milano);
    }).catch(function () {});
  }

  function ensureCalendlyLoader(wrap) {
    if (!wrap || wrap.querySelector('.calendly-loader')) return;
    var loader = document.createElement('div');
    loader.className = 'calendly-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML =
      '<div class="calendly-loader-inner">' +
        '<div class="calendly-loader-icon" aria-hidden="true">' +
          '<svg class="calendly-loader-calendar" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
            '<line x1="16" y1="2" x2="16" y2="6"/>' +
            '<line x1="8" y1="2" x2="8" y2="6"/>' +
            '<line x1="3" y1="10" x2="21" y2="10"/>' +
            '<rect class="calendly-loader-day" x="7" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>' +
            '<rect class="calendly-loader-day calendly-loader-day--2" x="12" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>' +
            '<rect class="calendly-loader-day calendly-loader-day--3" x="17" y="13" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/>' +
          '</svg>' +
          '<span class="calendly-loader-ring"></span>' +
        '</div>' +
        '<p class="calendly-loader-text">Caricamento calendario…</p>' +
        '<div class="calendly-loader-dots" aria-hidden="true">' +
          '<span></span><span></span><span></span>' +
        '</div>' +
      '</div>';
    wrap.insertBefore(loader, wrap.firstChild);
  }

  function setCalendlyLoading(wrap, loading) {
    if (!wrap) return;
    wrap.classList.toggle('calendly-wrap--loading', loading);
  }

  function waitForCalendlyRender(widgetEl, callback) {
    var settled = false;
    var iframeCheck = null;
    var fallbackTimeout = null;
    var minRenderedHeight = 320;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      if (iframeCheck) clearInterval(iframeCheck);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    }

    function finish() {
      if (settled) return;
      settled = true;
      cleanup();
      markCalendlyRendered(widgetEl);
      callback();
    }

    function onMessage(event) {
      if (event.origin !== 'https://calendly.com') return;
      if (!event.data || event.data.event !== 'calendly.page_height') return;
      var height = event.data.payload && event.data.payload.height;
      if (height && height >= minRenderedHeight) finish();
    }

    if (isCalendlyRendered(widgetEl, minRenderedHeight)) {
      finish();
      return;
    }

    window.addEventListener('message', onMessage);

    iframeCheck = setInterval(function () {
      if (isCalendlyRendered(widgetEl, minRenderedHeight)) finish();
    }, 50);

    fallbackTimeout = setTimeout(finish, 15000);
  }

  function initCalendlyInPanel(panel, options) {
    if (!panel) return;
    options = options || {};
    var silent = options.silent === true;
    var widgetEl = panel.querySelector('.calendly-inline-widget');
    var wrap = panel.querySelector('.calendly-wrap');
    if (!widgetEl) return;

    if (!silent) {
      ensureCalendlyLoader(wrap);
      setCalendlyLoading(wrap, true);
    }

    function finishLoading() {
      if (silent) return;
      waitForCalendlyRender(widgetEl, function () {
        setCalendlyLoading(wrap, false);
        panel.classList.add('prenota-calendario-wrap--ready');
      });
    }

    if (widgetEl.getAttribute('data-calendly-inited') === 'true') {
      if (silent) {
        if (!isCalendlyRendered(widgetEl)) {
          waitForCalendlyRender(widgetEl, function () {});
        }
      } else if (isCalendlyRendered(widgetEl)) {
        setCalendlyLoading(wrap, false);
      } else {
        finishLoading();
      }
      return;
    }

    var url = widgetEl.getAttribute('data-url');
    if (!url) {
      if (!silent) setCalendlyLoading(wrap, false);
      return;
    }

    function doInit() {
      if (typeof window.Calendly === 'undefined' || !window.Calendly.initInlineWidget) return false;
      window.Calendly.initInlineWidget({
        url: url,
        parentElement: widgetEl,
        prefill: {},
        utm: {},
        autoLoad: true,
        resize: true
      });
      widgetEl.setAttribute('data-calendly-inited', 'true');
      finishLoading();
      return true;
    }

    function waitAndInit() {
      if (doInit()) return;
      var attempts = 0;
      var t = setInterval(function () {
        if (doInit() || attempts++ > 100) {
          clearInterval(t);
          if (!silent && attempts > 100) setCalendlyLoading(wrap, false);
        }
      }, 30);
    }

    ensureCalendlyScript().then(waitAndInit).catch(function () {
      if (!silent) setCalendlyLoading(wrap, false);
    });
  }

  function mostraCalendario(sede) {
    if (!prenotaScelta) return;
    prenotaScelta.hidden = true;
    Object.keys(calendari).forEach(function (key) {
      var el = calendari[key];
      if (!el) return;
      if (key !== sede) {
        el.hidden = true;
        el.classList.remove('prenota-calendario-wrap--preload');
      }
    });
    var panel = calendari[sede];
    if (panel) {
      panel.hidden = false;
      panel.classList.remove('prenota-calendario-wrap--preload');
      var wrap = panel.querySelector('.calendly-wrap');
      var widgetEl = panel.querySelector('.calendly-inline-widget');
      var ready = isCalendlyRendered(widgetEl);
      panel.classList.toggle('prenota-calendario-wrap--ready', ready);
      if (ready) {
        setCalendlyLoading(wrap, false);
      } else {
        ensureCalendlyLoader(wrap);
        setCalendlyLoading(wrap, true);
      }
      initCalendlyInPanel(panel);
    }
  }


  function tornaSceltaSede() {
    if (!prenotaScelta) return;
    prenotaScelta.hidden = false;
    Object.keys(calendari).forEach(function (key) {
      var el = calendari[key];
      if (!el) return;
      var widget = el.querySelector('.calendly-inline-widget');
      var inited = widget && widget.getAttribute('data-calendly-inited') === 'true';
      if (inited) {
        el.hidden = false;
        el.classList.add('prenota-calendario-wrap--preload');
      } else {
        el.hidden = true;
        el.classList.remove('prenota-calendario-wrap--preload');
      }
    });
  }

  document.getElementById('btnPrenotaMilano') && document.getElementById('btnPrenotaMilano').addEventListener('click', function () { mostraCalendario('milano'); });
  document.getElementById('btnPrenotaModena') && document.getElementById('btnPrenotaModena').addEventListener('click', function () { mostraCalendario('modena'); });
  document.getElementById('btnPrenotaTrezzo') && document.getElementById('btnPrenotaTrezzo').addEventListener('click', function () { mostraCalendario('trezzo'); });
  document.getElementById('btnPrenotaOnline') && document.getElementById('btnPrenotaOnline').addEventListener('click', function () { mostraCalendario('online'); });
  document.getElementById('btnTornaDaMilano') && document.getElementById('btnTornaDaMilano').addEventListener('click', tornaSceltaSede);
  document.getElementById('btnTornaDaModena') && document.getElementById('btnTornaDaModena').addEventListener('click', tornaSceltaSede);
  document.getElementById('btnTornaDaTrezzo') && document.getElementById('btnTornaDaTrezzo').addEventListener('click', tornaSceltaSede);
  document.getElementById('btnTornaDaOnline') && document.getElementById('btnTornaDaOnline').addEventListener('click', tornaSceltaSede);

  document.querySelectorAll('.prenota-sede-card').forEach(function (btn) {
    function warmCalendlyOnIntent() {
      var sede = btn.getAttribute('data-sede');
      if (sede && calendari[sede]) preloadCalendlyPanel(calendari[sede]);
    }
    btn.addEventListener('mouseenter', warmCalendlyOnIntent, { once: true });
    btn.addEventListener('focus', warmCalendlyOnIntent, { once: true });
    btn.addEventListener('touchstart', warmCalendlyOnIntent, { once: true, passive: true });
  });

  document.querySelectorAll('a[href="#prenota"]').forEach(function (link) {
    link.addEventListener('mouseenter', warmCalendlyOnNavIntent, { once: true });
    link.addEventListener('focus', warmCalendlyOnNavIntent, { once: true });
  });

  scheduleCalendlyPreload();

  // Scroll reveal animations
  var revealSelector = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger';
  var revealObserver = null;

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
        { root: null, rootMargin: '0px 0px -6% 0px', threshold: 0.1 }
      );
    }

    revealTargets.forEach(function (el) {
      if (el.closest('.hero') || el.classList.contains('is-visible')) return;
      if (el.dataset.revealObserved === 'true') return;
      el.dataset.revealObserved = 'true';
      revealObserver.observe(el);
    });
  }

  initRevealAnimations();

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

  // Active nav link on scroll
  var navLinks = document.querySelectorAll('.nav a[href^="#"]');
  var sections = [];

  navLinks.forEach(function (link) {
    var id = link.getAttribute('href');
    if (!id || id === '#') return;
    var section = document.querySelector(id);
    if (section) sections.push({ id: id, el: section, link: link });
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
