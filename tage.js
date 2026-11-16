// tage.js: Macht aus Start und Ende einer Reise die einzelnen Tage.
//
// Regeln (gesetzlich, Deutschland):
//   Reise über mehrere Kalendertage:
//     erster Tag  = Anreisetag  (art 'anreise')
//     letzter Tag = Abreisetag  (art 'abreise')
//     Tage dazwischen = volle Tage (art 'voll')
//   Reise an einem einzigen Tag:
//     eintägige Reise (art 'eintaegig'), hier zählen die Stunden.
//
// Ergebnis ist eine Liste, ein Eintrag pro Tag, zum Beispiel:
//   [ { datum: '2026-08-10', art: 'anreise',  stunden: null },
//     { datum: '2026-08-11', art: 'voll',     stunden: null },
//     { datum: '2026-08-12', art: 'abreise',  stunden: null } ]


// Hilfsfunktion: "2026-08-10" -> Zahl der Tage seit 1970.
// Damit kann man einfach "plus 1 Tag" rechnen. Wir nehmen UTC (Weltzeit),
// damit Sommer- und Winterzeit nichts durcheinanderbringen.
function tagNummer(datumText) {
  const teile = datumText.split('-');
  const millisekunden = Date.UTC(Number(teile[0]), Number(teile[1]) - 1, Number(teile[2]));
  return Math.round(millisekunden / 86400000);   // 86.400.000 ms = 1 Tag
}

// Und zurück: Zahl der Tage seit 1970 -> "2026-08-10".
function tagText(nummer) {
  // toISOString liefert "2026-08-10T00:00:00.000Z", wir brauchen nur die ersten 10 Zeichen.
  return new Date(nummer * 86400000).toISOString().slice(0, 10);
}

// "07:30" -> 7.5 Stunden
function uhrzeitInStunden(text) {
  const teile = text.split(':');
  return Number(teile[0]) + Number(teile[1]) / 60;
}


function reiseTage(start, ende) {
  const startDatum = start.slice(0, 10);   // "2026-08-10"
  const endeDatum = ende.slice(0, 10);

  // Fall 1: alles an einem Tag.
  if (startDatum === endeDatum) {
    const stunden = uhrzeitInStunden(ende.slice(11, 16)) - uhrzeitInStunden(start.slice(11, 16));
    return [{ datum: startDatum, art: 'eintaegig', stunden: stunden }];
  }

  // Fall 2: mehrere Tage.
  const tage = [];
  const erster = tagNummer(startDatum);
  const letzter = tagNummer(endeDatum);

  for (let nummer = erster; nummer <= letzter; nummer++) {
    let art = 'voll';
    if (nummer === erster) art = 'anreise';
    if (nummer === letzter) art = 'abreise';
    tage.push({ datum: tagText(nummer), art: art, stunden: null });
  }
  return tage;
}


// Texte für die Anzeige in der App.
const TAG_ARTEN = {
  anreise: 'Arrival day',
  voll: 'Full day',
  abreise: 'Departure day',
  eintaegig: 'Day trip'
};

// "2026-08-10" -> "Mon"
function wochentag(datumText) {
  const namen = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Der 1.1.1970 (Tag 0) war ein Donnerstag, also Nummer 4 in der Liste.
  return namen[(tagNummer(datumText) + 4) % 7];
}
