// ocr.js: Liest den Text vom Belegfoto und sucht Betrag, Datum, Händler und Kategorie.
//
// OCR heißt "Optical Character Recognition", auf Deutsch Texterkennung.
// Wir nutzen Tesseract.js. Es läuft komplett im Browser auf dem Handy.
// Das Foto wird NICHT verschickt. Aus dem Internet geladen werden nur beim ersten Mal
// das Programm und die deutschen Sprachdaten (zusammen ein paar MB).


// ---------- Teil 1: Text erkennen ----------

// Woher Tesseract seine Teile holt (feste Versionen). sw.js speichert dieselben Adressen.
const OCR_DATEIEN = {
  programm: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  sprache: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu/4.0.0_best_int'
};

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
  // Die Adressen geben wir fest vor, damit der Service Worker (sw.js) genau diese
  // Dateien vorher speichern kann. Dann klappt die Texterkennung auch ohne Netz.
  const helfer = await Tesseract.createWorker('deu', 1, {
    workerPath: 'ocr-worker.js',
    workerBlobURL: false,
    corePath: OCR_DATEIEN.programm,
    langPath: OCR_DATEIEN.sprache,
    logger: function (nachricht) {
      if (!fortschritt) return;
      const text = OCR_SCHRITTE[nachricht.status] || nachricht.status;
      fortschritt(text + ' ' + Math.round((nachricht.progress || 0) * 100) + ' %');
    }
  });

  try {
    // Einstellungen für Kassenbons:
    //   pageseg_mode 4 = "eine Spalte Text mit verschieden großer Schrift". So sind Bons aufgebaut.
    //   Standard wäre 3 (ganze Seite mit Spalten), das zerreißt Bons oft in Stücke.
    //   preserve_interword_spaces = Abstände zwischen Wörtern behalten (Betrag rechts außen).
    await helfer.setParameters({
      tessedit_pageseg_mode: '4',
      preserve_interword_spaces: '1'
    });
    // rotateAuto: Liegt das Foto quer, dreht Tesseract es selbst richtig.
    const ergebnis = await helfer.recognize(foto, { rotateAuto: true });
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

// Wörter, neben denen der Endbetrag steht (3 Punkte) ...
const SUMMEN_WOERTER = ['zu zahlen', 'zahlbetrag', 'gesamtbetrag', 'endbetrag', 'rechnungsbetrag',
  'endsumme', 'gesamtsumme', 'summe', 'gesamt', 'total'];
// ... und Wörter, die auf eine Zahlung hinweisen (1 Punkt).
const ZAHL_WOERTER = ['bar', 'ec', 'karte', 'girocard', 'visa', 'mastercard', 'maestro',
  'kreditkarte', 'betrag', 'eur', 'brutto', 'zahlung', 'bezahlt'];

// Zeilen, die fast nie den Endbetrag enthalten: Netto, Rückgeld und Steuer-Zeilen.
// Ausnahme: "Gesamt inkl. MwSt" ist sehr wohl der Endbetrag.
// \b heißt Wortgrenze, damit "ust" nicht in "Augustiner" gefunden wird.
function falscheZeile(zeileKlein) {
  if (/netto|gegeben|rückgeld|zurück|wechselgeld/.test(zeileKlein)) return true;
  if (/mwst|\bust\b|steuer/.test(zeileKlein) && !zeileKlein.includes('inkl')) return true;
  return false;
}


// Typische Lesefehler bei Zahlen reparieren, z. B. "12,5O" -> "12,50" oder "l2,50" -> "12,50".
// Nur dort, wo direkt eine Ziffer daneben steht, damit Wörter heil bleiben.
function ziffernReparieren(zeile) {
  return zeile
    .replace(/(?<=\d[.,]?)[oO]|[oO](?=[.,]?\d)/g, '0')
    .replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, '1')
    .replace(/(?<=\d)[‚']\s?(?=\d\d(?!\d))/g, ',');
}


// Alle Beträge in einem Text als Zahlen: "2x 3,50  7,00" -> [3.5, 7]
function betraegeIn(text) {
  const zahlen = [];
  // matchAll findet jeden Treffer des Musters. treffer[1] = Euro, treffer[2] = Cent.
  for (const treffer of ziffernReparieren(text).matchAll(BETRAG_MUSTER)) {
    const euroTeil = treffer[1].replace(/\./g, '');
    zahlen.push(Number(euroTeil + '.' + treffer[2]));
  }
  return zahlen;
}


// Wie viele Buchstaben muss man ändern, damit aus a b wird? ("summe" -> "sumne" = 1)
// Damit erkennen wir Wörter auch, wenn die Texterkennung sich bei einem Buchstaben vertan hat.
function abstand(a, b) {
  const zeile = [];
  for (let j = 0; j <= b.length; j++) zeile.push(j);
  for (let i = 1; i <= a.length; i++) {
    let vorher = zeile[0];
    zeile[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const merk = zeile[j];
      zeile[j] = Math.min(zeile[j] + 1, zeile[j - 1] + 1, vorher + (a[i - 1] === b[j - 1] ? 0 : 1));
      vorher = merk;
    }
  }
  return zeile[b.length];
}

// Steht eins der Wörter in der Zeile? Lange Wörter auch mit einem Lesefehler.
function hatWort(zeileKlein, woerter) {
  const teile = zeileKlein.split(/[^a-zäöüß€]+/);
  return woerter.some(function (wort) {
    if (wort.includes(' ')) return zeileKlein.includes(wort);
    return teile.some(function (teil) {
      if (teil === wort) return true;
      return wort.length >= 5 && Math.abs(teil.length - wort.length) <= 1 && abstand(teil, wort) <= 1;
    });
  });
}


// Den Endbetrag finden. Jeder Betrag auf dem Beleg sammelt Punkte:
//   10 Punkte, wenn er neben "Summe", "Gesamt", "Total" ... steht (bzw. in der Zeile darunter)
//    3 Punkte, wenn er neben "Bar", "Karte", "EUR" ... steht
//    1 Punkt  für jedes Mal, das er auf dem Beleg vorkommt (die Summe steht oft 2- bis 3-mal da)
// Es gewinnt der Betrag mit den meisten Punkten. Bei Gleichstand der größere.
function betragFinden(zeilen) {
  const punkte = new Map();   // Betrag -> Punkte
  const dazu = function (betrag, wert) { punkte.set(betrag, (punkte.get(betrag) || 0) + wert); };

  for (let i = 0; i < zeilen.length; i++) {
    const klein = zeilen[i].toLowerCase();
    if (falscheZeile(klein)) continue;

    let betraege = betraegeIn(zeilen[i]);
    const summenZeile = hatWort(klein, SUMMEN_WOERTER);
    // Steht "Summe" allein in der Zeile, steht der Betrag meist in der nächsten.
    if (summenZeile && betraege.length === 0 && i + 1 < zeilen.length) {
      betraege = betraegeIn(zeilen[i + 1]);
    }

    for (const betrag of betraege) {
      if (betrag <= 0 || betrag > 50000) continue;   // Unsinn wie Telefonnummern aussortieren
      dazu(betrag, 1);
    }
    // Bonus nur für den letzten Betrag der Zeile (der steht rechts, wo die Summe steht).
    if (betraege.length > 0) {
      const rechts = betraege[betraege.length - 1];
      if (summenZeile) dazu(rechts, 10);
      else if (hatWort(klein, ZAHL_WOERTER)) dazu(rechts, 3);
    }
  }

  let bester = null;
  let bestePunkte = -1;
  for (const [betrag, wert] of punkte) {
    if (wert > bestePunkte || (wert === bestePunkte && betrag > bester)) {
      bester = betrag;
      bestePunkte = wert;
    }
  }
  return bester;
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


// Händler finden.
// 1. Kennt die App den Händler schon (von früheren Belegen) und steht er im Text: den nehmen.
// 2. Sonst: oben auf dem Beleg die erste Zeile, die wie ein Name aussieht.
//    Adresse, Telefon, Steuernummer, "Rechnung" und ähnliches überspringen.
//    Eine Zeile mit einem bekannten Markennamen (Aral, Sixt, Hotel ...) wird bevorzugt.

const KEIN_NAME = /www\.|https?:|@|\btel\b|telefon|fax|str\.|straße|strasse|allee|\b\d{5}\b|\bust\b|steuer|st\.?-?nr|rechnung|quittung|beleg|\bbon\b|kasse|datum|uhrzeit|filiale|willkommen|vielen dank|danke|kundenbeleg|händlerbeleg/i;

function nameSaeubern(zeile) {
  return zeile
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zäöüß0-9&]+|[^a-zäöüß0-9&.)]+$/gi, '')   // Zeichenmüll am Anfang und Ende
    .slice(0, 40);
}

