import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc=workerURL;

type TextItem={str:string;transform:number[];width:number;height:number;hasEOL?:boolean};

export async function extractPdfText(file:File):Promise<string>{
 if(file.size>50*1024*1024)throw new Error('Das PDF ist größer als 50 MB. Bitte teile es vorher auf.');
 const task=pdfjs.getDocument({data:await file.arrayBuffer()});
 try{
  const pdf=await task.promise;
  if(pdf.numPages>150)throw new Error('Das PDF hat mehr als 150 Seiten. Bitte teile es vorher auf.');
  const pages:string[]=[];
  for(let number=1;number<=pdf.numPages;number++){
   const page=await pdf.getPage(number),content=await page.getTextContent(),items=content.items.filter(item=>'str' in item).map(item=>item as unknown as TextItem).filter(item=>Boolean(item.str.trim()));
   const rows:{y:number;height:number;items:TextItem[]}[]=[];
   for(const item of items){const y=item.transform[5],height=Math.max(1,Math.abs(item.height||item.transform[3]||10)),row=rows.find(r=>Math.abs(r.y-y)<=Math.max(2,height*.35));if(row){row.items.push(item);row.y=(row.y*(row.items.length-1)+y)/row.items.length;row.height=Math.max(row.height,height);}else rows.push({y,height,items:[item]});}
   rows.sort((a,b)=>b.y-a.y);
   const lines:string[]=[];
   for(let i=0;i<rows.length;i++){const row=rows[i],sorted=row.items.sort((a,b)=>a.transform[4]-b.transform[4]);let line='';for(let j=0;j<sorted.length;j++){const item=sorted[j],previous=sorted[j-1];if(previous){const previousRight=previous.transform[4]+previous.width,gap=item.transform[4]-previousRight;if(gap>Math.max(1.5,row.height*.18)&&!line.endsWith(' '))line+=' ';}line+=item.str;}lines.push(line.replace(/\s+/g,' ').trim());if(i<rows.length-1){const gap=row.y-rows[i+1].y;if(gap>Math.max(row.height,rows[i+1].height)*1.75)lines.push('');}}
   pages.push(lines.join('\n').replace(/\n{3,}/g,'\n\n').trim());
   page.cleanup();
  }
  const text=pages.filter(Boolean).join('\n\n');
  if(!text)throw new Error('In diesem PDF wurde kein auswählbarer Text gefunden. Gescannte Bilder werden später unterstützt.');
  return text;
 }finally{await task.destroy();}
}
