# Handwritten – Arbeitsanleitung für KI-Assistenten (Codex, Claude & Co.)

Kanonisches Projekt für App und App Store: `/Users/hubertus/Entwicklung/handwrite-studio`. Ältere Kopien unter `Documents/Codex` sind keine Release-Quelle.

Diese Datei beschreibt den **aktuellen** Stand. Bei Widersprüchen zu älteren Dateien (z. B. `docs/`, `ADSENSE_SETUP.md`) gilt diese Datei.

## Was ist Handwritten?

Eine **iPad-App** (Capacitor + React + TypeScript, Querformat), die getippten Text in der eigenen Handschrift schreibt, Arbeitsblätter ausfüllt und Unterricht transkribiert. Dazu gehört eine **statische Info-Website**.

- Website (live): https://huelsenfrucht-gif.github.io/handwrite-studio/
- Repository: https://github.com/huelsenfrucht-gif/handwrite-studio (Branch `main`)
- Bundle-ID: `de.vonhuelsen.handwritten`, App-Name „Handwritten“, iOS ab 16.0
- Sprache der Nutzer: Deutsch (Hauptsprache), Englisch wählbar

## Verbindliche Produktregeln

1. **100 % kostenlos, nur durch Werbung finanziert** (Google AdMob). Kein Abo, keine In-App-Käufe, keine Bezahlversion.
2. **Werbung lässt sich nicht abschalten.** Vor dem Schreiben in Handschrift, vor dem Start einer Transkription, vor einer neuen Handschrift und beim Speichern/Laden einer Sicherung läuft eine Vollbild-Werbung (Interstitial) **ohne Auswahl** (`adBreak` in `src/AdChoice.tsx`). **Jede Werbung startet stumm** (`mute()` in `src/nativeAds.ts`, vor jeder Anzeige erneut) – die App wird im Unterricht genutzt. Keine Belohnungsvideos erzwingen: Google erlaubt sie nur, wenn der Nutzer sie freiwillig wählt. Es gibt keine werbefreie Zeit. Stufe 4/5 wird nach einer Anzeige freigeschaltet.
3. **Die App braucht eine Internetverbindung** (WLAN oder mobile Daten), damit Werbung geladen werden kann. Ohne Verbindung zeigt `src/OfflineGate.tsx` eine Sperre. Eine **laufende Aufnahme wird nie abgebrochen**, die Sperre kommt erst danach.
4. **Inhalte bleiben auf dem iPad:** Texte, Handschriften, Fotos und Aufnahmen werden nur auf dem Gerät verarbeitet, nichts wird hochgeladen. Einzige Downloads: Werbung (und Apples eigene Sprachpakete über das System).
5. **Keine Markennamen in der Oberfläche**, außer wo technisch nötig (Dateiformat „.goodnotes“ im Export mit Marken-Hinweis).
6. Werbung nie mitten beim Schreiben oder Aufnehmen, immer davor; immer ohne Ton.
7. Unter 16 (Schalter in den Einstellungen): nur nicht-personalisierte Werbung, keine Tracking-Abfrage.
8. Design „Graphit & Papier“: Tinte `#1c1d21`, Seitenleiste `#202125`, Papier `#f4f3ef`, Linien `#e2dfd8`/`#cfccc4`, gedämpfter Text `#6e6c66`, Markierung `#f6dc6b`/`#fbf3d2`, Aufnahme-Rot `#e5484d` (nur dafür). Serifen-Überschriften (`--hs-serif`). Neue Farben aus dieser Palette nehmen, keine Blau-/Grüntöne.
9. Immer im **iPad-Querformat** testen, Hochformat darf nicht kaputtgehen.

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `src/App.tsx` | Haupt-App: Studio (Text → Handschrift), Arbeitsblätter, Export, Modals. Sehr lange Zeilen. Übersetzungsfunktion heißt dort `tr()`. |
| `src/Library.tsx` | Startseite/Bibliothek: Seitenleiste, Ordner (Name/Farbe oben auf der Ordnerseite), Drag & Drop (gedrückt halten), Menüs |
| `src/LectureSheet.tsx` | Transkribieren: Startfenster, Live-Ansicht, Ergebnis („Neu erkennen“, Tonaufnahme löschen) |
| `src/lecture.ts` | Typen und Capacitor-Plugin-Schnittstelle `LectureRecorder` |
| `src/LevelSheet.tsx`, `src/Training.tsx`, `src/levels.ts` | Handschrift-Einrichtung in 5 Stufen. Nach jeder Stufe geht es ins Stufenmenü, nicht ins Studio. |
| `src/SettingsSheet.tsx` | Einstellungen (Bereichsleiste links, Sprache, Sicherung, Werbung) |
| `src/OfflineGate.tsx` | Internet-Pflicht (Capacitor Network) |
| `src/nativeAds.ts` | AdMob: IDs, Einwilligung, Interstitial, Rewarded. **Noch Googles Test-IDs** – vor Veröffentlichung eigene IDs eintragen (+ `GADApplicationIdentifier` in `ios/App/App/Info.plist`). |
| `src/i18n.ts`, `src/i18n.en.ts` | Übersetzung (siehe unten) |
| `src/engine.ts` | Layout der Handschrift (Glyphen, Zeilen, Tabellen, Arbeitsblatt-Felder) |
| `src/storage.ts` | IndexedDB-Speicher + Prüfung von Sicherungen (Obergrenzen großzügig, Sicherungen bis 500 MB) |
| `src/theme.css` | Aktuelles Design (spätere Regeln überschreiben frühere; neue Regeln ans Ende) |
| `ios/App/App/LectureRecorder.swift` | Native Aufnahme + Spracherkennung (Apple SpeechAnalyzer/SFSpeech), Mikrofonwahl (Rückseite, Richtwirkung), VoiceLift, Ablage |
| `ios/App/App/*.lproj/InfoPlist.strings` | Berechtigungstexte Deutsch/Englisch |
| `ios/App/App/HandwriteNativePlugin.swift` | Apple-Texterkennung (Vision) für Fotos von Text und Tafelbildern |
| `ios/App/ShareExtension/` | „Teilen mit Handwritten“ aus der Fotos-App |
| `src/goodnotes.ts` | Export als .goodnotes-Datei (Schrift als bearbeitbare Stiftstriche) |
| `site/` | Statische Website (index, datenschutz, impressum, nutzungsbedingungen, support, lizenzen) |
| `tests/` | Vitest-Tests |

