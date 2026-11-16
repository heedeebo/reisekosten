// abrechnung-daten.js: Stellt alle Zahlen für eine Abrechnung zusammen.
//
// Diese Datei rechnet nur, sie zeigt nichts an. Die Bildschirm-Abrechnung,
// die Excel-Datei und das PDF nehmen alle dieses Ergebnis. So stimmen die
// Zahlen überall überein, und man kann die Rechnung testen (tests.html).
//
// Braucht: tage.js, pauschale.js, laender.js, kategorien.js, format.js

const MAHLZEIT_TEXTE = { fruehstueck: 'Breakfast', mittag: 'Lunch', abend: 'Dinner' };


// Reiseziel mit Land, wenn die Reise ins Ausland ging: "Vienna (Österreich)"
function zielMitLand(reise) {
  if (!reise.land || reise.land === 'Deutschland') return reise.ziel;
  return reise.ziel + ' (' + reise.land + ')';
}


// Liegt die Reise (auch nur teilweise) im Zeitraum?
// von und bis sind Daten wie "2026-08-01" und "2026-09-30".
function reiseImZeitraum(reise, von, bis) {
  return reise.start.slice(0, 10) <= bis && reise.ende.slice(0, 10) >= von;
}


// Summe einer Liste von Zeilen, die alle ein Feld "betrag" haben.
function summeVon(zeilen) {
  let summe = 0;
  for (const zeile of zeilen) summe = summe + zeile.betrag;
  return aufCent(summe);
}


// Sortiert Belege nach Datum, bei gleichem Datum nach Nummer.
function nachDatum(a, b) {
  return a.datum.localeCompare(b.datum) || a.nummer - b.nummer;
}


