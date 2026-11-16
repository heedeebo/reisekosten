// summen.js: Summen einer Reise. Startseite, Reise-Seite und später die Abrechnung
// rechnen alle hiermit, damit überall dieselben Zahlen stehen.
// Braucht: tage.js, pauschale.js, kategorien.js


// Verpflegungspauschale der ganzen Reise (alle Tage, mit gestellten Mahlzeiten).
function pauschaleSumme(reise) {
  let summe = 0;
  for (const tag of reiseTage(reise.start, reise.ende)) {
    const gestellt = (reise.mahlzeiten && reise.mahlzeiten[tag.datum]) || {};
    summe = summe + tagesPauschale(tag, gestellt).betrag;
  }
  return aufCent(summe);
}


// Summe der Belege.
function belegeSumme(belege) {
  let summe = 0;
  for (const beleg of belege) {
    summe = summe + beleg.betrag;
  }
  return aufCent(summe);
}


// Gesamtsumme einer Reise: Pauschale plus Belege.
// belege = alle Belege (die App sucht sich die passenden selbst heraus).
function reiseSumme(reise, belege) {
  const eigene = belege.filter(function (b) { return b.reiseId === reise.id; });
  return aufCent(pauschaleSumme(reise) + belegeSumme(eigene));
}
