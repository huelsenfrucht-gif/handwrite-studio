# Handwritten – Arbeitsanleitung für KI-Assistenten (Codex, Claude & Co.)

Diese Datei beschreibt den **aktuellen** Stand. Bei Widersprüchen zu älteren Dateien (z. B. `docs/`, `ADSENSE_SETUP.md`) gilt diese Datei.

## Was ist Handwritten?

Eine **iPad-App** (Capacitor + React + TypeScript, Querformat), die getippten Text in der eigenen Handschrift schreibt, Arbeitsblätter ausfüllt und Unterricht transkribiert. Dazu gehört eine **statische Info-Website**.

- Website (live): https://huelsenfrucht-gif.github.io/handwrite-studio/
- Repository: https://github.com/huelsenfrucht-gif/handwrite-studio (Branch `main`)
- Bundle-ID: `com.handwritestudio.app`, App-Name „Handwritten“, iOS ab 16.0
- Sprache der Nutzer: Deutsch (Hauptsprache), Englisch wählbar

## Verbindliche Produktregeln

1. **100 % kostenlos, nur durch Werbung finanziert** (Google AdMob). Kein Abo, keine In-App-Käufe, keine Bezahlversion.
2. **Werbung lässt sich nicht abschalten.** Es gibt keinen Schalter dafür. Einzige „Belohnung“: Ein freiwillig angesehenes Video gibt 30 Minuten ohne Werbung und schaltet Handschrift-Stufe 4/5 einmalig frei. Das Video muss freiwillig bleiben.
3. **Die App braucht eine Internetverbindung** (WLAN oder mobile Daten), damit Werbung geladen werden kann. Ohne Verbindung zeigt `src/OfflineGate.tsx` eine Sperre. Eine **laufende Aufnahme wird nie abgebrochen**, die Sperre kommt erst danach.
4. **Inhalte bleiben auf dem iPad:** Texte, Handschriften, Fotos und Aufnahmen werden nur auf dem Gerät verarbeitet, nichts wird hochgeladen. Einzige Downloads: das Whisper-Sprachmodell (einmalig, Hugging Face) und Werbung.
5. **Keine Markennamen in der Oberfläche**, außer wo technisch nötig (Dateiformat „.goodnotes“ im Export mit Marken-Hinweis).
6. Werbung nie mitten beim Schreiben oder Aufnehmen. Werbestellen: vor „In Handschrift verwandeln“ (wahlweise kurzes Video), vor dem Start einer Transkription, vor einer neuen Handschrift, beim Speichern/Laden einer Sicherung.
7. Unter 16 (Schalter in den Einstellungen): nur nicht-personalisierte Werbung, keine Tracking-Abfrage.
8. Design „Graphit & Papier“: Tinte `#1c1d21`, Seitenleiste `#202125`, Papier `#f4f3ef`, Linien `#e2dfd8`/`#cfccc4`, gedämpfter Text `#6e6c66`, Markierung `#f6dc6b`/`#fbf3d2`, Aufnahme-Rot `#e5484d` (nur dafür). Serifen-Überschriften (`--hs-serif`). Neue Farben aus dieser Palette nehmen, keine Blau-/Grüntöne.
9. Immer im **iPad-Querformat** testen, Hochformat darf nicht kaputtgehen.

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `src/App.tsx` | Haupt-App: Studio (Text → Handschrift), Arbeitsblätter, Export, Modals. Sehr lange Zeilen. Übersetzungsfunktion heißt dort `tr()`. |
| `src/Library.tsx` | Startseite/Bibliothek: Seitenleiste, Ordner (Name/Farbe oben auf der Ordnerseite), Drag & Drop (gedrückt halten), Menüs |
| `src/LectureSheet.tsx` | Transkribieren: Startfenster, Live-Ansicht, Ergebnis („Genau erkennen“, „Schnell neu erkennen“, Tonaufnahme löschen) |
| `src/lecture.ts` | Typen und Capacitor-Plugin-Schnittstelle `LectureRecorder` |
| `src/LevelSheet.tsx`, `src/Training.tsx`, `src/levels.ts` | Handschrift-Einrichtung in 5 Stufen. Nach jeder Stufe geht es ins Stufenmenü, nicht ins Studio. |
| `src/SettingsSheet.tsx` | Einstellungen (Bereichsleiste links, Sprache, Sicherung, Werbung) |
| `src/OfflineGate.tsx` | Internet-Pflicht (Capacitor Network) |
| `src/nativeAds.ts` | AdMob: IDs, Einwilligung, Interstitial, Rewarded. **Noch Googles Test-IDs** – vor Veröffentlichung eigene IDs eintragen (+ `GADApplicationIdentifier` in `ios/App/App/Info.plist`). |
| `src/i18n.ts`, `src/i18n.en.ts` | Übersetzung (siehe unten) |
| `src/engine.ts` | Layout der Handschrift (Glyphen, Zeilen, Tabellen, Arbeitsblatt-Felder) |
| `src/storage.ts` | IndexedDB-Speicher + Prüfung von Sicherungen (Obergrenzen großzügig, Sicherungen bis 500 MB) |
| `src/theme.css` | Aktuelles Design (spätere Regeln überschreiben frühere; neue Regeln ans Ende) |
| `ios/App/App/LectureRecorder.swift` | Native Aufnahme + Spracherkennung (Apple SpeechAnalyzer/SFSpeech), Mikrofonwahl (Rückseite, Richtwirkung), VoiceLift, Ablage, **WhisperKit** („Genau erkennen“, Modell `large-v3`, läuft auf iPads mit M1 über den Grafikchip, offline-fähig nach Download, Stille-Filter) |
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
xcrun simctl launch <SIMULATOR-UDID> com.handwritestudio.app

# Echtes iPad (ID mit `xcrun devicectl list devices` finden)
xcodebuild -project App.xcodeproj -scheme App -configuration Debug \
  -destination 'id=<IPAD-ID>' -derivedDataPath build/DD -allowProvisioningUpdates build
xcrun devicectl device install app --device <IPAD-ID> build/DD/Build/Products/Debug-iphoneos/App.app
```

Swift-Pakete: WhisperKit (`argmax-oss-swift` 1.1.1), Capacitor-Plugins über `CapApp-SPM`. Nach `npm install` eines Capacitor-Plugins immer `npx cap sync ios`.

## Website veröffentlichen

Jeder Push auf `main` startet `.github/workflows/pages.yml`: `npm ci`, `npm test`, dann wird der Ordner `site/` auf GitHub Pages veröffentlicht. **Schlagen die Tests fehl, wird die Website nicht aktualisiert.** Screenshots liegen in `site/img/` (1600 px breit, JPEG ~80 %, aus dem iPad-Simulator im Querformat).

## Arbeitsweise

- Kleine, gezielte Änderungen; vorhandene Stile und Muster weiterverwenden.
- Nach Änderungen: `npx tsc --noEmit -p .` und `npm test`, Oberfläche im Simulator (Querformat) ansehen.
- Commits auf Deutsch, aussagekräftig. `.claude/launch.json` nie committen (lokale Pfade).
- Rechtstexte (Impressum, Datenschutz) enthalten noch Platzhalter für die echten Betreiberangaben.

## Offene Punkte

- Eigene AdMob-IDs eintragen (aktuell Test-Anzeigen).
- Impressum/Datenschutz mit echten Angaben füllen.
- App-Store-Veröffentlichung (Texte in `appstore/`).
- Transkribieren im echten Klassenraum weiter testen (Mikrofon über die Rückseite, „Genau erkennen“ auf dem iPad).
