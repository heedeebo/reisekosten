// ocr-worker.js: Der Hintergrund-Helfer der Texterkennung.
//
// Tesseract.js startet normalerweise einen Helfer direkt aus dem Internet.
// Für offline brauchen wir den Helfer als eigene Datei in der App, damit der
// Service Worker (sw.js) ihn und alles, was er nachlädt, aus dem Speicher liefern kann.
// importScripts lädt das eigentliche Programm von Tesseract.js dazu.

importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js');
