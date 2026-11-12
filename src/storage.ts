import { type Library, initialLibrary } from './model';
import { recalibrateWord } from './contextual';
const DB='handwrite-studio';
async function db(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('library');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function loadLibrary():Promise<Library>{const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction('library').objectStore('library').get('current');r.onsuccess=()=>{try{resolve(r.result?validateLibrary(r.result):initialLibrary());}catch(e){reject(e);}};r.onerror=()=>reject(r.error);});}finally{d.close();}}
export async function saveLibrary(library:Library){const d=await db();try{await new Promise<void>((resolve,reject)=>{const tx=d.transaction('library','readwrite');tx.objectStore('library').put(library,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}finally{d.close();}}
export function validateLibrary(value:unknown):Library {
 const fail=()=>{throw new Error('Ungültige Studio-Sicherung. Bitte eine unveränderte .handwrite.json-Datei wählen.');};
 if(!value||typeof value!=='object')return fail();const v=value as Library;
 if(v.version!==1||!Array.isArray(v.profiles)||!Array.isArray(v.notes)||v.notes.length<1||v.notes.length>500||v.profiles.length>100)return fail();
 const str=(v:unknown,max=200000)=>typeof v==='string'&&v.length<=max;
 const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const color=(v:unknown)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
 let points=0;
 const stroke=(s:unknown)=>Array.isArray(s)&&s.length>0&&s.length<=100000&&s.every(p=>{points++;return p&&num(p.x,-10000,10000)&&num(p.y,-10000,10000)&&(p.p===undefined||num(p.p,0,1));});
 if(new Set(v.notes.map(n=>n.id)).size!==v.notes.length||new Set(v.profiles.map(p=>p.id)).size!==v.profiles.length)return fail();
 for(const p of v.profiles){if(!p||!str(p.id,100)||p.id==='demo'||!str(p.name,100)||!str(p.created,100)||!p.glyphs||typeof p.glyphs!=='object'||Array.isArray(p.glyphs))return fail();
  if(p.words!==undefined){if(!Array.isArray(p.words)||p.words.length>2000)return fail();
   for(const w of p.words){if(!w||!str(w.id,100)||!str(w.text,24)||!(/^[\p{L}\p{N}]{2,24}$/u.test(w.text))||!['pen','photo'].includes(w.source)||!num(w.width,1,6000)||!Array.isArray(w.strokes)||!w.strokes.length||w.strokes.length>10000||!w.strokes.every(stroke)||!Array.isArray(w.cuts)||w.cuts.length!==Array.from(w.text).length+1||w.cuts[0]!==0||Math.abs(w.cuts.at(-1)!-w.width)>.001||!w.cuts.every((c,i)=>num(c,0,w.width)&&(i===0||c>w.cuts[i-1])))return fail();
    const m=w.metrics;if(!m||!num(m.slant,-.7,.7)||!num(m.baselineSpread,0,12)||!num(m.joining,0,1)||!num(m.spacing,0,6000))return fail();
   }
  }
  for(const [c,gs] of Object.entries(p.glyphs)){if(Array.from(c).length!==1||!Array.isArray(gs)||!gs.length||gs.length>30)return fail();for(const g of gs)if(!g||!['pen','photo','demo'].includes(g.source)||!num(g.advance,1,200)||!Array.isArray(g.strokes)||g.strokes.length>10000||!g.strokes.length||!g.strokes.every(stroke))return fail();}
 }
 for(const n of v.notes){if(!n||!str(n.id,100)||!str(n.title,200)||!str(n.text,20000)||!str(n.renderedText,20000)||!str(n.updated,100))return fail();const s=n.settings;
  if(!s||!num(s.size,12,60)||!num(s.lineHeight,20,100)||!num(s.variation,0,100)||!num(s.penWidth,.5,6)||!num(s.seed,0,2147483647)||!color(s.color)||!['lined','grid','blank'].includes(s.paper)||(s.profileId!=='demo'&&!v.profiles.some(p=>p.id===s.profileId)))return fail();
  if(!n.edits||typeof n.edits!=='object'||Array.isArray(n.edits)||!Array.isArray(n.annotations)||n.annotations.length>10000)return fail();
  for(const [id,e] of Object.entries(n.edits))if(!/^\d+$/.test(id)||!e||(e.dx!==undefined&&!num(e.dx,-10000,10000))||(e.dy!==undefined&&!num(e.dy,-10000,10000))||(e.deleted!==undefined&&typeof e.deleted!=='boolean')||(e.color!==undefined&&!color(e.color))||(e.hiddenStrokes!==undefined&&(!Array.isArray(e.hiddenStrokes)||!e.hiddenStrokes.every(x=>num(x,0,100000)&&Number.isInteger(x)))))return fail();
  for(const a of n.annotations)if(!a||!str(a.id,100)||!num(a.page,0,1000)||!Number.isInteger(a.page)||!color(a.color)||!num(a.width,.5,6)||!stroke(a.points))return fail();
  if(n.drawings!==undefined){if(!Array.isArray(n.drawings)||n.drawings.length>1000)return fail();for(const d of n.drawings)if(!d||!str(d.id,100)||!str(d.name,100)||!num(d.page,0,1000)||!Number.isInteger(d.page)||!Array.isArray(d.strokes)||!d.strokes.length||d.strokes.length>20000||!d.strokes.every(stroke)||!num(d.x,-10000,10000)||!num(d.y,-10000,10000)||!num(d.scale,.001,100)||!num(d.width,1,10000)||!num(d.height,1,10000)||!color(d.color)||!num(d.penWidth,.5,20)||(d.deleted!==undefined&&typeof d.deleted!=='boolean')||(d.hiddenStrokes!==undefined&&(!Array.isArray(d.hiddenStrokes)||!d.hiddenStrokes.every(x=>num(x,0,100000)&&Number.isInteger(x)))))return fail();}
 }
 if(points>2000000||!v.notes.some(n=>n.id===v.activeId))return fail();
 for(const p of v.profiles)if(p.words)p.words=p.words.map(recalibrateWord);
 return v;
}