function siehtWieNameAus(zeile) {
  const buchstaben = (zeile.match(/[a-zäöüß]/gi) || []).length;
  const zeichen = zeile.replace(/\s/g, '').length;
  const langesWort = /[a-zäöüß]{3,}/i.test(zeile);
  return buchstaben >= 3 && langesWort && buchstaben / zeichen > 0.6 && !KEIN_NAME.test(zeile);
}

function haendlerFinden(zeilen, bekannteHaendler) {
  // 1. Bekannte Händler, der längste Treffer gewinnt ("Hotel Adler" vor "Adler").
  const text = zeilen.join(' ').toLowerCase().replace(/\s+/g, ' ');
  let bekannt = '';
  for (const name of bekannteHaendler || []) {
    if (name.length >= 3 && text.includes(name.toLowerCase()) && name.length > bekannt.length) {
      bekannt = name;
    }
  }
  if (bekannt) return bekannt;

  // 2. Kandidaten aus den obersten 8 Zeilen
  const kandidaten = zeilen.slice(0, 8).map(nameSaeubern).filter(siehtWieNameAus);
  if (kandidaten.length === 0) return '';

  // Zeile mit Markennamen oder Geschäftsart bevorzugen (nicht "Tisch" oder "Bedienung").
  for (const zeile of kandidaten) {
    if (hatMarke(zeile)) return zeile;
  }
  return kandidaten[0];
}

