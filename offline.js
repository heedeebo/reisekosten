// offline.js: Meldet den Service Worker (sw.js) beim Browser an.
// Wird auf jeder Seite geladen. Beim ersten Mal speichert sw.js dann alle Dateien.

// Nicht jeder Browser kann Service Worker. Dann läuft die App eben nur online.
if ('serviceWorker' in navigator) {
  // 'load' heißt: erst wenn die Seite fertig ist, damit sie nicht langsamer startet.
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (fehler) {
      console.warn('Service worker not registered:', fehler);
    });
  });
}