## Übersetzung (Deutsch/Englisch)

- Texte stehen **auf Deutsch im Code** und werden mit `t('…')` (in `App.tsx`: `tr('…')`) übersetzt. Platzhalter: `t('{n} Dokumente', { n })`.
- Englisch steht in `src/i18n.en.ts`, Schlüssel = deutscher Originaltext. **Jeder neue sichtbare Text braucht einen Eintrag dort** (auch `aria-label`, `title`, `placeholder`, `confirm()`-Texte).
- Einzahl/Mehrzahl als zwei eigene Texte (`'1 Absatz'` / `'{n} Absätze'`).
- Datum/Zahlen mit `locale()` aus `i18n.ts`, nie fest `'de-DE'`.
- Nie angezeigte Texte vergleichen (z. B. `status.includes('fehl')`), sondern Zustände.
- Sprachwechsel: Einstellungen → Sprache, App lädt neu (`localStorage` `hs-lang`).
- Fehlermeldungen aus Swift sind deutsch; die Oberfläche übersetzt sie über `t(message)`. Neue Swift-Meldungen also auch in `i18n.en.ts` eintragen.

## Befehle

```bash
npm install
npm test                 # Vitest, muss grün bleiben
npx tsc --noEmit -p .    # Typprüfung
npm run dev              # Browser-Vorschau (ohne native Funktionen)
npm run build && npx cap sync ios   # Web-Teil bauen und ins iOS-Projekt kopieren
```

iOS (Xcode muss installiert sein, Projekt `ios/App/App.xcodeproj`, Scheme `App`):

```bash
# Simulator (UDID mit `xcrun simctl list devices` finden)
cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'id=<SIMULATOR-UDID>' -derivedDataPath build/DDsim build
xcrun simctl install <SIMULATOR-UDID> build/DDsim/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch <SIMULATOR-UDID> de.vonhuelsen.handwritten

# Echtes iPad (ID mit `xcrun devicectl list devices` finden)
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'id=<IPAD-ID>' -derivedDataPath build/DD -allowProvisioningUpdates build
xcrun devicectl device install app --device <IPAD-ID> build/DD/Build/Products/Debug-iphoneos/App.app
```

