import { type Glyph, type Point, type Profile, type RasterInk, type Stroke } from './model';
import { demoGlyphs } from './demo';
export type WordSample={id:string;text:string;strokes:Stroke[];cuts:number[];width:number;source:'pen'|'photo';normalization?:3;synthetic?:boolean;raster?:RasterInk;metrics:{slant:number;baselineSpread:number;joining:number;spacing:number;baseline?:number;xHeight?:number;quality?:number}};
export type Style={slant:number;baselineSpread:number;joining:number;spacing:number;samples:number};
const quantile=(values:number[],q:number)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*q))]||0;};
const median=(values:number[])=>quantile(values,.5);
const BODY=/[aceimnorsuvwxzäöü]/;
const DESC=/[gjpqy]/;
function bodyFrame(strokes:Stroke[],text:string,cuts:number[]){
 const chars=Array.from(text),all=strokes.flat(),globalTop=quantile(all.map(p=>p.y),.03),globalBottom=quantile(all.map(p=>p.y),.97),bodyHeights:number[]=[],baselines:number[]=[];
 for(let i=0;i<chars.length;i++){const points=all.filter(p=>p.x>=cuts[i]&&p.x<=cuts[i+1]);if(points.length<3)continue;const top=quantile(points.map(p=>p.y),.08),bottom=quantile(points.map(p=>p.y),.9);if(!DESC.test(chars[i]))baselines.push(bottom);if(BODY.test(chars[i])&&bottom-top>2)bodyHeights.push(bottom-top);}
 const baseline=baselines.length?median(baselines):(DESC.test(text)?globalTop+(globalBottom-globalTop)*.72:globalBottom);
 const total=Math.max(5,globalBottom-globalTop),measured=bodyHeights.length?median(bodyHeights):total*(/[A-ZÄÖÜbdfhkltgjpqy]/.test(text)?.62:.86),minBody=total*(bodyHeights.length?.38:.5),maxBody=total*.92,xHeight=Math.max(5,Math.min(maxBody,Math.max(minBody,measured)));
 const stable=measured>=minBody&&measured<=maxBody?1:.55,confidence=Math.min(1,(bodyHeights.length+baselines.length*.35)/Math.max(2,chars.length*.7))*stable;return{baseline,xHeight,confidence};
}
function provisionalCuts(strokes:Stroke[],text:string,width:number){
 const weights=Array.from(text).map(c=>demoGlyphs[c]?.[0].advance||50),total=weights.reduce((a,b)=>a+b,0),density=new Float64Array(Math.ceil(width)+2);
 for(const s of strokes)for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let k=0;k<=steps;k++){const x=Math.round(a.x+(b.x-a.x)*k/steps);if(x>=0&&x<density.length)density[x]+=1/steps;}}
 const cuts=[0];let sum=0;for(let i=0;i<weights.length-1;i++){sum+=weights[i];const expected=width*sum/total,window=width/weights.length*.3;let best=expected,score=Infinity;for(let x=Math.max(cuts.at(-1)!+3,Math.floor(expected-window));x<Math.min(width-3,expected+window);x++){const value=density[x]*2+Math.abs(x-expected)*.04;if(value<score){score=value;best=x;}}cuts.push(best);}cuts.push(width);return cuts;
}
export function analyzeWord(raw:Stroke[],text:string,source:'pen'|'photo',id:string,alignedCuts?:number[]):WordSample{
 text=text.trim().normalize('NFC');if(!/^[\p{L}\p{N}]{2,24}$/u.test(text))throw new Error('Bitte ein einzelnes Wort mit 2–24 Buchstaben oder Zahlen eingeben.');
 const pts=raw.flat();if(pts.length<5)throw new Error('Bitte zuerst ein zusammenhängendes Wort schreiben oder aus einem Foto erkennen.');
 const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=quantile(pts.map(p=>p.y),.02),y1=quantile(pts.map(p=>p.y),.98);
 if(x1-x0<5||y1-y0<5)throw new Error('Die Schreibprobe ist zu klein.');
 const local=raw.map(s=>s.map(p=>({...p,x:p.x-x0}))),rawWidth=x1-x0,chars=Array.from(text),validCuts=alignedCuts?.length===chars.length+1&&alignedCuts.every(Number.isFinite)&&alignedCuts.every((c,i,a)=>i===0||c>a[i-1]),rawCuts=validCuts?alignedCuts!.map(c=>Math.max(0,Math.min(rawWidth,c-x0))):provisionalCuts(local,text,rawWidth);if(validCuts){rawCuts[0]=0;rawCuts[rawCuts.length-1]=rawWidth;}const frame=bodyFrame(local,text,rawCuts),scale=Math.max(.08,Math.min(20,52/frame.xHeight)),width=rawWidth*scale;
 if(width>6000)throw new Error('Die Probe ist zu breit. Bitte nur ein einzelnes Wort markieren.');
 const strokes=local.map(s=>s.map(p=>({...p,x:p.x*scale,y:(p.y-frame.baseline)*scale+80}))),cuts=rawCuts.map(c=>c*scale);
 const bottoms:number[]=[];for(let i=0;i<Array.from(text).length;i++){const ps=strokes.flat().filter(p=>p.x>=cuts[i]&&p.x<=cuts[i+1]);if(ps.length)bottoms.push(quantile(ps.map(p=>p.y),.88));}
 const baseline=quantile(bottoms,.5),baselineSpread=Math.sqrt(bottoms.reduce((s,v)=>s+(v-baseline)**2,0)/Math.max(1,bottoms.length));
 let vertical=0,slantTotal=0;for(const s of strokes)for(let i=1;i<s.length;i++){const dx=s[i].x-s[i-1].x,dy=s[i].y-s[i-1].y;if(Math.abs(dy)>Math.abs(dx)*1.5&&Math.abs(dy)>.2){slantTotal+=(-dx/dy)*Math.abs(dy);vertical+=Math.abs(dy);}}
 const connected=cuts.slice(1,-1).filter(c=>strokes.some(s=>s.some((p,i)=>i>0&&(p.x-c)*(s[i-1].x-c)<=0&&Math.abs(p.x-s[i-1].x)<width*.5))).length;
 return{id,text,strokes,cuts,width,source,normalization:3,metrics:{slant:Math.max(-.7,Math.min(.7,slantTotal/Math.max(1,vertical))),baselineSpread:Math.min(12,baselineSpread),joining:connected/(Array.from(text).length-1),spacing:width/Array.from(text).length,baseline:80,xHeight:52,quality:frame.confidence}};
}
export function relabelWord(sample:WordSample,text:string):WordSample{
 text=text.trim().normalize('NFC');if(!/^[\p{L}\p{N}]{2,24}$/u.test(text))throw new Error('Bitte ein einzelnes Wort mit 2–24 Buchstaben oder Zahlen eingeben.');
 return Array.from(text).length===Array.from(sample.text).length?{...sample,text}:analyzeWord(sample.strokes,text,sample.source,sample.id);
}
export function recalibrateWord(w:WordSample):WordSample{if(w.normalization===3)return w;const frame=bodyFrame(w.strokes,w.text,w.cuts),scale=Math.max(.25,Math.min(4,52/frame.xHeight)),strokes=w.strokes.map(s=>s.map(p=>({...p,x:p.x*scale,y:(p.y-frame.baseline)*scale+80}))),cuts=w.cuts.map(c=>c*scale),width=w.width*scale;return{...w,normalization:3,strokes,cuts,width,metrics:{...w.metrics,baselineSpread:Math.min(12,w.metrics.baselineSpread*scale),spacing:width/Array.from(w.text).length,baseline:80,xHeight:52,quality:frame.confidence}};}
export function profileStyle(p:Profile):Style{const words=(p.words||[]).filter(w=>!w.synthetic).map(recalibrateWord),stat=(key:'slant'|'baselineSpread'|'joining'|'spacing')=>median(words.map(w=>w.metrics[key]));return {slant:stat('slant'),baselineSpread:stat('baselineSpread'),joining:stat('joining'),spacing:stat('spacing'),samples:words.length};}
// Clip segments geometrically, including interpolated boundary intersections.
export function sliceStrokes(strokes:Stroke[],left:number,right:number):Stroke[]{
 const out:Stroke[]=[];
 for(const s of strokes){if(s.length===1){if(s[0].x>=left&&s[0].x<=right)out.push([{...s[0],x:s[0].x-left}]);continue;}let current:Stroke=[];
  const flush=()=>{if(current.length)out.push(current);current=[];};
  for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],dx=b.x-a.x;let lo=0,hi=1;if(dx===0){if(a.x<left||a.x>right){flush();continue;}}else{const t0=(left-a.x)/dx,t1=(right-a.x)/dx;lo=Math.max(0,Math.min(t0,t1));hi=Math.min(1,Math.max(t0,t1));if(lo>hi){flush();continue;}}
   const at=(t:number):Point=>({x:a.x+dx*t-left,y:a.y+(b.y-a.y)*t,p:(a.p??.5)+((b.p??.5)-(a.p??.5))*t});const start=at(lo),end=at(hi),last=current.at(-1);if(last&&Math.hypot(last.x-start.x,last.y-start.y)>.2)flush();if(!current.length)current.push(start);current.push(end);if(hi<1)flush();
  }flush();
 }return out;
}
export type WordResult={glyphs:Glyph[];kind:'original'|'contextual'|'letters';learned:number};
function writtenGlyphs(profile:Profile,char:string):Glyph[]{
 const exact=profile.glyphs[char]?.filter(g=>g.source==='pen')||[];
 if(exact.length)return exact;
 const lower=char.toLocaleLowerCase('de-DE');
 if(char===lower||!/[A-Z]/.test(char))return [];
 // A capital derived from the user's own lowercase form is deliberately only
 // a fallback. It remains recognisably theirs and, unlike a demo glyph, never
 // mixes a foreign typeface into an otherwise personal word.
 return (profile.glyphs[lower]?.filter(g=>g.source==='pen')||[]).map(g=>({...g,advance:g.advance*1.1,strokes:g.strokes.map(s=>s.map(p=>({...p,x:p.x*1.1,y:80+(p.y-80)*1.3})))}));
}
export function composeWord(text:string,profile:Profile,rand:()=>number):WordResult {
 const chars=Array.from(text);let learned=0;
 const glyphs=chars.map((c,i)=>{const targetPosition=chars.length===1?'isolated':i===0?'initial':i===chars.length-1?'final':'medial',personal=writtenGlyphs(profile,c),matching=personal.filter(g=>g.position===targetPosition||(!g.position&&targetPosition==='medial')),choices=matching.length?matching:(personal.length?personal:demoGlyphs[c]);if(personal.length)learned++;return choices?.[Math.floor(rand()*choices.length)]||{source:'demo' as const,advance:55,strokes:[[{x:3,y:5},{x:45,y:5},{x:45,y:80},{x:3,y:80},{x:3,y:5}]]};});
 // Every generated word uses one consistent alphabet. Photographed words,
 // raster snippets and obsolete synthetic words are intentionally never mixed
 // into the result.
 return {glyphs,learned,kind:'letters'};
}
