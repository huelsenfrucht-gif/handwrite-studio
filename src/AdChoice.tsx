import { adsAvailable, showInterstitialAd } from './nativeAds';

/**
 * The ad before an action: no choice, the ad simply plays (always muted, see nativeAds.ts)
 * and the action starts once it is closed. Used before writing at least three pages,
 * starting a transcription, creating a handwriting, saving and loading a backup.
 *
 * Full-screen ads (interstitials, often videos – the length is decided by Google) are used
 * here, because Google allows rewarded videos only when the user chooses to watch them.
 */
export type AdReason = { kind: 'write'; pages: number } | { kind: 'record' } | { kind: 'profile' } | { kind: 'backup' } | { kind: 'restore' };

/** Shows the ad and resolves true once it was closed (or none was needed). */
export async function adBreak(_reason: AdReason): Promise<boolean> {
  if (adsAvailable()) await showInterstitialAd();
  return true;
}
