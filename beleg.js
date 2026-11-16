// beleg.js: Einen Beleg erfassen: Foto, Betrag, Datum, Händler, Kategorie, Reise.

const formular = document.getElementById('formular');
const titel = document.getElementById('titel');
const linkZurueck = document.getElementById('zurueck');
const vorschau = document.getElementById('vorschau');
const feldKamera = document.getElementById('foto-kamera');
const feldDatei = document.getElementById('foto-datei');
const feldBetrag = document.getElementById('betrag');
const feldDatum = document.getElementById('datum');
const feldHaendler = document.getElementById('haendler');
const feldKategorie = document.getElementById('kategorie');
const feldReise = document.getElementById('reise');
const reiseHinweis = document.getElementById('reise-hinweis');
const meldung = document.getElementById('meldung');

const adressTeile = new URLSearchParams(location.search);
const belegId = adressTeile.has('id') ? Number(adressTeile.get('id')) : null;
const startReise = adressTeile.has('reise') ? Number(adressTeile.get('reise')) : null;

let alterBeleg = null;   // beim Ändern: der gespeicherte Beleg
let foto = null;         // das verkleinerte Foto (Blob)
let alleReisen = [];     // für die Auswahl und die Zuordnung über das Datum
let reiseVonHand = false; // true, sobald man die Reise selbst ausgewählt hat


// ---------- Foto ----------

const ocrStatus = document.getElementById('ocr-status');

// Wird aufgerufen, wenn ein Foto gewählt wurde (Kamera oder Datei).
async function fotoUebernehmen(datei) {
  if (!datei) return;
  meldung.textContent = '';
  try {
    foto = await bildVerkleinern(datei);   // aus bild.js
    fotoZeigen(foto);
  } catch (fehler) {
    meldung.textContent = 'This photo could not be read. Please try another one.';
    return;
  }
  await belegAuslesen(foto);
}


// Texterkennung starten und die Felder vorfüllen (ocr.js).
// Felder, in die du schon etwas getippt hast, werden nicht überschrieben.
async function belegAuslesen(bild) {
  ocrStatus.textContent = 'Starting text recognition…';
  let text;
  try {
    text = await texterkennung(bild, function (stand) {
      // stand ist ein Text wie "Loading German language data 40 %"
      ocrStatus.textContent = stand;
    });
  } catch (fehler) {
    // Den Grund mit anzeigen, damit wir wissen, was schiefging.
    ocrStatus.textContent = 'Could not read the receipt automatically. Please enter the values. (' +
      (fehler && fehler.message ? fehler.message : fehler) + ')';
    return;
  }

  const werte = werteAuslesen(text);
  const gefunden = [];   // für die Meldung: was wurde erkannt?

  // Beim Ändern steht im Betrag schon etwas, bei einem neuen Beleg ist er leer.
  if (werte.betrag !== null && feldBetrag.value === '') {
    feldBetrag.value = zahlAnzeigen(werte.betrag);
    gefunden.push('amount');
  }
  // Das Datum steht vorab auf heute. Ein Datum vom Beleg ist besser, also immer übernehmen,
  // außer beim Ändern eines gespeicherten Belegs.
  if (werte.datum !== null && alterBeleg === null) {
    feldDatum.value = werte.datum;
    reiseAutomatischWaehlen();
    gefunden.push('date');
  }
  if (werte.haendler !== '' && feldHaendler.value === '') {
    feldHaendler.value = werte.haendler;
    gefunden.push('merchant');
  }
  if (werte.kategorie !== '' && feldKategorie.value === '') {
    feldKategorie.value = werte.kategorie;
    gefunden.push('category');
  }

  ocrStatus.textContent = gefunden.length > 0
    ? 'Found ' + gefunden.join(', ') + '. Please check the values.'
    : 'Nothing found on the receipt. Please enter the values.';
}

function fotoZeigen(blob) {
  vorschau.src = URL.createObjectURL(blob);
  vorschau.hidden = false;
}

// "change" passiert, wenn im Datei-Feld etwas ausgewählt wurde.
// files[0] ist die erste (und einzige) gewählte Datei.
feldKamera.addEventListener('change', function () { fotoUebernehmen(feldKamera.files[0]); });
feldDatei.addEventListener('change', function () { fotoUebernehmen(feldDatei.files[0]); });


// ---------- Auswahllisten füllen ----------

function kategorienFuellen() {
  for (const kategorie of KATEGORIEN) {
    // new Option(text, wert) baut einen Eintrag für die Auswahlliste.
    feldKategorie.appendChild(new Option(kategorie.text, kategorie.schluessel));
  }
}

