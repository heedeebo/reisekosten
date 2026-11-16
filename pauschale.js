// pauschale.js: Verpflegungspauschale pro Tag, für Deutschland und das Ausland.
// Die Sätze fürs Ausland stehen in laender.js.
//
// ======================================================================
//  EINSTELLUNGEN: Wenn sich die gesetzlichen Beträge ändern,
//  nur hier die Zahlen anpassen. Der Rest rechnet automatisch mit.
// ======================================================================
const PAUSCHALE = {
  vollerTag: 28.00,        // Deutschland: 24 Stunden unterwegs
  teilTag: 14.00,          // Deutschland: Anreisetag, Abreisetag, Tagesreise über 8 Stunden
  mindestStunden: 8,       // Tagesreise: MEHR als so viele Stunden nötig

  // Kürzung, wenn eine Mahlzeit gestellt wurde, als Anteil vom VOLLEN Tagessatz
  // des Landes. In Deutschland: 20 % von 28 € = 5,60 €, 40 % von 28 € = 11,20 €.
  kuerzungAnteil: {
    fruehstueck: 0.20,
    mittag: 0.40,
    abend: 0.40
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
// saetze = { voll, teil } des Landes (siehe laender.js)
function grundbetrag(tag, saetze) {
  if (tag.art === 'voll') return saetze.voll;
  if (tag.art === 'anreise' || tag.art === 'abreise') return saetze.teil;
  if (tag.art === 'eintaegig' && tag.stunden > PAUSCHALE.mindestStunden) return saetze.teil;
  return 0;   // Tagesreise mit 8 Stunden oder weniger
}


// Pauschale für einen Tag.
// gestellt sagt, welche Mahlzeiten gestellt wurden, z. B.
//   { fruehstueck: false, mittag: false, abend: true }
// Fehlt gestellt ganz, wurde nichts gestellt.
// saetze = { voll, teil } des Landes. Fehlt es, gilt Deutschland (28 € / 14 €).
//
// Ergebnis, z. B. für einen Anreisetag in Deutschland mit gestelltem Abendessen:
//   { grund: 14, kuerzung: 11.2, betrag: 2.8 }
function tagesPauschale(tag, gestellt, saetze) {
  gestellt = gestellt || {};
  saetze = saetze || { voll: PAUSCHALE.vollerTag, teil: PAUSCHALE.teilTag };
  const grund = grundbetrag(tag, saetze);

  // Kürzung immer vom vollen Satz des Landes, auch am An- und Abreisetag.
  let kuerzung = 0;
  for (const mahlzeit of ['fruehstueck', 'mittag', 'abend']) {
    if (gestellt[mahlzeit]) kuerzung = kuerzung + saetze.voll * PAUSCHALE.kuerzungAnteil[mahlzeit];
  }
  kuerzung = aufCent(kuerzung);

  // Nie unter 0 €. Math.max nimmt die größere von zwei Zahlen.
  const betrag = Math.max(0, grund - kuerzung);

  // Gibt es gar keine Pauschale (Grund 0), wird auch nichts gekürzt.
  return {
    grund: grund,
    kuerzung: grund === 0 ? 0 : aufCent(Math.min(kuerzung, grund)),
    betrag: aufCent(betrag)
  };
}
