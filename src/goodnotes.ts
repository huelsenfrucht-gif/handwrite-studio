import JSZip from 'jszip';
import { HIGHLIGHT_COLORS, PAGE, type Note, type Profile, type Stroke } from './model';
import { layout, resolvedDrawingInk, resolvedStrokes } from './engine';
import { download, safeName } from './export';
import { GOODNOTES_TEMPLATES } from './goodnotesTemplates';

const GN_SCALE=11/6,PDF_SCALE=595.28/PAGE.width,TPL_SCHEMA='vuA(v)A(S(uu))A(S(uuuu))vA(f)';
const UUID_RE=/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g;
const KEEP_IDS=new Set(['5A53E89E-F4C2-4548-8DD3-E9DF9FB4592E']);
const latin1={decode:(u:Uint8Array)=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,i+0x8000));return s;},encode:(s:string)=>Uint8Array.from(s,c=>c.charCodeAt(0))};
type Value=bigint|Uint8Array;type Field={f:number;wt:number;v:Value};
const pb={
 varint(n:number|bigint){let v=typeof n==='bigint'?n:BigInt(n),out:number[]=[];do{let b=Number(v&0x7fn);v>>=7n;if(v)b|=128;out.push(b);}while(v);return Uint8Array.from(out);},
 concat(parts:Uint8Array[]){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;},
 v(f:number,n:number|bigint){return pb.concat([pb.varint(f*8),pb.varint(n)]);},
 bytes(f:number,b:Uint8Array){return pb.concat([pb.varint(f*8+2),pb.varint(b.length),b]);},
 str(f:number,s:string){return pb.bytes(f,new TextEncoder().encode(s));},
 f32(f:number,x:number){const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,x,true);return pb.concat([pb.varint(f*8+5),b]);},
 fields(b:Uint8Array){const out:Field[]=[];let i=0;const rv=()=>{let r=0n,s=0n,c=0;do{if(i>=b.length)throw new Error('Ungültiges Goodnotes-Protobuf.');c=b[i++];r|=BigInt(c&127)<<s;s+=7n;}while(c&128);return r;};while(i<b.length){const key=Number(rv()),f=key>>3,wt=key&7;let v:Value;if(wt===0)v=rv();else if(wt===1){v=b.subarray(i,i+8);i+=8;}else if(wt===5){v=b.subarray(i,i+4);i+=4;}else if(wt===2){const n=Number(rv());v=b.subarray(i,i+n);i+=n;}else throw new Error('Nicht unterstützter Goodnotes-Feldtyp.');if(!f||i>b.length)throw new Error('Beschädigtes Goodnotes-Protobuf.');out.push({f,wt,v});}return out;},
 records(b:Uint8Array){const out:Uint8Array[]=[];let i=0;while(i<b.length){let n=0,m=1,c=0;do{c=b[i++];n+=(c&127)*m;m*=128;}while(c&128);out.push(b.subarray(i,i+n));i+=n;}return out;}
};
function bv41(raw:Uint8Array){const n=raw.length,head=[Math.min(n,15)<<4];if(n>=15){let r=n-15;while(r>=255){head.push(255);r-=255;}head.push(r);}const block=pb.concat([Uint8Array.from(head),raw]),hdr=new Uint8Array(12),dv=new DataView(hdr.buffer);hdr.set(latin1.encode('bv41'));dv.setUint32(4,n,true);dv.setUint32(8,block.length,true);return pb.concat([hdr,block,latin1.encode('bv4$')]);}
function strokeBlob(points:Stroke,width:number){const pts=points.length===1?[points[0],points[0]]:points,segs=pts.length-1,n=segs+1,schema=latin1.encode(`${TPL_SCHEMA}\0`),dataLen=2+4+4+2*n+4+8+4+16*segs+2+4,total=8+schema.length+dataLen,buf=new Uint8Array(total),dv=new DataView(buf.buffer);buf.set(latin1.encode('tpl\0'));dv.setUint32(4,total,true);buf.set(schema,8);let o=8+schema.length;dv.setUint16(o,2,true);o+=2;dv.setFloat32(o,width,true);o+=4;dv.setUint32(o,n,true);o+=4;for(let i=0;i<n;i++){dv.setUint16(o,i===0?0:1,true);o+=2;}dv.setUint32(o,1,true);o+=4;dv.setFloat32(o,pts[0].x,true);dv.setFloat32(o+4,pts[0].y,true);o+=8;dv.setUint32(o,segs,true);o+=4;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];dv.setFloat32(o,(a.x+b.x)/2,true);dv.setFloat32(o+4,(a.y+b.y)/2,true);dv.setFloat32(o+8,b.x,true);dv.setFloat32(o+12,b.y,true);o+=16;}dv.setUint16(o,1,true);o+=2;dv.setUint32(o,0,true);return buf;}
const uuid=()=>crypto.randomUUID().toUpperCase(),rand32=()=>crypto.getRandomValues(new Uint32Array(1))[0];
function hexRGBA(hex:string,alpha=1){const n=parseInt(hex.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,alpha];}
function strokeRecords(points:Stroke,width:number,color:string,author:bigint,seq:number,order:number,alpha=1){const sid=uuid(),clock=pb.concat([pb.v(1,1),pb.v(2,rand32())]),hdr=pb.concat([pb.str(1,sid),pb.bytes(2,clock),pb.v(8,author),pb.v(9,seq),pb.v(14,5381),pb.v(16,24)]),rgba=hexRGBA(color,alpha),colorData=pb.concat(rgba.map((c,i)=>c?pb.f32(i+1,c):new Uint8Array())),sortKey=pb.concat([order?pb.v(1,order):new Uint8Array(),pb.v(2,rand32())]),body=pb.concat([pb.str(1,sid),pb.bytes(2,bv41(strokeBlob(points,width))),pb.bytes(4,colorData),pb.bytes(6,new Uint8Array()),pb.bytes(7,pb.bytes(1,sortKey)),pb.bytes(9,new Uint8Array()),pb.bytes(15,clock),pb.bytes(20,new Uint8Array()),pb.v(21,24)]),record=pb.bytes(7,body);return pb.concat([pb.varint(hdr.length),hdr,pb.varint(record.length),record]);}
function authorOf(bytes:Uint8Array){for(const r of pb.records(bytes))for(const top of pb.fields(r)){if(top.wt!==2||top.f<10)continue;try{const hit=pb.fields(top.v as Uint8Array).find(x=>x.f===13&&x.wt===0);if(hit)return hit.v as bigint;}catch{}}throw new Error('Die Goodnotes-Vorlage enthält keine Autorenkennung.');}
function remapper(){const stems=new Map<string,string>();return(s:string)=>s.replace(UUID_RE,u=>{if(KEEP_IDS.has(u))return u;const stem=u.slice(0,-4);if(!stems.has(stem))stems.set(stem,uuid().slice(0,-4));return stems.get(stem)!+u.slice(-4);});}
function templateBytes(paper:Note['settings']['paper']){const raw=atob(GOODNOTES_TEMPLATES[paper==='custom'?'blank':paper].data),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
type Ink={points:Stroke;width:number;color:string;alpha?:number};
export function pageInk(note:Note,profiles:Profile[],page:number):Ink[]{const data=layout(note,profiles),scale=PDF_SCALE*GN_SCALE,toGN=(s:Stroke)=>s.map(p=>({...p,x:p.x*scale,y:p.y*scale})),ink:Ink[]=[];
 // Highlighted headings first, so the handwriting lies on top of the marker.
 for(const h of data.highlights.filter(h=>h.page===page))ink.push({points:toGN([{x:h.x+h.height/2,y:h.y+h.height/2,p:.5},{x:h.x+h.width-h.height/2,y:h.y+h.height/2,p:.5}]),width:h.height*scale,color:note.settings.highlightColor||HIGHLIGHT_COLORS[0],alpha:.5});for(const g of data.glyphs.filter(g=>g.page===page)){const r=resolvedStrokes(g,note);for(const s of r.strokes)ink.push({points:toGN(s),width:note.settings.penWidth*scale,color:r.color});}for(const a of note.annotations.filter(a=>a.page===page))ink.push({points:toGN(a.points),width:a.width*scale,color:a.color});for(const d of (note.drawings||[]).filter(d=>d.page===page))for(const drawingInk of resolvedDrawingInk(d))ink.push({points:toGN(drawingInk.points),width:d.penWidth*d.scale*scale,color:drawingInk.color});return ink.filter(x=>x.points.length>0);}
async function buildPage(note:Note,profiles:Profile[],page:number){const zip=await JSZip.loadAsync(templateBytes(note.settings.paper)),names=Object.keys(zip.files).filter(n=>!zip.files[n].dir),notePath=names.find(n=>n.startsWith('notes/')),events=zip.file('index.events.pb');if(!notePath||!events)throw new Error('Unvollständige Goodnotes-Vorlage.');const author=authorOf(await events.async('uint8array')),strokes=pageInk(note,profiles,page),records=pb.concat(strokes.map((s,i)=>strokeRecords(s.points,s.width,s.color,author,1000+i,i,s.alpha))),remap=remapper(),out=new JSZip();for(const name of names){let bytes=name===notePath?records:await zip.file(name)!.async('uint8array');if(name.endsWith('.pb')||name.startsWith('notes/')||name.startsWith('search/'))bytes=latin1.encode(remap(latin1.decode(bytes)));out.file(remap(name),bytes,{compression:'DEFLATE',compressionOptions:{level:6},date:new Date(),createFolders:false});}return out.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});}
const MERGED_INDEXES=new Set(['index.events.pb','index.notes.pb','index.attachments.pb','index.search.pb']);
async function combinePages(pages:Uint8Array[]){
 if(pages.length===1)return pages[0];
 const out=new JSZip(),merged=new Map<string,Uint8Array[]>();
 for(let i=0;i<pages.length;i++){
  const zip=await JSZip.loadAsync(pages[i]);
  for(const [name,file] of Object.entries(zip.files)){
   if(file.dir)continue;
   const bytes=await file.async('uint8array');
   // Every page carries its own paper attachment; all index files must list
   // each page's entries, otherwise Goodnotes shows pages 2+ without paper.
   if(MERGED_INDEXES.has(name)){merged.set(name,[...(merged.get(name)||[]),bytes]);continue;}
   if(i===0||name.startsWith('notes/')||name.startsWith('attachments/')||name.startsWith('search/'))out.file(name,bytes,{compression:'DEFLATE',compressionOptions:{level:6},date:new Date(),createFolders:false});
  }
 }
 for(const [name,parts] of merged)out.file(name,pb.concat(parts),{compression:'DEFLATE',compressionOptions:{level:6},date:new Date(),createFolders:false});
 return out.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
}
export async function createGoodnotesFiles(note:Note,profiles:Profile[]){const count=layout(note,profiles).pages,pages:Uint8Array[]=[];for(let page=0;page<count;page++)pages.push(await buildPage(note,profiles,page));return[{name:`${safeName(note.title)}.goodnotes`,data:await combinePages(pages)}];}
export async function exportGoodnotes(note:Note,profiles:Profile[]){const [file]=await createGoodnotesFiles(note,profiles);await download(new Blob([file.data as BlobPart],{type:'application/octet-stream'}),file.name);return layout(note,profiles).pages;}
