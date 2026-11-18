# Handwritten – Rechtliche und technische Prüfung

Stand: 17.11.2026 · Nur iPad-App + statische Info-Website (keine Web-App mehr) · Grundlage: Quellcode dieses Repositorys, Abhängigkeiten, Assets, Konfiguration

> **Keine Rechtsberatung.** Dieser Bericht ist eine technische Bestandsaufnahme mit vorsichtiger rechtlicher Einordnung. Er ersetzt keine Prüfung durch eine zugelassene Anwältin bzw. einen zugelassenen Anwalt (IT-, Marken-, Wettbewerbsrecht, Datenschutz). Rechtssicherheit kann nicht garantiert werden.

Bewertung je Punkt: **✅ Umgesetzt und geprüft** · **🟡 Umgesetzt, weitere Prüfung nötig** · **🔴 Offen – rechtliche Prüfung notwendig** · **⚪ Nicht anwendbar**

---

## 1. Ergebnis in Kürze

| # | Thema | Befund im Code | Maßnahme | Status |
|---|---|---|---|---|
| 1 | „GoodNotes Standard“ im Editor | Bezeichnung einer fremden Marke für eine Papier-Voreinstellung (`App.tsx`) | Umbenannt in **„Schulheft liniert“**, Funktion unverändert (Schrift 18, Linien 25 pt, liniert) | ✅ |
| 2 | Fremde Marke im Export-Dialog | „Goodnotes · Empfohlen“ | Neutral: „Notizbuch-Datei (.goodnotes) – zum Öffnen in Goodnotes“, kein „Empfohlen“, Hinweis auf fehlende Verbindung | 🟡 |
| 3 | Marken in Store-Texten | Keyword „goodnotes“, Überschrift „Für Goodnotes gemacht“, Screenshot „Fertig für Goodnotes“ | Keyword entfernt (Apple 2.3.7), Texte neutral, Screenshots neu | ✅ |
| 4 | Rewarded Video | Ab 4 Seiten **nur** Video oder Abbrechen – Video faktisch Pflicht | Gleichwertige Wahl: „Kurze Werbung“ **oder** „Video ansehen → 30 Min. werbefrei“ (echte Belohnung, gutgeschrieben erst beim Reward-Event) | 🟡 |
| 5 | Jugendliche & Werbung | Keine Altersberücksichtigung | Schalter „Ich bin unter 16“: kein ATT-Prompt, `tagForUnderAgeOfConsent`, nur nicht-personalisierte Werbung; für alle `maxAdContentRating = ParentalGuidance` | 🟡 |
| 6 | Aussage „Alle Daten bleiben auf dem Gerät“ | In Hilfe, Einstellungen, Datenschutz pauschal | Präzisiert: **Dokumente/Handschriften** bleiben lokal; Werbe-SDK überträgt Geräte-/Nutzungsdaten an Google | ✅ |
| 7 | Impressum | Fehlte | `public/impressum.html` mit **Platzhaltern** (keine erfundenen Daten), in Einstellungen verlinkt | 🔴 Angaben fehlen |
| 8 | Lizenzhinweise | Keine Attribution in App/Website (CC BY / CC BY-SA-Daten im OCR-Modell und Lexikon) | `public/lizenzen.html`, in Einstellungen verlinkt | 🟡 |
| 9 | KI-Ausfüllen | App ruft **keine** KI auf; erzeugt nur einen Prompt zum Kopieren | Hinweis im Dialog: Antworten können falsch sein, Prüfschritt, Lern- statt Täuschungszweck; Datenschutz erklärt, dass Nutzer selbst entscheidet | ✅ |
| 10 | UI-Nähe zu bekannter Notiz-App | Bibliothek mit Notizbuch-Regal, Titel-Chevron, Desktop-Ordnersymbol | Bibliothek neu: eigene **Karten** (Vorschau oben, Name/Datum, „⋯“-Menü), eigene Ordner-Darstellung (gestapelte Blätter) | 🟡 |
| 11 | Goodnotes-Export | Eigene Protobuf/ZIP-Erzeugung + eingebettete leere Container (MIT, „Benspiel/Inkly“) | Bericht unten; Funktion erhalten | 🔴 Herkunft prüfen |
| 12 | Marke „Handwritten“ | Keine Recherche möglich ohne Registerzugang | Offen | 🔴 |

