// hilfen.js: Kleine Helfer, die mehrere Seiten brauchen.


// Lädt ein Skript erst, wenn man es braucht. Große Bibliotheken wie ExcelJS (rund 1 MB),
// jsPDF oder pdf.js bremsen so die Seiten nicht, bis man sie wirklich benutzt.
function skriptLaden(adresse) {
  return new Promise(function (fertig, fehler) {
    // Schon geladen? Dann nichts tun.
    if (document.querySelector('script[src="' + adresse + '"]')) return fertig();
    const skript = document.createElement('script');
    skript.src = adresse;
    skript.onload = fertig;
    skript.onerror = function () { fehler(new Error('Could not load ' + adresse + '. Is the iPhone online?')); };
    document.head.appendChild(skript);
  });
}


// Gibt dem iPhone eine Datei. Ein unsichtbarer Link mit "download" wird kurz angeklickt.
// Auf dem iPhone öffnet sich dann eine Vorschau, von dort kann man sie teilen oder sichern.
function dateiAusgeben(blob, name) {
  const adresse = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = adresse;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Adresse nach einer Minute wieder freigeben.
  setTimeout(function () { URL.revokeObjectURL(adresse); }, 60000);
}


// Breite und Höhe eines Bildes (z. B. der Unterschrift) in Pixeln.
function bildMasse(adresse) {
  return new Promise(function (fertig, fehler) {
    const bild = new Image();
    bild.onload = function () { fertig({ breite: bild.naturalWidth, hoehe: bild.naturalHeight }); };
    bild.onerror = function () { fehler(new Error('Could not read the image.')); };
    bild.src = adresse;
  });
}

// Passt ein Bild in einen Rahmen ein, ohne es zu verzerren.
// Beispiel: Bild 1000 x 400 in Rahmen 70 x 20 -> 50 x 20
function einpassen(masse, maxBreite, maxHoehe) {
  const faktor = Math.min(maxBreite / masse.breite, maxHoehe / masse.hoehe);
  return { breite: masse.breite * faktor, hoehe: masse.hoehe * faktor };
}
