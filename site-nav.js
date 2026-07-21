/**
 * Navbar e footer navigazione — unica fonte di verità per tutte le pagine pubbliche.
 * Aggiorna i link qui: verranno applicati ovunque carichi questo script.
 */
(function () {
  var NAV_ITEMS = [
    { id: 'home', label: 'Home', hash: '#home' },
    { id: 'chi-siamo', label: 'Chi sono', hash: '#chi-siamo' },
    { id: 'servizi', label: 'Servizi', hash: '#servizi' },
    { id: 'prenota', label: 'Prenota', hash: '#prenota' },
    { id: 'faq', label: 'FAQ', hash: '#faq' },
    { id: 'blog', label: 'Blog', hash: '#blog', page: 'blog' },
    { id: 'materiale', label: 'Materiale', page: 'scarica' }
  ];

  var PRENOTA_LABEL = 'Prenota una consulenza';

  function normalizePath(pathname) {
    var path = String(pathname || '/').split('?')[0].split('#')[0];
    path = path.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path || '/';
  }

  function isHomePage() {
    var path = normalizePath(location.pathname);
    return path === '/' || path === '';
  }

  function currentPageId() {
    var path = normalizePath(location.pathname);
    if (path === '/scarica') return 'materiale';
    if (path === '/blog' || path === '/ricette' || path === '/ricetta') return 'blog';
    if (isHomePage()) return 'home';
    return null;
  }

  function hrefFor(item, forHome) {
    if (item.page === 'scarica') {
      return 'scarica.html';
    }
    if (item.page === 'blog') {
      // In homepage punta alla sezione anteprima (#blog) per scroll-spy e ancoraggio;
      // dalle altre pagine va alla listing completa.
      if (forHome) return item.hash || '#blog';
      return 'blog.html';
    }
    if (forHome) return item.hash;
    return 'index.html' + item.hash;
  }

  function prenotaHref(forHome) {
    return forHome ? '#prenota' : 'index.html#prenota';
  }

  function homeHref(forHome) {
    return forHome ? '#home' : 'index.html';
  }

  function buildListHtml(activeId, forHome) {
    return NAV_ITEMS.map(function (item) {
      var href = hrefFor(item, forHome);
      var isActive = item.id === activeId;
      var cls = isActive ? ' class="is-active"' : '';
      return '<li><a href="' + href + '"' + cls + '>' + item.label + '</a></li>';
    }).join('');
  }

  function syncMainNav(activeId, forHome) {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    var ul = nav.querySelector('ul');
    if (ul) ul.innerHTML = buildListHtml(activeId, forHome);

    var mobileCta = nav.querySelector('.nav-mobile-cta');
    if (mobileCta) {
      mobileCta.href = prenotaHref(forHome);
      mobileCta.textContent = PRENOTA_LABEL;
    }
  }

  function syncHeader(forHome) {
    var headerInner = document.querySelector('.header .header-inner');
    if (!headerInner) return;

    var logo = headerInner.querySelector('.header-logo');
    if (logo) logo.setAttribute('href', homeHref(forHome));

    var actions = headerInner.querySelector('.header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'header-actions';
      headerInner.appendChild(actions);
    }

    var cta = headerInner.querySelector('.btn-header-cta:not(.nav-mobile-cta)');
    if (!cta) {
      cta = document.createElement('a');
      cta.className = 'btn btn-header-cta';
      actions.insertBefore(cta, actions.firstChild);
    } else if (cta.parentElement !== actions) {
      actions.insertBefore(cta, actions.firstChild);
    }
    cta.href = prenotaHref(forHome);
    cta.setAttribute('aria-label', PRENOTA_LABEL);
    cta.innerHTML =
      '<span class="btn-header-cta-full">' + PRENOTA_LABEL + '</span>' +
      '<span class="btn-header-cta-short" aria-hidden="true">Prenota</span>';

    var toggle = headerInner.querySelector('.nav-toggle');
    if (toggle && toggle.parentElement !== actions) {
      actions.appendChild(toggle);
    }
  }

  function syncFooterNav(activeId, forHome) {
    var footerNav = document.querySelector('.footer-nav .footer-list');
    if (!footerNav) return;
    footerNav.innerHTML = NAV_ITEMS.map(function (item) {
      return '<li><a href="' + hrefFor(item, forHome) + '">' + item.label + '</a></li>';
    }).join('');
  }

  function syncFooterLogo(forHome) {
    var footerLogo = document.querySelector('.footer-logo');
    if (footerLogo) footerLogo.setAttribute('href', homeHref(forHome));
  }

  function apply() {
    var forHome = isHomePage();
    var activeId = currentPageId();
    // Su homepage lo scroll in script.js gestisce is-active sulle ancore
    if (forHome) activeId = 'home';
    syncHeader(forHome);
    syncMainNav(activeId, forHome);
    syncFooterNav(activeId, forHome);
    syncFooterLogo(forHome);
  }

  // Esegui subito se il DOM è già disponibile (script in fondo pagina),
  // così script.js collega gli eventi sui link aggiornati.
  if (document.getElementById('mainNav') || document.querySelector('.header')) {
    apply();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
