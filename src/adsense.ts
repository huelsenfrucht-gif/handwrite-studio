type AdSenseConfig={client?:string;autoAds?:boolean};

declare global {
 interface Window { HANDWRITE_ADSENSE?:AdSenseConfig; }
}

const CLIENT_PATTERN=/^ca-pub-\d{16}$/;

export const isAdSenseClient=(value:string)=>CLIENT_PATTERN.test(value.trim());

export function getAdSenseConfig():AdSenseConfig{
 const config=window.HANDWRITE_ADSENSE||{};
 return{client:(config.client||'').trim(),autoAds:config.autoAds!==false};
}

export function loadAdSense():boolean{
 const {client,autoAds}=getAdSenseConfig();
 if(!client||!isAdSenseClient(client)||!autoAds)return false;
 if(document.querySelector('script[data-handwrite-adsense]'))return true;
 const script=document.createElement('script');
 script.async=true;
 script.crossOrigin='anonymous';
 script.dataset.handwriteAdsense='true';
 script.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
 document.head.append(script);
 return true;
}
