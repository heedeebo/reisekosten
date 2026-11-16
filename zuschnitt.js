// zuschnitt.js: Foto nachträglich zuschneiden.
//
// Öffnet das Foto bildschirmfüllend mit einem Rahmen darüber. Den Rahmen verkleinerst du
// an den vier Ecken, und du kannst ihn als Ganzes verschieben, wenn du in die Mitte fasst.
// "Apply" schneidet alles außerhalb des Rahmens weg und gibt ein neues Foto zurück.
//
// Rechnen in zwei Maßstäben:
//   Bildschirm-Pixel: wie groß das Foto gerade angezeigt wird (z. B. 340 x 480)
//   Foto-Pixel:       wie groß das Foto wirklich ist (z. B. 1500 x 2000)
// Der Rahmen wird in Bildschirm-Pixeln gezogen und am Ende umgerechnet.


// Öffnet den Zuschnitt. Gibt ein Promise zurück: das neue Foto (Blob) oder null bei "Cancel".
function zuschneidenOeffnen(foto) {
  return new Promise(function (fertig) {
    const adresse = URL.createObjectURL(foto);

    // ---------- Aufbau ----------
    //  <div class="zuschnitt">
    //    <div class="zuschnitt-flaeche"><img><div class="zuschnitt-rahmen">4 Ecken</div></div>
    //    <div class="zuschnitt-knoepfe">Cancel  Apply</div>
    //  </div>
    const ebene = document.createElement('div');
    ebene.className = 'zuschnitt';
    const flaeche = document.createElement('div');
    flaeche.className = 'zuschnitt-flaeche';
    const bild = document.createElement('img');
    bild.alt = 'Receipt photo';
    const rahmen = document.createElement('div');
    rahmen.className = 'zuschnitt-rahmen';
    for (const ecke of ['ol', 'or', 'ul', 'ur']) {   // oben links, oben rechts, unten links, unten rechts
      const griff = document.createElement('div');
      griff.className = 'zuschnitt-ecke zuschnitt-ecke-' + ecke;
      griff.dataset.ecke = ecke;
      rahmen.appendChild(griff);
    }
    flaeche.appendChild(bild);
    flaeche.appendChild(rahmen);

    const knoepfe = document.createElement('div');
    knoepfe.className = 'zuschnitt-knoepfe';
    const abbrechen = document.createElement('button');
    abbrechen.type = 'button';
    abbrechen.className = 'knopf';
    abbrechen.textContent = 'Cancel';
    const anwenden = document.createElement('button');
    anwenden.type = 'button';
    anwenden.className = 'knopf knopf-haupt';
    anwenden.textContent = 'Apply';
    knoepfe.appendChild(abbrechen);
    knoepfe.appendChild(anwenden);

    ebene.appendChild(flaeche);
    ebene.appendChild(knoepfe);
    document.body.appendChild(ebene);
    document.body.classList.add('zuschnitt-offen');   // Seite darunter soll nicht scrollen

    // ---------- Rahmen ----------
    // Position des Rahmens in Bildschirm-Pixeln, gemessen vom Bild oben links.
    let r = { x: 0, y: 0, b: 0, h: 0 };   // x, y, Breite, Höhe
    const MIN = 40;                        // kleiner als 40 Pixel darf der Rahmen nicht werden

    function rahmenZeichnen() {
      rahmen.style.left = (bild.offsetLeft + r.x) + 'px';
      rahmen.style.top = (bild.offsetTop + r.y) + 'px';
      rahmen.style.width = r.b + 'px';
      rahmen.style.height = r.h + 'px';
    }

    bild.onload = function () {
      // Anfangs: Rahmen fast so groß wie das Bild, 4 % Rand
      const rand = 0.04;
      r = {
        x: bild.clientWidth * rand,
        y: bild.clientHeight * rand,
        b: bild.clientWidth * (1 - 2 * rand),
        h: bild.clientHeight * (1 - 2 * rand)
      };
      rahmenZeichnen();
    };
    bild.src = adresse;

    // ---------- Ziehen ----------
    // Was gezogen wird ('ol', 'or', 'ul', 'ur' oder 'mitte'), wo der Finger anfing
    // und wie der Rahmen da aussah.
    let zug = null;

    rahmen.addEventListener('pointerdown', function (ereignis) {
      ereignis.preventDefault();
      rahmen.setPointerCapture(ereignis.pointerId);
      zug = {
        was: ereignis.target.dataset.ecke || 'mitte',
        startX: ereignis.clientX,
        startY: ereignis.clientY,
        vorher: Object.assign({}, r)   // Kopie des Rahmens
      };
    });

    rahmen.addEventListener('pointermove', function (ereignis) {
      if (!zug) return;
      const dx = ereignis.clientX - zug.startX;   // so weit hat sich der Finger bewegt
      const dy = ereignis.clientY - zug.startY;
      const v = zug.vorher;
      const maxB = bild.clientWidth;
      const maxH = bild.clientHeight;
      // Kleine Hilfe: Zahl zwischen unten und oben halten
      const zwischen = function (wert, unten, oben) { return Math.max(unten, Math.min(oben, wert)); };

      if (zug.was === 'mitte') {
        // Ganzen Rahmen verschieben, aber nicht aus dem Bild heraus
        r.x = zwischen(v.x + dx, 0, maxB - v.b);
        r.y = zwischen(v.y + dy, 0, maxH - v.h);
      } else {
        // Linke Kante bewegen (Ecken 'ol' und 'ul'), rechte Kante (Ecken 'or' und 'ur')
        let links = v.x, rechts = v.x + v.b, oben = v.y, unten = v.y + v.h;
        if (zug.was.endsWith('l')) links = zwischen(v.x + dx, 0, rechts - MIN);
        if (zug.was.endsWith('r')) rechts = zwischen(v.x + v.b + dx, links + MIN, maxB);
        if (zug.was.startsWith('o')) oben = zwischen(v.y + dy, 0, unten - MIN);
        if (zug.was.startsWith('u')) unten = zwischen(v.y + v.h + dy, oben + MIN, maxH);
        r = { x: links, y: oben, b: rechts - links, h: unten - oben };
      }
      rahmenZeichnen();
    });

    function zugEnde() { zug = null; }
    rahmen.addEventListener('pointerup', zugEnde);
    rahmen.addEventListener('pointercancel', zugEnde);
    // Dreht man das Handy, ändert sich die Bildgröße. Dann Rahmen neu anlegen.
    window.addEventListener('resize', bild.onload);

    // ---------- Schließen ----------
    function schliessen(ergebnis) {
      window.removeEventListener('resize', bild.onload);
      document.body.classList.remove('zuschnitt-offen');
      ebene.remove();
      URL.revokeObjectURL(adresse);
      fertig(ergebnis);
    }

    abbrechen.addEventListener('click', function () { schliessen(null); });

    anwenden.addEventListener('click', function () {
      // Bildschirm-Pixel in Foto-Pixel umrechnen
      const faktor = bild.naturalWidth / bild.clientWidth;
      const x = Math.round(r.x * faktor);
      const y = Math.round(r.y * faktor);
      const b = Math.round(r.b * faktor);
      const h = Math.round(r.h * faktor);

      // Nur den Ausschnitt auf eine neue Zeichenfläche malen
      const leinwand = document.createElement('canvas');
      leinwand.width = b;
      leinwand.height = h;
      // drawImage(bild, Quelle x, y, Breite, Höhe, Ziel x, y, Breite, Höhe)
      leinwand.getContext('2d').drawImage(bild, x, y, b, h, 0, 0, b, h);
      leinwand.toBlob(function (neu) { schliessen(neu); }, 'image/jpeg', 0.85);
    });
  });
}
