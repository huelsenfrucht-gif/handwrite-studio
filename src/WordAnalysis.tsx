import { useRef } from 'react';
import { pathData } from './model';
import type { WordSample } from './contextual';
export function WordAnalysis({sample,onChange}:{sample:WordSample;onChange:(w:WordSample)=>void}){
 const svg=useRef<SVGSVGElement>(null),drag=useRef<number|null>(null);
 return <div className="word-analysis"><div className="analysis-heading"><strong>Verbindungen & Wortformen</strong><span>{Math.round(sample.metrics.joining*100)} % verbundene Grenzen · Neigung ≈ {Math.round(Math.atan(sample.metrics.slant)*180/Math.PI)}°</span></div><svg ref={svg} viewBox={`-8 -15 ${sample.width+16} 145`} onPointerMove={e=>{const i=drag.current;if(i===null)return;const point=svg.current!.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const x=point.matrixTransform(svg.current!.getScreenCTM()!.inverse()).x;const cuts=[...sample.cuts];cuts[i]=Math.max(cuts[i-1]+2,Math.min(cuts[i+1]-2,x));onChange({...sample,cuts});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} aria-label="Analysierte Wortprobe mit korrigierbaren Buchstabengrenzen">
 {sample.strokes.map((s,i)=><path key={i} d={pathData(s)} fill="none" stroke="#263e62" strokeWidth={1.7} strokeLinecap="round"/>)}
 {sample.cuts.slice(1,-1).map((x,i)=><g key={i} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current=i+1;}} style={{cursor:'ew-resize'}}><line x1={x} x2={x} y1={-10} y2={105} stroke="transparent" strokeWidth={14}/><line x1={x} x2={x} y1={-10} y2={105} stroke="#4c9979" strokeWidth={.7} strokeDasharray="3 3"/><circle cx={x} cy={-7} r={3} fill="#1c1d21"/></g>)}
 {Array.from(sample.text).map((c,i)=><text key={i} x={(sample.cuts[i]+sample.cuts[i+1])/2} y={123} fontSize={13} textAnchor="middle" fill="#1c1d21">{c}</text>)}
 </svg><p className="fine-print">Prüfe die Buchstabengrenzen und ziehe die grünen Linien bei Bedarf. Das ganze Wort bleibt als Original erhalten. Die Grenzen helfen, seine Schreibweisen auf neue Wörter zu übertragen.</p></div>;
}
