import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Library } from './model';
import { validateLibrary } from './storage';
const env=(import.meta as unknown as {env:Record<string,string>}).env;
const client=env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_ANON_KEY?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY):null;
export function Cloud({library,onRestore}:{library:Library;onRestore:(l:Library)=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[user,setUser]=useState<string|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!client)return;void client.auth.getUser().then(({data})=>setUser(data.user?.email||null));const {data}=client.auth.onAuthStateChange((_e,s)=>setUser(s?.user.email||null));return()=>data.subscription.unsubscribe();},[]);
 const action=async(kind:'login'|'signup'|'upload'|'download'|'logout')=>{if(!client)return;setBusy(true);setStatus('');try{
  if(kind==='login'){const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;setPassword('');}
  if(kind==='signup'){const {error}=await client.auth.signUp({email,password});if(error)throw error;setStatus('Konto angelegt. Prüfe dein Postfach, falls eine Bestätigung verlangt wird.');setPassword('');}
  if(kind==='logout'){await client.auth.signOut();setStatus('Abgemeldet. Deine lokalen Daten bleiben erhalten.');}
  if(kind==='upload'||kind==='download'){const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Bitte zuerst anmelden.');
   if(kind==='upload'){if(!confirm('Die Cloud-Sicherung durch den Stand dieses Geräts ersetzen?'))return;const {error}=await client.from('handwrite_backups').upsert({user_id:user.id,payload:library,updated_at:new Date().toISOString()});if(error)throw error;setStatus('Cloud-Sicherung gespeichert.');}
   else {const {data,error}=await client.from('handwrite_backups').select('payload').eq('user_id',user.id).single();if(error)throw error;const l=validateLibrary(data.payload);if(confirm('Den lokalen Stand durch die Cloud-Sicherung ersetzen? Sichere vorher bei Bedarf dieses Gerät.'))onRestore(l);}
  }
 }catch(e){setStatus((e as Error).message);}finally{setBusy(false);}};
 if(!client)return <div className="setting-card"><h3>Cloud-Synchronisierung</h3><p>Supabase ist noch nicht verbunden. Deine Dokumente und Handschriften werden auf diesem Gerät gespeichert. Mit einer Studio-Sicherung kannst du sie auf ein anderes Gerät mitnehmen.</p><span className="status-tag">Lokal aktiv · Cloud nicht eingerichtet</span></div>;
 return <div className="setting-card"><h3>Cloud-Sicherung</h3><p>Eine bewusste Sicherung deines gesamten Studios in deiner verbundenen Supabase-Instanz. Es werden keine Fotos gespeichert.</p>{user?<><p>Angemeldet als {user}</p><div className="button-row"><button className="button" disabled={busy} onClick={()=>void action('upload')}>In Cloud sichern</button><button className="button" disabled={busy} onClick={()=>void action('download')}>Cloud-Stand laden</button><button className="text-button" disabled={busy} onClick={()=>void action('logout')}>Abmelden</button></div></>:<><label>E-Mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Passwort<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="button-row"><button className="button primary" disabled={busy||!email||password.length<8} onClick={()=>void action('login')}>Anmelden</button><button className="button" disabled={busy||!email||password.length<8} onClick={()=>void action('signup')}>Konto erstellen</button></div></>}{status&&<p role="status">{status}</p>}</div>;
}
