// einstellungen.js: Lädt die gespeicherten Einstellungen ins Formular
// und speichert sie, wenn man auf "Save" tippt.

// Zuerst holen wir uns die Felder aus der Seite, über ihre id.
const formular = document.getElementById('formular');
const feldName = document.getElementById('name');
const feldWohnort = document.getElementById('wohnort');
const feldVorschuss = document.getElementById('vorschuss');
const meldung = document.getElementById('meldung');

// Unter diesem Schlüssel liegen die Einstellungen in der Tabelle "einstellungen".
const SCHLUESSEL = 'profil';


// Zeigt unter dem Knopf einen kurzen Text an. istFehler macht ihn rot.
function zeigeMeldung(text, istFehler) {
  meldung.textContent = text;
  meldung.classList.toggle('fehler', istFehler === true);
}


// Beim Öffnen der Seite: gespeicherte Werte in die Felder schreiben.
async function laden() {
  // || {} heißt: Wenn noch nichts gespeichert ist, nimm ein leeres Objekt.
  const einstellungen = (await dbLesen('einstellungen', SCHLUESSEL)) || {};
  feldName.value = einstellungen.name || '';
  feldWohnort.value = einstellungen.wohnort || '';
  if (einstellungen.vorschuss) {
    feldVorschuss.value = zahlAnzeigen(einstellungen.vorschuss);
  }
}


// Beim Tippen auf "Save" schickt der Browser das Formular ab.
// Wir fangen das ab und speichern selbst.
formular.addEventListener('submit', async function (ereignis) {
  // Ohne diese Zeile würde der Browser die Seite neu laden.
  ereignis.preventDefault();

  const vorschuss = zahlLesen(feldVorschuss.value);
  if (Number.isNaN(vorschuss) || vorschuss < 0) {
    zeigeMeldung('Please enter a valid amount, e.g. 200,00.', true);
    return;   // return heißt: hier aufhören, nicht speichern.
  }

  // trim() entfernt Leerzeichen am Anfang und Ende.
  const einstellungen = {
    name: feldName.value.trim(),
    wohnort: feldWohnort.value.trim(),
    vorschuss: vorschuss
  };

  await dbSchreiben('einstellungen', einstellungen, SCHLUESSEL);

  // Den Betrag schön formatiert zurück ins Feld schreiben, z. B. "200" -> "200,00".
  feldVorschuss.value = vorschuss ? zahlAnzeigen(vorschuss) : '';
  zeigeMeldung('Saved.', false);
});


// Los geht's: beim Öffnen einmal laden.
laden();