---

## 2. Datenfluss (tatsächlich im Code)

| Daten | Wo gespeichert | Verlässt das Gerät? | Empfänger | Rechtsgrundlage (Vorschlag) |
|---|---|---|---|---|
| Dokumente, Texte, Antworten, Felder | IndexedDB (WebView bzw. Browser) | **Nein** | – | Art. 6 (1) b DSGVO (Bereitstellung der App) |
| Handschriften (Stiftstriche) | IndexedDB | **Nein** | – | wie oben |
| Vorlagen/Arbeitsblätter (Bilder, PDF-Seiten) | IndexedDB | **Nein** | – | wie oben |
| Fotos für Texterkennung | Nur im Arbeitsspeicher; iPad: Apple Vision lokal | **Nein** | – | wie oben |
| UI-Einstellungen, offene Tabs, „unter 16“, werbefrei-bis | localStorage | **Nein** | – | § 25 (2) Nr. 2 TDDDG (unbedingt erforderlich) |
| Teilen-Erweiterung | iOS-Zwischenablage mit eigenem Marker-Typ, sofort geleert | **Nein** | – | – |
| Exporte, Sicherungen | Nur dort, wo der Nutzer sie hinteilt | Nur durch Nutzer | vom Nutzer gewählt | – |
| Werbeanfragen (iPad-App) | Google Mobile Ads SDK | **Ja** | Google Ireland Ltd. (ggf. USA) | Einwilligung (UMP, Art. 6 (1) a DSGVO, § 25 (1) TDDDG); ohne Einwilligung nicht-personalisiert – **Rechtsgrundlage dafür anwaltlich prüfen** |
| IDFA | nur nach ATT-Erlaubnis; bei „unter 16“ nie gefragt | ggf. ja | Google | Einwilligung |
| Website-Aufruf | Server-Logs bei GitHub Pages | Ja | GitHub Inc. (USA) | Art. 6 (1) f DSGVO |
| KI-Prompt | Zwischenablage | **Nur wenn der Nutzer ihn selbst einfügt** | vom Nutzer gewählter KI-Dienst | Verantwortung beim Nutzer; Hinweis vorhanden |

Netzwerkzugriffe im Web-Code: nur eigene Modelldateien (`/models/…`) und – **derzeit deaktiviert** – AdSense (`public/adsense-config.js`, `client: ''`). **Vor einer Aktivierung von AdSense auf der Website ist eine zertifizierte CMP Pflicht.** Keine externen Schriften, kein Analytics, keine Fehlerberichte an Dritte (AdMob bringt eigenes Crash-Reporting mit → in Datenschutzerklärung unter Google erfasst).

## 3. Werbung und Minderjährige

| Platzierung | Bewertung |
|---|---|
| Vollbild beim Schreiben in Handschrift | Natürlicher Übergang, zulässig nach AdMob-Richtlinien (nicht beim App-Start, nicht unerwartet mitten in Eingaben). 🟡 Häufigkeit beobachten – AdMob rät von Interstitials bei jeder Aktion ab; ggf. Frequenzbegrenzung wieder einführen. |
| Rewarded ab 4 Seiten | Jetzt freiwillig mit gleichwertiger Alternative und echter Belohnung. ✅ |
| Vor neuer Handschrift | Zulässig. |
| Beim Speichern/Laden einer Sicherung | 🟡 Vor der **Wiederherstellung** kann Werbung als Hürde bei Datenverlust empfunden werden; auf Wunsch des Betreibers beibehalten – Empfehlung: beim Laden entfernen. |
| Altersfreigabe | Store-Fragebogen „4+“ ist mit Werbung möglich; Werbeinhalte auf „ParentalGuidance“ begrenzt. In AdMob zusätzlich sensible Kategorien blockieren. |
| Under-16-Einstellung | Selbstauskunft; keine Altersverifikation. 🔴 Ob das ausreicht (Art. 8 DSGVO), anwaltlich klären. Alternative: **für alle nur nicht-personalisierte Werbung** (risikoärmste Variante, geringerer Umsatz). |
| CMP | Google UMP (von Google zertifiziert, IAB TCF v2.2) – Nachricht muss im **AdMob-Konto** unter „Datenschutz & Mitteilungen“ veröffentlicht werden. 🔴 Betreiber-Aufgabe |

