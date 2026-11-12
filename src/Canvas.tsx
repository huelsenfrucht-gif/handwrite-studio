import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { PAGE, pathData, smooth, uid, type Note, type PlacedGlyph, type Point, type Stroke } from './model';
import { resolvedStrokes } from './engine';
export type Tool = 'select'|'pen'|'eraser';
type Props={note:Note;glyphs:PlacedGlyph[];page:number;tool:Tool;selected:string[];onSelect:(ids:string[])=>void;onChange:(n:Note)=>void;};
export function PaperCanvas({note,glyphs,page,tool,selected,onSelect,onChange}:Props){
 const svg=useRef<SVGSVGElement>(null),gesture=useRef<{mode:'move'|'box'|'pen';start:Point;ids:string[];points:Stroke}|null>(null);
 const [delta,setDelta]=useState<Point>({x:0,y:0}),[ink,setInk]=useState<Stroke>([]),[box,setBox]=useState<{a:Point;b:Point}|null>(null);
 const position=(e:PointerEvent):Point=>{const point=svg.current!.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const p=point.matrixTransform(svg.current!.getScreenCTM()!.inverse());return{x:Math.max(0,Math.min(PAGE.width,p.x)),y:Math.max(0,Math.min(PAGE.height,p.y)),p:e.pressure||.5};};
 const begin=(e:PointerEvent,id?:string,strokeIndex?:number,annotation?:string)=>{
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();svg.current?.focus();const p=position(e);
  if(tool==='eraser'){
   if(annotation)onChange({...note,annotations:note.annotations.filter(a=>a.id!==annotation)});
   else if(id!==undefined&&strokeIndex!==undefined){const ed=note.edits[id]||{};onChange({...note,edits:{...note.edits,[id]:{...ed,hiddenStrokes:[...new Set([...(ed.hiddenStrokes||[]),strokeIndex])]}}});}return;
  }
  svg.current?.setPointerCapture(e.pointerId);
  if(tool==='pen'){gesture.current={mode:'pen',start:p,ids:[],points:[p]};setInk([p]);return;}
  if(id!==undefined){const ids=e.shiftKey?[...new Set([...selected,id])]:selected.includes(id)?selected:[id];onSelect(ids);gesture.current={mode:'move',start:p,ids,points:[]};}
  else {onSelect([]);gesture.current={mode:'box',start:p,ids:[],points:[]};setBox({a:p,b:p});}
 };
 const move=(e:PointerEvent)=>{const g=gesture.current;if(!g)return;const p=position(e);if(g.mode==='move')setDelta({x:p.x-g.start.x,y:p.y-g.start.y});else if(g.mode==='box')setBox({a:g.start,b:p});else{g.points.push(p);setInk([...g.points]);}};
 const end=(e:PointerEvent)=>{const g=gesture.current;if(!g)return;const p=position(e);gesture.current=null;
  if(g.mode==='move'){const dx=p.x-g.start.x,dy=p.y-g.start.y;if(Math.abs(dx)+Math.abs(dy)>1){const edits={...note.edits};for(const id of g.ids){const old=edits[id]||{};edits[id]={...old,dx:(old.dx||0)+dx,dy:(old.dy||0)+dy};}onChange({...note,edits});}setDelta({x:0,y:0});}
  else if(g.mode==='box'){const left=Math.min(p.x,g.start.x),right=Math.max(p.x,g.start.x),top=Math.min(p.y,g.start.y),bottom=Math.max(p.y,g.start.y);onSelect(glyphs.filter(g=>g.page===page&&!note.edits[g.id]?.deleted&&resolvedStrokes(g,note).strokes.flat().some(p=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)).map(g=>g.id));setBox(null);}
  else{onChange({...note,annotations:[...note.annotations,{id:uid(),page,points:smooth(g.points),width:note.settings.penWidth,color:note.settings.color}]});setInk([]);}
 };
 const spacing=note.settings.paper==='grid'?20:note.settings.lineHeight;
 const lines=[];if(note.settings.paper!=='blank')for(let y=PAGE.margin+note.settings.size*.8;y<PAGE.height-45;y+=spacing)lines.push(<line key={`h${y}`} x1={40} x2={754} y1={y} y2={y}/>);
 if(note.settings.paper==='grid')for(let x=40;x<754;x+=20)lines.push(<line key={`v${x}`} x1={x} x2={x} y1={40} y2={1083}/>);
 return <svg ref={svg} className={`paper tool-${tool}`} viewBox="0 0 794 1123" role="img" aria-label={`Bearbeitbare Dokumentseite ${page+1}. Buchstaben auswählen und verschieben.`} tabIndex={0} onPointerDown={e=>begin(e)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{gesture.current=null;setInk([]);setDelta({x:0,y:0});setBox(null);}} onKeyDown={e=>{if(e.key==='Escape')onSelect([]);if((e.key==='Delete'||e.key==='Backspace')&&selected.length){e.preventDefault();const edits={...note.edits};for(const id of selected)edits[id]={...edits[id],deleted:true};onChange({...note,edits});onSelect([]);}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected.length){e.preventDefault();const edits={...note.edits};for(const id of selected){const old=edits[id]||{};edits[id]={...old,dx:(old.dx||0)+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0)*(e.shiftKey?10:1),dy:(old.dy||0)+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0)*(e.shiftKey?10:1)};}onChange({...note,edits});}}}>
  <rect width="794" height="1123" fill="white"/>
  <g stroke="#dce4e8" strokeWidth=".6" pointerEvents="none">{lines}</g>
  {glyphs.filter(g=>g.page===page&&!note.edits[g.id]?.deleted).map(g=>{const ed=note.edits[g.id],sel=selected.includes(g.id),dx=(ed?.dx||0)+(sel?delta.x:0),dy=(ed?.dy||0)+(sel?delta.y:0);return <g key={g.id} transform={`translate(${dx},${dy})`}>
   {sel&&<rect x={g.x-4} y={g.y-4} width={g.width+8} height={g.height+8} rx={4} fill="#28634b10" stroke="#398060" strokeWidth={1} pointerEvents="none"/>}
   {g.strokes.map((s,i)=>ed?.hiddenStrokes?.includes(i)?null:<g key={i} onPointerDown={e=>begin(e,g.id,i)}><path d={pathData(s)} fill="none" stroke="transparent" strokeWidth={Math.max(12,note.settings.penWidth)} strokeLinecap="round"/><path d={pathData(s)} fill="none" stroke={g.unsupported?'#bc4a3a':ed?.color||note.settings.color} strokeWidth={note.settings.penWidth} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/></g>)}
  </g>;})}
  {note.annotations.filter(a=>a.page===page).map(a=><g key={a.id} onPointerDown={e=>begin(e,undefined,undefined,a.id)}><path d={pathData(a.points)} fill="none" stroke="transparent" strokeWidth={12}/><path d={pathData(a.points)} fill="none" stroke={a.color} strokeWidth={a.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/></g>)}
  {ink.length>0&&<path d={pathData(ink)} fill="none" stroke={note.settings.color} strokeWidth={note.settings.penWidth} strokeLinecap="round" pointerEvents="none"/>}
  {box&&<rect x={Math.min(box.a.x,box.b.x)} y={Math.min(box.a.y,box.b.y)} width={Math.abs(box.b.x-box.a.x)} height={Math.abs(box.b.y-box.a.y)} fill="#28634b18" stroke="#28634b" strokeDasharray="5 3" pointerEvents="none"/>}
 </svg>;
}
