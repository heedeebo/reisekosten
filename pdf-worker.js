// pdf-worker.js: Der Hintergrund-Helfer von pdf.js als eigene Datei der App.
// Wie bei ocr-worker.js: So kann der Service Worker (sw.js) ihn für offline speichern.

importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');
