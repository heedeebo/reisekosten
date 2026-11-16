// ocr.js: Liest den Text vom Belegfoto und sucht Betrag, Datum, Händler und Kategorie.
//
// OCR heißt "Optical Character Recognition", auf Deutsch Texterkennung.
// Wir nutzen Tesseract.js. Es läuft komplett im Browser auf dem Handy.
// Das Foto wird NICHT verschickt. Aus dem Internet geladen werden nur beim ersten Mal
// das Programm und die deutschen Sprachdaten (zusammen ein paar MB).


// ---------- Teil 1: Text erkennen ----------

// Nach so vielen Sekunden ohne Ergebnis geben wir auf, statt ewig zu warten.
const OCR_ZEITLIMIT = 90;

// Was Tesseract gerade macht, in Worten für die Statuszeile.
const OCR_SCHRITTE = {
  'loading tesseract core': 'Loading text recognition',
  'initializing tesseract': 'Starting text recognition',
  'loading language traineddata': 'Loading German language data',
  'initializing api': 'Starting text recognition',
  'recognizing text': 'Reading receipt'
};

// foto: das Bild (Blob).
// fortschritt: eine Funktion, die einen Text bekommt, z. B. "Reading receipt 42 %".
// Gibt den erkannten Text zurück.
async function texterkennung(foto, fortschritt) {
  // typeof prüft, ob es Tesseract überhaupt gibt (ohne Internet fehlt es noch).
  if (typeof Tesseract === 'undefined') {
    throw new Error('Text recognition could not be loaded. Is the iPhone online?');
  }

  // Promise.race: Wer zuerst fertig ist, gewinnt. Entweder die Erkennung
  // oder die Stoppuhr, die nach OCR_ZEITLIMIT Sekunden einen Fehler meldet.
  const stoppuhr = new Promise(function (fertig, fehler) {
    setTimeout(function () {
      fehler(new Error('Text recognition took too long (over ' + OCR_ZEITLIMIT + ' seconds).'));
    }, OCR_ZEITLIMIT * 1000);
  });
  return Promise.race([erkennen(foto, fortschritt), stoppuhr]);
}

async function erkennen(foto, fortschritt) {
  // Ein "Worker" ist ein Helfer, der im Hintergrund rechnet, damit die App nicht hängt.
  // 'deu' = deutsche Sprachdaten.
  const helfer = await Tesseract.createWorker('deu', 1, {
    logger: function (nachricht) {
      if (!fortschritt) return;
      const text = OCR_SCHRITTE[nachricht.status] || nachricht.status;
      fortschritt(text + ' ' + Math.round((nachricht.progress || 0) * 100) + ' %');
    }
  });

  try {
    const ergebnis = await helfer.recognize(foto);
    return ergebnis.data.text;
  } finally {
    // finally läuft immer, auch bei einem Fehler. Helfer beenden, Speicher freigeben.
    await helfer.terminate();
  }
}


// ---------- Teil 2: Werte im Text finden ----------

// Ein Betrag sieht so aus: 12,50 oder 1.234,56 oder 12.50
//   (\d{1,3}(?:\.\d{3})+|\d+)  Euro-Teil, auch mit Tausenderpunkten
//   \s?[,.]\s?                 Komma oder Punkt, OCR setzt manchmal Leerzeichen dazwischen
//   (\d{2})(?!\d)              genau zwei Cent-Stellen
// Das g am Ende heißt: alle Treffer suchen, nicht nur den ersten.
const BETRAG_MUSTER = /(\d{1,3}(?:\.\d{3})+|\d+)\s?[,.]\s?(\d{2})(?!\d)/g;

// Wörter, neben denen meistens der Endbetrag steht. Die vorderen sind sicherer.
const SUMMEN_WOERTER = ['zu zahlen', 'gesamtbetrag', 'endbetrag', 'rechnungsbetrag',
  'gesamt', 'summe', 'total', 'betrag', 'brutto'];

// Zeilen, die fast nie den Endbetrag enthalten: Netto, Rückgeld und Steuer-Zeilen.
// Ausnahme: "Gesamt inkl. MwSt" ist sehr wohl der Endbetrag.
// \b heißt Wortgrenze, damit "ust" nicht in "Augustiner" gefunden wird.
function falscheZeile(zeileKlein) {
  if (/netto|gegeben|rückgeld|zurück/.test(zeileKlein)) return true;
  if (/mwst|\bust\b|steuer/.test(zeileKlein) && !zeileKlein.includes('inkl')) return true;
  return false;
}


