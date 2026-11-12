export type Region={x:number;y:number;width:number;height:number};
/** Remove long ruling lines and isolate horizontal handwriting bands. */
export function segmentPage(data:Uint8ClampedArray,width:number,height:number):Region[]{
 const counts=new Uint32Array(height),ink=new Uint8Array(width*height),gray=new Uint8Array(width*height),integral=new Float64Array((width+1)*(height+1));
 for(let y=0;y<height;y++){let row=0;for(let x=0;x<width;x++){const j=(y*width+x)*4,g=.2126*data[j]+.7152*data[j+1]+.0722*data[j+2];gray[y*width+x]=g;row+=g;integral[(y+1)*(width+1)+x+1]=integral[y*(width+1)+x+1]+row;}}
 const radius=Math.max(8,Math.min(40,Math.round(Math.min(width,height)/35))),area=(x0:number,y0:number,x1:number,y1:number)=>integral[y1*(width+1)+x1]-integral[y0*(width+1)+x1]-integral[y1*(width+1)+x0]+integral[y0*(width+1)+x0];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const x0=Math.max(0,x-radius),x1=Math.min(width,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(height,y+radius+1),mean=area(x0,y0,x1,y1)/((x1-x0)*(y1-y0)),j=y*width+x;if(data[j*4+3]>128&&(gray[j]<105||gray[j]<Math.min(205,mean-13))){ink[j]=1;counts[y]++;}}
 const ruled=new Uint8Array(height);
 for(let y=0;y<height;y++){let run=0;for(let x=0;x<width;x++){run=ink[y*width+x]?run+1:0;if(run>width*.65){ruled[y]=1;break;}}}
 const bands:{start:number;end:number}[]=[];let start=-1,last=-1;
 const gap=Math.max(3,Math.round(height/500));
 for(let y=0;y<height;y++){
  // Very long dense rows are usually notebook rules, not text.
  const active=counts[y]>Math.max(3,width*.002)&&!ruled[y];
  if(active){if(start<0)start=y;last=y;}else if(start>=0&&y-last>gap){bands.push({start,end:last+1});start=-1;}
 }
 if(start>=0)bands.push({start,end:last+1});
 const result:Region[]=[];
 for(const band of bands){if(band.end-band.start<5)continue;let left=width,right=0;
  for(let y=band.start;y<band.end;y++)if(!ruled[y])for(let x=0;x<width;x++)if(ink[y*width+x]){left=Math.min(left,x);right=Math.max(right,x);}
  if(right-left<8)continue;
  const pad=Math.max(3,Math.round((band.end-band.start)*.14));
  const y=Math.max(0,band.start-pad),h=Math.min(height,band.end+pad)-y;
  const split=(a:number,b:number)=>{if((b-a)/h<=15){result.push({x:Math.max(0,a-pad),y,width:Math.min(width,b+pad)-Math.max(0,a-pad),height:h});return;}
   const middle=(a+b)/2,range=Math.min(h*2,(b-a)/4);let best=Math.round(middle),score=Infinity;
   for(let x=Math.floor(middle-range);x<Math.ceil(middle+range);x++){let n=0;for(let yy=band.start;yy<band.end;yy++)n+=ink[yy*width+x];const value=n+Math.abs(x-middle)*.01;if(value<score){score=value;best=x;}}
   split(a,best);split(best,b);
  };split(left,right+1);
 }
 return result;
}
