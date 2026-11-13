/** Remove pale horizontal notebook rules from a word crop without touching
 * dark handwriting. The returned copy is used only for vectorisation; the UI
 * still shows the untouched original crop for verification. */
export function cleanWordRaster(source:Uint8ClampedArray,width:number,height:number){
 const out=new Uint8ClampedArray(source),gray=(i:number)=>.2126*out[i]+.7152*out[i+1]+.0722*out[i+2],ruled:number[]=[];
 for(let y=0;y<height;y++){let pale=0;for(let x=0;x<width;x++){const i=(y*width+x)*4,g=gray(i);if(out[i+3]>128&&g>=105&&g<238)pale++;}if(pale>width*.58)ruled.push(y);}
 for(const y of ruled)for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let x=0;x<width;x++){const i=(yy*width+x)*4;if(gray(i)>=105){out[i]=out[i+1]=out[i+2]=255;}}
 return out;
}
