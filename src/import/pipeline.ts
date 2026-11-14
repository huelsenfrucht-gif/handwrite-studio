import {filePages} from './pages';
import {segmentPage} from './segment';
import {recognizeLine} from './recognizer';
import {vectorize} from '../vectorize';
import {analyzeWord,type WordSample} from '../contextual';
import {uid} from '../model';
import {correctGermanWord,loadGermanLexicon} from './lexicon';
import {cleanWordRaster,normalizedWordRaster} from './raster';
export type Candidate={id:string;text:string;suggestedText?:string;correctionDistance?:number;image:string;confidence:number;sample:WordSample;selected:boolean;page:string};
export type ImportProgress={file:number;total:number;page:string;line:number;lines:number};
export async function importNotebook(files:File[],signal:AbortSignal,onProgress:(p:ImportProgress)=>void,onCandidate:(c:Candidate)=>void,onError:(message:string)=>void){
 const lexicon=await loadGermanLexicon();let pages=0;for(let f=0;f<files.length;f++){
  try{for await(const {canvas,label} of filePages(files[f],signal)){
   if(++pages>150)throw new Error('150 Seiten erreicht. Bitte weitere Seiten in einem zweiten Import lernen.');
   const context=canvas.getContext('2d')!,detected=segmentPage(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height),heights=detected.map(r=>r.height).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||1,regions=detected.filter(r=>r.height<=median*1.75&&r.height>=median*.45);
   onProgress({file:f+1,total:files.length,page:label,line:0,lines:regions.length});
   if(!regions.length)onError(`${label}: Keine Schriftzeilen erkannt.`);
   for(let r=0;r<regions.length;r++){
    if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');
    onProgress({file:f+1,total:files.length,page:label,line:r+1,lines:regions.length});
    const region=regions[r],line=document.createElement('canvas');line.width=region.width;line.height=region.height;line.getContext('2d')!.drawImage(canvas,region.x,region.y,region.width,region.height,0,0,region.width,region.height);
    try{const recognition=await recognizeLine(line),characters=recognition.characters;
     for(let i=0;i<characters.length;){if(!/[\p{L}\p{N}]/u.test(characters[i].text)){i++;continue;}const from=i;while(i<characters.length&&/[\p{L}\p{N}]/u.test(characters[i].text))i++;const group=characters.slice(from,i),rawText=group.map(c=>c.text).join('');if(group.length<2||group.length>24)continue;
      // Use neighbouring CTC symbol intervals rather than equal-width letters.
      const pad=Math.max(2,line.height*.08),left=Math.floor(group[0].start*recognition.pixelsPerFrame-pad),right=Math.ceil(group.at(-1)!.end*recognition.pixelsPerFrame+pad);
      const x=Math.max(0,left),w=Math.min(line.width,right)-x;if(w<5)continue;
      const crop=document.createElement('canvas');const scale=Math.min(1,600/w);crop.width=Math.ceil(w*scale)+8;crop.height=Math.ceil(line.height*scale)+8;const ctx=crop.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(line,x,0,w,line.height,4,4,w*scale,line.height*scale);
      const confidence=group.reduce((sum,c)=>sum+c.confidence,0)/group.length,correction=correctGermanWord(rawText,lexicon),text=rawText;
      try{
       // OCR only needs a small line image, but centreline extraction needs
       // substantially more spatial resolution. Upscale tiny word crops before
       // thinning so an eight-pixel-wide letter does not become a square or a
       // staircase. The original crop remains the one shown for verification.
       const traceScale=Math.max(1,Math.min(4,260/Math.max(w,line.height))),trace=document.createElement('canvas');trace.width=Math.ceil(w*traceScale)+16;trace.height=Math.ceil(line.height*traceScale)+16;const traceContext=trace.getContext('2d')!;traceContext.fillStyle='white';traceContext.fillRect(0,0,trace.width,trace.height);traceContext.imageSmoothingEnabled=true;traceContext.imageSmoothingQuality='high';traceContext.drawImage(line,x,0,w,line.height,8,8,w*traceScale,line.height*traceScale);
       const original=traceContext.getImageData(0,0,trace.width,trace.height),strokes=vectorize(cleanWordRaster(original.data,trace.width,trace.height),trace.width,trace.height,165),id=uid(),alignedCuts=[0,...group.slice(0,-1).map((c,k)=>((c.end+group[k+1].start)/2*recognition.pixelsPerFrame-x)*traceScale+8),trace.width],sample=analyzeWord(strokes,text,'photo',id,alignedCuts);sample.raster=normalizedWordRaster(original,strokes,sample);const form=sample.metrics.quality||0,selected=correction.distance===0&&confidence>=.965&&form>=.7,sameEdges=rawText.length===correction.text.length&&rawText[0]?.toLocaleLowerCase('de-DE')===correction.text[0]?.toLocaleLowerCase('de-DE')&&rawText.at(-1)?.toLocaleLowerCase('de-DE')===correction.text.at(-1)?.toLocaleLowerCase('de-DE'),suggestedText=!correction.ambiguous&&correction.distance===1&&correction.rank<=25000&&sameEdges?correction.text:undefined;onCandidate({id,text,suggestedText,correctionDistance:correction.distance,image:crop.toDataURL('image/png'),confidence,sample,selected,page:label});}catch{/* Ignore isolated shapes that cannot form a usable word sample. */}
     }
    }catch(e){onError(`${label}, Zeile ${r+1}: ${(e as Error).message}`);}
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }}catch(e){if(signal.aborted)throw e;onError(`${files[f].name}: ${(e as Error).message}`);}
 }
}
