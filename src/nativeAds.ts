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
 * - a full-screen ad before a short export (1–3 pages) and before a new handwriting,
 * - a rewarded video before a long export (from REWARD_FROM_PAGES pages). Rewarded
 *   ads pay most, but Google requires that the user chooses to watch them, so the
 *   app asks first ("Video ansehen und exportieren").
 * Ad length is decided by Google; showing several ads in a row is not allowed.
 */
export const ADMOB = {
  interstitialId: 'ca-app-pub-3940256099942544/4411468910',
  rewardedId: 'ca-app-pub-3940256099942544/1712485313',
};
export const REWARD_FROM_PAGES = 4;
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
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
      const tracking = await AdMob.trackingAuthorizationStatus();
      if (tracking.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      await AdMob.initialize({ initializeForTesting: TESTING });
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
 * Shows a rewarded video the user agreed to watch and resolves when it was closed.
 * Without a video (no connection, no fill) it falls back to a normal full-screen ad,
 * and never blocks the export.
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
    const handles = await Promise.all([AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()), AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish())]);
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
