// fehler.js: Zeigt Programmfehler als roten Kasten oben auf der Seite.
//
// Auf dem iPhone sieht man Fehler sonst nicht, die App "macht einfach nichts".
// Mit diesem Kasten kannst du mir den Fehlertext schicken (Screenshot reicht).
// Diese Datei wird auf jeder Seite als ERSTE geladen.

function fehlerZeigen(text) {
  let kasten = document.getElementById('fehler-kasten');
  if (!kasten) {
    kasten = document.createElement('div');
    kasten.id = 'fehler-kasten';
    kasten.className = 'fehler-kasten';
    // Antippen schließt den Kasten.
    kasten.addEventListener('click', function () { kasten.remove(); });
    document.body.prepend(kasten);   // prepend = ganz an den Anfang
  }
  const zeile = document.createElement('div');
  zeile.textContent = 'Error: ' + text;
  kasten.appendChild(zeile);
}

// "error" kommt bei normalen Fehlern im Code.
window.addEventListener('error', function (ereignis) {
  const ort = ereignis.filename ? ' (' + ereignis.filename.split('/').pop() + ':' + ereignis.lineno + ')' : '';
  fehlerZeigen(ereignis.message + ort);
});

// "unhandledrejection" kommt bei Fehlern in async-Funktionen, die niemand abfängt.
window.addEventListener('unhandledrejection', function (ereignis) {
  const grund = ereignis.reason;
  fehlerZeigen(grund && grund.message ? grund.message : String(grund));
});
