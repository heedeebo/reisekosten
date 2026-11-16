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

// Das zuletzt berechnete Ergebnis. Excel, PDF und Teilen nehmen es.
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
    ['No.', 'Date', 'Merchant', 'Meal', 'Amount'],
    a.bewirtung.zeilen.map(function (z) {
      return [nr(z.nummer), datum(z.datum), z.text, z.mahlzeit, euro(z.betrag)];
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

  // Ort, Datum und zwei Unterschriften: links du, rechts der Vorgesetzte
  ende.appendChild(element('p', 'bericht-zeile', 'Place, date: ' + (a.ort ? a.ort + ', ' : '') + datum(a.heute)));
  const unterschriften = element('div', 'unterschriften');

  const links = element('div', 'unterschrift-block');
  if (a.unterschrift) {
    const bild = element('img', 'unterschrift-bild');
    bild.src = a.unterschrift;
    bild.alt = 'Your signature';
    links.appendChild(bild);
  }
  links.appendChild(element('div', 'unterschrift', 'Employee: ' + (a.name || '')));

  const rechts = element('div', 'unterschrift-block');
  rechts.appendChild(element('div', 'unterschrift', 'Approved (date, signature): ' + (a.chefName || 'Supervisor')));

  unterschriften.appendChild(links);
  unterschriften.appendChild(rechts);
  ende.appendChild(unterschriften);
  bericht.appendChild(ende);
}


// Hinweise oberhalb der Abrechnung
function hinweiseZeichnen(a) {
  hinweise.innerHTML = '';
  if (a.reisen.length === 0) {
    hinweise.appendChild(element('p', 'warnung', 'No trips in this period.'));
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

  // Die Abrechnung hat sich geändert, vorbereitete Dateien passen nicht mehr.
  teilenZuruecksetzen();
}

feldVon.addEventListener('change', neuRechnen);
feldBis.addEventListener('change', neuRechnen);
feldVorschuss.addEventListener('input', neuRechnen);


// ---------- Export ----------

const exportStatus = document.getElementById('export-status');

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


document.getElementById('pdf').addEventListener('click', async function () {
  if (!aktuelleAbrechnung) return;
  exportStatus.textContent = 'Creating PDF with ' + aktuelleAbrechnung.belegNummern.length + ' receipt(s)…';
  try {
    const blob = await pdfErstellen(aktuelleAbrechnung, belegeFuerPdf());   // aus pdf.js
    dateiAusgeben(blob, dateiName(aktuelleAbrechnung, 'pdf'));
    exportStatus.textContent = 'PDF created.';
  } catch (fehler) {
    exportStatus.textContent = 'Could not create the PDF. (' + fehler.message + ')';
  }
});

// Nur die Belege, die in der Abrechnung stehen, in der Reihenfolge der Belegnummern.
function belegeFuerPdf() {
  return aktuelleAbrechnung.belegNummern.map(function (nummer) {
    return alleBelege.find(function (b) { return b.nummer === nummer; });
  });
}


// ---------- Teilen (z. B. per Mail) ----------
//
// Das iPhone öffnet das Teilen-Menü nur direkt nach einem Tippen. Dateien bauen dauert
// aber ein paar Sekunden, danach "vergisst" das iPhone das Tippen. Deshalb zwei Schritte:
//   1. Tippen: Excel und PDF werden gebaut. Der Knopf heißt danach "Share Excel + PDF".
//   2. Tippen: Das Teilen-Menü geht sofort auf, dort wählst du Mail.

const knopfTeilen = document.getElementById('teilen');
let fertigeDateien = null;   // [Excel-Datei, PDF-Datei], sobald gebaut

function teilenZuruecksetzen() {
  fertigeDateien = null;
  knopfTeilen.textContent = 'Prepare email (Excel + PDF)';
}

// Kann dieses Gerät Dateien teilen? (iPhone ja, viele PC-Browser nein)
function kannTeilen(dateien) {
  return Boolean(navigator.canShare) && navigator.canShare({ files: dateien });
}

async function dateienVorbereiten() {
  // Ohne deine Unterschrift kann der Vorgesetzte nicht genehmigen.
  if (!einstellungen.unterschrift) {
    exportStatus.textContent = 'Please sign first (field "Your signature" above).';
    document.getElementById('unterschrift').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  exportStatus.textContent = 'Creating Excel and PDF…';
  try {
    const excel = await excelErstellen(aktuelleAbrechnung);
    const pdf = await pdfErstellen(aktuelleAbrechnung, belegeFuerPdf());
    // File ist ein Blob mit Dateinamen. Den Namen sieht man nachher in der Mail.
    fertigeDateien = [
      new File([excel], dateiName(aktuelleAbrechnung, 'xlsx'), { type: excel.type }),
      new File([pdf], dateiName(aktuelleAbrechnung, 'pdf'), { type: 'application/pdf' })
    ];
  } catch (fehler) {
    exportStatus.textContent = 'Could not create the files. (' + fehler.message + ')';
    return;
  }

  if (kannTeilen(fertigeDateien)) {
    knopfTeilen.textContent = 'Share Excel + PDF';
    exportStatus.textContent = 'Ready. Tap "Share Excel + PDF", choose Mail and send it to ' +
      (einstellungen.chefName || 'your supervisor') +
      (einstellungen.chefMail ? ' (' + einstellungen.chefMail + ')' : '') + '.';
  } else {
    // Ersatz, z. B. am PC: beide Dateien herunterladen.
    dateiAusgeben(fertigeDateien[0], fertigeDateien[0].name);
    dateiAusgeben(fertigeDateien[1], fertigeDateien[1].name);
    exportStatus.textContent = 'This device cannot share files, so both files were downloaded instead.';
    await alsVerschicktMerken(aktuelleAbrechnung);
    teilenZuruecksetzen();
  }
}

// Betreff der Mail mit dem aktuellen Zeitraum, z. B.
//   "Travel Expense Report October 2026"                (ein Monat)
//   "Travel Expense Report October to November 2026"    (mehrere Monate)
//   "Travel Expense Report December 2026 to January 2027"
function betreffText(a) {
  const monate = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const vonJahr = a.von.slice(0, 4);
  const bisJahr = a.bis.slice(0, 4);
  const vonMonat = monate[Number(a.von.slice(5, 7)) - 1];
  const bisMonat = monate[Number(a.bis.slice(5, 7)) - 1];
  let zeitraum;
  if (a.von.slice(0, 7) === a.bis.slice(0, 7)) zeitraum = vonMonat + ' ' + vonJahr;
  else if (vonJahr === bisJahr) zeitraum = vonMonat + ' to ' + bisMonat + ' ' + bisJahr;
  else zeitraum = vonMonat + ' ' + vonJahr + ' to ' + bisMonat + ' ' + bisJahr;
  return 'Travel Expense Report ' + zeitraum;
}

async function dateienTeilen() {
  const a = aktuelleAbrechnung;
  const anrede = einstellungen.chefName ? 'Hello ' + einstellungen.chefName + ',' : 'Hello,';
  const betreff = betreffText(a);
  try {
    // navigator.share öffnet das Teilen-Menü vom iPhone.
    // Den Empfänger kann eine Web-App leider nicht vorgeben, den wählst du in Mail.
    // Wichtig: Mail auf dem iPhone nimmt die ERSTE ZEILE vom text als Betreff,
    // nicht den title. Deshalb steht der Betreff ganz oben im Text.
    await navigator.share({
      files: fertigeDateien,
      title: betreff,
      text: betreff + '\n\n' + anrede + '\n\nplease find attached my travel expense report ' +
        '(PDF with all receipts, and the Excel file). Please sign the PDF to approve it ' +
        'and send it back to me.\n\nThank you\n' + (a.name || '')
    });
    exportStatus.textContent = 'Sent. When the signed report comes back, mark it as approved below.';
    await alsVerschicktMerken(a);
  } catch (fehler) {
    // AbortError heißt: Du hast das Menü ohne Auswahl geschlossen. Kein echter Fehler.
    exportStatus.textContent = fehler.name === 'AbortError'
      ? 'Sharing cancelled. Tap again to share.'
      : 'Could not share. (' + fehler.message + ')';
  }
}

knopfTeilen.addEventListener('click', function () {
  if (!aktuelleAbrechnung) return;
  // Wichtig: Wenn die Dateien schon fertig sind, SOFORT teilen, ohne vorher zu warten.
  if (fertigeDateien) {
    dateienTeilen();
  } else {
    dateienVorbereiten();
  }
});


// ---------- Unterschrift ----------

let feld = null;   // das Unterschriftsfeld, siehe unterschrift.js

async function unterschriftSpeichern(bild) {
  // Die Unterschrift kommt zu den anderen Einstellungen (Name, Wohnort ...).
  const profil = (await dbLesen('einstellungen', 'profil')) || {};
  profil.unterschrift = bild;
  await dbSchreiben('einstellungen', profil, 'profil');
  einstellungen.unterschrift = bild;
  neuRechnen();   // Abrechnung unten mit der neuen Unterschrift zeigen
}

function unterschriftVorbereiten() {
  feld = unterschriftsFeld(document.getElementById('unterschrift'), unterschriftSpeichern);
  if (einstellungen.unterschrift) feld.zeigen(einstellungen.unterschrift);

  document.getElementById('unterschrift-weg').addEventListener('click', function () {
    feld.leeren();
    unterschriftSpeichern(null);
  });

  // Hinweis, an wen die Abrechnung geht, mit Knopf zum Kopieren der Mail-Adresse.
  const hinweis = document.getElementById('chef-hinweis');
  if (!einstellungen.chefName && !einstellungen.chefMail) {
    hinweis.textContent = 'Tip: Enter your supervisor in Settings, then the report names them for approval.';
    return;
  }
  hinweis.textContent = 'Approval by: ' + (einstellungen.chefName || '') +
    (einstellungen.chefMail ? ' (' + einstellungen.chefMail + ')' : '');
  if (einstellungen.chefMail && navigator.clipboard) {
    const kopieren = element('button', 'knopf', 'Copy supervisor email');
    kopieren.type = 'button';
    kopieren.addEventListener('click', async function () {
      await navigator.clipboard.writeText(einstellungen.chefMail);
      kopieren.textContent = 'Email copied. Paste it in Mail as recipient.';
    });
    hinweis.after(kopieren);   // after: direkt hinter dem Hinweis einfügen
  }
}


// ---------- Verschickte Abrechnungen (Status) ----------
//
// Gespeichert unter dem Schlüssel 'abrechnungen' als Liste:
//   [{ von: '2026-08-01', bis: '2026-09-30', gesamt: 457.19, auszahlung: 257.19,
//      verschickt: '2026-11-16', genehmigt: '' }]

async function verlaufLesen() {
  return (await dbLesen('einstellungen', 'abrechnungen')) || [];
}

async function alsVerschicktMerken(a) {
  const liste = await verlaufLesen();
  // Gibt es den Zeitraum schon? Dann diesen Eintrag aktualisieren statt einen neuen anzulegen.
  let eintrag = liste.find(function (e) { return e.von === a.von && e.bis === a.bis; });
  if (!eintrag) {
    eintrag = { von: a.von, bis: a.bis, genehmigt: '' };
    liste.push(eintrag);
  }
  eintrag.gesamt = a.gesamt;
  eintrag.auszahlung = a.auszahlung;
  eintrag.verschickt = heuteText();
  await dbSchreiben('einstellungen', liste, 'abrechnungen');
  verlaufZeichnen();
}

async function genehmigtUmschalten(von, bis) {
  const liste = await verlaufLesen();
  const eintrag = liste.find(function (e) { return e.von === von && e.bis === bis; });
  if (!eintrag) return;
  eintrag.genehmigt = eintrag.genehmigt ? '' : heuteText();
  await dbSchreiben('einstellungen', liste, 'abrechnungen');
  verlaufZeichnen();
}

async function verlaufZeichnen() {
  const liste = await verlaufLesen();
  const bereich = document.getElementById('verlauf');
  bereich.innerHTML = '';
  document.getElementById('verlauf-teil').hidden = liste.length === 0;

  // Neueste zuerst
  liste.sort(function (a, b) { return b.von.localeCompare(a.von); });
  for (const e of liste) {
    const zeile = element('li', 'zeile');
    const kopf = element('div', 'tag-kopf');
    kopf.appendChild(element('span', 'titel', datum(e.von) + ' to ' + datum(e.bis)));
    kopf.appendChild(element('span', 'titel', euro(e.gesamt)));
    zeile.appendChild(kopf);

    const status = e.genehmigt
      ? 'Approved on ' + datum(e.genehmigt)
      : 'Sent on ' + datum(e.verschickt) + ', waiting for approval';
    zeile.appendChild(element('span', e.genehmigt ? 'info status-ok' : 'warnung', status));

    const knopf = element('button', 'knopf knopf-status', e.genehmigt ? 'Undo approval' : 'Mark as approved');
    knopf.type = 'button';
    knopf.addEventListener('click', function () { genehmigtUmschalten(e.von, e.bis); });
    zeile.appendChild(knopf);
    bereich.appendChild(zeile);
  }
}


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
  unterschriftVorbereiten();
  neuRechnen();
  verlaufZeichnen();
}


laden();
