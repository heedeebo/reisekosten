// belegzeile.js: Baut die Zeile für einen Beleg in einer Liste.
// Gebraucht auf der Reise-Seite und auf der Startseite (Belege ohne Reise).
//
//   No. 7  Hotel Adler                    212,00 €
//   Hotel, 10.08.2026
//   (bei Restaurantbelegen auch die Mahlzeit, z. B. "Dinner")
//
// Braucht: format.js, kategorien.js

function belegZeileBauen(beleg) {
  const eintrag = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'listen-link';
  link.href = 'beleg.html?id=' + beleg.id;

  // Obere Zeile: Nummer und Händler links, Betrag rechts
  const kopf = document.createElement('div');
  kopf.className = 'tag-kopf';
  const name = document.createElement('span');
  name.className = 'titel';
  name.textContent = 'No. ' + beleg.nummer + '  ' + (beleg.haendler || kategorieText(beleg.kategorie));
  const betrag = document.createElement('span');
  betrag.className = 'titel';
  betrag.textContent = euro(beleg.betrag);
  kopf.appendChild(name);
  kopf.appendChild(betrag);

  // Darunter grau: Kategorie, Datum und bei Restaurantbelegen die Mahlzeit
  const info = document.createElement('span');
  info.className = 'info';
  let text = kategorieText(beleg.kategorie) + ', ' + datum(beleg.datum);
  const MAHLZEIT_NAMEN = { fruehstueck: 'Breakfast', mittag: 'Lunch', abend: 'Dinner' };
  if (beleg.kategorie === 'bewirtung' && beleg.mahlzeit) {
    text = text + ', ' + MAHLZEIT_NAMEN[beleg.mahlzeit];
  }
  info.textContent = text;

  link.appendChild(kopf);
  link.appendChild(info);
  eintrag.appendChild(link);
  return eintrag;
}
