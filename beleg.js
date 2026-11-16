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
let bekannteHaendler = []; // Händlernamen von früheren Belegen, hilft der Texterkennung


// ---------- Bewirtung (Restaurantbeleg) ----------

const bewirtungTeil = document.getElementById('bewirtung-teil');
// querySelectorAll holt alle passenden Elemente, hier die drei Mahlzeit-Knöpfe.
const mahlzeitKnoepfe = document.querySelectorAll('#mahlzeit-wahl .mahlzeit-knopf');

let gewaehlteMahlzeit = '';   // 'fruehstueck', 'mittag', 'abend' oder '' (keine)

// Zeigt den Bereich nur bei der Kategorie "Business meal".
function bewirtungTeilAnpassen() {
  bewirtungTeil.hidden = feldKategorie.value !== 'bewirtung';
}

// Einen Mahlzeit-Knopf an, die anderen aus. Nochmal tippen schaltet aus.
function mahlzeitWaehlen(mahlzeit) {
  gewaehlteMahlzeit = (gewaehlteMahlzeit === mahlzeit) ? '' : mahlzeit;
  for (const knopf of mahlzeitKnoepfe) {
    // dataset.mahlzeit liest das Attribut data-mahlzeit="..." aus dem HTML.
    knopf.setAttribute('aria-pressed', knopf.dataset.mahlzeit === gewaehlteMahlzeit ? 'true' : 'false');
  }
}

for (const knopf of mahlzeitKnoepfe) {
  knopf.addEventListener('click', function () { mahlzeitWaehlen(knopf.dataset.mahlzeit); });
}
feldKategorie.addEventListener('change', bewirtungTeilAnpassen);


// Markiert eine Mahlzeit bei einer Reise als gestellt (an = true) oder nimmt die Markierung weg.
async function mahlzeitBeiReiseSetzen(reiseId, datumText, mahlzeit, an) {
  const reise = await dbLesen('reisen', reiseId);
  if (!reise) return;
  // Nur wenn der Tag wirklich zur Reise gehört.
  if (datumText < reise.start.slice(0, 10) || datumText > reise.ende.slice(0, 10)) return;
  if (!reise.mahlzeiten) reise.mahlzeiten = {};
  if (!reise.mahlzeiten[datumText]) reise.mahlzeiten[datumText] = {};
  reise.mahlzeiten[datumText][mahlzeit] = an;
  await dbSchreiben('reisen', reise);
}


// ---------- Foto ----------

const ocrStatus = document.getElementById('ocr-status');

// Wird aufgerufen, wenn ein Foto gewählt wurde (Kamera oder Datei).
async function fotoUebernehmen(datei) {
  if (!datei) return;
  meldung.textContent = '';

  // PDF-Rechnung? Dann anders einlesen (pdfbeleg.js).
  if (istPdf(datei)) {
    await pdfUebernehmen(datei);
    return;
  }

  try {
    foto = await bildVerkleinern(datei);   // aus bild.js
    fotoZeigen(foto);
  } catch (fehler) {
    meldung.textContent = 'This photo could not be read. Please try another one.';
    return;
  }
  await belegAuslesen(foto);
}


// PDF-Rechnung: erste Seite als Bild speichern. Enthält das PDF Text, den direkt auswerten,
// sonst die Texterkennung über das Bild laufen lassen.
async function pdfUebernehmen(datei) {
  ocrStatus.textContent = 'Reading PDF…';
  let ergebnis;
  try {
    ergebnis = await pdfLesen(datei);   // aus pdfbeleg.js
  } catch (fehler) {
    ocrStatus.textContent = '';
    meldung.textContent = 'This PDF could not be read. (' + fehler.message + ')';
    return;
  }
  foto = ergebnis.bild;
  fotoZeigen(foto);

  // Mehr als ein paar Zeichen Text: Das PDF hat echten Text, keine Texterkennung nötig.
  if (ergebnis.text.length > 20) {
    textAuswerten(ergebnis.text);
  } else {
    await belegAuslesen(foto);   // eingescanntes PDF ohne Text
  }
}


