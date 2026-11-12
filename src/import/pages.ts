import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc=workerURL;
export async function* filePages(file:File,signal:AbortSignal):AsyncGenerator<{canvas:HTMLCanvasElement;label:string}> {
 if(file.size>100*1024*1024)throw new Error('Datei größer als 100 MB. Bitte aufteilen.');
 if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  const task=pdfjs.getDocument({data:await file.arrayBuffer()});
  const abort=()=>{void task.destroy();};signal.addEventListener('abort',abort,{once:true});
  try{const pdf=await task.promise;if(pdf.numPages>100)throw new Error('Mehr als 100 Seiten. Bitte den Ordner in kleinere PDFs aufteilen.');
   for(let i=1;i<=pdf.numPages;i++){if(signal.aborted)throw new DOMException('Abgebrochen','AbortError');const page=await pdf.getPage(i),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2.5,2200/Math.max(base.width,base.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvas,viewport}).promise;yield{canvas,label:`${file.name} · Seite ${i}`};page.cleanup();}
  }finally{signal.removeEventListener('abort',abort);await task.destroy();}
 }else if(file.type.startsWith('image/')||/\.(jpe?g|png|webp|bmp)$/i.test(file.name)){
  const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);yield{canvas,label:file.name};}finally{bitmap.close();}
 }else throw new Error('Unterstützt werden PDFs und Bilddateien.');
}
