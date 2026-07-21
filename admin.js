(function () {
  'use strict';

  var STORAGE_KEY_DOWNLOAD_KEY = 'download_secret';
  var STORAGE_KEY_CV = 'scarica_cv';
  var STORAGE_KEY_BLOG = 'blog_articoli';
  var STORAGE_KEY_RICETTE = 'ricette';
  var STORAGE_KEY_CATEGORIE_RICETTE = 'ricette_categorie';
  var STORAGE_KEY_CATEGORIE_NASCOSTE = 'ricette_categorie_nascoste';
  var STORAGE_KEY_TAG_RICETTE = 'ricette_tag';
  var STORAGE_KEY_CATEGORIE_BLOG = 'blog_categorie';
  var STORAGE_KEY_CATEGORIE_BLOG_NASCOSTE = 'blog_categorie_nascoste';
  var STORAGE_KEY_TAG_BLOG = 'blog_tag';
  var ARTICOLI_CATEGORIE = ['Nutrizione', 'Sport', 'Alimentazione', 'Salute', 'Approfondimenti'];

  var adminDashboard = document.getElementById('adminDashboard');
  var formChiaveDownload = document.getElementById('formChiaveDownload');
  var downloadKeyInput = document.getElementById('downloadKey');
  var msgChiave = document.getElementById('msgChiave');
  var formUploadPdf = document.getElementById('formUploadPdf');
  var pdfTitleInput = document.getElementById('pdfTitle');
  var pdfDescriptionInput = document.getElementById('pdfDescription');
  var pdfFileInput = document.getElementById('pdfFile');
  var pdfFolderSelect = document.getElementById('pdfFolder');
  var msgUpload = document.getElementById('msgUpload');
  var listaPdfAdmin = document.getElementById('listaPdfAdmin');
  var listaCartelleAdmin = document.getElementById('listaCartelleAdmin');
  var formCartellaMateriale = document.getElementById('formCartellaMateriale');
  var folderNameInput = document.getElementById('folderName');
  var msgCartella = document.getElementById('msgCartella');
  var btnCreaCartella = document.getElementById('btnCreaCartella');
  var materialeAdminItems = [];
  var materialeAdminFolders = [];
  var materialeStore = window.PriscillaMateriale || null;
  var contentStore = window.PriscillaContent || null;

  function getCv() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CV);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setCv(cv) {
    if (cv) {
      localStorage.setItem(STORAGE_KEY_CV, JSON.stringify(cv));
    } else {
      localStorage.removeItem(STORAGE_KEY_CV);
    }
  }

  function getBlogPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_BLOG);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setBlogPosts(posts) {
    localStorage.setItem(STORAGE_KEY_BLOG, JSON.stringify(posts));
  }

  function getRecipes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_RICETTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setRecipes(recipes) {
    localStorage.setItem(STORAGE_KEY_RICETTE, JSON.stringify(recipes));
    window.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
  }

  function persistPost(post) {
    var posts = getBlogPosts();
    var idx = posts.findIndex(function (item) { return item && item.id === post.id; });
    if (idx >= 0) posts[idx] = post;
    else posts.push(post);
    setBlogPosts(posts);
    if (contentStore && typeof contentStore.savePost === 'function') {
      return contentStore.savePost(post);
    }
    return Promise.resolve({ post: post, source: 'local' });
  }

  function persistRecipe(recipe) {
    var recipes = getRecipes();
    var idx = recipes.findIndex(function (item) { return item && item.id === recipe.id; });
    if (idx >= 0) recipes[idx] = recipe;
    else recipes.push(recipe);
    setRecipes(recipes);
    if (contentStore && typeof contentStore.saveRecipe === 'function') {
      return contentStore.saveRecipe(recipe);
    }
    return Promise.resolve({ recipe: recipe, source: 'local' });
  }

  function removePersistedPost(id) {
    setBlogPosts(getBlogPosts().filter(function (item) { return !item || item.id !== id; }));
    if (contentStore && typeof contentStore.deletePost === 'function') {
      return contentStore.deletePost(id);
    }
    return Promise.resolve({ id: id, source: 'local' });
  }

  function removePersistedRecipe(id) {
    if (contentStore && typeof contentStore.deleteRecipe === 'function') {
      return contentStore.deleteRecipe(id);
    }
    setRecipes(getRecipes().filter(function (item) { return !item || item.id !== id; }));
    return Promise.resolve({ id: id, source: 'local' });
  }

  function syncRecipesToCloud(recipes) {
    setRecipes(recipes);
    if (!contentStore || typeof contentStore.saveRecipe !== 'function') {
      return Promise.resolve();
    }
    return Promise.all(
      (recipes || []).map(function (recipe) {
        return contentStore.saveRecipe(recipe).catch(function (err) {
          console.warn('Sync ricetta', recipe && recipe.id, err);
        });
      })
    );
  }

  function syncPostsToCloud(posts) {
    setBlogPosts(posts);
    if (!contentStore || typeof contentStore.savePost !== 'function') {
      return Promise.resolve();
    }
    return Promise.all(
      (posts || []).map(function (post) {
        return contentStore.savePost(post).catch(function (err) {
          console.warn('Sync articolo', post && post.id, err);
        });
      })
    );
  }

  function getPostCategory(post) {
    if (!post) return '';
    var cat = String(post.category || '').trim();
    if (cat) return cat;
    var raw = String(post.meta || '').trim();
    if (!raw) return '';
    return raw.split(/\s*[·|]\s*/)[0].trim() || raw;
  }

  function getPostTags(post) {
    if (!post) return [];
    if (Array.isArray(post.tags)) {
      return post.tags
        .map(function (t) { return String(t || '').trim(); })
        .filter(Boolean);
    }
    return [];
  }

  function getCustomBlogCategories() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CATEGORIE_BLOG);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setCustomBlogCategories(arr) {
    localStorage.setItem(STORAGE_KEY_CATEGORIE_BLOG, JSON.stringify(arr || []));
    if (contentStore && typeof contentStore.setBlogCategories === 'function') {
      contentStore.setBlogCategories(arr || []).catch(function (err) {
        console.warn('Sync categorie blog', err);
      });
    }
  }

  function getHiddenBlogCategories() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CATEGORIE_BLOG_NASCOSTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setHiddenBlogCategories(arr) {
    localStorage.setItem(STORAGE_KEY_CATEGORIE_BLOG_NASCOSTE, JSON.stringify(arr || []));
  }

  function isBaseBlogCategory(name) {
    name = (name || '').trim();
    if (!name) return false;
    return ARTICOLI_CATEGORIE.indexOf(name) >= 0;
  }

  function getAllBlogCategories() {
    var hidden = getHiddenBlogCategories();
    var combined = [];
    function pushCat(name) {
      name = (name || '').trim();
      if (!name || combined.indexOf(name) >= 0) return;
      if (hidden.indexOf(name) >= 0) return;
      combined.push(name);
    }
    ARTICOLI_CATEGORIE.forEach(pushCat);
    getCustomBlogCategories().forEach(pushCat);
    getBlogPosts().forEach(function (post) {
      pushCat(getPostCategory(post));
    });
    return combined;
  }

  function getCustomBlogTags() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_TAG_BLOG);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setCustomBlogTags(arr) {
    localStorage.setItem(STORAGE_KEY_TAG_BLOG, JSON.stringify(arr || []));
    if (contentStore && typeof contentStore.setBlogTags === 'function') {
      contentStore.setBlogTags(arr || []).catch(function (err) {
        console.warn('Sync tag blog', err);
      });
    }
  }

  function getAllBlogTags() {
    var tags = [];
    function pushTag(name) {
      name = (name || '').trim();
      if (name && tags.indexOf(name) < 0) tags.push(name);
    }
    getCustomBlogTags().forEach(pushTag);
    getBlogPosts().forEach(function (post) {
      getPostTags(post).forEach(pushTag);
    });
    return tags;
  }

  function getCustomRecipeCategories() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CATEGORIE_RICETTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setCustomRecipeCategories(arr) {
    localStorage.setItem(STORAGE_KEY_CATEGORIE_RICETTE, JSON.stringify(arr || []));
    if (contentStore && typeof contentStore.setCategories === 'function') {
      contentStore.setCategories(arr || []).catch(function (err) {
        console.warn('Sync categorie ricette', err);
      });
    }
  }

  function getHiddenRecipeCategories() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_CATEGORIE_NASCOSTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setHiddenRecipeCategories(arr) {
    localStorage.setItem(STORAGE_KEY_CATEGORIE_NASCOSTE, JSON.stringify(arr || []));
  }

  function isBaseRecipeCategory(name) {
    name = (name || '').trim();
    if (!name) return false;
    return typeof RICETTE_CATEGORIE !== 'undefined' &&
      RICETTE_CATEGORIE &&
      RICETTE_CATEGORIE.indexOf(name) >= 0;
  }

  function getAllRecipeCategories() {
    var hidden = getHiddenRecipeCategories();
    var combined = [];
    function pushCat(name) {
      name = (name || '').trim();
      if (!name || combined.indexOf(name) >= 0) return;
      if (hidden.indexOf(name) >= 0) return;
      combined.push(name);
    }
    var base = (RICETTE_CATEGORIE && RICETTE_CATEGORIE.slice) ? RICETTE_CATEGORIE : [];
    base.forEach(pushCat);
    getCustomRecipeCategories().forEach(pushCat);
    getRecipes().forEach(function (recipe) {
      pushCat(getRecipeCategory(recipe));
    });
    return combined;
  }

  function getCustomRecipeTags() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_TAG_RICETTE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setCustomRecipeTags(arr) {
    localStorage.setItem(STORAGE_KEY_TAG_RICETTE, JSON.stringify(arr || []));
    if (contentStore && typeof contentStore.setTags === 'function') {
      contentStore.setTags(arr || []).catch(function (err) {
        console.warn('Sync tag ricette', err);
      });
    }
  }

  function getAllRecipeTags() {
    var tags = [];
    function pushTag(name) {
      name = (name || '').trim();
      if (name && tags.indexOf(name) < 0) tags.push(name);
    }
    getCustomRecipeTags().forEach(pushTag);
    getRecipes().forEach(function (recipe) {
      getRecipeTags(recipe).forEach(pushTag);
    });
    return tags;
  }

  function paintDashboardContent() {
    if (downloadKeyInput) {
      downloadKeyInput.value = localStorage.getItem(STORAGE_KEY_DOWNLOAD_KEY) || '';
    }
    if (listaPdfAdmin) renderListaPdfAdmin();
    updateCvStatus();
    renderListaArticoliAdmin();
    renderListaRicetteAdmin();
    if (typeof refreshSelectsCategorieBlog === 'function') refreshSelectsCategorieBlog();
    if (typeof renderListaCategorieBlog === 'function') renderListaCategorieBlog();
    if (typeof refreshSelectsTagBlog === 'function') refreshSelectsTagBlog();
    if (typeof renderListaTagBlog === 'function') renderListaTagBlog();
    if (typeof refreshSelectsCategorie === 'function') refreshSelectsCategorie();
    if (typeof renderListaCategorieRicette === 'function') renderListaCategorieRicette();
    if (typeof refreshSelectsTag === 'function') refreshSelectsTag();
    if (typeof renderListaTagRicette === 'function') renderListaTagRicette();
    renderListaSediAdmin();
    renderCvContentAdmin();
  }

  function showDashboard() {
    paintDashboardContent();
    if (contentStore && typeof contentStore.load === 'function') {
      contentStore.load({ force: true }).then(function () {
        paintDashboardContent();
      }).catch(function () {
        paintDashboardContent();
      });
    }
  }

  function updateCvStatus() {
    var statusEl = document.getElementById('cvStatus');
    var btnRemove = document.getElementById('btnRemoveCv');
    if (!statusEl) return;
    var cv = getCv();
    if (cv) {
      statusEl.textContent = 'CV caricato: ' + (cv.title || cv.filename || 'CV') + '.pdf';
      statusEl.classList.add('cv-status--ok');
      if (btnRemove) btnRemove.style.display = '';
    } else {
      statusEl.textContent = 'Nessun CV caricato.';
      statusEl.classList.remove('cv-status--ok');
      if (btnRemove) btnRemove.style.display = 'none';
    }
  }

  var btnRemoveCv = document.getElementById('btnRemoveCv');
  if (btnRemoveCv) {
    btnRemoveCv.addEventListener('click', function () {
      setCv(null);
      updateCvStatus();
      msgCv = document.getElementById('msgCv');
      if (msgCv) {
        msgCv.textContent = 'CV rimosso.';
        msgCv.classList.remove('msg-error');
        msgCv.classList.add('msg-ok');
        msgCv.hidden = false;
        setTimeout(function () { msgCv.hidden = true; }, 3000);
      }
    });
  }

  function refreshFolderSelect(preferredId) {
    if (!pdfFolderSelect) return;
    var current = preferredId || pdfFolderSelect.value || '';
    pdfFolderSelect.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = materialeAdminFolders.length
      ? 'Seleziona una cartella…'
      : 'Crea prima una cartella…';
    pdfFolderSelect.appendChild(placeholder);
    materialeAdminFolders.forEach(function (folder) {
      if (!folder || !folder.id) return;
      var opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = folder.name || 'Cartella';
      pdfFolderSelect.appendChild(opt);
    });
    if (current && Array.prototype.some.call(pdfFolderSelect.options, function (o) { return o.value === current; })) {
      pdfFolderSelect.value = current;
    } else {
      pdfFolderSelect.value = '';
    }
    pdfFolderSelect.disabled = materialeAdminFolders.length === 0;
  }

  var editMaterialeModal = document.getElementById('editMaterialeModal');
  var formEditMateriale = document.getElementById('formEditMateriale');
  var editMaterialeIdInput = document.getElementById('editMaterialeId');
  var editMaterialeIndexInput = document.getElementById('editMaterialeIndex');
  var editMaterialeFolderSelect = document.getElementById('editMaterialeFolder');
  var editMaterialeTitleInput = document.getElementById('editMaterialeTitleInput');
  var editMaterialeDescriptionInput = document.getElementById('editMaterialeDescription');
  var msgEditMateriale = document.getElementById('msgEditMateriale');
  var btnSalvaMateriale = document.getElementById('btnSalvaMateriale');

  function refreshEditFolderSelect(preferredId) {
    if (!editMaterialeFolderSelect) return;
    var current = preferredId || editMaterialeFolderSelect.value || '';
    editMaterialeFolderSelect.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = materialeAdminFolders.length
      ? 'Seleziona una cartella…'
      : 'Nessuna cartella disponibile';
    editMaterialeFolderSelect.appendChild(placeholder);
    materialeAdminFolders.forEach(function (folder) {
      if (!folder || !folder.id) return;
      var opt = document.createElement('option');
      opt.value = folder.id;
      opt.textContent = folder.name || 'Cartella';
      editMaterialeFolderSelect.appendChild(opt);
    });
    if (current && Array.prototype.some.call(editMaterialeFolderSelect.options, function (o) {
      return o.value === current;
    })) {
      editMaterialeFolderSelect.value = current;
    } else {
      editMaterialeFolderSelect.value = '';
    }
  }

  function closeEditMaterialeModal() {
    if (!editMaterialeModal) return;
    editMaterialeModal.hidden = true;
    document.body.classList.remove('admin-confirm-open');
    if (msgEditMateriale) {
      msgEditMateriale.hidden = true;
      msgEditMateriale.textContent = '';
    }
  }

  function openEditMaterialeModal(item, index) {
    if (!editMaterialeModal || !item) return;
    if (editMaterialeIdInput) editMaterialeIdInput.value = item.id || '';
    if (editMaterialeIndexInput) editMaterialeIndexInput.value = String(index);
    if (editMaterialeTitleInput) editMaterialeTitleInput.value = item.title || '';
    if (editMaterialeDescriptionInput) {
      editMaterialeDescriptionInput.value = item.description || '';
    }
    refreshEditFolderSelect(item.folderId || '');
    if (msgEditMateriale) {
      msgEditMateriale.hidden = true;
      msgEditMateriale.textContent = '';
    }
    editMaterialeModal.hidden = false;
    document.body.classList.add('admin-confirm-open');
    if (editMaterialeTitleInput && typeof editMaterialeTitleInput.focus === 'function') {
      editMaterialeTitleInput.focus();
      editMaterialeTitleInput.select();
    }
  }

  function renderListaCartelleAdmin() {
    if (!listaCartelleAdmin) return;
    listaCartelleAdmin.innerHTML = '';
    if (!materialeAdminFolders.length) {
      listaCartelleAdmin.innerHTML = '<li class="empty">Nessuna cartella. Creane una per iniziare a caricare i file.</li>';
      return;
    }
    materialeAdminFolders.forEach(function (folder) {
      var count = materialeAdminItems.filter(function (it) {
        return it && String(it.folderId || '') === String(folder.id);
      }).length;
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="cartella-admin-info">' +
          '<span class="cartella-admin-name">' + escapeHtml(folder.name || 'Cartella') + '</span>' +
          '<span class="cartella-admin-meta">' + count + (count === 1 ? ' file' : ' file') + '</span>' +
        '</span>' +
        '<button type="button" class="btn-remove" data-folder-id="' + escapeHtml(folder.id) + '" aria-label="Rimuovi cartella">Rimuovi</button>';
      listaCartelleAdmin.appendChild(li);
    });
    listaCartelleAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var folderId = btn.getAttribute('data-folder-id');
        var folder = materialeAdminFolders.find(function (f) { return f && f.id === folderId; });
        if (!materialeStore || !folder) return;
        btn.disabled = true;
        materialeStore.deleteFolder(folder).then(function () {
          return renderListaPdfAdmin();
        }).catch(function (err) {
          btn.disabled = false;
          if (msgCartella) {
            msgCartella.textContent = (err && err.message) || 'Impossibile rimuovere la cartella.';
            msgCartella.classList.add('msg-error');
            msgCartella.classList.remove('msg-ok');
            msgCartella.hidden = false;
          }
        });
      });
    });
  }

  function renderListaPdfAdminFromItems(pdfs, folders) {
    if (!listaPdfAdmin) return;
    materialeAdminItems = Array.isArray(pdfs) ? pdfs : [];
    if (Array.isArray(folders)) materialeAdminFolders = folders;
    refreshFolderSelect();
    renderListaCartelleAdmin();
    listaPdfAdmin.innerHTML = '';

    if (!materialeAdminFolders.length && materialeAdminItems.length === 0) {
      listaPdfAdmin.innerHTML = '<p class="empty">Nessun file caricato. Crea una cartella e carica i documenti.</p>';
      return;
    }

    var groups = [];
    var used = {};
    materialeAdminFolders.forEach(function (folder) {
      if (!folder || !folder.id) return;
      var files = materialeAdminItems.filter(function (it) {
        return it && String(it.folderId || '') === String(folder.id);
      });
      files.forEach(function (it) {
        if (it && it.id) used[String(it.id)] = true;
      });
      groups.push({ folder: folder, files: files });
    });
    var orphanFiles = materialeAdminItems.filter(function (it) {
      return it && it.id && !used[String(it.id)];
    });
    if (orphanFiles.length) {
      groups.push({
        folder: { id: '', name: 'Senza cartella (carica di nuovo in una cartella)' },
        files: orphanFiles
      });
    }

    if (!groups.length) {
      listaPdfAdmin.innerHTML = '<p class="empty">Nessun file caricato.</p>';
      return;
    }

    groups.forEach(function (group) {
      var section = document.createElement('section');
      section.className = 'materiale-folder-group';
      var heading = document.createElement('h3');
      heading.className = 'materiale-folder-title';
      heading.textContent = group.folder.name || 'Cartella';
      section.appendChild(heading);

      var ul = document.createElement('ul');
      ul.className = 'lista-pdf-admin';
      if (!group.files.length) {
        ul.innerHTML = '<li class="empty">Cartella vuota.</li>';
      } else {
        group.files.forEach(function (item) {
          var globalIndex = materialeAdminItems.indexOf(item);
          var li = document.createElement('li');
          var desc = (item.description || '').trim();
          li.innerHTML =
            '<div class="pdf-meta">' +
              '<span class="pdf-title">' + escapeHtml(item.title || 'Senza titolo') + '</span>' +
              (desc ? '<span class="pdf-description">' + escapeHtml(desc) + '</span>' : '') +
            '</div>' +
            '<span class="pdf-actions">' +
              '<button type="button" class="btn-edit" data-index="' + globalIndex + '" aria-label="Modifica">Modifica</button>' +
              '<button type="button" class="btn-remove" data-index="' + globalIndex + '" aria-label="Rimuovi">Rimuovi</button>' +
            '</span>';
          ul.appendChild(li);
        });
      }
      section.appendChild(ul);
      listaPdfAdmin.appendChild(section);
    });

    listaPdfAdmin.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var item = materialeAdminItems[idx];
        if (!item) return;
        openEditMaterialeModal(item, idx);
      });
    });

    listaPdfAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var item = materialeAdminItems[idx];
        if (!materialeStore || !item) return;
        btn.disabled = true;
        materialeStore.remove(item, idx).then(function () {
          return renderListaPdfAdmin();
        }).catch(function (err) {
          btn.disabled = false;
          if (msgUpload) {
            msgUpload.textContent = (err && err.message) || 'Impossibile rimuovere il file.';
            msgUpload.classList.add('msg-error');
            msgUpload.classList.remove('msg-ok');
            msgUpload.hidden = false;
          }
        });
      });
    });
  }

  function updateMaterialeStorageHint(result) {
    var hint = document.getElementById('materialeStorageHint');
    if (!hint) return;
    if (result && result.source === 'blob') {
      hint.textContent = 'I file sono salvati sul server e visibili a tutti i clienti nell\'area Scarica.';
      hint.hidden = false;
    } else if (result && result.source === 'mixed') {
      hint.textContent = 'Alcuni file sono sul server; altri solo in questo browser. I clienti vedono solo i file sul server.';
      hint.hidden = false;
    } else {
      hint.textContent = 'Attenzione: senza Vercel Blob i file restano solo in questo browser e i clienti non li vedranno. Collega un Blob Store al progetto Vercel.';
      hint.hidden = false;
    }
  }

  function renderListaPdfAdmin(options) {
    options = options || {};
    var keepIfEmpty = Array.isArray(options.keepIfEmpty) ? options.keepIfEmpty : null;
    var keepFolders = Array.isArray(options.keepFolders) ? options.keepFolders : null;
    if (!listaPdfAdmin) return Promise.resolve();
    if (!materialeStore) {
      renderListaPdfAdminFromItems(keepIfEmpty || [], keepFolders || materialeAdminFolders);
      return Promise.resolve();
    }
    return materialeStore.list().then(function (result) {
      var items = result && result.items ? result.items : [];
      var folders = result && result.folders ? result.folders : [];
      if (items.length === 0 && keepIfEmpty && keepIfEmpty.length) {
        items = keepIfEmpty;
      } else if (keepIfEmpty && keepIfEmpty.length) {
        var ids = {};
        items.forEach(function (it) {
          if (it && it.id) ids[String(it.id)] = true;
        });
        keepIfEmpty.forEach(function (it) {
          if (it && it.id && !ids[String(it.id)]) items.push(it);
        });
      }
      if (folders.length === 0 && keepFolders && keepFolders.length) {
        folders = keepFolders;
      } else if (keepFolders && keepFolders.length) {
        var fids = {};
        folders.forEach(function (it) {
          if (it && it.id) fids[String(it.id)] = true;
        });
        keepFolders.forEach(function (it) {
          if (it && it.id && !fids[String(it.id)]) folders.push(it);
        });
      }
      renderListaPdfAdminFromItems(items, folders);
      updateMaterialeStorageHint(result);
    }).catch(function () {
      renderListaPdfAdminFromItems(keepIfEmpty || [], keepFolders || materialeAdminFolders);
    });
  }

  var COVER_IMG_MAX_EDGE = 1400;
  var COVER_IMG_QUALITY = 0.78;
  var COVER_IMG_MAX_BYTES = 5 * 1024 * 1024;

  function compressCoverImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) {
        reject(new Error('Seleziona un\'immagine (JPG, PNG o WebP).'));
        return;
      }
      if (file.size > COVER_IMG_MAX_BYTES) {
        reject(new Error('Immagine troppo grande (max 5 MB).'));
        return;
      }
      var objectUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error('Impossibile leggere l\'immagine.'));
          return;
        }
        var scale = Math.min(1, COVER_IMG_MAX_EDGE / w, COVER_IMG_MAX_EDGE / h);
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Compressione non supportata dal browser.'));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          resolve(canvas.toDataURL('image/jpeg', COVER_IMG_QUALITY));
        } catch (err) {
          reject(new Error('Impossibile elaborare l\'immagine.'));
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Impossibile leggere l\'immagine.'));
      };
      img.src = objectUrl;
    });
  }

  function bindCoverUpload(opts) {
    var upload = opts.upload;
    var fileInput = opts.fileInput;
    var empty = opts.empty;
    var preview = opts.preview;
    var img = opts.img;
    var status = opts.status;
    var hiddenInput = opts.hiddenInput;
    var btnChange = opts.btnChange;
    var btnRemove = opts.btnRemove;
    var changeBtnId = opts.changeBtnId;
    var removeBtnId = opts.removeBtnId;

    function setStatus(text, isError) {
      if (!status) return;
      if (!text) {
        status.hidden = true;
        status.textContent = '';
        status.classList.remove('recipe-cover-status--error');
        return;
      }
      status.hidden = false;
      status.textContent = text;
      status.classList.toggle('recipe-cover-status--error', !!isError);
    }

    function setPreview(url) {
      var hasImage = !!(url && String(url).trim());
      if (hiddenInput) hiddenInput.value = hasImage ? url : '';
      if (upload) upload.classList.toggle('recipe-cover-upload--has-image', hasImage);
      if (empty) empty.hidden = hasImage;
      if (preview) preview.hidden = !hasImage;
      if (img) {
        if (hasImage) img.src = url;
        else img.removeAttribute('src');
      }
    }

    function clearCover() {
      if (fileInput) fileInput.value = '';
      setPreview('');
      setStatus('');
    }

    function handleFile(file) {
      if (!file) return;
      if (upload) upload.classList.add('recipe-cover-upload--busy');
      setStatus('Ottimizzazione in corso…');
      compressCoverImage(file)
        .then(function (dataUrl) {
          setPreview(dataUrl);
          setStatus('Foto pronta');
          setTimeout(function () { setStatus(''); }, 1600);
        })
        .catch(function (err) {
          setStatus(err && err.message ? err.message : 'Errore caricamento', true);
        })
        .then(function () {
          if (upload) upload.classList.remove('recipe-cover-upload--busy');
          if (fileInput) fileInput.value = '';
        });
    }

    if (upload && fileInput) {
      upload.addEventListener('click', function (e) {
        if ((changeBtnId && e.target.closest('#' + changeBtnId)) ||
            (removeBtnId && e.target.closest('#' + removeBtnId))) return;
        if (upload.classList.contains('recipe-cover-upload--has-image')) return;
        fileInput.click();
      });
      upload.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!upload.classList.contains('recipe-cover-upload--has-image')) {
            fileInput.click();
          }
        }
      });
      upload.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        upload.classList.add('recipe-cover-upload--dragover');
      });
      upload.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        upload.classList.remove('recipe-cover-upload--dragover');
      });
      upload.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        upload.classList.remove('recipe-cover-upload--dragover');
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files[0]) handleFile(files[0]);
      });
      fileInput.addEventListener('change', function () {
        var files = fileInput.files;
        if (files && files[0]) handleFile(files[0]);
      });
    }
    if (btnChange && fileInput) {
      btnChange.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });
    }
    if (btnRemove) {
      btnRemove.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        clearCover();
      });
    }

    return { setPreview: setPreview, clear: clearCover };
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
  }

  function newBlockId() {
    return 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function createTextBlock(content) {
    return { id: newBlockId(), type: 'text', content: content || '' };
  }

  function createImageBlock(src, alt) {
    return {
      id: newBlockId(),
      type: 'image',
      src: src || '',
      layout: 'center',
      alt: alt || ''
    };
  }

  function createIngredientsBlock(items, title) {
    return {
      id: newBlockId(),
      type: 'ingredients',
      title: title || 'Ingredienti',
      items: Array.isArray(items) && items.length ? items.slice() : ['']
    };
  }

  function createStepsBlock(items, title) {
    return {
      id: newBlockId(),
      type: 'steps',
      title: title || 'Procedimento',
      items: Array.isArray(items) && items.length ? items.slice() : ['']
    };
  }

  function normalizeListItems(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map(function (item) {
        return String(item == null ? '' : item).trim();
      })
      .filter(Boolean);
  }

  function normalizeContentBlocks(item) {
    if (item && Array.isArray(item.blocks) && item.blocks.length) {
      return item.blocks.map(function (b) {
        if (b && b.type === 'image') {
          return {
            id: b.id || newBlockId(),
            type: 'image',
            src: b.src || '',
            layout: 'center',
            alt: b.alt || ''
          };
        }
        if (b && b.type === 'ingredients') {
          var ingItems = normalizeListItems(b.items);
          return {
            id: b.id || newBlockId(),
            type: 'ingredients',
            title: (b.title || 'Ingredienti').trim() || 'Ingredienti',
            items: ingItems.length ? ingItems : ['']
          };
        }
        if (b && b.type === 'steps') {
          var stepItems = normalizeListItems(b.items);
          return {
            id: b.id || newBlockId(),
            type: 'steps',
            title: (b.title || 'Procedimento').trim() || 'Procedimento',
            items: stepItems.length ? stepItems : ['']
          };
        }
        return {
          id: (b && b.id) || newBlockId(),
          type: 'text',
          content: (b && b.content) || ''
        };
      });
    }
    var body = (item && item.body) || '';
    return [createTextBlock(body)];
  }

  function blocksToPlainBody(blocks) {
    return (blocks || [])
      .map(function (b) {
        if (!b) return '';
        if (b.type === 'text') return String(b.content || '').trim();
        if (b.type === 'ingredients' || b.type === 'steps') {
          return normalizeListItems(b.items).join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  function listBlockToPreviewHtml(block) {
    if (!block) return '';
    var items = normalizeListItems(block.items);
    if (!items.length) {
      return (
        '<div class="content-block content-block--' +
        escapeHtml(block.type) +
        '"><p class="recipe-preview-placeholder">' +
        (block.type === 'steps' ? 'Aggiungi i passaggi…' : 'Aggiungi gli ingredienti…') +
        '</p></div>'
      );
    }
    if (window.PriscillaContentFormat && window.PriscillaContentFormat.listBlockToHtml) {
      return window.PriscillaContentFormat.listBlockToHtml(block);
    }
    var isSteps = block.type === 'steps';
    var tag = isSteps ? 'ol' : 'ul';
    var listClass = isSteps ? 'prose-steps' : 'prose-list';
    var title = (block.title || (isSteps ? 'Procedimento' : 'Ingredienti')).trim();
    return (
      '<section class="content-block content-block--' +
      escapeHtml(block.type) +
      '">' +
      '<h2 class="prose-heading prose-heading--' +
      (isSteps ? 'steps' : 'ingredients') +
      '">' +
      escapeHtml(title) +
      '</h2>' +
      '<' +
      tag +
      ' class="' +
      listClass +
      '">' +
      items
        .map(function (item) {
          return '<li>' + escapeHtml(item) + '</li>';
        })
        .join('') +
      '</' +
      tag +
      '></section>'
    );
  }

  function textBlockToHtml(text) {
    if (window.PriscillaContentFormat) {
      return window.PriscillaContentFormat.textToHtml(text);
    }
    if (!text || !String(text).trim()) return '';
    return String(text)
      .split(/\n\s*\n/)
      .map(function (p) {
        return '<p>' + escapeHtml(p.trim()).replace(/\n/g, '<br>') + '</p>';
      })
      .filter(function (p) { return p !== '<p></p>'; })
      .join('');
  }

  function blocksToPreviewHtml(blocks) {
    if (!blocks || !blocks.length) {
      return '<p class="recipe-preview-placeholder">Aggiungi testo o immagini per vedere l’anteprima…</p>';
    }
    var html = blocks.map(function (block) {
      if (!block) return '';
      if (block.type === 'image') {
        if (!block.src) {
          return '<figure class="content-block content-block--image content-block--image-center content-block--empty"><span>Immagine da caricare</span></figure>';
        }
        return (
          '<figure class="content-block content-block--image content-block--image-center"><img src="' +
          String(block.src).replace(/"/g, '&quot;') +
          '" alt="' +
          escapeHtml(block.alt || '') +
          '"></figure>'
        );
      }
      if (block.type === 'ingredients' || block.type === 'steps') {
        return listBlockToPreviewHtml(block);
      }
      var textHtml = textBlockToHtml(block.content || '');
      if (!textHtml) {
        return '<div class="content-block content-block--text"><p class="recipe-preview-placeholder">Scrivi qui il testo…</p></div>';
      }
      return '<div class="content-block content-block--text">' + textHtml + '</div>';
    }).join('');
    return html || '<p class="recipe-preview-placeholder">Aggiungi testo o immagini per vedere l’anteprima…</p>';
  }

  function createBlockComposer(opts) {
    var blocksEl = opts.blocksEl;
    var msgEl = opts.msgEl;
    var textPlaceholder = opts.textPlaceholder || 'Scrivi qui…';
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var blocks = [createTextBlock('')];

    function findBlockIndex(id) {
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].id === id) return i;
      }
      return -1;
    }

    function getBlocks() {
      return blocks;
    }

    function setBlocks(next) {
      blocks = Array.isArray(next) && next.length ? next : [createTextBlock('')];
      render();
    }

    function reset() {
      setBlocks([createTextBlock('')]);
    }

    function serialize() {
      return (blocks || []).map(function (b) {
        if (b.type === 'image') {
          return {
            id: b.id,
            type: 'image',
            src: b.src || '',
            layout: 'center',
            alt: (b.alt || '').trim()
          };
        }
        if (b.type === 'ingredients') {
          return {
            id: b.id,
            type: 'ingredients',
            title: (b.title || 'Ingredienti').trim() || 'Ingredienti',
            items: normalizeListItems(b.items)
          };
        }
        if (b.type === 'steps') {
          return {
            id: b.id,
            type: 'steps',
            title: (b.title || 'Procedimento').trim() || 'Procedimento',
            items: normalizeListItems(b.items)
          };
        }
        return {
          id: b.id,
          type: 'text',
          content: b.content || ''
        };
      }).filter(function (b) {
        if (b.type === 'image') return !!(b.src && String(b.src).trim());
        if (b.type === 'ingredients' || b.type === 'steps') {
          return normalizeListItems(b.items).length > 0;
        }
        return !!(b.content && String(b.content).trim());
      });
    }

    function blockTypeLabel(type) {
      if (type === 'image') return 'Immagine';
      if (type === 'ingredients') return 'Ingredienti';
      if (type === 'steps') return 'Procedimento';
      return 'Testo';
    }

    function renderListEditor(block, el) {
      var isSteps = block.type === 'steps';
      var wrap = document.createElement('div');
      wrap.className = 'content-block-list-editor';

      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'content-block-list-title';
      titleInput.value = block.title || (isSteps ? 'Procedimento' : 'Ingredienti');
      titleInput.placeholder = isSteps ? 'Titolo sezione (es. Procedimento)' : 'Titolo sezione (es. Ingredienti)';
      titleInput.addEventListener('input', function () {
        var idx = findBlockIndex(block.id);
        if (idx < 0) return;
        blocks[idx].title = titleInput.value;
        onChange();
      });
      wrap.appendChild(titleInput);

      var list = document.createElement('div');
      list.className = 'content-block-list-items';
      list.setAttribute('role', 'list');

      var items = Array.isArray(block.items) && block.items.length ? block.items.slice() : [''];

      function currentItems() {
        var idx = findBlockIndex(block.id);
        if (idx < 0) return items.slice();
        var live = blocks[idx].items;
        return Array.isArray(live) && live.length ? live.slice() : [''];
      }

      function syncItems(nextItems) {
        var idx = findBlockIndex(block.id);
        if (idx < 0) return;
        blocks[idx].items = nextItems.length ? nextItems : [''];
        render();
      }

      items.forEach(function (item, itemIndex) {
        var row = document.createElement('div');
        row.className = 'content-block-list-row';
        row.setAttribute('role', 'listitem');

        var marker = document.createElement('span');
        marker.className = 'content-block-list-marker';
        marker.textContent = isSteps ? String(itemIndex + 1) : '•';
        row.appendChild(marker);

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'content-block-list-input';
        input.value = item || '';
        input.placeholder = isSteps
          ? 'es. Cuoci il salmone 3-4 minuti per lato'
          : 'es. 2 filetti di salmone';
        input.addEventListener('input', function () {
          var idx = findBlockIndex(block.id);
          if (idx < 0) return;
          if (!Array.isArray(blocks[idx].items)) blocks[idx].items = [''];
          blocks[idx].items[itemIndex] = input.value;
          onChange();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var next = currentItems();
            next.splice(itemIndex + 1, 0, '');
            syncItems(next);
            requestAnimationFrame(function () {
              var rows = blocksEl.querySelectorAll(
                '[data-id="' + block.id + '"] .content-block-list-input'
              );
              if (rows[itemIndex + 1]) rows[itemIndex + 1].focus();
            });
          }
        });
        row.appendChild(input);

        var rowActions = document.createElement('div');
        rowActions.className = 'content-block-list-row-actions';

        var btnItemUp = document.createElement('button');
        btnItemUp.type = 'button';
        btnItemUp.className = 'content-block-action';
        btnItemUp.setAttribute('aria-label', 'Sposta su');
        btnItemUp.textContent = '↑';
        btnItemUp.disabled = itemIndex === 0;
        btnItemUp.addEventListener('click', function () {
          if (itemIndex <= 0) return;
          var next = currentItems();
          var tmp = next[itemIndex - 1];
          next[itemIndex - 1] = next[itemIndex];
          next[itemIndex] = tmp;
          syncItems(next);
        });

        var btnItemDown = document.createElement('button');
        btnItemDown.type = 'button';
        btnItemDown.className = 'content-block-action';
        btnItemDown.setAttribute('aria-label', 'Sposta giù');
        btnItemDown.textContent = '↓';
        btnItemDown.disabled = itemIndex === items.length - 1;
        btnItemDown.addEventListener('click', function () {
          var next = currentItems();
          if (itemIndex >= next.length - 1) return;
          var tmp = next[itemIndex + 1];
          next[itemIndex + 1] = next[itemIndex];
          next[itemIndex] = tmp;
          syncItems(next);
        });

        var btnItemRemove = document.createElement('button');
        btnItemRemove.type = 'button';
        btnItemRemove.className = 'content-block-action content-block-action--danger';
        btnItemRemove.setAttribute('aria-label', 'Rimuovi voce');
        btnItemRemove.textContent = '✕';
        btnItemRemove.addEventListener('click', function () {
          var next = currentItems();
          next.splice(itemIndex, 1);
          syncItems(next.length ? next : ['']);
        });

        rowActions.appendChild(btnItemUp);
        rowActions.appendChild(btnItemDown);
        rowActions.appendChild(btnItemRemove);
        row.appendChild(rowActions);
        list.appendChild(row);
      });

      wrap.appendChild(list);

      var btnAddItem = document.createElement('button');
      btnAddItem.type = 'button';
      btnAddItem.className = 'btn btn-sm btn-outline content-block-list-add';
      btnAddItem.textContent = isSteps ? '+ Aggiungi passaggio' : '+ Aggiungi ingrediente';
      btnAddItem.addEventListener('click', function () {
        var next = currentItems();
        next.push('');
        syncItems(next);
        requestAnimationFrame(function () {
          var rows = blocksEl.querySelectorAll(
            '[data-id="' + block.id + '"] .content-block-list-input'
          );
          if (rows.length) rows[rows.length - 1].focus();
        });
      });
      wrap.appendChild(btnAddItem);
      el.appendChild(wrap);
    }

    function render() {
      if (!blocksEl) return;
      if (!blocks.length) blocks = [createTextBlock('')];
      blocksEl.innerHTML = '';
      blocks.forEach(function (block, index) {
        var el = document.createElement('div');
        el.className = 'content-block-editor content-block-editor--' + block.type;
        el.setAttribute('data-id', block.id);

        var toolbar = document.createElement('div');
        toolbar.className = 'content-block-toolbar';

        var typeLabel = document.createElement('span');
        typeLabel.className = 'content-block-type';
        typeLabel.textContent = blockTypeLabel(block.type);
        toolbar.appendChild(typeLabel);

        var actions = document.createElement('div');
        actions.className = 'content-block-actions';

        var btnUp = document.createElement('button');
        btnUp.type = 'button';
        btnUp.className = 'content-block-action';
        btnUp.setAttribute('aria-label', 'Sposta su');
        btnUp.textContent = '↑';
        btnUp.disabled = index === 0;
        btnUp.addEventListener('click', function () {
          var idx = findBlockIndex(block.id);
          if (idx <= 0) return;
          var tmp = blocks[idx - 1];
          blocks[idx - 1] = blocks[idx];
          blocks[idx] = tmp;
          render();
        });

        var btnDown = document.createElement('button');
        btnDown.type = 'button';
        btnDown.className = 'content-block-action';
        btnDown.setAttribute('aria-label', 'Sposta giù');
        btnDown.textContent = '↓';
        btnDown.disabled = index === blocks.length - 1;
        btnDown.addEventListener('click', function () {
          var idx = findBlockIndex(block.id);
          if (idx < 0 || idx >= blocks.length - 1) return;
          var tmp = blocks[idx + 1];
          blocks[idx + 1] = blocks[idx];
          blocks[idx] = tmp;
          render();
        });

        var btnRemove = document.createElement('button');
        btnRemove.type = 'button';
        btnRemove.className = 'content-block-action content-block-action--danger';
        btnRemove.setAttribute('aria-label', 'Rimuovi blocco');
        btnRemove.textContent = '✕';
        btnRemove.addEventListener('click', function () {
          var idx = findBlockIndex(block.id);
          if (idx < 0) return;
          blocks.splice(idx, 1);
          if (!blocks.length) blocks = [createTextBlock('')];
          render();
        });

        actions.appendChild(btnUp);
        actions.appendChild(btnDown);
        actions.appendChild(btnRemove);
        toolbar.appendChild(actions);
        el.appendChild(toolbar);

        if (block.type === 'text') {
          var ta = document.createElement('textarea');
          ta.className = 'content-block-textarea';
          ta.rows = 5;
          ta.placeholder = textPlaceholder;
          ta.value = block.content || '';
          ta.addEventListener('input', function () {
            var idx = findBlockIndex(block.id);
            if (idx < 0) return;
            blocks[idx].content = ta.value;
            onChange();
          });
          el.appendChild(ta);
        } else if (block.type === 'ingredients' || block.type === 'steps') {
          renderListEditor(block, el);
        } else {
          var media = document.createElement('div');
          media.className = 'content-block-media' + (block.src ? ' content-block-media--has-image' : '');

          if (block.src) {
            var img = document.createElement('img');
            img.src = block.src;
            img.alt = block.alt || '';
            media.appendChild(img);
          } else {
            var empty = document.createElement('div');
            empty.className = 'content-block-media-empty';
            empty.innerHTML = '<span>Trascina o scegli un’immagine</span>';
            media.appendChild(empty);
          }

          var fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif';
          fileInput.hidden = true;

          var mediaActions = document.createElement('div');
          mediaActions.className = 'content-block-media-actions';
          var btnPick = document.createElement('button');
          btnPick.type = 'button';
          btnPick.className = 'btn btn-sm btn-outline';
          btnPick.textContent = block.src ? 'Cambia immagine' : 'Carica immagine';
          btnPick.addEventListener('click', function () { fileInput.click(); });
          mediaActions.appendChild(btnPick);
          if (block.src) {
            var btnClearImg = document.createElement('button');
            btnClearImg.type = 'button';
            btnClearImg.className = 'btn btn-sm btn-outline';
            btnClearImg.textContent = 'Rimuovi foto';
            btnClearImg.addEventListener('click', function () {
              var idx = findBlockIndex(block.id);
              if (idx < 0) return;
              blocks[idx].src = '';
              render();
            });
            mediaActions.appendChild(btnClearImg);
          }

          function applyImageFile(file) {
            if (!file) return;
            media.classList.add('content-block-media--busy');
            compressCoverImage(file)
              .then(function (dataUrl) {
                var idx = findBlockIndex(block.id);
                if (idx < 0) return;
                blocks[idx].src = dataUrl;
                render();
              })
              .catch(function (err) {
                if (msgEl) {
                  msgEl.textContent = err && err.message ? err.message : 'Errore caricamento immagine';
                  msgEl.classList.add('msg-error');
                  msgEl.classList.remove('msg-ok');
                  msgEl.hidden = false;
                }
              })
              .then(function () {
                media.classList.remove('content-block-media--busy');
                fileInput.value = '';
              });
          }

          fileInput.addEventListener('change', function () {
            if (fileInput.files && fileInput.files[0]) applyImageFile(fileInput.files[0]);
          });
          media.addEventListener('dragover', function (e) {
            e.preventDefault();
            media.classList.add('content-block-media--dragover');
          });
          media.addEventListener('dragleave', function () {
            media.classList.remove('content-block-media--dragover');
          });
          media.addEventListener('drop', function (e) {
            e.preventDefault();
            media.classList.remove('content-block-media--dragover');
            var files = e.dataTransfer && e.dataTransfer.files;
            if (files && files[0]) applyImageFile(files[0]);
          });

          el.appendChild(media);
          el.appendChild(fileInput);
          el.appendChild(mediaActions);

          var altInput = document.createElement('input');
          altInput.type = 'text';
          altInput.className = 'content-block-alt';
          altInput.placeholder = 'Testo alternativo (opzionale)';
          altInput.value = block.alt || '';
          altInput.addEventListener('input', function () {
            var idx = findBlockIndex(block.id);
            if (idx < 0) return;
            blocks[idx].alt = altInput.value;
            onChange();
          });
          el.appendChild(altInput);
        }

        blocksEl.appendChild(el);
      });
      onChange();
    }

    if (opts.btnAddText) {
      opts.btnAddText.addEventListener('click', function () {
        blocks.push(createTextBlock(''));
        render();
      });
    }
    if (opts.btnAddImage) {
      opts.btnAddImage.addEventListener('click', function () {
        blocks.push(createImageBlock('', ''));
        render();
      });
    }
    if (opts.btnAddIngredients) {
      opts.btnAddIngredients.addEventListener('click', function () {
        blocks.push(createIngredientsBlock(['']));
        render();
      });
    }
    if (opts.btnAddSteps) {
      opts.btnAddSteps.addEventListener('click', function () {
        blocks.push(createStepsBlock(['']));
        render();
      });
    }

    return {
      getBlocks: getBlocks,
      setBlocks: setBlocks,
      reset: reset,
      render: render,
      serialize: serialize
    };
  }

  /* ========== Blog ========== */
  var listaArticoliAdmin = document.getElementById('listaArticoliAdmin');
  var formArticolo = document.getElementById('formArticolo');
  var articoloIdInput = document.getElementById('articoloId');
  var articoloTitoloInput = document.getElementById('articoloTitolo');
  var articoloMetaInput = document.getElementById('articoloMeta');
  var articoloEstrattoInput = document.getElementById('articoloEstratto');
  var articoloImmagineInput = document.getElementById('articoloImmagine');
  var articoloImmagineFileInput = document.getElementById('articoloImmagineFile');
  var msgArticolo = document.getElementById('msgArticolo');
  var btnAnnullaArticolo = document.getElementById('btnAnnullaArticolo');
  var articlePreviewMeta = document.getElementById('articlePreviewMeta');
  var articlePreviewTitle = document.getElementById('articlePreviewTitle');
  var articlePreviewExcerpt = document.getElementById('articlePreviewExcerpt');
  var articlePreviewBody = document.getElementById('articlePreviewBody');
  var articlePreviewCover = document.getElementById('articlePreviewCover');
  var articlePreviewCoverImg = document.getElementById('articlePreviewCoverImg');
  var articleComposer = null;
  var articleCover = bindCoverUpload({
    upload: document.getElementById('articleCoverUpload'),
    fileInput: articoloImmagineFileInput,
    empty: document.getElementById('articleCoverEmpty'),
    preview: document.getElementById('articleCoverPreview'),
    img: document.getElementById('articleCoverImg'),
    status: document.getElementById('articleCoverStatus'),
    hiddenInput: articoloImmagineInput,
    btnChange: document.getElementById('btnCambiaArticleCover'),
    btnRemove: document.getElementById('btnRimuoviArticleCover'),
    changeBtnId: 'btnCambiaArticleCover',
    removeBtnId: 'btnRimuoviArticleCover'
  });

  function updateArticlePreview() {
    if (!articlePreviewBody || !articleComposer) return;
    var title = articoloTitoloInput ? (articoloTitoloInput.value || '').trim() : '';
    var meta = articoloMetaInput ? (articoloMetaInput.value || '').trim() : '';
    var excerpt = articoloEstrattoInput ? (articoloEstrattoInput.value || '').trim() : '';
    var coverUrl = articoloImmagineInput ? (articoloImmagineInput.value || '').trim() : '';

    if (articlePreviewMeta) articlePreviewMeta.textContent = meta || 'Categoria';
    if (articlePreviewTitle) articlePreviewTitle.textContent = title || 'Titolo dell’articolo';
    if (articlePreviewExcerpt) {
      articlePreviewExcerpt.textContent = excerpt;
      articlePreviewExcerpt.hidden = !excerpt;
    }
    if (articlePreviewCover && articlePreviewCoverImg) {
      if (coverUrl) {
        articlePreviewCoverImg.src = coverUrl;
        articlePreviewCoverImg.alt = title || '';
        articlePreviewCover.hidden = false;
      } else {
        articlePreviewCover.hidden = true;
        articlePreviewCoverImg.removeAttribute('src');
      }
    }
    articlePreviewBody.innerHTML = blocksToPreviewHtml(articleComposer.getBlocks());
  }

  if (document.getElementById('articleBlocks')) {
    articleComposer = createBlockComposer({
      blocksEl: document.getElementById('articleBlocks'),
      btnAddText: document.getElementById('btnAddArticleTextBlock'),
      btnAddImage: document.getElementById('btnAddArticleImageBlock'),
      msgEl: msgArticolo,
      textPlaceholder: 'Scrivi il testo dell’articolo…',
      onChange: updateArticlePreview
    });
  }

  function resetArticoloFormFields() {
    if (articoloIdInput) articoloIdInput.value = '';
    if (articoloTitoloInput) articoloTitoloInput.value = '';
    if (articoloMetaInput) articoloMetaInput.value = '';
    if (articoloEstrattoInput) articoloEstrattoInput.value = '';
    if (articleComposer) articleComposer.reset();
    articleCover.clear();
    if (btnAnnullaArticolo) btnAnnullaArticolo.style.display = 'none';
    if (msgArticolo) msgArticolo.hidden = true;
    updateArticlePreview();
  }

  function renderListaArticoliAdmin() {
    if (!listaArticoliAdmin) return;
    var posts = getBlogPosts();
    listaArticoliAdmin.innerHTML = '';
    if (posts.length === 0) {
      listaArticoliAdmin.innerHTML = '<li class="empty">Nessun articolo pubblicato.</li>';
      return;
    }
    posts.forEach(function (post) {
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="articolo-title">' + escapeHtml(post.title || 'Senza titolo') + '</span> ' +
        '<span class="articolo-actions">' +
        '<button type="button" class="btn-edit" data-id="' + escapeHtml(post.id) + '" aria-label="Modifica">Modifica</button> ' +
        '<button type="button" class="btn-remove" data-id="' + escapeHtml(post.id) + '" aria-label="Rimuovi">Rimuovi</button>' +
        '</span>';
      listaArticoliAdmin.appendChild(li);
    });
    listaArticoliAdmin.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var posts = getBlogPosts();
        var post = posts.find(function (p) { return p.id === id; });
        if (post) {
          articoloIdInput.value = post.id;
          articoloTitoloInput.value = post.title || '';
          articoloMetaInput.value = post.meta || '';
          articoloEstrattoInput.value = post.excerpt || '';
          if (articleComposer) articleComposer.setBlocks(normalizeContentBlocks(post));
          articleCover.setPreview(post.imageUrl || '');
          btnAnnullaArticolo.style.display = 'inline-block';
          msgArticolo.hidden = true;
          if (formArticolo && typeof formArticolo.scrollIntoView === 'function') {
            formArticolo.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
    listaArticoliAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        removePersistedPost(id).then(function () {
          renderListaArticoliAdmin();
          if (articoloIdInput.value === id) {
            resetArticoloFormFields();
          }
        }).catch(function (err) {
          console.error('Eliminazione articolo', err);
          alert((err && err.message) || 'Impossibile eliminare l’articolo dal cloud.');
          renderListaArticoliAdmin();
        });
      });
    });
  }

  if (formChiaveDownload) {
    formChiaveDownload.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = (downloadKeyInput.value || '').trim();
      localStorage.setItem(STORAGE_KEY_DOWNLOAD_KEY, key);
      msgChiave.classList.remove('msg-error');
      msgChiave.classList.add('msg-ok');
      msgChiave.textContent = 'Chiave salvata.';
      msgChiave.hidden = false;
      setTimeout(function () { msgChiave.hidden = true; }, 3000);
    });
  }

  if (formArticolo) {
    formArticolo.addEventListener('submit', function (e) {
      e.preventDefault();
      msgArticolo.hidden = true;
      var id = (articoloIdInput.value || '').trim();
      var title = (articoloTitoloInput.value || '').trim();
      if (!title) {
        msgArticolo.textContent = 'Inserisci un titolo.';
        msgArticolo.classList.add('msg-error');
        msgArticolo.hidden = false;
        return;
      }
      var meta = (articoloMetaInput.value || '').trim();
      var excerpt = (articoloEstrattoInput.value || '').trim();
      var blocks = articleComposer ? articleComposer.serialize() : [];
      var body = blocksToPlainBody(blocks);
      var imageUrl = (articoloImmagineInput.value || '').trim();
      var posts = getBlogPosts();
      var existing = id ? posts.find(function (p) { return p.id === id; }) : null;
      var wasEdit = !!id;
      var post = {
        id: id || 'art_' + Date.now(),
        title: title,
        meta: meta,
        excerpt: excerpt,
        body: body,
        blocks: blocks,
        imageUrl: imageUrl || null,
        createdAt: existing ? existing.createdAt : Date.now()
      };
      persistPost(post).then(function (result) {
        renderListaArticoliAdmin();
        var articlePath = '/blog?id=' + encodeURIComponent(post.id);
        msgArticolo.innerHTML = (wasEdit
          ? 'Articolo aggiornato. <a href="' + articlePath + '">Apri pagina</a>'
          : 'Articolo pubblicato. <a href="' + articlePath + '">Apri pagina</a>') +
          (result && result.source === 'blob' ? ' Visibile a tutti.' : '');
        msgArticolo.classList.remove('msg-error');
        msgArticolo.classList.add('msg-ok');
        msgArticolo.hidden = false;
        setTimeout(function () { msgArticolo.hidden = true; }, 6000);
        resetArticoloFormFields();
      }).catch(function (err) {
        msgArticolo.textContent = 'Errore: ' + ((err && err.message) || 'impossibile pubblicare sul cloud');
        msgArticolo.classList.add('msg-error');
        msgArticolo.classList.remove('msg-ok');
        msgArticolo.hidden = false;
        console.error('Errore pubblicazione articolo', err);
      });
    });
  }

  if (btnAnnullaArticolo) {
    btnAnnullaArticolo.addEventListener('click', function () {
      resetArticoloFormFields();
    });
  }

  if (articoloTitoloInput) articoloTitoloInput.addEventListener('input', updateArticlePreview);
  if (articoloMetaInput) articoloMetaInput.addEventListener('input', updateArticlePreview);
  if (articoloEstrattoInput) articoloEstrattoInput.addEventListener('input', updateArticlePreview);
  var _setArticleCoverPreview = articleCover.setPreview;
  var _clearArticleCover = articleCover.clear;
  articleCover.setPreview = function (url) {
    _setArticleCoverPreview(url);
    updateArticlePreview();
  };
  articleCover.clear = function () {
    _clearArticleCover();
    updateArticlePreview();
  };

  if (articleComposer) {
    articleComposer.render();
  }

  /* ========== Ricette ========== */
  var RICETTE_CATEGORIE = ['Pre-workout', 'Post-workout', 'Snack', 'Colazione', 'Pranzo', 'Cena', 'Primi', 'Secondi', 'Dessert', 'Bevande', 'Altro'];
  var listaRicetteAdmin = document.getElementById('listaRicetteAdmin');
  var formRicetta = document.getElementById('formRicetta');
  var ricettaIdInput = document.getElementById('ricettaId');
  var ricettaTitoloInput = document.getElementById('ricettaTitolo');
  var ricettaCategoriaInput = document.getElementById('ricettaCategoria');
  var ricettaCategoriaMulti = document.getElementById('ricettaCategoriaMulti');
  var ricettaCategoriaTrigger = document.getElementById('ricettaCategoriaTrigger');
  var ricettaCategoriaDropdown = document.getElementById('ricettaCategoriaDropdown');
  var ricettaCategoriaOptions = document.getElementById('ricettaCategoriaOptions');
  var ricettaCategoriaLabelText = document.getElementById('ricettaCategoriaLabelText');
  var ricettaCategoriaCreateInput = document.getElementById('ricettaCategoriaCreateInput');
  var ricettaCategoriaCreateBtn = document.getElementById('ricettaCategoriaCreateBtn');
  var ricettaCategoriaAltroInput = document.getElementById('ricettaCategoriaAltro');
  var ricettaCategoriaAltroWrap = document.getElementById('ricettaCategoriaAltroWrap');
  var ricettaTagMulti = document.getElementById('ricettaTagMulti');
  var ricettaTagTrigger = document.getElementById('ricettaTagTrigger');
  var ricettaTagDropdown = document.getElementById('ricettaTagDropdown');
  var ricettaTagOptions = document.getElementById('ricettaTagOptions');
  var ricettaTagLabelText = document.getElementById('ricettaTagLabelText');
  var ricettaTagCreateInput = document.getElementById('ricettaTagCreateInput');
  var ricettaTagCreateBtn = document.getElementById('ricettaTagCreateBtn');
  var ricettaSelectedTags = [];
  var ricettaEstrattoInput = document.getElementById('ricettaEstratto');
  var recipePreviewMeta = document.getElementById('recipePreviewMeta');
  var recipePreviewTitle = document.getElementById('recipePreviewTitle');
  var recipePreviewExcerpt = document.getElementById('recipePreviewExcerpt');
  var recipePreviewBody = document.getElementById('recipePreviewBody');
  var recipePreviewCover = document.getElementById('recipePreviewCover');
  var recipePreviewCoverImg = document.getElementById('recipePreviewCoverImg');
  var ricettaImmagineInput = document.getElementById('ricettaImmagine');
  var ricettaImmagineFileInput = document.getElementById('ricettaImmagineFile');
  var msgRicetta = document.getElementById('msgRicetta');
  var btnSalvaRicetta = document.getElementById('btnSalvaRicetta');
  var btnAnnullaRicetta = document.getElementById('btnAnnullaRicetta');
  var ricettaPublishing = false;
  var filtroCategoriaEl = document.getElementById('filtroCategoria');
  var filtroTagEl = document.getElementById('filtroTag');
  var filtroRicercaEl = document.getElementById('filtroRicerca');
  var nuovaCategoriaInput = document.getElementById('nuovaCategoriaInput');
  var btnAggiungiCategoria = document.getElementById('btnAggiungiCategoria');
  var listaCategorieRicette = document.getElementById('listaCategorieRicette');
  var nuovoTagInput = document.getElementById('nuovoTagInput');
  var btnAggiungiTag = document.getElementById('btnAggiungiTag');
  var listaTagRicette = document.getElementById('listaTagRicette');
  var recipeComposer = null;
  var recipeCover = bindCoverUpload({
    upload: document.getElementById('recipeCoverUpload'),
    fileInput: ricettaImmagineFileInput,
    empty: document.getElementById('recipeCoverEmpty'),
    preview: document.getElementById('recipeCoverPreview'),
    img: document.getElementById('recipeCoverImg'),
    status: document.getElementById('recipeCoverStatus'),
    hiddenInput: ricettaImmagineInput,
    btnChange: document.getElementById('btnCambiaCover'),
    btnRemove: document.getElementById('btnRimuoviCover'),
    changeBtnId: 'btnCambiaCover',
    removeBtnId: 'btnRimuoviCover'
  });

  function setRecipeCoverPreview(url) {
    recipeCover.setPreview(url);
  }

  function clearRecipeCover() {
    recipeCover.clear();
  }

  function normalizeRecipeBlocks(recipe) {
    return normalizeContentBlocks(recipe);
  }

  function getSelectedRecipeTags() {
    return ricettaSelectedTags.slice();
  }

  function setSelectedRecipeTags(tags) {
    ricettaSelectedTags = (tags || [])
      .map(function (t) { return String(t || '').trim(); })
      .filter(Boolean);
    syncTagMultiSelectUI();
  }

  function syncTagMultiSelectUI() {
    if (ricettaTagLabelText) {
      if (ricettaSelectedTags.length === 0) {
        ricettaTagLabelText.textContent = 'Scegli tag';
      } else if (ricettaSelectedTags.length === 1) {
        ricettaTagLabelText.textContent = ricettaSelectedTags[0];
      } else {
        ricettaTagLabelText.textContent = ricettaSelectedTags.length + ' tag selezionati';
      }
    }
    var optionsRoot = ricettaTagOptions || ricettaTagDropdown;
    if (optionsRoot) {
      optionsRoot.querySelectorAll('.multi-select-option input[type="checkbox"]').forEach(function (cb) {
        cb.checked = ricettaSelectedTags.indexOf(cb.value) >= 0;
      });
    }
  }

  function syncCategoriaSelectUI() {
    var value = ricettaCategoriaInput ? (ricettaCategoriaInput.value || '').trim() : '';
    if (ricettaCategoriaLabelText) {
      ricettaCategoriaLabelText.textContent = value || 'Scegli categoria';
    }
    if (ricettaCategoriaOptions) {
      ricettaCategoriaOptions.querySelectorAll('.multi-select-option').forEach(function (btn) {
        btn.classList.toggle('is-selected', btn.getAttribute('data-value') === value);
      });
    }
  }

  function setSelectedRecipeCategory(cat) {
    var value = (cat || '').trim();
    if (ricettaCategoriaInput) ricettaCategoriaInput.value = value;
    syncCategoriaSelectUI();
    if (ricettaCategoriaAltroWrap) {
      if (value === 'Altro') ricettaCategoriaAltroWrap.removeAttribute('hidden');
      else ricettaCategoriaAltroWrap.setAttribute('hidden', '');
    }
    if (value !== 'Altro' && ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
  }

  function setTagDropdownOpen(open) {
    if (!ricettaTagDropdown || !ricettaTagTrigger) return;
    if (open) {
      if (ricettaCategoriaDropdown) ricettaCategoriaDropdown.hidden = true;
      if (ricettaCategoriaTrigger) ricettaCategoriaTrigger.setAttribute('aria-expanded', 'false');
      if (ricettaCategoriaMulti) ricettaCategoriaMulti.classList.remove('is-open');
    }
    ricettaTagDropdown.hidden = !open;
    ricettaTagTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (ricettaTagMulti) ricettaTagMulti.classList.toggle('is-open', open);
  }

  function setCategoriaDropdownOpen(open) {
    if (!ricettaCategoriaDropdown || !ricettaCategoriaTrigger) return;
    if (open) {
      if (ricettaTagDropdown) ricettaTagDropdown.hidden = true;
      if (ricettaTagTrigger) ricettaTagTrigger.setAttribute('aria-expanded', 'false');
      if (ricettaTagMulti) ricettaTagMulti.classList.remove('is-open');
    }
    ricettaCategoriaDropdown.hidden = !open;
    ricettaCategoriaTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (ricettaCategoriaMulti) ricettaCategoriaMulti.classList.toggle('is-open', open);
  }

  function closeAllRecipeDropdowns() {
    setTagDropdownOpen(false);
    setCategoriaDropdownOpen(false);
  }

  function updateRecipePreview() {
    if (!recipePreviewBody || !recipeComposer) return;
    var title = ricettaTitoloInput ? (ricettaTitoloInput.value || '').trim() : '';
    var cat = ricettaCategoriaInput ? (ricettaCategoriaInput.value || '').trim() : '';
    if (cat === 'Altro' && ricettaCategoriaAltroInput) {
      cat = (ricettaCategoriaAltroInput.value || '').trim() || 'Altro';
    }
    var tags = getSelectedRecipeTags();
    var excerpt = ricettaEstrattoInput ? (ricettaEstrattoInput.value || '').trim() : '';
    var coverUrl = ricettaImmagineInput ? (ricettaImmagineInput.value || '').trim() : '';

    if (recipePreviewMeta) {
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
      recipePreviewMeta.innerHTML =
        metaTagHtml(cat || 'Categoria', 'blog-meta-category') +
        (tagsHtml ? '<span class="blog-meta-tags">' + tagsHtml + '</span>' : '<span class="blog-meta-tags"></span>');
    }
    if (recipePreviewTitle) recipePreviewTitle.textContent = title || 'Titolo della ricetta';
    if (recipePreviewExcerpt) {
      recipePreviewExcerpt.textContent = excerpt;
      recipePreviewExcerpt.hidden = !excerpt;
    }
    if (recipePreviewCover && recipePreviewCoverImg) {
      if (coverUrl) {
        recipePreviewCoverImg.src = coverUrl;
        recipePreviewCoverImg.alt = title || '';
        recipePreviewCover.hidden = false;
      } else {
        recipePreviewCover.hidden = true;
        recipePreviewCoverImg.removeAttribute('src');
      }
    }
    recipePreviewBody.innerHTML = blocksToPreviewHtml(recipeComposer.getBlocks());
  }

  if (document.getElementById('recipeBlocks')) {
    recipeComposer = createBlockComposer({
      blocksEl: document.getElementById('recipeBlocks'),
      btnAddText: document.getElementById('btnAddTextBlock'),
      btnAddImage: document.getElementById('btnAddImageBlock'),
      btnAddIngredients: document.getElementById('btnAddIngredientsBlock'),
      btnAddSteps: document.getElementById('btnAddStepsBlock'),
      msgEl: msgRicetta,
      textPlaceholder: 'Introduzione, consigli, note…',
      onChange: updateRecipePreview
    });
  }

  function resetRicettaFormFields() {
    if (ricettaIdInput) ricettaIdInput.value = '';
    if (ricettaTitoloInput) ricettaTitoloInput.value = '';
    setSelectedRecipeCategory('');
    if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
    if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.setAttribute('hidden', '');
    setSelectedRecipeTags([]);
    closeAllRecipeDropdowns();
    if (ricettaTagCreateInput) ricettaTagCreateInput.value = '';
    if (ricettaCategoriaCreateInput) ricettaCategoriaCreateInput.value = '';
    if (ricettaEstrattoInput) ricettaEstrattoInput.value = '';
    if (recipeComposer) recipeComposer.reset();
    clearRecipeCover();
    if (btnAnnullaRicetta) btnAnnullaRicetta.style.display = 'none';
    if (msgRicetta) msgRicetta.hidden = true;
    updateRecipePreview();
  }

  if (ricettaTitoloInput) ricettaTitoloInput.addEventListener('input', updateRecipePreview);
  if (ricettaEstrattoInput) ricettaEstrattoInput.addEventListener('input', updateRecipePreview);
  if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.addEventListener('input', updateRecipePreview);
  if (ricettaTagTrigger && ricettaTagDropdown) {
    ricettaTagTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setTagDropdownOpen(ricettaTagDropdown.hidden);
    });
    ricettaTagDropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }
  if (ricettaCategoriaTrigger && ricettaCategoriaDropdown) {
    ricettaCategoriaTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setCategoriaDropdownOpen(ricettaCategoriaDropdown.hidden);
    });
    ricettaCategoriaDropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }
  if ((ricettaTagTrigger && ricettaTagDropdown) || (ricettaCategoriaTrigger && ricettaCategoriaDropdown)) {
    document.addEventListener('click', function () {
      closeAllRecipeDropdowns();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllRecipeDropdowns();
    });
  }
  var _setPreviewCover = recipeCover.setPreview;
  var _clearCover = recipeCover.clear;
  recipeCover.setPreview = function (url) {
    _setPreviewCover(url);
    updateRecipePreview();
  };
  recipeCover.clear = function () {
    _clearCover();
    updateRecipePreview();
  };

  function refreshSelectsCategorie() {
    var cats = getAllRecipeCategories();
    var sel = ricettaCategoriaInput ? (ricettaCategoriaInput.value || '').trim() : '';
    if (ricettaCategoriaOptions) {
      if (cats.length === 0) {
        ricettaCategoriaOptions.innerHTML =
          '<p class="multi-select-empty">Nessuna categoria. Scrivine una sopra e clicca Aggiungi.</p>';
      } else {
        ricettaCategoriaOptions.innerHTML = cats
          .map(function (c) {
            return (
              '<button type="button" class="multi-select-option' +
              (c === sel ? ' is-selected' : '') +
              '" role="option" data-value="' +
              escapeHtml(c) +
              '" aria-selected="' +
              (c === sel ? 'true' : 'false') +
              '">' +
              escapeHtml(c) +
              '</button>'
            );
          })
          .join('');
        ricettaCategoriaOptions.querySelectorAll('.multi-select-option').forEach(function (btn) {
          btn.addEventListener('click', function () {
            setSelectedRecipeCategory(btn.getAttribute('data-value') || '');
            setCategoriaDropdownOpen(false);
            updateRecipePreview();
          });
        });
      }
      if (sel && cats.indexOf(sel) < 0) {
        // Keep unknown custom value visible on the trigger
        syncCategoriaSelectUI();
      } else if (!sel || cats.indexOf(sel) >= 0) {
        syncCategoriaSelectUI();
      }
    } else if (ricettaCategoriaInput && ricettaCategoriaInput.tagName === 'SELECT') {
      ricettaCategoriaInput.innerHTML = '<option value="">Scegli categoria</option>';
      cats.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        ricettaCategoriaInput.appendChild(opt);
      });
      if (cats.indexOf(sel) >= 0) ricettaCategoriaInput.value = sel;
    }
    if (filtroCategoriaEl) {
      var selFilter = filtroCategoriaEl.value;
      filtroCategoriaEl.innerHTML = '<option value="">Tutte</option>';
      cats.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        filtroCategoriaEl.appendChild(opt);
      });
      if (cats.indexOf(selFilter) >= 0) filtroCategoriaEl.value = selFilter;
    }
  }

  function refreshSelectsTag() {
    var tags = getAllRecipeTags();
    var optionsRoot = ricettaTagOptions || ricettaTagDropdown;
    if (optionsRoot) {
      if (tags.length === 0) {
        optionsRoot.innerHTML =
          '<p class="multi-select-empty">Nessun tag. Scrivine uno sopra e clicca Aggiungi.</p>';
      } else {
        optionsRoot.innerHTML = tags
          .map(function (t, index) {
            var id = 'ricettaTagOpt_' + index;
            return (
              '<label class="multi-select-option" for="' +
              id +
              '">' +
              '<input type="checkbox" id="' +
              id +
              '" value="' +
              escapeHtml(t) +
              '"' +
              (ricettaSelectedTags.indexOf(t) >= 0 ? ' checked' : '') +
              '> ' +
              '<span>' +
              escapeHtml(t) +
              '</span>' +
              '</label>'
            );
          })
          .join('');
        optionsRoot.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          cb.addEventListener('change', function () {
            if (cb.checked) {
              if (ricettaSelectedTags.indexOf(cb.value) < 0) ricettaSelectedTags.push(cb.value);
            } else {
              ricettaSelectedTags = ricettaSelectedTags.filter(function (t) {
                return t !== cb.value;
              });
            }
            syncTagMultiSelectUI();
            updateRecipePreview();
          });
        });
      }
      syncTagMultiSelectUI();
    }
    if (filtroTagEl) {
      var selFilter = filtroTagEl.value;
      filtroTagEl.innerHTML = '<option value="">Tutti</option>';
      tags.forEach(function (t) {
        var opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        filtroTagEl.appendChild(opt);
      });
      if (tags.indexOf(selFilter) >= 0) filtroTagEl.value = selFilter;
    }
  }

  function renameCategoryInRecipes(oldName, newName) {
    var recipes = getRecipes();
    var changed = false;
    recipes.forEach(function (r) {
      if (getRecipeCategory(r) === oldName) {
        r.category = newName;
        changed = true;
      }
    });
    if (changed) {
      syncRecipesToCloud(recipes).then(function () {
        renderListaRicetteAdmin();
      });
    }
    if (ricettaCategoriaInput && (ricettaCategoriaInput.value || '').trim() === oldName) {
      setSelectedRecipeCategory(newName);
      updateRecipePreview();
    }
  }

  function removeCategoryFromRecipes(name) {
    var recipes = getRecipes();
    var changed = false;
    recipes.forEach(function (r) {
      if (getRecipeCategory(r) === name) {
        r.category = '';
        changed = true;
      }
    });
    if (changed) {
      syncRecipesToCloud(recipes).then(function () {
        renderListaRicetteAdmin();
      });
    }
    if (ricettaCategoriaInput && (ricettaCategoriaInput.value || '').trim() === name) {
      setSelectedRecipeCategory('');
      updateRecipePreview();
    }
  }

  function renameTagInRecipes(oldName, newName) {
    var recipes = getRecipes();
    var changed = false;
    recipes.forEach(function (r) {
      var tags = getRecipeTags(r);
      var idx = tags.indexOf(oldName);
      if (idx < 0) return;
      tags[idx] = newName;
      var deduped = [];
      tags.forEach(function (t) {
        if (t && deduped.indexOf(t) < 0) deduped.push(t);
      });
      r.tags = deduped;
      r.tag = deduped[0] || '';
      changed = true;
    });
    if (changed) {
      syncRecipesToCloud(recipes).then(function () {
        renderListaRicetteAdmin();
      });
    }
    if (ricettaSelectedTags.indexOf(oldName) >= 0) {
      var next = ricettaSelectedTags
        .map(function (t) { return t === oldName ? newName : t; })
        .filter(function (t, i, arr) { return t && arr.indexOf(t) === i; });
      setSelectedRecipeTags(next);
      updateRecipePreview();
    }
  }

  function removeTagFromRecipes(name) {
    var recipes = getRecipes();
    var changed = false;
    recipes.forEach(function (r) {
      var tags = getRecipeTags(r);
      if (tags.indexOf(name) < 0) return;
      var next = tags.filter(function (t) { return t !== name; });
      r.tags = next;
      r.tag = next[0] || '';
      changed = true;
    });
    if (changed) {
      syncRecipesToCloud(recipes).then(function () {
        renderListaRicetteAdmin();
      });
    }
    if (ricettaSelectedTags.indexOf(name) >= 0) {
      setSelectedRecipeTags(ricettaSelectedTags.filter(function (t) { return t !== name; }));
      updateRecipePreview();
    }
  }

  function renameManagedRecipeCategory(oldName, newName) {
    oldName = (oldName || '').trim();
    newName = (newName || '').trim();
    if (!oldName || !newName || oldName === newName) return false;
    var all = getAllRecipeCategories();
    if (all.indexOf(newName) >= 0) return false;

    var custom = getCustomRecipeCategories().filter(function (c) { return c !== oldName; });
    if (custom.indexOf(newName) < 0) custom.push(newName);
    setCustomRecipeCategories(custom);

    if (isBaseRecipeCategory(oldName)) {
      var hidden = getHiddenRecipeCategories();
      if (hidden.indexOf(oldName) < 0) {
        hidden.push(oldName);
        setHiddenRecipeCategories(hidden);
      }
    }

    var unhide = getHiddenRecipeCategories().filter(function (c) { return c !== newName; });
    if (unhide.length !== getHiddenRecipeCategories().length) {
      setHiddenRecipeCategories(unhide);
    }

    renameCategoryInRecipes(oldName, newName);
    return true;
  }

  function deleteManagedRecipeCategory(name) {
    name = (name || '').trim();
    if (!name) return false;

    var custom = getCustomRecipeCategories().filter(function (c) { return c !== name; });
    setCustomRecipeCategories(custom);

    if (isBaseRecipeCategory(name)) {
      var hidden = getHiddenRecipeCategories();
      if (hidden.indexOf(name) < 0) {
        hidden.push(name);
        setHiddenRecipeCategories(hidden);
      }
    }

    removeCategoryFromRecipes(name);
    return true;
  }

  function renameManagedRecipeTag(oldName, newName) {
    oldName = (oldName || '').trim();
    newName = (newName || '').trim();
    if (!oldName || !newName || oldName === newName) return false;
    var all = getAllRecipeTags();
    if (all.indexOf(newName) >= 0) return false;

    var custom = getCustomRecipeTags().filter(function (t) { return t !== oldName; });
    if (custom.indexOf(newName) < 0) custom.push(newName);
    setCustomRecipeTags(custom);
    renameTagInRecipes(oldName, newName);
    return true;
  }

  function deleteManagedRecipeTag(name) {
    name = (name || '').trim();
    if (!name) return false;
    var custom = getCustomRecipeTags().filter(function (t) { return t !== name; });
    setCustomRecipeTags(custom);
    removeTagFromRecipes(name);
    return true;
  }

  function renderListaCategorieRicette() {
    if (!listaCategorieRicette) return;
    var cats = getAllRecipeCategories();
    listaCategorieRicette.innerHTML = '';
    if (cats.length === 0) {
      listaCategorieRicette.innerHTML = '<li class="empty">Nessuna categoria. Aggiungine una sopra.</li>';
      return;
    }
    cats.forEach(function (cat) {
      var li = document.createElement('li');
      li.setAttribute('data-name', cat);
      li.innerHTML =
        '<span class="categoria-nome">' + escapeHtml(cat) +
        (isBaseRecipeCategory(cat) ? ' <span class="categoria-badge">predefinita</span>' : '') +
        '</span>' +
        '<span class="categoria-actions">' +
        '<button type="button" class="btn-edit-cat" data-name="' + escapeHtml(cat) + '">Modifica</button>' +
        '<button type="button" class="btn-remove-cat" data-name="' + escapeHtml(cat) + '">Elimina</button>' +
        '</span>';
      listaCategorieRicette.appendChild(li);
    });

    listaCategorieRicette.querySelectorAll('.btn-edit-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var current = btn.getAttribute('data-name') || '';
        if (!current) return;
        var li = btn.closest('li');
        if (!li) return;
        li.innerHTML = '';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'categoria-edit-input';
        input.value = current;
        input.setAttribute('aria-label', 'Modifica categoria');
        var actions = document.createElement('span');
        actions.className = 'categoria-actions';
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-save-cat';
        saveBtn.textContent = 'Salva';
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel-cat';
        cancelBtn.textContent = 'Annulla';
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        li.appendChild(input);
        li.appendChild(actions);
        input.focus();
        input.select();
        function commit() {
          var nuovo = (input.value || '').trim();
          if (!nuovo) {
            showRicettaMsg('Il nome della categoria non può essere vuoto.', true);
            input.focus();
            return;
          }
          if (nuovo === current) {
            renderListaCategorieRicette();
            return;
          }
          if (getAllRecipeCategories().indexOf(nuovo) >= 0) {
            showRicettaMsg('Esiste già una categoria con questo nome.', true);
            input.focus();
            return;
          }
          if (!renameManagedRecipeCategory(current, nuovo)) {
            showRicettaMsg('Impossibile rinominare la categoria.', true);
            return;
          }
          refreshSelectsCategorie();
          renderListaCategorieRicette();
          showRicettaMsg('Categoria rinominata in "' + nuovo + '".', false);
        }
        saveBtn.addEventListener('click', commit);
        cancelBtn.addEventListener('click', function () {
          renderListaCategorieRicette();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            renderListaCategorieRicette();
          }
        });
      });
    });

    listaCategorieRicette.querySelectorAll('.btn-remove-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-name') || '';
        if (!name) return;
        if (!window.confirm('Eliminare la categoria "' + name + '"? Verrà tolta anche dalle ricette che la usano.')) return;
        deleteManagedRecipeCategory(name);
        renderListaCategorieRicette();
        refreshSelectsCategorie();
        showRicettaMsg('Categoria "' + name + '" eliminata.', false);
      });
    });
  }

  function renderListaTagRicette() {
    if (!listaTagRicette) return;
    var tags = getAllRecipeTags();
    listaTagRicette.innerHTML = '';
    if (tags.length === 0) {
      listaTagRicette.innerHTML = '<li class="empty">Nessun tag. Aggiungine uno sopra.</li>';
      return;
    }
    tags.forEach(function (tag) {
      var li = document.createElement('li');
      li.setAttribute('data-name', tag);
      li.innerHTML =
        '<span class="categoria-nome">' + escapeHtml(tag) + '</span>' +
        '<span class="categoria-actions">' +
        '<button type="button" class="btn-edit-tag" data-name="' + escapeHtml(tag) + '">Modifica</button>' +
        '<button type="button" class="btn-remove-tag" data-name="' + escapeHtml(tag) + '">Elimina</button>' +
        '</span>';
      listaTagRicette.appendChild(li);
    });

    listaTagRicette.querySelectorAll('.btn-edit-tag').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var current = btn.getAttribute('data-name') || '';
        if (!current) return;
        var li = btn.closest('li');
        if (!li) return;
        li.innerHTML = '';
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'categoria-edit-input';
        input.value = current;
        input.setAttribute('aria-label', 'Modifica tag');
        var actions = document.createElement('span');
        actions.className = 'categoria-actions';
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-save-tag';
        saveBtn.textContent = 'Salva';
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn-cancel-tag';
        cancelBtn.textContent = 'Annulla';
        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        li.appendChild(input);
        li.appendChild(actions);
        input.focus();
        input.select();
        function commit() {
          var nuovo = (input.value || '').trim();
          if (!nuovo) {
            showRicettaMsg('Il nome del tag non può essere vuoto.', true);
            input.focus();
            return;
          }
          if (nuovo === current) {
            renderListaTagRicette();
            return;
          }
          if (getAllRecipeTags().indexOf(nuovo) >= 0) {
            showRicettaMsg('Esiste già un tag con questo nome.', true);
            input.focus();
            return;
          }
          if (!renameManagedRecipeTag(current, nuovo)) {
            showRicettaMsg('Impossibile rinominare il tag.', true);
            return;
          }
          refreshSelectsTag();
          renderListaTagRicette();
          showRicettaMsg('Tag rinominato in "' + nuovo + '".', false);
        }
        saveBtn.addEventListener('click', commit);
        cancelBtn.addEventListener('click', function () {
          renderListaTagRicette();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            renderListaTagRicette();
          }
        });
      });
    });

    listaTagRicette.querySelectorAll('.btn-remove-tag').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-name') || '';
        if (!name) return;
        if (!window.confirm('Eliminare il tag "' + name + '"? Verrà tolto anche dalle ricette che lo usano.')) return;
        deleteManagedRecipeTag(name);
        renderListaTagRicette();
        refreshSelectsTag();
        showRicettaMsg('Tag "' + name + '" eliminato.', false);
      });
    });
  }

  function getRecipeCategory(recipe) {
    if (recipe.category != null && recipe.category !== undefined) {
      return String(recipe.category).trim();
    }
    // Legacy: prima esisteva solo `tag` come categoria
    return (recipe.tag || '').trim();
  }

  /** Tag dedicati; ignora il vecchio mirror tag === categoria. Supporta tags[] e tag singolo. */
  function getRecipeTags(recipe) {
    if (!recipe) return [];
    if (Array.isArray(recipe.tags)) {
      return recipe.tags
        .map(function (t) { return String(t || '').trim(); })
        .filter(Boolean);
    }
    var tag = (recipe.tag || '').trim();
    if (!tag) return [];
    if (recipe.category == null || recipe.category === undefined) return [];
    var cat = String(recipe.category || '').trim();
    if (cat && tag === cat) return [];
    return [tag];
  }

  function getRecipeTag(recipe) {
    var tags = getRecipeTags(recipe);
    return tags.length ? tags[0] : '';
  }

  function applyRecipeFilters(recipes) {
    var catFilter = filtroCategoriaEl ? (filtroCategoriaEl.value || '').trim() : '';
    var tagFilter = filtroTagEl ? (filtroTagEl.value || '').trim() : '';
    var searchFilter = filtroRicercaEl ? (filtroRicercaEl.value || '').trim().toLowerCase() : '';
    return recipes.filter(function (r) {
      var cat = getRecipeCategory(r);
      var tags = getRecipeTags(r);
      var matchCat = !catFilter || cat === catFilter || (catFilter === 'Altro' && cat && RICETTE_CATEGORIE.indexOf(cat) < 0);
      var matchTag = !tagFilter || tags.indexOf(tagFilter) >= 0;
      var tagsJoined = tags.join(' ').toLowerCase();
      var matchSearch = !searchFilter || (r.title || '').toLowerCase().indexOf(searchFilter) >= 0 ||
        (r.excerpt || '').toLowerCase().indexOf(searchFilter) >= 0 ||
        tagsJoined.indexOf(searchFilter) >= 0;
      return matchCat && matchTag && matchSearch;
    });
  }

  if (filtroCategoriaEl) filtroCategoriaEl.addEventListener('change', renderListaRicetteAdmin);
  if (filtroTagEl) filtroTagEl.addEventListener('change', renderListaRicetteAdmin);
  if (filtroRicercaEl) filtroRicercaEl.addEventListener('input', renderListaRicetteAdmin);

  function showRicettaMsg(text, isError) {
    var msgEl = document.getElementById('msgRicetta');
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.classList.toggle('msg-error', !!isError);
    msgEl.classList.toggle('msg-ok', !isError);
    msgEl.hidden = false;
    setTimeout(function () { if (msgEl) msgEl.hidden = true; }, isError ? 3000 : 4000);
  }

  function aggiungiCategoriaDaInput(sourceInput) {
    var inputEl = sourceInput || document.getElementById('nuovaCategoriaInput');
    if (!inputEl) return;
    var nome = (inputEl.value || '').trim();
    if (!nome) {
      showRicettaMsg('Scrivi il nome della categoria nel campo.', true);
      inputEl.focus();
      return;
    }
    try {
      var all = getAllRecipeCategories();
      if (all.indexOf(nome) >= 0) {
        setSelectedRecipeCategory(nome);
        updateRecipePreview();
        setCategoriaDropdownOpen(false);
        inputEl.value = '';
        showRicettaMsg('Categoria "' + nome + '" già presente: selezionata.', false);
        return;
      }
      var hidden = getHiddenRecipeCategories().filter(function (c) { return c !== nome; });
      if (hidden.length !== getHiddenRecipeCategories().length) {
        setHiddenRecipeCategories(hidden);
      }
      if (!isBaseRecipeCategory(nome)) {
        var custom = getCustomRecipeCategories();
        if (custom.indexOf(nome) < 0) {
          custom.push(nome);
          setCustomRecipeCategories(custom);
        }
      }
      refreshSelectsCategorie();
      renderListaCategorieRicette();
      setSelectedRecipeCategory(nome);
      updateRecipePreview();
      setCategoriaDropdownOpen(false);
      inputEl.value = '';
      if (nuovaCategoriaInput && nuovaCategoriaInput !== inputEl) nuovaCategoriaInput.value = '';
      if (ricettaCategoriaCreateInput && ricettaCategoriaCreateInput !== inputEl) {
        ricettaCategoriaCreateInput.value = '';
      }
      showRicettaMsg('Categoria "' + nome + '" aggiunta e selezionata.', false);
    } catch (err) {
      showRicettaMsg('Errore: ' + (err && err.message ? err.message : 'impossibile aggiungere'), true);
      console.error('Aggiungi categoria', err);
    }
  }

  if (btnAggiungiCategoria && nuovaCategoriaInput) {
    btnAggiungiCategoria.addEventListener('click', function (e) {
      e.preventDefault();
      aggiungiCategoriaDaInput(nuovaCategoriaInput);
    });
    nuovaCategoriaInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        aggiungiCategoriaDaInput(nuovaCategoriaInput);
      }
    });
  }
  if (ricettaCategoriaCreateBtn && ricettaCategoriaCreateInput) {
    ricettaCategoriaCreateBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      aggiungiCategoriaDaInput(ricettaCategoriaCreateInput);
    });
    ricettaCategoriaCreateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        aggiungiCategoriaDaInput(ricettaCategoriaCreateInput);
      }
    });
  }

  function aggiungiTagDaInput(sourceInput) {
    var inputEl = sourceInput || document.getElementById('nuovoTagInput');
    if (!inputEl) return;
    var nome = (inputEl.value || '').trim();
    if (!nome) {
      showRicettaMsg('Scrivi il nome del tag nel campo.', true);
      inputEl.focus();
      return;
    }
    try {
      var all = getAllRecipeTags();
      if (all.indexOf(nome) >= 0) {
        var existing = getSelectedRecipeTags();
        if (existing.indexOf(nome) < 0) existing.push(nome);
        setSelectedRecipeTags(existing);
        updateRecipePreview();
        inputEl.value = '';
        showRicettaMsg('Tag "' + nome + '" già presente: selezionato.', false);
        return;
      }
      var custom = getCustomRecipeTags();
      custom.push(nome);
      setCustomRecipeTags(custom);
      refreshSelectsTag();
      renderListaTagRicette();
      inputEl.value = '';
      if (nuovoTagInput && nuovoTagInput !== inputEl) nuovoTagInput.value = '';
      if (ricettaTagCreateInput && ricettaTagCreateInput !== inputEl) ricettaTagCreateInput.value = '';
      var next = getSelectedRecipeTags();
      if (next.indexOf(nome) < 0) next.push(nome);
      setSelectedRecipeTags(next);
      updateRecipePreview();
      showRicettaMsg('Tag "' + nome + '" aggiunto e selezionato.', false);
    } catch (err) {
      showRicettaMsg('Errore: ' + (err && err.message ? err.message : 'impossibile aggiungere'), true);
      console.error('Aggiungi tag', err);
    }
  }

  if (btnAggiungiTag && nuovoTagInput) {
    btnAggiungiTag.addEventListener('click', function (e) {
      e.preventDefault();
      aggiungiTagDaInput(nuovoTagInput);
    });
    nuovoTagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        aggiungiTagDaInput(nuovoTagInput);
      }
    });
  }
  if (ricettaTagCreateBtn && ricettaTagCreateInput) {
    ricettaTagCreateBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      aggiungiTagDaInput(ricettaTagCreateInput);
    });
    ricettaTagCreateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        aggiungiTagDaInput(ricettaTagCreateInput);
      }
    });
  }

  function renderListaRicetteAdmin() {
    if (!listaRicetteAdmin) return;
    var recipes = getRecipes();
    var filtered = applyRecipeFilters(recipes);
    listaRicetteAdmin.innerHTML = '';
    if (filtered.length === 0) {
      listaRicetteAdmin.innerHTML = '<li class="empty">' +
        (recipes.length === 0 ? 'Nessuna ricetta pubblicata.' : 'Nessuna ricetta corrisponde ai filtri.') + '</li>';
      return;
    }
    filtered.forEach(function (recipe) {
      var cat = getRecipeCategory(recipe);
      var tags = getRecipeTags(recipe);
      var titleHtml = escapeHtml(recipe.title || 'Senza titolo');
      var badges = '';
      if (cat) badges += '<span class="ricetta-cat-badge">' + escapeHtml(cat) + '</span>';
      tags.forEach(function (tag) {
        badges += '<span class="ricetta-cat-badge ricetta-tag-badge">' + escapeHtml(tag) + '</span>';
      });
      var titleWrap = badges
        ? '<span class="articolo-title articolo-title--with-badge">' + badges + '<span class="articolo-title-text">' + titleHtml + '</span></span>'
        : '<span class="articolo-title">' + titleHtml + '</span>';
      var li = document.createElement('li');
      li.innerHTML =
        titleWrap + ' ' +
        '<span class="articolo-actions">' +
        '<button type="button" class="btn-edit" data-id="' + escapeHtml(recipe.id) + '" aria-label="Modifica">Modifica</button> ' +
        '<button type="button" class="btn-remove" data-id="' + escapeHtml(recipe.id) + '" aria-label="Rimuovi">Rimuovi</button>' +
        '</span>';
      listaRicetteAdmin.appendChild(li);
    });
    listaRicetteAdmin.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var recipes = getRecipes();
        var recipe = recipes.find(function (r) { return r.id === id; });
        if (recipe) {
          var cat = getRecipeCategory(recipe);
          var tags = getRecipeTags(recipe);
          ricettaIdInput.value = recipe.id;
          ricettaTitoloInput.value = recipe.title || '';
          if (ricettaCategoriaInput) {
            var allCats = getAllRecipeCategories();
            if (allCats.indexOf(cat) >= 0) {
              setSelectedRecipeCategory(cat);
            } else if (cat && ricettaCategoriaAltroWrap && ricettaCategoriaAltroInput) {
              setSelectedRecipeCategory('Altro');
              ricettaCategoriaAltroWrap.removeAttribute('hidden');
              ricettaCategoriaAltroInput.value = cat;
            } else {
              if (cat) {
                var customCats = getCustomRecipeCategories();
                if (customCats.indexOf(cat) < 0) {
                  customCats.push(cat);
                  setCustomRecipeCategories(customCats);
                  refreshSelectsCategorie();
                  renderListaCategorieRicette();
                }
              }
              setSelectedRecipeCategory(cat || '');
            }
          }
          var allTags = getAllRecipeTags();
          var customTags = getCustomRecipeTags();
          var tagsChanged = false;
          tags.forEach(function (tag) {
            if (tag && allTags.indexOf(tag) < 0) {
              customTags.push(tag);
              tagsChanged = true;
            }
          });
          if (tagsChanged) {
            setCustomRecipeTags(customTags);
            refreshSelectsTag();
            renderListaTagRicette();
          }
          setSelectedRecipeTags(tags);
          ricettaEstrattoInput.value = recipe.excerpt || '';
          if (recipeComposer) recipeComposer.setBlocks(normalizeRecipeBlocks(recipe));
          setRecipeCoverPreview(recipe.imageUrl || '');
          btnAnnullaRicetta.style.display = 'inline-block';
          msgRicetta.hidden = true;
          updateRecipePreview();
          if (formRicetta && typeof formRicetta.scrollIntoView === 'function') {
            formRicetta.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
    listaRicetteAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (!id || btn.disabled) return;
        if (!window.confirm('Eliminare questa ricetta? L’operazione non è reversibile.')) return;
        btn.disabled = true;
        btn.textContent = 'Eliminazione…';
        var deletePromise = removePersistedRecipe(id);
        // Ridisegna subito: deleteRecipe ha già tolto l’id in locale + tombstone.
        renderListaRicetteAdmin();
        if (ricettaIdInput && ricettaIdInput.value === id) {
          resetRicettaFormFields();
        }
        deletePromise.then(function () {
          renderListaRicetteAdmin();
        }).catch(function (err) {
          console.error('Eliminazione ricetta', err);
          alert((err && err.message) || 'Impossibile eliminare la ricetta dal cloud.');
          if (contentStore && typeof contentStore.load === 'function') {
            contentStore.load({ force: true }).then(function () {
              renderListaRicetteAdmin();
            }).catch(function () {
              renderListaRicetteAdmin();
            });
          } else {
            renderListaRicetteAdmin();
          }
        });
      });
    });
  }

  if (formRicetta) {
    formRicetta.addEventListener('submit', function (e) {
      e.preventDefault();
      if (ricettaPublishing) return;
      var msgEl = document.getElementById('msgRicetta');
      if (msgEl) { msgEl.hidden = true; }
      var unlockPublish = function () {
        ricettaPublishing = false;
        if (btnSalvaRicetta) {
          btnSalvaRicetta.disabled = false;
          btnSalvaRicetta.textContent = 'Pubblica ricetta';
        }
      };
      try {
        var id = ricettaIdInput ? (ricettaIdInput.value || '').trim() : '';
        var title = ricettaTitoloInput ? (ricettaTitoloInput.value || '').trim() : '';
        if (!title) {
          if (msgEl) {
            msgEl.textContent = 'Inserisci un titolo.';
            msgEl.classList.add('msg-error');
            msgEl.classList.remove('msg-ok');
            msgEl.hidden = false;
          }
          return;
        }
        var catSelect = ricettaCategoriaInput ? ricettaCategoriaInput.value : '';
        var catCustom = ricettaCategoriaAltroInput ? (ricettaCategoriaAltroInput.value || '').trim() : '';
        var category = (catSelect === 'Altro' && catCustom) ? catCustom : (catSelect || '');
        if (!category) {
          if (msgEl) {
            msgEl.textContent = 'Scegli una categoria: compare sulla card al posto di «Ricetta».';
            msgEl.classList.add('msg-error');
            msgEl.classList.remove('msg-ok');
            msgEl.hidden = false;
          }
          if (ricettaCategoriaTrigger) ricettaCategoriaTrigger.focus();
          else if (ricettaCategoriaInput) ricettaCategoriaInput.focus();
          return;
        }
        if (catSelect === 'Altro' && catCustom && RICETTE_CATEGORIE.indexOf(catCustom) < 0) {
          var customCats = getCustomRecipeCategories();
          if (customCats.indexOf(catCustom) < 0) {
            customCats.push(catCustom);
            setCustomRecipeCategories(customCats);
            refreshSelectsCategorie();
            renderListaCategorieRicette();
          }
        }
        var tags = getSelectedRecipeTags();
        var tag = tags.length ? tags[0] : '';
        var excerpt = ricettaEstrattoInput ? (ricettaEstrattoInput.value || '').trim() : '';
        var blocks = recipeComposer ? recipeComposer.serialize() : [];
        var body = blocksToPlainBody(blocks);
        var imageUrl = ricettaImmagineInput ? (ricettaImmagineInput.value || '').trim() : '';
        var recipes = getRecipes();
        var existing = id ? recipes.find(function (r) { return r.id === id; }) : null;
        var wasEdit = !!id;
        if (!id) {
          id = 'ric_' + Date.now();
          if (ricettaIdInput) ricettaIdInput.value = id;
        }
        var recipe = {
          id: id,
          title: title,
          category: category,
          tag: tag,
          tags: tags,
          excerpt: excerpt,
          body: body,
          blocks: blocks,
          imageUrl: imageUrl || null,
          createdAt: existing ? existing.createdAt : Date.now()
        };
        ricettaPublishing = true;
        if (btnSalvaRicetta) {
          btnSalvaRicetta.disabled = true;
          btnSalvaRicetta.textContent = 'Pubblicazione…';
        }
        persistRecipe(recipe).then(function (result) {
          renderListaRicetteAdmin();
          if (msgEl) {
            var recipePath = '/ricetta?id=' + encodeURIComponent(recipe.id);
            var blogPath = '/blog';
            msgEl.innerHTML = (wasEdit
              ? 'Ricetta aggiornata. <a href="' + recipePath + '">Apri pagina</a> · <a href="' + blogPath + '">Vedi blog</a>'
              : 'Ricetta pubblicata sul blog. <a href="' + recipePath + '">Apri pagina SEO</a> · <a href="' + blogPath + '">Vedi blog</a>') +
              (result && result.source === 'blob' ? ' Visibile a tutti.' : '');
            msgEl.classList.remove('msg-error');
            msgEl.classList.add('msg-ok');
            msgEl.hidden = false;
            setTimeout(function () { msgEl.hidden = true; }, 6000);
          }
          resetRicettaFormFields();
          unlockPublish();
        }).catch(function (err) {
          unlockPublish();
          if (msgEl) {
            msgEl.textContent = 'Errore: ' + (err && err.message ? err.message : 'impossibile pubblicare');
            msgEl.classList.add('msg-error');
            msgEl.classList.remove('msg-ok');
            msgEl.hidden = false;
          }
          console.error('Errore pubblicazione ricetta', err);
        });
      } catch (err) {
        unlockPublish();
        if (msgEl) {
          msgEl.textContent = 'Errore: ' + (err && err.message ? err.message : 'impossibile pubblicare');
          msgEl.classList.add('msg-error');
          msgEl.classList.remove('msg-ok');
          msgEl.hidden = false;
        }
        console.error('Errore pubblicazione ricetta', err);
      }
    });
  }

  if (btnAnnullaRicetta) {
    btnAnnullaRicetta.addEventListener('click', function () {
      resetRicettaFormFields();
    });
  }

  if (recipeComposer) {
    recipeComposer.render();
  }

  var uploadZone = document.getElementById('uploadZone');
  var uploadZoneFiles = document.getElementById('uploadZoneFiles');
  var btnUploadPdf = document.getElementById('btnUploadPdf');
  var MAX_SIZE_MB = 4;
  var MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  function updateUploadZoneLabel() {
    if (!uploadZoneFiles || !pdfFileInput) return;
    var files = pdfFileInput.files;
    if (!files || files.length === 0) {
      uploadZoneFiles.textContent = '';
      uploadZoneFiles.hidden = true;
      return;
    }
    uploadZoneFiles.hidden = false;
    var parts = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var size = (f.size / 1024).toFixed(1) + ' KB';
      if (f.size >= 1024 * 1024) size = (f.size / (1024 * 1024)).toFixed(1) + ' MB';
      parts.push(f.name + ' (' + size + ')');
    }
    uploadZoneFiles.textContent = parts.join(' — ');
  }

  function isAllowedMaterialFile(file) {
    if (materialeStore && typeof materialeStore.isAllowedFile === 'function') {
      return materialeStore.isAllowedFile(file);
    }
    var type = (file && file.type) || '';
    if (type === 'application/pdf' || type === 'image/png') return true;
    var name = ((file && file.name) || '').toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.png');
  }

  /* ========== CV Upload ========== */
  var formUploadCv = document.getElementById('formUploadCv');
  var cvFileInput = document.getElementById('cvFile');
  var uploadZoneCv = document.getElementById('uploadZoneCv');
  var msgCv = document.getElementById('msgCv');
  var btnUploadCv = document.getElementById('btnUploadCv');

  if (uploadZoneCv && cvFileInput) {
    uploadZoneCv.addEventListener('click', function (e) {
      if (e.target === cvFileInput) return;
      cvFileInput.click();
    });
    uploadZoneCv.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadZoneCv.classList.add('upload-zone--dragover');
    });
    uploadZoneCv.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadZoneCv.classList.remove('upload-zone--dragover');
    });
    uploadZoneCv.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadZoneCv.classList.remove('upload-zone--dragover');
      var files = e.dataTransfer.files;
      if (files.length && files[0].type === 'application/pdf') {
        cvFileInput.files = files;
        document.getElementById('uploadZoneCvFiles').textContent = files[0].name + ' (' + (files[0].size / 1024).toFixed(1) + ' KB)';
        document.getElementById('uploadZoneCvFiles').hidden = false;
      }
    });
    cvFileInput.addEventListener('change', function () {
      var f = cvFileInput.files[0];
      var zoneFiles = document.getElementById('uploadZoneCvFiles');
      if (!f) {
        zoneFiles.textContent = '';
        zoneFiles.hidden = true;
        return;
      }
      zoneFiles.textContent = f.name + ' (' + (f.size / 1024).toFixed(1) + ' KB)';
      zoneFiles.hidden = false;
    });
  }

  if (formUploadCv && cvFileInput) {
    formUploadCv.addEventListener('submit', function (e) {
      e.preventDefault();
      msgCv.hidden = true;
      var file = cvFileInput.files[0];
      if (!file || file.type !== 'application/pdf') {
        msgCv.textContent = 'Seleziona un file PDF.';
        msgCv.classList.add('msg-error');
        msgCv.hidden = false;
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        msgCv.textContent = 'File troppo grande (max ' + MAX_SIZE_MB + ' MB).';
        msgCv.classList.add('msg-error');
        msgCv.hidden = false;
        return;
      }
      if (btnUploadCv) {
        btnUploadCv.disabled = true;
        btnUploadCv.textContent = 'Caricamento…';
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var base64 = ev.target.result.split(',')[1];
        if (base64) {
          setCv({
            title: 'CV Priscilla Castellani',
            filename: (file.name || 'cv').replace(/\.pdf$/i, ''),
            mimeType: 'application/pdf',
            dataBase64: base64
          });
          msgCv.textContent = 'CV caricato con successo.';
          msgCv.classList.remove('msg-error');
          msgCv.classList.add('msg-ok');
          msgCv.hidden = false;
          cvFileInput.value = '';
          document.getElementById('uploadZoneCvFiles').textContent = '';
          document.getElementById('uploadZoneCvFiles').hidden = true;
          updateCvStatus();
        }
        if (btnUploadCv) {
          btnUploadCv.disabled = false;
          btnUploadCv.textContent = 'Carica CV';
        }
      };
      reader.onerror = function () {
        msgCv.textContent = 'Errore nella lettura del file.';
        msgCv.classList.add('msg-error');
        msgCv.hidden = false;
        if (btnUploadCv) {
          btnUploadCv.disabled = false;
          btnUploadCv.textContent = 'Carica CV';
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (uploadZone && pdfFileInput) {
    // L'input file copre già la zona (CSS): non ri-triggerare .click() sullo stesso input,
    // altrimenti su macOS/Chrome il dialogo può aprirsi due volte e perdere la selezione.
    uploadZone.addEventListener('click', function (e) {
      if (e.target === pdfFileInput) return;
      pdfFileInput.click();
    });
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.add('upload-zone--dragover');
    });
    uploadZone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('upload-zone--dragover');
    });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('upload-zone--dragover');
      var files = e.dataTransfer.files;
      if (files.length) {
        var dt = new DataTransfer();
        for (var i = 0; i < files.length; i++) {
          if (isAllowedMaterialFile(files[i])) dt.items.add(files[i]);
        }
        if (dt.files.length) {
          pdfFileInput.files = dt.files;
          updateUploadZoneLabel();
        }
      }
    });
    pdfFileInput.addEventListener('change', updateUploadZoneLabel);
  }

  if (editMaterialeModal) {
    editMaterialeModal.querySelectorAll('[data-edit-dismiss]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeEditMaterialeModal();
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && editMaterialeModal && !editMaterialeModal.hidden) {
        closeEditMaterialeModal();
      }
    });
  }

  if (formEditMateriale) {
    formEditMateriale.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!materialeStore || typeof materialeStore.update !== 'function') {
        if (msgEditMateriale) {
          msgEditMateriale.textContent = 'Modulo materiale non disponibile. Ricarica la pagina.';
          msgEditMateriale.classList.add('msg-error');
          msgEditMateriale.classList.remove('msg-ok');
          msgEditMateriale.hidden = false;
        }
        return;
      }
      var id = (editMaterialeIdInput && editMaterialeIdInput.value || '').trim();
      var idx = parseInt(editMaterialeIndexInput && editMaterialeIndexInput.value, 10);
      var item = (!isNaN(idx) && materialeAdminItems[idx]) ||
        materialeAdminItems.find(function (it) { return it && it.id === id; });
      if (!item) {
        if (msgEditMateriale) {
          msgEditMateriale.textContent = 'File non trovato.';
          msgEditMateriale.classList.add('msg-error');
          msgEditMateriale.classList.remove('msg-ok');
          msgEditMateriale.hidden = false;
        }
        return;
      }
      var folderId = (editMaterialeFolderSelect && editMaterialeFolderSelect.value || '').trim();
      var title = (editMaterialeTitleInput && editMaterialeTitleInput.value || '').trim();
      var description = (editMaterialeDescriptionInput && editMaterialeDescriptionInput.value || '').trim();
      if (!folderId) {
        if (msgEditMateriale) {
          msgEditMateriale.textContent = 'Seleziona una cartella.';
          msgEditMateriale.classList.add('msg-error');
          msgEditMateriale.classList.remove('msg-ok');
          msgEditMateriale.hidden = false;
        }
        return;
      }
      if (!title) {
        if (msgEditMateriale) {
          msgEditMateriale.textContent = 'Inserisci un titolo.';
          msgEditMateriale.classList.add('msg-error');
          msgEditMateriale.classList.remove('msg-ok');
          msgEditMateriale.hidden = false;
        }
        return;
      }
      if (btnSalvaMateriale) {
        btnSalvaMateriale.disabled = true;
        btnSalvaMateriale.textContent = 'Salvataggio…';
      }
      materialeStore.update(item, {
        title: title,
        description: description,
        folderId: folderId
      }).then(function () {
        closeEditMaterialeModal();
        if (msgUpload) {
          msgUpload.textContent = 'Materiale aggiornato.';
          msgUpload.classList.remove('msg-error');
          msgUpload.classList.add('msg-ok');
          msgUpload.hidden = false;
        }
        return renderListaPdfAdmin();
      }).catch(function (err) {
        if (msgEditMateriale) {
          msgEditMateriale.textContent = (err && err.message) || 'Impossibile aggiornare il materiale.';
          msgEditMateriale.classList.add('msg-error');
          msgEditMateriale.classList.remove('msg-ok');
          msgEditMateriale.hidden = false;
        }
      }).then(function () {
        if (btnSalvaMateriale) {
          btnSalvaMateriale.disabled = false;
          btnSalvaMateriale.textContent = 'Salva';
        }
      });
    });
  }

  if (formCartellaMateriale) {
    formCartellaMateriale.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!msgCartella) return;
      msgCartella.hidden = true;
      if (!materialeStore || typeof materialeStore.createFolder !== 'function') {
        msgCartella.textContent = 'Modulo materiale non disponibile. Ricarica la pagina.';
        msgCartella.classList.add('msg-error');
        msgCartella.classList.remove('msg-ok');
        msgCartella.hidden = false;
        return;
      }
      var name = (folderNameInput && folderNameInput.value || '').trim();
      if (!name) {
        msgCartella.textContent = 'Inserisci un nome per la cartella.';
        msgCartella.classList.add('msg-error');
        msgCartella.classList.remove('msg-ok');
        msgCartella.hidden = false;
        return;
      }
      if (btnCreaCartella) {
        btnCreaCartella.disabled = true;
        btnCreaCartella.textContent = 'Creazione…';
      }
      materialeStore.createFolder(name).then(function (folder) {
        if (folderNameInput) folderNameInput.value = '';
        msgCartella.textContent = 'Cartella creata.';
        msgCartella.classList.remove('msg-error');
        msgCartella.classList.add('msg-ok');
        msgCartella.hidden = false;
        var keepFolders = materialeAdminFolders.slice();
        if (folder && folder.id) keepFolders.push(folder);
        return renderListaPdfAdmin({ keepFolders: keepFolders }).then(function () {
          if (folder && folder.id) refreshFolderSelect(folder.id);
        });
      }).catch(function (err) {
        msgCartella.textContent = (err && err.message) || 'Impossibile creare la cartella.';
        msgCartella.classList.add('msg-error');
        msgCartella.classList.remove('msg-ok');
        msgCartella.hidden = false;
      }).then(function () {
        if (btnCreaCartella) {
          btnCreaCartella.disabled = false;
          btnCreaCartella.textContent = 'Crea cartella';
        }
      });
    });
  }

  if (formUploadPdf) {
    formUploadPdf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!msgUpload) return;
      msgUpload.hidden = true;
      if (!materialeStore) {
        msgUpload.textContent = 'Modulo materiale non disponibile. Ricarica la pagina.';
        msgUpload.classList.add('msg-error');
        msgUpload.hidden = false;
        return;
      }
      var folderId = (pdfFolderSelect && pdfFolderSelect.value || '').trim();
      if (!folderId) {
        msgUpload.textContent = materialeAdminFolders.length
          ? 'Seleziona una cartella per i file.'
          : 'Crea prima una cartella, poi carica i file.';
        msgUpload.classList.add('msg-error');
        msgUpload.classList.remove('msg-ok');
        msgUpload.hidden = false;
        return;
      }
      var files = pdfFileInput.files;
      if (!files || files.length === 0) {
        msgUpload.textContent = 'Seleziona almeno un file (PDF o PNG).';
        msgUpload.classList.add('msg-error');
        msgUpload.classList.remove('msg-ok');
        msgUpload.hidden = false;
        return;
      }
      var titleBase = (pdfTitleInput && pdfTitleInput.value || '').trim();
      var description = (pdfDescriptionInput && pdfDescriptionInput.value || '').trim();
      var queue = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!isAllowedMaterialFile(f)) {
          msgUpload.textContent = 'Sono ammessi solo PDF e PNG: "' + f.name + '" non è valido.';
          msgUpload.classList.add('msg-error');
          msgUpload.classList.remove('msg-ok');
          msgUpload.hidden = false;
          return;
        }
        if (f.size > MAX_SIZE_BYTES) {
          msgUpload.textContent = 'File troppo grande (max ' + MAX_SIZE_MB + ' MB): ' + f.name;
          msgUpload.classList.add('msg-error');
          msgUpload.classList.remove('msg-ok');
          msgUpload.hidden = false;
          return;
        }
        queue.push(f);
      }
      if (queue.length === 0) return;
      if (btnUploadPdf) {
        btnUploadPdf.disabled = true;
        btnUploadPdf.textContent = 'Caricamento…';
      }
      var added = 0;
      var lastError = '';
      var uploadedItems = [];

      function finish() {
        if (btnUploadPdf) {
          btnUploadPdf.disabled = false;
          btnUploadPdf.textContent = 'Carica file';
        }
        if (added > 0) {
          msgUpload.textContent = added === 1
            ? 'File caricato con successo.'
            : added + ' file caricati con successo.';
          msgUpload.classList.remove('msg-error');
          msgUpload.classList.add('msg-ok');
          msgUpload.hidden = false;
          if (pdfTitleInput) pdfTitleInput.value = '';
          if (pdfDescriptionInput) pdfDescriptionInput.value = '';
          if (pdfFileInput) pdfFileInput.value = '';
          updateUploadZoneLabel();
          // Mostra subito i file appena caricati (Blob list può ritardare)
          if (uploadedItems.length) {
            var merged = materialeAdminItems.slice();
            var seen = {};
            merged.forEach(function (it) {
              if (it && it.id) seen[String(it.id)] = true;
            });
            uploadedItems.forEach(function (it) {
              if (it && it.id && !seen[String(it.id)]) merged.push(it);
            });
            renderListaPdfAdminFromItems(merged, materialeAdminFolders);
          }
          renderListaPdfAdmin({ keepIfEmpty: uploadedItems }).then(function () {
            // Secondo sync: l'indice Blob a volte non è subito aggiornato
            setTimeout(function () {
              renderListaPdfAdmin({ keepIfEmpty: uploadedItems });
            }, 1200);
          });
        } else {
          msgUpload.textContent = lastError || 'Nessun file caricato.';
          msgUpload.classList.add('msg-error');
          msgUpload.classList.remove('msg-ok');
          msgUpload.hidden = false;
        }
      }

      function processNext(index) {
        if (index >= queue.length) {
          finish();
          return;
        }
        var file = queue[index];
        var cleanName = file.name.replace(/\.(pdf|png)$/i, '');
        var title = titleBase || cleanName;
        if (queue.length > 1 && !titleBase) title = cleanName;
        else if (queue.length > 1 && titleBase) title = titleBase + ' ' + (index + 1);

        materialeStore.add(file, title, folderId, description).then(function (item) {
          added++;
          if (item) uploadedItems.push(item);
          processNext(index + 1);
        }).catch(function (err) {
          lastError = (err && err.message) || ('Errore nel caricamento di "' + file.name + '".');
          processNext(index + 1);
        });
      }

      processNext(0);
    });
  }

  /* ========== Sedi ========== */
  var listaSediAdmin = document.getElementById('listaSediAdmin');
  var formSede = document.getElementById('formSede');
  var sedeIdInput = document.getElementById('sedeId');
  var sedeNomeInput = document.getElementById('sedeNome');
  var sedeIndirizzoInput = document.getElementById('sedeIndirizzo');
  var sedeUrlInput = document.getElementById('sedeUrl');
  var sedePosizioneInput = document.getElementById('sedePosizione');
  var sedeOnlineInput = document.getElementById('sedeOnline');
  var msgSede = document.getElementById('msgSede');
  var btnAnnullaSede = document.getElementById('btnAnnullaSede');

  function getSediApi() {
    return window.PriscillaSedi || null;
  }

  function getNextSedePosition() {
    var api = getSediApi();
    if (!api) return 1;
    var sedi = api.getActiveSedi();
    if (!sedi.length) return 1;
    return Math.max.apply(null, sedi.map(function (s) { return Number(s.position) || 0; })) + 1;
  }

  function resetSedeForm() {
    if (!formSede) return;
    if (sedeIdInput) sedeIdInput.value = '';
    if (sedeNomeInput) sedeNomeInput.value = '';
    if (sedeIndirizzoInput) sedeIndirizzoInput.value = '';
    if (sedeUrlInput) sedeUrlInput.value = '';
    if (sedePosizioneInput) sedePosizioneInput.value = String(getNextSedePosition());
    if (sedeOnlineInput) sedeOnlineInput.checked = false;
    if (btnAnnullaSede) btnAnnullaSede.style.display = 'none';
    if (msgSede) msgSede.hidden = true;
  }

  function populateSedeForm(sede) {
    if (!sede) return;
    if (sedeIdInput) sedeIdInput.value = sede.id || '';
    if (sedeNomeInput) sedeNomeInput.value = sede.name || '';
    if (sedeIndirizzoInput) sedeIndirizzoInput.value = sede.address || '';
    if (sedeUrlInput) sedeUrlInput.value = sede.url || '';
    if (sedePosizioneInput) sedePosizioneInput.value = String(sede.position || 1);
    if (sedeOnlineInput) sedeOnlineInput.checked = !!sede.online;
    if (btnAnnullaSede) btnAnnullaSede.style.display = 'inline-block';
    if (msgSede) msgSede.hidden = true;
  }

  function getSedeTypeLabel(url) {
    var api = getSediApi();
    return api && api.isCalendlyUrl(url) ? 'Calendly' : 'Link esterno';
  }

  function renderListaSediAdmin() {
    if (!listaSediAdmin) return;
    var api = getSediApi();
    if (!api) {
      listaSediAdmin.innerHTML = '<li class="empty">Modulo sedi non disponibile.</li>';
      return;
    }

    var sedi = api.getActiveSedi();
    listaSediAdmin.innerHTML = '';
    if (sedi.length === 0) {
      listaSediAdmin.innerHTML = '<li class="empty">Nessuna sede configurata.</li>';
      return;
    }

    sedi.forEach(function (sede) {
      var li = document.createElement('li');
      var meta = 'Pos. ' + (sede.position || '–') + ' · ' + getSedeTypeLabel(sede.url);
      if (sede.online) meta += ' · Online';
      li.innerHTML =
        '<span class="articolo-title">' +
          '<strong>' + escapeHtml(sede.name || 'Senza nome') + '</strong><br>' +
          '<span class="sede-admin-meta">' + escapeHtml(meta) + '</span><br>' +
          '<span class="sede-admin-meta">' + escapeHtml(sede.address || '') + '</span>' +
        '</span> ' +
        '<span class="articolo-actions">' +
          '<button type="button" class="btn-edit" data-id="' + escapeHtml(sede.id) + '" aria-label="Modifica">Modifica</button> ' +
          '<button type="button" class="btn-move" data-id="' + escapeHtml(sede.id) + '" data-dir="up" aria-label="Sposta su">↑</button> ' +
          '<button type="button" class="btn-move" data-id="' + escapeHtml(sede.id) + '" data-dir="down" aria-label="Sposta giù">↓</button> ' +
          '<button type="button" class="btn-remove" data-id="' + escapeHtml(sede.id) + '" aria-label="Rimuovi">Rimuovi</button>' +
        '</span>';
      listaSediAdmin.appendChild(li);
    });

    listaSediAdmin.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var sede = api.getActiveSedi().find(function (s) { return s.id === id; });
        if (sede) populateSedeForm(sede);
      });
    });

    listaSediAdmin.querySelectorAll('.btn-move').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var dir = btn.getAttribute('data-dir');
        var sedi = api.sortSedi(api.getSedi());
        var index = sedi.findIndex(function (s) { return s.id === id; });
        if (index < 0) return;
        var swapIndex = dir === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= sedi.length) return;
        var currentPos = Number(sedi[index].position) || index + 1;
        var swapPos = Number(sedi[swapIndex].position) || swapIndex + 1;
        sedi[index].position = swapPos;
        sedi[swapIndex].position = currentPos;
        api.setSedi(sedi);
        renderListaSediAdmin();
      });
    });

    listaSediAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var sedi = api.getSedi().filter(function (s) { return s.id !== id; });
        api.setSedi(sedi);
        renderListaSediAdmin();
        if (sedeIdInput && sedeIdInput.value === id) resetSedeForm();
      });
    });
  }

  if (formSede) {
    if (sedePosizioneInput && !sedePosizioneInput.value) {
      sedePosizioneInput.value = String(getNextSedePosition());
    }

    formSede.addEventListener('submit', function (e) {
      e.preventDefault();
      var api = getSediApi();
      if (!api) return;
      if (msgSede) msgSede.hidden = true;

      var id = (sedeIdInput && sedeIdInput.value || '').trim();
      var name = (sedeNomeInput && sedeNomeInput.value || '').trim();
      var address = (sedeIndirizzoInput && sedeIndirizzoInput.value || '').trim();
      var url = (sedeUrlInput && sedeUrlInput.value || '').trim();
      var position = parseInt((sedePosizioneInput && sedePosizioneInput.value) || '1', 10);
      var online = !!(sedeOnlineInput && sedeOnlineInput.checked);

      if (!name || !address || !url) {
        if (msgSede) {
          msgSede.textContent = 'Compila nome, indirizzo e URL.';
          msgSede.classList.add('msg-error');
          msgSede.hidden = false;
        }
        return;
      }

      if (!/^https?:\/\//i.test(url)) {
        if (msgSede) {
          msgSede.textContent = 'L\'URL deve iniziare con http:// o https://';
          msgSede.classList.add('msg-error');
          msgSede.hidden = false;
        }
        return;
      }

      var sedi = api.getSedi();
      var sede = {
        id: id || 'sede_' + Date.now(),
        name: name,
        address: address,
        url: url,
        position: position > 0 ? position : getNextSedePosition(),
        online: online
      };

      if (id) {
        var idx = sedi.findIndex(function (s) { return s.id === id; });
        if (idx >= 0) sedi[idx] = sede;
        else sedi.push(sede);
      } else {
        sedi.push(sede);
      }

      api.setSedi(sedi);
      renderListaSediAdmin();
      if (msgSede) {
        msgSede.textContent = id ? 'Sede aggiornata.' : 'Sede aggiunta.';
        msgSede.classList.remove('msg-error');
        msgSede.classList.add('msg-ok');
        msgSede.hidden = false;
        setTimeout(function () { msgSede.hidden = true; }, 3000);
      }
      resetSedeForm();
      if (sedePosizioneInput) sedePosizioneInput.value = String(getNextSedePosition());
    });
  }

  if (btnAnnullaSede) {
    btnAnnullaSede.addEventListener('click', resetSedeForm);
  }

  /* ========== Contenuto CV ========== */
  var formCvEntry = document.getElementById('formCvEntry');
  var cvEntryIdInput = document.getElementById('cvEntryId');
  var cvEntrySectionKeyInput = document.getElementById('cvEntrySectionKey');
  var cvEntrySectionSelect = document.getElementById('cvEntrySectionSelect');
  var cvEntryOrgInput = document.getElementById('cvEntryOrg');
  var cvEntryDetailWrap = document.getElementById('cvEntryDetailWrap');
  var cvEntryDetailInput = document.getElementById('cvEntryDetail');
  var cvEntryDateInput = document.getElementById('cvEntryDate');
  var cvEntryTextsInput = document.getElementById('cvEntryTexts');
  var msgCvEntry = document.getElementById('msgCvEntry');
  var btnAnnullaCvEntry = document.getElementById('btnAnnullaCvEntry');
  var cvSectionsAdmin = document.getElementById('cvSectionsAdmin');

  function getCvApi() {
    return window.PriscillaCv || null;
  }

  function updateCvEntryFormFields() {
    var sectionKey = cvEntrySectionSelect ? cvEntrySectionSelect.value : 'experience';
    if (cvEntrySectionKeyInput) cvEntrySectionKeyInput.value = sectionKey;
    if (cvEntryDetailWrap) {
      cvEntryDetailWrap.style.display = sectionKey === 'education' ? '' : 'none';
    }
  }

  function resetCvEntryForm() {
    if (!formCvEntry) return;
    if (cvEntryIdInput) cvEntryIdInput.value = '';
    if (cvEntrySectionSelect) cvEntrySectionSelect.value = 'experience';
    updateCvEntryFormFields();
    if (cvEntryOrgInput) cvEntryOrgInput.value = '';
    if (cvEntryDetailInput) cvEntryDetailInput.value = '';
    if (cvEntryDateInput) cvEntryDateInput.value = '';
    if (cvEntryTextsInput) cvEntryTextsInput.value = '';
    if (btnAnnullaCvEntry) btnAnnullaCvEntry.style.display = 'none';
    if (msgCvEntry) msgCvEntry.hidden = true;
  }

  function populateCvEntryForm(sectionKey, entry) {
    if (!entry) return;
    if (cvEntryIdInput) cvEntryIdInput.value = entry.id || '';
    if (cvEntrySectionSelect) cvEntrySectionSelect.value = sectionKey;
    updateCvEntryFormFields();
    if (cvEntryOrgInput) cvEntryOrgInput.value = entry.org || '';
    if (cvEntryDetailInput) cvEntryDetailInput.value = entry.detail || '';
    if (cvEntryDateInput) cvEntryDateInput.value = entry.date || '';
    if (cvEntryTextsInput) cvEntryTextsInput.value = (entry.texts || []).join('\n');
    if (btnAnnullaCvEntry) btnAnnullaCvEntry.style.display = 'inline-block';
    if (msgCvEntry) msgCvEntry.hidden = true;
  }

  function parseCvEntryTexts(raw) {
    return String(raw || '')
      .split(/\n/)
      .map(function (line) { return line.trim(); })
      .filter(Boolean);
  }

  function renderCvContentAdmin() {
    if (!cvSectionsAdmin) return;
    var api = getCvApi();
    if (!api) {
      cvSectionsAdmin.innerHTML = '<p class="empty">Modulo CV non disponibile.</p>';
      return;
    }

    var data = api.getCvContent();
    cvSectionsAdmin.innerHTML = '';

    data.sections.forEach(function (section) {
      var block = document.createElement('div');
      block.className = 'cv-admin-section';
      block.innerHTML = '<h3 class="admin-subtitle">' + escapeHtml(section.title) + '</h3>';

      var list = document.createElement('ul');
      list.className = 'lista-articoli-admin lista-cv-admin';

      if (!section.entries.length) {
        list.innerHTML = '<li class="empty">Nessuna voce in questa sezione.</li>';
      } else {
        section.entries.forEach(function (entry, index) {
          var li = document.createElement('li');
          var meta = entry.date || '';
          if (section.key === 'education' && entry.detail) {
            meta = entry.detail + (meta ? ' · ' + meta : '');
          }
          li.innerHTML =
            '<span class="articolo-title">' +
              '<strong>' + escapeHtml(entry.org || 'Senza titolo') + '</strong>' +
              (meta ? '<br><span class="sede-admin-meta">' + escapeHtml(meta) + '</span>' : '') +
            '</span> ' +
            '<span class="articolo-actions">' +
              '<button type="button" class="btn-edit" data-section="' + escapeHtml(section.key) + '" data-id="' + escapeHtml(entry.id) + '" aria-label="Modifica">Modifica</button> ' +
              '<button type="button" class="btn-move" data-section="' + escapeHtml(section.key) + '" data-id="' + escapeHtml(entry.id) + '" data-dir="up" aria-label="Sposta su">↑</button> ' +
              '<button type="button" class="btn-move" data-section="' + escapeHtml(section.key) + '" data-id="' + escapeHtml(entry.id) + '" data-dir="down" aria-label="Sposta giù">↓</button> ' +
              '<button type="button" class="btn-remove" data-section="' + escapeHtml(section.key) + '" data-id="' + escapeHtml(entry.id) + '" aria-label="Rimuovi">Rimuovi</button>' +
            '</span>';
          list.appendChild(li);
        });
      }

      block.appendChild(list);
      cvSectionsAdmin.appendChild(block);
    });

    cvSectionsAdmin.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sectionKey = btn.getAttribute('data-section');
        var id = btn.getAttribute('data-id');
        var section = api.getSectionByKey(sectionKey);
        if (!section) return;
        var entry = section.entries.find(function (e) { return e.id === id; });
        if (entry) populateCvEntryForm(sectionKey, entry);
      });
    });

    cvSectionsAdmin.querySelectorAll('.btn-move').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sectionKey = btn.getAttribute('data-section');
        var id = btn.getAttribute('data-id');
        var dir = btn.getAttribute('data-dir');
        var data = api.getCvContent();
        var section = data.sections.find(function (s) { return s.key === sectionKey; });
        if (!section) return;
        var index = section.entries.findIndex(function (e) { return e.id === id; });
        if (index < 0) return;
        var swapIndex = dir === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= section.entries.length) return;
        var tmp = section.entries[index];
        section.entries[index] = section.entries[swapIndex];
        section.entries[swapIndex] = tmp;
        api.setCvContent(data);
        renderCvContentAdmin();
      });
    });

    cvSectionsAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sectionKey = btn.getAttribute('data-section');
        var id = btn.getAttribute('data-id');
        var data = api.getCvContent();
        var section = data.sections.find(function (s) { return s.key === sectionKey; });
        if (!section) return;
        section.entries = section.entries.filter(function (e) { return e.id !== id; });
        api.setCvContent(data);
        renderCvContentAdmin();
        if (cvEntryIdInput && cvEntryIdInput.value === id) resetCvEntryForm();
      });
    });
  }

  if (cvEntrySectionSelect) {
    cvEntrySectionSelect.addEventListener('change', updateCvEntryFormFields);
    updateCvEntryFormFields();
  }

  if (formCvEntry) {
    formCvEntry.addEventListener('submit', function (e) {
      e.preventDefault();
      var api = getCvApi();
      if (!api) return;
      if (msgCvEntry) msgCvEntry.hidden = true;

      var sectionKey = cvEntrySectionSelect ? cvEntrySectionSelect.value : 'experience';
      var org = (cvEntryOrgInput && cvEntryOrgInput.value || '').trim();
      if (!org) {
        if (msgCvEntry) {
          msgCvEntry.textContent = 'Inserisci un titolo o ente.';
          msgCvEntry.classList.add('msg-error');
          msgCvEntry.hidden = false;
        }
        return;
      }

      var id = (cvEntryIdInput && cvEntryIdInput.value || '').trim();
      var entry = {
        id: id || ('cv_' + sectionKey + '_' + Date.now()),
        org: org,
        detail: sectionKey === 'education' ? (cvEntryDetailInput && cvEntryDetailInput.value || '').trim() : '',
        date: (cvEntryDateInput && cvEntryDateInput.value || '').trim(),
        texts: parseCvEntryTexts(cvEntryTextsInput && cvEntryTextsInput.value)
      };

      var data = api.getCvContent();
      var section = data.sections.find(function (s) { return s.key === sectionKey; });
      if (!section) return;

      if (id) {
        var idx = section.entries.findIndex(function (item) { return item.id === id; });
        if (idx >= 0) section.entries[idx] = entry;
        else section.entries.push(entry);
      } else {
        section.entries.push(entry);
      }

      api.setCvContent(data);
      renderCvContentAdmin();
      if (msgCvEntry) {
        msgCvEntry.textContent = id ? 'Voce aggiornata.' : 'Voce aggiunta.';
        msgCvEntry.classList.remove('msg-error');
        msgCvEntry.classList.add('msg-ok');
        msgCvEntry.hidden = false;
        setTimeout(function () { msgCvEntry.hidden = true; }, 3000);
      }
      resetCvEntryForm();
    });
  }

  if (btnAnnullaCvEntry) {
    btnAnnullaCvEntry.addEventListener('click', resetCvEntryForm);
  }

  showDashboard();
})();
