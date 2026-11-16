// pdf.js: Baut ein PDF: vorne die Abrechnung, dahinter alle Belegfotos nach Belegnummer.
//
// Wir nutzen jsPDF. Es zeichnet direkt auf A4-Seiten, gemessen in Millimetern.
// Die Seite ist 210 mm breit und 297 mm hoch. (0|0) ist oben links.
//
// Braucht: jsPDF (wird erst beim Klick geladen), format.js, hilfen.js


const JSPDF_ADRESSE = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

const RAND = 15;            // Rand links und rechts in mm
const RECHTS = 210 - RAND;  // rechte Kante für Beträge
const UNTEN = 282;          // ab hier kommt eine neue Seite


// Blob (Foto) -> "data:image/jpeg;base64,..." Text, den jsPDF einbauen kann.
function alsDatenAdresse(blob) {
  return new Promise(function (fertig, fehler) {
    const leser = new FileReader();
    leser.onload = function () { fertig(leser.result); };
    leser.onerror = function () { fehler(leser.error); };
    leser.readAsDataURL(blob);
  });
}

// Breite und Höhe eines Bildes in Pixeln.
function bildGroesse(adresse) {
  return new Promise(function (fertig, fehler) {
    const bild = new Image();
    bild.onload = function () { fertig({ breite: bild.naturalWidth, hoehe: bild.naturalHeight }); };
    bild.onerror = function () { fehler(new Error('Could not read a receipt photo.')); };
    bild.src = adresse;
  });
}