## 4. Goodnotes-Kompatibilität (`src/goodnotes.ts`, `src/goodnotesTemplates.ts`)

1. **Erzeugung:** eigene Implementierung – ZIP (JSZip) mit Protobuf-Datensätzen, die Stiftstriche als Punktfolgen enthalten; Kompression LZ4-ähnlich selbst kodiert.
2. **Bibliotheken:** JSZip (MIT/GPL dual), sonst eigener Code.
3. **Proprietäre Programmteile:** keine Goodnotes-Software oder -Bibliothek eingebunden.
4. **Fremde Dateien:** drei **leere Notizbuch-Container** (liniert, kariert, blanko) als Basis, laut Kopfkommentar MIT-lizenziert aus dem Projekt „Benspiel/Inkly“. Diese wurden vermutlich ursprünglich mit Goodnotes erzeugt. 🔴 **Herkunft und Lizenzkette verifizieren**; enthalten sie Goodnotes-Grafiken (z. B. Papier-Hintergründe), wäre ein selbst erzeugter Container die sauberere Lösung.
5. **Reverse Engineering:** Das Format wurde (vom Upstream-Projekt bzw. bei der Entwicklung) durch Analyse von Dateien nachvollzogen, nicht durch Dekompilierung der App. § 69e UrhG betrifft Dekompilierung von Programmcode; die Analyse von Dateiformaten zur Interoperabilität ist nach h. M. grundsätzlich zulässig (EuGH C‑406/10 SAS Institute: Funktionalität und Datenformate sind nicht als solche geschützt). 🔴 Einzelfall anwaltlich bestätigen lassen.
6. **Markennennung:** nur als Kompatibilitätsangabe (§ 23 Nr. 3 MarkenG), mit Hinweis auf fehlende Verbindung.
7. **PDF und SVG** funktionieren unabhängig (jsPDF bzw. eigener SVG-Code). ✅
8. „Bearbeitbar“: Formuliert als „Stiftstriche, die sich in Goodnotes radieren und verschieben lassen“ – im Projekt mehrfach in Goodnotes geöffnet; bei Format-Updates von Goodnotes erneut testen.

## 5. Lizenz- und Asset-Inventar

| Asset / Paket | Herkunft | Lizenz | Hinweis |
|---|---|---|---|
| App-Icon, Ordner-/Seitengrafiken, Illustrationen | selbst erstellt (SVG/CSS) | eigen | – |
| Icons | lucide-react | ISC | – |
| Schriften | Systemschriften (SF Pro, New York) | Apple-Systemschriften, nicht eingebettet | auf Website Fallback Georgia/Helvetica |
| Demo-Handschrift (`src/demo.ts`) | selbst als Koordinaten definiert | eigen | – |
| Papierlinien | selbst berechnet (Maße wie gängiges A4-Linienpapier) | – | Abstände sind keine schutzfähige Gestaltung |
| react, react-dom, capacitor, admob-Plugin, jspdf, onnxruntime-web | npm | MIT | – |
| pdfjs-dist | Mozilla | Apache-2.0 | NOTICE beachten |
| jszip | npm | MIT oder GPL-3.0 | MIT gewählt |
| OCR-Modell de-htr-web v2 | `public/models/de-htr` | Apache-2.0, Trainingsdaten CC BY 4.0 / AFL-3.0 / CC BY-SA … | Attribution jetzt in `lizenzen.html` |
| Lexikon | `public/models/de-lexicon` | CC0, CC BY-SA 4.0 (FrequencyWords), Leipzig Corpora | 🔴 Leipzig-Corpora-Lizenz der Häufigkeitsliste prüfen (Teile CC BY-NC) – ggf. Datei ersetzen |
| .goodnotes-Container | Benspiel/Inkly | MIT (laut Kommentar) | 🔴 siehe Abschnitt 4 |
| Google Mobile Ads SDK / UMP | Google | Google-Bedingungen | – |

