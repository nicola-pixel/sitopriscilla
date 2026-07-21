(function (global) {
  'use strict';

  var STORAGE_KEY_AUTH = 'admin_authenticated';
  var STORAGE_KEY_ADMIN_PASSWORD = 'admin_password';

  function getAdminPassword() {
    try {
      var stored = (global.localStorage.getItem(STORAGE_KEY_ADMIN_PASSWORD) || '').trim();
      if (stored) return stored;
    } catch (e) {}
    var config = global.PriscillaConfig || {};
    return (config.adminPassword || '').trim();
  }

  function isAuthenticated() {
    try {
      return global.sessionStorage.getItem(STORAGE_KEY_AUTH) === '1';
    } catch (e) {
      return false;
    }
  }

  function setAuthenticated(value) {
    try {
      if (value) {
        global.sessionStorage.setItem(STORAGE_KEY_AUTH, '1');
      } else {
        global.sessionStorage.removeItem(STORAGE_KEY_AUTH);
      }
    } catch (e) {}
  }

  function showAuthenticatedShell() {
    var body = document.body;
    if (!body) return;
    body.classList.add('admin-authenticated');
    var gate = document.getElementById('adminLoginGate');
    if (gate) gate.remove();
  }

  function showLoginGate() {
    var body = document.body;
    if (!body || !body.classList.contains('admin-body')) return;
    if (document.getElementById('adminLoginGate')) return;

    body.classList.remove('admin-authenticated');

    var gate = document.createElement('div');
    gate.id = 'adminLoginGate';
    gate.className = 'admin-login-gate';
    gate.innerHTML =
      '<div class="admin-login-card">' +
        '<p class="admin-login-label">Accesso riservato</p>' +
        '<h1 class="admin-login-title">Admin</h1>' +
        '<p class="admin-login-intro">Inserisci la password per accedere al pannello.</p>' +
        '<form id="formAdminLogin" class="admin-login-form" autocomplete="on">' +
          '<label for="adminLoginPassword">Password</label>' +
          '<input type="password" id="adminLoginPassword" name="password" required autocomplete="current-password" placeholder="Inserisci la password">' +
          '<button type="submit" class="btn btn-primary btn-block">Accedi</button>' +
        '</form>' +
        '<p id="adminLoginError" class="msg msg-error" role="alert" hidden>Password non valida. Riprova.</p>' +
        '<a href="../index.html" class="admin-login-back">Torna al sito</a>' +
      '</div>';

    body.insertBefore(gate, body.firstChild);

    var form = document.getElementById('formAdminLogin');
    var input = document.getElementById('adminLoginPassword');
    var error = document.getElementById('adminLoginError');

    if (form && input) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var password = (input.value || '').trim();
        var expected = getAdminPassword();

        if (!expected || password !== expected) {
          if (error) error.hidden = false;
          input.value = '';
          input.focus();
          return;
        }

        if (error) error.hidden = true;
        setAuthenticated(true);
        showAuthenticatedShell();
        initMobileNav();
        addLogoutControl();
      });

      global.setTimeout(function () {
        input.focus();
      }, 0);
    }
  }

  function logout() {
    setAuthenticated(false);
    global.location.reload();
  }

  function addLogoutControl() {
    var profile = document.querySelector('.admin-topbar-profile');
    if (!profile || profile.querySelector('.admin-logout-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-logout-btn';
    btn.textContent = 'Esci';
    btn.setAttribute('aria-label', 'Esci dall\'admin');
    btn.addEventListener('click', logout);
    profile.appendChild(btn);
  }

  function initMobileNav() {
    var body = document.body;
    if (!body || !body.classList.contains('admin-body')) return;
    if (document.querySelector('.admin-menu-toggle')) return;

    var sidebar = document.querySelector('.admin-sidebar');
    var topbar = document.querySelector('.admin-topbar');
    var brand = document.querySelector('.admin-sidebar-brand');
    if (!sidebar || !topbar) return;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-menu-toggle';
    toggle.setAttribute('aria-label', 'Apri menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'adminSidebar');
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>';
    topbar.insertBefore(toggle, topbar.firstChild);

    if (!sidebar.id) sidebar.id = 'adminSidebar';

    var backdrop = document.createElement('div');
    backdrop.className = 'admin-sidebar-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    body.insertBefore(backdrop, sidebar);

    var closeBtn = null;
    if (brand && !brand.querySelector('.admin-sidebar-close')) {
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'admin-sidebar-close';
      closeBtn.setAttribute('aria-label', 'Chiudi menu');
      closeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
      brand.appendChild(closeBtn);
    }

    function setOpen(open) {
      body.classList.toggle('admin-nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function close() {
      setOpen(false);
    }

    function open() {
      setOpen(true);
    }

    toggle.addEventListener('click', function () {
      if (body.classList.contains('admin-nav-open')) close();
      else open();
    });

    backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);

    sidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && body.classList.contains('admin-nav-open')) {
        close();
      }
    });

    var mq = global.matchMedia('(min-width: 769px)');
    function onBreakpoint(e) {
      if (e.matches) close();
    }
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onBreakpoint);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onBreakpoint);
    }
  }

  function init() {
    if (!document.body || !document.body.classList.contains('admin-body')) return;

    if (isAuthenticated()) {
      showAuthenticatedShell();
      initMobileNav();
      addLogoutControl();
      return;
    }

    showLoginGate();
  }

  global.PriscillaAdminAuth = {
    isAuthenticated: isAuthenticated,
    logout: logout
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
