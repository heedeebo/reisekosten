// sw.js: Der Service Worker. Er macht die App offline-fähig.
//
// Ein Service Worker ist ein kleines Programm, das der Browser neben der App laufen lässt.
// Er steht zwischen App und Internet: Jede Datei, die die App laden will, fragt erst bei ihm an.
// Beim ersten Start legt er alle Dateien in einen Speicher (Cache) auf dem iPhone.
// Danach liefert er sie von dort, mit oder ohne Netz.
//
// WICHTIG bei jedem Update der App: VERSION um 1 hochzählen.
// Dann merkt das iPhone, dass sich sw.js geändert hat, und holt alle Dateien neu.

const VERSION = 27;
const SPEICHER = 'reisekosten-v' + VERSION;

// Die Dateien der App selbst.
const APP_DATEIEN = [
  './',
  'index.html', 'einstellungen.html', 'reise.html', 'reise-bearbeiten.html',
  'beleg.html', 'abrechnung.html',
  'style.css', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fehler.js', 'offline.js', 'navigation.js', 'hilfen.js', 'db.js', 'format.js', 'tage.js', 'pauschale.js', 'laender.js', 'kategorien.js',
  'summen.js', 'belegzeile.js', 'start.js', 'einstellungen.js', 'reise.js', 'reise-bearbeiten.js',
  'bild.js', 'ocr.js', 'ocr-worker.js', 'pdfbeleg.js', 'pdf-worker.js', 'beleg.js',
  'abrechnung-daten.js', 'abrechnung.js', 'excel.js', 'pdf.js', 'sicherung.js', 'unterschrift.js'
];

// Die Bibliotheken aus dem Internet (zusammen gut 7 MB).
const FREMDE_DATEIEN = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
];


// "install": läuft einmal, wenn eine neue Version von sw.js ankommt.
self.addEventListener('install', function (ereignis) {
  ereignis.waitUntil((async function () {
    const speicher = await caches.open(SPEICHER);
    // cache: 'reload' heißt: wirklich neu aus dem Internet holen, keine alte Kopie nehmen.
    await speicher.addAll(APP_DATEIEN.map(function (d) { return new Request(d, { cache: 'reload' }); }));
    // Die Bibliotheken einzeln. Klappt eine nicht, ist die App trotzdem installiert,
    // und die Datei wird beim ersten Benutzen nachgeholt.
    await Promise.allSettled(FREMDE_DATEIEN.map(function (d) { return speicher.add(d); }));
    // Neue Version sofort aktiv machen, nicht erst nach dem Schließen aller Fenster.
    await self.skipWaiting();
  })());
});


// "activate": läuft, wenn die neue Version übernimmt. Alte Speicher löschen.
self.addEventListener('activate', function (ereignis) {
  ereignis.waitUntil((async function () {
    const namen = await caches.keys();
    for (const name of namen) {
      if (name !== SPEICHER) await caches.delete(name);
    }
    // Sofort auch die offenen Seiten übernehmen.
    await self.clients.claim();
  })());
});


// "fetch": läuft bei JEDER Datei, die die App laden will.
self.addEventListener('fetch', function (ereignis) {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET') return;   // nur Lesen, nichts anderes anfassen

  ereignis.respondWith((async function () {
    const speicher = await caches.open(SPEICHER);
    // ignoreSearch: "reise.html?id=3" findet "reise.html" im Speicher.
    const gespeichert = await speicher.match(anfrage, { ignoreSearch: true });
    if (gespeichert) return gespeichert;

    // Nicht im Speicher: aus dem Internet holen und für später merken.
    try {
      const antwort = await fetch(anfrage);
      if (antwort.ok && (anfrage.url.startsWith(self.location.origin) ||
          anfrage.url.startsWith('https://cdn.jsdelivr.net/'))) {
        speicher.put(anfrage, antwort.clone());
      }
      return antwort;
    } catch (fehler) {
      // Offline und nicht im Speicher. Bei einer Seite die Startseite zeigen.
      if (anfrage.mode === 'navigate') {
        return speicher.match('index.html');
      }
      throw fehler;
    }
  })());
});
