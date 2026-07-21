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
    window.dispatchEvent(new CustomEvent('priscilla-recipes-changed'));
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
    renderListaSediAdmin();
    renderCvContentAdmin();
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
        var posts = getBlogPosts().filter(function (p) { return p.id !== id; });
        setBlogPosts(posts);
        renderListaArticoliAdmin();
        if (articoloIdInput.value === id) {
          resetArticoloFormFields();
        }
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
      if (id) {
        var idx = posts.findIndex(function (p) { return p.id === id; });
        if (idx >= 0) posts[idx] = post;
        else posts.push(post);
      } else {
        posts.push(post);
      }
      setBlogPosts(posts);
      renderListaArticoliAdmin();
      var articlePath = '/blog?id=' + encodeURIComponent(post.id);
      msgArticolo.innerHTML = id
        ? 'Articolo aggiornato. <a href="' + articlePath + '">Apri pagina</a>'
        : 'Articolo pubblicato. <a href="' + articlePath + '">Apri pagina</a>';
      msgArticolo.classList.remove('msg-error');
      msgArticolo.classList.add('msg-ok');
      msgArticolo.hidden = false;
      setTimeout(function () { msgArticolo.hidden = true; }, 6000);
      resetArticoloFormFields();
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
  var RICETTE_CATEGORIE = ['Pre-workout', 'Post-workout', 'Snack', 'Colazione', 'Pranzo', 'Cena', 'Dessert', 'Bevande', 'Altro'];
  var listaRicetteAdmin = document.getElementById('listaRicetteAdmin');
  var formRicetta = document.getElementById('formRicetta');
  var ricettaIdInput = document.getElementById('ricettaId');
  var ricettaTitoloInput = document.getElementById('ricettaTitolo');
  var ricettaCategoriaInput = document.getElementById('ricettaCategoria');
  var ricettaCategoriaAltroInput = document.getElementById('ricettaCategoriaAltro');
  var ricettaCategoriaAltroWrap = document.getElementById('ricettaCategoriaAltroWrap');
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
  var btnAnnullaRicetta = document.getElementById('btnAnnullaRicetta');
  var filtroCategoriaEl = document.getElementById('filtroCategoria');
  var filtroRicercaEl = document.getElementById('filtroRicerca');
  var nuovaCategoriaInput = document.getElementById('nuovaCategoriaInput');
  var btnAggiungiCategoria = document.getElementById('btnAggiungiCategoria');
  var listaCategorieRicette = document.getElementById('listaCategorieRicette');
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

  function updateRecipePreview() {
    if (!recipePreviewBody || !recipeComposer) return;
    var title = ricettaTitoloInput ? (ricettaTitoloInput.value || '').trim() : '';
    var cat = ricettaCategoriaInput ? (ricettaCategoriaInput.value || '').trim() : '';
    if (cat === 'Altro' && ricettaCategoriaAltroInput) {
      cat = (ricettaCategoriaAltroInput.value || '').trim() || 'Altro';
    }
    var excerpt = ricettaEstrattoInput ? (ricettaEstrattoInput.value || '').trim() : '';
    var coverUrl = ricettaImmagineInput ? (ricettaImmagineInput.value || '').trim() : '';

    if (recipePreviewMeta) recipePreviewMeta.textContent = cat || 'Categoria';
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
    if (ricettaCategoriaInput) ricettaCategoriaInput.value = '';
    if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
    if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.setAttribute('hidden', '');
    if (ricettaEstrattoInput) ricettaEstrattoInput.value = '';
    if (recipeComposer) recipeComposer.reset();
    clearRecipeCover();
    if (btnAnnullaRicetta) btnAnnullaRicetta.style.display = 'none';
    if (msgRicetta) msgRicetta.hidden = true;
    updateRecipePreview();
  }

  if (ricettaTitoloInput) ricettaTitoloInput.addEventListener('input', updateRecipePreview);
  if (ricettaEstrattoInput) ricettaEstrattoInput.addEventListener('input', updateRecipePreview);
  if (ricettaCategoriaInput) ricettaCategoriaInput.addEventListener('change', updateRecipePreview);
  if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.addEventListener('input', updateRecipePreview);
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
          if (ricettaCategoriaInput) {
            var allCats = getAllRecipeCategories();
            if (allCats.indexOf(cat) >= 0) {
              ricettaCategoriaInput.value = cat;
              if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.setAttribute('hidden', '');
              if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
            } else if (cat && ricettaCategoriaAltroWrap && ricettaCategoriaAltroInput) {
              ricettaCategoriaInput.value = 'Altro';
              ricettaCategoriaAltroWrap.removeAttribute('hidden');
              ricettaCategoriaAltroInput.value = cat;
            } else {
              ricettaCategoriaInput.value = cat || '';
              if (ricettaCategoriaAltroWrap) ricettaCategoriaAltroWrap.setAttribute('hidden', '');
              if (ricettaCategoriaAltroInput) ricettaCategoriaAltroInput.value = '';
            }
          }
          ricettaEstrattoInput.value = recipe.excerpt || '';
          if (recipeComposer) recipeComposer.setBlocks(normalizeRecipeBlocks(recipe));
          setRecipeCoverPreview(recipe.imageUrl || '');
          btnAnnullaRicetta.style.display = 'inline-block';
          msgRicetta.hidden = true;
          if (formRicetta && typeof formRicetta.scrollIntoView === 'function') {
            formRicetta.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
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
          resetRicettaFormFields();
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
        var blocks = recipeComposer ? recipeComposer.serialize() : [];
        var body = blocksToPlainBody(blocks);
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
          blocks: blocks,
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
          var recipePath = '/ricetta?id=' + encodeURIComponent(recipe.id);
          var blogPath = '/blog';
          msgEl.innerHTML = id
            ? 'Ricetta aggiornata. <a href="' + recipePath + '">Apri pagina</a> · <a href="' + blogPath + '">Vedi blog</a>'
            : 'Ricetta pubblicata sul blog. <a href="' + recipePath + '">Apri pagina SEO</a> · <a href="' + blogPath + '">Vedi blog</a>';
          msgEl.classList.remove('msg-error');
          msgEl.classList.add('msg-ok');
          msgEl.hidden = false;
          setTimeout(function () { msgEl.hidden = true; }, 6000);
        }
        resetRicettaFormFields();
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
      resetRicettaFormFields();
    });
  }

  if (recipeComposer) {
    recipeComposer.render();
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
    var sectionKey = cvEntrySectionSelect ? cvEntrySectionSelect.value : 'education';
    if (cvEntrySectionKeyInput) cvEntrySectionKeyInput.value = sectionKey;
    if (cvEntryDetailWrap) {
      cvEntryDetailWrap.style.display = sectionKey === 'education' ? '' : 'none';
    }
  }

  function resetCvEntryForm() {
    if (!formCvEntry) return;
    if (cvEntryIdInput) cvEntryIdInput.value = '';
    if (cvEntrySectionSelect) cvEntrySectionSelect.value = 'education';
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

      var sectionKey = cvEntrySectionSelect ? cvEntrySectionSelect.value : 'education';
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
