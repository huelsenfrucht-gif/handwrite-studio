import type {Candidate} from './pipeline';
import type {Glyph} from '../model';

async function loadImage(source:string){const image=new Image();image.src=source;await image.decode();return image;}

function position(index:number,length:number):Glyph['position']{return length===1?'isolated':index===0?'initial':index===length-1?'final':'medial';}

export async function extractPhotoGlyphs(candidates:Candidate[]):Promise<Record<string,Glyph[]>>{
 const glyphs:Record<string,Glyph[]>={};
 for(const candidate of candidates){
  const chars=Array.from(candidate.text.normalize('NFC')),sample=candidate.sample;
  if(chars.length<2||sample.cuts.length!==chars.length+1||sample.width<=0)continue;
  if(!sample.raster)continue;const image=await loadImage(sample.raster.data),scaleX=image.width/sample.raster.width,cuts=sample.cuts;
  for(let index=0;index<chars.length;index++){
   const char=chars[index],left=Math.max(0,Math.round(cuts[index]*scaleX)),right=Math.min(image.width,Math.round(cuts[index+1]*scaleX)),width=right-left;
   if(width<2)continue;
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.drawImage(image,left,0,width,image.height,0,0,width,image.height);
   const advance=cuts[index+1]-cuts[index],variant:Glyph={source:'photo',advance,strokes:sample.strokes.map(stroke=>stroke.filter(point=>point.x>=sample.cuts[index]&&point.x<=sample.cuts[index+1]).map(point=>({...point,x:point.x-sample.cuts[index]}))).filter(stroke=>stroke.length>1),raster:{data:canvas.toDataURL('image/png'),x:0,y:0,width:advance,height:sample.raster.height},hiddenByRaster:true,position:position(index,chars.length)};
   const list=glyphs[char]||[];if(list.length<12)glyphs[char]=[...list,variant];
  }
 }
 for(const [char,variants] of Object.entries(glyphs)){const widths=variants.map(g=>g.advance).sort((a,b)=>a-b),median=widths[Math.floor(widths.length/2)];glyphs[char]=variants.filter(g=>g.advance>=median*.55&&g.advance<=median*1.8).slice(0,12);}
 return glyphs;
}
