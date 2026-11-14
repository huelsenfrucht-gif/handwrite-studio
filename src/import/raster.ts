/** Remove pale horizontal notebook rules from a word crop without touching
 * dark handwriting. The returned copy is used only for vectorisation; the UI
 * still shows the untouched original crop for verification. */
export function cleanWordRaster(source:Uint8ClampedArray,width:number,height:number){
 const out=new Uint8ClampedArray(source),gray=(i:number)=>.2126*out[i]+.7152*out[i+1]+.0722*out[i+2],ruled:number[]=[];
 for(let y=0;y<height;y++){let pale=0;for(let x=0;x<width;x++){const i=(y*width+x)*4,g=gray(i);if(out[i+3]>128&&g>=105&&g<238)pale++;}if(pale>width*.58)ruled.push(y);}
 for(const y of ruled)for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let x=0;x<width;x++){const i=(yy*width+x)*4;if(gray(i)>=105){out[i]=out[i+1]=out[i+2]=255;}}
 return out;
}

import type {RasterInk,Stroke} from '../model';
import type {WordSample} from '../contextual';

/**
 * Preserve the photographed ink itself in the same coordinate system as the
 * analysed word (baseline 80, x-height about 52). A photograph does not tell
 * us the original pen order, so this is both more faithful and more robust
 * than redrawing a guessed centre line.
 */
export function normalizedWordRaster(source:ImageData,raw:Stroke[],sample:WordSample):RasterInk{
 const rawPoints=raw.flat(),normalPoints=sample.strokes.flat();
 if(!rawPoints.length||rawPoints.length!==normalPoints.length)throw new Error('Die sichtbare Wortform konnte nicht ausgerichtet werden.');
 const minX=Math.min(...rawPoints.map(point=>point.x)),maxX=Math.max(...rawPoints.map(point=>point.x)),scale=sample.width/Math.max(1,maxX-minX);
 const baseline=rawPoints[0].y-(normalPoints[0].y-80)/scale,width=Math.max(1,Math.ceil(sample.width)),height=120;
 const sourceCanvas=document.createElement('canvas');sourceCanvas.width=source.width;sourceCanvas.height=source.height;
 const cleaned=new ImageData(cleanWordRaster(source.data,source.width,source.height),source.width,source.height);sourceCanvas.getContext('2d')!.putImageData(cleaned,0,0);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true})!;
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.setTransform(scale,0,0,scale,-minX*scale,80-baseline*scale);context.drawImage(sourceCanvas,0,0);context.resetTransform();
 const pixels=context.getImageData(0,0,width,height);for(let index=0;index<pixels.data.length;index+=4){const luma=.2126*pixels.data[index]+.7152*pixels.data[index+1]+.0722*pixels.data[index+2];pixels.data[index]=38;pixels.data[index+1]=62;pixels.data[index+2]=98;pixels.data[index+3]=Math.max(0,Math.min(255,(238-luma)*2.8));}context.putImageData(pixels,0,0);
 return{data:canvas.toDataURL('image/png'),x:0,y:0,width:sample.width,height};
}
