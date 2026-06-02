(function () {
  'use strict';

  var STORAGE_KEY_PDFS = 'scarica_pdfs';
  var STORAGE_KEY_DOWNLOAD_KEY = 'download_secret';
  var STORAGE_KEY_CV = 'scarica_cv';
  var STORAGE_KEY_BLOG = 'blog_articoli';
  var STORAGE_KEY_RICETTE = 'ricette';
  var STORAGE_KEY_CATEGORIE_RICETTE = 'ricette_categorie';

  var adminDashboard = document.getElementById('adminDashboard');
  var formChiaveDownload = document.getElementById('formChiaveDownload');
  var downloadKeyInput = document.getElementById('downloadKey');
  var msgChiave = document.getElementById('msgChiave');
  var formUploadPdf = document.getElementById('formUploadPdf');
  var pdfTitleInput = document.getElementById('pdfTitle');
  var pdfFileInput = document.getElementById('pdfFile');
  var msgUpload = document.getElementById('msgUpload');
  var listaPdfAdmin = document.getElementById('listaPdfAdmin');

  function getPdfs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_PDFS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setPdfs(pdfs) {
    localStorage.setItem(STORAGE_KEY_PDFS, JSON.stringify(pdfs));
  }

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
    localStorage.setItem(STORAGE_KEY_CATEGORIE_RICETTE, JSON.stringify(arr));
  }

  function getAllRecipeCategories() {
    var custom = getCustomRecipeCategories();
    var base = (typeof RICETTE_CATEGORIE !== 'undefined' && RICETTE_CATEGORIE && RICETTE_CATEGORIE.slice) ? RICETTE_CATEGORIE.slice() : [];
    var combined = base;
    custom.forEach(function (c) {
      var t = (c || '').trim();
      if (t && combined.indexOf(t) < 0) combined.push(t);
    });
    return combined;
  }

  function showDashboard() {
    if (downloadKeyInput) {
      downloadKeyInput.value = localStorage.getItem(STORAGE_KEY_DOWNLOAD_KEY) || '';
    }
    if (listaPdfAdmin) renderListaPdfAdmin();
    updateCvStatus();
    renderListaArticoliAdmin();
    renderListaRicetteAdmin();
    if (typeof refreshSelectsCategorie === 'function') refreshSelectsCategorie();
    if (typeof renderListaCategorieRicette === 'function') renderListaCategorieRicette();
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

  function renderListaPdfAdmin() {
    if (!listaPdfAdmin) return;
    var pdfs = getPdfs();
    listaPdfAdmin.innerHTML = '';
    if (pdfs.length === 0) {
      listaPdfAdmin.innerHTML = '<li class="empty">Nessun file caricato.</li>';
      return;
    }
    pdfs.forEach(function (item, index) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="pdf-title">' + escapeHtml(item.title || 'Senza titolo') + '</span> ' +
        '<button type="button" class="btn-remove" data-index="' + index + '" aria-label="Rimuovi">Rimuovi</button>';
      listaPdfAdmin.appendChild(li);
    });
    listaPdfAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var list = getPdfs();
        list.splice(idx, 1);
        setPdfs(list);
        renderListaPdfAdmin();
      });
    });
  }

  var listaArticoliAdmin = document.getElementById('listaArticoliAdmin');
  var formArticolo = document.getElementById('formArticolo');
  var articoloIdInput = document.getElementById('articoloId');
  var articoloTitoloInput = document.getElementById('articoloTitolo');
  var articoloMetaInput = document.getElementById('articoloMeta');
  var articoloEstrattoInput = document.getElementById('articoloEstratto');
  var articoloContenutoInput = document.getElementById('articoloContenuto');
  var articoloImmagineInput = document.getElementById('articoloImmagine');
  var msgArticolo = document.getElementById('msgArticolo');
  var btnAnnullaArticolo = document.getElementById('btnAnnullaArticolo');

  function renderListaArticoliAdmin() {
    if (!listaArticoliAdmin) return;
    var posts = getBlogPosts();
    listaArticoliAdmin.innerHTML = '';
    if (posts.length === 0) {
      listaArticoliAdmin.innerHTML = '<li class="empty">Nessun articolo pubblicato.</li>';
      return;
    }
    posts.forEach(function (post, index) {
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
          articoloContenutoInput.value = post.body || '';
          articoloImmagineInput.value = post.imageUrl || '';
          btnAnnullaArticolo.style.display = 'inline-block';
          msgArticolo.hidden = true;
        }
      });
    });
    listaArticoliAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var posts = getBlogPosts().filter(function (p) { return p.id !== id; });
        setBlogPosts(posts);
        renderListaArticoliAdmin();
        if (articoloIdInput.value === id) {
          articoloIdInput.value = '';
          articoloTitoloInput.value = '';
          articoloMetaInput.value = '';
          articoloEstrattoInput.value = '';
          articoloContenutoInput.value = '';
          articoloImmagineInput.value = '';
          btnAnnullaArticolo.style.display = 'none';
          msgArticolo.hidden = true;
        }
      });
    });
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      var body = (articoloContenutoInput.value || '').trim();
      var imageUrl = (articoloImmagineInput.value || '').trim();
      var posts = getBlogPosts();
      var post = {
        id: id || 'art_' + Date.now(),
        title: title,
        meta: meta,
        excerpt: excerpt,
        body: body,
        imageUrl: imageUrl || null,
        createdAt: id ? (posts.find(function (p) { return p.id === id; }) || {}).createdAt : Date.now()
      };
      if (id) {
        var idx = posts.findIndex(function (p) { return p.id === id; });
        if (idx >= 0) posts[idx] = post;
        else posts.push(post);
      } else {
        posts.push(post);
      }
      setBlogPosts(posts);
      renderListaArticoliAdmin();
      msgArticolo.textContent = id ? 'Articolo aggiornato.' : 'Articolo pubblicato.';
      msgArticolo.classList.remove('msg-error');
      msgArticolo.classList.add('msg-ok');
      msgArticolo.hidden = false;
      setTimeout(function () { msgArticolo.hidden = true; }, 3000);
      articoloIdInput.value = '';
      articoloTitoloInput.value = '';
      articoloMetaInput.value = '';
      articoloEstrattoInput.value = '';
      articoloContenutoInput.value = '';
      articoloImmagineInput.value = '';
      btnAnnullaArticolo.style.display = 'none';
    });
  }

  if (btnAnnullaArticolo) {
    btnAnnullaArticolo.addEventListener('click', function () {
      articoloIdInput.value = '';
      articoloTitoloInput.value = '';
      articoloMetaInput.value = '';
      articoloEstrattoInput.value = '';
      articoloContenutoInput.value = '';
      articoloImmagineInput.value = '';
      btnAnnullaArticolo.style.display = 'none';
      msgArticolo.hidden = true;
    });
  }

  /* ========== Ricette ========== */
  var RICETTE_CATEGORIE = ['Pre-workout', 'Post-workout', 'Snack', 'Colazione', 'Pranzo', 'Cena', 'Dessert', 'Bevande', 'Altro'];
  var listaRicetteAdmin = document.getElementById('listaRicetteAdmin');
  var formRicetta = document.getElementById('formRicetta');
  var ricettaIdInput = document.getElementById('ricettaId');
  var ricettaTitoloInput = document.getElementById('ricettaTitolo');
  var ricettaCategoriaInput = document.getElementById('ricettaCategoria');
  var ricettaCategoriaAltroInput = document.getElementById('ricettaCategoriaAltro');
  var ricettaCategoriaAltroWrap = document.getElementById('ricettaCategoriaAltroWrap');
  var ricettaEstrattoInput = document.getElementById('ricettaEstratto');
  var ricettaContenutoInput = document.getElementById('ricettaContenuto');
  var ricettaImmagineInput = document.getElementById('ricettaImmagine');
  var msgRicetta = document.getElementById('msgRicetta');
  var btnAnnullaRicetta = document.getElementById('btnAnnullaRicetta');
  var filtroCategoriaEl = document.getElementById('filtroCategoria');
  var filtroRicercaEl = document.getElementById('filtroRicerca');
  var nuovaCategoriaInput = document.getElementById('nuovaCategoriaInput');
  var btnAggiungiCategoria = document.getElementById('btnAggiungiCategoria');
  var listaCategorieRicette = document.getElementById('listaCategorieRicette');

  function refreshSelectsCategorie() {
    var cats = getAllRecipeCategories();
    if (ricettaCategoriaInput) {
      var sel = ricettaCategoriaInput.value;
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

  function renderListaCategorieRicette() {
    if (!listaCategorieRicette) return;
    var custom = getCustomRecipeCategories();
    listaCategorieRicette.innerHTML = '';
    if (custom.length === 0) {
      listaCategorieRicette.innerHTML = '<li class="empty">Nessuna categoria personalizzata. Aggiungine una sopra.</li>';
      return;
    }
    custom.forEach(function (cat, index) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="categoria-nome">' + escapeHtml(cat) + '</span> ' +
        '<button type="button" class="btn-remove btn-remove-cat" data-index="' + index + '" aria-label="Rimuovi categoria">Rimuovi</button>';
      listaCategorieRicette.appendChild(li);
    });
    listaCategorieRicette.querySelectorAll('.btn-remove-cat').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var list = getCustomRecipeCategories();
        list.splice(idx, 1);
        setCustomRecipeCategories(list);
        renderListaCategorieRicette();
        refreshSelectsCategorie();
      });
    });
  }

  function getRecipeCategory(recipe) {
    return (recipe.category || recipe.tag || '').trim();
  }

  function applyRecipeFilters(recipes) {
    var catFilter = filtroCategoriaEl ? (filtroCategoriaEl.value || '').trim() : '';
    var searchFilter = filtroRicercaEl ? (filtroRicercaEl.value || '').trim().toLowerCase() : '';
    return recipes.filter(function (r) {
      var cat = getRecipeCategory(r);
      var matchCat = !catFilter || cat === catFilter || (catFilter === 'Altro' && cat && RICETTE_CATEGORIE.indexOf(cat) < 0);
      var matchSearch = !searchFilter || (r.title || '').toLowerCase().indexOf(searchFilter) >= 0 ||
        (r.excerpt || '').toLowerCase().indexOf(searchFilter) >= 0;
      return matchCat && matchSearch;
    });
  }

  if (ricettaCategoriaInput && ricettaCategoriaAltroWrap) {
    ricettaCategoriaInput.addEventListener('change', function () {
      var isAltro = ricettaCategoriaInput.value === 'Altro';
      if (isAltro) {
        ricettaCategoriaAltroWrap.removeAttribute('hidden');
      } else {
        ricettaCategoriaAltroWrap.setAttribute('hidden', '');
      }
    });
  }

  if (filtroCategoriaEl) filtroCategoriaEl.addEventListener('change', renderListaRicetteAdmin);
  if (filtroRicercaEl) filtroRicercaEl.addEventListener('input', renderListaRicetteAdmin);

  function aggiungiCategoriaDaInput() {
    var msgEl = document.getElementById('msgRicetta');
    var inputEl = document.getElementById('nuovaCategoriaInput');
    if (!inputEl) return;
    var nome = (inputEl.value || '').trim();
    if (!nome) {
      if (msgEl) {
        msgEl.textContent = 'Scrivi il nome della categoria nel campo qui sopra.';
        msgEl.classList.add('msg-error');
        msgEl.classList.remove('msg-ok');
        msgEl.hidden = false;
        setTimeout(function () { if (msgEl) msgEl.hidden = true; }, 3000);
      }
      return;
    }
    try {
      var all = getAllRecipeCategories();
      if (all.indexOf(nome) >= 0) {
        if (msgEl) {
          msgEl.textContent = 'Questa categoria esiste già.';
          msgEl.classList.add('msg-error');
          msgEl.classList.remove('msg-ok');
          msgEl.hidden = false;
          setTimeout(function () { if (msgEl) msgEl.hidden = true; }, 3000);
        }
        return;
      }
      var custom = getCustomRecipeCategories();
      custom.push(nome);
      setCustomRecipeCategories(custom);
      refreshSelectsCategorie();
      renderListaCategorieRicette();
      inputEl.value = '';
      if (msgEl) {
        msgEl.textContent = 'Categoria "' + nome + '" aggiunta. Compare nel menu Categoria e nella lista sotto.';
        msgEl.classList.remove('msg-error');
        msgEl.classList.add('msg-ok');
        msgEl.hidden = false;
        setTimeout(function () { if (msgEl) msgEl.hidden = true; }, 4000);
      }
    } catch (err) {
      if (msgEl) {
        msgEl.textContent = 'Errore: ' + (err && err.message ? err.message : 'impossibile aggiungere');
        msgEl.classList.add('msg-error');
        msgEl.classList.remove('msg-ok');
        msgEl.hidden = false;
      }
      console.error('Aggiungi categoria', err);
    }
  }

  if (btnAggiungiCategoria && nuovaCategoriaInput) {
    btnAggiungiCategoria.addEventListener('click', function (e) {
      e.preventDefault();
      aggiungiCategoriaDaInput();
    });
    nuovaCategoriaInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        aggiungiCategoriaDaInput();
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
      var titleHtml = escapeHtml(recipe.title || 'Senza titolo');
      var titleWrap = cat
        ? '<span class="articolo-title articolo-title--with-badge"><span class="ricetta-cat-badge">' + escapeHtml(cat) + '</span><span class="articolo-title-text">' + titleHtml + '</span></span>'
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
          ricettaIdInput.value = recipe.id;
          ricettaTitoloInput.value = recipe.title || '';
          if (RICETTE_CATEGORIE.indexOf(cat) >= 0) {
            ricettaCategoriaInput.value = cat;
            ricettaCategoriaAltroWrap.setAttribute('hidden', '');
            ricettaCategoriaAltroInput.value = '';
          } else if (cat) {
            ricettaCategoriaInput.value = 'Altro';
            ricettaCategoriaAltroWrap.removeAttribute('hidden');
            ricettaCategoriaAltroInput.value = cat;
          } else {
            ricettaCategoriaInput.value = '';
            ricettaCategoriaAltroWrap.setAttribute('hidden', '');
            ricettaCategoriaAltroInput.value = '';
          }
          ricettaEstrattoInput.value = recipe.excerpt || '';
          ricettaContenutoInput.value = recipe.body || '';
          ricettaImmagineInput.value = recipe.imageUrl || '';
          btnAnnullaRicetta.style.display = 'inline-block';
          msgRicetta.hidden = true;
        }
      });
    });
    listaRicetteAdmin.querySelectorAll('.btn-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var recipes = getRecipes().filter(function (r) { return r.id !== id; });
        setRecipes(recipes);
        renderListaRicetteAdmin();
        if (ricettaIdInput && ricettaIdInput.value === id) {
          ricettaIdInput.value = '';
          ricettaTitoloInput.value = '';
          if (ricettaCategoriaInput) ricettaCategoriaInput.value = '';
          if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
          if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.setAttribute('hidden', '');
          ricettaEstrattoInput.value = '';
          ricettaContenutoInput.value = '';
          ricettaImmagineInput.value = '';
          btnAnnullaRicetta.style.display = 'none';
          msgRicetta.hidden = true;
        }
      });
    });
  }

  if (formRicetta) {
    formRicetta.addEventListener('submit', function (e) {
      e.preventDefault();
      var msgEl = document.getElementById('msgRicetta');
      if (msgEl) { msgEl.hidden = true; }
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
        var excerpt = ricettaEstrattoInput ? (ricettaEstrattoInput.value || '').trim() : '';
        var body = ricettaContenutoInput ? (ricettaContenutoInput.value || '').trim() : '';
        var imageUrl = ricettaImmagineInput ? (ricettaImmagineInput.value || '').trim() : '';
        var recipes = getRecipes();
        var existing = id ? recipes.find(function (r) { return r.id === id; }) : null;
        var recipe = {
          id: id || 'ric_' + Date.now(),
          title: title,
          category: category,
          tag: category,
          excerpt: excerpt,
          body: body,
          imageUrl: imageUrl || null,
          createdAt: existing ? existing.createdAt : Date.now()
        };
        if (id) {
          var idx = recipes.findIndex(function (r) { return r.id === id; });
          if (idx >= 0) recipes[idx] = recipe;
          else recipes.push(recipe);
        } else {
          recipes.push(recipe);
        }
        setRecipes(recipes);
        renderListaRicetteAdmin();
        if (msgEl) {
          msgEl.textContent = id ? 'Ricetta aggiornata.' : 'Ricetta pubblicata.';
          msgEl.classList.remove('msg-error');
          msgEl.classList.add('msg-ok');
          msgEl.hidden = false;
          setTimeout(function () { msgEl.hidden = true; }, 3000);
        }
        if (ricettaIdInput) ricettaIdInput.value = '';
        if (ricettaTitoloInput) ricettaTitoloInput.value = '';
        if (ricettaCategoriaInput) ricettaCategoriaInput.value = '';
        if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
        if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.style.display = 'none';
        if (ricettaEstrattoInput) ricettaEstrattoInput.value = '';
        if (ricettaContenutoInput) ricettaContenutoInput.value = '';
        if (ricettaImmagineInput) ricettaImmagineInput.value = '';
        if (btnAnnullaRicetta) btnAnnullaRicetta.style.display = 'none';
      } catch (err) {
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
      ricettaIdInput.value = '';
      ricettaTitoloInput.value = '';
      if (ricettaCategoriaInput) ricettaCategoriaInput.value = '';
      if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
      if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.style.display = 'none';
      ricettaEstrattoInput.value = '';
      ricettaContenutoInput.value = '';
      ricettaImmagineInput.value = '';
      btnAnnullaRicetta.style.display = 'none';
      msgRicetta.hidden = true;
    });
  }

  var uploadZone = document.getElementById('uploadZone');
  var uploadZoneFiles = document.getElementById('uploadZoneFiles');
  var btnUploadPdf = document.getElementById('btnUploadPdf');
  var MAX_SIZE_MB = 5;
  var MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  function updateUploadZoneLabel() {
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

  /* ========== CV Upload ========== */
  var formUploadCv = document.getElementById('formUploadCv');
  var cvFileInput = document.getElementById('cvFile');
  var uploadZoneCv = document.getElementById('uploadZoneCv');
  var msgCv = document.getElementById('msgCv');
  var btnUploadCv = document.getElementById('btnUploadCv');

  if (uploadZoneCv && cvFileInput) {
    uploadZoneCv.addEventListener('click', function () { cvFileInput.click(); });
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
    uploadZone.addEventListener('click', function () { pdfFileInput.click(); });
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
          var t = files[i].type;
          if (t === 'application/pdf' || t === 'image/png') dt.items.add(files[i]);
        }
        if (dt.files.length) {
          pdfFileInput.files = dt.files;
          updateUploadZoneLabel();
        }
      }
    });
    pdfFileInput.addEventListener('change', updateUploadZoneLabel);
  }

  if (formUploadPdf) {
    formUploadPdf.addEventListener('submit', function (e) {
      e.preventDefault();
      msgUpload.hidden = true;
      var files = pdfFileInput.files;
      if (!files || files.length === 0) {
        msgUpload.textContent = 'Seleziona almeno un file (PDF o PNG).';
        msgUpload.classList.add('msg-error');
        msgUpload.hidden = false;
        return;
      }
      var titleBase = (pdfTitleInput.value || '').trim();
      var queue = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (f.type !== 'application/pdf' && f.type !== 'image/png') {
          msgUpload.textContent = 'Sono ammessi solo PDF e PNG: "' + f.name + '" non è valido.';
          msgUpload.classList.add('msg-error');
          msgUpload.hidden = false;
          return;
        }
        if (f.size > MAX_SIZE_BYTES) {
          msgUpload.textContent = 'File troppo grande (max ' + MAX_SIZE_MB + ' MB): ' + f.name;
          msgUpload.classList.add('msg-error');
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
      function processNext(index) {
        if (index >= queue.length) {
          if (btnUploadPdf) {
            btnUploadPdf.disabled = false;
            btnUploadPdf.textContent = 'Carica file';
          }
          msgUpload.textContent = added === 1 ? 'File caricato con successo.' : added + ' file caricati con successo.';
          msgUpload.classList.remove('msg-error');
          msgUpload.classList.add('msg-ok');
          msgUpload.hidden = false;
          pdfTitleInput.value = '';
          pdfFileInput.value = '';
          updateUploadZoneLabel();
          renderListaPdfAdmin();
          return;
        }
        var file = queue[index];
        var cleanName = file.name.replace(/\.(pdf|png)$/i, '');
        var title = titleBase || cleanName;
        if (queue.length > 1 && !titleBase) title = cleanName;
        else if (queue.length > 1 && titleBase) title = titleBase + ' ' + (index + 1);
        var reader = new FileReader();
        reader.onload = function (ev) {
          var base64 = ev.target.result.split(',')[1];
          if (base64) {
            var pdfs = getPdfs();
            pdfs.push({
              title: title,
              filename: cleanName,
              mimeType: file.type,
              dataBase64: base64
            });
            setPdfs(pdfs);
            added++;
          }
          processNext(index + 1);
        };
        reader.onerror = function () {
          msgUpload.textContent = 'Errore nella lettura di "' + file.name + '".';
          msgUpload.classList.add('msg-error');
          msgUpload.hidden = false;
          if (btnUploadPdf) {
            btnUploadPdf.disabled = false;
            btnUploadPdf.textContent = 'Carica file';
          }
          updateUploadZoneLabel();
        };
        reader.readAsDataURL(file);
      }
      processNext(0);
    });
  }

  showDashboard();
})();
