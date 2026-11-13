import * as ort from 'onnxruntime-web/wasm';
import wasmURL from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import { decodeCTCBeam } from './ctc';
let session:Promise<ort.InferenceSession>|undefined;
let alphabet='';
export async function recognizeLine(image:HTMLCanvasElement){
 if(!session){ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths={wasm:wasmURL};session=(async()=>{const response=await fetch('/models/de-htr/config.json');if(!response.ok)throw new Error('Erkennungsmodell konnte nicht geladen werden.');const config=await response.json();if(config.format_version!==2)throw new Error('Nicht unterstützte Modellversion.');alphabet=config.alphabet;return ort.InferenceSession.create('/models/de-htr/model.onnx',{executionProviders:['wasm']});})().catch(e=>{session=undefined;throw e;});}
 const model=await session;
 const height=64,target=Math.round(image.width*height/image.height);
 if(target>1024)throw new Error('Zeile zu lang: vor der Erkennung in Teilzeilen aufteilen.');
 const width=Math.max(4,Math.ceil(target/4)*4),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,target,height);
 const data=ctx.getImageData(0,0,width,height).data,pixels=new Float32Array(width*height);
 for(let i=0;i<pixels.length;i++)pixels[i]=(.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2])/255;
 const output=await model.run({image:new ort.Tensor('float32',pixels,[1,1,height,width])});
 const tensor=output.logits,frames=Number(tensor.dims[1]),classes=Number(tensor.dims[2]);
 return {...decodeCTCBeam(tensor.data as Float32Array,frames,classes,alphabet),frames,pixelsPerFrame:image.width*width/target/frames};
}