## 6. Sicherheit (Kurzprüfung)

- Importierte Sicherungen werden streng validiert (`validateLibrary`: Typen, Größen, Punktzahl, Farbformate); max. 30 MB. ✅
- PDFs: pdf.js, max. 60 MB, max. 40–60 Seiten. ✅
- Kein `dangerouslySetInnerHTML`, Markdown wird nur zu Klartext bereinigt → kein XSS-Pfad gefunden. ✅
- Speicherüberlauf bei sehr langen Dokumenten behoben (Strich-Vereinfachung, Cache-Grenze). ✅
- iPad: Knöpfe unter automatisch aufgeklappten `<details>`-Bereichen waren nicht antippbar (WebKit-Fehler, Darstellung und Trefferfläche verschoben) – durch eigenes Aufklappen ersetzt. ✅
- Native Berechtigungen: Kamera, Fotos (nur Auswahl), Tracking (optional). ✅
- `npm audit` nicht Teil dieses Laufs. 🟡 vor Release ausführen.

## 7. Geänderte Dateien (dieser Durchgang)

`src/App.tsx` (Markennamen, Export-Dialog, Werbe-Auswahl, KI-Hinweis, Datenschutzaussage) · `src/nativeAds.ts` (Belohnung, unter-16, Inhaltsrating) · `src/SettingsSheet.tsx` (unter-16, Impressum, Lizenzen) · `src/Library.tsx` + `src/theme.css` (Karten, Ordner-Darstellung) · `public/datenschutz.html`, `public/support.html`, **neu** `public/impressum.html`, `public/lizenzen.html` · `appstore/APP-STORE.md` · Screenshots.

## 8. Offene Punkte für die Anwältin / den Anwalt

1. Markenrecherche „Handwritten“ (DPMA, EUIPO/TMview; Klassen 9, 41, 42).
2. Zulässigkeit der Formatkompatibilität mit Goodnotes inkl. Herkunft der eingebetteten Container.
3. Rechtsgrundlage für nicht-personalisierte Werbung ohne Einwilligung (§ 25 TDDDG) und Ausreichen der Selbstauskunft „unter 16“.
4. Ob Nutzungsbedingungen nötig sind (z. B. Haftung für importierte Inhalte, keine Nutzung zur Täuschung).
5. Barrierefreiheit: Anwendbarkeit des BFSG auf eine kostenlose, werbefinanzierte App (Kleinstunternehmen-Ausnahme?).
6. ~~Leipzig-Corpora-Lizenz der Lexikon-Häufigkeitsliste~~ – erledigt: Web-Texterkennung samt Modell und Wörterbuch entfernt.
7. Gesamteindruck der Oberfläche (UWG § 4 Nr. 3) nach dem Redesign.

## 9. Veröffentlichungs-Checkliste

- [ ] Impressum, Datenschutz, Support: Platzhalter ausfüllen
- [ ] Apple Developer Program, Team-ID eintragen
- [ ] AdMob: echte App-/Anzeigen-IDs, UMP-Nachricht + IDFA-Erklärung veröffentlichen, sensible Kategorien blockieren
- [ ] App-Store-Datenschutzangaben gemäß `APP-STORE.md`
- [ ] Altersfreigabe-Fragebogen
- [ ] Offene Punkte aus Abschnitt 8 klären
- [ ] `npm audit`, Testlauf auf echtem iPad (Hoch/Quer), Goodnotes-Export in aktueller Goodnotes-Version öffnen


## Nachtrag: nur noch iPad-App
Die Browser-Version der App wurde eingestellt. Entfernt: eigene Texterkennung (ONNX-Modell de-htr, onnxruntime-web), Korrekturwörterbuch (inkl. Leipzig-/OpenSubtitles-Listen), AdSense-Code. Die Website (`site/`) ist eine statische Info-Seite mit Datenschutz, Support, Impressum und Lizenzen – ohne Cookies, Tracking oder Werbung. Fotos liest in der App ausschließlich Apples Texterkennung auf dem Gerät.
