// tests.js: Die Tests. Jeder Test vergleicht, was herauskommt (ist),
// mit dem, was herauskommen soll (soll).

const liste = document.getElementById('tests');
let bestanden = 0;
let gesamt = 0;


// Ein Test: Name, Ergebnis der Rechnung, erwartetes Ergebnis.
function test(name, ist, soll) {
  gesamt = gesamt + 1;
  // JSON.stringify macht aus Listen und Objekten Text, damit man sie vergleichen kann.
  const stimmt = JSON.stringify(ist) === JSON.stringify(soll);
  if (stimmt) bestanden = bestanden + 1;

  const zeile = document.createElement('li');
  zeile.className = 'zeile ' + (stimmt ? 'ok' : 'fail');
  zeile.textContent = (stimmt ? '✓ ' : '✗ ') + name +
    (stimmt ? '' : '   (is ' + JSON.stringify(ist) + ', should be ' + JSON.stringify(soll) + ')');
  liste.appendChild(zeile);
}


// Kurze Helfer, damit die Tests gut lesbar bleiben.
function anreise()  { return { art: 'anreise',  stunden: null }; }
function voll()     { return { art: 'voll',     stunden: null }; }
function abreise()  { return { art: 'abreise',  stunden: null }; }
function tagesreise(stunden) { return { art: 'eintaegig', stunden: stunden }; }

// Nur der Betrag in Euro
function betrag(tag, gestellt) {
  return tagesPauschale(tag, gestellt).betrag;
}


// ---------- Tage zählen (tage.js) ----------

test('3-day trip: arrival, full day, departure',
  reiseTage('2026-08-10T07:00', '2026-08-12T18:00').map(function (t) { return t.art; }),
  ['anreise', 'voll', 'abreise']);

test('Day trip 07:00 to 16:30 = 9,5 hours',
  reiseTage('2026-08-10T07:00', '2026-08-10T16:30')[0].stunden,
  9.5);

test('Trip over end of February counts all days',
  reiseTage('2026-02-27T08:00', '2026-03-02T12:00').length,
  4);


// ---------- Pauschale ohne Mahlzeiten ----------

test('Arrival day = 14 €',            betrag(anreise()), 14);
test('Full day = 28 €',               betrag(voll()), 28);
test('Departure day = 14 €',          betrag(abreise()), 14);
test('Day trip 7,5 hours = 0 €',      betrag(tagesreise(7.5)), 0);
test('Day trip exactly 8 hours = 0 €', betrag(tagesreise(8)), 0);
test('Day trip 9 hours = 14 €',       betrag(tagesreise(9)), 14);


// ---------- Pauschale mit gestellten Mahlzeiten ----------

test('Arrival day with dinner = 2,80 € (example from the plan)',
  betrag(anreise(), { abend: true }), 2.8);

test('Full day with breakfast = 22,40 €',
  betrag(voll(), { fruehstueck: true }), 22.4);

test('Full day with lunch = 16,80 €',
  betrag(voll(), { mittag: true }), 16.8);

test('Full day with all three meals = 0 €',
  betrag(voll(), { fruehstueck: true, mittag: true, abend: true }), 0);

test('Arrival day with all three meals = 0 €, never below 0',
  betrag(anreise(), { fruehstueck: true, mittag: true, abend: true }), 0);

test('Departure day with breakfast = 8,40 €',
  betrag(abreise(), { fruehstueck: true }), 8.4);

test('Day trip 10 hours with lunch = 2,80 €',
  betrag(tagesreise(10), { mittag: true }), 2.8);

test('Day trip 6 hours with lunch = 0 €, nothing to reduce',
  tagesPauschale(tagesreise(6), { mittag: true }),
  { grund: 0, kuerzung: 0, betrag: 0 });


// ---------- Werte aus dem Belegtext lesen (ocr.js) ----------
// So ungefähr sieht Text aus, den die Texterkennung von einem Beleg liefert.

const restaurant = [
  'Augustiner am Dom',
  'Frauenplatz 8, 80331 München',
  'Tisch 12   Bedienung: Anna',
  '2x Schweinebraten     29,80',
  '2x Helles 0,5l         9,80',
  'Zwischensumme         39,60',
  'Summe EUR             39,60',
  'MwSt 19% Netto 33,28  MwSt 6,32',
  'Datum: 14.08.26  20:41'
].join('\n');

test('Restaurant: amount from the "Summe" line', werteAuslesen(restaurant).betrag, 39.6);
test('Restaurant: date 14.08.26', werteAuslesen(restaurant).datum, '2026-08-14');
test('Restaurant: merchant is the first line', werteAuslesen(restaurant).haendler, 'Augustiner am Dom');
test('Restaurant: category business meal', werteAuslesen(restaurant).kategorie, 'bewirtung');

const tankstelle = [
  'ARAL Tankstelle',
  'Hauptstr. 1, 20095 Hamburg',
  'Super E10  42,15 l  x  1,799',
  'Gesamtbetrag     75,83 EUR',
  'gegeben bar     100,00',
  'Rückgeld         24,17',
  '03.09.2026'
].join('\n');

test('Fuel: amount 75,83 (not the 100,00 given in cash)', werteAuslesen(tankstelle).betrag, 75.83);
test('Fuel: category fuel', werteAuslesen(tankstelle).kategorie, 'tanken');

