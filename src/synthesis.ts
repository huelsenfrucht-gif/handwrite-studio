import {analyzeWord,type WordSample} from './contextual';
import {uid,type Profile} from './model';
import {cleanWordRaster} from './import/raster';
import {vectorize} from './vectorize';

const endpoint=(import.meta.env.VITE_SYNTHESIS_API||'').replace(/\/$/,'');
const space=(import.meta.env.VITE_SYNTHESIS_SPACE||'').trim();
export const synthesisAvailable=Boolean(endpoint||space);

type SynthImage={text:string;image:string};
const variants=2;

const readable=(text:string)=>text.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]/g,'');
export function editDistance(a:string,b:string){const previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=previous[0];previous[0]=i;for(let j=1;j<=b.length;j++){const above=previous[j],value=Math.min(previous[j]+1,previous[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=above;previous[j]=value;}}return previous[b.length];}

export function extractSynthWords(text:string,profile:Profile){
 const human=new Set((profile.words||[]).filter(w=>!w.synthetic).map(w=>w.text));
 return [...new Set(text.normalize('NFC').match(/[\p{L}\p{N}]{2,24}/gu)||[])].filter(word=>!human.has(word));
}

async function imageSample(text:string,dataUrl:string):Promise<WordSample>{
 const image=new Image();image.src=dataUrl;await image.decode();
 // DiffusionPen currently renders 256×64. Trace at twice that resolution so
 // rounded generated ink remains rounded after skeletonisation.
 const scale=Math.max(2,Math.min(4,384/Math.max(image.width,image.height))),canvas=document.createElement('canvas');canvas.width=Math.ceil(image.width*scale)+16;canvas.height=Math.ceil(image.height*scale)+16;const context=canvas.getContext('2d')!;context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,8,8,image.width*scale,image.height*scale);
 const pixels=context.getImageData(0,0,canvas.width,canvas.height),strokes=vectorize(cleanWordRaster(pixels.data,canvas.width,canvas.height),canvas.width,canvas.height,185),sample=analyzeWord(strokes,text,'photo',uid());
 // Preserve the realistic diffusion result as transparent ink. The skeleton is
 // retained for native-ink export, but it must not replace the visibly better
 // generated word inside the editor/PDF/SVG.
 let left=canvas.width,top=canvas.height,right=0,bottom=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4,luma=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2];if(luma<235){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 left=Math.max(0,left-3);top=Math.max(0,top-3);right=Math.min(canvas.width-1,right+3);bottom=Math.min(canvas.height-1,bottom+3);const width=Math.max(1,right-left+1),height=Math.max(1,bottom-top+1),ink=document.createElement('canvas');ink.width=width;ink.height=height;const inkContext=ink.getContext('2d')!,crop=context.getImageData(left,top,width,height);for(let i=0;i<crop.data.length;i+=4){const luma=.2126*crop.data[i]+.7152*crop.data[i+1]+.0722*crop.data[i+2];crop.data[i]=38;crop.data[i+1]=62;crop.data[i+2]=98;crop.data[i+3]=Math.max(0,Math.min(255,(255-luma)*2));}inkContext.putImageData(crop,0,0);const rasterHeight=Math.max(18,Math.min(100,sample.width*height/width));
 return {...sample,synthetic:true,raster:{data:ink.toDataURL('image/png'),x:0,y:92-rasterHeight,width:sample.width,height:rasterHeight}};
}

async function directGenerate(words:string[],images:string[],signal?:AbortSignal):Promise<SynthImage[]>{
 const form=new FormData();form.set('texts',JSON.stringify(words));form.set('variants',String(variants));for(const [index,image] of images.entries()){const response=await fetch(image,{signal}),blob=await response.blob();form.append('references',blob,`stil-${index+1}.png`);}
 const response=await fetch(`${endpoint}/v1/generate`,{method:'POST',body:form,signal});if(!response.ok){let detail='';try{detail=(await response.json()).detail||'';}catch{}throw new Error(detail||`Modellserver antwortet mit ${response.status}.`);}
 const result=await response.json() as {images?:SynthImage[]};if(!Array.isArray(result.images)||![words.length,words.length*variants].includes(result.images.length))throw new Error('Der Modellserver hat keine vollständige Handschrift geliefert.');
 return result.images;
}

async function spaceGenerate(words:string[],images:string[],signal?:AbortSignal):Promise<SynthImage[]>{
 signal?.throwIfAborted();
 const [{Client,handle_file},blobs]=await Promise.all([import('@gradio/client'),Promise.all(images.map(async image=>(await fetch(image,{signal})).blob()))]);
 const app=await Client.connect(space);signal?.throwIfAborted();
 try{
  const result=await app.predict('/generate',[JSON.stringify(words),blobs.map(blob=>handle_file(blob)),variants]);signal?.throwIfAborted();
  const data=result.data as unknown[];const value=data[0] as {images?:SynthImage[]}|string;
  const parsed=typeof value==='string'?JSON.parse(value) as {images?:SynthImage[]}:value;
  if(!Array.isArray(parsed?.images)||![words.length,words.length*variants].includes(parsed.images.length))throw new Error('Der kostenlose Modellserver hat keine vollständige Handschrift geliefert.');
  return parsed.images;
 }catch(error){const message=(error as Error).message||String(error);if(/quota|GPU task|exceeded|limit/i.test(message))throw new Error('Das kostenlose GPU-Tageslimit ist gerade aufgebraucht. Morgen funktioniert es wieder; es entstehen keine Kosten.');throw error;}
}

async function chooseLegible(words:string[],candidates:SynthImage[]){
 if(candidates.length===words.length)return candidates;
 try{const {recognizeLine}=await import('./import/recognizer'),chosen:SynthImage[]=[];for(const word of words){const group=candidates.filter(candidate=>candidate.text===word).slice(0,variants);if(!group.length)throw new Error('Kandidat fehlt.');let best=group[0],bestScore=Infinity;for(const candidate of group){const image=new Image();image.src=candidate.image;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0);const result=await recognizeLine(canvas),expected=readable(word),actual=readable(result.text),confidence=result.characters.length?result.characters.reduce((sum,char)=>sum+char.confidence,0)/result.characters.length:0,score=editDistance(expected,actual)/Math.max(1,expected.length)-confidence*.12;if(score<bestScore){best=candidate;bestScore=score;}}chosen.push(best);}return chosen;}catch{return words.map(word=>candidates.find(candidate=>candidate.text===word)).filter((candidate):candidate is SynthImage=>Boolean(candidate));}
}

export async function synthesizeWords(text:string,profile:Profile,signal?:AbortSignal){
 if(!endpoint&&!space)throw new Error('Der realistische Handschriftgenerator ist auf diesem Server noch nicht verbunden.');
 if((profile.styleImages||[]).length<1)throw new Error('Bitte importiere zuerst Handschriftseiten. Daraus werden fünf Stilwörter gewählt.');
 const words=extractSynthWords(text,profile);if(!words.length)return [];
 const generated:SynthImage[]=[];for(let start=0;start<words.length;start+=4){const batch=words.slice(start,start+4),candidates=await (space?spaceGenerate(batch,profile.styleImages!,signal):directGenerate(batch,profile.styleImages!,signal));generated.push(...await chooseLegible(batch,candidates));}
 return Promise.all(generated.map(item=>imageSample(item.text,item.image)));
}
