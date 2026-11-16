// verlauf.js: Die Seite History. Zeigt alle verschickten Abrechnungen aus der Tabelle
// "verschickt" (db.js) mit Status, Dateien zum Öffnen, "genehmigt" und Löschen.

const MONATE = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

let filter = 'alle';   // 'alle', 'warten' oder 'genehmigt'


// Kleine Hilfe: ein Element mit Klasse und Text bauen.
function element(art, klasse, text) {
  const e = document.createElement(art);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

// "2026-10-01" bis "2026-11-30" -> "October to November 2026"
function zeitraumText(von, bis) {
  const vonJahr = von.slice(0, 4);
  const bisJahr = bis.slice(0, 4);
  const vonMonat = MONATE[Number(von.slice(5, 7)) - 1];
  const bisMonat = MONATE[Number(bis.slice(5, 7)) - 1];
  if (von.slice(0, 7) === bis.slice(0, 7)) return vonMonat + ' ' + vonJahr;
  if (vonJahr === bisJahr) return vonMonat + ' to ' + bisMonat + ' ' + bisJahr;
  return vonMonat + ' ' + vonJahr + ' to ' + bisMonat + ' ' + bisJahr;
}

// "2026-11-16T14:05" -> "16.11.2026, 14:05"   (ältere Einträge haben keine Uhrzeit)
function wann(text) {
  return text.length > 10 ? datumZeit(text) : datum(text);
}


// Einmalig: Einträge aus der alten Liste (bis Version 33 in den Einstellungen) umziehen.
async function alteListeUmziehen() {
  const alt = await dbLesen('einstellungen', 'abrechnungen');
  if (!alt || alt.length === 0) return;
  for (const e of alt) {
    await dbSchreiben('verschickt', {
      von: e.von, bis: e.bis, gesamt: e.gesamt, auszahlung: e.auszahlung, vorschuss: null,
      verschickt: e.verschickt, an: '', anMail: '', reisen: [], belegAnzahl: null,
      genehmigt: e.genehmigt || '', pdf: null, excel: null
    });
  }
  await dbLoeschen('einstellungen', 'abrechnungen');
}


// ---------- Anzeigen ----------

async function anzeigen() {
  const liste = await dbAlleLesen('verschickt');

  // Kacheln: wie viele warten, und wie viel wurde dieses Jahr genehmigt ausgezahlt
  const jahr = String(new Date().getFullYear());
  const offen = liste.filter(function (e) { return !e.genehmigt; }).length;
  let summe = 0;
  for (const e of liste) {
    if (e.genehmigt && e.genehmigt.slice(0, 4) === jahr) summe = summe + (e.auszahlung || 0);
  }
  document.getElementById('kachel-warten').textContent = String(offen);
  document.getElementById('kachel-jahr').textContent = euro(Math.round(summe * 100) / 100);
  document.getElementById('kachel-jahr-text').textContent = 'Approved payouts ' + jahr;

  // Filtern und sortieren: zuletzt verschickt zuerst
  const gezeigt = liste
    .filter(function (e) {
      if (filter === 'warten') return !e.genehmigt;
      if (filter === 'genehmigt') return Boolean(e.genehmigt);
      return true;
    })
    .sort(function (a, b) { return b.verschickt.localeCompare(a.verschickt); });

  const ul = document.getElementById('verlauf');
  ul.innerHTML = '';
  document.getElementById('verlauf-leer').hidden = gezeigt.length > 0;
  for (const e of gezeigt) ul.appendChild(karteBauen(e));
}


// Eine Karte:
//   October to November 2026                 461,60 €
//   [Waiting for approval]
//   Sent 16.11.2026, 14:05 to Anna Berg
//   Munich, Vienna · 5 receipts
//   Payout 261,60 € (advance 200,00 €)
//   [PDF] [Excel] [Mark approved] [Papierkorb]
function karteBauen(e) {
  const li = element('li', 'karte verlauf-karte');

  const kopf = element('div', 'tag-kopf');
  kopf.appendChild(element('span', 'titel', zeitraumText(e.von, e.bis)));
  kopf.appendChild(element('span', 'titel', euro(e.gesamt)));
  li.appendChild(kopf);

  li.appendChild(element('span', 'abzeichen ' + (e.genehmigt ? 'abzeichen-ok' : 'abzeichen-warten'),
    e.genehmigt ? 'Approved on ' + datum(e.genehmigt) : 'Waiting for approval'));

  let gesendet = 'Sent ' + wann(e.verschickt);
  if (e.an) gesendet = gesendet + ' to ' + e.an;
  li.appendChild(element('span', 'info', gesendet));

  if (e.reisen && e.reisen.length > 0) {
    let text = e.reisen.join(', ');
    if (e.belegAnzahl !== null && e.belegAnzahl !== undefined) text = text + ' · ' + e.belegAnzahl + ' receipt(s)';
    li.appendChild(element('span', 'info', text));
  }

  let geld = 'Payout ' + euro(e.auszahlung);
  if (e.vorschuss) geld = geld + ' (advance ' + euro(e.vorschuss) + ')';
  li.appendChild(element('span', 'info', geld));

  // Knöpfe
  const knoepfe = element('div', 'verlauf-knoepfe');

  if (e.pdf) {
    knoepfe.appendChild(knopfBauen('dokument', 'PDF', function () { dateiAusgeben(e.pdf, e.pdfName || 'report.pdf'); }));
  }
  if (e.excel) {
    knoepfe.appendChild(knopfBauen('tabelle', 'Excel', function () { dateiAusgeben(e.excel, e.excelName || 'report.xlsx'); }));
  }
  knoepfe.appendChild(knopfBauen('haken', e.genehmigt ? 'Undo' : 'Approved', async function () {
    e.genehmigt = e.genehmigt ? '' : heuteText();
    await dbSchreiben('verschickt', e);
    anzeigen();
  }));
  const weg = knopfBauen('muell', '', async function () {
    if (!confirm('Delete this entry from the history? Trips and receipts are not deleted.')) return;
    await dbLoeschen('verschickt', e.id);
    anzeigen();
  });
  weg.classList.add('knopf-gefahr');
  weg.setAttribute('aria-label', 'Delete');
  knoepfe.appendChild(weg);

  li.appendChild(knoepfe);
  return li;
}

// Kleiner Knopf mit Symbol (aus navigation.js) und Text
function knopfBauen(symbolName, text, wennGetippt) {
  const k = element('button', 'knopf knopf-klein-breit');
  k.type = 'button';
  k.innerHTML = symbol(symbolName);
  if (text) k.appendChild(document.createTextNode(text));
  k.addEventListener('click', wennGetippt);
  return k;
}

// Heute als "2026-11-16"
function heuteText() {
  const jetzt = new Date();
  return jetzt.getFullYear() + '-' + String(jetzt.getMonth() + 1).padStart(2, '0') + '-' +
    String(jetzt.getDate()).padStart(2, '0');
}


// ---------- Filter ----------

for (const knopf of document.querySelectorAll('.filter-knopf')) {
  knopf.addEventListener('click', function () {
    filter = knopf.dataset.filter;
    for (const k of document.querySelectorAll('.filter-knopf')) {
      k.setAttribute('aria-pressed', k === knopf ? 'true' : 'false');
    }
    anzeigen();
  });
}


// Los geht's
alteListeUmziehen().then(anzeigen);