// Texterkennung starten und die Felder vorfüllen (ocr.js).
// Felder, in die du schon etwas getippt hast, werden nicht überschrieben.
async function belegAuslesen(bild) {
  ocrStatus.textContent = 'Starting text recognition…';
  let text;
  try {
    // Foto aufbereiten (Graustufen, mehr Kontrast), aus bild.js. Gespeichert wird das Original.
    const vorbereitet = await bildFuerTexterkennung(bild);
    text = await texterkennung(vorbereitet, function (stand) {
      // stand ist ein Text wie "Loading German language data 40 %"
      ocrStatus.textContent = stand;
    });
  } catch (fehler) {
    // Den Grund mit anzeigen, damit wir wissen, was schiefging.
    ocrStatus.textContent = 'Could not read the receipt automatically. Please enter the values. (' +
      (fehler && fehler.message ? fehler.message : fehler) + ')';
    return;
  }

  textAuswerten(text);
}


// Was die Texterkennung beim letzten Foto eingetragen hat. Machst du ein neues Foto,
// ersetzen wir diese Werte. Was du selbst getippt hast, bleibt stehen.
let letzteOcrWerte = { betrag: '', haendler: '', kategorie: '', mahlzeit: '' };

// Darf die Texterkennung dieses Feld füllen? Ja, wenn es leer ist oder noch
// genau den Wert vom letzten Foto enthält (also nicht von dir geändert wurde).
function darfFuellen(aktuell, schluessel) {
  return aktuell === '' || aktuell === letzteOcrWerte[schluessel];
}

// Sucht im Text nach Betrag, Datum, Händler und Kategorie und füllt die Felder.
function textAuswerten(text) {
  // Den gelesenen Text zum Nachschauen anzeigen (aufklappbar unter dem Statuskasten).
  document.getElementById('ocr-text').textContent = text;
  document.getElementById('ocr-text-box').hidden = false;

  const werte = werteAuslesen(text, bekannteHaendler);
  const gefunden = [];   // für die Meldung: was wurde erkannt?

  // Werte vom vorigen Foto, die du nicht geändert hast, erst einmal leeren.
  // Findet das neue Foto keinen Betrag, bleibt sonst der alte falsche stehen.
  if (darfFuellen(feldBetrag.value, 'betrag')) feldBetrag.value = '';
  if (darfFuellen(feldHaendler.value, 'haendler')) feldHaendler.value = '';
  if (darfFuellen(feldKategorie.value, 'kategorie')) feldKategorie.value = '';

  if (werte.betrag !== null && darfFuellen(feldBetrag.value, 'betrag')) {
    feldBetrag.value = zahlAnzeigen(werte.betrag);
    letzteOcrWerte.betrag = feldBetrag.value;
    gefunden.push('amount');
  }
  // Das Datum steht vorab auf heute. Ein Datum vom Beleg ist besser, also immer übernehmen,
  // außer beim Ändern eines gespeicherten Belegs.
  if (werte.datum !== null && alterBeleg === null) {
    feldDatum.value = werte.datum;
    reiseAutomatischWaehlen();
    gefunden.push('date');
  }
  if (werte.haendler !== '' && darfFuellen(feldHaendler.value, 'haendler')) {
    feldHaendler.value = werte.haendler;
    letzteOcrWerte.haendler = feldHaendler.value;
    gefunden.push('merchant');
  }
  if (werte.kategorie !== '' && darfFuellen(feldKategorie.value, 'kategorie')) {
    feldKategorie.value = werte.kategorie;
    letzteOcrWerte.kategorie = feldKategorie.value;
    bewirtungTeilAnpassen();
    gefunden.push('category');
  }
  // Uhrzeit auf dem Beleg -> Mahlzeit vorschlagen.
  if (werte.mahlzeit !== '' && darfFuellen(gewaehlteMahlzeit, 'mahlzeit')) {
    if (gewaehlteMahlzeit !== werte.mahlzeit) mahlzeitWaehlen(werte.mahlzeit);
    letzteOcrWerte.mahlzeit = werte.mahlzeit;
  }

  ocrStatus.textContent = gefunden.length > 0
    ? 'Found ' + gefunden.join(', ') + '. Please check the values.'
    : 'Nothing found in the text. Please enter the values.';
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

  // Alle Händlernamen, die du schon einmal gespeichert hast. new Set entfernt doppelte.
  // So lernt die App mit jedem Beleg dazu: Beim nächsten Bon vom selben Laden passt der Name.
  const alleBelege = await dbAlleLesen('belege');
  bekannteHaendler = Array.from(new Set(alleBelege
    .map(function (b) { return b.haendler; })
    .filter(function (h) { return h && h.length >= 3; })));
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
  knopfLoeschen.hidden = false;   // Löschen-Knopf zeigen
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
  if (alterBeleg.mahlzeit) mahlzeitWaehlen(alterBeleg.mahlzeit);
  bewirtungTeilAnpassen();

  // Den alten Stand merken. Ändert sich beim Speichern Mahlzeit, Datum oder Reise,
  // nehmen wir die alte Markierung bei der Reise wieder weg.
  vorher = {
    bewirtung: alterBeleg.kategorie === 'bewirtung',
    reiseId: alterBeleg.reiseId,
    datum: alterBeleg.datum,
    mahlzeit: alterBeleg.mahlzeit || ''
  };
}

