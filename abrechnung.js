// abrechnung.js: Die Abrechnungs-Seite. Zeitraum wählen, Vorschuss und Extrakosten
// eintragen, die App zeigt die fertige Abrechnung darunter.
// Die Rechnung selbst steckt in abrechnung-daten.js.

const feldVon = document.getElementById('von');
const feldBis = document.getElementById('bis');
const feldVorschuss = document.getElementById('vorschuss');
const extraBereich = document.getElementById('extra-zeilen');
const hinweise = document.getElementById('hinweise');
const bericht = document.getElementById('bericht');

// Alles, was wir einmal laden und dann immer wieder brauchen.
let alleReisen = [];
let alleBelege = [];
let einstellungen = {};

// Der Entwurf wird gespeichert, damit Zeitraum und Extrakosten beim nächsten Öffnen noch da sind.
// extraZeilen: [{ text: 'Visa fee', betrag: 60 }]
let entwurf = { von: '', bis: '', vorschuss: null, extraZeilen: [] };

// Das zuletzt berechnete Ergebnis. Excel und PDF (Schritt 14 und 15) brauchen es später.
let aktuelleAbrechnung = null;


// ---------- Hilfen für Datum ----------

// Heute als "2026-11-16"
function heuteText() {
  const jetzt = new Date();
  return jetzt.getFullYear() + '-' + String(jetzt.getMonth() + 1).padStart(2, '0') + '-' +
    String(jetzt.getDate()).padStart(2, '0');
}

// "2026-09" -> "2026-09-30" (letzter Tag des Monats)
function monatsende(monat) {
  const teile = monat.split('-');
  // Tag 0 des Folgemonats ist der letzte Tag dieses Monats. Ein kleiner Trick von Date.
  const letzter = new Date(Date.UTC(Number(teile[0]), Number(teile[1]), 0)).getUTCDate();
  return monat + '-' + String(letzter).padStart(2, '0');
}

