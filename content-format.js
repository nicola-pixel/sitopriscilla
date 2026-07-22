/**
 * Formattazione template per articoli e ricette.
 * Non modifica i dati salvati: solo rendering HTML in pagina / anteprima.
 */
(function (global) {
  'use strict';

  var SECTION_HEADINGS =
    /^(ingredienti|procedimento|preparazione|metodo|istruzioni|consigli|note|porzioni|tempo|difficolt[aà]|valori nutrizionali|per\s+\d+\s+person[ea])\s*:?\s*$/i;

  function escapeHtml(text) {
    if (text == null || text === '') return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function isSectionHeading(line) {
    return SECTION_HEADINGS.test(String(line || '').trim());
  }

  function isListItemLine(line, forceList) {
    var t = String(line || '').trim();
    if (!t || isGenericHeadingLine(t)) return false;
    if (/^[-•*·]\s+\S/.test(t)) return true;
    if (/^\d+[.)]\s+\S/.test(t)) return true;
    // Senza marker, solo in sezioni ricetta (ingredienti/passaggi)
    if (!forceList) return false;
    var words = t.split(/\s+/).length;
    if (words > 16 || t.length > 110) return false;
    if (/[a-zàèéìòù]{4,}[.!?]$/i.test(t) && words >= 6) return false;
    return true;
  }

  function stripListMarker(line) {
    return String(line || '')
      .trim()
      .replace(/^[-•*·]\s+/, '')
      .replace(/^\d+[.)]\s+/, '');
  }

  function sectionMode(heading) {
    if (/ingredienti/i.test(heading)) return 'ingredients';
    if (/procedimento|preparazione|metodo|istruzioni/i.test(heading)) return 'steps';
    return '';
  }

  /** "Titolo: descrizione" → titolo in grassetto, resto testo normale. */
  function formatListItemHtml(item, allowTitleDesc) {
    var text = String(item == null ? '' : item).trim();
    if (!text) return '';
    if (allowTitleDesc) {
      var match = text.match(/^(.{1,72}?)\s*[:–—]\s+(.+)$/);
      if (match) {
        var title = match[1].trim();
        var desc = match[2].trim();
        if (title && desc && title.split(/\s+/).length <= 10 && !/[.!?]$/.test(title)) {
          return '<strong class="prose-list-title">' + escapeHtml(title) + '</strong> ' + escapeHtml(desc);
        }
      }
    }
    return escapeHtml(text);
  }

  function flushList(items, mode, numbered) {
    if (!items.length) return '';
    var allowTitleDesc = !mode;
    if (items.length === 1 && !mode) {
      return '<p>' + formatListItemHtml(items[0], allowTitleDesc) + '</p>';
    }
    var asSteps = mode === 'steps' || numbered;
    var tag = asSteps ? 'ol' : 'ul';
    var listClass = asSteps ? 'prose-steps' : 'prose-list';
    return (
      '<' +
      tag +
      ' class="' +
      listClass +
      '">' +
      items
        .map(function (item) {
          return '<li>' + formatListItemHtml(item, allowTitleDesc) + '</li>';
        })
        .join('') +
      '</' +
      tag +
      '>'
    );
  }

  function isGenericHeadingLine(line) {
    var t = String(line || '').trim();
    if (!t) return false;
    if (/^#{1,3}\s+\S/.test(t)) return true;
    if (isSectionHeading(t)) return true;
    // Riga breve che termina con ":" → titolo di sezione
    if (/^.{2,70}:\s*$/.test(t) && t.split(/\s+/).length <= 12) return true;
    return false;
  }

  function headingTextFromLine(line) {
    var t = String(line || '').trim();
    t = t.replace(/^#{1,3}\s+/, '').replace(/:$/, '').trim();
    return t;
  }

  function linesToStructuredHtml(lines) {
    var html = '';
    var i = 0;
    var mode = '';
    var guard = 0;
    var maxSteps = Math.max(32, lines.length * 4);

    while (i < lines.length) {
      guard += 1;
      if (guard > maxSteps) break;

      var line = lines[i].trim();
      if (!line) {
        i += 1;
        continue;
      }

      if (isGenericHeadingLine(line)) {
        var heading = headingTextFromLine(line);
        mode = sectionMode(heading);
        var headingClass = mode ? ' prose-heading--' + mode : '';
        html +=
          '<h2 class="prose-heading' +
          headingClass +
          '">' +
          escapeHtml(heading) +
          '</h2>';
        i += 1;
        continue;
      }

      var forceList = mode === 'ingredients' || mode === 'steps';
      if (forceList || isListItemLine(line, false)) {
        var listItems = [];
        var numbered = true;
        var sawItem = false;
        var startIdx = i;
        while (i < lines.length) {
          var raw = lines[i].trim();
          if (!raw) {
            var peek = i + 1;
            while (peek < lines.length && !lines[peek].trim()) peek += 1;
            if (
              peek >= lines.length ||
              isGenericHeadingLine(lines[peek]) ||
              !isListItemLine(lines[peek], forceList)
            ) {
              break;
            }
            i = peek;
            continue;
          }
          if (isGenericHeadingLine(raw) || !isListItemLine(raw, forceList)) break;
          if (!/^\d+[.)]\s+\S/.test(raw)) numbered = false;
          sawItem = true;
          var item = stripListMarker(raw);
          if (item) listItems.push(item);
          i += 1;
        }
        if (!sawItem) numbered = false;
        html += flushList(listItems, mode, numbered);
        // Evita loop infinito: se forceList è true ma la riga non è un item
        // (es. paragrafo troppo lungo), avanza comunque.
        if (i === startIdx) {
          html += '<p>' + escapeHtml(line) + '</p>';
          i += 1;
        }
        continue;
      }

      var para = [line];
      i += 1;
      while (i < lines.length) {
        var next = lines[i].trim();
        if (!next || isGenericHeadingLine(next) || isListItemLine(next, false)) break;
        para.push(next);
        i += 1;
      }
      html += '<p>' + escapeHtml(para.join('\n')).replace(/\n/g, '<br>') + '</p>';
    }

    return html;
  }

  function textToHtml(text) {
    if (!text) return '';
    var normalized = String(text).replace(/\r\n/g, '\n').trim();
    if (!normalized) return '';

    var lines = normalized.split('\n');
    var hasStructure = lines.some(function (l) {
      return isGenericHeadingLine(l) || isListItemLine(l, false);
    });

    if (hasStructure && lines.length > 1) {
      var structured = linesToStructuredHtml(lines);
      if (structured) return structured;
    }

    var parts = normalized.split(/\n\s*\n/);
    return parts
      .map(function (p) {
        var trimmed = p.trim();
        if (!trimmed) return '';
        if (isGenericHeadingLine(trimmed.split('\n')[0])) {
          return linesToStructuredHtml(trimmed.split('\n'));
        }
        return '<p>' + escapeHtml(trimmed).replace(/\n/g, '<br>') + '</p>';
      })
      .filter(Boolean)
      .join('');
  }

  function headingBlockToHtml(block) {
    if (!block || block.type !== 'heading') return '';
    var title = String(block.content || '').trim();
    if (!title) return '';
    return (
      '<h2 class="prose-heading content-block content-block--heading">' +
      escapeHtml(title) +
      '</h2>'
    );
  }

  function listBlockToHtml(block) {
    if (!block || (block.type !== 'ingredients' && block.type !== 'steps' && block.type !== 'list')) {
      return '';
    }
    var items = Array.isArray(block.items)
      ? block.items
          .map(function (item) {
            return String(item == null ? '' : item).trim();
          })
          .filter(Boolean)
      : [];
    if (!items.length) return '';
    var isSteps = block.type === 'steps';
    var isGenericList = block.type === 'list';
    var tag = isSteps ? 'ol' : 'ul';
    var listClass = isSteps ? 'prose-steps' : 'prose-list';
    var defaultTitle = isSteps ? 'Procedimento' : isGenericList ? '' : 'Ingredienti';
    var title = String(block.title != null ? block.title : defaultTitle).trim();
    var headingHtml = '';
    if (title) {
      var headingMod = isSteps ? 'steps' : isGenericList ? 'list' : 'ingredients';
      headingHtml =
        '<h2 class="prose-heading prose-heading--' +
        headingMod +
        '">' +
        escapeHtml(title) +
        '</h2>';
    }
    return (
      '<section class="content-block content-block--' +
      escapeHtml(block.type) +
      '">' +
      headingHtml +
      '<' +
      tag +
      ' class="' +
      listClass +
      '">' +
      items
        .map(function (item) {
          return '<li>' + formatListItemHtml(item, isGenericList) + '</li>';
        })
        .join('') +
      '</' +
      tag +
      '></section>'
    );
  }

  function normalizeVideoUrl(url) {
    var s = String(url == null ? '' : url).trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
      var parsed = new URL(s);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  function videoBlockToHtml(block) {
    if (!block || block.type !== 'video') return '';
    var href = normalizeVideoUrl(block.url);
    if (!href) return '';
    var label = escapeHtml(String(block.label || 'Guarda il video').trim() || 'Guarda il video');
    return (
      '<div class="content-block content-block--video">' +
      '<p class="prose-video-label">' +
      label +
      '</p>' +
      '<a class="prose-video-link" href="' +
      escapeHtml(href) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(href) +
      '</a>' +
      '</div>'
    );
  }

  function blocksToHtml(blocks) {
    if (!blocks || !blocks.length) return '';
    return blocks
      .map(function (block) {
        if (!block) return '';
        if (block.type === 'image' && block.src) {
          var alt = escapeHtml(block.alt || '');
          return (
            '<figure class="content-block content-block--image content-block--image-center">' +
            '<img src="' +
            String(block.src).replace(/"/g, '&quot;') +
            '" alt="' +
            alt +
            '" loading="lazy">' +
            '</figure>'
          );
        }
        if (block.type === 'heading') {
          return headingBlockToHtml(block);
        }
        if (block.type === 'ingredients' || block.type === 'steps' || block.type === 'list') {
          return listBlockToHtml(block);
        }
        if (block.type === 'video') {
          return videoBlockToHtml(block);
        }
        if (block.type === 'text') {
          var html = textToHtml(block.content || '');
          if (!html) return '';
          return '<div class="content-block content-block--text">' + html + '</div>';
        }
        return '';
      })
      .join('');
  }

  function normalizeBlocks(item) {
    if (item && Array.isArray(item.blocks) && item.blocks.length) {
      return item.blocks;
    }
    var body = (item && item.body) || '';
    if (!body) return [];
    return [{ type: 'text', content: body }];
  }

  function renderBodyHtml(item) {
    var blocksHtml = blocksToHtml(normalizeBlocks(item));
    if (blocksHtml) return blocksHtml;
    return textToHtml((item && item.body) || '');
  }

  /** Palette fissa: stesso nome → stesso colore su tutte le pagine. */
  var TAG_COLORS = [
    '#C97B6E', /* coral soft */
    '#5A9E94', /* teal soft */
    '#C4A24A', /* zafferano soft */
    '#6A9A74', /* basilico soft */
    '#C4788A', /* rosa soft */
    '#6B8FBE', /* oceano soft */
    '#B88764', /* paprika soft */
    '#8E7FB0', /* violetto soft */
    '#5A9BB0', /* acqua soft */
    '#C47A96', /* fucsia soft */
  ];

  function tagColor(name) {
    var s = String(name || '')
      .trim()
      .toLowerCase();
    if (!s) return TAG_COLORS[0];
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
  }

  function formatTagLabel(name) {
    return String(name || '')
      .trim()
      .toLowerCase();
  }

  function metaTagHtml(name, className) {
    var label = formatTagLabel(name);
    if (!label) return '';
    var cls = className || 'blog-meta-tag';
    return (
      '<span class="' +
      cls +
      '" style="--tag-color:' +
      tagColor(name) +
      '">' +
      escapeHtml(label) +
      '</span>'
    );
  }

  global.PriscillaContentFormat = {
    escapeHtml: escapeHtml,
    textToHtml: textToHtml,
    headingBlockToHtml: headingBlockToHtml,
    listBlockToHtml: listBlockToHtml,
    videoBlockToHtml: videoBlockToHtml,
    normalizeVideoUrl: normalizeVideoUrl,
    blocksToHtml: blocksToHtml,
    normalizeBlocks: normalizeBlocks,
    renderBodyHtml: renderBodyHtml,
    tagColor: tagColor,
    formatTagLabel: formatTagLabel,
    metaTagHtml: metaTagHtml,
  };
})(typeof window !== 'undefined' ? window : this);
