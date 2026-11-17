# Handwrite Studio – App Store Upload

Alles in diesem Ordner ist fertig vorbereitet. Was nur du machen kannst, steht in **Teil A**.

---

## Teil A – Was du selbst erledigen musst

### 1. Apple Developer Program (99 € / Jahr)
Mit dem kostenlosen „Personal Team“ kann man **nicht** in den App Store hochladen.
1. https://developer.apple.com/programs/enroll/ → mit deiner Apple-ID anmelden und als **Einzelperson** registrieren.
2. Die Freischaltung dauert meist 1–2 Tage.
3. Danach in Xcode: **Settings → Accounts** → dein Team erscheint als „(Individual)“. Notiere die neue **Team-ID** und sag sie mir – ich trage sie ein (aktuell steht dort noch das Personal Team `HP6Q78GUA5`).

> Hinweis: Unter 18? Dann muss ein Erziehungsberechtigter das Konto anlegen und die Verträge annehmen.

### 2. AdMob (sonst verdienst du nichts)
1. https://admob.google.com → App hinzufügen → iOS → „noch nicht im App Store“.
2. Zwei Anzeigenblöcke anlegen: **Interstitial** und **Prämie (Rewarded)**.
3. Schick mir die **App-ID** (`ca-app-pub-…~…`) und die zwei **Anzeigenblock-IDs** (`ca-app-pub-…/…`).
   Ich trage sie in `src/nativeAds.ts` und `ios/App/App/Info.plist` ein. Solange dort Googles Test-IDs stehen, zeigt die App nur Testwerbung.
4. Nach der Veröffentlichung in AdMob die App mit dem App-Store-Eintrag verknüpfen und unter **Datenschutz & Mitteilungen** die DSGVO-Nachricht (Einwilligung) und die IDFA-Erklärung veröffentlichen.

### 3. Datenschutzerklärung ausfüllen
In `public/datenschutz.html` und `public/support.html` stehen Platzhalter: **[Vor- und Nachname]**, **[Adresse]**, **[E-Mail-Adresse]**. Die müssen ausgefüllt werden (Pflicht laut DSGVO und Apple). Schick mir die Angaben oder trag sie selbst ein – danach ist die Seite automatisch online unter:
- Datenschutz: https://huelsenfrucht-gif.github.io/handwrite-studio/datenschutz.html
- Support: https://huelsenfrucht-gif.github.io/handwrite-studio/support.html

---

## Teil B – App in App Store Connect anlegen

https://appstoreconnect.apple.com → **Apps → +  → Neue App**

| Feld | Eintrag |
|---|---|
| Plattform | iOS |
| Name | **Handwrite Studio – Handschrift** (max. 30 Zeichen; falls vergeben: „Handwrite Studio“) |
| Primäre Sprache | Deutsch |
| Bundle-ID | `com.handwritestudio.app` (erscheint nach Teil A.1 automatisch, sonst unter developer.apple.com → Identifiers anlegen) |
| SKU | `handwrite-studio-1` |

### App-Informationen
- **Untertitel** (30 Z.): `Dein Text in deiner Handschrift`
- **Kategorie:** Bildung (primär), Produktivität (sekundär)
- **Altersfreigabe:** Fragebogen überall „Nein“ → ergibt 4+. (Wegen Werbung: Werbung ist erlaubt, nur keine Glücksspiel-/Erwachseneninhalte – im AdMob-Konto unter „Blockierungseinstellungen“ sensible Kategorien sperren.)
- **Datenschutz-URL:** siehe Teil A.3
- **Support-URL:** siehe Teil A.3

### Preise
Kostenlos, alle Länder (oder nur Deutschland, Österreich, Schweiz).

### Version 1.0 – Texte

**Werbetext** (170 Z., jederzeit änderbar):
```
Tippe Text ein – die App schreibt ihn in deiner eigenen Handschrift. Arbeitsblätter füllen sich aus, Überschriften werden markiert. Fertig für Goodnotes.
```

**Beschreibung:**
```
Handwrite Studio verwandelt getippten Text in deine echte Handschrift – Buchstabe für Buchstabe aus deinem eigenen Alphabet.

SO EINFACH GEHT’S
1. Schreib a–z und A–Z einmal mit dem Apple Pencil.
2. Tippe oder füge deinen Text ein.
3. Tippe auf „In Handschrift verwandeln“ – fertig.

ARBEITSBLÄTTER AUSFÜLLEN
Lade ein Arbeitsblatt als Foto oder PDF – auch mehrere Seiten auf einmal. Die App erkennt Lücken, Antwortlinien und Tabellenzellen und schreibt deine Antworten in deiner Handschrift genau an die richtige Stelle. Name, Datum und Ankreuzkästchen bleiben frei.

TEXT AUS FOTOS
Fotografiere Tafel, Heft oder Buchseite. Der Text wird mit Absätzen, Einrückungen und Tabellen übernommen.

SIEHT AUS WIE VON HAND
• Natürliche Schwankungen, versetzte Zeilenanfänge
• Tabellen mit handgezogenen Linien
• Alle Überschriften mit Textmarker markieren – Farbe frei wählbar
• Liniert, kariert, blanko oder dein eigenes Papier

FÜR GOODNOTES GEMACHT
Exportiere als Goodnotes-Datei mit echter, radierbarer Stifttinte – oder als PDF für Notability, OneNote und zum Drucken.

DEINE DATEN BLEIBEN BEI DIR
Keine Anmeldung, kein Konto, keine Cloud. Alles wird nur auf deinem iPad gespeichert.

Handwrite Studio ist kostenlos und wird durch Werbung finanziert.
```