// "2026-08" plus -1 -> "2026-07"
function monatVerschieben(monat, schritte) {
  const teile = monat.split('-');
  const d = new Date(Date.UTC(Number(teile[0]), Number(teile[1]) - 1 + schritte, 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}


// ---------- Extrakosten-Zeilen ----------

function extraZeilenZeichnen() {
  extraBereich.innerHTML = '';
  entwurf.extraZeilen.forEach(function (zeile, nummer) {
    // forEach geht die Liste durch und gibt uns auch die Position (nummer: 0, 1, 2 ...).
    const reihe = document.createElement('div');
    reihe.className = 'extra-reihe';

    const text = document.createElement('input');
    text.type = 'text';
    text.placeholder = 'Description';
    text.value = zeile.text;
    text.addEventListener('input', function () {
      entwurf.extraZeilen[nummer].text = text.value;
      neuRechnen();
    });

    const betrag = document.createElement('input');
    betrag.type = 'text';
    betrag.inputMode = 'decimal';
    betrag.placeholder = '0,00';
    betrag.value = zeile.betrag ? zahlAnzeigen(zeile.betrag) : '';
    betrag.addEventListener('input', function () {
      const zahl = zahlLesen(betrag.value);
      entwurf.extraZeilen[nummer].betrag = Number.isNaN(zahl) ? 0 : zahl;
      neuRechnen();
    });

    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'extra-weg';
    weg.textContent = '×';
    weg.setAttribute('aria-label', 'Remove');
    weg.addEventListener('click', function () {
      // splice nimmt ab Position nummer genau 1 Eintrag aus der Liste.
      entwurf.extraZeilen.splice(nummer, 1);
      extraZeilenZeichnen();
      neuRechnen();
    });

    reihe.appendChild(text);
    reihe.appendChild(betrag);
    reihe.appendChild(weg);
    extraBereich.appendChild(reihe);
  });
}

document.getElementById('extra-neu').addEventListener('click', function () {
  entwurf.extraZeilen.push({ text: '', betrag: 0 });
  extraZeilenZeichnen();
});


// ---------- Bausteine für die Anzeige ----------

// Kleine Hilfe: ein Element mit Klasse und Text bauen.
function element(art, klasse, text) {
  const e = document.createElement(art);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

// Baut einen Block: Überschrift, Tabelle mit Spalten, Zwischensumme.
//   titel       z. B. "Hotel"
//   spalten     Überschriften, z. B. ['No.', 'Date', 'Merchant', 'Amount']
//   zeilen      Liste von Listen mit Texten, eine pro Tabellenzeile
//   summe       Zwischensumme in Euro
function blockBauen(titel, spalten, zeilen, summe) {
  const block = element('section', 'bericht-block');
  block.appendChild(element('h2', '', titel));

  const tabelle = element('table', 'bericht-tabelle');
  const kopf = element('tr');
  spalten.forEach(function (s, i) {
    // Die letzte Spalte ist immer der Betrag, die richten wir rechts aus.
    kopf.appendChild(element('th', i === spalten.length - 1 ? 'zahl' : '', s));
  });
  tabelle.appendChild(kopf);

  if (zeilen.length === 0) {
    const leer = element('tr');
    const zelle = element('td', 'leer', 'None');
    zelle.colSpan = spalten.length;
    leer.appendChild(zelle);
    tabelle.appendChild(leer);
  }
  for (const werte of zeilen) {
    const tr = element('tr');
    werte.forEach(function (w, i) {
      tr.appendChild(element('td', i === werte.length - 1 ? 'zahl' : '', w));
    });
    tabelle.appendChild(tr);
  }

  const summenZeile = element('tr', 'zwischensumme');
  const beschriftung = element('td', '', 'Subtotal');
  beschriftung.colSpan = spalten.length - 1;
  summenZeile.appendChild(beschriftung);
  summenZeile.appendChild(element('td', 'zahl', euro(summe)));
  tabelle.appendChild(summenZeile);

  block.appendChild(tabelle);
  return block;
}

// Belegnummer als Text, freie Zeilen haben keine.
function nr(nummer) {
  return nummer === null ? '' : String(nummer);
}


// ---------- Die Abrechnung zeichnen ----------

function berichtZeichnen(a) {
  bericht.innerHTML = '';

  // Kopf
  const kopf = element('section', 'bericht-block');
  kopf.appendChild(element('h2', '', 'Travel Expense Report'));
  kopf.appendChild(element('p', 'bericht-zeile', 'Name: ' + (a.name || '(add your name in Settings)')));
  kopf.appendChild(element('p', 'bericht-zeile', 'Period: ' + datum(a.von) + ' to ' + datum(a.bis)));
  for (const r of a.reisen) {
    const text = r.ziel + (r.grund ? ', ' + r.grund : '') + ': ' +
      datumZeit(r.start) + ' to ' + datumZeit(r.ende);
    kopf.appendChild(element('p', 'bericht-zeile', text));
  }
  bericht.appendChild(kopf);

  bericht.appendChild(blockBauen('Business Meals',
    ['No.', 'Date', 'Merchant', 'Approved by', 'Amount'],
    a.bewirtung.zeilen.map(function (z) {
      return [nr(z.nummer), datum(z.datum), z.text, z.genehmigtVon + ', ' + datum(z.genehmigtAm), euro(z.betrag)];
    }),
    a.bewirtung.summe));

  bericht.appendChild(blockBauen('Meal Allowance',
    ['Date', 'Trip', 'Day', 'Meals provided', 'Amount'],
    a.pauschale.zeilen.map(function (z) {
      return [datum(z.datum), z.ziel, z.art, z.gestellt || 'None', euro(z.betrag)];
    }),
    a.pauschale.summe));

  bericht.appendChild(blockBauen('Hotel',
    ['No.', 'Date', 'Merchant', 'Amount'],
    a.hotel.zeilen.map(function (z) { return [nr(z.nummer), datum(z.datum), z.text, euro(z.betrag)]; }),
    a.hotel.summe));

  bericht.appendChild(blockBauen('Travel Costs',
    ['No.', 'Date', 'Type', 'Merchant', 'Amount'],
    a.fahrt.zeilen.map(function (z) { return [nr(z.nummer), datum(z.datum), z.kategorie, z.text, euro(z.betrag)]; }),
    a.fahrt.summe));

  bericht.appendChild(blockBauen('Extra Costs',
    ['No.', 'Date', 'Description', 'Amount'],
    a.extra.zeilen.map(function (z) {
      return [nr(z.nummer), z.datum ? datum(z.datum) : '', z.text, euro(z.betrag)];
    }),
    a.extra.summe));

  // Summen unten
  const ende = element('section', 'bericht-block');
  const tabelle = element('table', 'bericht-tabelle summen-tabelle');
  [['Total', a.gesamt], ['Less advance', -a.vorschuss],
    [a.auszahlung >= 0 ? 'Payout' : 'To pay back', a.auszahlung]].forEach(function (paar, i) {
    const tr = element('tr', i === 2 ? 'endsumme' : '');
    tr.appendChild(element('td', '', paar[0]));
    tr.appendChild(element('td', 'zahl', euro(paar[1])));
    tabelle.appendChild(tr);
  });
  ende.appendChild(tabelle);

  // Ort, Datum und Unterschrift
  ende.appendChild(element('p', 'bericht-zeile', 'Place, date: ' + (a.ort ? a.ort + ', ' : '') + datum(a.heute)));
  ende.appendChild(element('div', 'unterschrift', 'Signature'));
  bericht.appendChild(ende);
}


// Hinweise oberhalb der Abrechnung
function hinweiseZeichnen(a) {
  hinweise.innerHTML = '';
  if (a.reisen.length === 0) {
    hinweise.appendChild(element('p', 'warnung', 'No trips in this period.'));
  }
  for (const z of a.nichtGenehmigt) {
    hinweise.appendChild(element('p', 'warnung',
      'Receipt No. ' + z.nummer + ' (' + z.text + ', ' + euro(z.betrag) + ') is not included: approval missing.'));
  }
  // Belege ohne Reise, deren Datum im Zeitraum liegt
  const ohne = alleBelege.filter(function (b) {
    return b.reiseId === null && b.datum >= a.von && b.datum <= a.bis;
  });
  if (ohne.length > 0) {
    hinweise.appendChild(element('p', 'warnung',
      ohne.length + ' receipt(s) in this period have no trip and are not included.'));
  }
}


// ---------- Rechnen ----------

function neuRechnen() {
  if (feldVon.value === '' || feldBis.value === '') return;
  let von = feldVon.value;
  let bis = feldBis.value;
  if (bis < von) bis = von;   // "Bis" vor "Von" ergibt keinen Sinn

  const vorschuss = zahlLesen(feldVorschuss.value);
  entwurf.von = von;
  entwurf.bis = bis;
  entwurf.vorschuss = Number.isNaN(vorschuss) ? 0 : vorschuss;

  aktuelleAbrechnung = abrechnungErstellen(alleReisen, alleBelege, einstellungen,
    von + '-01', monatsende(bis), entwurf.extraZeilen, entwurf.vorschuss, heuteText());

  hinweiseZeichnen(aktuelleAbrechnung);
  berichtZeichnen(aktuelleAbrechnung);

  // Entwurf speichern. Ohne await: Das Speichern darf im Hintergrund laufen.
  dbSchreiben('einstellungen', entwurf, 'abrechnung-entwurf');
}

feldVon.addEventListener('change', neuRechnen);
feldBis.addEventListener('change', neuRechnen);
feldVorschuss.addEventListener('input', neuRechnen);


// ---------- Export ----------

const exportStatus = document.getElementById('export-status');

// Gibt dem iPhone eine Datei. Ein unsichtbarer Link mit "download" wird kurz angeklickt.
// Auf dem iPhone öffnet sich dann eine Vorschau, von dort kann man sie teilen oder sichern.
// (In Schritt 16 kommt der Teilen-Knopf direkt dazu.)
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

document.getElementById('excel').addEventListener('click', async function () {
  if (!aktuelleAbrechnung) return;
  exportStatus.textContent = 'Creating Excel file…';
  try {
    const blob = await excelErstellen(aktuelleAbrechnung);   // aus excel.js
    dateiAusgeben(blob, dateiName(aktuelleAbrechnung, 'xlsx'));
    exportStatus.textContent = 'Excel file created.';
  } catch (fehler) {
    exportStatus.textContent = 'Could not create the Excel file. (' + fehler.message + ')';
  }
});


// ---------- Laden ----------

async function laden() {
  alleReisen = await dbAlleLesen('reisen');
  alleBelege = await dbAlleLesen('belege');
  einstellungen = (await dbLesen('einstellungen', 'profil')) || {};
  const gespeichert = await dbLesen('einstellungen', 'abrechnung-entwurf');
  if (gespeichert) entwurf = gespeichert;

  // Ohne Entwurf: letzter Monat bis dieser Monat.
  const dieserMonat = heuteText().slice(0, 7);
  feldVon.value = entwurf.von || monatVerschieben(dieserMonat, -1);
  feldBis.value = entwurf.bis || dieserMonat;

  // Vorschuss: aus dem Entwurf, sonst der Standard aus den Settings.
  const vorschuss = entwurf.vorschuss !== null && entwurf.vorschuss !== undefined
    ? entwurf.vorschuss : (einstellungen.vorschuss || 0);
  feldVorschuss.value = vorschuss ? zahlAnzeigen(vorschuss) : '';

  extraZeilenZeichnen();
  neuRechnen();
}


laden();
