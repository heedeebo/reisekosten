// start.js: Füllt die Startseite: Reisen mit Summe und Belege ohne Reise.

const liste = document.getElementById('reiseliste');


async function reisenAnzeigen() {
  const reisen = await dbAlleLesen('reisen');
  const belege = await dbAlleLesen('belege');

  belegeOhneReiseAnzeigen(belege);

  // Keine Reisen? Dann bleibt der Platzhalter "No trips yet." stehen.
  if (reisen.length === 0) return;

  // Sortieren: neueste Reise oben.
  // sort vergleicht immer zwei Reisen a und b und fragt: Wer kommt zuerst?
  reisen.sort(function (a, b) {
    return b.start.localeCompare(a.start);
  });

  liste.innerHTML = '';   // Platzhalter entfernen

  // for...of geht die Reisen eine nach der anderen durch.
  for (const reise of reisen) {
    // Für jede Reise bauen wir so etwas:
    // <li><a href="reise.html?id=3">
    //   <div class="tag-kopf"><span>Munich</span><span>312,40 €</span></div>
    //   <span class="info">10.08.2026 to 12.08.2026 · Customer visit</span>
    // </a></li>
    const eintrag = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'listen-link';
    link.href = 'reise.html?id=' + reise.id;

    const kopf = document.createElement('div');
    kopf.className = 'tag-kopf';
    const zeileTitel = document.createElement('span');
    zeileTitel.className = 'titel';
    // textContent statt innerHTML: Was du eintippst, wird immer als Text gezeigt,
    // nie als Code. So kann ein Zeichen wie < im Reiseziel nichts kaputt machen.
    zeileTitel.textContent = reise.ziel;
    const zeileSumme = document.createElement('span');
    zeileSumme.className = 'titel';
    zeileSumme.textContent = euro(reiseSumme(reise, belege));   // aus summen.js
    kopf.appendChild(zeileTitel);
    kopf.appendChild(zeileSumme);

    const zeileInfo = document.createElement('span');
    zeileInfo.className = 'info';
    let info = datum(reise.start) + ' to ' + datum(reise.ende);
    if (reise.grund) {
      info = info + ' · ' + reise.grund;
    }
    zeileInfo.textContent = info;

    // Alles ineinander stecken und an die Liste hängen.
    link.appendChild(kopf);
    link.appendChild(zeileInfo);
    eintrag.appendChild(link);
    liste.appendChild(eintrag);
  }
}


// Belege, die zu keiner Reise gehören. Der Abschnitt erscheint nur, wenn es welche gibt.
function belegeOhneReiseAnzeigen(belege) {
  const ohne = belege.filter(function (b) { return b.reiseId === null; });
  if (ohne.length === 0) return;

  ohne.sort(function (a, b) { return a.nummer - b.nummer; });
  const ohneListe = document.getElementById('belege-ohne-reise');
  for (const beleg of ohne) {
    ohneListe.appendChild(belegZeileBauen(beleg));   // aus belegzeile.js
  }
  document.getElementById('ohne-reise').hidden = false;
}


reisenAnzeigen();
