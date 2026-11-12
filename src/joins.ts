import type { Point, Stroke } from './model';
export type Endpoint = { point: Point; tangent: Point };
// Tangents follow the geometry into/out of a fragment, independently of whether
// a photograph's skeleton tracer happened to traverse the path backwards.
export function endpoints(strokes: Stroke[], direction: 'exit' | 'entry'): Endpoint[] {
 const result: Endpoint[]=[];
 for(const stroke of strokes){
  if(stroke.length<2)continue;
  for(const reverse of [false,true]){
   const points=reverse?[...stroke].reverse():stroke,point=points[0];
   const inner=points.find(p=>Math.hypot(p.x-point.x,p.y-point.y)>=2)||points.at(-1)!;
   const sign=direction==='exit'?-1:1,dx=(inner.x-point.x)*sign,dy=(inner.y-point.y)*sign,length=Math.hypot(dx,dy);
   if(length>0)result.push({point,tangent:{x:dx/length,y:dy/length}});
  }
 }
 return result;
}
export function connect(a: Endpoint,b: Endpoint,offset:number): Stroke {
 const start=a.point,end={...b.point,x:b.point.x+offset};
 const length=Math.min(12,Math.hypot(end.x-start.x,end.y-start.y)/3);
 const c1={x:start.x+a.tangent.x*length,y:start.y+a.tangent.y*length};
 const c2={x:end.x-b.tangent.x*length,y:end.y-b.tangent.y*length};
 return Array.from({length:25},(_,k)=>{const t=k/24,u=1-t;return{x:u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y,p:(start.p??.5)*u+(end.p??.5)*t};});
}
