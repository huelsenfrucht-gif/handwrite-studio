import { Capacitor } from '@capacitor/core';

/**
 * Google AdMob ads for the native iOS app (the website keeps using AdSense).
 *
 * Replace the IDs below with your own from https://admob.google.com once the
 * app is registered there. Until then Google's official test ads are shown,
 * which never earn money but also never risk the account.
 * The app ID also has to be set in ios/App/App/Info.plist (GADApplicationIdentifier).
 */
export const ADMOB = {
  bannerId: 'ca-app-pub-3940256099942544/2435281174',
  interstitialId: 'ca-app-pub-3940256099942544/4411468910',
};
const TESTING = ADMOB.bannerId.startsWith('ca-app-pub-3940256099942544');
// Full-screen ads only after every 2nd export and at most every 4 minutes.
const EXPORTS_PER_AD = 2, MIN_INTERSTITIAL_GAP = 4 * 60 * 1000;

type AdMobModule = typeof import('@capacitor-community/admob');
let mod: Promise<AdMobModule> | undefined, ready: Promise<boolean> | undefined;
let bannerShown = false, bannerWanted = false, interstitialReady = false, exports = 0, lastInterstitial = 0;
const load = () => (mod ??= import('@capacitor-community/admob'));

/** Asks for consent (GDPR form and Apple's tracking prompt) once, then starts AdMob. */
export function initAds(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  return (ready ??= (async () => {
    try {
      const { AdMob, AdmobConsentStatus, BannerAdPluginEvents } = await load();
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
      const tracking = await AdMob.trackingAuthorizationStatus();
      if (tracking.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      await AdMob.initialize({ initializeForTesting: TESTING });
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, size => document.documentElement.style.setProperty('--ad-height', `${Math.round(size.height)}px`));
      void prepareInterstitial();
      return true;
    } catch { return false; }
  })());
}

async function prepareInterstitial() {
  try { const { AdMob } = await load(); await AdMob.prepareInterstitial({ adId: ADMOB.interstitialId, isTesting: TESTING }); interstitialReady = true; } catch { interstitialReady = false; }
}

/** Shows the banner at the bottom of the library and hides it everywhere else. */
export async function setBannerVisible(visible: boolean) {
  bannerWanted = visible;
  if (!(await initAds())) return;
  const { AdMob, BannerAdPosition, BannerAdSize } = await load();
  if (bannerWanted !== visible) return;
  try {
    if (visible && !bannerShown) { await AdMob.showBanner({ adId: ADMOB.bannerId, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: 0, isTesting: TESTING }); bannerShown = true; }
    else if (visible) await AdMob.resumeBanner();
    else if (bannerShown) await AdMob.hideBanner();
    document.documentElement.classList.toggle('ad-banner', visible);
  } catch { document.documentElement.classList.remove('ad-banner'); }
}

/** Called after a successful export: now and then a full-screen ad, never mid-work. */
export async function afterExport() {
  exports++;
  if (exports < EXPORTS_PER_AD || Date.now() - lastInterstitial < MIN_INTERSTITIAL_GAP || !interstitialReady || !(await initAds())) return;
  try { const { AdMob } = await load(); interstitialReady = false; await AdMob.showInterstitial(); exports = 0; lastInterstitial = Date.now(); } catch { /* no fill: try again next time */ }
  void prepareInterstitial();
}

/** Lets people change their ad consent later, as the GDPR requires. */
export async function showAdPrivacyOptions() {
  if (!(await initAds())) return false;
  try { const { AdMob } = await load(); await AdMob.showPrivacyOptionsForm(); return true; } catch { return false; }
}
