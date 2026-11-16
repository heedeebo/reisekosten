// unterschrift.js: Ein Feld, in das man mit dem Finger unterschreibt.
//
// Ein canvas ist eine Zeichenfläche. Wir hören auf "Pointer"-Ereignisse. Die kommen
// vom Finger, vom Apple Pencil und von der Maus am PC gleich:
//   pointerdown  Finger setzt auf      -> Strich beginnt
//   pointermove  Finger bewegt sich    -> Linie bis zur neuen Stelle ziehen
//   pointerup    Finger hebt ab        -> Strich fertig, Unterschrift speichern
// Gespeichert wird ein PNG-Bild als Text ("data:image/png;base64,...").


// leinwand: das canvas-Element. fertig: wird nach jedem Strich mit dem Bild aufgerufen.
function unterschriftsFeld(leinwand, fertig) {
  const stift = leinwand.getContext('2d');
  let zeichnet = false;
  let leer = true;

  // Das canvas so viele echte Pixel geben, wie das Display hat (iPhone: 3 pro Punkt).
  // Sonst wird die Unterschrift unscharf.
  const faktor = window.devicePixelRatio || 1;
  function groesseAnpassen() {
    const alt = leer ? null : leinwand.toDataURL();
    leinwand.width = Math.round(leinwand.clientWidth * faktor);
    leinwand.height = Math.round(leinwand.clientHeight * faktor);
    stiftEinstellen();
    if (alt) bildZeigen(alt);
  }
  function stiftEinstellen() {
    stift.lineWidth = 2.5 * faktor;
    stift.lineCap = 'round';      // runde Strich-Enden
    stift.lineJoin = 'round';     // runde Ecken
    stift.strokeStyle = '#1a2a6c'; // dunkelblau wie ein Kugelschreiber
  }

  // Position des Fingers im canvas, in echten Pixeln.
  function stelle(ereignis) {
    const rahmen = leinwand.getBoundingClientRect();
    return {
      x: (ereignis.clientX - rahmen.left) * faktor,
      y: (ereignis.clientY - rahmen.top) * faktor
    };
  }

  leinwand.addEventListener('pointerdown', function (ereignis) {
    zeichnet = true;
    // Alle weiteren Bewegungen dieses Fingers gehören zu uns, auch außerhalb des Feldes.
    leinwand.setPointerCapture(ereignis.pointerId);
    const p = stelle(ereignis);
    stift.beginPath();
    stift.moveTo(p.x, p.y);
    stift.lineTo(p.x + 0.1, p.y + 0.1);   // damit auch ein Punkt sichtbar ist
    stift.stroke();
    leer = false;
  });

  leinwand.addEventListener('pointermove', function (ereignis) {
    if (!zeichnet) return;
    const p = stelle(ereignis);
    stift.lineTo(p.x, p.y);
    stift.stroke();
  });

  function strichEnde() {
    if (!zeichnet) return;
    zeichnet = false;
    fertig(leinwand.toDataURL('image/png'));
  }
  leinwand.addEventListener('pointerup', strichEnde);
  leinwand.addEventListener('pointercancel', strichEnde);

  // Ein gespeichertes Bild wieder ins Feld malen.
  function bildZeigen(adresse) {
    const bild = new Image();
    bild.onload = function () {
      stift.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
    };
    bild.src = adresse;
    leer = false;
  }

  groesseAnpassen();

  // Diese Funktionen kann die Seite von außen benutzen.
  return {
    leeren: function () {
      stift.clearRect(0, 0, leinwand.width, leinwand.height);
      leer = true;
    },
    zeigen: bildZeigen,
    istLeer: function () { return leer; }
  };
}
