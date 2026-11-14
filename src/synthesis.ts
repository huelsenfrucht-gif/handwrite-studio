import * as ort from 'onnxruntime-web';
import {analyzeWord,type WordSample} from './contextual';
import {uid,type Profile,type Stroke} from './model';

const MODEL_ROOT='/models/handwriting-gen';
type Manifest={format_version:1;model:string;alphabet:string;style_width:number;style_height:number;max_points:number};
let runtime:Promise<{session:ort.InferenceSession;manifest:Manifest}>|undefined;

const readable=(text:string)=>text.toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]/g,'');
export function editDistance(a:string,b:string){const previous=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diagonal=previous[0];previous[0]=i;for(let j=1;j<=b.length;j++){const above=previous[j],value=Math.min(previous[j]+1,previous[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));diagonal=above;previous[j]=value;}}return previous[b.length];}

export function extractSynthWords(text:string,profile:Profile){
 const human=new Set((profile.words||[]).filter(w=>!w.synthetic).map(w=>w.text));
 return [...new Set(text.normalize('NFC').match(/[\p{L}\p{N}]{2,24}/gu)||[])].filter(word=>!human.has(word));
}

async function loadRuntime(){
 if(!runtime)runtime=(async()=>{
  let response:Response;
  try{response=await fetch(`${MODEL_ROOT}/manifest.json`,{cache:'force-cache'});}catch{throw new Error('Das lokale Handschriftmodell konnte nicht geladen werden. Prüfe die Internetverbindung für den ersten Start.');}
  if(!response.ok)throw new Error('Das neue lokale Handschriftmodell ist in dieser Version noch nicht enthalten. Es wird bewusst keine schlechte Ersatzschrift erzeugt.');
  const manifest=await response.json() as Manifest;
  if(manifest.format_version!==1||!manifest.model||!manifest.alphabet||manifest.style_width<32||manifest.style_height<16||manifest.max_points<64)throw new Error('Das lokale Handschriftmodell hat ein ungültiges Format.');
  ort.env.wasm.numThreads=Math.min(2,Math.max(1,navigator.hardwareConcurrency||1));
  const session=await ort.InferenceSession.create(`${MODEL_ROOT}/${manifest.model}`,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  return{session,manifest};
 })().catch(error=>{runtime=undefined;throw error;});
 return runtime;
}

async function styleTensor(images:string[],manifest:Manifest){
 const count=Math.min(5,images.length),size=manifest.style_width*manifest.style_height,data=new Float32Array(count*size);
 for(let n=0;n<count;n++){
  const image=new Image();image.src=images[n];await image.decode();
  const canvas=document.createElement('canvas');canvas.width=manifest.style_width;canvas.height=manifest.style_height;
  const context=canvas.getContext('2d',{willReadFrequently:true})!;context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(canvas.width/image.width,canvas.height/image.height),w=image.width*scale,h=image.height*scale;context.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  for(let i=0;i<size;i++){const p=i*4,luma=.2126*pixels[p]+.7152*pixels[p+1]+.0722*pixels[p+2];data[n*size+i]=(255-luma)/255;}
 }
 return new ort.Tensor('float32',data,[count,1,manifest.style_height,manifest.style_width]);
}

export function decodeStrokeTensor(values:ArrayLike<number>,points:number):Stroke[]{
 const strokes:Stroke[]=[],limit=Math.min(points,Math.floor(values.length/4));let stroke:Stroke=[],x=0,y=0;
 for(let i=0;i<limit;i++){
  const dx=Number(values[i*4]),dy=Number(values[i*4+1]),pressure=Math.max(.05,Math.min(1,Number(values[i*4+2]))),penUp=Number(values[i*4+3])>.5;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>100||Math.abs(dy)>100)continue;
  x+=dx;y+=dy;stroke.push({x,y,p:pressure});if(penUp&&stroke.length){strokes.push(stroke);stroke=[];}
 }
 if(stroke.length)strokes.push(stroke);return strokes.filter(s=>s.length>1);
}

async function generateOne(word:string,style:ort.Tensor,session:ort.InferenceSession,manifest:Manifest,seed:number):Promise<WordSample>{
 const chars=Array.from(word.normalize('NFC')),indexes=chars.map(char=>manifest.alphabet.indexOf(char)+1);
 if(indexes.some(index=>index===0))throw new Error(`„${word}“ enthält ein Zeichen, das das lokale Modell noch nicht kennt.`);
 const tokens=new BigInt64Array(indexes.map(BigInt)),feeds:Record<string,ort.Tensor>={tokens:new ort.Tensor('int64',tokens,[1,tokens.length]),token_length:new ort.Tensor('int64',new BigInt64Array([BigInt(tokens.length)]),[1]),style,seed:new ort.Tensor('int64',new BigInt64Array([BigInt(seed)]),[1])};
 const result=await session.run(feeds),output=result.strokes,lengthOutput=result.stroke_length;
 if(!output||!lengthOutput)throw new Error('Das lokale Modell hat keine Stiftstriche geliefert.');
 const length=Number((lengthOutput.data as ArrayLike<number|bigint>)[0]),strokes=decodeStrokeTensor(output.data as ArrayLike<number>,Math.min(length,manifest.max_points));
 if(strokes.flat().length<8)throw new Error(`Das lokale Modell konnte „${word}“ nicht lesbar schreiben.`);
 return{...analyzeWord(strokes,word,'pen',uid()),synthetic:true};
}

async function ocrScore(word:string,sample:WordSample){
 try{
  const {recognizeLine}=await import('./import/recognizer'),points=sample.strokes.flat(),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y)),scale=Math.min(3,512/Math.max(1,maxX-minX)),canvas=document.createElement('canvas');canvas.width=Math.ceil((maxX-minX)*scale+24);canvas.height=Math.ceil((maxY-minY)*scale+24);const context=canvas.getContext('2d')!;context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.strokeStyle='black';context.lineWidth=3;context.lineCap='round';context.lineJoin='round';for(const stroke of sample.strokes){context.beginPath();stroke.forEach((p,i)=>(i?context.lineTo((p.x-minX)*scale+12,(p.y-minY)*scale+12):context.moveTo((p.x-minX)*scale+12,(p.y-minY)*scale+12)));context.stroke();}
  const recognized=await recognizeLine(canvas);return editDistance(readable(word),readable(recognized.text))/Math.max(1,readable(word).length);
 }catch{return .5;}
}

export async function synthesizeWords(text:string,profile:Profile,signal?:AbortSignal){
 if((profile.styleImages||[]).length<1)throw new Error('Bitte importiere zuerst Handschriftseiten. Daraus werden Stilwörter lokal ausgewählt.');
 const words=extractSynthWords(text,profile);if(!words.length)return [];
 signal?.throwIfAborted();const {session,manifest}=await loadRuntime(),style=await styleTensor(profile.styleImages!,manifest),generated:WordSample[]=[];
 for(const word of words){signal?.throwIfAborted();const candidates:WordSample[]=[];for(let variant=0;variant<3;variant++)candidates.push(await generateOne(word,style,session,manifest,crypto.getRandomValues(new Uint32Array(1))[0]));const scores=await Promise.all(candidates.map(candidate=>ocrScore(word,candidate)));generated.push(candidates[scores.indexOf(Math.min(...scores))]);}
 return generated;
}