let vorher = null;


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

  const istBewirtung = feldKategorie.value === 'bewirtung';

  const beleg = alterBeleg || {};
  if (!beleg.nummer) beleg.nummer = await naechsteNummer();
  beleg.betrag = betrag;
  beleg.datum = feldDatum.value;
  beleg.haendler = feldHaendler.value.trim();
  beleg.kategorie = feldKategorie.value;
  beleg.reiseId = feldReise.value === '' ? null : Number(feldReise.value);
  beleg.foto = foto;
  // Bei anderen Kategorien bleibt die Mahlzeit leer.
  beleg.mahlzeit = istBewirtung ? gewaehlteMahlzeit : '';

  await dbSchreiben('belege', beleg);

  // Mahlzeit bei der Reise als gestellt markieren.
  // Erst eine alte Markierung wegnehmen, falls sich etwas geändert hat ...
  const jetzt = { bewirtung: istBewirtung, reiseId: beleg.reiseId, datum: beleg.datum, mahlzeit: beleg.mahlzeit };
  const gleich = vorher && JSON.stringify(vorher) === JSON.stringify(jetzt);
  if (vorher && vorher.bewirtung && vorher.mahlzeit && vorher.reiseId !== null && !gleich) {
    await mahlzeitBeiReiseSetzen(vorher.reiseId, vorher.datum, vorher.mahlzeit, false);
  }
  // ... dann die neue setzen.
  if (istBewirtung && beleg.mahlzeit && beleg.reiseId !== null && !gleich) {
    await mahlzeitBeiReiseSetzen(beleg.reiseId, beleg.datum, beleg.mahlzeit, true);
  }

  // Zurück zur Reise, oder zur Startseite, wenn der Beleg keine Reise hat.
  location.href = beleg.reiseId === null ? 'index.html' : 'reise.html?id=' + beleg.reiseId;
});


// ---------- Löschen ----------

const knopfLoeschen = document.getElementById('loeschen');

knopfLoeschen.addEventListener('click', async function () {
  if (!confirm('Delete receipt No. ' + alterBeleg.nummer + '? This cannot be undone.')) return;

  // War es ein Restaurantbeleg mit Mahlzeit? Dann die Markierung bei der Reise wegnehmen.
  if (vorher && vorher.bewirtung && vorher.mahlzeit && vorher.reiseId !== null) {
    await mahlzeitBeiReiseSetzen(vorher.reiseId, vorher.datum, vorher.mahlzeit, false);
  }
  await dbLoeschen('belege', belegId);
  location.href = alterBeleg.reiseId === null ? 'index.html' : 'reise.html?id=' + alterBeleg.reiseId;
});


laden();
