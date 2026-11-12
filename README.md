# Handwrite Studio

React-/TypeScript-Web-App für persönliche Handschrift als bearbeitbare Vektorstriche.

## Start

Node.js 22 oder neuer. `npm ci`, dann `npm run dev`. Produktionsbuild: `npm run build`; Tests: `npm test`.

## Funktionsumfang

- Zusammenhängende Wortproben per Stift oder Foto aufnehmen, beschriften und analysieren.
- Fotovektorisierung mittels Schwellwert, Skelettierung und Pfadverfolgung. Buchstabengrenzen sind korrigierbar.
- Bekannte Wörter behalten ihre ursprüngliche Geometrie. Neue Wörter verwenden bevorzugt lange gelernte Wortteile und kontextbezogene Formen. Fragmentübergänge werden anhand der beobachteten Strichrichtungen angenähert.
- Dokumente, lokale IndexedDB-Speicherung, Sicherungsimport/-export, Auswahl, Verschieben, Radieren einzelner Striche, zusätzliche Stiftnotizen und Rückgängig/Wiederholen.
- Nativer `.goodnotes`-Export mit radierbaren Tintenstrichen sowie mehrseitiger Vektor-PDF-Export, SVG-Export der aktuellen Seite, Papier- und Stifteinstellungen.
- PWA mit lokalem Offline-Cache nach vollständigem ersten Laden.
- Keine Anmeldung erforderlich: Die App startet direkt und speichert standardmäßig lokal im Browser.

## Grenzen und noch offene Abnahme

Diese Implementierung ist ein geometrisches, beispielbasiertes Verfahren, kein neuronal trainierter Handschrift-Klon. Die persönlichen Realismus-Anforderungen sind noch nicht mit echten Schreibproben des Nutzers überprüft. Neue Wortkombinationen können sichtbare Übergänge enthalten. Die automatische Transkription kompletter freier Notizseiten ist nicht implementiert: Wörter werden ausgewählt und manuell zugeordnet. Druck und Schreibreihenfolge lassen sich aus Fotos nicht rekonstruieren; die Ausgabe verwendet eine konstante Strichstärke.

Der `.goodnotes`-Export schreibt Handschrift und Zeichnungen als native, radierbare Tintenstriche in ein rückentwickeltes Dateiformat. Da die verwendete, unabhängig geprüfte Vorlage jeweils eine Seite enthält, werden mehrseitige Dokumente als ZIP mit einer `.goodnotes`-Datei pro Seite ausgegeben. PDF bleibt die stabile Wahl zum Teilen und Drucken; PDF-Inhalte sind nach dem Goodnotes-Import nicht als einzelne Tintenstriche radierbar. Der Goodnotes-Export basiert auf dem MIT-lizenzierten Inkly-Ansatz; siehe `docs/THIRD_PARTY_NOTICES.md`.

## Speicherung ohne Konto

Alle Daten bleiben lokal im Browser. Fotos werden nicht dauerhaft gespeichert oder hochgeladen. Es gibt derzeit weder Anmeldung noch Konto. Regelmäßig die Studio-Sicherung herunterladen, insbesondere vor dem Löschen von Browserdaten.

## Prüfungen

27 automatisierte Tests prüfen Geometrieerhalt, Wiederverwendung zusammenhängender Fragmente, Seitenumbrüche, reproduzierbare Erzeugung, fehlende Zeichen, Radieren/Verschieben, Foto-Skelettierung, Sicherungsvalidierung, mehrseitige Vektor-PDF-Ausgabe und die Struktur nativer Goodnotes-Dateien. Browserprüfungen umfassen Stifteingabe, Fototraining mit synthetischem Bild, Speicherung nach Neuladen sowie PDF- und `.goodnotes`-Downloads. Der erzeugte Goodnotes-Download wurde zusätzlich mit einem unabhängigen Parser gelesen; alle 1.156 Teststriche hatten konsistente Punkt- und Segmentzähler. Diese Prüfungen belegen keine persönliche Schriftähnlichkeit und ersetzen keinen Test auf echter iPad-/Apple-Pencil-Hardware.
