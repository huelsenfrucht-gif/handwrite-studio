import {useRef,type PointerEvent,type ReactNode} from 'react';

type Contact={x:number;y:number};
type Pinch={distance:number;zoom:number;centerX:number;centerY:number;scrollLeft:number;scrollTop:number};

export function PanZoomStage({active,zoom,onZoom,children}:{active:boolean;zoom:number;onZoom:(zoom:number)=>void;children:ReactNode}){
 const stage=useRef<HTMLDivElement>(null),contacts=useRef(new Map<number,Contact>()),pinch=useRef<Pinch|null>(null);
 const distance=()=>{const [a,b]=[...contacts.current.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;};
 const center=()=>{const [a,b]=[...contacts.current.values()];return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:a||{x:0,y:0};};
 const startPinch=()=>{const node=stage.current;if(!node||contacts.current.size<2)return;const c=center();pinch.current={distance:Math.max(1,distance()),zoom,centerX:c.x,centerY:c.y,scrollLeft:node.scrollLeft,scrollTop:node.scrollTop};};
 const down=(event:PointerEvent<HTMLDivElement>)=>{if(!active)return;event.preventDefault();contacts.current.set(event.pointerId,{x:event.clientX,y:event.clientY});try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* Safari can cancel a contact before capture. */}if(contacts.current.size===2)startPinch();};
 const move=(event:PointerEvent<HTMLDivElement>)=>{if(!active||!contacts.current.has(event.pointerId))return;event.preventDefault();const node=stage.current,previous=contacts.current.get(event.pointerId)!;contacts.current.set(event.pointerId,{x:event.clientX,y:event.clientY});if(!node)return;
  if(contacts.current.size>=2){if(!pinch.current)startPinch();const initial=pinch.current;if(!initial)return;const next=Math.max(40,Math.min(100,Math.round(initial.zoom*distance()/initial.distance/5)*5));if(next===zoom)return;const rect=node.getBoundingClientRect(),ratio=next/initial.zoom,localX=initial.centerX-rect.left,localY=initial.centerY-rect.top;onZoom(next);requestAnimationFrame(()=>{node.scrollLeft=(initial.scrollLeft+localX)*ratio-localX;node.scrollTop=(initial.scrollTop+localY)*ratio-localY;});return;}
  node.scrollLeft-=event.clientX-previous.x;node.scrollTop-=event.clientY-previous.y;
 };
 const finish=(event:PointerEvent<HTMLDivElement>)=>{contacts.current.delete(event.pointerId);pinch.current=null;if(contacts.current.size===2)startPinch();try{event.currentTarget.releasePointerCapture(event.pointerId);}catch{/* Already released. */}};
 return <div ref={stage} className={`paper-stage ${active?'pan-active':''}`} onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>{children}</div>;
}
