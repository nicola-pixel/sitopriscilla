(function () {
  'use strict';

  var STORAGE_KEY_BLOG = 'blog_articoli';

  function getBlogPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_BLOG);
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
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function textToHtml(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  var id = getParam('id');
  var wrap = document.getElementById('articleWrap');
  var errorEl = document.getElementById('articleError');
  var titleEl = document.getElementById('articleTitle');
  var metaEl = document.getElementById('articleMeta');
  var bodyEl = document.getElementById('articleBody');

  if (!id) {
    if (wrap) wrap.hidden = true;
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.querySelector('p').textContent = 'Nessun articolo selezionato.';
    }
  } else {
    var posts = getBlogPosts();
    var post = posts.find(function (p) { return p.id === id; });
    if (!post) {
      if (wrap) wrap.hidden = true;
      if (errorEl) errorEl.hidden = false;
    } else {
      if (errorEl) errorEl.hidden = true;
      if (wrap) wrap.hidden = false;
      document.title = (post.title || 'Articolo') + ' | Pristilla Castellani';
      if (titleEl) titleEl.textContent = post.title || '';
      if (metaEl) metaEl.textContent = post.meta || '';
      if (bodyEl) bodyEl.innerHTML = textToHtml(post.body || '');
    }
  }
})();
