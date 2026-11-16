// reise.js: Zeigt eine Reise mit ihren Tagen.

const titel = document.getElementById('titel');
const untertitel = document.getElementById('untertitel');
const linkBearbeiten = document.getElementById('bearbeiten');
const tageListe = document.getElementById('tage');

// Die Nummer der Reise steht in der Adresse, z. B. reise.html?id=3
const reiseId = Number(new URLSearchParams(location.search).get('id'));


// Baut eine Zeile für die Liste: links ein Haupttext, darunter grau ein Nebentext.
function zeileBauen(haupttext, nebentext) {
  const eintrag = document.createElement('li');
  eintrag.className = 'zeile';

  const oben = document.createElement('span');
  oben.className = 'titel';
  oben.textContent = haupttext;

  const unten = document.createElement('span');
  unten.className = 'info';
  unten.textContent = nebentext;

  eintrag.appendChild(oben);
  eintrag.appendChild(unten);
  return eintrag;
}


async function anzeigen() {
  const reise = await dbLesen('reisen', reiseId);
  if (!reise) {
    titel.textContent = 'Trip not found';
    linkBearbeiten.hidden = true;
    return;
  }

  // Kopf der Seite
  document.title = reise.ziel;
  titel.textContent = reise.ziel;
  let text = datumZeit(reise.start) + ' to ' + datumZeit(reise.ende);
  if (reise.grund) {
    text = reise.grund + '\n' + text;   // \n ist ein Zeilenumbruch
  }
  untertitel.textContent = text;
  linkBearbeiten.href = 'reise-bearbeiten.html?id=' + reise.id;

  // Die Tage ausrechnen (tage.js) und einen Eintrag pro Tag anzeigen.
  const tage = reiseTage(reise.start, reise.ende);
  for (const tag of tage) {
    // z. B. "Mon, 10.08.2026"
    const haupttext = wochentag(tag.datum) + ', ' + datum(tag.datum);
    // z. B. "Arrival day" oder "Day trip, 9,5 hours"
    let nebentext = TAG_ARTEN[tag.art];
    if (tag.art === 'eintaegig') {
      nebentext = nebentext + ', ' + stunden(tag.stunden) + ' hours';
    }
    tageListe.appendChild(zeileBauen(haupttext, nebentext));
  }
}


anzeigen();
