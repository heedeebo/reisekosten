// reise.js: Zeigt eine Reise mit ihren Tagen und der Verpflegungspauschale.
// Pro Tag kann man antippen, welche Mahlzeiten gestellt wurden.

const titel = document.getElementById('titel');
const untertitel = document.getElementById('untertitel');
const linkBearbeiten = document.getElementById('bearbeiten');
const tageListe = document.getElementById('tage');
const summePauschale = document.getElementById('summe-pauschale');

// Die Nummer der Reise steht in der Adresse, z. B. reise.html?id=3
const reiseId = Number(new URLSearchParams(location.search).get('id'));

// Die geladene Reise. let statt const, weil sie erst nach dem Laden gefüllt wird.
let reise = null;

// Die drei Mahlzeiten: Name im Code und Text auf dem Knopf.
const MAHLZEITEN = [
  { schluessel: 'fruehstueck', text: 'Breakfast' },
  { schluessel: 'mittag', text: 'Lunch' },
  { schluessel: 'abend', text: 'Dinner' }
];


// So speichern wir die Mahlzeiten in der Reise:
//   reise.mahlzeiten = {
//     '2026-08-10': { fruehstueck: false, mittag: false, abend: true },
//     '2026-08-11': { fruehstueck: true }
//   }
// Diese Funktion holt die Mahlzeiten eines Tages, oder {} wenn noch nichts da ist.
function mahlzeitenVon(datumText) {
  if (reise.mahlzeiten && reise.mahlzeiten[datumText]) {
    return reise.mahlzeiten[datumText];
  }
  return {};
}


// Tippt man auf einen Mahlzeit-Knopf: an wird aus, aus wird an. Dann speichern.
async function mahlzeitUmschalten(datumText, mahlzeit) {
  if (!reise.mahlzeiten) reise.mahlzeiten = {};
  if (!reise.mahlzeiten[datumText]) reise.mahlzeiten[datumText] = {};

  // Das ! dreht um: true wird false, false (oder noch nichts) wird true.
  reise.mahlzeiten[datumText][mahlzeit] = !reise.mahlzeiten[datumText][mahlzeit];

  await dbSchreiben('reisen', reise);
  tageAnzeigen();   // alles neu zeichnen, damit Betrag und Summe stimmen
}


// Baut die Zeile für einen Tag:
//   Mon, 10.08.2026                     2,80 €
//   Arrival day, 14,00 € less 11,20 € for meals
//   [Breakfast] [Lunch] [Dinner]
function tagZeileBauen(tag, gestellt, ergebnis) {
  const eintrag = document.createElement('li');
  eintrag.className = 'zeile';

  // Obere Zeile: Datum links, Betrag rechts
  const kopf = document.createElement('div');
  kopf.className = 'tag-kopf';
  const datumText = document.createElement('span');
  datumText.className = 'titel';
  datumText.textContent = wochentag(tag.datum) + ', ' + datum(tag.datum);
  const betragText = document.createElement('span');
  betragText.className = 'titel';
  betragText.textContent = euro(ergebnis.betrag);
  kopf.appendChild(datumText);
  kopf.appendChild(betragText);

  // Darunter grau: Art des Tages und ggf. die Kürzung
  let info = TAG_ARTEN[tag.art];
  if (tag.art === 'eintaegig') {
    info = info + ', ' + stunden(tag.stunden) + ' hours';
  }
  if (ergebnis.kuerzung > 0) {
    info = info + ', ' + euro(ergebnis.grund) + ' less ' + euro(ergebnis.kuerzung) + ' for meals';
  }
  const infoText = document.createElement('span');
  infoText.className = 'info';
  infoText.textContent = info;

  // Die drei Knöpfe
  const knopfLeiste = document.createElement('div');
  knopfLeiste.className = 'mahlzeiten';
  for (const mahlzeit of MAHLZEITEN) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'mahlzeit-knopf';
    knopf.textContent = mahlzeit.text;
    // aria-pressed sagt dem iPhone (auch für VoiceOver), ob der Knopf an ist.
    // Die Farbe kommt aus style.css und richtet sich danach.
    knopf.setAttribute('aria-pressed', gestellt[mahlzeit.schluessel] ? 'true' : 'false');
    knopf.addEventListener('click', function () {
      mahlzeitUmschalten(tag.datum, mahlzeit.schluessel);
    });
    knopfLeiste.appendChild(knopf);
  }

  eintrag.appendChild(kopf);
  eintrag.appendChild(infoText);
  eintrag.appendChild(knopfLeiste);
  return eintrag;
}


// Zeichnet die Liste der Tage und die Summe (neu).
function tageAnzeigen() {
  tageListe.innerHTML = '';   // alte Zeilen weg
  let summe = 0;

  for (const tag of reiseTage(reise.start, reise.ende)) {
    const gestellt = mahlzeitenVon(tag.datum);
    const ergebnis = tagesPauschale(tag, gestellt, satzFuer(reise.land));   // pauschale.js, laender.js
    summe = summe + ergebnis.betrag;
    tageListe.appendChild(tagZeileBauen(tag, gestellt, ergebnis));
  }

  summePauschale.textContent = euro(aufCent(summe));
  // Übersicht oben auch neu rechnen (beim ersten Laden kommen die Belege erst danach).
  uebersichtAnzeigen();
}


async function laden() {
  reise = await dbLesen('reisen', reiseId);
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
  // Im Ausland: Land der Pauschale dazuschreiben
  if (reise.land && reise.land !== 'Deutschland') {
    text = text + '\nMeal allowance: ' + reise.land;
  }
  untertitel.textContent = text;
  linkBearbeiten.href = 'reise-bearbeiten.html?id=' + reise.id;
  document.getElementById('beleg-neu').href = 'beleg.html?reise=' + reise.id;

  tageAnzeigen();
  await belegeAnzeigen();
}


// ---------- Belege dieser Reise ----------

let reiseBelege = [];   // die Belege dieser Reise, für die Übersicht

async function belegeAnzeigen() {
  const alle = await dbAlleLesen('belege');
  // filter behält nur die Einträge, auf die die Bedingung passt.
  reiseBelege = alle.filter(function (beleg) { return beleg.reiseId === reise.id; });
  uebersichtAnzeigen();
  if (reiseBelege.length === 0) return;   // Platzhalter "No receipts yet." bleibt

  // Nach Belegnummer sortieren, kleinste zuerst.
  reiseBelege.sort(function (a, b) { return a.nummer - b.nummer; });

  const liste = document.getElementById('belege');
  liste.innerHTML = '';
  for (const beleg of reiseBelege) {
    liste.appendChild(belegZeileBauen(beleg));   // aus belegzeile.js
  }
}


// ---------- Übersicht oben: Pauschale + Belege = Gesamt ----------

function uebersichtAnzeigen() {
  const pauschale = pauschaleSumme(reise);       // aus summen.js
  const belege = belegeSumme(reiseBelege);
  document.getElementById('ue-pauschale').textContent = euro(pauschale);
  document.getElementById('ue-belege').textContent = euro(belege);
  document.getElementById('ue-gesamt').textContent = euro(aufCent(pauschale + belege));
}


laden();
