import { Capacitor } from '@capacitor/core';
import { HandwriteNative } from './native';

/**
 * Google AdMob ads for the native iOS app (the website keeps using AdSense).
 *
 * AdMob app and interstitial IDs belong to Handwritten in the publisher account.
 * TestFlight testing must use AdMob test mode; never interact with live ads in a test build.
 * The app ID is set in ios/App/App/Info.plist (GADApplicationIdentifier).
 *
 * Placement (no banners): a full-screen ad, without a choice, before writing in handwriting,
 * starting a transcription, creating a handwriting and saving/loading a backup.
 * Every ad starts muted (the app is used in class).
 * Exports themselves are free of ads.
 * Ad length is decided by Google; showing several ads in a row is not allowed.
 */
export const ADMOB = {
  interstitialId: 'ca-app-pub-4627275022118882/4303920438',
};
const store = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* private mode */ } return null; };
/** Users under 16 (set in the settings): no personalised ads, no tracking prompt (Art. 8 DSGVO). */
export const isUnder16 = () => store('hs-under16') === '1';
export const setUnder16 = (on: boolean) => { store('hs-under16', on ? '1' : '0'); };
// Test builds (Xcode, TestFlight) request Google's test ads, the App Store version real ones.
// The app finds out itself where it comes from (HandwriteNative.adContext), so no build switch
// can be forgotten. With isTesting the plugin replaces our ad unit with Google's test unit.
let TESTING = true;

type AdMobModule = typeof import('@capacitor-community/admob');
let mod: Promise<AdMobModule> | undefined, ready: Promise<boolean> | undefined, loading: Promise<boolean> | undefined;
let interstitialReady = false;
const load = () => (mod ??= import('@capacitor-community/admob'));
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Asks for consent (GDPR form and Apple's tracking prompt) once, then starts AdMob. */
export function initAds(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  return (ready ??= (async () => {
    try {
      const { AdMob, AdmobConsentStatus } = await load();
      const context = await HandwriteNative.adContext().catch(() => null);
      TESTING = context?.distribution !== 'appstore';
      const { MaxAdContentRating } = await load(), minor = isUnder16();
      const consent = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: minor });
      const finalConsent = consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED
        ? await AdMob.showConsentForm() : consent;
      if (!finalConsent.canRequestAds) return false;
      const tracking = await AdMob.trackingAuthorizationStatus();
      // Under 16: no tracking prompt at all; ads stay non-personalised.
      // Declined in Google's form: do not ask a second time with Apple's tracking prompt.
      const declined = (await HandwriteNative.adContext().catch(() => null))?.storageConsent === false;
      if (!minor && !declined && tracking.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      // School app: only ads rated for general audiences with parental guidance.
      await AdMob.initialize({ initializeForTesting: TESTING, tagForUnderAgeOfConsent: minor, maxAdContentRating: MaxAdContentRating.ParentalGuidance });
      await mute();
      void prepareInterstitial();
      return true;
    } catch (error) { console.warn('[AdMob] Initialization failed', error); return false; }
  })().then(ok => { if (!ok) ready = undefined; return ok; }));
}

/** Ads always start without sound: the app is used in class. Set before every ad, to be safe. */
async function mute() {
  try { const { AdMob } = await load(); await AdMob.setApplicationMuted({ muted: true }); await AdMob.setApplicationVolume({ volume: 0 }); } catch { /* older SDK: nothing to do */ }
}

function prepareInterstitial() {
  return (loading ??= (async () => {
    try { const { AdMob } = await load(); await AdMob.prepareInterstitial({ adId: ADMOB.interstitialId, isTesting: TESTING }); interstitialReady = true; }
    catch (error) { interstitialReady = false; console.warn('[AdMob] Interstitial load failed', error); }
    finally { loading = undefined; }
    return interstitialReady;
  })());
}

/**
 * Returns true only after an interstitial was actually shown and dismissed.
 * The caller may continue when AdMob has no ad to serve. An attempted ad must
 * never block the app indefinitely, including during AdMob's review period.
 */
export async function showInterstitialAd(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  if (!(await initAds())) return false;
  if (!interstitialReady) await Promise.race([prepareInterstitial(), wait(8000)]);
  if (!interstitialReady) return false;
  let handles: { remove: () => Promise<void> }[] = [];
  try {
    const { AdMob, InterstitialAdPluginEvents } = await load();
    interstitialReady = false;
    let finish = (_shown: boolean) => {};
    const closed = new Promise<boolean>(resolve => { finish = resolve; });
    handles = await Promise.all([AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish(true)), AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => finish(false))]);
    await mute();
    await AdMob.showInterstitial();
    return await Promise.race([closed, wait(90000).then(() => false)]);
  } catch (error) { console.warn('[AdMob] Interstitial display failed', error); return false; }
  finally {
    await Promise.all(handles.map(h => h.remove().catch(() => {})));
    void prepareInterstitial();
  }
}

/** True in the native app, where ads can be shown. */
export const adsAvailable = () => Capacitor.isNativePlatform() || (import.meta.env.DEV && location.search.includes('ads'));

/** Lets people change their ad consent later, as the GDPR requires. */
export async function showAdPrivacyOptions() {
  if (!(await initAds())) return false;
  try { const { AdMob } = await load(); await AdMob.showPrivacyOptionsForm(); return true; } catch { return false; }
}
