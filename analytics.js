(function (global) {
  'use strict';

  var STORAGE_KEY = 'priscilla_analytics';
  var API_URL = '/api/analytics';
  var MAX_EVENTS = 5000;
  var RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
  var remoteAvailable = null;

  function now() {
    return Date.now();
  }

  function getStore() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.events)) return parsed;
      }
    } catch (e) {}
    return { events: [], version: 1 };
  }

  function saveStore(store) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      if (store.events.length > 100) {
        store.events = store.events.slice(-100);
        try {
          global.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (err) {}
      }
    }
  }

  function pruneEvents(events) {
    var cutoff = now() - RETENTION_MS;
    var pruned = events.filter(function (ev) {
      return ev && typeof ev.ts === 'number' && ev.ts >= cutoff;
    });
    if (pruned.length > MAX_EVENTS) {
      pruned = pruned.slice(pruned.length - MAX_EVENTS);
    }
    return pruned;
  }

  function notify(type) {
    try {
      global.dispatchEvent(new CustomEvent('analytics-updated', { detail: { type: type } }));
    } catch (e) {}
  }

  function postRemote(event) {
    try {
      global.fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true
      }).then(function (res) {
        if (res.ok) remoteAvailable = true;
        else if (res.status === 503) remoteAvailable = false;
      }).catch(function () {
        /* locale / offline: ok */
      });
    } catch (e) {}
  }

  function track(type, meta) {
    var event = {
      id: 'evt_' + now() + '_' + Math.random().toString(36).slice(2, 8),
      type: type,
      ts: now(),
      meta: meta || {}
    };
    var store = getStore();
    store.events.push(event);
    store.events = pruneEvents(store.events);
    saveStore(store);
    postRemote(event);
    notify(type);
  }

  function getEvents(opts) {
    opts = opts || {};
    var events = getStore().events.slice();
    if (opts.type) {
      events = events.filter(function (ev) { return ev.type === opts.type; });
    }
    if (opts.since) {
      events = events.filter(function (ev) { return ev.ts >= opts.since; });
    }
    if (opts.until) {
      events = events.filter(function (ev) { return ev.ts <= opts.until; });
    }
    events.sort(function (a, b) { return b.ts - a.ts; });
    if (opts.limit) events = events.slice(0, opts.limit);
    return events;
  }

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function startOfDay(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function countByType(events, type) {
    return events.filter(function (ev) { return ev.type === type; }).length;
  }

  function groupCount(events, keyFn) {
    var map = {};
    events.forEach(function (ev) {
      var key = keyFn(ev);
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function getPeriodStart(days) {
    if (!days || days <= 0) return 0;
    return startOfDay(now() - (days - 1) * 24 * 60 * 60 * 1000);
  }

  function buildDailySeries(events, types, days) {
    var since = getPeriodStart(days);
    var end = startOfDay(now());
    var buckets = {};
    var cursor = since;
    while (cursor <= end) {
      buckets[dayKey(cursor)] = 0;
      cursor += 24 * 60 * 60 * 1000;
    }
    events.forEach(function (ev) {
      if (ev.ts < since) return;
      if (types.indexOf(ev.type) < 0) return;
      var key = dayKey(ev.ts);
      if (Object.prototype.hasOwnProperty.call(buckets, key)) {
        buckets[key] += 1;
      }
    });
    return Object.keys(buckets).sort().map(function (key) {
      return { date: key, count: buckets[key] };
    });
  }

  function summarizeEvents(allEvents, days) {
    allEvents = allEvents || [];
    var since = getPeriodStart(days);
    var prevSince = days > 0 ? getPeriodStart(days * 2) : 0;
    var periodEvents = days > 0
      ? allEvents.filter(function (ev) { return ev.ts >= since; })
      : allEvents.slice();
    var prevPeriodEvents = days > 0
      ? allEvents.filter(function (ev) { return ev.ts >= prevSince && ev.ts < since; })
      : [];

    var downloads = periodEvents.filter(function (ev) {
      return ev.type === 'download' || ev.type === 'cv_download';
    });
    var prevDownloads = prevPeriodEvents.filter(function (ev) {
      return ev.type === 'download' || ev.type === 'cv_download';
    });
    var sedeClicks = periodEvents.filter(function (ev) { return ev.type === 'sede_click'; });
    var prevSedeClicks = prevPeriodEvents.filter(function (ev) { return ev.type === 'sede_click'; });
    var unlocks = periodEvents.filter(function (ev) {
      return ev.type === 'area_unlock' && ev.meta && ev.meta.success;
    });
    var unlockFails = periodEvents.filter(function (ev) {
      return ev.type === 'area_unlock' && ev.meta && !ev.meta.success;
    });
    var blogViews = periodEvents.filter(function (ev) { return ev.type === 'blog_view'; });
    var prevBlogViews = prevPeriodEvents.filter(function (ev) { return ev.type === 'blog_view'; });
    var recipeViews = periodEvents.filter(function (ev) { return ev.type === 'recipe_view'; });
    var prevRecipeViews = prevPeriodEvents.filter(function (ev) { return ev.type === 'recipe_view'; });

    var byFile = groupCount(downloads, function (ev) {
      return (ev.meta && (ev.meta.fileTitle || ev.meta.fileName)) || 'Documento';
    });
    var bySede = groupCount(sedeClicks, function (ev) {
      return (ev.meta && ev.meta.sedeName) || (ev.meta && ev.meta.sedeId) || 'Sede';
    });

    var fileRanking = Object.keys(byFile).map(function (name) {
      return { name: name, count: byFile[name] };
    }).sort(function (a, b) { return b.count - a.count; });

    var sedeRanking = Object.keys(bySede).map(function (name) {
      return { name: name, count: bySede[name] };
    }).sort(function (a, b) { return b.count - a.count; });

    function contentRanking(events) {
      var map = {};
      events.forEach(function (ev) {
        var meta = ev.meta || {};
        var id = meta.id || '';
        var title = meta.title || id || 'Senza titolo';
        var key = id || title;
        if (!key) return;
        if (!map[key]) {
          map[key] = {
            id: id,
            name: title,
            category: meta.category || '',
            count: 0
          };
        }
        map[key].count += 1;
        if (title) map[key].name = title;
        if (meta.category) map[key].category = meta.category;
      });
      return Object.keys(map).map(function (key) {
        return map[key];
      }).sort(function (a, b) { return b.count - a.count; });
    }

    function categoryRanking(events) {
      var byCat = groupCount(events, function (ev) {
        return (ev.meta && ev.meta.category) || 'Senza categoria';
      });
      return Object.keys(byCat).map(function (name) {
        return { name: name, count: byCat[name] };
      }).sort(function (a, b) { return b.count - a.count; });
    }

    return {
      periodDays: days,
      source: 'local',
      totals: {
        downloads: downloads.length,
        sedeClicks: sedeClicks.length,
        unlocks: unlocks.length,
        unlockFails: unlockFails.length,
        blogViews: blogViews.length,
        recipeViews: recipeViews.length,
        contentViews: blogViews.length + recipeViews.length,
        allTimeDownloads: countByType(allEvents, 'download') + countByType(allEvents, 'cv_download'),
        allTimeSedeClicks: countByType(allEvents, 'sede_click'),
        allTimeBlogViews: countByType(allEvents, 'blog_view'),
        allTimeRecipeViews: countByType(allEvents, 'recipe_view'),
        allTimeContentViews: countByType(allEvents, 'blog_view') + countByType(allEvents, 'recipe_view'),
        allTimeEvents: allEvents.length
      },
      trends: {
        downloads: downloads.length - prevDownloads.length,
        sedeClicks: sedeClicks.length - prevSedeClicks.length,
        blogViews: blogViews.length - prevBlogViews.length,
        recipeViews: recipeViews.length - prevRecipeViews.length,
        contentViews: (blogViews.length + recipeViews.length) -
          (prevBlogViews.length + prevRecipeViews.length)
      },
      downloadsOverTime: buildDailySeries(allEvents, ['download', 'cv_download'], days || 90),
      sedeClicksOverTime: buildDailySeries(allEvents, ['sede_click'], days || 90),
      blogViewsOverTime: buildDailySeries(allEvents, ['blog_view'], days || 90),
      recipeViewsOverTime: buildDailySeries(allEvents, ['recipe_view'], days || 90),
      contentViewsOverTime: buildDailySeries(allEvents, ['blog_view', 'recipe_view'], days || 90),
      fileRanking: fileRanking,
      sedeRanking: sedeRanking,
      blogRanking: contentRanking(blogViews),
      recipeRanking: contentRanking(recipeViews),
      blogCategoryRanking: categoryRanking(blogViews),
      recipeCategoryRanking: categoryRanking(recipeViews),
      recentEvents: periodEvents.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 30)
    };
  }

  function getSummary(days) {
    return summarizeEvents(getStore().events, days);
  }

  function fetchRemoteStore() {
    return global.fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (res) {
      if (res.status === 503) {
        remoteAvailable = false;
        return null;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || !data.available || !Array.isArray(data.events)) {
        remoteAvailable = false;
        return null;
      }
      remoteAvailable = true;
      return data;
    });
  }

  function getSummaryAsync(days) {
    return fetchRemoteStore().then(function (data) {
      if (!data) return getSummary(days);
      var summary = summarizeEvents(data.events, days);
      summary.source = 'remote';
      return summary;
    }).catch(function () {
      remoteAvailable = false;
      return getSummary(days);
    });
  }

  function exportJson() {
    return JSON.stringify(getStore(), null, 2);
  }

  function exportJsonAsync() {
    return fetchRemoteStore().then(function (data) {
      if (!data) return exportJson();
      return JSON.stringify({
        events: data.events,
        version: data.version || 1,
        source: 'remote'
      }, null, 2);
    }).catch(function () {
      return exportJson();
    });
  }

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function formatIso(ts) {
    try {
      return new Date(ts).toISOString();
    } catch (e) {
      return '';
    }
  }

  function formatItDateTime(ts) {
    try {
      return new Date(ts).toLocaleString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return formatIso(ts);
    }
  }

  function metaToString(meta) {
    if (!meta || typeof meta !== 'object') return '';
    return Object.keys(meta).map(function (key) {
      var val = meta[key];
      if (typeof val === 'boolean') val = val ? 'sì' : 'no';
      return key + ': ' + val;
    }).join(' · ');
  }

  function typeLabel(type) {
    var map = {
      download: 'Download file',
      cv_download: 'Download CV',
      sede_click: 'Click sede',
      area_unlock: 'Sblocco area',
      blog_view: 'Visita articolo blog',
      recipe_view: 'Visita ricetta'
    };
    return map[type] || type || 'sconosciuto';
  }

  function oncePerSession(key) {
    try {
      if (global.sessionStorage.getItem(key)) return false;
      global.sessionStorage.setItem(key, '1');
      return true;
    } catch (e) {
      return true;
    }
  }

  function excelCell(value, style, type) {
    var t = type || (typeof value === 'number' && isFinite(value) ? 'Number' : 'String');
    var styleAttr = style ? ' ss:StyleID="' + style + '"' : '';
    if (t === 'Number') {
      return '<Cell' + styleAttr + '><Data ss:Type="Number">' + value + '</Data></Cell>';
    }
    return '<Cell' + styleAttr + '><Data ss:Type="String">' + escapeXml(value) + '</Data></Cell>';
  }

  function excelRow(cells, height) {
    var h = height ? ' ss:Height="' + height + '"' : '';
    return '<Row' + h + '>' + cells.join('') + '</Row>';
  }

  function excelEmptyRow() {
    return '<Row></Row>';
  }

  function excelCol(width) {
    return '<Column ss:AutoFitWidth="0" ss:Width="' + width + '"/>';
  }

  function excelWorksheet(name, columns, rows) {
    return [
      '<Worksheet ss:Name="' + escapeXml(name) + '">',
      '<Table>',
      columns.join(''),
      rows.join(''),
      '</Table>',
      '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">',
      '<FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>',
      '<TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>',
      '</WorksheetOptions>',
      '</Worksheet>'
    ].join('');
  }

  function excelWorksheetCover(name, columns, rows) {
    return [
      '<Worksheet ss:Name="' + escapeXml(name) + '">',
      '<Table>',
      columns.join(''),
      rows.join(''),
      '</Table>',
      '</Worksheet>'
    ].join('');
  }

  function buildExportExcel(store, source) {
    store = store || getStore();
    var events = Array.isArray(store.events) ? store.events.slice() : [];
    events.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });

    var firstTs = events.length ? events[0].ts : null;
    var lastTs = events.length ? events[events.length - 1].ts : null;
    var spanDays = 90;
    if (firstTs && lastTs) {
      spanDays = Math.max(1, Math.ceil((startOfDay(lastTs) - startOfDay(firstTs)) / (24 * 60 * 60 * 1000)) + 1);
      spanDays = Math.min(spanDays, 366);
    }

    var summaryAll = summarizeEvents(events, 0);
    var seriesDownloads = buildDailySeries(events, ['download', 'cv_download'], spanDays);
    var seriesSedi = buildDailySeries(events, ['sede_click'], spanDays);
    var exportedAt = new Date().toISOString();
    var exportedAtIt = formatItDateTime(Date.now());
    var siteUrl = (global.location && global.location.origin) || '';
    var sourceLabel = source === 'remote' ? 'Cloud (sincronizzato)' : 'Locale (questo browser)';

    var eventsByType = {};
    events.forEach(function (ev) {
      var t = ev.type || 'unknown';
      eventsByType[t] = (eventsByType[t] || 0) + 1;
    });

    var coverRows = [
      excelRow([excelCell('Analytics — Priscilla Castellani', 'sTitle')], 32),
      excelRow([excelCell('Report scarichi, sedi, blog, ricette e accessi area riservata', 'sSubtitle')], 20),
      excelEmptyRow(),
      excelRow([excelCell('Generato il', 'sLabel'), excelCell(exportedAtIt, 'sValue')]),
      excelRow([excelCell('Fonte dati', 'sLabel'), excelCell(sourceLabel, 'sValue')]),
      excelRow([excelCell('Sito', 'sLabel'), excelCell(siteUrl || '—', 'sValue')]),
      excelRow([excelCell('Periodo dati', 'sLabel'), excelCell(
        (firstTs ? dayKey(firstTs) : '—') + '  →  ' + (lastTs ? dayKey(lastTs) : '—') +
        '  (' + spanDays + ' giorni)',
        'sValue'
      )]),
      excelRow([excelCell('Eventi totali', 'sLabel'), excelCell(events.length, 'sKPI', 'Number')]),
      excelEmptyRow(),
      excelRow([excelCell('KPI principali', 'sSection')], 22),
      excelRow([
        excelCell('Metrica', 'sHeader'),
        excelCell('Valore', 'sHeader'),
        excelCell('Note', 'sHeader')
      ]),
      excelRow([
        excelCell('Download totali', 'sAlt'),
        excelCell(summaryAll.totals.allTimeDownloads, 'sAltNum', 'Number'),
        excelCell('File + CV', 'sAlt')
      ]),
      excelRow([
        excelCell('Click sulle sedi', 'sPlain'),
        excelCell(summaryAll.totals.allTimeSedeClicks, 'sNum', 'Number'),
        excelCell('Link sedi / online', 'sPlain')
      ]),
      excelRow([
        excelCell('Visite articoli blog', 'sAlt'),
        excelCell(summaryAll.totals.allTimeBlogViews, 'sAltNum', 'Number'),
        excelCell('Pagine articolo aperte', 'sAlt')
      ]),
      excelRow([
        excelCell('Visite ricette', 'sPlain'),
        excelCell(summaryAll.totals.allTimeRecipeViews, 'sNum', 'Number'),
        excelCell('Pagine ricetta aperte', 'sPlain')
      ]),
      excelRow([
        excelCell('Sblocchi area riusciti', 'sAlt'),
        excelCell(summaryAll.totals.unlocks, 'sAltNum', 'Number'),
        excelCell('Password corretta', 'sAlt')
      ]),
      excelRow([
        excelCell('Tentativi falliti', 'sPlain'),
        excelCell(summaryAll.totals.unlockFails, 'sNum', 'Number'),
        excelCell('Password errata', 'sPlain')
      ]),
      excelEmptyRow(),
      excelRow([excelCell('Eventi per tipo', 'sSection')], 22),
      excelRow([
        excelCell('Tipo', 'sHeader'),
        excelCell('Etichetta', 'sHeader'),
        excelCell('Conteggio', 'sHeader')
      ])
    ];

    Object.keys(eventsByType).sort().forEach(function (type, i) {
      var style = i % 2 ? 'sAlt' : 'sPlain';
      var numStyle = i % 2 ? 'sAltNum' : 'sNum';
      coverRows.push(excelRow([
        excelCell(type, style),
        excelCell(typeLabel(type), style),
        excelCell(eventsByType[type], numStyle, 'Number')
      ]));
    });

    coverRows.push(excelEmptyRow());
    coverRows.push(excelRow([
      excelCell('Fogli inclusi: Riepilogo · File · Sedi · Blog · Ricette · Serie giornaliera · Log eventi', 'sMuted')
    ]));

    var fileRows = [
      excelRow([
        excelCell('#', 'sHeader'),
        excelCell('File / documento', 'sHeader'),
        excelCell('Download', 'sHeader'),
        excelCell('% sul totale', 'sHeader')
      ])
    ];
    var fileTotal = summaryAll.totals.allTimeDownloads || 1;
    summaryAll.fileRanking.forEach(function (row, i) {
      var style = i % 2 ? 'sAlt' : 'sPlain';
      var numStyle = i % 2 ? 'sAltNum' : 'sNum';
      var pct = Math.round((row.count / fileTotal) * 1000) / 10;
      fileRows.push(excelRow([
        excelCell(i + 1, numStyle, 'Number'),
        excelCell(row.name, style),
        excelCell(row.count, numStyle, 'Number'),
        excelCell(pct, numStyle, 'Number')
      ]));
    });
    if (!summaryAll.fileRanking.length) {
      fileRows.push(excelRow([excelCell('—', 'sMuted'), excelCell('Nessun download registrato', 'sMuted')]));
    }

    var sedeRows = [
      excelRow([
        excelCell('#', 'sHeader'),
        excelCell('Sede', 'sHeader'),
        excelCell('Click', 'sHeader'),
        excelCell('% sul totale', 'sHeader')
      ])
    ];
    var sedeTotal = summaryAll.totals.allTimeSedeClicks || 1;
    summaryAll.sedeRanking.forEach(function (row, i) {
      var style = i % 2 ? 'sAlt' : 'sPlain';
      var numStyle = i % 2 ? 'sAltNum' : 'sNum';
      var pct = Math.round((row.count / sedeTotal) * 1000) / 10;
      sedeRows.push(excelRow([
        excelCell(i + 1, numStyle, 'Number'),
        excelCell(row.name, style),
        excelCell(row.count, numStyle, 'Number'),
        excelCell(pct, numStyle, 'Number')
      ]));
    });
    if (!summaryAll.sedeRanking.length) {
      sedeRows.push(excelRow([excelCell('—', 'sMuted'), excelCell('Nessun click sede registrato', 'sMuted')]));
    }

    function rankingSheetRows(ranking, emptyLabel) {
      var rows = [
        excelRow([
          excelCell('#', 'sHeader'),
          excelCell('Titolo', 'sHeader'),
          excelCell('Categoria', 'sHeader'),
          excelCell('Visite', 'sHeader'),
          excelCell('% sul totale', 'sHeader')
        ])
      ];
      var total = ranking.reduce(function (sum, row) { return sum + row.count; }, 0) || 1;
      ranking.forEach(function (row, i) {
        var style = i % 2 ? 'sAlt' : 'sPlain';
        var numStyle = i % 2 ? 'sAltNum' : 'sNum';
        var pct = Math.round((row.count / total) * 1000) / 10;
        rows.push(excelRow([
          excelCell(i + 1, numStyle, 'Number'),
          excelCell(row.name, style),
          excelCell(row.category || '—', style),
          excelCell(row.count, numStyle, 'Number'),
          excelCell(pct, numStyle, 'Number')
        ]));
      });
      if (!ranking.length) {
        rows.push(excelRow([excelCell('—', 'sMuted'), excelCell(emptyLabel, 'sMuted')]));
      }
      return rows;
    }

    var blogRows = rankingSheetRows(summaryAll.blogRanking, 'Nessuna visita articolo registrata');
    var recipeRows = rankingSheetRows(summaryAll.recipeRanking, 'Nessuna visita ricetta registrata');

    var seriesBlog = buildDailySeries(events, ['blog_view'], spanDays);
    var seriesRecipes = buildDailySeries(events, ['recipe_view'], spanDays);
    var seriesByDate = {};
    seriesDownloads.forEach(function (row) {
      seriesByDate[row.date] = {
        date: row.date,
        downloads: row.count,
        sedeClicks: 0,
        blogViews: 0,
        recipeViews: 0
      };
    });
    seriesSedi.forEach(function (row) {
      if (!seriesByDate[row.date]) {
        seriesByDate[row.date] = {
          date: row.date,
          downloads: 0,
          sedeClicks: row.count,
          blogViews: 0,
          recipeViews: 0
        };
      } else {
        seriesByDate[row.date].sedeClicks = row.count;
      }
    });
    seriesBlog.forEach(function (row) {
      if (!seriesByDate[row.date]) {
        seriesByDate[row.date] = {
          date: row.date,
          downloads: 0,
          sedeClicks: 0,
          blogViews: row.count,
          recipeViews: 0
        };
      } else {
        seriesByDate[row.date].blogViews = row.count;
      }
    });
    seriesRecipes.forEach(function (row) {
      if (!seriesByDate[row.date]) {
        seriesByDate[row.date] = {
          date: row.date,
          downloads: 0,
          sedeClicks: 0,
          blogViews: 0,
          recipeViews: row.count
        };
      } else {
        seriesByDate[row.date].recipeViews = row.count;
      }
    });

    var seriesRows = [
      excelRow([
        excelCell('Data', 'sHeader'),
        excelCell('Download', 'sHeader'),
        excelCell('Click sedi', 'sHeader'),
        excelCell('Visite blog', 'sHeader'),
        excelCell('Visite ricette', 'sHeader'),
        excelCell('Totale giorno', 'sHeader')
      ])
    ];
    Object.keys(seriesByDate).sort().forEach(function (key, i) {
      var row = seriesByDate[key];
      var style = i % 2 ? 'sAlt' : 'sPlain';
      var numStyle = i % 2 ? 'sAltNum' : 'sNum';
      var total = (row.downloads || 0) + (row.sedeClicks || 0) +
        (row.blogViews || 0) + (row.recipeViews || 0);
      seriesRows.push(excelRow([
        excelCell(row.date, style),
        excelCell(row.downloads || 0, numStyle, 'Number'),
        excelCell(row.sedeClicks || 0, numStyle, 'Number'),
        excelCell(row.blogViews || 0, numStyle, 'Number'),
        excelCell(row.recipeViews || 0, numStyle, 'Number'),
        excelCell(total, numStyle, 'Number')
      ]));
    });

    var logRows = [
      excelRow([
        excelCell('Data/ora', 'sHeader'),
        excelCell('Giorno', 'sHeader'),
        excelCell('Tipo', 'sHeader'),
        excelCell('Etichetta', 'sHeader'),
        excelCell('Dettagli', 'sHeader'),
        excelCell('ID evento', 'sHeader')
      ])
    ];
    events.slice().reverse().forEach(function (ev, i) {
      var style = i % 2 ? 'sAlt' : 'sPlain';
      logRows.push(excelRow([
        excelCell(formatItDateTime(ev.ts), style),
        excelCell(dayKey(ev.ts || 0), style),
        excelCell(ev.type || '', style),
        excelCell(typeLabel(ev.type), style),
        excelCell(metaToString(ev.meta), style),
        excelCell(ev.id || '', style)
      ]));
    });
    if (!events.length) {
      logRows.push(excelRow([excelCell('Nessun evento nel periodo', 'sMuted')]));
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
      ' xmlns:o="urn:schemas-microsoft-com:office:office"',
      ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
      ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
      ' xmlns:html="http://www.w3.org/TR/REC-html40">',
      '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">',
      '<Title>Analytics Priscilla Castellani</Title>',
      '<Subject>Report analytics sito</Subject>',
      '<Author>Priscilla Castellani Admin</Author>',
      '<Created>' + escapeXml(exportedAt) + '</Created>',
      '</DocumentProperties>',
      '<Styles>',
      '<Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/></Style>',
      '<Style ss:ID="sTitle"><Font ss:FontName="Calibri" ss:Size="20" ss:Bold="1" ss:Color="#1D4ED8"/><Alignment ss:Vertical="Center"/></Style>',
      '<Style ss:ID="sSubtitle"><Font ss:FontName="Calibri" ss:Size="12" ss:Color="#4B5563"/><Alignment ss:Vertical="Center"/></Style>',
      '<Style ss:ID="sSection"><Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#1E3A8A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>',
      '<Style ss:ID="sHeader"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#3B82F6" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2563EB"/></Borders></Style>',
      '<Style ss:ID="sLabel"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#374151"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style>',
      '<Style ss:ID="sValue"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/></Style>',
      '<Style ss:ID="sKPI"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#1D4ED8"/><NumberFormat ss:Format="#,##0"/></Style>',
      '<Style ss:ID="sPlain"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/><Alignment ss:Vertical="Center"/></Style>',
      '<Style ss:ID="sAlt"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>',
      '<Style ss:ID="sNum"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="#,##0"/></Style>',
      '<Style ss:ID="sAltNum"><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/><NumberFormat ss:Format="#,##0"/></Style>',
      '<Style ss:ID="sMuted"><Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#9CA3AF"/></Style>',
      '</Styles>',
      excelWorksheetCover('Riepilogo', [
        excelCol(200), excelCol(160), excelCol(220)
      ], coverRows),
      excelWorksheet('File', [
        excelCol(40), excelCol(320), excelCol(90), excelCol(100)
      ], fileRows),
      excelWorksheet('Sedi', [
        excelCol(40), excelCol(280), excelCol(90), excelCol(100)
      ], sedeRows),
      excelWorksheet('Blog', [
        excelCol(40), excelCol(320), excelCol(140), excelCol(90), excelCol(100)
      ], blogRows),
      excelWorksheet('Ricette', [
        excelCol(40), excelCol(320), excelCol(140), excelCol(90), excelCol(100)
      ], recipeRows),
      excelWorksheet('Serie giornaliera', [
        excelCol(110), excelCol(100), excelCol(100), excelCol(100), excelCol(110), excelCol(110)
      ], seriesRows),
      excelWorksheet('Log eventi', [
        excelCol(150), excelCol(90), excelCol(110), excelCol(130), excelCol(420), excelCol(200)
      ], logRows),
      '</Workbook>'
    ].join('');
  }

  function exportExcel() {
    return buildExportExcel(getStore(), 'local');
  }

  function exportExcelAsync() {
    return fetchRemoteStore().then(function (data) {
      if (!data) return exportExcel();
      return buildExportExcel({
        events: data.events,
        version: data.version || 1
      }, 'remote');
    }).catch(function () {
      return exportExcel();
    });
  }

  /** @deprecated usa exportExcel — resta per compatibilità */
  function exportXml() {
    return exportExcel();
  }

  function exportXmlAsync() {
    return exportExcelAsync();
  }

  function clearAll() {
    saveStore({ events: [], version: 1 });
    notify('clear');
    try {
      global.fetch(API_URL, { method: 'DELETE', keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  function clearAllAsync() {
    saveStore({ events: [], version: 1 });
    return global.fetch(API_URL, { method: 'DELETE' }).then(function (res) {
      if (res.status === 503) remoteAvailable = false;
      notify('clear');
      return res.ok || res.status === 503;
    }).catch(function () {
      notify('clear');
      return false;
    });
  }

  function isRemoteAvailable() {
    return remoteAvailable;
  }

  global.PriscillaAnalytics = {
    STORAGE_KEY: STORAGE_KEY,
    track: track,
    trackDownload: function (fileTitle, fileName, mimeType) {
      track('download', {
        fileTitle: fileTitle || '',
        fileName: fileName || '',
        mimeType: mimeType || ''
      });
    },
    trackCvDownload: function () {
      track('cv_download', { fileTitle: 'CV Priscilla Castellani' });
    },
    trackSedeClick: function (sedeId, sedeName, url, online) {
      track('sede_click', {
        sedeId: sedeId || '',
        sedeName: sedeName || '',
        url: url || '',
        online: !!online
      });
    },
    trackAreaUnlock: function (success) {
      track('area_unlock', { success: !!success });
    },
    trackBlogView: function (id, title, category) {
      if (!id) return;
      if (!oncePerSession('analytics_blog_view_' + id)) return;
      track('blog_view', {
        id: String(id),
        title: title || '',
        category: category || ''
      });
    },
    trackRecipeView: function (id, title, category) {
      if (!id) return;
      if (!oncePerSession('analytics_recipe_view_' + id)) return;
      track('recipe_view', {
        id: String(id),
        title: title || '',
        category: category || ''
      });
    },
    getEvents: getEvents,
    getSummary: getSummary,
    getSummaryAsync: getSummaryAsync,
    clearAll: clearAll,
    clearAllAsync: clearAllAsync,
    exportJson: exportJson,
    exportJsonAsync: exportJsonAsync,
    exportExcel: exportExcel,
    exportExcelAsync: exportExcelAsync,
    exportXml: exportXml,
    exportXmlAsync: exportXmlAsync,
    isRemoteAvailable: isRemoteAvailable,
    dayKey: dayKey
  };
})(typeof window !== 'undefined' ? window : this);
