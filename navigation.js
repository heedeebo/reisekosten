// navigation.js: Tab-Leiste unten und kleine Symbole.
//
// 1. Baut auf jeder Seite unten eine Leiste mit vier Bereichen:
//    Trips, Scan (Beleg), Report (Abrechnung), Settings.
//    Mit dem Daumen gut erreichbar, wie in vielen iPhone-Apps.
// 2. Ersetzt im HTML jedes <span data-symbol="kamera"></span> durch das passende Symbol.
//
// Die Symbole sind SVG: kleine Bilder aus Linien, beschrieben als Text.
// "M4 8h3" heißt zum Beispiel: gehe zu Punkt (4|8), zeichne 3 nach rechts.
// Gezeichnet wird auf einer Fläche von 24 x 24.

const SYMBOLE = {
  koffer: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  kamera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  dokument: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  regler: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  datei: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14l3 3 3-3"/>',
  tabelle: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  stift: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  zuschnitt: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>'
};


// Gibt ein Symbol als SVG-Text zurück. Die Farbe kommt vom Text drumherum (currentColor).
function symbol(name) {
  return '<svg class="symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SYMBOLE[name] || '') + '</svg>';
}


// Platzhalter im HTML durch Symbole ersetzen
function symboleEinsetzen() {
  for (const platz of document.querySelectorAll('[data-symbol]')) {
    platz.outerHTML = symbol(platz.dataset.symbol);
  }
}


// Tab-Leiste bauen
function tabLeisteBauen() {
  // Welche Seite ist offen? location.pathname ist z. B. "/reisekosten/reise.html"
  const seite = location.pathname.split('/').pop() || 'index.html';
  const bereich = {
    'index.html': 'trips', 'reise.html': 'trips', 'reise-bearbeiten.html': 'trips',
    'beleg.html': 'scan', 'abrechnung.html': 'report', 'einstellungen.html': 'settings'
  }[seite];

  const tabs = [
    { id: 'trips', text: 'Trips', ziel: 'index.html', symbol: 'koffer' },
    { id: 'scan', text: 'Scan', ziel: 'beleg.html', symbol: 'kamera' },
    { id: 'report', text: 'Report', ziel: 'abrechnung.html', symbol: 'dokument' },
    { id: 'settings', text: 'Settings', ziel: 'einstellungen.html', symbol: 'regler' }
  ];

  const leiste = document.createElement('nav');
  leiste.className = 'tab-leiste';
  leiste.setAttribute('aria-label', 'Main');
  for (const tab of tabs) {
    const link = document.createElement('a');
    link.className = 'tab' + (tab.id === 'scan' ? ' tab-scan' : '');
    link.href = tab.ziel;
    // Beim Scan-Knopf steckt das Symbol in einem blauen Kreis
    link.innerHTML = (tab.id === 'scan' ? '<span class="symbol-kreis">' + symbol(tab.symbol) + '</span>'
      : symbol(tab.symbol)) + '<span>' + tab.text + '</span>';
    // aria-current sagt Bildschirmlesern (und unserem CSS), wo man gerade ist
    if (tab.id === bereich) link.setAttribute('aria-current', 'page');
    leiste.appendChild(link);
  }
  document.body.appendChild(leiste);

  // Platzhalter am Ende der Seite, genau so hoch wie die Leiste plus etwas Luft.
  // Die Leiste liegt über der Seite. Ohne diesen Platz könnte man das Ende
  // der Seite (z. B. "Delete Receipt") nie unter der Leiste hervorholen.
  // Wir messen die echte Höhe der Leiste, weil sie auf jedem iPhone anders ist
  // (der Balken unten am Bildschirm ist unterschiedlich hoch).
  const platz = document.createElement('div');
  platz.className = 'leiste-platz';
  document.body.insertBefore(platz, leiste);
  function platzAnpassen() {
    platz.style.height = (leiste.getBoundingClientRect().height + 32) + 'px';
  }
  platzAnpassen();
  // Nochmal messen, wenn sich die Größe ändert (Drehen, Tastatur) und kurz nach dem Laden.
  window.addEventListener('resize', platzAnpassen);
  setTimeout(platzAnpassen, 500);
}


symboleEinsetzen();
tabLeisteBauen();


// Tastatur offen? Dann Tab-Leiste ausblenden (siehe style.css, body.tippt).
// focusin passiert, wenn ein Feld angetippt wird, focusout, wenn man es verlässt.
function istEingabe(element) {
  return element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') &&
    element.type !== 'checkbox' && element.type !== 'file';
}
document.addEventListener('focusin', function (ereignis) {
  if (istEingabe(ereignis.target)) document.body.classList.add('tippt');
});
document.addEventListener('focusout', function () {
  // Kurz warten: Springt man direkt ins nächste Feld, bleibt die Leiste weg.
  setTimeout(function () {
    if (!istEingabe(document.activeElement)) document.body.classList.remove('tippt');
  }, 100);
});
