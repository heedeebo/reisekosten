// belegzeile.js: Baut die Zeile für einen Beleg in einer Liste.
// Gebraucht auf der Reise-Seite und auf der Startseite (Belege ohne Reise).
//
//   No. 7  Hotel Adler                    212,00 €
//   Hotel, 10.08.2026
//   (bei Restaurantbelegen: Genehmigung oder Warnung)
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

  // Darunter grau: Kategorie und Datum
  const info = document.createElement('span');
  info.className = 'info';
  info.textContent = kategorieText(beleg.kategorie) + ', ' + datum(beleg.datum);

  link.appendChild(kopf);
  link.appendChild(info);

  // Restaurantbelege: Genehmigung anzeigen, oder eine Warnung, wenn sie fehlt.
  if (beleg.kategorie === 'bewirtung') {
    const genehmigung = document.createElement('span');
    if (belegGenehmigt(beleg)) {
      genehmigung.className = 'info';
      genehmigung.textContent = 'Approved by ' + beleg.genehmigtVon + ', ' + datum(beleg.genehmigtAm);
    } else {
      genehmigung.className = 'warnung';
      genehmigung.textContent = 'Not approved, not included in the report';
    }
    link.appendChild(genehmigung);
  }

  eintrag.appendChild(link);
  return eintrag;
}