Swift-Pakete: nur die Capacitor-Plugins über `CapApp-SPM`. Nach `npm install` eines Capacitor-Plugins immer `npx cap sync ios`.

## Website veröffentlichen

Jeder Push auf `main` startet `.github/workflows/pages.yml`: `npm ci`, `npm test`, dann wird der Ordner `site/` auf GitHub Pages veröffentlicht. **Schlagen die Tests fehl, wird die Website nicht aktualisiert.** Screenshots liegen in `site/img/` (1600 px breit, JPEG ~80 %, aus dem iPad-Simulator im Querformat).

## Arbeitsweise

- Kleine, gezielte Änderungen; vorhandene Stile und Muster weiterverwenden.
- Nach Änderungen: `npx tsc --noEmit -p .` und `npm test`, Oberfläche im Simulator (Querformat) ansehen.
- Commits auf Deutsch, aussagekräftig. `.claude/launch.json` nie committen (lokale Pfade).
- Rechtstexte sind vollständig: Anbieter ist die **pvh debt capital advisory GmbH** (Frankfurt am Main), Kontakt `kontakt@handwritten-app.de`. Impressum, Datenschutz, Nutzungsbedingungen und Hilfe liegen in `site/` und sind in der App unter Einstellungen verlinkt (`SITE` in `src/SettingsSheet.tsx`). Inhaltliche Änderungen an diesen Texten nur nach Rücksprache.

## Wie der Projektinhaber arbeitet

- Kommuniziert auf **Deutsch**, oft per Spracheingabe (Tippfehler sind normal). Antworten auf Deutsch, klar und ohne Fachchinesisch.
- Nutzt ein **iPad Pro (M1) im Querformat** mit Apple Pencil. Zielgruppe: Schülerinnen und Schüler (Bedienung muss ein Siebtklässler verstehen).
- Erwartet gründliche, fertige Arbeit: selbst testen (Simulator, Screenshots), nicht nur Code ändern.
- **Committen und pushen nur nach ausdrücklicher Zustimmung.** Am Ende einer Aufgabe kurz zusammenfassen und fragen.
- Ändert sich die Oberfläche sichtbar, gehören **neue Website-Screenshots** dazu (`site/img/`).
- Mag ruhiges, professionelles Design (Vorbild: GoodNotes, Notes-Apps), keine überladenen Ansichten; Einstellungen lieber zum Ausklappen.

## Datenmodell (kurz)

- `Library` (`src/model.ts`), gespeichert in IndexedDB (`src/storage.ts`, Schlüssel `current` und `last-good`):
  - `notes: Note[]` – Dokument mit `text` (Eingabe), `renderedText` (geschrieben), `settings` (Schrift, Papier, Ränder, `profileId`), `edits` (verschobene/gelöschte Buchstaben), `annotations`, `drawings`, `fields` (Arbeitsblatt-Felder), `folderId`, `favorite`.
  - `folders: Folder[]` – `parentId` für Unterordner, `color`.
  - `profiles: Profile[]` – eine Handschrift: `glyphs` (Buchstabe → Varianten aus Strichen), `pairs` (Buchstabenverbindungen, Stufe 4/5), `rhythm` (Stufe 3), `words`, `unlocked` (Stufe 4/5 per Video).
  - `templates` – eigene Papiervorlagen/Arbeitsblätter als Bilder (Data-URLs).
  - `deleted` – Löschmarken (für Abgleich), `defaults` – Voreinstellungen für neue Dokumente.
- Sicherung = diese `Library` als `.handwrite.json`.
- Transkripte liegen **nicht** in der Library, sondern nativ in `Documents/Lectures/<id>.json` + `<id>.m4a` (siehe `LectureStore` in Swift). Tonaufnahmen werden nach Übernehmen/Exportieren gelöscht, sonst nach 7 Tagen; der Text bleibt.
- Kleine Vorlieben in `localStorage` (`hs-lang`, `hs-tr-locale`, `hs-tr-room`, `hs-tr-subject`, `hs-tr-live`, `hs-filter`, `hs-sort`, `hs-layout`, `hs-under16`, `hs-ad-free-until`).

## Native Schnittstellen (Capacitor-Plugins)

