// format.js: Beträge im deutschen Format anzeigen und einlesen.
// Festgelegt: Die App ist englisch, Zahlen sehen aber deutsch aus (1.234,56 €).

// Intl.NumberFormat ist im Browser eingebaut und kennt die deutschen Regeln.
const euroFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const zahlFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


// 1234.5  ->  "1.234,50 €"
function euro(betrag) {
  return euroFormat.format(betrag);
}


// 1234.5  ->  "1.234,50"   (für Eingabefelder, ohne €-Zeichen)
function zahlAnzeigen(betrag) {
  return zahlFormat.format(betrag);
}


// Datum und Uhrzeit speichern wir so, wie das Eingabefeld sie liefert:
// "2026-08-10T07:00"  (Jahr-Monat-Tag, dann T, dann Stunde:Minute)
// Für die Anzeige drehen wir das um.

// "2026-08-10T07:00"  ->  "10.08.2026"
function datum(text) {
  const teile = text.slice(0, 10).split('-');   // ["2026", "08", "10"]
  return teile[2] + '.' + teile[1] + '.' + teile[0];
}

// "2026-08-10T07:00"  ->  "10.08.2026, 07:00"
function datumZeit(text) {
  return datum(text) + ', ' + text.slice(11, 16);
}


// Stunden mit Komma, höchstens zwei Stellen: 9.5 -> "9,5"   10 -> "10"
const stundenFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
function stunden(zahl) {
  return stundenFormat.format(zahl);
}


// Text aus einem Eingabefeld in eine Zahl umwandeln.
// "1.234,56" -> 1234.56     "200" -> 200     "12,5 €" -> 12.5
// Auch "12.50" klappt (falls man aus Versehen einen Punkt tippt) -> 12.5
// Leeres Feld -> 0.  Unsinn wie "abc" -> NaN ("keine Zahl").
function zahlLesen(text) {
  let s = String(text).replace(/\s/g, '').replace('€', '');
  if (s === '') return 0;

  if (s.includes(',')) {
    // Deutsches Format: Punkte sind Tausender, das Komma ist das Dezimalzeichen.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (!/^\d+\.\d{1,2}$/.test(s)) {
    // Kein Komma und kein "12.50"-Muster: Punkte sind Tausender ("1.234").
    s = s.replace(/\./g, '');
  }

  const zahl = Number(s);
  return Number.isFinite(zahl) ? zahl : NaN;
}
