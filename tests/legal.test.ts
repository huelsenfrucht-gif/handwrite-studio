import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('legal and ad safeguards', () => {
  it('uses no foreign brand as a feature name and no brand in store keywords', () => {
    const ui = ['src/App.tsx', 'src/Library.tsx', 'src/SettingsSheet.tsx'].map(f => readFileSync(f, 'utf8')).join('\n');
    expect(ui).not.toMatch(/GoodNotes Standard|>Goodnotes<|Empfohlen<\/span>/);
    const store = readFileSync('appstore/APP-STORE.md', 'utf8'), keywords = store.match(/\*\*Keywords\*\*[\s\S]*?```\n(.*)\n```/)![1];
    expect(keywords.toLowerCase()).not.toContain('goodnotes');
  });
  it('shows a full-screen ad without a choice, never a forced rewarded video, always muted', () => {
    const choice = readFileSync('src/AdChoice.tsx', 'utf8'), ads = readFileSync('src/nativeAds.ts', 'utf8');
    // No choice: the ad simply plays. Rewarded videos may only be shown when the user opts in, so none here.
    expect(choice).toContain('await showInterstitialAd()'); expect(choice).not.toContain('showRewardedAd');
    // Muted for the classroom, set again right before every ad.
    expect(ads).toContain('setApplicationMuted({ muted: true })'); expect(ads).toContain('setApplicationVolume({ volume: 0 })');
    expect(ads).toMatch(/await mute\(\);\s*await AdMob\.showInterstitial\(\)/);
    expect(ads).not.toContain('hs-ad-free-until');
  });
  it('treats under-16 users without tracking prompt and with under-age tagging', async () => {
    const ads = readFileSync('src/nativeAds.ts', 'utf8');
    expect(ads).toMatch(/if \(!minor && tracking\.status === 'notDetermined'\)/);
    expect(ads).toContain('tagForUnderAgeOfConsent: minor');
    expect(ads).toContain('MaxAdContentRating.ParentalGuidance');
  });
  it('ships imprint, licences and a precise privacy statement', () => {
    for (const f of ['impressum', 'lizenzen', 'datenschutz', 'nutzungsbedingungen']) expect(readFileSync(`site/${f}.html`, 'utf8').length).toBeGreaterThan(500);
    const privacy = readFileSync('site/datenschutz.html', 'utf8');
    expect(privacy).toContain('Werbe-SDK von Google'); expect(privacy).not.toContain('Alle Daten bleiben');
    // Real provider details (§ 5 DDG), no placeholders left in any legal page.
    const imprint = readFileSync('site/impressum.html', 'utf8');
    for (const must of ['pvh debt capital advisory GmbH', 'Gartenstraße 11', 'HRB 97578', 'kontakt@handwritten-app.de', '§ 18 Abs. 2 MStV']) expect(imprint).toContain(must);
    for (const f of ['impressum', 'datenschutz', 'nutzungsbedingungen', 'support']) expect(readFileSync(`site/${f}.html`, 'utf8'), f).not.toMatch(/\[(Vor- und Nachname|Adresse|E-Mail-Adresse)\]/);
  });
});

describe('checklist for launch', () => {
  it('uses the name Handwritten everywhere a user sees it', () => {
    for (const f of ['site/index.html', 'site/datenschutz.html', 'index.html', 'ios/App/App/Info.plist', 'capacitor.config.ts', 'src/App.tsx', 'src/Library.tsx', 'appstore/APP-STORE.md'])
      expect(readFileSync(f, 'utf8'), f).not.toContain('Handwrite Studio');
    expect(readFileSync('ios/App/App/Info.plist', 'utf8')).toContain('<string>Handwritten</string>');
  });
  it('links terms of use, has a skip link and no dead store button on the website', () => {
    for (const f of ['index', 'datenschutz', 'support', 'impressum', 'lizenzen', 'nutzungsbedingungen']) {
      const s = readFileSync(`site/${f}.html`, 'utf8');
      expect(s, f).toContain('nutzungsbedingungen.html'); expect(s, f).toContain('class="skip"'); expect(s, f).toContain('id="inhalt"');
    }
    const terms = readFileSync('site/nutzungsbedingungen.html', 'utf8');
    expect(terms).toContain('stdeula'); expect(terms).toContain('Täuschung'); expect(terms).toContain('nichts zu erstatten');
    expect(readFileSync('site/index.html', 'utf8')).not.toContain('href="#laden"><small>');
  });
});
