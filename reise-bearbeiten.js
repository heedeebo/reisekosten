// reise-bearbeiten.js: Formular für eine Reise. Neu anlegen, ändern, löschen.

const formular = document.getElementById('formular');
const titel = document.getElementById('titel');
const feldZiel = document.getElementById('ziel');
const feldGrund = document.getElementById('grund');
const feldStart = document.getElementById('start');
const feldEnde = document.getElementById('ende');
const knopfLoeschen = document.getElementById('loeschen');
const meldung = document.getElementById('meldung');


// Steht in der Adresse "?id=3"? Dann ändern wir Reise 3.
// URLSearchParams liest den Teil nach dem Fragezeichen aus.
const adressTeile = new URLSearchParams(location.search);
// Number(...) macht aus dem Text "3" die Zahl 3. Ohne id bleibt reiseId null (= nichts).
const reiseId = adressTeile.has('id') ? Number(adressTeile.get('id')) : null;

// Beim Ändern merken wir uns die ganze alte Reise. So bleiben beim Speichern
// auch Dinge erhalten, die nicht im Formular stehen (z. B. die Mahlzeiten).
let alteReise = null;


// Beim Ändern: die Reise laden und die Felder füllen.
async function laden() {
  if (reiseId === null) return;   // neue Reise, nichts zu laden

  const reise = await dbLesen('reisen', reiseId);
  if (!reise) {
    meldung.textContent = 'This trip does not exist anymore.';
    return;
  }
  alteReise = reise;

  // "Back" führt beim Ändern zurück zur Reise, nicht zur Startseite.
  document.getElementById('zurueck').href = 'reise.html?id=' + reiseId;
  titel.textContent = 'Edit Trip';
  document.title = 'Edit Trip';
  feldZiel.value = reise.ziel;
  feldGrund.value = reise.grund;
  feldStart.value = reise.start;
  feldEnde.value = reise.ende;
  knopfLoeschen.hidden = false;   // Löschen-Knopf zeigen
}


// Prüft die Eingaben. Gibt einen Fehlertext zurück, oder '' wenn alles passt.
function pruefen() {
  if (feldZiel.value.trim() === '') return 'Please enter a destination.';
  if (feldStart.value === '') return 'Please enter when the trip starts.';
  if (feldEnde.value === '') return 'Please enter when the trip ends.';
  // Die Texte sehen aus wie "2026-08-10T07:00". Weil das Jahr vorne steht,
  // kann man sie einfach vergleichen wie Wörter im Wörterbuch.
  if (feldEnde.value <= feldStart.value) return 'The end must be after the start.';
  return '';
}


formular.addEventListener('submit', async function (ereignis) {
  ereignis.preventDefault();

  const fehler = pruefen();
  if (fehler !== '') {
    meldung.textContent = fehler;
    return;
  }

  // Neue Reise: leeres Objekt. Ändern: die alte Reise mit allem, was schon drin ist
  // (auch ihre Nummer, sonst entstünde eine zweite Reise).
  const reise = alteReise || {};
  reise.ziel = feldZiel.value.trim();
  reise.grund = feldGrund.value.trim();
  reise.start = feldStart.value;
  reise.ende = feldEnde.value;

  // dbSchreiben gibt die Nummer der Reise zurück. Bei einer neuen Reise ist das
  // die Nummer, die IndexedDB gerade vergeben hat.
  const id = await dbSchreiben('reisen', reise);
  location.href = 'reise.html?id=' + id;   // weiter zur Reise mit ihren Tagen
});


knopfLoeschen.addEventListener('click', async function () {
  // confirm zeigt ein Fenster mit OK und Abbrechen. Bei OK kommt true zurück.
  if (!confirm('Delete this trip? Its receipts are kept and moved to "Receipts Without Trip".')) return;

  // Die Belege der Reise nicht löschen, nur von der Reise lösen.
  const belege = await dbAlleLesen('belege');
  for (const beleg of belege) {
    if (beleg.reiseId === reiseId) {
      beleg.reiseId = null;
      await dbSchreiben('belege', beleg);
    }
  }

  await dbLoeschen('reisen', reiseId);
  location.href = 'index.html';
});


laden();
