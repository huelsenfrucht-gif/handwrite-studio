# Handwrite Studio

Handwrite Studio ist eine lokale Progressive Web App: Sie erkennt Wörter aus
fotografierten Notizseiten und erstellt bearbeitbare Dokumente aus persönlicher
Handschrift. Die Website benötigt kein Konto.

## Verbindliches Produktmodell

- Jeder kann die öffentliche Website ohne Anmeldung und ohne Nutzungslimit
  verwenden.
- OCR, Stilprofil, Handschrifterzeugung, Speicherung und Export laufen auf dem
  Gerät des Besuchers.
- Es gibt keinen Inferenzserver, keine API-Schlüssel, kein GPU-Tageskontingent
  und keine Zahlung pro Generierung.
- Beim ersten Besuch werden App und Modell als statische Dateien geladen; der
  Service Worker speichert sie anschließend für die Offline-Nutzung.

## Funktionsumfang

- Ordner-, Bild- und PDF-Import mit lokaler Seitensegmentierung und deutscher
  Handschrifterkennung über ONNX Runtime WebAssembly.
- Sicherheitsstufen für OCR-Ergebnisse: klare Treffer werden vorausgewählt,
  unsichere Wörter bleiben zur Kontrolle sichtbar.
- Auswahl geeigneter Original-Wortbilder als Stilreferenzen. Einzelne
  Buchstaben müssen nicht mehrfach abgeschrieben werden.
- Dokumenteditor mit Linienpapier, Auswahl, Verschieben, Radieren,
  Stiftnotizen und Rückgängig/Wiederholen.
- PDF-, SVG- und experimenteller Goodnotes-Export.
- Lokale Dokument- und Profilspeicherung per IndexedDB sowie
  Sicherungsimport und -export.

## Handschriftgenerator

Der Browser-Laufzeitpfad für ein quantisiertes ONNX-Sequenzmodell ist
implementiert. Sein Vertrag ist unter [docs/LOCAL_ONLY.md](docs/LOCAL_ONLY.md)
dokumentiert: Text und Stilbilder hinein, echte Strichfolgen mit Druck und
Stiftheben hinaus. Pro Wort werden drei Kandidaten lokal erzeugt und durch die
lokale HTR erneut gelesen; die lesbarste Variante wird verwendet.

Das rechtlich freigegebene Produktionsgewicht ist noch nicht im Repository.
Solange es fehlt, verweigert die App die Neuerzeugung ausdrücklich. Sie fällt
nicht auf die alte, unleserliche Buchstaben-Zusammensetzung zurück.

Öffentlich verfügbare Graves-/IAM-Gewichte werden nicht eingebaut: Die
zugehörigen Trainingsdaten beziehungsweise Checkpoints sind nicht für eine
kommerzielle, öffentliche App freigegeben. Das finale Gewicht muss aus
kommerziell nutzbaren Daten trainiert und anschließend als
`public/models/handwriting-gen/model.onnx` eingebunden werden.

## Lokaler Start

Voraussetzung ist Node.js 22 oder neuer.

```sh
npm ci
npm run dev
```

Tests und Produktionsbuild:

```sh
npm test
npm run build
```

## Datenschutz

Importierte Seiten, Texte, Stilbilder und Dokumente verlassen den Browser
nicht. Es existieren keine Nutzerkonten und keine Inhaltsdatenbank. Eine
Studio-Sicherung kann manuell heruntergeladen und auf ein anderes Gerät
übertragen werden.

## Qualität und Grenzen

Ein Foto enthält keine ursprüngliche Stiftreihenfolge, Geschwindigkeit oder
Druckwerte. Diese Daten können nur durch eine direkt geschriebene
Kalibrierungsprobe zuverlässig erfasst werden. Das lokale Generatormodell
erzeugt deshalb vollständige Wortbewegungen; es klebt keine isolierten
Buchstabenbilder zusammen.

## Drittanbieter

- Goodnotes-Schreibansatz: [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md)
- Deutsches Kontextlexikon:
  [public/models/de-lexicon/NOTICE.md](public/models/de-lexicon/NOTICE.md)

## iOS-App (Xcode)

Die Web-App ist mit [Capacitor](https://capacitorjs.com) als native iOS-App verpackt (`ios/`).

```bash
npm run ios        # Web-App bauen, nach ios/ kopieren und Xcode öffnen
npm run ios:sync   # nur bauen und kopieren
```

In Xcode unter *Signing & Capabilities* das eigene Team wählen und bei Bedarf die
Bundle-ID (`com.handwritestudio.app`) ändern, dann auf dem iPad oder im Simulator starten.
In der App werden Exporte über das iOS-Teilen-Menü geöffnet (z. B. „In Goodnotes öffnen“).
