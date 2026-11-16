// einstellungen.js: Lädt die gespeicherten Einstellungen ins Formular
// und speichert sie, wenn man auf "Save" tippt.

// Zuerst holen wir uns die Felder aus der Seite, über ihre id.
const formular = document.getElementById('formular');
const feldName = document.getElementById('name');
const feldWohnort = document.getElementById('wohnort');
const feldVorschuss = document.getElementById('vorschuss');
const feldChefName = document.getElementById('chef-name');
const feldChefMail = document.getElementById('chef-mail');
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
  feldChefName.value = einstellungen.chefName || '';
  feldChefMail.value = einstellungen.chefMail || '';
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

  const chefMail = feldChefMail.value.trim();
  // Ganz einfache Prüfung: Eine E-Mail-Adresse hat ein @ und danach einen Punkt.
  if (chefMail !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(chefMail)) {
    zeigeMeldung('Please check the supervisor email address.', true);
    return;
  }

  // Erst die alten Einstellungen holen, damit nichts verloren geht, was hier nicht im Formular steht
  // (z. B. deine gespeicherte Unterschrift). Dann die Felder darüberschreiben.
  const einstellungen = (await dbLesen('einstellungen', SCHLUESSEL)) || {};
  // trim() entfernt Leerzeichen am Anfang und Ende.
  einstellungen.name = feldName.value.trim();
  einstellungen.wohnort = feldWohnort.value.trim();
  einstellungen.vorschuss = vorschuss;
  einstellungen.chefName = feldChefName.value.trim();
  einstellungen.chefMail = chefMail;

  await dbSchreiben('einstellungen', einstellungen, SCHLUESSEL);

  // Den Betrag schön formatiert zurück ins Feld schreiben, z. B. "200" -> "200,00".
  feldVorschuss.value = vorschuss ? zahlAnzeigen(vorschuss) : '';
  zeigeMeldung('Saved.', false);
});


// Los geht's: beim Öffnen einmal laden.
laden();


// ---------- Sicherung (Backup) ----------

const sicherungStatus = document.getElementById('sicherung-status');
const letzteSicherung = document.getElementById('letzte-sicherung');
const feldSicherung = document.getElementById('sicherung-datei');

async function letzteSicherungZeigen() {
  const wann = await dbLesen('einstellungen', 'letzte-sicherung');
  letzteSicherung.textContent = wann ? 'Last backup: ' + datum(wann) : 'No backup yet.';
}

document.getElementById('sichern').addEventListener('click', async function () {
  sicherungStatus.textContent = 'Creating backup…';
  try {
    const datei = await sicherungErstellen();   // aus sicherung.js
    dateiAusgeben(datei, sicherungsName());
    // Datum der Sicherung merken, als "2026-11-16"
    await dbSchreiben('einstellungen', new Date().toISOString().slice(0, 10), 'letzte-sicherung');
    letzteSicherungZeigen();
    // Größe: ab 1 MB in MB mit einer Stelle, darunter in KB
    const groesse = datei.size >= 1048576
      ? (datei.size / 1048576).toFixed(1).replace('.', ',') + ' MB'
      : Math.max(1, Math.round(datei.size / 1024)) + ' KB';
    sicherungStatus.textContent = 'Backup created (' + groesse + '). Save it to Files or send it to yourself.';
  } catch (fehler) {
    sicherungStatus.textContent = 'Could not create the backup. (' + fehler.message + ')';
  }
});

feldSicherung.addEventListener('change', async function () {
  const datei = feldSicherung.files[0];
  if (!datei) return;
  feldSicherung.value = '';   // damit man dieselbe Datei später noch einmal wählen kann

  if (!confirm('Import this backup? It REPLACES all trips, receipts and settings on this iPhone.')) return;

  sicherungStatus.textContent = 'Importing backup…';
  try {
    const anzahl = await sicherungEinlesen(datei);   // aus sicherung.js
    sicherungStatus.textContent = 'Backup imported: ' + anzahl.reisen + ' trip(s), ' +
      anzahl.belege + ' receipt(s).';
    // Felder oben mit den eingelesenen Einstellungen neu füllen
    feldName.value = '';
    feldWohnort.value = '';
    feldVorschuss.value = '';
    await laden();
    letzteSicherungZeigen();
  } catch (fehler) {
    sicherungStatus.textContent = 'Could not import. (' + fehler.message + ')';
  }
});

letzteSicherungZeigen();
