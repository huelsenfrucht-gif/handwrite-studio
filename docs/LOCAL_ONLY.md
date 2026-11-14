# Local-only Produktarchitektur

Handwrite Studio bleibt eine statisch ausgelieferte Progressive Web App. Es gibt
keinen Login, kein Nutzungsabo, kein Anfragekontingent und keinen
Inferenzserver. OCR, Stilprofil, Erzeugung, Editor, Speicherung und Export laufen
im Browser des jeweiligen Geräts.

## Verbindlicher Laufzeitpfad

1. Die Website und die versionierten Modell-Dateien werden wie normale statische
   Dateien geladen und vom Service Worker zwischengespeichert.
2. Das deutsche HTR-Modell erkennt die importierten Seiten mit ONNX Runtime
   WebAssembly lokal.
3. Ein kompaktes Sequenzmodell erzeugt vollständige Wörter als Folge von
   `(dx, dy, pressure, penUp)`-Werten. Es erzeugt keine Buchstabenbilder, die
   anschließend aneinandergereiht werden.
4. Das persönliche Stilprofil entsteht aus klaren Wortbildern und – optional,
   aber für echte Strichdynamik empfohlen – einem einmal geschriebenen
   Kalibrierungssatz.
5. Die Ausgabe bleibt Vektortinte für Editor, SVG und Goodnotes-Export.

## Harte Qualitätsregeln

- Kein Font-Fallback für ein persönliches Profil.
- Kein Zusammenkleben einzelner Buchstabenfragmente.
- Kein stiller Rückfall auf eine Demo-Schrift.
- Vor der Anzeige werden mehrere Kandidaten lokal mit der HTR erneut gelesen;
  ein unleserlicher Kandidat wird verworfen.
- Fehlt das lokale Generatormodell oder reicht der Speicher des Geräts nicht,
  erscheint eine klare Fehlermeldung. Die App zeigt dann keine falsche
  „persönliche Handschrift“ an.

## Modell- und Lizenzregel

Die Implementierung darf frei lizenzierte Laufzeitkomponenten übernehmen, aber
keine Forschungsgewichte aus IAM-OnDB oder andere nicht-kommerziell bzw.
unklar lizenzierte Checkpoints in die öffentliche Website einbauen. Das
Produktionsmodell wird aus kommerziell nutzbaren Daten trainiert und als
quantisierte ONNX-Datei ausgeliefert.

Der Laufzeitbetrieb ist dadurch unabhängig von Hugging Face, Modal, Replicate,
OpenAI oder anderen Inferenzanbietern. Hosting überträgt nur statische Dateien;
die Anzahl der Generierungen verursacht keine zusätzlichen Rechenkosten.

