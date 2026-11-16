// bild.js: Fotos verkleinern, bevor wir sie speichern.
//
// Ein iPhone-Foto hat oft 4000 x 3000 Pixel und mehrere MB. Für einen Beleg
// reichen 2000 Pixel an der langen Seite locker, auch für die Texterkennung später.
// So passen hunderte Belege auf das Handy.

const BILD_MAX_SEITE = 2000;   // Pixel an der längsten Seite
const BILD_QUALITAET = 0.8;    // JPEG-Qualität von 0 bis 1


// Bereitet ein Foto für die Texterkennung auf. Das gespeicherte Foto bleibt unverändert.
//   1. Graustufen: Farbe hilft beim Lesen nicht, stört aber manchmal.
//   2. Kontrast strecken: Kassenbons auf Thermopapier sind oft blass grau auf hellgrau.
//      Wir machen das dunkelste Grau (fast) schwarz und das hellste (fast) weiß.
//   3. Kleine Bilder vergrößern: Tesseract liest Schrift ab etwa 20 Pixel Höhe am besten.
// Ergebnis ist ein canvas (Zeichenfläche), den Tesseract direkt lesen kann.
function bildFuerTexterkennung(blob) {
  return new Promise(function (fertig, fehler) {
    const adresse = URL.createObjectURL(blob);
    const bild = new Image();
    bild.onload = function () {
      const faktor = bild.naturalWidth < 1200 ? 2 : 1;
      const breite = bild.naturalWidth * faktor;
      const hoehe = bild.naturalHeight * faktor;
      const leinwand = document.createElement('canvas');
      leinwand.width = breite;
      leinwand.height = hoehe;
      const stift = leinwand.getContext('2d');
      stift.drawImage(bild, 0, 0, breite, hoehe);
      URL.revokeObjectURL(adresse);

      // Alle Pixel holen. daten ist eine lange Liste: R, G, B, A, R, G, B, A, ...
      const pixel = stift.getImageData(0, 0, breite, hoehe);
      const daten = pixel.data;

      // Graustufen ausrechnen und zählen, wie oft jede Helligkeit (0 bis 255) vorkommt.
      const anzahl = new Array(256).fill(0);
      for (let i = 0; i < daten.length; i += 4) {
        const grau = Math.round(0.299 * daten[i] + 0.587 * daten[i + 1] + 0.114 * daten[i + 2]);
        daten[i] = grau;
        anzahl[grau]++;
      }

      // Dunkelste und hellste Helligkeit finden, die Ausreißer (je 1 %) ignorieren.
      const ausreisser = (breite * hoehe) * 0.01;
      let dunkel = 0;
      let summe = 0;
      while (dunkel < 255 && summe + anzahl[dunkel] < ausreisser) { summe += anzahl[dunkel]; dunkel++; }
      let hell = 255;
      summe = 0;
      while (hell > 0 && summe + anzahl[hell] < ausreisser) { summe += anzahl[hell]; hell--; }
      const spanne = Math.max(1, hell - dunkel);

      // Jedes Pixel auf die ganze Spanne von 0 bis 255 ziehen.
      for (let i = 0; i < daten.length; i += 4) {
        const neu = Math.max(0, Math.min(255, Math.round((daten[i] - dunkel) * 255 / spanne)));
        daten[i] = neu;
        daten[i + 1] = neu;
        daten[i + 2] = neu;
      }
      stift.putImageData(pixel, 0, 0);
      fertig(leinwand);
    };
    bild.onerror = function () {
      URL.revokeObjectURL(adresse);
      fehler(new Error('Could not read the image.'));
    };
    bild.src = adresse;
  });
}


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
