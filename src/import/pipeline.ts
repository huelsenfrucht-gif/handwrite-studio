import {filePages} from './pages';
import {segmentPage} from './segment';
import {recognizeLine} from './recognizer';
import {vectorize} from '../vectorize';
import {analyzeWord,type WordSample} from '../contextual';
import {uid} from '../model';
export type Candidate={id:string;text:string;image:string;confidence:number;sample:WordSample;selected:boolean;page:string};
export type ImportProgress={file:number;total:number;page:string;line:number;lines:number};
export async function importNotebook(files:File[],signal:AbortSignal,onProgress:(p:ImportProgress)=>void,onCandidate:(c:Candidate)=>void,onError:(message:string)=>void){
 let pages=0;for(let f=0;f<files.length;f++){
  try{for await(const {canvas,label} of filePages(files[f],signal)){
   if(++pages>150)throw new Error('150 Seiten erreicht. Bitte weitere Seiten in einem zweiten Import lernen.');
   const context=canvas.getContext('2d')!,regions=segmentPage(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
   onProgress({file:f+1,total:files.length,page:label,line:0,lines:regions.length});
   if(!regions.length)onError(`${label}: Keine Schriftzeilen erkannt.`);
   for(let r=0;r<regions.length;r++){
    if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');
    onProgress({file:f+1,total:files.length,page:label,line:r+1,lines:regions.length});
    const region=regions[r],line=document.createElement('canvas');line.width=region.width;line.height=region.height;line.getContext('2d')!.drawImage(canvas,region.x,region.y,region.width,region.height,0,0,region.width,region.height);
    try{const recognition=await recognizeLine(line),characters=recognition.characters;
     for(let i=0;i<characters.length;){if(!/[\p{L}\p{N}]/u.test(characters[i].text)){i++;continue;}const from=i;while(i<characters.length&&/[\p{L}\p{N}]/u.test(characters[i].text))i++;const group=characters.slice(from,i),text=group.map(c=>c.text).join('');if(group.length<2||group.length>24)continue;
      // Use neighbouring CTC symbol intervals rather than equal-width letters.
      const left=from===0?0:Math.floor((characters[from-1].end+group[0].start)/2*recognition.pixelsPerFrame);
      const right=i===characters.length?line.width:Math.ceil((group.at(-1)!.end+characters[i].start)/2*recognition.pixelsPerFrame);
      const x=Math.max(0,left),w=Math.min(line.width,right)-x;if(w<5)continue;
      const crop=document.createElement('canvas');const scale=Math.min(1,600/w);crop.width=Math.ceil(w*scale)+8;crop.height=Math.ceil(line.height*scale)+8;const ctx=crop.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);ctx.drawImage(line,x,0,w,line.height,4,4,w*scale,line.height*scale);
      const confidence=group.reduce((sum,c)=>sum+c.confidence,0)/group.length;
      try{const strokes=vectorize(ctx.getImageData(0,0,crop.width,crop.height).data,crop.width,crop.height,165),id=uid();const sample=analyzeWord(strokes,text,'photo',id);onCandidate({id,text,image:crop.toDataURL('image/png'),confidence,sample,selected:confidence>=.92,page:label});}catch{/* Ignore isolated shapes that cannot form a usable word sample. */}
     }
    }catch(e){onError(`${label}, Zeile ${r+1}: ${(e as Error).message}`);}
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  }}catch(e){if(signal.aborted)throw e;onError(`${files[f].name}: ${(e as Error).message}`);}
 }
}
