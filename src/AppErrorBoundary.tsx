import {Component,type ErrorInfo,type ReactNode} from 'react';
import {AlertTriangle,Download,RotateCcw} from 'lucide-react';

type State={error:Error|null};
export class AppErrorBoundary extends Component<{children:ReactNode},State>{
 state:State={error:null};
 static getDerivedStateFromError(error:Error){return{error};}
 componentDidCatch(error:Error,info:ErrorInfo){console.error('Handwritten recovered from an app error',error,info.componentStack);}
 render(){if(!this.state.error)return this.props.children;return <main className="load-screen crash-screen"><AlertTriangle size={44}/><h1>Die App wurde sicher angehalten.</h1><p>Deine lokal gespeicherten Dokumente und Handschriften bleiben erhalten. Lade die Oberfläche neu; falls der Fehler wiederkommt, lade danach in den Einstellungen eine Sicherung herunter.</p><div className="button-row"><button className="button primary" onClick={()=>location.reload()}><RotateCcw size={16}/>App neu laden</button><button className="button" onClick={()=>{const request=indexedDB.open('handwrite-studio',1);request.onsuccess=()=>{const read=request.result.transaction('library').objectStore('library').get('current');read.onsuccess=()=>{if(!read.result)return;const blob=new Blob([JSON.stringify(read.result)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Handwritten-Notfallsicherung.handwrite.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};};}}><Download size={16}/>Notfallsicherung</button></div></main>;}
}
