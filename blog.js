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

  function excerptFromBody(body, maxLen) {
    var plain = String(body || '').replace(/\s+/g, ' ').trim();
    if (!plain) return '';
    if (plain.length <= maxLen) return plain;
    return plain.slice(0, maxLen).trim() + '…';
  }

  function applySeo(post, id) {
    var seo = window.PriscillaSeo;
    if (!seo) return;
    var title = (post && post.title) || 'Articolo';
    var description =
      (post && post.excerpt && String(post.excerpt).trim()) ||
      excerptFromBody(post && post.body, 160) ||
      seo.DEFAULT_DESCRIPTION;
    var path = '/blog.html?id=' + encodeURIComponent(id);
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
    var post = posts.find(function (p) {
      return p.id === id;
    });
    if (!post) {
      if (wrap) wrap.hidden = true;
      if (errorEl) errorEl.hidden = false;
    } else {
      if (errorEl) errorEl.hidden = true;
      if (wrap) wrap.hidden = false;
      applySeo(post, id);
      if (titleEl) titleEl.textContent = post.title || '';
      if (metaEl) metaEl.textContent = post.meta || '';
      if (bodyEl) bodyEl.innerHTML = textToHtml(post.body || '');
    }
  }
})();
