import { Capacitor } from '@capacitor/core';
import { GOODNOTES, HIGHLIGHT_COLORS, PAGE, paperRules, pathData, type Note, type Profile, type Library, type Template } from './model';
import { layout, resolvedDrawingInk, resolvedRaster, resolvedStrokes } from './engine';
import { t } from './i18n';
type JsPDFConstructor=typeof import('jspdf').jsPDF;
async function loadJsPDF():Promise<JsPDFConstructor>{
 try{return(await import('jspdf')).jsPDF;}catch(primaryError){
  const root=window as typeof window&{jspdf?:{jsPDF:JsPDFConstructor}};
  if(root.jspdf?.jsPDF)return root.jspdf.jsPDF;
  await new Promise<void>((resolve,reject)=>{const old=document.querySelector<HTMLScriptElement>('script[data-jspdf-fallback]');if(old){old.addEventListener('load',()=>resolve(),{once:true});old.addEventListener('error',()=>reject(primaryError),{once:true});return;}const script=document.createElement('script');script.src=`${import.meta.env.BASE_URL}vendor/jspdf.umd.min.js`;script.dataset.jspdfFallback='true';script.onload=()=>resolve();script.onerror=()=>reject(primaryError);document.head.appendChild(script);});
  if(!root.jspdf?.jsPDF)throw primaryError;return root.jspdf.jsPDF;
 }
}
export const isNative=()=>Capacitor.isNativePlatform();
/** Saves a file: a browser download on the web, the iOS share sheet ("In Goodnotes öffnen", "In Dateien sichern") in the native app. */
export function download(data:Blob|string,name:string,type='application/json'):Promise<void> {const blob=data instanceof Blob?data:new Blob([data],{type});if(isNative())return shareNative(blob,name);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return Promise.resolve();}
async function shareNative(blob:Blob,name:string){
 const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
 const {uri}=await Filesystem.writeFile({path:name,data,directory:Directory.Cache});
 try{await Share.share({title:name,files:[uri]});}catch(e){if(!/cancel/i.test(String((e as Error)?.message||e)))throw e;}
}
export function safeName(name:string){return (name.replace(/[^\p{L}\p{N}\-_ ]/gu,'').trim()||t('Dokument')).slice(0,80);}
export function exportBackup(library:Library){return download(JSON.stringify(library),`Handwritten-${new Date().toISOString().slice(0,10)}.handwrite.json`);}
export async function createPDF(note:Note,profiles:Profile[],template?:Template){const jsPDF=await loadJsPDF(),{glyphs,pages,highlights}=layout(note,profiles);const pdf=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});const ratio=595.28/PAGE.width;
 for(let page=0;page<pages;page++){
  if(page)pdf.addPage();pdf.setFillColor('#ffffff');pdf.rect(0,0,595.28,841.89,'F');pdf.setLineWidth(GOODNOTES.width*ratio);pdf.setDrawColor(GOODNOTES.color);
  const background=note.settings.paper==='custom'?template?.pages[page]:undefined;if(background)pdf.addImage(background,'JPEG',0,0,595.28,841.89,`template-${page}`,'FAST');
  for(const r of paperRules(note.settings))pdf.line(r.x1*ratio,r.y1*ratio,r.x2*ratio,r.y2*ratio);
  // Headings marked with the highlighter: translucent bars under the handwriting.
  const bars=highlights.filter(h=>h.page===page);if(bars.length){const doc=pdf as unknown as {GState:new(o:{opacity:number})=>unknown;setGState:(g:unknown)=>void;saveGraphicsState:()=>void;restoreGraphicsState:()=>void};doc.saveGraphicsState();doc.setGState(new doc.GState({opacity:.55}));pdf.setFillColor(note.settings.highlightColor||HIGHLIGHT_COLORS[0]);for(const b of bars)pdf.roundedRect(b.x*ratio,b.y*ratio,b.width*ratio,b.height*ratio,2,2,'F');doc.restoreGraphicsState();}
  pdf.setLineCap('round');pdf.setLineJoin('round');
  const draw=(points:{x:number;y:number}[],color:string,width:number)=>{if(!points.length)return;pdf.setDrawColor(color);pdf.setFillColor(color);pdf.setLineWidth(width*ratio);if(points.length===1){pdf.circle(points[0].x*ratio,points[0].y*ratio,width*ratio/2,'F');return;}pdf.lines(points.slice(1).map((p,i)=>[(p.x-points[i].x)*ratio,(p.y-points[i].y)*ratio]),points[0].x*ratio,points[0].y*ratio,[1,1],'S',false);};
  for(const g of glyphs.filter(g=>g.page===page)){const raster=resolvedRaster(g,note);if(raster)pdf.addImage(raster.data,'PNG',raster.x*ratio,raster.y*ratio,raster.width*ratio,raster.height*ratio,undefined,'FAST');if(g.hiddenByRaster)continue;const r=resolvedStrokes(g,note);for(const s of r.strokes)draw(s,r.color,note.settings.penWidth);}
  for(const a of note.annotations.filter(a=>a.page===page))draw(a.points,a.color,a.width);
  for(const d of (note.drawings||[]).filter(d=>d.page===page))for(const ink of resolvedDrawingInk(d))draw(ink.points,ink.color,d.penWidth*d.scale);
 }
 pdf.setProperties({title:note.title,creator:'Handwritten',subject:t('Vektorhandschrift – PDF-Seiteninhalt, keine nativen Goodnotes-Stiftstriche')});return pdf;
}
export async function exportPDF(note:Note,profiles:Profile[],template?:Template){const pdf=await createPDF(note,profiles,template);await download(pdf.output('blob'),`${safeName(note.title)}.pdf`,'application/pdf');}
export function makeSVG(note:Note,profiles:Profile[],page:number,template?:Template){const {glyphs,highlights}=layout(note,profiles);const paths:string[]=[];
 const background=note.settings.paper==='custom'?template?.pages[page]:undefined;if(background)paths.push(`<image href="${background}" x="0" y="0" width="${PAGE.width}" height="${PAGE.height}" preserveAspectRatio="none"/>`);
 for(const r of paperRules(note.settings))paths.push(`<path d="M${r.x1.toFixed(2)} ${r.y1.toFixed(2)} L${r.x2.toFixed(2)} ${r.y2.toFixed(2)}" stroke="${GOODNOTES.color}" stroke-width="${GOODNOTES.width.toFixed(2)}"/>`);
 for(const h of highlights.filter(h=>h.page===page))paths.push(`<rect x="${h.x.toFixed(1)}" y="${h.y.toFixed(1)}" width="${h.width.toFixed(1)}" height="${h.height.toFixed(1)}" rx="3" fill="${note.settings.highlightColor||HIGHLIGHT_COLORS[0]}" fill-opacity="0.55"/>`);
 for(const g of glyphs.filter(g=>g.page===page)){const raster=resolvedRaster(g,note);if(raster)paths.push(`<image id="ai-word-${g.id}" href="${raster.data}" x="${raster.x}" y="${raster.y}" width="${raster.width}" height="${raster.height}" preserveAspectRatio="none"/>`);if(g.hiddenByRaster)continue;const r=resolvedStrokes(g,note);paths.push(`<g id="letter-${g.id}" fill="none" stroke="${r.color}" stroke-width="${note.settings.penWidth}" stroke-linecap="round" stroke-linejoin="round">${r.strokes.map(s=>`<path d="${pathData(s)}"/>`).join('')}</g>`);}
 for(const a of note.annotations.filter(a=>a.page===page))paths.push(`<path d="${pathData(a.points)}" fill="none" stroke="${a.color}" stroke-width="${a.width}" stroke-linecap="round" stroke-linejoin="round"/>`);
 for(const d of (note.drawings||[]).filter(d=>d.page===page&&!d.deleted)){const visible=d.strokes.flatMap((stroke,index)=>d.hiddenStrokes?.includes(index)?[]:[{stroke,color:d.strokeColors?.[index]||d.color}]);paths.push(`<g id="drawing-${d.id}" transform="translate(${d.x} ${d.y}) scale(${d.scale})" fill="none" stroke-width="${d.penWidth}" stroke-linecap="round" stroke-linejoin="round">${visible.map(item=>`<path d="${pathData(item.stroke)}" stroke="${item.color}"/>`).join('')}</g>`);}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="white"/>${paths.join('')}</svg>`;
}
export function exportSVG(note:Note,profiles:Profile[],page:number,template?:Template){return download(makeSVG(note,profiles,page,template),`${safeName(note.title)}-${t('Seite')}-${page+1}.svg`,'image/svg+xml');}
