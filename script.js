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

  function renderBlogGrid() {
    var grid = document.getElementById('blogGrid');
    if (!grid) return;
    var posts = getBlogPosts();
    if (posts.length === 0) return;
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
    navToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('is-open');
      navToggle.classList.toggle('is-active', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen);
      navToggle.setAttribute('aria-label', isOpen ? 'Chiudi menu' : 'Apri menu');
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('is-open');
        navToggle.classList.remove('is-active');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Apri menu');
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

  function initCalendlyInPanel(panel) {
    if (!panel) return;
    var widgetEl = panel.querySelector('.calendly-inline-widget');
    var wrap = panel && panel.querySelector('.calendly-wrap');
    if (!widgetEl) return;
    if (widgetEl.getAttribute('data-calendly-inited') === 'true') return;
    var url = widgetEl.getAttribute('data-url');
    if (!url) return;
    if (wrap) wrap.classList.add('calendly-wrap--loading');
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
      if (wrap) wrap.classList.remove('calendly-wrap--loading');
      return true;
    }
    if (!doInit()) {
      var attempts = 0;
      var t = setInterval(function () {
        if (doInit() || attempts++ > 100) {
          clearInterval(t);
          if (wrap) wrap.classList.remove('calendly-wrap--loading');
        }
      }, 30);
    }
  }

  function mostraCalendario(sede) {
    if (!prenotaScelta) return;
    prenotaScelta.hidden = true;
    Object.keys(calendari).forEach(function (key) {
      var el = calendari[key];
      if (el) el.hidden = key !== sede;
    });
    var panel = calendari[sede];
    if (panel) {
      panel.hidden = false;
      initCalendlyInPanel(panel);
    }
  }


  function tornaSceltaSede() {
    if (!prenotaScelta) return;
    prenotaScelta.hidden = false;
    Object.keys(calendari).forEach(function (key) {
      var el = calendari[key];
      if (el) el.hidden = true;
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
})();
