# Handwrite Studio

Handwrite Studio erkennt Wörter aus fotografierten Notizseiten und erzeugt neue
Texte in einer daraus gelernten, realistischen Handschrift. Die Web-App benötigt
kein Benutzerkonto.

## Funktionsumfang

- Ordner-, Bild- und PDF-Import mit lokaler Seitensegmentierung und deutscher
  Handschrifterkennung im Browser.
- Sicherheitsstufen für OCR-Ergebnisse: klare Treffer werden vorausgewählt,
  unsichere Wörter bleiben zur Kontrolle sichtbar.
- Automatische Auswahl von bis zu fünf geeigneten Original-Wortbildern als
  Stilreferenzen. Einzelne Buchstaben müssen nicht mehrfach abgeschrieben werden.
- Neue, zusammenhängende Wortbilder über das offizielle
  [DiffusionPen](https://github.com/koninik/DiffusionPen)-Modell statt durch das
  Aneinanderreihen isolierter Zeichen.
- Dokumenteditor mit Linienpapier, Auswahl, Verschieben, Radieren, Stiftnotizen
  und Rückgängig/Wiederholen.
- PDF- und SVG-Export mit dem realistischen erzeugten Wortbild. Der native
  Goodnotes-Export verwendet eine aus dem Wortbild abgeleitete, radierbare
  Mittellinien-Annäherung.
- Lokale Dokument- und Profilspeicherung per IndexedDB sowie Sicherungsimport und
  -export.

## Architektur

Die React-/TypeScript-App führt OCR, Korrektur und Dokumentbearbeitung lokal im
Browser aus. Nur bei der Erzeugung neuer Wörter sendet sie den gewünschten Text
und höchstens fünf ausgewählte Wortausschnitte an den zustandslosen
DiffusionPen-Dienst. Der Dienst verarbeitet sie im Arbeitsspeicher, speichert sie
nicht und gibt transparente PNG-Wortbilder zurück. Es gibt weder Benutzerkonto
noch Datenbank.

Ohne konfigurierten Modellserver bleibt die lokale Erkennung und Bearbeitung
verfügbar; die realistische KI-Neuerzeugung benötigt jedoch den Dienst aus
`inference/`.

## Lokaler Start

Voraussetzung ist Node.js 22 oder neuer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Tests und Produktionsbuild:

```sh
npm test
npm run build
```

`VITE_SYNTHESIS_API` muss auf den HTTPS-Ursprung des Modellservers zeigen. Die
Einrichtung des Python-Dienstes ist in [`inference/README.md`](inference/README.md)
beschrieben.

## Datenschutz ohne Anmeldung

OCR und Seitenauswertung laufen lokal. Die importierten Originalseiten werden
nicht an den Modellserver geschickt. Für eine Worterzeugung übermittelt die App
nur den eingegebenen Text und höchstens fünf automatisch gewählte
Original-Wortausschnitte. Der mitgelieferte Dienst verarbeitet diese Daten
zustandslos und ohne Datenbank. Dokumente und das Handschriftprofil bleiben im
Browser, bis die lokalen Browserdaten gelöscht werden.

Für einen fremdbetriebenen Modellserver gelten zusätzlich dessen
Datenschutzbedingungen. Bei eigener Bereitstellung sollte kein Request-Logging
für Upload-Inhalte aktiviert werden.

## Qualität und Grenzen

Mit zwei echten deutschen Notizseiten wurden 367 Wortbilder verarbeitet: 182
klare Kandidaten wurden sicher vorausgewählt, 185 bewusst zur Prüfung gelassen
und kein Wort verursachte einen Verarbeitungsfehler. Der komplette Browserpfad
vom Originalausschnitt bis zu vier neu generierten, zusammenhängenden Wortbildern
wurde ebenfalls geprüft.

Handschrifterkennung bleibt grundsätzlich fehleranfällig; unsichere Wörter
müssen bestätigt oder korrigiert werden. Ein Foto enthält außerdem keine
ursprünglichen Stiftdruck- oder Zeitinformationen. Deshalb ist der
Goodnotes-Export eine editierbare Annäherung, während PDF und SVG die sichtbare
Modellausgabe erhalten.

## Drittanbieter

- DiffusionPen und die zugehörigen Gewichte: siehe `inference/NOTICE.md`.
- Goodnotes-Schreibansatz: siehe `docs/THIRD_PARTY_NOTICES.md`.
- Deutsches Kontextlexikon: siehe `public/models/de-lexicon/NOTICE.md`.
