import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { t } from './i18n';
import { adsAvailable, showInterstitialAd, showRewardedAd } from './nativeAds';

/**
 * A rewarded video is offered only when writing at least three pages.
 * The user starts it explicitly; cancelling also cancels the action.
 */
export type AdReason = { kind: 'write'; pages: number } | { kind: 'record' } | { kind: 'profile' } | { kind: 'backup' } | { kind: 'restore' };
type Ask = { reason: AdReason; done: (allowed: boolean) => void };
let open: ((a: Ask) => void) | null = null;

/** Resolves true once the ad was shown (or none was needed), false if the user cancelled. */
export async function adBreak(reason: AdReason): Promise<boolean> {
  if (!adsAvailable()) return true;
  if (reason.kind !== 'write') { await showInterstitialAd(); return true; }
  if (!open) return false;
  return new Promise<boolean>(done => open!({ reason, done }));
}

const title = (r: AdReason) => r.kind === 'write' ? t('{n} Seiten schreiben', { n: r.pages })
  : r.kind === 'record' ? t('Aufnahme starten') : r.kind === 'profile' ? t('Neue Handschrift')
  : r.kind === 'backup' ? t('Sicherung speichern') : t('Sicherung laden');

export function AdChoice() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { open = setAsk; return () => { open = null; }; }, []);
  if (!ask) return null;
  const cancel = () => { if (busy) return; setAsk(null); setError(''); ask.done(false); };
  const watch = async () => { setBusy(true); setError(''); const rewarded = await showRewardedAd(); setBusy(false); if (rewarded) { setAsk(null); ask.done(true); } else setError(t('Das Video konnte nicht geladen werden. Bitte versuche es erneut.')); };
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) cancel(); }}>
    <section className="modal reward-ask" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <div className="reward-icon"><Sparkles size={26} /></div>
      <h2 id="reward-title">{title(ask.reason)}</h2>
      <p>{t('Sieh dir das Video an, um diese Aktion freizuschalten.')}</p>
      <div className="reward-choice">
        <button className="button primary-choice" disabled={busy} onClick={() => void watch()}><strong>{busy ? t('Video wird geladen …') : t('Video ansehen')}</strong><small>{t('Danach geht es direkt weiter')}</small></button>
      </div>
      {error && <p className="reward-error" role="alert">{error}</p>}
      <button className="text-link reward-cancel" disabled={busy} onClick={cancel}>{t('Abbrechen')}</button>
    </section>
  </div>;
}
