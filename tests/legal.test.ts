import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('legal and ad safeguards', () => {
  it('uses no foreign brand as a feature name and no brand in store keywords', () => {
    const ui = ['src/App.tsx', 'src/Library.tsx', 'src/SettingsSheet.tsx'].map(f => readFileSync(f, 'utf8')).join('\n');
    expect(ui).not.toMatch(/GoodNotes Standard|>Goodnotes<|Empfohlen<\/span>/);
    const store = readFileSync('appstore/APP-STORE.md', 'utf8'), keywords = store.match(/\*\*Keywords\*\*[\s\S]*?```\n(.*)\n```/)![1];
    expect(keywords.toLowerCase()).not.toContain('goodnotes');
  });
  it('offers the rewarded video only as a free choice next to a normal ad, with a real reward', () => {
    const app = readFileSync('src/App.tsx', 'utf8'), ads = readFileSync('src/nativeAds.ts', 'utf8');
    expect(app).toContain('Kurze Werbung'); expect(app).toContain('Video ansehen');
    expect(ads).toMatch(/RewardAdPluginEvents\.Rewarded, \(\) => grantAdFree\(\)/);
  });
  it('treats under-16 users without tracking prompt and with under-age tagging', async () => {
    const ads = readFileSync('src/nativeAds.ts', 'utf8');
    expect(ads).toMatch(/if \(!minor && tracking\.status === 'notDetermined'\)/);
    expect(ads).toContain('tagForUnderAgeOfConsent: minor');
    expect(ads).toContain('MaxAdContentRating.ParentalGuidance');
  });
  it('ships imprint, licences and a precise privacy statement', () => {
    for (const f of ['impressum', 'lizenzen', 'datenschutz']) expect(readFileSync(`public/${f}.html`, 'utf8').length).toBeGreaterThan(500);
    const privacy = readFileSync('public/datenschutz.html', 'utf8');
    expect(privacy).toContain('Werbe-SDK von Google'); expect(privacy).not.toContain('Alle Daten bleiben');
    expect(readFileSync('public/impressum.html', 'utf8')).toContain('[Vor- und Nachname]');
  });
});
