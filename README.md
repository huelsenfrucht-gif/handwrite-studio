# Handwrite Studio

React-/TypeScript-Web-App für persönliche Handschrift als bearbeitbare Vektorstriche.

## Start

Node.js 22 oder neuer. `npm ci`, dann `npm run dev`. Produktionsbuild: `npm run build`; Tests: `npm test`.

## Funktionsumfang

- Zusammenhängende Wortproben per Stift oder Foto aufnehmen, beschriften und analysieren.
- Fotovektorisierung mittels Schwellwert, Skelettierung und Pfadverfolgung. Buchstabengrenzen sind korrigierbar.
- Bekannte Wörter behalten ihre ursprüngliche Geometrie. Neue Wörter verwenden bevorzugt lange gelernte Wortteile und kontextbezogene Formen. Fragmentübergänge werden angenähert.
- Dokumente, lokale IndexedDB-Speicherung, Sicherungsimport/-export, Auswahl, Verschieben, Radieren einzelner Striche, zusätzliche Stiftnotizen und Rückgängig/Wiederholen.
- Mehrseitiger Vektor-PDF-Export, SVG-Export der aktuellen Seite, Papier- und Stifteinstellungen.
- PWA mit lokalem Offline-Cache nach vollständigem ersten Laden.

## Grenzen und noch offene Abnahme

Diese Implementierung ist ein geometrisches, beispielbasiertes Verfahren, kein neuronal trainierter Handschrift-Klon. Die persönlichen Realismus-Anforderungen sind noch nicht mit echten Schreibproben des Nutzers überprüft. Neue Wortkombinationen können sichtbare Übergänge enthalten. Die automatische Transkription kompletter freier Notizseiten ist nicht implementiert: Wörter werden ausgewählt und manuell zugeordnet. Druck und Schreibreihenfolge lassen sich aus Fotos nicht rekonstruieren; die Ausgabe verwendet eine konstante Strichstärke.

PDF-Inhalte werden in Goodnotes nicht zu nativen radierbaren Stiftstrichen. Ein nativer `.goodnotes`-Export ist nicht implementiert. Siehe https://support.goodnotes.com/hc/en-us/articles/7353717816463-Import-files-into-Goodnotes .

## Speicherung und Supabase

Ohne Konfiguration bleiben Daten lokal im Browser. Fotos werden nicht dauerhaft gespeichert oder hochgeladen. Regelmäßig die Studio-Sicherung herunterladen, insbesondere vor dem Löschen von Browserdaten.

Optional eigene Supabase-Instanz einrichten, `supabase.sql` ausführen und `.env.example` als `.env.local` mit URL und öffentlichem Anon-Key ausfüllen. Niemals Service-Role-Schlüssel im Frontend verwenden. Die optionale Cloud-Funktion erstellt ausdrücklich ausgelöste Gesamtsicherungen, keine automatische konfliktauflösende Synchronisierung. Die Cloud-Funktion ist ohne eine eingerichtete Instanz nicht end-to-end geprüft.

## Prüfungen

16 automatisierte Tests prüfen Geometrieerhalt, Wiederverwendung zusammenhängender Fragmente, Seitenumbrüche, reproduzierbare Erzeugung, fehlende Zeichen, Radieren/Verschieben, Foto-Skelettierung, Sicherungsvalidierung und mehrseitige Vektor-PDF-Ausgabe. Browserprüfungen umfassen Stifteingabe, Fototraining mit synthetischem Bild, Speicherung nach Neuladen und PDF-Download. Diese Prüfungen belegen keine persönliche Schriftähnlichkeit und ersetzen keinen Test auf echter iPad-/Apple-Pencil-Hardware.
