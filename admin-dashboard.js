(function () {
  'use strict';

  var PERIOD_KEY = 'admin_dashboard_period';
  var currentPeriod = 30;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('it-IT').format(n || 0);
  }

  function formatDate(ts) {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(ts));
  }

  function formatDateTime(ts) {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  }

  function formatTrend(delta) {
    if (!delta) return '<span class="dash-trend dash-trend--neutral">→ invariato</span>';
    if (delta > 0) return '<span class="dash-trend dash-trend--up">↑ +' + formatNumber(delta) + '</span>';
    return '<span class="dash-trend dash-trend--down">↓ ' + formatNumber(delta) + '</span>';
  }

  function buildInsight(summary) {
    var t = summary.totals;
    var tr = summary.trends;
    var periodLabel = currentPeriod ? 'negli ultimi ' + currentPeriod + ' giorni' : 'nel periodo selezionato';
    var downloadWord = t.downloads === 1 ? 'scarico' : 'scarichi';
    var clickWord = t.sedeClicks === 1 ? 'click' : 'click';
    var items = [
      'Hai registrato <strong>' + formatNumber(t.downloads) + ' ' + downloadWord + '</strong> ' + periodLabel +
        (tr.downloads ? ' (' + (tr.downloads > 0 ? '+' : '') + formatNumber(tr.downloads) + ' vs periodo precedente).' : '.'),
      'Le sedi hanno ricevuto <strong>' + formatNumber(t.sedeClicks) + ' ' + clickWord + '</strong>' +
        (summary.sedeRanking[0] ? ', con «' + escapeHtml(summary.sedeRanking[0].name) + '» in testa.' : '.'),
      'Area download: <strong>' + formatNumber(t.unlocks) + (t.unlocks === 1 ? ' accesso' : ' accessi') + '</strong>' +
        (t.unlockFails ? ' e ' + formatNumber(t.unlockFails) + ' tentativi falliti.' : '.')
    ];
    return '<div class="dash-insight-label">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 3l1.8 4.8L19 9.5l-4 3.2L16.5 18 12 15.3 7.5 18l1.5-5.3-4-3.2 5.2-1.7Z"/></svg>' +
      'Sintesi periodo</div>' +
      '<ol class="dash-insight-list">' +
      items.map(function (txt, i) {
        return '<li><span class="dash-insight-num">' + (i + 1) + '</span><span>' + txt + '</span></li>';
      }).join('') +
      '</ol>';
  }

  function eventLabel(ev) {
    var meta = ev.meta || {};
    switch (ev.type) {
      case 'download':
        return 'Scaricato «' + (meta.fileTitle || meta.fileName || 'documento') + '»';
      case 'cv_download':
        return 'Scaricato CV';
      case 'sede_click':
        return 'Click su sede «' + (meta.sedeName || meta.sedeId || 'sede') + '»';
      case 'area_unlock':
        return meta.success ? 'Accesso area download riuscito' : 'Tentativo accesso fallito';
      default:
        return ev.type;
    }
  }

  function eventIcon(type) {
    switch (type) {
      case 'download': return '📥';
      case 'cv_download': return '📄';
      case 'sede_click': return '📍';
      case 'area_unlock': return '🔑';
      default: return '•';
    }
  }

  var chartGradId = 0;

  function buildLineChart(series, opts) {
    opts = opts || {};
    var color = opts.color || '#3b82f6';
    var height = opts.height || 160;
    if (!series.length) {
      return '<div class="dash-chart-empty">Nessun dato nel periodo selezionato</div>';
    }
    var gradId = 'dashAreaGrad' + (++chartGradId);
    var max = Math.max.apply(null, series.map(function (d) { return d.count; }).concat([1]));
    var width = 100;
    var step = series.length > 1 ? width / (series.length - 1) : 0;
    var points = series.map(function (d, i) {
      var x = series.length > 1 ? i * step : width / 2;
      var y = height - (d.count / max) * (height - 12) - 6;
      return { x: x, y: y, count: d.count, date: d.date };
    });
    var linePath = points.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2);
    }).join(' ');
    var areaPath = linePath +
      ' L' + points[points.length - 1].x.toFixed(2) + ',' + height +
      ' L' + points[0].x.toFixed(2) + ',' + height + ' Z';
    var dots = points.filter(function (p) { return p.count > 0; }).map(function (p) {
      return '<circle cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="2.5" class="dash-chart-dot">' +
        '<title>' + escapeHtml(p.date) + ': ' + p.count + '</title></circle>';
    }).join('');
    var labels = '';
    if (series.length >= 2) {
      labels = '<div class="dash-chart-labels">' +
        '<span>' + escapeHtml(formatChartLabel(series[0].date)) + '</span>' +
        '<span>' + escapeHtml(formatChartLabel(series[series.length - 1].date)) + '</span>' +
        '</div>';
    }
    return '<div class="dash-line-chart">' +
      '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.22"/>' +
          '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.02"/>' +
        '</linearGradient></defs>' +
        '<path d="' + areaPath + '" fill="url(#' + gradId + ')"/>' +
        '<path d="' + linePath + '" fill="none" stroke="' + color + '" stroke-width="1.8" vector-effect="non-scaling-stroke"/>' +
        dots +
      '</svg>' +
      labels +
      '</div>';
  }

  function buildColumnChart(series, opts) {
    opts = opts || {};
    var color = opts.color || '#3b82f6';
    var height = opts.height || 160;
    if (!series.length) {
      return '<div class="dash-chart-empty">Nessun dato nel periodo selezionato</div>';
    }
    var max = Math.max.apply(null, series.map(function (d) { return d.count; }).concat([1]));
    var gap = series.length > 40 ? 0.2 : 0.35;
    var slot = 100 / series.length;
    var barW = Math.max(slot * (1 - gap), 0.35);
    var bars = series.map(function (d, i) {
      var barH = d.count > 0 ? (d.count / max) * (height - 10) : 0;
      var x = i * slot + (slot - barW) / 2;
      var y = height - barH;
      return '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barW.toFixed(2) +
        '" height="' + barH.toFixed(2) + '" rx="0.4" fill="' + color + '" opacity="' + (d.count > 0 ? '0.9' : '0') + '">' +
        '<title>' + escapeHtml(formatChartLabel(d.date)) + ': ' + d.count + '</title></rect>';
    }).join('');
    var labels = '';
    if (series.length >= 2) {
      labels = '<div class="dash-chart-labels">' +
        '<span>' + escapeHtml(formatChartLabel(series[0].date)) + '</span>' +
        '<span>' + escapeHtml(formatChartLabel(series[series.length - 1].date)) + '</span>' +
        '</div>';
    }
    return '<div class="dash-line-chart">' +
      '<svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" aria-hidden="true">' + bars + '</svg>' +
      labels +
      '</div>';
  }

  function formatChartLabel(dateStr) {
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(d);
  }

  function buildBarChart(items, opts) {
    opts = opts || {};
    var color = opts.color || '#3b82f6';
    if (!items.length) {
      return '<div class="dash-chart-empty">Nessun dato nel periodo selezionato</div>';
    }
    var max = Math.max.apply(null, items.map(function (d) { return d.count; }).concat([1]));
    var top = items.slice(0, opts.limit || 8);
    return '<ul class="dash-bar-list">' + top.map(function (item) {
      var pct = Math.round((item.count / max) * 100);
      return '<li class="dash-bar-item">' +
        '<div class="dash-bar-head">' +
          '<span class="dash-bar-label">' + escapeHtml(item.name) + '</span>' +
          '<span class="dash-bar-value">' + formatNumber(item.count) + '</span>' +
        '</div>' +
        '<div class="dash-bar-track"><span class="dash-bar-fill" style="width:' + pct + '%;background:' + color + '"></span></div>' +
      '</li>';
    }).join('') + '</ul>';
  }

  function renderContentStats() {
    try {
      var pdfs = JSON.parse(localStorage.getItem('scarica_pdfs') || '[]');
      var blog = JSON.parse(localStorage.getItem('blog_articoli') || '[]');
      var ricette = JSON.parse(localStorage.getItem('ricette') || '[]');
      var sedi = window.PriscillaSedi ? window.PriscillaSedi.getActiveSedi() : [];
      var map = {
        statFile: pdfs.length,
        statArticoli: blog.length,
        statRicette: ricette.length,
        statSedi: sedi.length
      };
      Object.keys(map).forEach(function (id) {
        var el = $(id);
        if (el) el.textContent = map[id];
      });
    } catch (e) {}
  }

  function applySummary(summary) {
    var t = summary.totals;
    var tr = summary.trends;

    var insightEl = $('dashboardInsight');
    if (insightEl) insightEl.innerHTML = buildInsight(summary);

    var heroVal = $('heroDownloadsValue');
    if (heroVal) heroVal.textContent = formatNumber(t.downloads);
    var heroTrend = $('heroDownloadsTrend');
    if (heroTrend) heroTrend.innerHTML = formatTrend(tr.downloads);

    var kpiHtml = [
      { id: 'kpiDownloads', value: t.downloads, label: 'Scarichi nel periodo', trend: tr.downloads, icon: '↓' },
      { id: 'kpiDownloadsAll', value: t.allTimeDownloads, label: 'Scarichi totali', sub: 'dall\'avvio tracking', icon: 'Σ' },
      { id: 'kpiSedi', value: t.sedeClicks, label: 'Click sulle sedi', trend: tr.sedeClicks, icon: '◎' },
      { id: 'kpiUnlocks', value: t.unlocks, label: 'Accessi area download', sub: t.unlockFails ? t.unlockFails + ' tentativi falliti' : '', icon: '⌁' }
    ];

    var kpiEl = $('dashboardKpis');
    if (kpiEl) {
      kpiEl.innerHTML = kpiHtml.map(function (k) {
        return '<article class="admin-stat admin-stat--kpi">' +
          '<span class="admin-stat-icon" aria-hidden="true">' + k.icon + '</span>' +
          '<span class="admin-stat-value">' + formatNumber(k.value) + '</span>' +
          '<span class="admin-stat-label">' + escapeHtml(k.label) + '</span>' +
          (k.trend !== undefined ? formatTrend(k.trend) : '') +
          (k.sub ? '<span class="dash-stat-sub">' + escapeHtml(k.sub) + '</span>' : '') +
        '</article>';
      }).join('');
    }

    var downloadsChart = $('chartDownloads');
    if (downloadsChart) {
      downloadsChart.innerHTML = buildLineChart(summary.downloadsOverTime, { color: '#3b82f6', height: 140 });
    }

    var sedeTimeChart = $('chartSediTime');
    if (sedeTimeChart) {
      sedeTimeChart.innerHTML = buildColumnChart(summary.sedeClicksOverTime, { color: '#0d9488', height: 160 });
    }

    var filesChart = $('chartFiles');
    if (filesChart) {
      filesChart.innerHTML = buildBarChart(summary.fileRanking, { color: '#3b82f6', limit: 6 });
    }

    var sediChart = $('chartSedi');
    if (sediChart) {
      sediChart.innerHTML = buildBarChart(summary.sedeRanking, { color: '#0d9488', limit: 8 });
    }

    var activityEl = $('dashboardActivity');
    if (activityEl) {
      if (!summary.recentEvents.length) {
        activityEl.innerHTML = '<li class="dash-activity-empty">Nessuna attività registrata. Gli eventi compariranno quando gli utenti scaricano materiali o cliccano sulle sedi.</li>';
      } else {
        activityEl.innerHTML = summary.recentEvents.map(function (ev) {
          return '<li class="dash-activity-item">' +
            '<span class="dash-activity-icon" aria-hidden="true">' + eventIcon(ev.type) + '</span>' +
            '<div class="dash-activity-body">' +
              '<span class="dash-activity-text">' + escapeHtml(eventLabel(ev)) + '</span>' +
              '<time class="dash-activity-time" datetime="' + new Date(ev.ts).toISOString() + '">' + formatDateTime(ev.ts) + '</time>' +
            '</div>' +
          '</li>';
        }).join('');
      }
    }

    var sourceLabel = summary.source === 'remote'
      ? 'sincronizzati (tutti i browser)'
      : 'solo questo browser';
    var metaEl = $('dashboardMeta');
    if (metaEl) {
      metaEl.textContent = 'Periodo: ' + (currentPeriod ? 'ultimi ' + currentPeriod + ' giorni' : 'tutto') +
        ' · ' + formatNumber(t.allTimeEvents) + ' eventi ' + sourceLabel +
        ' · aggiornato ' + formatDateTime(Date.now());
    }

    renderContentStats();
  }

  function renderDashboard() {
    var api = window.PriscillaAnalytics;
    if (!api) return;

    applySummary(api.getSummary(currentPeriod));

    if (typeof api.getSummaryAsync === 'function') {
      api.getSummaryAsync(currentPeriod).then(function (summary) {
        applySummary(summary);
      }).catch(function () {});
    }
  }

  function bindControls() {
    var stored = parseInt(localStorage.getItem(PERIOD_KEY) || '30', 10);
    if ([7, 30, 90, 0].indexOf(stored) >= 0) currentPeriod = stored;

    document.querySelectorAll('[data-period]').forEach(function (btn) {
      var val = parseInt(btn.getAttribute('data-period'), 10);
      if (val === currentPeriod) btn.classList.add('dash-filter-btn--active');
      btn.addEventListener('click', function () {
        currentPeriod = val;
        localStorage.setItem(PERIOD_KEY, String(val));
        document.querySelectorAll('[data-period]').forEach(function (b) {
          b.classList.toggle('dash-filter-btn--active', parseInt(b.getAttribute('data-period'), 10) === val);
        });
        renderDashboard();
      });
    });

    function exportAnalytics() {
      var api = window.PriscillaAnalytics;
      if (!api) return;
      var finish = function (excel) {
        var blob = new Blob([excel], {
          type: 'application/vnd.ms-excel;charset=utf-8'
        });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'analytics-priscilla-' + new Date().toISOString().slice(0, 10) + '.xls';
        a.click();
        URL.revokeObjectURL(url);
      };
      var run = api.exportExcelAsync || api.exportXmlAsync;
      var sync = api.exportExcel || api.exportXml;
      if (typeof run === 'function') {
        run.call(api).then(finish).catch(function () {
          finish(typeof sync === 'function' ? sync.call(api) : '');
        });
      } else if (typeof sync === 'function') {
        finish(sync.call(api));
      }
    }

    var exportBtn = $('btnExportAnalytics');
    if (exportBtn) exportBtn.addEventListener('click', exportAnalytics);
    var exportBtnTop = $('btnExportAnalyticsTop');
    if (exportBtnTop) exportBtnTop.addEventListener('click', exportAnalytics);

    var resetBtn = $('btnResetAnalytics');
    var resetDialog = $('resetAnalyticsConfirm');
    var resetConfirmBtn = $('btnResetAnalyticsConfirm');

    function closeResetDialog() {
      if (!resetDialog) return;
      resetDialog.hidden = true;
      document.body.classList.remove('admin-confirm-open');
    }

    function openResetDialog() {
      if (!resetDialog) return;
      resetDialog.hidden = false;
      document.body.classList.add('admin-confirm-open');
      if (resetConfirmBtn) resetConfirmBtn.focus();
    }

    function resetAnalytics() {
      var api = window.PriscillaAnalytics;
      if (!api) return;
      closeResetDialog();
      if (typeof api.clearAllAsync === 'function') {
        api.clearAllAsync().then(function () { renderDashboard(); });
      } else {
        api.clearAll();
        renderDashboard();
      }
    }

    if (resetBtn) resetBtn.addEventListener('click', openResetDialog);
    if (resetConfirmBtn) resetConfirmBtn.addEventListener('click', resetAnalytics);
    if (resetDialog) {
      resetDialog.querySelectorAll('[data-confirm-dismiss]').forEach(function (el) {
        el.addEventListener('click', closeResetDialog);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && resetDialog && !resetDialog.hidden) closeResetDialog();
      });
    }

    window.addEventListener('analytics-updated', renderDashboard);
    window.addEventListener('storage', function (e) {
      if (e.key === 'priscilla_analytics') renderDashboard();
    });
  }

  function init() {
    if (!document.body.classList.contains('admin-page-dashboard')) return;
    bindControls();
    renderDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
