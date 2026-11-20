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
import {AdChoice} from './AdChoice';
createRoot(document.getElementById('root')!).render(<StrictMode><AppErrorBoundary><App/></AppErrorBoundary><UpdateBanner/><AdChoice/><OfflineGate/></StrictMode>);
// The native iOS app ships all files inside the app bundle: no service worker and no web ads there.
const native=Capacitor.isNativePlatform();if(native)document.documentElement.classList.add('native-app');
if(!native&&'serviceWorker' in navigator && !import.meta.env?.DEV) window.addEventListener('load',()=>{void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});});
