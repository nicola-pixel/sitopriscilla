(function (global) {
  'use strict';

  var STORAGE_KEY_BLOG = 'blog_articoli';
  var STORAGE_KEY_RICETTE = 'ricette';
  var STORAGE_KEY_CATEGORIE_RICETTE = 'ricette_categorie';
  var STORAGE_KEY_TAG_RICETTE = 'ricette_tag';
  var STORAGE_KEY_CATEGORIE_BLOG = 'blog_categorie';
  var STORAGE_KEY_TAG_BLOG = 'blog_tag';
  var STORAGE_KEY_MIGRATED = 'content_blob_migrated_v1';
  var API_URL = '/api/content';
  var remoteAvailable = null;
  var loadPromise = null;
  // Evita che un load/save in volo ripristini un contenuto appena eliminato.
  var deletedRecipeIds = Object.create(null);
  var deletedPostIds = Object.create(null);

  function getAdminPassword() {
    try {
      var stored = (global.localStorage.getItem('admin_password') || '').trim();
      if (stored) return stored;
    } catch (e) {}
    var config = global.PriscillaConfig || {};
    return (config.adminPassword || '').trim();
  }

  function readLocalArray(key) {
    try {
      var raw = global.localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeLocalArray(key, value) {
    global.localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  function getLocalSnapshot() {
    return {
      posts: readLocalArray(STORAGE_KEY_BLOG),
      recipes: readLocalArray(STORAGE_KEY_RICETTE),
      categories: readLocalArray(STORAGE_KEY_CATEGORIE_RICETTE),
      tags: readLocalArray(STORAGE_KEY_TAG_RICETTE),
      blogCategories: readLocalArray(STORAGE_KEY_CATEGORIE_BLOG),
      blogTags: readLocalArray(STORAGE_KEY_TAG_BLOG)
    };
  }

  function filterDeleted(list, tombstones) {
    return (list || []).filter(function (item) {
      return item && item.id && !tombstones[item.id];
    });
  }

  function pruneTombstones(tombstones, remoteList) {
    var remoteIds = Object.create(null);
    (remoteList || []).forEach(function (item) {
      if (item && item.id) remoteIds[item.id] = true;
    });
    Object.keys(tombstones).forEach(function (id) {
      if (!remoteIds[id]) delete tombstones[id];
    });
  }

  function applySnapshot(data) {
    if (!data) return getLocalSnapshot();
    // Prima escludi gli id eliminati in questa sessione, poi togli i tombstone
    // solo se il remote non li ha più (delete confermato).
    var posts = filterDeleted(data.posts || [], deletedPostIds);
    var recipes = filterDeleted(data.recipes || [], deletedRecipeIds);
    pruneTombstones(deletedPostIds, data.posts || []);
    pruneTombstones(deletedRecipeIds, data.recipes || []);
    writeLocalArray(STORAGE_KEY_BLOG, posts);
    writeLocalArray(STORAGE_KEY_RICETTE, recipes);
    writeLocalArray(STORAGE_KEY_CATEGORIE_RICETTE, data.categories || []);
    writeLocalArray(STORAGE_KEY_TAG_RICETTE, data.tags || []);
    writeLocalArray(STORAGE_KEY_CATEGORIE_BLOG, data.blogCategories || []);
    writeLocalArray(STORAGE_KEY_TAG_BLOG, data.blogTags || []);
    var applied = {
      posts: posts,
      recipes: recipes,
      categories: data.categories || [],
      tags: data.tags || [],
      blogCategories: data.blogCategories || [],
      blogTags: data.blogTags || [],
      source: data.source || 'local'
    };
    try {
      global.dispatchEvent(new CustomEvent('priscilla-content-changed', { detail: applied }));
      global.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
    } catch (e) {}
    return applied;
  }

  function notifyStorageListeners() {
    // Keep pages that listen to `storage` in sync within the same tab.
    try {
      global.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_BLOG }));
      global.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY_RICETTE }));
    } catch (e) {}
  }

  function fetchRemote() {
    return global.fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (res) {
      if (res.status === 503 || res.status === 404) {
        remoteAvailable = false;
        return null;
      }
      if (!res.ok) {
        remoteAvailable = false;
        return null;
      }
      return res.json().then(function (data) {
        if (!data || !data.ok) {
          remoteAvailable = false;
          return null;
        }
        remoteAvailable = true;
        return {
          posts: Array.isArray(data.posts) ? data.posts : [],
          recipes: Array.isArray(data.recipes) ? data.recipes : [],
          categories: Array.isArray(data.categories) ? data.categories : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
          blogCategories: Array.isArray(data.blogCategories) ? data.blogCategories : [],
          blogTags: Array.isArray(data.blogTags) ? data.blogTags : [],
          source: 'blob'
        };
      });
    }).catch(function () {
      remoteAvailable = false;
      return null;
    });
  }

  function postAction(action, payload) {
    var body = Object.assign({ action: action, password: getAdminPassword() }, payload || {});
    return global.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Admin-Password': getAdminPassword()
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 503 || res.status === 404) {
          remoteAvailable = false;
          var err503 = new Error('Salvataggio cloud non disponibile. Controlla Blob su Vercel.');
          err503.code = 'remote_unavailable';
          throw err503;
        }
        if (!res.ok || !data || !data.ok) {
          throw new Error((data && data.error) || 'Operazione non riuscita.');
        }
        remoteAvailable = true;
        return data;
      });
    });
  }

  function hasLocalContent(snapshot) {
    return !!(
      (snapshot.posts && snapshot.posts.length) ||
      (snapshot.recipes && snapshot.recipes.length)
    );
  }

  function migrateLocalIfNeeded(remote) {
    var migrated = false;
    try {
      migrated = global.localStorage.getItem(STORAGE_KEY_MIGRATED) === '1';
    } catch (e) {}

    var local = getLocalSnapshot();
    var remoteEmpty =
      !remote ||
      ((!remote.posts || !remote.posts.length) &&
        (!remote.recipes || !remote.recipes.length));

    if (migrated || !remoteEmpty || !hasLocalContent(local)) {
      return Promise.resolve(remote || local);
    }

    return postAction('replaceAll', {
      posts: local.posts,
      recipes: local.recipes,
      categories: local.categories,
      tags: local.tags,
      blogCategories: local.blogCategories,
      blogTags: local.blogTags
    }).then(function (data) {
      try {
        global.localStorage.setItem(STORAGE_KEY_MIGRATED, '1');
      } catch (e) {}
      return {
        posts: data.posts || local.posts,
        recipes: data.recipes || local.recipes,
        categories: data.categories || local.categories,
        tags: data.tags || local.tags,
        blogCategories: data.blogCategories || local.blogCategories,
        blogTags: data.blogTags || local.blogTags,
        source: 'blob'
      };
    }).catch(function () {
      return remote || local;
    });
  }

  function load(options) {
    var force = !!(options && options.force);
    if (loadPromise && !force) return loadPromise;

    loadPromise = fetchRemote()
      .then(function (remote) {
        if (!remote) {
          return applySnapshot(Object.assign({ source: 'local' }, getLocalSnapshot()));
        }
        return migrateLocalIfNeeded(remote).then(function (data) {
          var applied = applySnapshot(data);
          notifyStorageListeners();
          return applied;
        });
      })
      .catch(function () {
        return applySnapshot(Object.assign({ source: 'local' }, getLocalSnapshot()));
      })
      .then(function (data) {
        loadPromise = null;
        return data;
      });

    return loadPromise;
  }

  function upsertLocal(key, item, tombstones) {
    if (!item || !item.id) return readLocalArray(key);
    if (tombstones && tombstones[item.id]) {
      return readLocalArray(key);
    }
    var list = readLocalArray(key);
    var idx = list.findIndex(function (it) { return it && it.id === item.id; });
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    writeLocalArray(key, list);
    return list;
  }

  function removeLocal(key, id) {
    var list = readLocalArray(key).filter(function (it) { return !it || it.id !== id; });
    writeLocalArray(key, list);
    return list;
  }

  function savePost(post) {
    if (!post || !post.id) return Promise.reject(new Error('Articolo non valido.'));
    // Un sync in ritardo non deve ripubblicare un articolo appena eliminato.
    if (deletedPostIds[post.id]) {
      return postAction('deletePost', { id: post.id }).then(function () {
        return { post: null, source: 'blob', deleted: true };
      }).catch(function () {
        return { post: null, source: 'blob', deleted: true };
      });
    }
    upsertLocal(STORAGE_KEY_BLOG, post, deletedPostIds);
    notifyStorageListeners();
    return postAction('savePost', { post: post }).then(function (data) {
      if (deletedPostIds[post.id]) {
        removeLocal(STORAGE_KEY_BLOG, post.id);
        notifyStorageListeners();
        return postAction('deletePost', { id: post.id }).then(function () {
          return { post: null, source: 'blob', deleted: true };
        }).catch(function () {
          return { post: null, source: 'blob', deleted: true };
        });
      }
      var saved = data.post || post;
      upsertLocal(STORAGE_KEY_BLOG, saved, deletedPostIds);
      notifyStorageListeners();
      return { post: saved, source: 'blob' };
    });
  }

  function saveRecipe(recipe) {
    if (!recipe || !recipe.id) return Promise.reject(new Error('Ricetta non valida.'));
    // Un sync in ritardo non deve ripubblicare una ricetta appena eliminata.
    if (deletedRecipeIds[recipe.id]) {
      return postAction('deleteRecipe', { id: recipe.id }).then(function () {
        return { recipe: null, source: 'blob', deleted: true };
      }).catch(function () {
        return { recipe: null, source: 'blob', deleted: true };
      });
    }
    upsertLocal(STORAGE_KEY_RICETTE, recipe, deletedRecipeIds);
    try {
      global.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
    } catch (e) {}
    notifyStorageListeners();
    return postAction('saveRecipe', { recipe: recipe }).then(function (data) {
      if (deletedRecipeIds[recipe.id]) {
        removeLocal(STORAGE_KEY_RICETTE, recipe.id);
        try {
          global.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
        } catch (e3) {}
        notifyStorageListeners();
        return postAction('deleteRecipe', { id: recipe.id }).then(function () {
          return { recipe: null, source: 'blob', deleted: true };
        }).catch(function () {
          return { recipe: null, source: 'blob', deleted: true };
        });
      }
      var saved = data.recipe || recipe;
      upsertLocal(STORAGE_KEY_RICETTE, saved, deletedRecipeIds);
      try {
        global.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
      } catch (e2) {}
      notifyStorageListeners();
      return { recipe: saved, source: 'blob' };
    });
  }

  function deletePost(id) {
    if (!id) return Promise.reject(new Error('ID articolo mancante.'));
    deletedPostIds[id] = true;
    removeLocal(STORAGE_KEY_BLOG, id);
    notifyStorageListeners();
    return postAction('deletePost', { id: id }).then(function () {
      removeLocal(STORAGE_KEY_BLOG, id);
      notifyStorageListeners();
      return { id: id, source: 'blob' };
    }).catch(function (err) {
      delete deletedPostIds[id];
      throw err;
    });
  }

  function deleteRecipe(id) {
    if (!id) return Promise.reject(new Error('ID ricetta mancante.'));
    deletedRecipeIds[id] = true;
    removeLocal(STORAGE_KEY_RICETTE, id);
    try {
      global.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
    } catch (e) {}
    notifyStorageListeners();
    return postAction('deleteRecipe', { id: id }).then(function () {
      removeLocal(STORAGE_KEY_RICETTE, id);
      try {
        global.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
      } catch (e2) {}
      notifyStorageListeners();
      return { id: id, source: 'blob' };
    }).catch(function (err) {
      delete deletedRecipeIds[id];
      throw err;
    });
  }

  function setCategories(categories) {
    writeLocalArray(STORAGE_KEY_CATEGORIE_RICETTE, categories || []);
    return postAction('setCategories', { categories: categories || [] }).then(function (data) {
      writeLocalArray(STORAGE_KEY_CATEGORIE_RICETTE, data.categories || categories || []);
      return { categories: data.categories || categories || [], source: 'blob' };
    });
  }

  function setTags(tags) {
    writeLocalArray(STORAGE_KEY_TAG_RICETTE, tags || []);
    return postAction('setTags', { tags: tags || [] }).then(function (data) {
      writeLocalArray(STORAGE_KEY_TAG_RICETTE, data.tags || tags || []);
      return { tags: data.tags || tags || [], source: 'blob' };
    });
  }

  function setBlogCategories(blogCategories) {
    writeLocalArray(STORAGE_KEY_CATEGORIE_BLOG, blogCategories || []);
    return postAction('setBlogCategories', { blogCategories: blogCategories || [] }).then(function (data) {
      writeLocalArray(STORAGE_KEY_CATEGORIE_BLOG, data.blogCategories || blogCategories || []);
      return { blogCategories: data.blogCategories || blogCategories || [], source: 'blob' };
    });
  }

  function setBlogTags(blogTags) {
    writeLocalArray(STORAGE_KEY_TAG_BLOG, blogTags || []);
    return postAction('setBlogTags', { blogTags: blogTags || [] }).then(function (data) {
      writeLocalArray(STORAGE_KEY_TAG_BLOG, data.blogTags || blogTags || []);
      return { blogTags: data.blogTags || blogTags || [], source: 'blob' };
    });
  }

  function isRemoteAvailable() {
    return remoteAvailable;
  }

  global.PriscillaContent = {
    STORAGE_KEY_BLOG: STORAGE_KEY_BLOG,
    STORAGE_KEY_RICETTE: STORAGE_KEY_RICETTE,
    STORAGE_KEY_CATEGORIE_RICETTE: STORAGE_KEY_CATEGORIE_RICETTE,
    STORAGE_KEY_TAG_RICETTE: STORAGE_KEY_TAG_RICETTE,
    STORAGE_KEY_CATEGORIE_BLOG: STORAGE_KEY_CATEGORIE_BLOG,
    STORAGE_KEY_TAG_BLOG: STORAGE_KEY_TAG_BLOG,
    load: load,
    getLocalSnapshot: getLocalSnapshot,
    savePost: savePost,
    saveRecipe: saveRecipe,
    deletePost: deletePost,
    deleteRecipe: deleteRecipe,
    setCategories: setCategories,
    setTags: setTags,
    setBlogCategories: setBlogCategories,
    setBlogTags: setBlogTags,
    isRemoteAvailable: isRemoteAvailable
  };
})(typeof window !== 'undefined' ? window : globalThis);
