// sicherung.js: Alle Daten als eine Datei sichern und wieder einlesen.
//
// Die Daten liegen nur auf dem iPhone. Geht das Handy verloren oder wird die App gelöscht,
// sind sie weg. Mit einer Sicherung (zum Beispiel in iCloud Drive oder per Mail an dich)
// kannst du alles wiederherstellen, auch auf einem neuen iPhone.
//
// Die Datei ist JSON, also Text. Fotos stehen darin als langer Buchstabensalat ("Base64").
// Aufbau:
//   { app: 'reisekosten', format: 1, erstellt: '2026-11-16T10:30:00Z',
//     einstellungen: [{ schluessel: 'profil', wert: {...} }],
//     reisen: [...], belege: [... mit foto als Text ...] }
//
// Braucht: db.js, format.js


// Foto (Blob) -> Text "data:image/jpeg;base64,/9j/4AAQ..."
function blobAlsText(blob) {
  return new Promise(function (fertig, fehler) {
    const leser = new FileReader();
    leser.onload = function () { fertig(leser.result); };
    leser.onerror = function () { fehler(leser.error); };
    leser.readAsDataURL(blob);
  });
}

// Text "data:image/jpeg;base64,..." -> Foto (Blob). fetch kann solche Texte direkt lesen.
async function textAlsBlob(text) {
  const antwort = await fetch(text);
  return antwort.blob();
}


// Baut die Sicherungsdatei. Gibt einen Blob (Datei) zurück.
async function sicherungErstellen() {
  const einstellungen = [];
  for (const schluessel of await dbAlleSchluessel('einstellungen')) {
    einstellungen.push({ schluessel: schluessel, wert: await dbLesen('einstellungen', schluessel) });
  }

  const belege = [];
  for (const beleg of await dbAlleLesen('belege')) {
    // Object.assign macht eine Kopie, damit wir das Original nicht verändern.
    const kopie = Object.assign({}, beleg);
    kopie.foto = beleg.foto ? await blobAlsText(beleg.foto) : null;
    belege.push(kopie);
  }

  const daten = {
    app: 'reisekosten',
    format: 1,
    erstellt: new Date().toISOString(),
    einstellungen: einstellungen,
    reisen: await dbAlleLesen('reisen'),
    belege: belege
  };

  // JSON.stringify macht aus dem Objekt einen langen Text.
  return new Blob([JSON.stringify(daten)], { type: 'application/json' });
}


// Liest eine Sicherungsdatei ein und ERSETZT alle Daten auf dem Gerät.
// Gibt zurück, wie viele Reisen und Belege eingelesen wurden.
async function sicherungEinlesen(datei) {
  let daten;
  try {
    daten = JSON.parse(await datei.text());
  } catch (fehler) {
    throw new Error('This file is not a backup of this app.');
  }
  if (!daten || daten.app !== 'reisekosten' || !Array.isArray(daten.reisen) || !Array.isArray(daten.belege)) {
    throw new Error('This file is not a backup of this app.');
  }

  // Erst alle Fotos zurückverwandeln. Klappt das nicht, haben wir noch nichts gelöscht.
  const belege = [];
  for (const beleg of daten.belege) {
    const kopie = Object.assign({}, beleg);
    kopie.foto = beleg.foto ? await textAlsBlob(beleg.foto) : null;
    belege.push(kopie);
  }

  // Jetzt alles Alte löschen und das Neue schreiben.
  await dbLeeren('einstellungen');
  await dbLeeren('reisen');
  await dbLeeren('belege');
  for (const eintrag of daten.einstellungen || []) {
    await dbSchreiben('einstellungen', eintrag.wert, eintrag.schluessel);
  }
  for (const reise of daten.reisen) {
    await dbSchreiben('reisen', reise);   // mit ihrer alten id
  }
  for (const beleg of belege) {
    await dbSchreiben('belege', beleg);   // mit alter id und Belegnummer
  }

  return { reisen: daten.reisen.length, belege: belege.length };
}


// Dateiname mit heutigem Datum, z. B. "Travel-Expenses-Backup_2026-11-16.json"
function sicherungsName() {
  const jetzt = new Date();
  const heute = jetzt.getFullYear() + '-' + String(jetzt.getMonth() + 1).padStart(2, '0') + '-' +
    String(jetzt.getDate()).padStart(2, '0');
  return 'Travel-Expenses-Backup_' + heute + '.json';
}
