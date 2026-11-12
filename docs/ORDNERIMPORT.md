# Ausbau: kompletter Ordnerimport

Aktueller Entwicklungsstand, noch nicht als vollständiger Ablauf veröffentlicht.

## Geprüfte Quellen

- Goodnotes-Oberfläche: https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface
- Referenzbild: https://support.goodnotes.com/hc/article_attachments/13850114631311
- Deutsches HTR-Modell: https://huggingface.co/naeyn/de-htr-web-v2
- Fest gepinnte Modellrevision: 6241c1ff0fd42725e0dc46fcd3217469cac851bb
- SHA256 model.onnx: b576a0a1281b9be46b2574028b75575e041b7d7cb650f063886e733467cc1499 (Download geprüft)

## Umgesetzt

Modell und Trainingsdaten-Attribution lokal abgelegt. ONNX-Web-Laufzeit und PDF.js installiert. Zeileninferenz vorbereitet, CTC-Dekodierung erhält Zeichenpositionen und Modellwahrscheinlichkeiten. Zwei Tests schützen wiederholte Buchstaben, Leerzeichen und ungültige Modell-Ausgaben.

## Nächste erforderliche Arbeiten

1. Ordner-, Mehrfachbild- und PDF-Auswahl; seitenweise Verarbeitung, Fortschritt, Abbrechen und Dateifehler.
2. Seiten in Textzeilen zerlegen, Papierlinien/Diagramme berücksichtigen, lange Zeilen trennen.
3. Modell tatsächlich im Browser mit echten deutschen Handschriftseiten ausführen und Transkriptionen vergleichen. Modellwahrscheinlichkeiten sind keine kalibrierten Korrektheitswahrscheinlichkeiten.
4. Erkannten Text über CTC-Zeitpositionen und Bilddaten auf Wort-Ausschnitte abbilden. Unsichere Erkennungen zur Korrektur anbieten; keine falschen Formen stillschweigend einlernen.
5. Ganze Wortzüge und Kontextfragmente in das vorhandene Profil übernehmen, neue Texte erzeugen und die Geometrie mit den Originalseiten vergleichen.
6. Goodnotes-nahe Bibliothek mit Dokumenttabs und zentraler Werkzeugleiste umsetzen und visuell mit der Referenz prüfen. Eigenen Produktnamen beibehalten.
7. Gesamtablauf auf mehreren Seiten, PDFs, Fotos, Fehlerfällen und mobilen Abmessungen testen. Öffentliche Bereitstellung ohne Anmeldung erhalten.

Kein Vollständigkeitsnachweis durch die bisherigen technischen Tests. Die Inferenzfunktion ist noch nicht an die Oberfläche angeschlossen; automatische Seitenerkennung und neue Oberfläche fehlen derzeit.
