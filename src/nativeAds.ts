import { Capacitor } from '@capacitor/core';

/**
 * Google AdMob ads for the native iOS app (the website keeps using AdSense).
 *
 * Replace the IDs below with your own from https://admob.google.com once the
 * app is registered there. Until then Google's official test ads are shown,
 * which never earn money but also never risk the account.
 * The app ID also has to be set in ios/App/App/Info.plist (GADApplicationIdentifier).
 *
 * Placement (no banners):
 * - when text is written in handwriting: a full-screen ad; for long texts (from REWARD_FROM_PAGES pages)
 *   the user may instead choose a rewarded video that gives REWARD_AD_FREE_MS without ads,
 * - a full-screen ad before a new handwriting and before saving or loading a backup.
 * Exports themselves are free of ads.
 * Ad length is decided by Google; showing several ads in a row is not allowed.
 */
export const ADMOB = {
  interstitialId: 'ca-app-pub-3940256099942544/4411468910',
  rewardedId: 'ca-app-pub-3940256099942544/1712485313',
};
export const REWARD_FROM_PAGES = 4;
/** A watched rewarded video gives this long without ads – the reward the user chooses it for. */
export const REWARD_AD_FREE_MS = 30 * 60 * 1000;
const store = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* private mode */ } return null; };
/** Users under 16 (set in the settings): no personalised ads, no tracking prompt (Art. 8 DSGVO). */
export const isUnder16 = () => store('hs-under16') === '1';
export const setUnder16 = (on: boolean) => { store('hs-under16', on ? '1' : '0'); };
export const adFreeUntil = () => +(store('hs-ad-free-until') || 0);
const grantAdFree = () => { store('hs-ad-free-until', String(Date.now() + REWARD_AD_FREE_MS)); };
/** At most one ad for writing text within this time, so trying settings out stays free of ads. */
export const AD_COOLDOWN = 2 * 60 * 1000;
const TESTING = ADMOB.interstitialId.startsWith('ca-app-pub-3940256099942544');

type AdMobModule = typeof import('@capacitor-community/admob');
let mod: Promise<AdMobModule> | undefined, ready: Promise<boolean> | undefined, loading: Promise<boolean> | undefined;
let interstitialReady = false, rewardedReady = false, rewardLoading: Promise<boolean> | undefined;
const load = () => (mod ??= import('@capacitor-community/admob'));
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Asks for consent (GDPR form and Apple's tracking prompt) once, then starts AdMob. */
export function initAds(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  return (ready ??= (async () => {
    try {
      const { AdMob, AdmobConsentStatus } = await load();
      const { MaxAdContentRating } = await load(), minor = isUnder16();
      const consent = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: minor });
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
      const tracking = await AdMob.trackingAuthorizationStatus();
      // Under 16: no tracking prompt at all; ads stay non-personalised.
      if (!minor && tracking.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      // School app: only ads rated for general audiences with parental guidance.
      await AdMob.initialize({ initializeForTesting: TESTING, tagForUnderAgeOfConsent: minor, maxAdContentRating: MaxAdContentRating.ParentalGuidance });
      void prepareInterstitial(); void prepareRewarded();
      return true;
    } catch { return false; }
  })());
}

function prepareInterstitial() {
  return (loading ??= (async () => {
    try { const { AdMob } = await load(); await AdMob.prepareInterstitial({ adId: ADMOB.interstitialId, isTesting: TESTING }); interstitialReady = true; }
    catch { interstitialReady = false; }
    finally { loading = undefined; }
    return interstitialReady;
  })());
}

/**
 * Shows a full-screen ad and resolves once it was closed, so the action that
 * follows (export, new handwriting) starts right after. Without an ad
 * (web, no connection, no fill) it resolves immediately and nothing is blocked.
 */
export async function showInterstitialAd(): Promise<void> {
  if (!(await initAds())) return;
  if (!interstitialReady) await Promise.race([prepareInterstitial(), wait(3500)]);
  if (!interstitialReady) return;
  try {
    const { AdMob, InterstitialAdPluginEvents } = await load();
    interstitialReady = false;
    let finish = () => {};
    const closed = new Promise<void>(resolve => { finish = resolve; });
    const handles = await Promise.all([AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish()), AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => finish())]);
    await AdMob.showInterstitial();
    await Promise.race([closed, wait(90000)]);
    await Promise.all(handles.map(h => h.remove()));
  } catch { /* never block the user's action because of an ad */ }
  void prepareInterstitial();
}

function prepareRewarded() {
  return (rewardLoading ??= (async () => {
    try { const { AdMob } = await load(); await AdMob.prepareRewardVideoAd({ adId: ADMOB.rewardedId, isTesting: TESTING }); rewardedReady = true; }
    catch { rewardedReady = false; }
    finally { rewardLoading = undefined; }
    return rewardedReady;
  })());
}

/** True in the app, where long exports offer a rewarded video first. */
export const adsAvailable = () => Capacitor.isNativePlatform() || (import.meta.env.DEV && location.search.includes('ads'));

/**
 * Shows a rewarded video the user chose to watch (alternative: a short full-screen ad).
 * The reward is REWARD_AD_FREE_MS without any ads; it is granted when Google reports the reward.
 * Without a video it falls back to a normal full-screen ad and never blocks the user.
 */
export async function showRewardedAd(): Promise<void> {
  if (!(await initAds())) return;
  if (!rewardedReady) await Promise.race([prepareRewarded(), wait(4000)]);
  if (!rewardedReady) return showInterstitialAd();
  try {
    const { AdMob, RewardAdPluginEvents } = await load();
    rewardedReady = false;
    let finish = () => {};
    const closed = new Promise<void>(resolve => { finish = resolve; });
    const handles = await Promise.all([AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()), AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish()), AdMob.addListener(RewardAdPluginEvents.Rewarded, () => grantAdFree())]);
    await AdMob.showRewardVideoAd();
    await Promise.race([closed, wait(120000)]);
    await Promise.all(handles.map(h => h.remove()));
  } catch { /* never block the export because of an ad */ }
  void prepareRewarded();
}

/** Lets people change their ad consent later, as the GDPR requires. */
export async function showAdPrivacyOptions() {
  if (!(await initAds())) return false;
  try { const { AdMob } = await load(); await AdMob.showPrivacyOptionsForm(); return true; } catch { return false; }
}