function reisenFuellen() {
  // Neueste Reise oben, wie auf der Startseite.
  alleReisen.sort(function (a, b) { return b.start.localeCompare(a.start); });
  for (const reise of alleReisen) {
    const text = reise.ziel + ' (' + datum(reise.start) + ')';
    feldReise.appendChild(new Option(text, String(reise.id)));
  }
}


// ---------- Reise über das Datum finden ----------

// Sucht die Reise, in deren Zeitraum das Datum liegt. Keine gefunden: null.
function reiseZumDatum(datumText) {
  for (const reise of alleReisen) {
    // Nur das Datum vergleichen (die ersten 10 Zeichen), die Uhrzeit ist egal.
    if (datumText >= reise.start.slice(0, 10) && datumText <= reise.ende.slice(0, 10)) {
      return reise;
    }
  }
  return null;
}

function reiseAutomatischWaehlen() {
  if (reiseVonHand || feldDatum.value === '') return;
  const reise = reiseZumDatum(feldDatum.value);
  feldReise.value = reise ? String(reise.id) : '';
  reiseHinweis.textContent = reise
    ? 'Matched by date. You can change it.'
    : 'No trip found for this date.';
}

feldDatum.addEventListener('change', reiseAutomatischWaehlen);
feldReise.addEventListener('change', function () {
  reiseVonHand = true;
  reiseHinweis.textContent = '';
});


// ---------- Laden ----------

// Heutiges Datum als "2026-11-16" (in deiner Zeitzone).
function heute() {
  const jetzt = new Date();
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0');   // padStart: "8" -> "08"
  const tag = String(jetzt.getDate()).padStart(2, '0');
  return jetzt.getFullYear() + '-' + monat + '-' + tag;
}

async function laden() {
  kategorienFuellen();
  alleReisen = await dbAlleLesen('reisen');
  reisenFuellen();

  if (belegId === null) {
    // Neuer Beleg
    feldDatum.value = heute();
    if (startReise !== null) {
      feldReise.value = String(startReise);
      reiseVonHand = true;
      linkZurueck.href = 'reise.html?id=' + startReise;
    } else {
      reiseAutomatischWaehlen();
    }
    return;
  }

  // Beleg ändern
  alterBeleg = await dbLesen('belege', belegId);
  if (!alterBeleg) {
    meldung.textContent = 'This receipt does not exist anymore.';
    return;
  }
  titel.textContent = 'Receipt No. ' + alterBeleg.nummer;
  document.title = titel.textContent;
  feldBetrag.value = zahlAnzeigen(alterBeleg.betrag);
  feldDatum.value = alterBeleg.datum;
  feldHaendler.value = alterBeleg.haendler;
  feldKategorie.value = alterBeleg.kategorie;
  feldReise.value = alterBeleg.reiseId === null ? '' : String(alterBeleg.reiseId);
  reiseVonHand = true;   // beim Ändern nichts mehr automatisch umstellen
  if (alterBeleg.reiseId !== null) linkZurueck.href = 'reise.html?id=' + alterBeleg.reiseId;
  if (alterBeleg.foto) {
    foto = alterBeleg.foto;
    fotoZeigen(foto);
  }
}


// ---------- Speichern ----------

// Nächste freie Belegnummer: die höchste bisherige plus 1.
async function naechsteNummer() {
  const belege = await dbAlleLesen('belege');
  let hoechste = 0;
  for (const beleg of belege) {
    if (beleg.nummer > hoechste) hoechste = beleg.nummer;
  }
  return hoechste + 1;
}

function pruefen(betrag) {
  if (!foto) return 'Please take or choose a photo of the receipt.';
  if (Number.isNaN(betrag) || betrag <= 0) return 'Please enter the amount, e.g. 23,50.';
  if (feldDatum.value === '') return 'Please enter the date.';
  if (feldKategorie.value === '') return 'Please choose a category.';
  return '';
}

formular.addEventListener('submit', async function (ereignis) {
  ereignis.preventDefault();

  const betrag = zahlLesen(feldBetrag.value);
  const fehler = pruefen(betrag);
  if (fehler !== '') {
    meldung.textContent = fehler;
    return;
  }

  const beleg = alterBeleg || {};
  if (!beleg.nummer) beleg.nummer = await naechsteNummer();
  beleg.betrag = betrag;
  beleg.datum = feldDatum.value;
  beleg.haendler = feldHaendler.value.trim();
  beleg.kategorie = feldKategorie.value;
  beleg.reiseId = feldReise.value === '' ? null : Number(feldReise.value);
  beleg.foto = foto;

  await dbSchreiben('belege', beleg);

  // Zurück zur Reise, oder zur Startseite, wenn der Beleg keine Reise hat.
  location.href = beleg.reiseId === null ? 'index.html' : 'reise.html?id=' + beleg.reiseId;
});


laden();
