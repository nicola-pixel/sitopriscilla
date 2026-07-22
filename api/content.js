'use strict';

/**
 * Blog e ricette condivisi tra browser via Vercel Blob.
 * Richiede BLOB_READ_WRITE_TOKEN (store Blob collegato al progetto Vercel).
 *
 *   content/posts/{id}.json
 *   content/recipes/{id}.json
 *   content/meta/categories.json      (ricette)
 *   content/meta/tags.json            (ricette)
 *   content/meta/blog-categories.json (blog)
 *   content/meta/blog-tags.json       (blog)
 *
 * GET  → elenco pubblico posts + recipes (+ categorie/tag ricette e blog)
 * POST → savePost / saveRecipe / deletePost / deleteRecipe /
 *        setCategories / setTags / setBlogCategories / setBlogTags /
 *        replaceAll — richiede password admin
 */

var POSTS_PREFIX = 'content/posts/';
var RECIPES_PREFIX = 'content/recipes/';
var CATEGORIES_PATH = 'content/meta/categories.json';
var TAGS_PATH = 'content/meta/tags.json';
var BLOG_CATEGORIES_PATH = 'content/meta/blog-categories.json';
var BLOG_TAGS_PATH = 'content/meta/blog-tags.json';
var MAX_JSON_BYTES = 4 * 1024 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
}

function blobConfigured() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

var settingsLib = require('../lib/site-settings');

function readAdminPassword(req, body) {
  var header = (req.headers['x-admin-password'] || '').toString().trim();
  if (header) return header;
  if (body && typeof body.password === 'string') return body.password.trim();
  return '';
}

async function isAuthorized(req, body, blob) {
  return settingsLib.isValidAdminPassword(blob, readAdminPassword(req, body));
}

function parseBody(req) {
  var body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  return body && typeof body === 'object' ? body : null;
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sanitizeId(id, prefix) {
  var clean = String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 80);
  if (!clean) return '';
  if (prefix && clean.indexOf(prefix) !== 0) {
    // keep existing ids like art_ / ric_
  }
  return clean;
}

function categoryFromLegacyMeta(meta) {
  var raw = String(meta || '').trim();
  if (!raw) return '';
  var cat = raw.split(/\s*[·|]\s*/)[0].trim();
  return cat || raw;
}

function normalizePost(post) {
  if (!post || typeof post !== 'object') return null;
  var id = sanitizeId(post.id);
  var title = String(post.title || '').trim();
  if (!id || !title) return null;
  var tags = [];
  if (Array.isArray(post.tags)) {
    post.tags.forEach(function (tag) {
      var t = String(tag || '').trim();
      if (t && tags.indexOf(t) < 0) tags.push(t);
    });
  }
  var category = String(post.category || '').trim();
  if (!category) {
    category = categoryFromLegacyMeta(post.meta);
  }
  var meta = String(post.meta || '').trim();
  if (!meta && category) meta = category;
  return {
    id: id,
    title: title,
    category: category,
    tags: tags,
    meta: meta,
    excerpt: String(post.excerpt || '').trim(),
    body: typeof post.body === 'string' ? post.body : '',
    blocks: Array.isArray(post.blocks) ? post.blocks : [],
    imageUrl: post.imageUrl || null,
    createdAt: Number(post.createdAt) || Date.now(),
    updatedAt: Number(post.updatedAt) || Date.now()
  };
}

function normalizeRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  var id = sanitizeId(recipe.id);
  var title = String(recipe.title || '').trim();
  if (!id || !title) return null;
  var tags = [];
  if (Array.isArray(recipe.tags)) {
    recipe.tags.forEach(function (tag) {
      var t = String(tag || '').trim();
      if (t && tags.indexOf(t) < 0) tags.push(t);
    });
  }
  var tag = String(recipe.tag || '').trim() || (tags[0] || '');
  if (tag && tags.indexOf(tag) < 0) tags.unshift(tag);
  return {
    id: id,
    title: title,
    category: String(recipe.category || '').trim(),
    tag: tag,
    tags: tags,
    excerpt: String(recipe.excerpt || '').trim(),
    body: typeof recipe.body === 'string' ? recipe.body : '',
    blocks: Array.isArray(recipe.blocks) ? recipe.blocks : [],
    imageUrl: recipe.imageUrl || null,
    createdAt: Number(recipe.createdAt) || Date.now(),
    updatedAt: Number(recipe.updatedAt) || Date.now()
  };
}

function normalizeStringList(list) {
  var out = [];
  if (!Array.isArray(list)) return out;
  list.forEach(function (value) {
    var name = String(value || '').trim();
    if (name && out.indexOf(name) < 0) out.push(name);
  });
  return out;
}

