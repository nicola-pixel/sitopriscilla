(function (global) {
  'use strict';

  var STORAGE_KEY = 'cv_contenuto';

  var IT_MONTHS = {
    gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
    luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12
  };

  /** Chiave numerica per ordinare le date CV (più recente = valore più alto). */
  function cvDateSortKey(dateStr) {
    var raw = String(dateStr || '').trim().toLowerCase();
    if (!raw) return 0;
    var ongoing = /\bin corso\b/.test(raw);
    // Usa la parte finale del periodo ("2017 – 2020", "Aprile 2022 – In corso").
    var parts = raw.split(/\s*[–—\-]\s*/);
    var focus = (parts.length > 1 ? parts[parts.length - 1] : parts[0]) || raw;
    if (/\bin corso\b/.test(focus)) {
      focus = parts[0] || focus;
      ongoing = true;
    }
    var yearMatch = focus.match(/(19|20)\d{2}/);
    if (!yearMatch) {
      yearMatch = raw.match(/(19|20)\d{2}/g);
      if (!yearMatch || !yearMatch.length) return ongoing ? 999999 : 0;
      yearMatch = [yearMatch[yearMatch.length - 1]];
    }
    var year = parseInt(yearMatch[0], 10);
    var month = 0;
    Object.keys(IT_MONTHS).forEach(function (name) {
      if (focus.indexOf(name) >= 0 || raw.indexOf(name) >= 0) month = IT_MONTHS[name];
    });
    // "In corso" resta sopra ai periodi chiusi dello stesso anno.
    return year * 100 + month + (ongoing ? 50 : 0);
  }

  function sortEntriesNewestFirst(entries) {
    return (entries || []).slice().sort(function (a, b) {
      return cvDateSortKey(b && b.date) - cvDateSortKey(a && a.date);
    });
  }

  var DEFAULT_CV = {
    sections: [
      {
        key: 'experience',
        title: 'Esperienze professionali',
        timeline: true,
        entries: sortEntriesNewestFirst([
          {
            id: 'cv_exp_1',
            org: 'Tirocinio Curricolare, Ospedale Niguarda di Milano',
            detail: '',
            date: 'Febbraio 2019 – Settembre 2019',
            texts: [
              'Reparto DCA: assistenza ai pasti, partecipazione alle visite nutrizionali delle pazienti in Day Hospital per Anoressia Nervosa, Bulimia, Binge Eating.',
              'Reparto GO: partecipazione alle visite ambulatoriali presso il reparto di Dietetica e Nutrizione Clinica e ai gruppi di educazione alimentare rivolti a pazienti affetti da sovrappeso e obesità di vario grado. Svolgimento del test di calorimetria indiretta per la misurazione del metabolismo basale e della bioimpedenziometria per la stima dei tessuti magri corporei.'
            ]
          },
          {
            id: 'cv_exp_2',
            org: 'Biologa nutrizionista, Health and Sport Nutrition (Milano)',
            detail: '',
            date: 'Aprile 2022 – In corso',
            texts: [
              'Visite nutrizionali che prevedono anamnesi clinica, anamnesi alimentare, valutazione dello stato nutrizionale, valutazione della composizione corporea mediante bioimpedenziometria (BIA) e metodo antropoplicometrico.',
              'Elaborazione di piani alimentari in soggetti sportivi, sedentari, sani e affetti da patologie cardiometaboliche.'
            ]
          },
          {
            id: 'cv_exp_3',
            org: 'Dietista, MyNutritional (Milano)',
            detail: '',
            date: 'Febbraio 2023 – Giugno 2023',
            texts: [
              'Visite nutrizionali che prevedono anamnesi clinica, anamnesi alimentare, valutazione dello stato nutrizionale, valutazione della composizione corporea mediante bioimpedenziometria (BIA), test del metabolismo basale con calorimetria indiretta.',
              'Elaborazione di piani alimentari in soggetti sportivi, sedentari, sani e affetti da patologie cardiometaboliche.'
            ]
          },
          {
            id: 'cv_exp_4',
            org: 'Nutrizionista sportiva, AC Milan',
            detail: '',
            date: 'Aprile 2023 – In corso',
            texts: [
              'Settore giovanile maschile e femminile.',
              "Anamnesi alimentari, visite nutrizionali e valutazione della composizione corporea (antropometria, plicometria) degli atleti e atlete, elaborazione di piani alimentari personalizzati, supporto nella gestione dell'integrazione degli atleti e nella preparazione di menù stagionali per il convitto, elaborazione di menù per le trasferte delle squadre, programmazione e organizzazione di test fisici mensili e gestione del database."
            ]
          },
          {
            id: 'cv_exp_5',
            org: 'Nutrizionista sportiva, FIGC — Federazione Italiana Giuoco Calcio',
            detail: '',
            date: 'Settembre 2023 – In corso',
            texts: [
              'U16-17 femminile.',
              "Anamnesi alimentari, visite nutrizionali e valutazione della composizione corporea (antropometria, plicometria) delle giocatrici, elaborazione di piani alimentari personalizzati, gestione dell'integrazione, elaborazione di menù per i ritiri."
            ]
          },
          {
            id: 'cv_exp_6',
            org: 'Biologa nutrizionista, Serenis (Online)',
            detail: '',
            date: 'Ottobre 2024 – In corso',
            texts: [
              'Visite nutrizionali online che prevedono anamnesi clinica, anamnesi alimentare, valutazione dello stato nutrizionale.'
            ]
          }
        ])
      },
      {
        key: 'education',
        title: 'Istruzione e formazione',
        timeline: false,
        entries: sortEntriesNewestFirst([
          {
            id: 'cv_edu_1',
            org: 'Istituto Sacro Cuore, Modena',
            detail: 'Diploma secondario: Liceo Scientifico',
            date: 'Anno Maturità: 2016',
            texts: []
          },
          {
            id: 'cv_edu_2',
            org: 'Università degli Studi di Milano — Facoltà di Medicina e Chirurgia',
            detail: 'Corso di Laurea Triennale in Dietistica',
            date: '2017 – 2020',
            texts: []
          },
          {
            id: 'cv_edu_3',
            org: 'Università degli Studi di Milano — Facoltà di Scienze Agrarie e Alimentari',
            detail: 'Corso di Laurea Magistrale in Alimentazione e Nutrizione Umana',
            date: '2020 – 2022',
            texts: []
          }
        ])
      },
      {
        key: 'courses',
        title: 'Corsi e certificazioni',
        timeline: false,
        entries: sortEntriesNewestFirst([
          {
            id: 'cv_crs_1',
            org: 'International Society for the Advancement Kinanthropometry (ISAK) — Livello 2',
            detail: '',
            date: 'Maggio 2023',
            texts: [
              'Certificazione internazionale per la valutazione della composizione corporea mediante metodica antropometrica standardizzata.'
            ]
          },
          {
            id: 'cv_crs_2',
            org: 'Gestione Ambulatoriale del Paziente con Alimentazione Vegetale — Plant Based Clinic',
            detail: '',
            date: 'Dicembre 2022',
            texts: []
          },
          {
            id: 'cv_crs_3',
            org: 'Scuola di nutrizione e integrazione nello sport — SANIS (Padova)',
            detail: '',
            date: '',
            texts: []
          }
        ])
      }
    ]
  };

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function cloneDefaultCv() {
    return JSON.parse(JSON.stringify(DEFAULT_CV));
  }

  function normalizeCv(data) {
    var base = cloneDefaultCv();
    if (!data || !Array.isArray(data.sections)) return base;

    base.sections.forEach(function (defaultSection) {
      var saved = data.sections.find(function (s) { return s && s.key === defaultSection.key; });
      if (!saved || !Array.isArray(saved.entries)) return;
      defaultSection.entries = sortEntriesNewestFirst(
        saved.entries.map(function (entry, index) {
          return {
            id: entry.id || (defaultSection.key + '_' + index + '_' + Date.now()),
            org: String(entry.org || '').trim(),
            detail: String(entry.detail || '').trim(),
            date: String(entry.date || '').trim(),
            texts: Array.isArray(entry.texts) ? entry.texts.map(function (t) { return String(t || '').trim(); }).filter(Boolean) : []
          };
        }).filter(function (entry) { return entry.org; })
      );
    });

    return base;
  }

  function getCvContent() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeCv(JSON.parse(raw));
    } catch (e) {}
    return cloneDefaultCv();
  }

  function setCvContent(data) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeCv(data)));
    try {
      global.dispatchEvent(new Event('cv-content-updated'));
    } catch (e) {}
  }

  function getSectionByKey(key) {
    return getCvContent().sections.find(function (s) { return s.key === key; }) || null;
  }

  function renderEntryHtml(entry, sectionKey) {
    var html = '<div class="cv-entry">';
    html += '<p class="cv-entry-org">' + escapeHtml(entry.org) + '</p>';
    if (sectionKey === 'education' && entry.detail) {
      html += '<p class="cv-entry-detail">' + escapeHtml(entry.detail) + '</p>';
    }
    if (entry.date) {
      html += '<p class="cv-entry-date">' + escapeHtml(entry.date) + '</p>';
    }
    (entry.texts || []).forEach(function (text) {
      html += '<p class="cv-text">' + escapeHtml(text) + '</p>';
    });
    html += '</div>';
    return html;
  }

  function renderCvModal(container) {
    if (!container) return;
    var data = getCvContent();
    var html = '';

    data.sections.forEach(function (section) {
      var sectionClass = 'cv-section' + (section.timeline ? ' cv-section--timeline' : '');
      html += '<section class="' + sectionClass + '">';
      html += '<h3 class="cv-section-title">' + escapeHtml(section.title) + '</h3>';
      if (section.timeline) html += '<div class="cv-timeline">';
      sortEntriesNewestFirst(section.entries || []).forEach(function (entry) {
        html += renderEntryHtml(entry, section.key);
      });
      if (section.timeline) html += '</div>';
      html += '</section>';
    });

    container.innerHTML = html;
  }

  function initCvModal() {
    var body = document.getElementById('cvModalBody');
    if (!body) return;
    renderCvModal(body);
    global.addEventListener('cv-content-updated', function () {
      renderCvModal(body);
    });
    global.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) renderCvModal(body);
    });
  }

  global.PriscillaCv = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_CV: DEFAULT_CV,
    getCvContent: getCvContent,
    setCvContent: setCvContent,
    getSectionByKey: getSectionByKey,
    renderCvModal: renderCvModal,
    initCvModal: initCvModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCvModal);
  } else {
    initCvModal();
  }
})(typeof window !== 'undefined' ? window : this);
