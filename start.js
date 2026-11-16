// start.js: Füllt die Startseite: Begrüßung, Kacheln, Reisen mit Summe und Belege ohne Reise.

const liste = document.getElementById('reiseliste');

const MONATE_KURZ = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


async function startseiteAnzeigen() {
  const reisen = await dbAlleLesen('reisen');
  const belege = await dbAlleLesen('belege');
  const profil = (await dbLesen('einstellungen', 'profil')) || {};
  const verschickt = (await dbLesen('einstellungen', 'abrechnungen')) || [];

  grussZeigen(profil);
  kachelnFuellen(reisen, belege, verschickt);
  belegeOhneReiseAnzeigen(belege);
  reisenAnzeigen(reisen, belege);
}


// "Good morning, Chris" je nach Uhrzeit. Ohne Namen nur der Gruß.
function grussZeigen(profil) {
  const stunde = new Date().getHours();
  const gruss = stunde < 12 ? 'Good morning' : (stunde < 18 ? 'Good afternoon' : 'Good evening');
  const vorname = (profil.name || '').split(' ')[0];
  document.getElementById('gruss').textContent = gruss + (vorname ? ', ' + vorname : '');
}


// Kachel 1: Summe aller Reisen, die in diesem Monat begonnen haben.
// Kachel 2: Wie viele verschickte Abrechnungen noch nicht genehmigt sind.
function kachelnFuellen(reisen, belege, verschickt) {
  const jetzt = new Date();
  const monat = jetzt.getFullYear() + '-' + String(jetzt.getMonth() + 1).padStart(2, '0');
  let summe = 0;
  for (const reise of reisen) {
    if (reise.start.slice(0, 7) === monat) summe = summe + reiseSumme(reise, belege);   // summen.js
  }
  document.getElementById('kachel-offen').textContent = euro(aufCent(summe));

  const offen = verschickt.filter(function (e) { return !e.genehmigt; }).length;
  document.getElementById('kachel-warten').textContent = String(offen);
}


function reisenAnzeigen(reisen, belege) {
  // Keine Reisen? Dann bleibt der Platzhalter stehen.
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
    // <li><a href="reise.html?id=3" class="listen-link reise-zeile">
    //   <div class="datum-kaestchen"><b>12</b><span>Oct</span></div>
    //   <div class="reise-text">
    //     <div class="tag-kopf"><span>Munich</span><span>312,40 €</span></div>
    //     <span class="info">12.10. to 14.10.2026 · Trade fair</span>
    //   </div>
    // </a></li>
    const eintrag = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'listen-link reise-zeile';
    link.href = 'reise.html?id=' + reise.id;

    // Kästchen mit Tag und Monat, wie ein kleiner Kalender
    const kaestchen = document.createElement('div');
    kaestchen.className = 'datum-kaestchen';
    const tag = document.createElement('b');
    tag.textContent = String(Number(reise.start.slice(8, 10)));
    const monatName = document.createElement('span');
    monatName.textContent = MONATE_KURZ[Number(reise.start.slice(5, 7)) - 1];
    kaestchen.appendChild(tag);
    kaestchen.appendChild(monatName);

    const text = document.createElement('div');
    text.className = 'reise-text';

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
    if (reise.land && reise.land !== 'Deutschland') info = info + ' · ' + reise.land;
    if (reise.grund) info = info + ' · ' + reise.grund;
    zeileInfo.textContent = info;

    // Alles ineinander stecken und an die Liste hängen.
    text.appendChild(kopf);
    text.appendChild(zeileInfo);
    link.appendChild(kaestchen);
    link.appendChild(text);
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


startseiteAnzeigen();