// belege: die Belege, deren Fotos hinten angehängt werden (schon nach Nummer sortiert).
async function pdfErstellen(a, belege) {
  await skriptLaden(JSPDF_ADRESSE);
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });

  let y = 20;   // aktuelle Höhe auf der Seite

  // Neue Seite, wenn nicht mehr genug Platz ist.
  function platz(hoehe) {
    if (y + hoehe > UNTEN) {
      doc.addPage();
      y = 20;
    }
  }

  // Text so kürzen, dass er in die Breite passt (mit … am Ende).
  function kuerzen(text, breite) {
    text = String(text);
    if (doc.getTextWidth(text) <= breite) return text;
    while (text.length > 1 && doc.getTextWidth(text + '…') > breite) {
      text = text.slice(0, -1);
    }
    return text + '…';
  }

  function zeile(text, groesse, fett) {
    platz(6);
    doc.setFont('helvetica', fett ? 'bold' : 'normal');
    doc.setFontSize(groesse || 10);
    doc.text(text, RAND, y);
    y = y + (groesse ? groesse * 0.5 : 5);
  }

  // Spalten: x-Position links. Die letzte Spalte (Betrag) ist rechtsbündig an RECHTS.
  const SPALTEN = [RAND, RAND + 18, RAND + 45, RAND + 100];
  const BREITEN = [16, 25, 53, 52];

  function tabellenZeile(werte, fett) {
    platz(6);
    doc.setFont('helvetica', fett ? 'bold' : 'normal');
    doc.setFontSize(9);
    werte.forEach(function (wert, i) {
      if (wert === '' || wert === null || wert === undefined) return;
      if (i === werte.length - 1) {
        doc.text(String(wert), RECHTS, y, { align: 'right' });
      } else {
        doc.text(kuerzen(wert, BREITEN[i]), SPALTEN[i], y);
      }
    });
    y = y + 5;
  }

  function linie() {
    doc.setDrawColor(180);
    doc.line(RAND, y - 3.5, RECHTS, y - 3.5);
  }

  function block(titel, spalten, zeilen, summe) {
    y = y + 4;
    platz(20);
    zeile(titel, 12, true);
    doc.setTextColor(110);
    tabellenZeile(spalten, true);
    doc.setTextColor(0);
    linie();
    if (zeilen.length === 0) tabellenZeile(['None', '', '', '', '']);   // links, nicht in der Betragsspalte
    for (const werte of zeilen) tabellenZeile(werte);
    linie();
    tabellenZeile(['Subtotal', '', '', '', euro(summe)], true);
  }

  function nr(n) { return n === null ? '' : String(n); }

  // ---------- Seite 1 und folgende: die Abrechnung ----------
  zeile('Travel Expense Report', 18, true);
  y = y + 2;
  zeile('Name: ' + a.name);
  zeile('Period: ' + datum(a.von) + ' to ' + datum(a.bis));
  for (const r of a.reisen) {
    zeile(kuerzen(r.ziel + (r.grund ? ', ' + r.grund : '') + ': ' +
      datumZeit(r.start) + ' to ' + datumZeit(r.ende), RECHTS - RAND));
  }

  block('Business Meals', ['No.', 'Date', 'Merchant', 'Approved by', 'Amount'],
    a.bewirtung.zeilen.map(function (z) {
      return [nr(z.nummer), datum(z.datum), z.text, z.genehmigtVon + ', ' + datum(z.genehmigtAm), euro(z.betrag)];
    }), a.bewirtung.summe);

  block('Meal Allowance', ['Date', 'Trip', 'Day', 'Meals provided', 'Amount'],
    a.pauschale.zeilen.map(function (z) {
      return [datum(z.datum), z.ziel, z.art, z.gestellt || 'None', euro(z.betrag)];
    }), a.pauschale.summe);

  block('Hotel', ['No.', 'Date', 'Merchant', '', 'Amount'],
    a.hotel.zeilen.map(function (z) { return [nr(z.nummer), datum(z.datum), z.text, '', euro(z.betrag)]; }),
    a.hotel.summe);

  block('Travel Costs', ['No.', 'Date', 'Type', 'Merchant', 'Amount'],
    a.fahrt.zeilen.map(function (z) { return [nr(z.nummer), datum(z.datum), z.kategorie, z.text, euro(z.betrag)]; }),
    a.fahrt.summe);

  block('Extra Costs', ['No.', 'Date', 'Description', '', 'Amount'],
    a.extra.zeilen.map(function (z) {
      return [nr(z.nummer), z.datum ? datum(z.datum) : '', z.text, '', euro(z.betrag)];
    }), a.extra.summe);

  // Summen
  y = y + 6;
  platz(40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Total', RAND, y);
  doc.text(euro(a.gesamt), RECHTS, y, { align: 'right' });
  y = y + 6;
  doc.text('Less advance', RAND, y);
  doc.text(euro(-a.vorschuss), RECHTS, y, { align: 'right' });
  y = y + 2;
  doc.setDrawColor(0);
  doc.line(RAND + 100, y, RECHTS, y);
  y = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(a.auszahlung >= 0 ? 'Payout' : 'To pay back', RAND, y);
  doc.text(euro(a.auszahlung), RECHTS, y, { align: 'right' });

  // Ort, Datum, Unterschrift
  y = y + 14;
  platz(30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Place, date: ' + (a.ort ? a.ort + ', ' : '') + datum(a.heute), RAND, y);
  y = y + 20;
  doc.line(RAND + 100, y, RECHTS, y);
  doc.setFontSize(8);
  doc.text('Signature', RAND + 100, y + 4);

  // ---------- Danach: ein Beleg pro Seite ----------
  for (const beleg of belege) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const titel = 'Receipt No. ' + beleg.nummer + ': ' + (beleg.haendler || kategorieText(beleg.kategorie)) +
      ', ' + datum(beleg.datum) + ', ' + euro(beleg.betrag);
    doc.text(kuerzen(titel, RECHTS - RAND), RAND, 15);

    if (!beleg.foto) continue;
    const adresse = await alsDatenAdresse(beleg.foto);
    const groesse = await bildGroesse(adresse);

    // Foto so groß wie möglich in den Bereich 180 x 260 mm einpassen, Seitenverhältnis behalten.
    const maxBreite = RECHTS - RAND;
    const maxHoehe = 297 - 22 - 12;
    const faktor = Math.min(maxBreite / groesse.breite, maxHoehe / groesse.hoehe);
    const breite = groesse.breite * faktor;
    const hoehe = groesse.hoehe * faktor;
    const x = RAND + (maxBreite - breite) / 2;   // waagerecht in die Mitte
    doc.addImage(adresse, 'JPEG', x, 22, breite, hoehe);
  }

  return doc.output('blob');
}
