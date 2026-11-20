import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { WifiOff } from 'lucide-react';
import { t } from './i18n';
import { useLiveLecture } from './LectureSheet';

/**
 * Handwritten is free because it shows ads, so the app needs an internet connection (Wi-Fi or
 * mobile data) to be used. Without one, a full-screen notice covers the app until the connection
 * is back. A recording that is already running is never interrupted: it keeps going and can be
 * finished; the notice appears once it has stopped.
 * Only in the iPad app (the website shows no ads of its own here).
 */
export function useOnline() {
  // Development only: “?offline” shows the notice in the browser.
  const [online, setOnline] = useState(() => !(import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('offline')));
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let stop: (() => void) | undefined, gone = false;
    void import('@capacitor/network').then(async ({ Network }) => {
      const s = await Network.getStatus().catch(() => ({ connected: navigator.onLine }));
      if (!gone) setOnline(s.connected);
      const h = await Network.addListener('networkStatusChange', st => setOnline(st.connected));
      if (gone) void h.remove(); else stop = () => void h.remove();
    }).catch(() => {
      // Fallback: the browser's own idea of the connection.
      const on = () => setOnline(navigator.onLine);
      on(); window.addEventListener('online', on); window.addEventListener('offline', on);
      stop = () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
    });
    return () => { gone = true; stop?.(); };
  }, []);
  return online;
}

export function OfflineGate() {
  const online = useOnline();
  const [live] = useLiveLecture();
  const recording = !!live && (live.state === 'recording' || live.state === 'paused');
  if (online || recording) return null;
  return <div className="offline-gate" role="alertdialog" aria-modal="true" aria-labelledby="offline-title" aria-describedby="offline-text">
    <div className="offline-card">
      <span className="offline-icon"><WifiOff size={30} strokeWidth={1.8} /></span>
      <h2 id="offline-title">{t('Keine Internetverbindung')}</h2>
      <p id="offline-text">{t('Handwritten ist kostenlos, weil die App Werbung zeigt. Dafür braucht sie eine Internetverbindung. Verbinde das iPad mit dem WLAN oder schalte mobile Daten ein – danach geht es sofort weiter.')}</p>
      <p className="offline-fine">{t('Deine Dokumente und Handschriften bleiben sicher auf dem iPad gespeichert.')}</p>
    </div>
  </div>;
}