// Wörter, die fast nur im Namen eines Geschäfts vorkommen.
const MARKEN = ['hotel', 'restaurant', 'ristorante', 'trattoria', 'pizzeria', 'gasthaus', 'gasthof',
  'gaststätte', 'wirtshaus', 'brauhaus', 'bistro', 'café', 'cafe', 'aral', 'shell', 'esso', 'jet',
  'avia', 'agip', 'eni', 'tankstelle', 'sixt', 'europcar', 'avis', 'hertz', 'enterprise', 'buchbinder',
  'taxi', 'bahn', 'flixbus', 'apcoa', 'contipark', 'q-park', 'parkhaus'];

function hatMarke(zeile) {
  const klein = ' ' + zeile.toLowerCase() + ' ';
  return MARKEN.some(function (marke) {
    return new RegExp('[^a-zäöüß]' + marke.replace('-', '\\-') + '[^a-zäöüß]').test(klein);
  });
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


// Mahlzeit aus der ersten Uhrzeit auf dem Beleg raten, z. B. "20:41" -> Abendessen.
// Vor 11 Uhr Frühstück, bis 16 Uhr Mittag, danach Abend. Keine Uhrzeit: ''.
function mahlzeitFinden(text) {
  // (?<!\d) heißt: davor steht keine Ziffer. So wird "120:30" nicht als 20:30 gelesen.
  const treffer = text.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (!treffer) return '';
  const stunde = Number(treffer[1]);
  if (stunde < 11) return 'fruehstueck';
  if (stunde < 16) return 'mittag';
  return 'abend';
}


// Alles zusammen. Was nicht gefunden wird, ist null oder ''.
// bekannteHaendler: Namen von früheren Belegen, z. B. ['Hotel Adler', 'Aral'] (darf fehlen).
function werteAuslesen(text, bekannteHaendler) {
  const zeilen = text.split('\n').filter(function (z) { return z.trim() !== ''; });
  return {
    betrag: betragFinden(zeilen),
    datum: datumFinden(ziffernReparieren(text)),
    haendler: haendlerFinden(zeilen, bekannteHaendler),
    kategorie: kategorieFinden(text),
    mahlzeit: mahlzeitFinden(text)
  };
}
