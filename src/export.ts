import { PAGE, pathData, type Note, type Profile, type Library } from './model';
import { layout, resolvedDrawingInk, resolvedRaster, resolvedStrokes } from './engine';
type JsPDFConstructor=typeof import('jspdf').jsPDF;
async function loadJsPDF():Promise<JsPDFConstructor>{
 try{return(await import('jspdf')).jsPDF;}catch(primaryError){
  const root=window as typeof window&{jspdf?:{jsPDF:JsPDFConstructor}};
  if(root.jspdf?.jsPDF)return root.jspdf.jsPDF;
  await new Promise<void>((resolve,reject)=>{const old=document.querySelector<HTMLScriptElement>('script[data-jspdf-fallback]');if(old){old.addEventListener('load',()=>resolve(),{once:true});old.addEventListener('error',()=>reject(primaryError),{once:true});return;}const script=document.createElement('script');script.src='/vendor/jspdf.umd.min.js';script.dataset.jspdfFallback='true';script.onload=()=>resolve();script.onerror=()=>reject(primaryError);document.head.appendChild(script);});
  if(!root.jspdf?.jsPDF)throw primaryError;return root.jspdf.jsPDF;
 }
}
export function download(data:Blob|string,name:string,type='application/json') {const blob=data instanceof Blob?data:new Blob([data],{type}); const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export function safeName(name:string){return (name.replace(/[^\p{L}\p{N}\-_ ]/gu,'').trim()||'Dokument').slice(0,80);}
export function exportBackup(library:Library){download(JSON.stringify(library),`Handwrite-Studio-${new Date().toISOString().slice(0,10)}.handwrite.json`);}
export async function createPDF(note:Note,profiles:Profile[]){const jsPDF=await loadJsPDF(),{glyphs,pages}=layout(note,profiles);const pdf=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});const ratio=595.28/PAGE.width;
 for(let page=0;page<pages;page++){
  if(page)pdf.addPage();pdf.setFillColor('#ffffff');pdf.rect(0,0,595.28,841.89,'F');pdf.setLineWidth(.35);pdf.setDrawColor('#dce4e8');
  const spacing=note.settings.paper==='grid'?20:note.settings.lineHeight;
  if(note.settings.paper!=='blank')for(let y=PAGE.margin+note.settings.size*.8;y<PAGE.height-45;y+=spacing)pdf.line(40*ratio,y*ratio,(PAGE.width-40)*ratio,y*ratio);
  if(note.settings.paper==='grid')for(let x=40;x<PAGE.width-40;x+=20)pdf.line(x*ratio,40*ratio,x*ratio,(PAGE.height-40)*ratio);
  pdf.setLineCap('round');pdf.setLineJoin('round');
  const draw=(points:{x:number;y:number}[],color:string,width:number)=>{if(!points.length)return;pdf.setDrawColor(color);pdf.setFillColor(color);pdf.setLineWidth(width*ratio);if(points.length===1){pdf.circle(points[0].x*ratio,points[0].y*ratio,width*ratio/2,'F');return;}pdf.lines(points.slice(1).map((p,i)=>[(p.x-points[i].x)*ratio,(p.y-points[i].y)*ratio]),points[0].x*ratio,points[0].y*ratio,[1,1],'S',false);};
  for(const g of glyphs.filter(g=>g.page===page)){const raster=resolvedRaster(g,note);if(raster)pdf.addImage(raster.data,'PNG',raster.x*ratio,raster.y*ratio,raster.width*ratio,raster.height*ratio,undefined,'FAST');if(g.hiddenByRaster)continue;const r=resolvedStrokes(g,note);for(const s of r.strokes)draw(s,r.color,note.settings.penWidth);}
  for(const a of note.annotations.filter(a=>a.page===page))draw(a.points,a.color,a.width);
  for(const d of (note.drawings||[]).filter(d=>d.page===page))for(const ink of resolvedDrawingInk(d))draw(ink.points,ink.color,d.penWidth*d.scale);
 }
 pdf.setProperties({title:note.title,creator:'Handwrite Studio',subject:'Vektorhandschrift – PDF-Seiteninhalt, keine nativen Goodnotes-Stiftstriche'});return pdf;
}
export async function exportPDF(note:Note,profiles:Profile[]){const pdf=await createPDF(note,profiles);pdf.save(`${safeName(note.title)}.pdf`);}
export function makeSVG(note:Note,profiles:Profile[],page:number){const {glyphs}=layout(note,profiles);const paths:string[]=[];
 const spacing=note.settings.paper==='grid'?20:note.settings.lineHeight;
 if(note.settings.paper!=='blank')for(let y=PAGE.margin+note.settings.size*.8;y<PAGE.height-45;y+=spacing)paths.push(`<path d="M40 ${y} H754" stroke="#dce4e8" stroke-width=".5"/>`);
 if(note.settings.paper==='grid')for(let x=40;x<PAGE.width-40;x+=20)paths.push(`<path d="M${x} 40 V1083" stroke="#dce4e8" stroke-width=".5"/>`);
 for(const g of glyphs.filter(g=>g.page===page)){const raster=resolvedRaster(g,note);if(raster)paths.push(`<image id="ai-word-${g.id}" href="${raster.data}" x="${raster.x}" y="${raster.y}" width="${raster.width}" height="${raster.height}" preserveAspectRatio="none"/>`);if(g.hiddenByRaster)continue;const r=resolvedStrokes(g,note);paths.push(`<g id="letter-${g.id}" fill="none" stroke="${r.color}" stroke-width="${note.settings.penWidth}" stroke-linecap="round" stroke-linejoin="round">${r.strokes.map(s=>`<path d="${pathData(s)}"/>`).join('')}</g>`);}
 for(const a of note.annotations.filter(a=>a.page===page))paths.push(`<path d="${pathData(a.points)}" fill="none" stroke="${a.color}" stroke-width="${a.width}" stroke-linecap="round" stroke-linejoin="round"/>`);
 for(const d of (note.drawings||[]).filter(d=>d.page===page&&!d.deleted)){const visible=d.strokes.flatMap((stroke,index)=>d.hiddenStrokes?.includes(index)?[]:[{stroke,color:d.strokeColors?.[index]||d.color}]);paths.push(`<g id="drawing-${d.id}" transform="translate(${d.x} ${d.y}) scale(${d.scale})" fill="none" stroke-width="${d.penWidth}" stroke-linecap="round" stroke-linejoin="round">${visible.map(item=>`<path d="${pathData(item.stroke)}" stroke="${item.color}"/>`).join('')}</g>`);}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 794 1123"><rect width="794" height="1123" fill="white"/>${paths.join('')}</svg>`;
}
export function exportSVG(note:Note,profiles:Profile[],page:number){download(makeSVG(note,profiles,page),`${safeName(note.title)}-Seite-${page+1}.svg`,'image/svg+xml');}
