// start.js: Füllt die Reiseliste auf der Startseite.

const liste = document.getElementById('reiseliste');


async function reisenAnzeigen() {
  const reisen = await dbAlleLesen('reisen');

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
    // <li><a href="reise-bearbeiten.html?id=3">
    //   <span class="titel">Munich</span>
    //   <span class="info">10.08.2026 to 12.08.2026 · Customer visit</span>
    // </a></li>
    const eintrag = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'listen-link';
    link.href = 'reise-bearbeiten.html?id=' + reise.id;

    const zeileTitel = document.createElement('span');
    zeileTitel.className = 'titel';
    // textContent statt innerHTML: Was du eintippst, wird immer als Text gezeigt,
    // nie als Code. So kann ein Zeichen wie < im Reiseziel nichts kaputt machen.
    zeileTitel.textContent = reise.ziel;

    const zeileInfo = document.createElement('span');
    zeileInfo.className = 'info';
    let info = datum(reise.start) + ' to ' + datum(reise.ende);
    if (reise.grund) {
      info = info + ' · ' + reise.grund;
    }
    zeileInfo.textContent = info;

    // Alles ineinander stecken und an die Liste hängen.
    link.appendChild(zeileTitel);
    link.appendChild(zeileInfo);
    eintrag.appendChild(link);
    liste.appendChild(eintrag);
  }
}


reisenAnzeigen();
