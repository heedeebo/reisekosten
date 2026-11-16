// excel.js: Baut aus der Abrechnung eine Excel-Datei (.xlsx) mit ExcelJS.
//
// Aufbau wie auf dem Bildschirm. Die Beträge stehen immer in Spalte E.
// Zwischensummen, Gesamtsumme und Auszahlung sind echte Excel-Formeln (=SUMME ...),
// damit man sie in Excel nachprüfen kann. Zusätzlich schreiben wir das Ergebnis mit hinein,
// weil die Vorschau auf dem iPhone Formeln nicht selbst ausrechnet.
//
// Braucht: ExcelJS (wird erst beim Klick geladen), format.js, hilfen.js


// Die Adresse von ExcelJS im Internet. Feste Version, damit sich nichts heimlich ändert.
const EXCELJS_ADRESSE = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

// Zahlenformat für Euro. Excel zeigt es in deiner Spracheinstellung, also 1.234,56 €.
const EURO_FORMAT = '#,##0.00 "€"';
const DATUM_FORMAT = 'dd.mm.yyyy';


// "2026-08-10" -> echtes Datum für Excel (UTC, damit keine Zeitzone stört)
function excelDatum(text) {
  if (!text) return '';
  const t = text.slice(0, 10).split('-');
  return new Date(Date.UTC(Number(t[0]), Number(t[1]) - 1, Number(t[2])));
}