- `LectureRecorder` (`ios/App/App/LectureRecorder.swift`, TS-Typen in `src/lecture.ts`):
  `availability`, `requestAccess`, `start({locale, room, subject, terms, live})`, `pause`, `resume`, `mark`, `stop`, `current`, `saved`, `transcribeAudio` (ganze Aufnahme neu erkennen, Apple), `setTopic({id, topic})` (Thema im gespeicherten Transkript), `remove({id, audioOnly})`. Live-Updates per Event.
- `HandwriteNative` (`HandwriteNativePlugin.swift`, `src/native.ts`): `recognizeText`, `recognizeDocument` (Vision), `takeSharedImages` (Share-Extension).
- Community-Plugins: `@capacitor-community/admob`, `@capacitor/network`, `@capacitor/filesystem`, `@capacitor/share`.

## Wichtige Entscheidungen (und warum)

- **„Genau erkennen“ (Whisper large-v3 über WhisperKit) wurde entfernt:** Das große Modell brachte das iPad (M1) zum Absturz bzw. an die Speichergrenze. Die App löscht ein früher geladenes Modell beim Start (`Application Support/Whisper`). Nicht wieder einbauen, ohne es auf einem echten iPad mit langen Aufnahmen getestet zu haben. Parakeet (FluidAudio) wurde verworfen, weil es auf Deutsch keine Satzzeichen liefert.
- **Mikrofon im Klassenraum:** Das iPad liegt mit dem Bildschirm zum Schüler; aufgenommen wird über das rückseitige Mikrofon mit Richtwirkung nach vorne, ohne System-Sprachaufbereitung (`.measurement`), Pegel per `VoiceLift`.
- **Fachbegriffe** je Fach (`src/subjects.ts`) helfen der Erkennung, nur bei deutscher Aufnahmesprache.
- **Arbeitsblätter:** Text steht auf der gedruckten Antwortlinie (Grundlinie unten im Feld), Tabellenzellen mittig.
- **Übersetzung mit deutschen Schlüsseln** statt IDs, damit der Code lesbar bleibt.

## Testen – praktische Tipps

- Browser: `npm run dev` (Vite, Adresse steht in der Ausgabe). Nicht verfügbar: Transkribieren, Werbung, Vision. `?offline` zeigt die Internet-Sperre, `?ads` simuliert Werbestellen (nur im Dev-Modus).
- Englisch testen: in der Browser-Konsole `localStorage.setItem('hs-lang','en'); location.reload()`. Fehlende Übersetzungen erscheinen im Dev-Modus als `[i18n] missing:` in der Konsole.
- Simulator: Screenshots mit `xcrun simctl io <UDID> screenshot datei.png` (kommen im Querformat). Logs: `xcrun simctl launch --console-pty <UDID> de.vonhuelsen.handwritten`; native Meldungen beginnen mit `[Transkribieren]`.
- Werbung im Simulator/Debug: Googles Test-Anzeigen („Test mode“), schließen über das X oben rechts.
- Codex in der Cloud (Linux) kann `npm test`, `tsc` und den Web-Build ausführen, aber **keine iOS-Builds** – dafür braucht es einen Mac mit Xcode.

## Bekannte Probleme / Ideen

- Die schnelle Apple-Erkennung nach einer Aufnahme ohne Live-Text lieferte im Simulator keinen Text – auf echtem iPad prüfen.
- Lange Zeilen in `App.tsx` erschweren Änderungen; bei größeren Umbauen gern in Komponenten aufteilen (Verhalten unverändert lassen, Tests grün halten).
- Die Website ist nur auf Deutsch.

## Offene Punkte

- Eigene AdMob-IDs eintragen (aktuell Test-Anzeigen).
- Domain www.handwritten-app.de mit GitHub Pages verbinden, danach `SITE` in der App und die URLs in `appstore/APP-STORE.md` umstellen.
- Apple-Entwicklerkonto als Organisation (D-U-N-S) anlegen, Händlerstatus (EU) angeben.
- App-Store-Veröffentlichung (Texte und Screenshots in `appstore/`, Rechtsprüfung in `appstore/RECHTSPRUEFUNG.md`).
- Transkribieren im echten Klassenraum weiter testen (Mikrofon über die Rückseite).
- Internet-Sperre im Flugmodus auf dem echten iPad prüfen.
