import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { t } from './i18n';
import { adFreeUntil, adsAvailable, showInterstitialAd, showRewardedAd } from './nativeAds';

/**
 * One ad break before an action. The user chooses between a short ad and a rewarded video
 * (Google allows rewarded videos only when the user opts in). The video earns more and gives
 * 30 minutes without any ads. Ads cannot be skipped altogether; “Cancel” cancels the action.
 *
 * Used before: writing long texts in handwriting, starting a transcription, creating a
 * handwriting, saving and loading a backup. (Short texts get a short ad without a choice.)
 */
export type AdReason = { kind: 'write'; pages: number } | { kind: 'record' } | { kind: 'profile' } | { kind: 'backup' } | { kind: 'restore' };
type Ask = { reason: AdReason; done: (choice: 'short' | 'video' | 'cancel') => void };
let open: ((a: Ask) => void) | null = null;

/** Resolves true once the ad was shown (or none was needed), false if the user cancelled. */
export async function adBreak(reason: AdReason): Promise<boolean> {
  if (!adsAvailable() || Date.now() < adFreeUntil()) return true;
  if (!open) { await showInterstitialAd(); return true; }
  const choice = await new Promise<'short' | 'video' | 'cancel'>(done => open!({ reason, done }));
  if (choice === 'cancel') return false;
  if (choice === 'video') await showRewardedAd(); else await showInterstitialAd();
  return true;
}

const title = (r: AdReason) => r.kind === 'write' ? t('{n} Seiten schreiben', { n: r.pages })
  : r.kind === 'record' ? t('Aufnahme starten') : r.kind === 'profile' ? t('Neue Handschrift')
  : r.kind === 'backup' ? t('Sicherung speichern') : t('Sicherung laden');

export function AdChoice() {
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => { open = setAsk; return () => { open = null; }; }, []);
  if (!ask) return null;
  const pick = (c: 'short' | 'video' | 'cancel') => { setAsk(null); ask.done(c); };
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) pick('cancel'); }}>
    <section className="modal reward-ask" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <div className="reward-icon"><Sparkles size={26} /></div>
      <h2 id="reward-title">{title(ask.reason)}</h2>
      <p>{t('Handwritten ist kostenlos und wird durch Werbung finanziert. Du kannst wählen:')}</p>
      <div className="reward-choice">
        <button className="button" onClick={() => pick('short')}><strong>{t('Kurze Werbung')}</strong><small>{t('Danach geht es direkt weiter')}</small></button>
        <button className="button primary-choice" onClick={() => pick('video')}><strong>{t('Video ansehen')}</strong><small>{t('Ca. 15–30 Sek. · danach 30 Minuten ganz ohne Werbung')}</small></button>
      </div>
      <button className="text-link reward-cancel" onClick={() => pick('cancel')}>{t('Abbrechen')}</button>
    </section>
  </div>;
}
