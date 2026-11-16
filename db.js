// db.js: Alles rund ums Speichern auf dem Handy.
//
// Wir nutzen IndexedDB. Das ist eine kleine Datenbank, die in jedem Browser
// eingebaut ist. Die Daten bleiben auf dem Gerät, nichts geht ins Internet.
//
// Man kann sich IndexedDB wie eine Excel-Datei mit mehreren Blättern vorstellen.
// Jedes Blatt heißt hier "Tabelle" (offiziell: object store):
//   einstellungen  Name, Wohnort, Vorschuss
//   reisen         eine Zeile pro Reise (kommt in Schritt 4)
//   belege         eine Zeile pro Beleg (kommt in Schritt 8)

const DB_NAME = 'reisekosten';
const DB_VERSION = 1;   // Wenn wir später neue Tabellen brauchen, zählen wir hoch.


// Hilfsfunktion: IndexedDB meldet sich mit onsuccess oder onerror zurück.
// Wir verpacken das in ein "Promise", damit wir später einfach "await" schreiben können.
// await heißt: Warte, bis das Ergebnis da ist, und mach dann weiter.
function warten(anfrage) {
  return new Promise(function (fertig, fehler) {
    anfrage.onsuccess = function () { fertig(anfrage.result); };
    anfrage.onerror = function () { fehler(anfrage.error); };
  });
}


// Öffnet die Datenbank. Beim allerersten Mal legt sie die Tabellen an.
function dbOeffnen() {
  const anfrage = indexedDB.open(DB_NAME, DB_VERSION);

  // onupgradeneeded läuft nur, wenn es die Datenbank noch nicht gibt
  // oder wenn DB_VERSION höher ist als beim letzten Mal.
  anfrage.onupgradeneeded = function () {
    const db = anfrage.result;
    if (!db.objectStoreNames.contains('einstellungen')) {
      db.createObjectStore('einstellungen');
    }
    if (!db.objectStoreNames.contains('reisen')) {
      // keyPath 'id' und autoIncrement: Jede Reise bekommt automatisch eine Nummer.
      db.createObjectStore('reisen', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('belege')) {
      db.createObjectStore('belege', { keyPath: 'id', autoIncrement: true });
    }
  };

  return warten(anfrage);
}


// Liest einen Eintrag aus einer Tabelle.
// Beispiel: await dbLesen('einstellungen', 'profil')
async function dbLesen(tabelle, schluessel) {
  const db = await dbOeffnen();
  const vorgang = db.transaction(tabelle, 'readonly');
  return warten(vorgang.objectStore(tabelle).get(schluessel));
}


// Schreibt einen Eintrag in eine Tabelle. Gibt es ihn schon, wird er überschrieben.
// Beispiel: await dbSchreiben('einstellungen', { name: 'Chris' }, 'profil')
// Bei Tabellen mit automatischer Nummer lässt man den Schlüssel weg.
async function dbSchreiben(tabelle, wert, schluessel) {
  const db = await dbOeffnen();
  const vorgang = db.transaction(tabelle, 'readwrite');
  const speicher = vorgang.objectStore(tabelle);
  if (schluessel === undefined) {
    return warten(speicher.put(wert));
  }
  return warten(speicher.put(wert, schluessel));
}


// Liest alle Einträge einer Tabelle auf einmal, als Liste (Array).
// Beispiel: const reisen = await dbAlleLesen('reisen')
async function dbAlleLesen(tabelle) {
  const db = await dbOeffnen();
  const vorgang = db.transaction(tabelle, 'readonly');
  return warten(vorgang.objectStore(tabelle).getAll());
}


// Löscht einen Eintrag.
// Beispiel: await dbLoeschen('reisen', 3)
async function dbLoeschen(tabelle, schluessel) {
  const db = await dbOeffnen();
  const vorgang = db.transaction(tabelle, 'readwrite');
  return warten(vorgang.objectStore(tabelle).delete(schluessel));
}
