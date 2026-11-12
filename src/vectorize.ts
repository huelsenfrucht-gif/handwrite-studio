import type { Stroke } from './model';
// Zhang–Suen thinning, followed by graph tracing. Output is an approximation of
// the centreline; photographs cannot recover original stroke order or pressure.
export function vectorize(rgba:Uint8ClampedArray, width:number,height:number,threshold:number): Stroke[] {
 const bin=new Uint8Array(width*height);
 // A fixed threshold mistakes shadows and grey paper for ink. Compare every
 // pixel with its local neighbourhood as well, so only genuinely darker marks
 // survive uneven phone photos.
 const gray=new Float32Array(width*height),integral=new Float64Array((width+1)*(height+1));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x,j=i*4,g=.2126*rgba[j]+.7152*rgba[j+1]+.0722*rgba[j+2];gray[i]=g;integral[(y+1)*(width+1)+x+1]=g+integral[y*(width+1)+x+1]+integral[(y+1)*(width+1)+x]-integral[y*(width+1)+x];}
 const radius=Math.max(6,Math.min(18,Math.round(Math.min(width,height)/18))),stride=width+1;
 for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++){const i=y*width+x,j=i*4,x0=Math.max(0,x-radius),x1=Math.min(width,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(height,y+radius+1),mean=(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));bin[i]=(gray[i]<threshold&&gray[i]<mean-11&&rgba[j+3]>128)?1:0;}
 // Remove isolated noise, but keep dots and small punctuation components.
 const visited=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)if(bin[i]&&!visited[i]){
  const queue=[i];visited[i]=1;for(let k=0;k<queue.length;k++){const p=queue[k];for(const d of [-width-1,-width,-width+1,-1,1,width-1,width,width+1]){const n=p+d;if(n>=0&&n<bin.length&&bin[n]&&!visited[n]&&Math.abs(n%width-p%width)<=1){visited[n]=1;queue.push(n);}}}if(queue.length<4)for(const p of queue)bin[p]=0;
 }
 const neighbors=(i:number)=>[i-width,i-width+1,i+1,i+width+1,i+width,i+width-1,i-1,i-width-1];
 for(let iter=0;iter<250;iter++){
  let changed=false;
  for(let phase=0;phase<2;phase++){
   const remove:number[]=[];
   for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;if(!bin[i])continue;const p=neighbors(i).map(j=>bin[j]),count=p.reduce((a,b)=>a+b,0);
    let changes=0;for(let k=0;k<8;k++)if(p[k]===0&&p[(k+1)%8]===1)changes++;
    if(count<2||count>6||changes!==1)continue;
    if(phase===0?(p[0]*p[2]*p[4]===0&&p[2]*p[4]*p[6]===0):(p[0]*p[2]*p[6]===0&&p[0]*p[4]*p[6]===0))remove.push(i);
   }
   for(const i of remove)bin[i]=0;if(remove.length)changed=true;
  }
  if(!changed)break;
 }
 // Do not keep a diagonal graph edge when the same two pixels are already
 // connected orthogonally. This removes thousands of tiny triangular paths
 // around antialiased curves while retaining real diagonal pen movement.
 const adjacent=(i:number)=>neighbors(i).filter(j=>{if(j<0||j>=bin.length||!bin[j]||Math.abs(j%width-i%width)>1)return false;const dx=j%width-i%width,dy=Math.floor(j/width)-Math.floor(i/width);return Math.abs(dx)+Math.abs(dy)<2||(!bin[i+dx]&&!bin[i+dy*width]);});
 const edges=new Set<string>(),key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
 const paths:Stroke[]=[];
 const trace=(start:number,next:number)=>{const nodes=[start];let prev=start,cur=next;edges.add(key(start,next));
  while(true){nodes.push(cur);const ns=adjacent(cur);if(ns.length!==2)break;const n=ns.find(n=>n!==prev&&!edges.has(key(cur,n)));if(n===undefined)break;edges.add(key(cur,n));prev=cur;cur=n;}
  const points=nodes.map(i=>({x:i%width,y:Math.floor(i/width),p:.5}));
  // Collapse collinear skeleton pixels. The shape stays identical, but the
  // resulting Goodnotes document is much lighter and easier to edit.
  const simple=points.filter((p,k)=>{if(k===0||k===points.length-1)return true;const a=points[k-1],b=points[k+1];return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x);});
  paths.push(simple);
 };
 for(let i=0;i<bin.length;i++)if(bin[i]){const ns=adjacent(i);if(!ns.length)paths.push([{x:i%width,y:Math.floor(i/width),p:.5}]);else if(ns.length!==2)for(const n of ns)if(!edges.has(key(i,n)))trace(i,n);}
 for(let i=0;i<bin.length;i++)if(bin[i])for(const n of adjacent(i))if(!edges.has(key(i,n)))trace(i,n);
 if(!paths.length)throw new Error('Keine dunklen Striche erkannt. Ausschnitt oder Kontrast anpassen.');
 return paths;
}
