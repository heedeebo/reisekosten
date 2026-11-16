// pdfbeleg.js: Liest eine PDF-Rechnung als Beleg ein (z. B. Bahnticket oder Hotelrechnung per Mail).
//
// Dafür nutzen wir pdf.js von Mozilla (dem Firefox-Hersteller). Es macht zwei Dinge:
//   1. Text auslesen. Die meisten PDF-Rechnungen enthalten echten Text, nicht nur ein Bild.
//      Den können wir direkt lesen, ohne Texterkennung, und er ist fehlerfrei.
//   2. Die erste Seite als Bild zeichnen. Das speichern wir als "Foto" des Belegs,
//      damit er später im Abrechnungs-PDF hinten mit dabei ist.
// Ist ein PDF nur ein eingescanntes Bild (kein Text drin), läuft danach die normale Texterkennung.
//
// Braucht: hilfen.js (skriptLaden)

const PDFJS_ADRESSE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';


// Ist die Datei ein PDF?
function istPdf(datei) {
  return datei.type === 'application/pdf' || /\.pdf$/i.test(datei.name || '');
}


// Baut aus den Textstücken einer Seite wieder Zeilen.
// pdf.js liefert jedes Wort mit Position. Stücke auf gleicher Höhe gehören in eine Zeile.
function zeilenBauen(stuecke) {
  const zeilen = [];   // [{ hoehe, teile: [{ x, text }] }]
  for (const stueck of stuecke) {
    if (!stueck.str || stueck.str.trim() === '') continue;
    // transform[4] ist die Position von links, transform[5] die Höhe von unten.
    const x = stueck.transform[4];
    const y = stueck.transform[5];
    // Gibt es schon eine Zeile auf (fast) dieser Höhe? Bis 3 Punkte Unterschied zählen als gleich.
    let zeile = zeilen.find(function (z) { return Math.abs(z.hoehe - y) < 3; });
    if (!zeile) {
      zeile = { hoehe: y, teile: [] };
      zeilen.push(zeile);
    }
    zeile.teile.push({ x: x, text: stueck.str });
  }
  // Von oben nach unten (große Höhe zuerst), in jeder Zeile von links nach rechts.
  zeilen.sort(function (a, b) { return b.hoehe - a.hoehe; });
  return zeilen.map(function (z) {
    z.teile.sort(function (a, b) { return a.x - b.x; });
    return z.teile.map(function (t) { return t.text; }).join('  ');
  }).join('\n');
}


// Liest ein PDF. Gibt { bild, text } zurück:
//   bild = erste Seite als JPEG (Blob)
//   text = der Text aller Seiten ('' wenn das PDF keinen Text enthält)
async function pdfLesen(datei) {
  await skriptLaden(PDFJS_ADRESSE);
  // Der Helfer von pdf.js soll aus unserer eigenen Datei kommen (wegen offline).
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf-worker.js';

  const pdf = await pdfjsLib.getDocument({ data: await datei.arrayBuffer() }).promise;

  // 1. Text aller Seiten (höchstens 5, mehr hat kein Beleg)
  const seitenTexte = [];
  for (let nummer = 1; nummer <= Math.min(pdf.numPages, 5); nummer++) {
    const seite = await pdf.getPage(nummer);
    const inhalt = await seite.getTextContent();
    seitenTexte.push(zeilenBauen(inhalt.items));
  }

  // 2. Erste Seite als Bild, etwa 1600 Pixel breit (gut lesbar, nicht zu groß)
  const seite = await pdf.getPage(1);
  const normal = seite.getViewport({ scale: 1 });
  const ansicht = seite.getViewport({ scale: 1600 / normal.width });
  const leinwand = document.createElement('canvas');
  leinwand.width = Math.round(ansicht.width);
  leinwand.height = Math.round(ansicht.height);
  const stift = leinwand.getContext('2d');
  stift.fillStyle = '#ffffff';   // weißer Hintergrund, sonst wird es im JPEG schwarz
  stift.fillRect(0, 0, leinwand.width, leinwand.height);
  await seite.render({ canvasContext: stift, viewport: ansicht }).promise;
  const bild = await new Promise(function (fertig) { leinwand.toBlob(fertig, 'image/jpeg', 0.85); });

  return { bild: bild, text: seitenTexte.join('\n').trim() };
}
