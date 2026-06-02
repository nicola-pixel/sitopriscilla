/**
 * Configurazione segreta - MODIFICA QUESTI VALORI IN PRODUZIONE
 * La chiave download viene poi impostata dall'admin e salvata in localStorage.
 */
window.PriscillaConfig = {
  // URL pubblico del sito (senza slash finale). Lasciare vuoto per usare il dominio corrente.
  // Aggiornare anche robots.txt e sitemap.xml con lo stesso dominio in produzione.
  // Esempio: 'https://www.tuodominio.it'
  siteUrl: '',
  // Password per accedere alla sezione admin (cambiala!)
  adminPassword: 'admin123',
  // Chiave segreta di default per scaricare i PDF (usata se l'admin non ne ha impostata una)
  defaultDownloadKey: 'priscilla2025'
};
