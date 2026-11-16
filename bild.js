// bild.js: Fotos verkleinern, bevor wir sie speichern.
//
// Ein iPhone-Foto hat oft 4000 x 3000 Pixel und mehrere MB. Für einen Beleg
// reichen 2000 Pixel an der langen Seite locker, auch für die Texterkennung später.
// So passen hunderte Belege auf das Handy.

const BILD_MAX_SEITE = 2000;   // Pixel an der längsten Seite
const BILD_QUALITAET = 0.8;    // JPEG-Qualität von 0 bis 1


// Nimmt eine Bilddatei und gibt ein kleineres JPEG zurück (als "Blob" = Datenpaket).
function bildVerkleinern(datei) {
  return new Promise(function (fertig, fehler) {
    // Eine vorübergehende Adresse für die Datei, damit ein <img> sie laden kann.
    const adresse = URL.createObjectURL(datei);
    const bild = new Image();

    bild.onload = function () {
      // Neue Größe ausrechnen. Kleine Bilder bleiben, wie sie sind (Faktor höchstens 1).
      const faktor = Math.min(1, BILD_MAX_SEITE / Math.max(bild.naturalWidth, bild.naturalHeight));
      const breite = Math.round(bild.naturalWidth * faktor);
      const hoehe = Math.round(bild.naturalHeight * faktor);

      // Ein canvas ist eine unsichtbare Zeichenfläche. Wir malen das Bild kleiner hinein.
      const leinwand = document.createElement('canvas');
      leinwand.width = breite;
      leinwand.height = hoehe;
      leinwand.getContext('2d').drawImage(bild, 0, 0, breite, hoehe);
      URL.revokeObjectURL(adresse);   // vorübergehende Adresse wieder freigeben

      // Die Zeichenfläche als JPEG speichern.
      leinwand.toBlob(function (blob) {
        if (blob) fertig(blob);
        else fehler(new Error('Could not convert the image.'));
      }, 'image/jpeg', BILD_QUALITAET);
    };

    bild.onerror = function () {
      URL.revokeObjectURL(adresse);
      fehler(new Error('Could not read the image.'));
    };

    bild.src = adresse;
  });
}
