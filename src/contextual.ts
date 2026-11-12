import { type Glyph, type Point, type Profile, type Stroke } from './model';
import { demoGlyphs } from './demo';
export type WordSample={id:string;text:string;strokes:Stroke[];cuts:number[];width:number;source:'pen'|'photo';metrics:{slant:number;baselineSpread:number;joining:number;spacing:number}};
export type Style={slant:number;baselineSpread:number;joining:number;spacing:number;samples:number};
const quantile=(values:number[],q:number)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*q))]||0;};
export function analyzeWord(raw:Stroke[],text:string,source:'pen'|'photo',id:string):WordSample{
 text=text.trim().normalize('NFC');if(!/^[\p{L}\p{N}]{2,24}$/u.test(text))throw new Error('Bitte ein einzelnes Wort mit 2–24 Buchstaben oder Zahlen eingeben.');
 const pts=raw.flat();if(pts.length<5)throw new Error('Bitte zuerst ein zusammenhängendes Wort schreiben oder aus einem Foto erkennen.');
 const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=quantile(pts.map(p=>p.y),.02),y1=quantile(pts.map(p=>p.y),.98);
 if(x1-x0<5||y1-y0<5)throw new Error('Die Schreibprobe ist zu klein.');
 const scale=90/(y1-y0),width=(x1-x0)*scale;
 if(width>6000)throw new Error('Die Probe ist zu breit. Bitte nur ein einzelnes Wort markieren.');
 const strokes=raw.map(s=>s.map(p=>({...p,x:(p.x-x0)*scale,y:(p.y-y0)*scale+5})));
 // Estimate character alignment from expected widths and low-ink vertical valleys.
 // The UI exposes every cut: connected writing has intrinsically ambiguous boundaries.
 const weights=Array.from(text).map(c=>demoGlyphs[c]?.[0].advance||50),total=weights.reduce((a,b)=>a+b,0);
 const density=new Float64Array(Math.ceil(width)+2);for(const s of strokes)for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let k=0;k<=steps;k++){const x=Math.round(a.x+(b.x-a.x)*k/steps);if(x>=0&&x<density.length)density[x]+=1/steps;}}
 const cuts=[0];let sum=0;for(let i=0;i<weights.length-1;i++){sum+=weights[i];const expected=width*sum/total,window=width/weights.length*.24;let best=expected,score=Infinity;for(let x=Math.max(cuts.at(-1)!+3,Math.floor(expected-window));x<Math.min(width-3,expected+window);x++){const value=density[x]*2+Math.abs(x-expected)*.05;if(value<score){score=value;best=x;}}cuts.push(best);}cuts.push(width);
 const bottoms:number[]=[];for(let i=0;i<Array.from(text).length;i++){const ps=strokes.flat().filter(p=>p.x>=cuts[i]&&p.x<=cuts[i+1]);if(ps.length)bottoms.push(quantile(ps.map(p=>p.y),.88));}
 const baseline=quantile(bottoms,.5),baselineSpread=Math.sqrt(bottoms.reduce((s,v)=>s+(v-baseline)**2,0)/Math.max(1,bottoms.length));
 let vertical=0,slantTotal=0;for(const s of strokes)for(let i=1;i<s.length;i++){const dx=s[i].x-s[i-1].x,dy=s[i].y-s[i-1].y;if(Math.abs(dy)>Math.abs(dx)*1.5&&Math.abs(dy)>.2){slantTotal+=(-dx/dy)*Math.abs(dy);vertical+=Math.abs(dy);}}
 const connected=cuts.slice(1,-1).filter(c=>strokes.some(s=>s.some((p,i)=>i>0&&(p.x-c)*(s[i-1].x-c)<=0&&Math.abs(p.x-s[i-1].x)<width*.5))).length;
 return{id,text,strokes,cuts,width,source,metrics:{slant:Math.max(-.7,Math.min(.7,slantTotal/Math.max(1,vertical))),baselineSpread:Math.min(12,baselineSpread),joining:connected/(Array.from(text).length-1),spacing:width/Array.from(text).length}};
}
export function profileStyle(p:Profile):Style{const words=p.words||[];const avg=(key:keyof WordSample['metrics'])=>words.reduce((a,w)=>a+w.metrics[key],0)/Math.max(words.length,1);return {slant:avg('slant'),baselineSpread:avg('baselineSpread'),joining:avg('joining'),spacing:avg('spacing'),samples:words.length};}
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
export function composeWord(text:string,profile:Profile,rand:()=>number):WordResult {
 const words=profile.words||[],exact=words.filter(w=>w.text===text),chars=Array.from(text);
 if(exact.length){const word=exact[Math.floor(rand()*exact.length)];return {kind:'original',learned:chars.length,glyphs:chars.map((_,i)=>({source:word.source,advance:word.cuts[i+1]-word.cuts[i],strokes:sliceStrokes(word.strokes,word.cuts[i],word.cuts[i+1])}))};}
 const style=profileStyle(profile);let learned=0;const glyphs:Glyph[]=[];
 // Dynamic programming favours the longest observed connected letter sequences.
 // A target such as "beschreiben" can reuse the complete original "schreiben",
 // not seven independently selected letters. Context scores break fragment ties.
 type Fragment={word:WordSample;from:number;length:number};
 const cost=Array(chars.length+1).fill(-Infinity) as number[];
 const choices:({fragment?:Fragment;length:number}|undefined)[]=Array(chars.length);
 cost[chars.length]=0;
 for(let at=chars.length-1;at>=0;at--){
  cost[at]=cost[at+1]-4;choices[at]={length:1};
  for(const word of words){const wc=Array.from(word.text);
   for(let from=0;from<wc.length;from++){
    if(wc[from]!==chars[at])continue;let length=0;
    while(at+length<chars.length&&from+length<wc.length&&chars[at+length]===wc[from+length]){
     length++;let context=0;
     if(at===0&&from===0)context+=2;
     if(at+length===chars.length&&from+length===wc.length)context+=2;
     if(at>0&&from>0&&chars[at-1]===wc[from-1])context+=2;
     if(at+length<chars.length&&chars[at+length]===wc[from+length])context+=2;
     const score=cost[at+length]+length*length+context-2+rand()*.08;
     if(score>cost[at]){cost[at]=score;choices[at]={fragment:{word,from,length},length};}
    }
   }
  }
 }
 const origins:({word:string;index:number}|null)[]=[];
 for(let i=0;i<chars.length;){const choice=choices[i]!;
  if(choice.fragment){const {word:w,from,length}=choice.fragment;
   for(let k=0;k<length;k++){const j=from+k;glyphs.push({source:w.source,advance:w.cuts[j+1]-w.cuts[j],strokes:sliceStrokes(w.strokes,w.cuts[j],w.cuts[j+1])});origins.push({word:w.id,index:j});learned++;}i+=length;
  }else{const c=chars[i],gs=profile.glyphs[c]||demoGlyphs[c];if(profile.glyphs[c]?.length)learned++;glyphs.push(gs?.[Math.floor(rand()*gs.length)]||{source:'demo',advance:55,strokes:[[{x:3,y:5},{x:45,y:5},{x:45,y:80},{x:3,y:80},{x:3,y:5}]]});origins.push(null);i++;}
 }
 // Join only observed cursive boundaries; never connect separated print samples.
 if(style.joining>.25)for(let i=0;i<glyphs.length-1;i++){
  if(origins[i]&&origins[i+1]&&origins[i]!.word===origins[i+1]!.word&&origins[i]!.index+1===origins[i+1]!.index)continue;
  const a=glyphs[i],b=glyphs[i+1];if(a.source==='demo'||b.source==='demo')continue;
  const exits=a.strokes.flatMap(s=>[s[0],s.at(-1)!]).filter(p=>p.x>a.advance-5&&p.y>25&&p.y<95);
  const entries=b.strokes.flatMap(s=>[s[0],s.at(-1)!]).filter(p=>p.x<5&&p.y>25&&p.y<95);
  if(!exits.length||!entries.length)continue;let best:{a:Point;b:Point;distance:number}|undefined;
  for(const p of exits)for(const q of entries){const distance=Math.abs(p.y-q.y);if(!best||distance<best.distance)best={a:p,b:q,distance};}if(!best||best.distance>45)continue;
  const gap=5,start=best.a,end={...best.b,x:best.b.x+a.advance+gap};const join:Stroke=[];
  for(let k=0;k<=12;k++){const t=k/12,u=1-t;join.push({x:u*u*u*start.x+3*u*u*t*(start.x+5)+3*u*t*t*(end.x-5)+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*(start.y+3)+3*u*t*t*(end.y+3)+t*t*t*end.y,p:.4});}
  glyphs[i]={...a,advance:a.advance+gap,strokes:[...a.strokes,join]};
 }
 return {glyphs,learned,kind:words.length?'contextual':'letters'};
}