async function excelErstellen(a) {
  await skriptLaden(EXCELJS_ADRESSE);

  const mappe = new ExcelJS.Workbook();
  mappe.creator = 'Travel Expenses App';
  const blatt = mappe.addWorksheet('Report', {
    // Beim Drucken: A4 hoch, auf eine Seitenbreite verkleinern.
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Spaltenbreiten (in Zeichen)
  blatt.columns = [
    { width: 12 },   // A
    { width: 14 },   // B
    { width: 26 },   // C
    { width: 24 },   // D
    { width: 14 }    // E: Beträge
  ];

  let zeile = 1;   // die Zeile, in die wir als Nächstes schreiben

  // Schreibt eine Zeile. werte ist eine Liste für die Spalten A, B, C ...
  function schreiben(werte, stil) {
    const r = blatt.getRow(zeile);
    werte.forEach(function (wert, i) {
      if (wert === null || wert === undefined || wert === '') return;
      r.getCell(i + 1).value = wert;
    });
    if (stil === 'fett') r.font = { bold: true };
    if (stil === 'kopf') {
      r.font = { bold: true, color: { argb: 'FF555555' } };
      r.eachCell(function (zelle) { zelle.border = { bottom: { style: 'thin' } }; });
    }
    zeile = zeile + 1;
    return r;
  }

  // Formate: Spalte E ist Euro, Datumsspalten bekommen das Datumsformat.
  function formatieren(r, datumSpalten) {
    r.getCell(5).numFmt = EURO_FORMAT;
    for (const s of datumSpalten) r.getCell(s).numFmt = DATUM_FORMAT;
  }

  // ---------- Kopf ----------
  blatt.getCell('A1').value = 'Travel Expense Report';
  blatt.getCell('A1').font = { bold: true, size: 16 };
  zeile = 3;
  schreiben(['Name', a.name]);
  const zeitraum = schreiben(['Period', excelDatum(a.von), 'to', excelDatum(a.bis)]);
  zeitraum.getCell(2).numFmt = DATUM_FORMAT;
  zeitraum.getCell(4).numFmt = DATUM_FORMAT;
  zeile = zeile + 1;
  schreiben(['Trip', '', 'Purpose', 'Start', 'End'], 'kopf');
  for (const r of a.reisen) {
    schreiben([r.ziel, '', r.grund, datumZeit(r.start), datumZeit(r.ende)]);
  }

  // ---------- Blöcke ----------
  // Merkt sich, in welcher Zeile jede Zwischensumme steht (für die Gesamtsumme).
  const zwischensummen = [];

  // spalten: Überschriften A bis E. werteVon: macht aus einer Zeile der Abrechnung die Zellwerte.
  function block(titel, spalten, zeilen, werteVon, datumSpalten) {
    zeile = zeile + 1;
    const t = schreiben([titel]);
    t.font = { bold: true, size: 13 };
    schreiben(spalten, 'kopf');

    const erste = zeile;
    for (const z of zeilen) {
      formatieren(schreiben(werteVon(z)), datumSpalten);
    }
    const letzte = zeile - 1;

    // Zwischensumme als Formel. Ohne Zeilen ist sie einfach 0.
    const summe = schreiben(['Subtotal'], 'fett');
    summe.getCell(5).value = zeilen.length > 0
      ? { formula: 'SUM(E' + erste + ':E' + letzte + ')', result: summeDerZeilen(zeilen) }
      : 0;
    summe.getCell(5).numFmt = EURO_FORMAT;
    summe.getCell(5).border = { top: { style: 'thin' } };
    zwischensummen.push({ zeile: zeile - 1, wert: summeDerZeilen(zeilen) });
  }

  function summeDerZeilen(zeilen) {
    return aufCent(zeilen.reduce(function (s, z) { return s + z.betrag; }, 0));
  }

  block('Business Meals and Client Entertainment', ['No.', 'Date', 'Merchant', 'Details', 'Amount'], a.bewirtung.zeilen,
    function (z) {
      return [z.nummer, excelDatum(z.datum), z.text, z.mahlzeit, z.betrag];
    }, [2]);

  block('Meal Allowance', ['Date', 'Trip', 'Day', 'Meals provided', 'Amount'], a.pauschale.zeilen,
    function (z) { return [excelDatum(z.datum), z.ziel, z.art, z.gestellt || 'None', z.betrag]; }, [1]);

  block('Hotel', ['No.', 'Date', 'Merchant', '', 'Amount'], a.hotel.zeilen,
    function (z) { return [z.nummer, excelDatum(z.datum), z.text, '', z.betrag]; }, [2]);

  block('Travel Costs', ['No.', 'Date', 'Type', 'Merchant', 'Amount'], a.fahrt.zeilen,
    function (z) { return [z.nummer, excelDatum(z.datum), z.kategorie, z.text, z.betrag]; }, [2]);

  block('Extra Costs', ['No.', 'Date', 'Description', '', 'Amount'], a.extra.zeilen,
    function (z) { return [z.nummer, excelDatum(z.datum), z.text, '', z.betrag]; }, [2]);

  // ---------- Summen ----------
  zeile = zeile + 1;
  const gesamtZeile = zeile;
  const gesamt = schreiben(['Total'], 'fett');
  gesamt.getCell(5).value = {
    // z. B. =E14+E22+E27+E33+E38
    formula: zwischensummen.map(function (s) { return 'E' + s.zeile; }).join('+'),
    result: a.gesamt
  };
  gesamt.getCell(5).numFmt = EURO_FORMAT;

  const vorschussZeile = zeile;
  const vorschuss = schreiben(['Less advance']);
  vorschuss.getCell(5).value = a.vorschuss;
  vorschuss.getCell(5).numFmt = EURO_FORMAT;

  const auszahlung = schreiben([a.auszahlung >= 0 ? 'Payout' : 'To pay back'], 'fett');
  auszahlung.getCell(5).value = { formula: 'E' + gesamtZeile + '-E' + vorschussZeile, result: a.auszahlung };
  auszahlung.getCell(5).numFmt = EURO_FORMAT;
  auszahlung.getCell(5).border = { top: { style: 'double' } };
  auszahlung.font = { bold: true, size: 13 };

  // ---------- Ort, Datum, Unterschrift ----------
  zeile = zeile + 2;
  schreiben(['Place, date', (a.ort ? a.ort + ', ' : '') + datum(a.heute)]);
  // Deine Unterschrift als Bild über der linken Linie (Spalten A bis B),
  // rechts (Spalten D bis E) die Linie für den Vorgesetzten.
  const bildZeile = zeile;
  zeile = zeile + 3;
  if (a.unterschrift) {
    const bildNummer = mappe.addImage({ base64: a.unterschrift, extension: 'png' });
    // tl = top left (oben links), Zählung ab 0: Spalte 0 = A, Zeile bildZeile - 1
    // Höchstens 200 x 57 Pixel, nicht verzerrt (einpassen aus hilfen.js)
    const g = einpassen(await bildMasse(a.unterschrift), 200, 57);
    blatt.addImage(bildNummer, { tl: { col: 0, row: bildZeile - 1 }, ext: { width: g.breite, height: g.hoehe } });
  }
  const linien = schreiben(['Employee: ' + (a.name || ''), '', '', 'Approved (date, signature): ' + (a.chefName || 'Supervisor')]);
  for (const spalte of [1, 2, 4, 5]) {
    linien.getCell(spalte).border = { top: { style: 'thin' } };
  }
  linien.font = { size: 9 };

  // Als Datei-Paket (Blob) zurückgeben.
  const daten = await mappe.xlsx.writeBuffer();
  return new Blob([daten], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


// Dateiname, z. B. "Travel-Expenses_2026-08_to_2026-09.xlsx"
function dateiName(a, endung) {
  return 'Travel-Expenses_' + a.von.slice(0, 7) + '_to_' + a.bis.slice(0, 7) + '.' + endung;
}
