// kategorien.js: Die Beleg-Kategorien an einer Stelle.
// schluessel  = Name im Code (bleibt immer gleich)
// text        = was in der App steht
// block       = in welchen Block der Abrechnung der Beleg später kommt
// stichwoerter = Wörter, an denen die App die Kategorie auf dem Beleg erkennt.
//                Klein schreiben. Fehlt dir ein Händler, einfach hier ergänzen.

const KATEGORIEN = [
  {
    schluessel: 'bewirtung', text: 'Business meal', block: 'bewirtung',
    stichwoerter: ['restaurant', 'ristorante', 'trattoria', 'pizzeria', 'gaststätte', 'gasthaus',
      'gasthof', 'wirtshaus', 'brauhaus', 'bistro', 'café', 'cafe', 'steakhouse', 'sushi',
      'bewirtung', 'speisen', 'getränke', 'tisch', 'bedienung', 'kellner', 'trinkgeld']
  },
  {
    // Kundenbewirtung (Bewirtung von Geschäftsfreunden): Getränke, Snacks, Kaffee für Kunden.
    // Kommt in den Block Bewirtung, kürzt aber deine Verpflegungspauschale nicht
    // (keine Frage nach der Mahlzeit). Keine Stichwörter: Auf dem Bon sieht das aus wie
    // ein Restaurant- oder Supermarktbeleg, deshalb wählst du es selbst aus.
    schluessel: 'kundenbewirtung', text: 'Client entertainment', block: 'bewirtung',
    stichwoerter: []
  },
  {
    schluessel: 'hotel', text: 'Hotel', block: 'hotel',
    stichwoerter: ['hotel', 'übernachtung', 'uebernachtung', 'logis', 'zimmer', 'motel',
      'pension', 'hostel', 'apartment', 'room', 'city tax', 'kurtaxe']
  },
  {
    schluessel: 'tanken', text: 'Fuel', block: 'fahrt',
    stichwoerter: ['aral', 'shell', 'esso', 'jet', 'avia', 'agip', 'eni', 'tankstelle',
      'diesel', 'super e10', 'super e5', 'benzin', 'kraftstoff', 'zapfsäule', 'ladestrom']
  },
  {
    schluessel: 'taxibahn', text: 'Taxi & train', block: 'fahrt',
    stichwoerter: ['taxi', 'deutsche bahn', 'db fernverkehr', 'db vertrieb', 'bahn', 'fahrkarte',
      'fahrschein', 'ice', 'flixbus', 'flixtrain', 'uber', 'bolt', 'freenow', 'mvv', 'bvg', 'hvv']
  },
  {
    schluessel: 'mietwagen', text: 'Rental car', block: 'fahrt',
    stichwoerter: ['sixt', 'europcar', 'avis', 'hertz', 'enterprise', 'buchbinder', 'mietwagen',
      'autovermietung', 'rental']
  },
  {
    schluessel: 'parken', text: 'Parking', block: 'fahrt',
    stichwoerter: ['parkhaus', 'parken', 'parkticket', 'parkschein', 'parking', 'parkgebühr',
      'apcoa', 'contipark', 'q-park', 'tiefgarage']
  },
  {
    // Bürobedarf: Papier, Stifte, Druckerpatronen und Ähnliches. Kommt zu den Extrakosten.
    schluessel: 'buero', text: 'Office supplies', block: 'extra',
    stichwoerter: ['bürobedarf', 'buerobedarf', 'schreibwaren', 'büromaterial', 'mcpaper', 'staples',
      'kopierpapier', 'druckerpapier', 'toner', 'druckerpatrone', 'tinte', 'ordner', 'kugelschreiber']
  },
  {
    // Geschenke an Geschäftsfreunde: Blumen, Wein, Präsentkorb für Kunden. Kommt zu den Extrakosten.
    // Steuerlich bis 50 € pro Empfänger und Jahr. Den Empfänger am besten auf den Bon schreiben.
    schluessel: 'geschenke', text: 'Client gifts', block: 'extra',
    stichwoerter: ['geschenk', 'geschenke', 'präsent', 'präsentkorb', 'geschenkkorb', 'geschenkverpackung',
      'florist', 'blumen', 'blumenstrauß', 'fleurop']
  },
  {
    schluessel: 'sonstiges', text: 'Other', block: 'extra',
    stichwoerter: []
  }
];


// Aus dem Schlüssel den Text holen: 'tanken' -> 'Fuel'
function kategorieText(schluessel) {
  // find sucht in der Liste den ersten Eintrag, auf den die Bedingung passt.
  const kategorie = KATEGORIEN.find(function (k) { return k.schluessel === schluessel; });
  return kategorie ? kategorie.text : schluessel;
}
