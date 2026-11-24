# Handwritten – App Store Upload

Alles in diesem Ordner ist fertig vorbereitet. Was nur du machen kannst, steht in **Teil A**.

---

## Teil A – Was du selbst erledigen musst

### 1. Apple Developer Program (99 € / Jahr) – als Organisation
Anbieter der App ist die **pvh debt capital advisory GmbH** (siehe Impressum). Damit im App Store die GmbH als Anbieter erscheint und zum Impressum passt, das Konto **als Organisation** anlegen, nicht als Einzelperson.
1. Vorher eine **D-U-N-S-Nummer** für die GmbH besorgen (kostenlos, über https://developer.apple.com/enroll/duns-lookup/ – dauert einige Tage, falls die Firma noch keine hat).
2. https://developer.apple.com/programs/enroll/ → als **Organisation** registrieren (Firmenname genau wie im Handelsregister, D-U-N-S-Nummer, Firmen-Website, rechtlich vertretungsberechtigte Person: Botho v. Hülsen).
3. Danach in Xcode: **Settings → Accounts** → das Firmen-Team erscheint. Die **Team-ID** an Claude/Codex geben – sie wird im Projekt eingetragen (aktuell steht dort noch das persönliche Team).

### 2. AdMob (sonst verdienst du nichts)
1. https://admob.google.com → App hinzufügen → iOS → „noch nicht im App Store“.
2. Zwei Anzeigenblöcke anlegen: **Interstitial** und **Prämie (Rewarded)**.
3. Schick mir die **App-ID** (`ca-app-pub-…~…`) und die zwei **Anzeigenblock-IDs** (`ca-app-pub-…/…`).
   Ich trage sie in `src/nativeAds.ts` und `ios/App/App/Info.plist` ein. Solange dort Googles Test-IDs stehen, zeigt die App nur Testwerbung.
4. Nach der Veröffentlichung in AdMob die App mit dem App-Store-Eintrag verknüpfen und unter **Datenschutz & Mitteilungen** die DSGVO-Nachricht (Einwilligung) und die IDFA-Erklärung veröffentlichen.

### 3. Rechtstexte – erledigt
Impressum, Datenschutzerklärung, Nutzungsbedingungen und Hilfe enthalten die echten Angaben der pvh debt capital advisory GmbH (Kontakt: kontakt@handwritten-app.de). In der App sind sie unter **Einstellungen → Hilfe & Rechtliches** (Impressum, Nutzungsbedingungen, Hilfe & Kontakt) und **Einstellungen → Werbung & Datenschutz** (Datenschutzerklärung) verlinkt.
- Datenschutz: https://huelsenfrucht-gif.github.io/handwrite-studio/datenschutz.html
- Support: https://huelsenfrucht-gif.github.io/handwrite-studio/support.html
- Impressum: https://huelsenfrucht-gif.github.io/handwrite-studio/impressum.html
- Nutzungsbedingungen: https://huelsenfrucht-gif.github.io/handwrite-studio/nutzungsbedingungen.html

**Wichtig:** Die Postfach-Adresse kontakt@handwritten-app.de muss tatsächlich E-Mails empfangen und regelmäßig gelesen werden.

### 4. Eigene Domain www.handwritten-app.de verbinden (empfohlen, vor dem Einreichen)
Die Rechtstexte nennen www.handwritten-app.de. Die Domain ist registriert, zeigt aber noch nicht auf die Website. So verbinden:
1. Beim Domain-Anbieter (DNS-Einstellungen von handwritten-app.de):
   - `www` als **CNAME** auf `huelsenfrucht-gif.github.io`
   - die Hauptdomain (`@`) mit vier **A-Einträgen**: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
2. Auf GitHub: Repository → **Settings → Pages → Custom domain** `www.handwritten-app.de` eintragen, nach der Prüfung **Enforce HTTPS** anhaken.
3. Danach Bescheid geben: Dann werden die Links in der App und hier auf https://www.handwritten-app.de/… umgestellt (die alten github.io-Links leiten automatisch weiter).

---

## Teil B – App in App Store Connect anlegen

https://appstoreconnect.apple.com → **Apps → +  → Neue App**

| Feld | Eintrag |
|---|---|
| Plattform | iOS |
| Name | **Handwritten** (max. 30 Zeichen). Falls App Store Connect den Namen als vergeben meldet: **Handwritten – Deine Schrift**. Auf dem Home-Bildschirm steht immer „Handwritten“. |
| Primäre Sprache | Deutsch |
| Bundle-ID | `de.vonhuelsen.handwritten` (in Xcode für App und Share Extension mit dem Developer-Team hinterlegt) |
| SKU | `handwrite-studio-1` |

### App-Informationen
- **Untertitel** (30 Z.): `Dein Text in deiner Handschrift`
- **Kategorie:** Bildung (primär), Produktivität (sekundär)
- **Altersfreigabe:** Fragebogen überall „Nein“ → ergibt 4+. (Wegen Werbung: Werbung ist erlaubt, nur keine Glücksspiel-/Erwachseneninhalte – im AdMob-Konto unter „Blockierungseinstellungen“ sensible Kategorien sperren.)
- **Datenschutz-URL:** siehe Teil A.3
- **Support-URL:** siehe Teil A.3
- **Marketing-URL (optional):** https://huelsenfrucht-gif.github.io/handwrite-studio/
- **Copyright:** `2026 pvh debt capital advisory GmbH`

### Händlerstatus (EU, Digital Services Act)
Unter **App Store Connect → Business → Compliance** bzw. beim ersten Einreichen fragt Apple, ob du **Händler** bist. Für die GmbH: **Ja, Händler**. Apple zeigt diese Angaben auf der App-Seite in der EU an:
- Adresse: Gartenstraße 11, 60594 Frankfurt am Main, Deutschland
- Telefon: +49 177 4473637
- E-Mail: kontakt@handwritten-app.de

Apple prüft Telefon und E-Mail mit einem Bestätigungscode.

### Preise
Kostenlos, alle Länder (oder nur Deutschland, Österreich, Schweiz).

### Version 1.0 – Texte

**Werbetext** (170 Z., jederzeit änderbar):
```
Tippe Text ein – die App schreibt ihn in deiner eigenen Handschrift. Arbeitsblätter ausfüllen, Überschriften markieren, als PDF exportieren.
```

**Beschreibung:**
```
Handwritten verwandelt getippten Text in deine echte Handschrift – Buchstabe für Buchstabe aus deinem eigenen Alphabet.

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

EXPORT FÜR DEINE NOTIZ-APP
Exportiere als PDF für jede Notiz-App und zum Drucken, als SVG – oder als Datei zum Öffnen in Goodnotes, in der die Schrift als bearbeitbare Stiftstriche erhalten bleibt.
(Goodnotes ist eine Marke ihres Inhabers; Handwritten ist unabhängig und steht in keiner Verbindung dazu.)

DEINE DATEN BLEIBEN BEI DIR
Keine Anmeldung, kein Konto, keine Cloud. Alles wird nur auf deinem iPad gespeichert.

Handwritten ist kostenlos und wird durch Werbung finanziert. KI-Antworten können Fehler enthalten – prüfe sie immer selbst.
```

**Keywords** (100 Z., ohne Leerzeichen nach Kommas):
```
handschrift,schrift,arbeitsblatt,lernzettel,schule,notizen,text,pencil,mitschrift,lernen,ausfüllen
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
- **Kontakt für die Prüfung:** Botho v. Hülsen, +49 177 4473637, kontakt@handwritten-app.de
- **Anmeldung erforderlich:** Nein
- **Notizen für Review:**
```
Die App benötigt für Werbung eine Internetverbindung; Texte, Handschriften und Aufnahmen bleiben auf dem Gerät. Keine Anmeldung. Zum Testen: „Neues Dokument“ → Text eingeben → „In Handschrift verwandeln“. Eigene Handschrift: „Handschriften“ → Namen eingeben → a–z/A–Z mit Apple Pencil schreiben. Vor dem Schreiben in Handschrift, vor dem Start einer Transkription, vor einer neuen Handschrift und beim Speichern/Laden einer Sicherung erscheint eine Vollbild-Anzeige (Interstitial), ohne Auswahl und immer stummgeschaltet, weil die App im Unterricht genutzt wird. Belohnungsvideos werden nicht verwendet.
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
- App-Icon 1024 × 1024 im Design „Graphit & Papier“ (ohne Transparenz, wie Apple es verlangt)
- Nur iPad (die App ist für Apple Pencil gemacht) – damit braucht es nur iPad-Screenshots
- Datenschutz-Manifest (`PrivacyInfo.xcprivacy`), Tracking-Abfrage, SKAdNetwork-IDs, Kamera-/Foto-Texte
- Verschlüsselungs-Angabe (`ITSAppUsesNonExemptEncryption = NO`)
- Impressum, Datenschutzerklärung, Nutzungsbedingungen und Support-Seite mit echten Angaben
- Datenschutz, Impressum, Nutzungsbedingungen und Hilfe in den Einstellungen verlinkt
- Release-Archiv baut fehlerfrei
- 5 Screenshots in Originalgröße


> Fremde App-Namen (z. B. Goodnotes) gehören laut Apple-Richtlinie 2.3.7 nicht in Keywords oder Untertitel. In der Beschreibung nur als Kompatibilitätshinweis.
> Impressum: https://huelsenfrucht-gif.github.io/handwrite-studio/impressum.html
