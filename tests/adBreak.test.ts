import { afterEach, describe, expect, it, vi } from 'vitest';

const { showInterstitialAd } = vi.hoisted(() => ({ showInterstitialAd: vi.fn<() => Promise<boolean>>() }));
vi.mock('../src/nativeAds', () => ({ adsAvailable: () => true, showInterstitialAd }));

import { adBreak } from '../src/AdChoice';

afterEach(() => { showInterstitialAd.mockReset(); });

describe('ad break', () => {
  it('keeps the action usable when AdMob cannot serve an ad', async () => {
    showInterstitialAd.mockResolvedValue(false);
    expect(await adBreak({ kind: 'record' })).toBe(true);
    expect(showInterstitialAd).toHaveBeenCalledOnce();
  });

  it('continues after the ad has been shown and closed', async () => {
    showInterstitialAd.mockResolvedValue(true);
    expect(await adBreak({ kind: 'record' })).toBe(true);
    expect(showInterstitialAd).toHaveBeenCalledOnce();
  });
});