async function listAllBlobs(blob, prefix) {
  var out = [];
  var cursor;
  do {
    var page = await blob.list({ prefix: prefix, cursor: cursor, limit: 1000 });
    out = out.concat(page.blobs || []);
    cursor = page.hasMore ? page.cursor : null;
  } while (cursor);
  return out;
}

async function readJsonUrl(url) {
  try {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function listPosts(blob) {
  var entries = await listAllBlobs(blob, POSTS_PREFIX);
  var posts = [];
  for (var i = 0; i < entries.length; i++) {
    var parsed = await readJsonUrl(entries[i].url);
    var post = normalizePost(parsed);
    if (post) posts.push(post);
  }
  posts.sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return posts;
}

async function listRecipes(blob) {
  var entries = await listAllBlobs(blob, RECIPES_PREFIX);
  var recipes = [];
  for (var i = 0; i < entries.length; i++) {
    var parsed = await readJsonUrl(entries[i].url);
    var recipe = normalizeRecipe(parsed);
    if (recipe) recipes.push(recipe);
  }
  recipes.sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return recipes;
}

async function readStringList(blob, pathname) {
  try {
    var head = await blob.head(pathname);
    if (!head || !head.url) return [];
    var parsed = await readJsonUrl(head.url);
    if (Array.isArray(parsed)) return normalizeStringList(parsed);
    if (parsed && Array.isArray(parsed.items)) return normalizeStringList(parsed.items);
    return [];
  } catch (e) {
    return [];
  }
}

async function putJson(blob, pathname, data) {
  var payload = JSON.stringify(data);
  if (Buffer.byteLength(payload, 'utf8') > MAX_JSON_BYTES) {
    var err = new Error('Contenuto troppo grande (max 4 MB). Riduci le immagini.');
    err.code = 'too_large';
    throw err;
  }
  await blob.put(pathname, payload, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60
  });
}

async function deletePath(blob, pathname) {
  try {
    var head = await blob.head(pathname);
    if (head && head.url) {
      await blob.del(head.url);
      return;
    }
  } catch (e) {}
  try {
    await blob.del(pathname);
  } catch (e2) {}
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!blobConfigured()) {
    json(res, 503, {
      ok: false,
      available: false,
      error: 'Blob non configurato. Collega un Blob Store al progetto Vercel (BLOB_READ_WRITE_TOKEN).'
    });
    return;
  }

  var blob;
  try {
    blob = require('@vercel/blob');
  } catch (e) {
    json(res, 503, { ok: false, available: false, error: 'Dipendenza @vercel/blob mancante.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      var posts = await listPosts(blob);
      var recipes = await listRecipes(blob);
      var categories = await readStringList(blob, CATEGORIES_PATH);
      var tags = await readStringList(blob, TAGS_PATH);
      var blogCategories = await readStringList(blob, BLOG_CATEGORIES_PATH);
      var blogTags = await readStringList(blob, BLOG_TAGS_PATH);
      json(res, 200, {
        ok: true,
        available: true,
        source: 'blob',
        posts: posts,
        recipes: recipes,
        categories: categories,
        tags: tags,
        blogCategories: blogCategories,
        blogTags: blogTags
      });
      return;
    }

    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    var body = parseBody(req);
    if (!(await isAuthorized(req, body, blob))) {
      json(res, 401, { ok: false, error: 'Password admin non valida.' });
      return;
    }

    var action = body && body.action ? String(body.action) : '';

    if (action === 'savePost') {
      var post = normalizePost(body.post);
      if (!post) {
        json(res, 400, { ok: false, error: 'Articolo non valido.' });
        return;
      }
      post.updatedAt = Date.now();
      await putJson(blob, POSTS_PREFIX + post.id + '.json', post);
      json(res, 200, { ok: true, post: post });
      return;
    }

    if (action === 'saveRecipe') {
      var recipe = normalizeRecipe(body.recipe);
      if (!recipe) {
        json(res, 400, { ok: false, error: 'Ricetta non valida.' });
        return;
      }
      recipe.updatedAt = Date.now();
      await putJson(blob, RECIPES_PREFIX + recipe.id + '.json', recipe);
      json(res, 200, { ok: true, recipe: recipe });
      return;
    }

    if (action === 'deletePost') {
      var postId = sanitizeId(body && body.id);
      if (!postId) {
        json(res, 400, { ok: false, error: 'ID articolo mancante.' });
        return;
      }
      await deletePath(blob, POSTS_PREFIX + postId + '.json');
      json(res, 200, { ok: true, id: postId });
      return;
    }

    if (action === 'deleteRecipe') {
      var recipeId = sanitizeId(body && body.id);
      if (!recipeId) {
        json(res, 400, { ok: false, error: 'ID ricetta mancante.' });
        return;
      }
      await deletePath(blob, RECIPES_PREFIX + recipeId + '.json');
      json(res, 200, { ok: true, id: recipeId });
      return;
    }

    if (action === 'setCategories') {
      var categoriesPayload = normalizeStringList(body && body.categories);
      await putJson(blob, CATEGORIES_PATH, { items: categoriesPayload });
      json(res, 200, { ok: true, categories: categoriesPayload });
      return;
    }

    if (action === 'setTags') {
      var tagsPayload = normalizeStringList(body && body.tags);
      await putJson(blob, TAGS_PATH, { items: tagsPayload });
      json(res, 200, { ok: true, tags: tagsPayload });
      return;
    }

    if (action === 'setBlogCategories') {
      var blogCategoriesPayload = normalizeStringList(body && body.blogCategories);
      await putJson(blob, BLOG_CATEGORIES_PATH, { items: blogCategoriesPayload });
      json(res, 200, { ok: true, blogCategories: blogCategoriesPayload });
      return;
    }

    if (action === 'setBlogTags') {
      var blogTagsPayload = normalizeStringList(body && body.blogTags);
      await putJson(blob, BLOG_TAGS_PATH, { items: blogTagsPayload });
      json(res, 200, { ok: true, blogTags: blogTagsPayload });
      return;
    }

    if (action === 'replaceAll') {
      var nextPosts = Array.isArray(body.posts)
        ? body.posts.map(normalizePost).filter(Boolean)
        : [];
      var nextRecipes = Array.isArray(body.recipes)
        ? body.recipes.map(normalizeRecipe).filter(Boolean)
        : [];
      var nextCategories = normalizeStringList(body.categories);
      var nextTags = normalizeStringList(body.tags);
      var nextBlogCategories = normalizeStringList(body.blogCategories);
      var nextBlogTags = normalizeStringList(body.blogTags);

      var existingPosts = await listAllBlobs(blob, POSTS_PREFIX);
      var existingRecipes = await listAllBlobs(blob, RECIPES_PREFIX);
      var keepPost = {};
      var keepRecipe = {};
      var i;

      for (i = 0; i < nextPosts.length; i++) {
        nextPosts[i].updatedAt = Date.now();
        await putJson(blob, POSTS_PREFIX + nextPosts[i].id + '.json', nextPosts[i]);
        keepPost[nextPosts[i].id] = true;
      }
      for (i = 0; i < nextRecipes.length; i++) {
        nextRecipes[i].updatedAt = Date.now();
        await putJson(blob, RECIPES_PREFIX + nextRecipes[i].id + '.json', nextRecipes[i]);
        keepRecipe[nextRecipes[i].id] = true;
      }

      for (i = 0; i < existingPosts.length; i++) {
        var pPath = existingPosts[i].pathname || '';
        var pId = pPath.replace(POSTS_PREFIX, '').replace(/\.json$/, '');
        if (pId && !keepPost[pId]) {
          await deletePath(blob, POSTS_PREFIX + pId + '.json');
        }
      }
      for (i = 0; i < existingRecipes.length; i++) {
        var rPath = existingRecipes[i].pathname || '';
        var rId = rPath.replace(RECIPES_PREFIX, '').replace(/\.json$/, '');
        if (rId && !keepRecipe[rId]) {
          await deletePath(blob, RECIPES_PREFIX + rId + '.json');
        }
      }

      await putJson(blob, CATEGORIES_PATH, { items: nextCategories });
      await putJson(blob, TAGS_PATH, { items: nextTags });
      await putJson(blob, BLOG_CATEGORIES_PATH, { items: nextBlogCategories });
      await putJson(blob, BLOG_TAGS_PATH, { items: nextBlogTags });

      json(res, 200, {
        ok: true,
        posts: nextPosts,
        recipes: nextRecipes,
        categories: nextCategories,
        tags: nextTags,
        blogCategories: nextBlogCategories,
        blogTags: nextBlogTags
      });
      return;
    }

    json(res, 400, { ok: false, error: 'Azione non riconosciuta.' });
  } catch (err) {
    console.error('[content]', err);
    if (err && err.code === 'too_large') {
      json(res, 400, { ok: false, error: err.message });
      return;
    }
    json(res, 500, {
      ok: false,
      available: false,
      error: (err && err.message) || 'Errore content'
    });
  }
};