const hotel = [
  'Hotel Adler',
  'Rechnung Nr. 2026-0815',
  'Übernachtung 10.08.2026 - 12.08.2026',
  '2 Nächte à 106,00       212,00',
  'Gesamt inkl. MwSt     1.212,00',
  'Bezahlt mit Karte'
].join('\n');

test('Hotel: "Gesamt inkl. MwSt" with thousands point', werteAuslesen(hotel).betrag, 1212);
test('Hotel: first date on the receipt', werteAuslesen(hotel).datum, '2026-08-10');
test('Hotel: category hotel', werteAuslesen(hotel).kategorie, 'hotel');

test('Nothing readable: no values', werteAuslesen('###\n...'),
  { betrag: null, datum: null, haendler: '', kategorie: '', mahlzeit: '' });

test('"Objekt" is not the fuel brand JET', kategorieFinden('Objekt 12'), '');


// ---------- Mahlzeit aus der Uhrzeit (ocr.js) ----------

test('Restaurant at 20:41 = dinner', werteAuslesen(restaurant).mahlzeit, 'abend');
test('Time 08:15 = breakfast', mahlzeitFinden('Kasse 2  08:15 Uhr'), 'fruehstueck');
test('Time 12:30 = lunch', mahlzeitFinden('16.11.2026 12:30'), 'mittag');
test('No time = no meal', mahlzeitFinden('Summe 12,50'), '');


// ---------- Genehmigung (kategorien.js) ----------

test('Business meal without approval does not count',
  belegGenehmigt({ kategorie: 'bewirtung', genehmigtVon: 'Max', genehmigtAm: '' }), false);
test('Business meal with name and date counts',
  belegGenehmigt({ kategorie: 'bewirtung', genehmigtVon: 'Max', genehmigtAm: '2026-08-20' }), true);
test('Hotel needs no approval', belegGenehmigt({ kategorie: 'hotel' }), true);


// ---------- Abrechnung (abrechnung-daten.js) ----------
// Zwei Reisen im August und September, eine im Oktober (gehört nicht dazu).

const testReisen = [
  { id: 1, ziel: 'Munich', grund: 'Fair', start: '2026-08-10T07:00', ende: '2026-08-12T18:00',
    mahlzeiten: { '2026-08-10': { abend: true } } },
  { id: 2, ziel: 'Berlin', grund: '', start: '2026-09-03T06:00', ende: '2026-09-03T20:00' },
  { id: 3, ziel: 'Cologne', grund: '', start: '2026-10-05T08:00', ende: '2026-10-05T19:00' }
];
const testBelege = [
  { nummer: 1, reiseId: 1, kategorie: 'hotel', betrag: 212, datum: '2026-08-10', haendler: 'Hotel Adler' },
  { nummer: 2, reiseId: 1, kategorie: 'bewirtung', betrag: 48.9, datum: '2026-08-10', haendler: 'Augustiner',
    genehmigtVon: 'Max Weber', genehmigtAm: '2026-08-20' },
  { nummer: 3, reiseId: 1, kategorie: 'bewirtung', betrag: 30, datum: '2026-08-11', haendler: 'Bistro' },
  { nummer: 4, reiseId: 2, kategorie: 'taxibahn', betrag: 25.5, datum: '2026-09-03', haendler: 'Taxi' },
  { nummer: 5, reiseId: 2, kategorie: 'parken', betrag: 12, datum: '2026-09-03', haendler: '' },
  { nummer: 6, reiseId: 1, kategorie: 'sonstiges', betrag: 9.99, datum: '2026-08-11', haendler: 'Charger' },
  { nummer: 7, reiseId: 3, kategorie: 'hotel', betrag: 99, datum: '2026-10-05', haendler: 'Hotel Dom' }
];
const testAbrechnung = abrechnungErstellen(testReisen, testBelege, { name: 'Chris', wohnort: 'Hamburg' },
  '2026-08-01', '2026-09-30', [{ text: 'Visa fee', betrag: 60 }, { text: '', betrag: 0 }], 200, '2026-11-16');

test('Report: only trips in the period (2 of 3)', testAbrechnung.reisen.length, 2);
test('Report: meal allowance 44,80 + 14,00 = 58,80', testAbrechnung.pauschale.summe, 58.8);
test('Report: one row per day (3 + 1)', testAbrechnung.pauschale.zeilen.length, 4);
test('Report: business meal only with approval = 48,90', testAbrechnung.bewirtung.summe, 48.9);
test('Report: unapproved receipt listed separately', testAbrechnung.nichtGenehmigt.map(function (z) { return z.nummer; }), [3]);
test('Report: hotel = 212,00', testAbrechnung.hotel.summe, 212);
test('Report: travel costs taxi + parking = 37,50', testAbrechnung.fahrt.summe, 37.5);
test('Report: extra costs other + free line = 69,99', testAbrechnung.extra.summe, 69.99);
test('Report: total 427,19', testAbrechnung.gesamt, 427.19);
test('Report: payout after 200,00 advance = 227,19', testAbrechnung.auszahlung, 227.19);
test('Report: receipt numbers for the PDF', testAbrechnung.belegNummern, [1, 2, 4, 5, 6]);


// ---------- Ergebnis oben anzeigen ----------
document.getElementById('ergebnis').textContent =
  bestanden + ' of ' + gesamt + ' tests passed' + (bestanden === gesamt ? ' ✓' : '');
