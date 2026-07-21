(function (global) {
  'use strict';

  var STORAGE_KEY = 'sedi';

  var DEFAULT_SEDI = [
    {
      id: 'sede_proxima',
      name: 'Milano - Centro Proxima',
      address: 'Corso Buenos Aires 23, 20124 Milano (MI)',
      url: 'https://www.miodottore.it/priscilla-castellani-tarabini/dietista-nutrizionista/milano',
      position: 1,
      online: false
    },
    {
      id: 'sede_milano',
      name: 'Milano',
      address: 'Via dei Fabbri 12, 20123 Milano (MI)',
      url: 'https://calendly.com/priscilla-castellanitarabini/prima-visita-nutrizionale-milano?hide_gdpr_banner=1',
      position: 2,
      online: false
    },
    {
      id: 'sede_modena',
      name: 'Modena',
      address: 'Via Tamburini 99, 41124 Modena (MO)',
      url: 'https://calendly.com/priscilla-castellanitarabini/prima-visita-nutrizionale-modena?hide_gdpr_banner=1',
      position: 3,
      online: false
    },
    {
      id: 'sede_trezzo',
      name: "Trezzo sull'Adda",
      address: "Via Gianfranco Miglio 5, 20056 Trezzo sull'Adda (MI)",
      url: 'https://calendly.com/priscilla-castellanitarabini/prima-visita-nutrizionale-trezzo-studio-oggioni?hide_gdpr_banner=1',
      position: 4,
      online: false
    },
    {
      id: 'sede_online',
      name: 'Videochiamata',
      address: 'Consulenza da casa tua, quando vuoi',
      url: 'https://calendly.com/priscilla-castellanitarabini/prima-visita-nutrizionale-online?hide_gdpr_banner=1',
      position: 5,
      online: true
    }
  ];

  function getSedi() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) {}
    return DEFAULT_SEDI.slice();
  }

  function setSedi(sedi) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(sedi));
    try {
      global.dispatchEvent(new Event('sedi-updated'));
    } catch (e) {}
  }

  function sortSedi(sedi) {
    return (sedi || []).slice().sort(function (a, b) {
      var posA = Number(a.position) || 0;
      var posB = Number(b.position) || 0;
      if (posA !== posB) return posA - posB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'it');
    });
  }

  function isCalendlyUrl(url) {
    return /calendly\.com/i.test(url || '');
  }

  function getActiveSedi() {
    return sortSedi(getSedi()).filter(function (sede) {
      return sede && String(sede.name || '').trim() && String(sede.url || '').trim();
    });
  }

  global.PriscillaSedi = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_SEDI: DEFAULT_SEDI,
    getSedi: getSedi,
    setSedi: setSedi,
    sortSedi: sortSedi,
    getActiveSedi: getActiveSedi,
    isCalendlyUrl: isCalendlyUrl
  };
})(typeof window !== 'undefined' ? window : this);