// Alle Beträge in einem Text als Zahlen: "2x 3,50  7,00" -> [3.5, 7]
function betraegeIn(text) {
  const zahlen = [];
  // matchAll findet jeden Treffer des Musters. treffer[1] = Euro, treffer[2] = Cent.
  for (const treffer of text.matchAll(BETRAG_MUSTER)) {
    const euroTeil = treffer[1].replace(/\./g, '');
    zahlen.push(Number(euroTeil + '.' + treffer[2]));
  }
  return zahlen;
}


function betragFinden(zeilen) {
  const klein = zeilen.map(function (z) { return z.toLowerCase(); });

  // 1. Versuch: Zeile mit einem Summen-Wort. Die letzte passende Zeile gewinnt,
  //    weil "Zwischensumme" meist vor der richtigen Summe steht.
  for (const wort of SUMMEN_WOERTER) {
    for (let i = klein.length - 1; i >= 0; i--) {
      if (!klein[i].includes(wort) || falscheZeile(klein[i])) continue;
      let betraege = betraegeIn(zeilen[i]);
      // Manchmal steht der Betrag erst in der nächsten Zeile.
      if (betraege.length === 0 && i + 1 < zeilen.length) betraege = betraegeIn(zeilen[i + 1]);
      if (betraege.length > 0) return betraege[betraege.length - 1];
    }
  }

  // 2. Versuch: der größte Betrag auf dem ganzen Beleg (ohne Steuer- und Rückgeld-Zeilen).
  let groesster = null;
  for (let i = 0; i < zeilen.length; i++) {
    if (falscheZeile(klein[i])) continue;
    for (const zahl of betraegeIn(zeilen[i])) {
      if (groesster === null || zahl > groesster) groesster = zahl;
    }
  }
  return groesster;
}


// Datum wie 16.11.2026, 16.11.26, 16/11/2026 oder 2026-11-16 -> "2026-11-16"
function datumFinden(text) {
  const deutsch = /(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4}|\d{2})(?!\d)/g;
  for (const t of text.matchAll(deutsch)) {
    let jahr = Number(t[3]);
    if (jahr < 100) jahr = jahr + 2000;   // "26" -> 2026
    const ergebnis = datumPruefen(jahr, Number(t[2]), Number(t[1]));
    if (ergebnis) return ergebnis;
  }
  const iso = /(\d{4})-(\d{2})-(\d{2})/g;
  for (const t of text.matchAll(iso)) {
    const ergebnis = datumPruefen(Number(t[1]), Number(t[2]), Number(t[3]));
    if (ergebnis) return ergebnis;
  }
  return null;
}

// Nur echte Daten durchlassen, z. B. keinen 45.13.
function datumPruefen(jahr, monat, tag) {
  if (jahr < 2000 || jahr > 2099 || monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return jahr + '-' + String(monat).padStart(2, '0') + '-' + String(tag).padStart(2, '0');
}


// Händler: meistens die erste Zeile oben, die hauptsächlich aus Buchstaben besteht.
function haendlerFinden(zeilen) {
  for (const zeile of zeilen.slice(0, 6)) {
    const sauber = zeile.trim();
    const buchstaben = (sauber.match(/[a-zäöüß]/gi) || []).length;
    const zeichen = sauber.replace(/\s/g, '').length;
    if (buchstaben >= 3 && buchstaben / zeichen > 0.6) {
      return sauber.slice(0, 40);
    }
  }
  return '';
}


// Kategorie: Welche Kategorie hat die meisten Stichwörter im Text?
function kategorieFinden(text) {
  const klein = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  let beste = '';
  let bestePunkte = 0;
  for (const kategorie of KATEGORIEN) {
    let punkte = 0;
    for (const wort of kategorie.stichwoerter) {
      // Nur ganze Wörter zählen: "jet" soll nicht in "objekt" gefunden werden.
      const vorne = '(^|[^a-zäöüß])';
      const hinten = '([^a-zäöüß]|$)';
      if (new RegExp(vorne + wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + hinten).test(klein)) {
        punkte = punkte + 1;
      }
    }
    if (punkte > bestePunkte) {
      beste = kategorie.schluessel;
      bestePunkte = punkte;
    }
  }
  return beste;
}


// Alles zusammen. Was nicht gefunden wird, ist null oder ''.
function werteAuslesen(text) {
  const zeilen = text.split('\n').filter(function (z) { return z.trim() !== ''; });
  return {
    betrag: betragFinden(zeilen),
    datum: datumFinden(text),
    haendler: haendlerFinden(zeilen),
    kategorie: kategorieFinden(text)
  };
}
