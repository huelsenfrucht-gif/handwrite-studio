import { readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.filter(e=>e.name!=='sw.js').map(e=>e.isDirectory()?files(`${dir}/${e.name}`):`${dir}/${e.name}`))).flat();}
const base=(process.env.BASE_PATH||'/').replace(/\/?$/,'/');
const paths=await files('dist'),hash=createHash('sha256');for(const p of paths)hash.update(await readFile(p));const version=hash.digest('hex').slice(0,12);
await writeFile('dist/sw.js',`const CACHE='handwrite-${version}';const ASSETS=${JSON.stringify(paths.map(p=>base+p.slice('dist/'.length)).concat(base))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('handwrite-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('${base}index.html')));return;}if(ASSETS.includes(u.pathname))e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`);
console.log(`Offline cache ${version}: ${paths.length} files`);
