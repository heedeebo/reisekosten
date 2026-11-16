// pauschale.js: Verpflegungspauschale pro Tag (Deutschland).
//
// ======================================================================
//  EINSTELLUNGEN: Wenn sich die gesetzlichen Beträge ändern,
//  nur hier die Zahlen anpassen. Der Rest rechnet automatisch mit.
// ======================================================================
const PAUSCHALE = {
  vollerTag: 28.00,        // 24 Stunden unterwegs
  teilTag: 14.00,          // Anreisetag, Abreisetag, Tagesreise über 8 Stunden
  mindestStunden: 8,       // Tagesreise: MEHR als so viele Stunden nötig

  // Kürzung, wenn eine Mahlzeit gestellt wurde.
  // Immer vom vollen Tagessatz 28 € gerechnet: 20 % und 40 %.
  kuerzung: {
    fruehstueck: 5.60,
    mittag: 11.20,
    abend: 11.20
  }
};
// ======================================================================


// Rundet auf ganze Cent. Nötig, weil Computer mit Kommazahlen
// kleine Fehler machen: 14 - 11.2 ergibt sonst 2.8000000000000007.
function aufCent(betrag) {
  return Math.round(betrag * 100) / 100;
}


// Grundbetrag eines Tages, noch ohne Kürzung.
// tag kommt aus reiseTage() in tage.js, z. B. { art: 'anreise', ... }
function grundbetrag(tag) {
  if (tag.art === 'voll') return PAUSCHALE.vollerTag;
  if (tag.art === 'anreise' || tag.art === 'abreise') return PAUSCHALE.teilTag;
  if (tag.art === 'eintaegig' && tag.stunden > PAUSCHALE.mindestStunden) return PAUSCHALE.teilTag;
  return 0;   // Tagesreise mit 8 Stunden oder weniger
}


// Pauschale für einen Tag.
// gestellt sagt, welche Mahlzeiten gestellt wurden, z. B.
//   { fruehstueck: false, mittag: false, abend: true }
// Fehlt gestellt ganz, wurde nichts gestellt.
//
// Ergebnis, z. B. für einen Anreisetag mit gestelltem Abendessen:
//   { grund: 14, kuerzung: 11.2, betrag: 2.8 }
function tagesPauschale(tag, gestellt) {
  gestellt = gestellt || {};
  const grund = grundbetrag(tag);

  let kuerzung = 0;
  if (gestellt.fruehstueck) kuerzung = kuerzung + PAUSCHALE.kuerzung.fruehstueck;
  if (gestellt.mittag) kuerzung = kuerzung + PAUSCHALE.kuerzung.mittag;
  if (gestellt.abend) kuerzung = kuerzung + PAUSCHALE.kuerzung.abend;

  // Nie unter 0 €. Math.max nimmt die größere von zwei Zahlen.
  const betrag = Math.max(0, grund - kuerzung);

  // Gibt es gar keine Pauschale (Grund 0), wird auch nichts gekürzt.
  return {
    grund: grund,
    kuerzung: grund === 0 ? 0 : aufCent(Math.min(kuerzung, grund)),
    betrag: aufCent(betrag)
  };
}
