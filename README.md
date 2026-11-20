# Handwritten

iPad-App (Capacitor + React + TypeScript), die getippten Text in der eigenen Handschrift schreibt, Arbeitsblätter ausfüllt und Unterricht transkribiert – alles direkt auf dem iPad. Die App ist 100 % kostenlos und wird ausschließlich durch Werbung finanziert, deshalb braucht sie eine Internetverbindung.

- Website: https://huelsenfrucht-gif.github.io/handwrite-studio/
- Oberfläche auf Deutsch und Englisch (Einstellungen → Sprache)

**Für die Weiterentwicklung (auch mit Codex oder anderen KI-Assistenten) siehe [AGENTS.md](AGENTS.md):** Produktregeln, Projektstruktur, Übersetzung, Befehle, iOS-Build und Veröffentlichung der Website.

## Schnellstart

```bash
npm install
npm test
npm run build && npx cap sync ios
open ios/App/App.xcodeproj
```

## Drittanbieter

- Capacitor (MIT), React (MIT), lucide-react (ISC), pdf.js (Apache-2.0), jsPDF (MIT), JSZip (MIT/GPLv3)
- Google Mobile Ads SDK (AdMob) für Werbung

Ausführlich: `site/lizenzen.html` und [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
