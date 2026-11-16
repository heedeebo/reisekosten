// kategorien.js: Die Beleg-Kategorien an einer Stelle.
// schluessel = Name im Code (bleibt immer gleich), text = was in der App steht.
// "block" sagt, in welchen Block der Abrechnung der Beleg später kommt.

const KATEGORIEN = [
  { schluessel: 'bewirtung', text: 'Business meal', block: 'bewirtung' },
  { schluessel: 'hotel',     text: 'Hotel',         block: 'hotel' },
  { schluessel: 'tanken',    text: 'Fuel',          block: 'fahrt' },
  { schluessel: 'taxibahn',  text: 'Taxi & train',  block: 'fahrt' },
  { schluessel: 'mietwagen', text: 'Rental car',    block: 'fahrt' },
  { schluessel: 'parken',    text: 'Parking',       block: 'fahrt' },
  { schluessel: 'sonstiges', text: 'Other',         block: 'extra' }
];


// Aus dem Schlüssel den Text holen: 'tanken' -> 'Fuel'
function kategorieText(schluessel) {
  // find sucht in der Liste den ersten Eintrag, auf den die Bedingung passt.
  const kategorie = KATEGORIEN.find(function (k) { return k.schluessel === schluessel; });
  return kategorie ? kategorie.text : schluessel;
}
