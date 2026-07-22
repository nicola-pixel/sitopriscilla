/**
 * Configurazione segreta - MODIFICA QUESTI VALORI IN PRODUZIONE
 * La chiave download viene poi impostata dall'admin e salvata in localStorage.
 */
window.PriscillaConfig = {
  // URL pubblico del sito (senza slash finale). Lasciare vuoto per usare il dominio corrente.
  // Aggiornare anche robots.txt e sitemap.xml con lo stesso dominio in produzione.
  // Esempio: 'https://www.tuodominio.it'
  siteUrl: '',
  // Password admin di bootstrap (usata finché non la cambi da Impostazioni, dove viene salvata sul server).
  // In produzione puoi anche impostare ADMIN_PASSWORD su Vercel.
  adminPassword: 'priscilla',
  // Chiave segreta di default per scaricare i PDF (usata se l'admin non ne ha impostata una da Impostazioni)
  defaultDownloadKey: 'priscilla2025'
};