// Das Herzstück. Ergebnis ist ein Objekt mit allen Blöcken der Abrechnung.
//   reisen, belege   alles aus der Datenbank
//   einstellungen    { name, wohnort, vorschuss }
//   von, bis         Zeitraum, z. B. "2026-08-01" bis "2026-09-30"
//   extraZeilen      freie Zeilen: [{ text: 'Visa fee', betrag: 60 }]
//   vorschuss        Betrag, der schon ausgezahlt wurde
//   heute            Datum für "Ort, Datum", z. B. "2026-11-16"
//   ohneReiseIds     Belege ohne Reise, die trotzdem mit in die Abrechnung sollen (ihre id),
//                    z. B. Tankbelege. Sie zählen nur, wenn ihr Datum im Zeitraum liegt.
function abrechnungErstellen(reisen, belege, einstellungen, von, bis, extraZeilen, vorschuss, heute, ohneReiseIds) {
  ohneReiseIds = ohneReiseIds || [];
  // Reisen im Zeitraum, älteste zuerst
  const meineReisen = reisen
    .filter(function (r) { return reiseImZeitraum(r, von, bis); })
    .sort(function (a, b) { return a.start.localeCompare(b.start); });

  // Alle Belege dieser Reisen
  const reiseIds = meineReisen.map(function (r) { return r.id; });
  const meineBelege = belege
    .filter(function (b) {
      if (reiseIds.includes(b.reiseId)) return true;
      // Beleg ohne Reise: nur wenn ausgewählt und im Zeitraum
      return b.reiseId === null && ohneReiseIds.includes(b.id) && b.datum >= von && b.datum <= bis;
    })
    .sort(nachDatum);

  // Block Bewirtung (Restaurantbelege). Die Genehmigung gilt für die ganze Abrechnung.
  const bewirtung = [];
  // Blöcke Hotel, Fahrtkosten, Extrakosten
  const hotel = [];
  const fahrt = [];
  const extra = [];

  for (const beleg of meineBelege) {
    const kategorie = KATEGORIEN.find(function (k) { return k.schluessel === beleg.kategorie; });
    const zeile = {
      nummer: beleg.nummer,
      datum: beleg.datum,
      text: beleg.haendler || kategorieText(beleg.kategorie),
      kategorie: kategorieText(beleg.kategorie),
      betrag: beleg.betrag
    };
    if (beleg.kategorie === 'bewirtung') {
      zeile.mahlzeit = MAHLZEIT_TEXTE[beleg.mahlzeit] || '';
      bewirtung.push(zeile);
    } else if (kategorie && kategorie.block === 'bewirtung') {
      // Kundenbewirtung (Getränke, Snacks für Kunden): gleicher Block, ohne Mahlzeit
      zeile.mahlzeit = kategorie.text;
      bewirtung.push(zeile);
    } else if (kategorie && kategorie.block === 'hotel') {
      hotel.push(zeile);
    } else if (kategorie && kategorie.block === 'fahrt') {
      fahrt.push(zeile);
    } else {
      // Extrakosten: Bei Bürobedarf und Geschenken die Art dazuschreiben, z. B. "Fleurop (Client gifts)"
      if (kategorie && kategorie.schluessel !== 'sonstiges' && zeile.text !== kategorie.text) {
        zeile.text = zeile.text + ' (' + kategorie.text + ')';
      }
      extra.push(zeile);
    }
  }

  // Freie Extra-Zeilen (ohne Beleg) hinten anhängen. Leere Zeilen weglassen.
  for (const frei of extraZeilen) {
    if (frei.text.trim() === '' && !frei.betrag) continue;
    extra.push({ nummer: null, datum: '', text: frei.text.trim(), kategorie: '', betrag: frei.betrag || 0 });
  }

  // Block Verpflegungspauschale: eine Zeile pro Tag
  const pauschale = [];
  for (const reise of meineReisen) {
    for (const tag of reiseTage(reise.start, reise.ende)) {
      const gestellt = (reise.mahlzeiten && reise.mahlzeiten[tag.datum]) || {};
      const ergebnis = tagesPauschale(tag, gestellt, satzFuer(reise.land));   // Land aus laender.js
      // Namen der gestellten Mahlzeiten, z. B. "Breakfast, Dinner"
      const mahlzeiten = Object.keys(MAHLZEIT_TEXTE)
        .filter(function (m) { return gestellt[m]; })
        .map(function (m) { return MAHLZEIT_TEXTE[m]; })
        .join(', ');
      pauschale.push({
        datum: tag.datum,
        ziel: zielMitLand(reise),
        art: TAG_ARTEN[tag.art] + (tag.art === 'eintaegig' ? ' (' + stunden(tag.stunden) + ' h)' : ''),
        gestellt: mahlzeiten,
        grund: ergebnis.grund,
        kuerzung: ergebnis.kuerzung,
        betrag: ergebnis.betrag
      });
    }
  }

  const ergebnis = {
    name: einstellungen.name || '',
    unterschrift: einstellungen.unterschrift || null,   // deine Unterschrift als PNG-Text
    chefName: einstellungen.chefName || '',          // wer genehmigt
    ort: einstellungen.wohnort || '',
    heute: heute,
    von: von,
    bis: bis,
    reisen: meineReisen.map(function (r) {
      return { ziel: zielMitLand(r), grund: r.grund, start: r.start, ende: r.ende };
    }),
    bewirtung: { zeilen: bewirtung, summe: summeVon(bewirtung) },
    pauschale: { zeilen: pauschale, summe: summeVon(pauschale) },
    hotel: { zeilen: hotel, summe: summeVon(hotel) },
    fahrt: { zeilen: fahrt, summe: summeVon(fahrt) },
    extra: { zeilen: extra, summe: summeVon(extra) },
    vorschuss: aufCent(vorschuss || 0)
  };

  ergebnis.gesamt = aufCent(ergebnis.bewirtung.summe + ergebnis.pauschale.summe +
    ergebnis.hotel.summe + ergebnis.fahrt.summe + ergebnis.extra.summe);
  ergebnis.auszahlung = aufCent(ergebnis.gesamt - ergebnis.vorschuss);

  // Belege für das PDF: alle, die in der Abrechnung stehen, nach Nummer.
  const nummern = [].concat(bewirtung, hotel, fahrt, extra)
    .map(function (z) { return z.nummer; })
    .filter(function (n) { return n !== null; });
  ergebnis.belegNummern = nummern.sort(function (a, b) { return a - b; });

  return ergebnis;
}
