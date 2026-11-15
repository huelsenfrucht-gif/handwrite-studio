import {useEffect,useState} from 'react';

// A home-screen web app on iPad has no reload button. The service worker
// installs new versions in the background (skipWaiting + clients.claim), so a
// change of controller means a newer version is ready: offer a one-tap reload.
const CHECK_EVERY=15*60*1000;

export function UpdateBanner(){
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(!('serviceWorker' in navigator)||import.meta.env.DEV)return;
  const sw=navigator.serviceWorker;let hadController=!!sw.controller,registration:ServiceWorkerRegistration|undefined;
  const onChange=()=>{if(hadController)setReady(true);hadController=true;};
  const check=()=>{void registration?.update().catch(()=>{});};
  const onVisible=()=>{if(document.visibilityState==='visible')check();};
  sw.addEventListener('controllerchange',onChange);
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('focus',check);
  void sw.ready.then(r=>{registration=r;}).catch(()=>{});
  const timer=window.setInterval(check,CHECK_EVERY);
  return()=>{sw.removeEventListener('controllerchange',onChange);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',check);window.clearInterval(timer);};
 },[]);
 if(!ready)return null;
 return <div className="update-banner" role="status">
  <span>Eine neue Version ist verfügbar.</span>
  <button className="update-reload" onClick={()=>location.reload()}>Neueste Version laden</button>
  <button className="update-later" onClick={()=>setReady(false)} aria-label="Später">Später</button>
 </div>;
}
