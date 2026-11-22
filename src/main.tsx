import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {AppErrorBoundary} from './AppErrorBoundary';
import './styles.css';
import './guided.css';
import './drawing.css';
import './fixes.css';
import './library.css';
import './theme.css';
import {UpdateBanner} from './UpdateBanner';
import {OfflineGate} from './OfflineGate';
createRoot(document.getElementById('root')!).render(<StrictMode><AppErrorBoundary><App/></AppErrorBoundary><UpdateBanner/><OfflineGate/></StrictMode>);
// Writing with the pencil on a pad must never leave a text field focused in the background:
// iOS would then show its copy/paste menu for that field. The pads stop the browser from moving
// the focus themselves (so they can capture the stroke), so it is released here.
document.addEventListener('pointerdown',e=>{const target=e.target as Element|null;if(!target?.closest?.('.training-pad, svg.paper'))return;const a=document.activeElement as HTMLElement|null;if(a&&a!==document.body&&a.matches('input, textarea, select, [contenteditable]'))a.blur();window.getSelection()?.removeAllRanges();},true);
// The native iOS app ships all files inside the app bundle: no service worker and no web ads there.
const native=Capacitor.isNativePlatform();if(native)document.documentElement.classList.add('native-app');
if(!native&&'serviceWorker' in navigator && !import.meta.env?.DEV) window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});});