**Keywords** (100 Z., ohne Leerzeichen nach Kommas):
```
handschrift,schrift,goodnotes,arbeitsblatt,hausaufgaben,schule,notizen,text,pencil,mitschrift,lernzettel
```

**Neues in dieser Version:** `Erste Version.`

**Screenshots (iPad 13″):** die fünf Bilder aus `appstore/screenshots-ipad-13/` in der Reihenfolge der Nummern hochladen (2064 × 2752, hochkant – genau die geforderte Größe).

**App-Icon:** ist bereits in der App enthalten (`appstore/app-icon-1024.png` nur als Vorschau).

### App-Datenschutz („Datenschutz-Etiketten“)
Unter **App-Datenschutz → Los geht’s**: „Ja, wir erheben Daten“ (wegen AdMob). Ankreuzen:

| Datentyp | Verwendet für | Mit Identität verknüpft | Tracking |
|---|---|---|---|
| Kennungen → **Geräte-ID** | Werbung durch Drittanbieter, Analysen | Nein | **Ja** |
| Nutzungsdaten → **Produktinteraktion** | Werbung durch Drittanbieter, Analysen | Nein | Ja |
| Nutzungsdaten → **Werbedaten** | Werbung durch Drittanbieter | Nein | Ja |
| Diagnose → **Absturzdaten**, **Leistungsdaten** | Analysen | Nein | Nein |
| Standort → **Ungefährer Standort** | Werbung durch Drittanbieter | Nein | Ja |

Alles andere (Texte, Fotos, Kontakte …): **nicht erhoben** – bleibt auf dem Gerät.

### App-Review-Informationen
- **Anmeldung erforderlich:** Nein
- **Notizen für Review:**
```
Die App läuft komplett offline auf dem Gerät, ohne Konto. Zum Testen: „Neues Dokument“ → Text eintippen → „In Handschrift verwandeln“ (nutzt die mitgelieferte Demo-Handschrift). Eigene Handschrift: „Handschriften“ → Namen eingeben → a–z/A–Z mit Finger oder Apple Pencil schreiben. Werbung (Google AdMob) erscheint beim Umwandeln von Text; ab 4 Seiten wird vorher um Zustimmung für ein Belohnungsvideo gebeten.
```

---

## Teil C – Hochladen (in Xcode, ca. 10 Minuten)

Voraussetzung: Teil A.1 und A.2 erledigt und mir die IDs geschickt (ich baue dann neu).

1. Im Terminal im Projektordner:
   ```
   npm run build && npx cap copy ios
   ```
2. `ios/App/App.xcodeproj` in Xcode öffnen.
3. Oben als Ziel **„Any iOS Device (arm64)“** wählen.
4. Menü **Product → Archive**. Nach 1–2 Minuten öffnet sich der Organizer.
5. **Distribute App → App Store Connect → Upload** → alles auf Standard lassen → Upload.
6. Nach ~15 Minuten erscheint der Build in App Store Connect unter der Version → **Build auswählen**.
7. Exportkonformität: wird automatisch beantwortet (keine Verschlüsselung, ist schon eingetragen).
8. **Zur Prüfung einreichen.** Apple prüft meist in 1–2 Tagen.

Bei jedem Update: in Xcode unter **App → General** die **Build-Nummer** um 1 erhöhen (bei neuer Version auch die Version, z. B. 1.1), dann wieder Schritt 1–6.

---

## Was bereits erledigt ist
- App-Icon 1024 × 1024 im Navy-Design (ohne Transparenz, wie Apple es verlangt)
- Nur iPad (die App ist für Apple Pencil gemacht) – damit braucht es nur iPad-Screenshots
- Datenschutz-Manifest (`PrivacyInfo.xcprivacy`), Tracking-Abfrage, SKAdNetwork-IDs, Kamera-/Foto-Texte
- Verschlüsselungs-Angabe (`ITSAppUsesNonExemptEncryption = NO`)
- Datenschutzerklärung und Support-Seite (Platzhalter ausfüllen!)
- Datenschutz und Hilfe in den Einstellungen verlinkt
- Release-Archiv baut fehlerfrei
- 4 Screenshots in Originalgröße
