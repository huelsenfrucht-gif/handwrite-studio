import { isPunctuation, type Glyph, type PairSample, type Point, type Profile, type RasterInk, type Stroke } from './model';
import { composeAccented, demoGlyphs } from './demo';
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
// Letter boundaries are found with a global dynamic programme instead of a
// greedy search: every cut prefers columns crossed by few strokes (gaps or a
// single connecting ligature), stays close to the expected letter width and
// keeps a minimum distance to its neighbours.
export function findCuts(strokes:Stroke[],text:string,width:number){
 const chars=Array.from(text),n=chars.length;if(n<2)return [0,width];
 const step=Math.max(.5,width/700),cols=Math.max(n*3,Math.ceil(width/step)+1),cross=new Float64Array(cols),ink=new Float64Array(cols);
 const all=strokes.flat(),ys=all.map(p=>p.y),height=Math.max(4,quantile(ys,.95)-quantile(ys,.05));
 for(const s of strokes)for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i],lo=Math.min(a.x,b.x)/step,hi=Math.max(a.x,b.x)/step,dy=Math.abs(b.y-a.y);
  const c0=Math.max(0,Math.ceil(lo)),c1=Math.min(cols-1,Math.ceil(hi)-1);for(let c=c0;c<=c1;c++)cross[c]++;
  const c=Math.max(0,Math.min(cols-1,Math.round((lo+hi)/2)));ink[c]+=dy/height;}
 const local=new Float64Array(cols);for(let c=0;c<cols;c++){let v=0;for(let k=-1;k<=1;k++){const j=Math.max(0,Math.min(cols-1,c+k));v+=(cross[j]+ink[j]*3)*(k?.25:.5);}local[c]=v;}
 const weights=chars.map(c=>Math.max(18,demoGlyphs[c]?.[0].advance||50)),total=weights.reduce((a,b)=>a+b,0),expected:number[]=[];let sum=0;
 for(let i=0;i<n-1;i++){sum+=weights[i];expected.push((cols-1)*sum/total);}
 const avg=(cols-1)/n,radius=Math.max(2,Math.round(avg*.8)),minGap=Math.max(1,avg*.28);
 let prev=new Map<number,{cost:number;path:number[]}>([[0,{cost:0,path:[0]}]]);
 for(let i=0;i<n-1;i++){const next=new Map<number,{cost:number;path:number[]}>(),e=expected[i],lo=Math.max(1,Math.floor(e-radius)),hi=Math.min(cols-2,Math.ceil(e+radius));
  for(let c=lo;c<=hi;c++){const own=local[c]+2.2*((c-e)/avg)**2;let best:{cost:number;path:number[]}|undefined;
   for(const [p,v] of prev){if(c-p<minGap*Math.min(1,weights[i]/40))continue;if(!best||v.cost<best.cost)best=v;}
   if(best)next.set(c,{cost:best.cost+own,path:[...best.path,c]});}
  if(!next.size){const c=Math.round(Math.max(e,(Math.max(...prev.keys()))+1));const v=[...prev.values()].sort((a,b)=>a.cost-b.cost)[0];next.set(c,{cost:v.cost,path:[...v.path,c]});}
  prev=next;}
 const best=[...prev.values()].sort((a,b)=>a.cost-b.cost)[0];
 return [...best.path.map(c=>Math.min(width,c*step)),width];
}
export function estimateSlant(strokes:Stroke[]){let vertical=0,total=0;for(const s of strokes)for(let i=1;i<s.length;i++){const dx=s[i].x-s[i-1].x,dy=s[i].y-s[i-1].y;if(Math.abs(dy)>Math.abs(dx)*1.5&&Math.abs(dy)>.2){total+=(-dx/dy)*Math.abs(dy);vertical+=Math.abs(dy);}}return Math.max(-.7,Math.min(.7,total/Math.max(1,vertical)));}
export function analyzeWord(raw:Stroke[],text:string,source:'pen'|'photo',id:string,alignedCuts?:number[]):WordSample{
 text=text.trim().normalize('NFC');if(!/^[\p{L}\p{N}]{2,24}$/u.test(text))throw new Error('Bitte ein einzelnes Wort mit 2–24 Buchstaben oder Zahlen eingeben.');
 const pts=raw.flat();if(pts.length<5)throw new Error('Bitte zuerst ein zusammenhängendes Wort schreiben oder aus einem Foto erkennen.');
 const x0=Math.min(...pts.map(p=>p.x)),x1=Math.max(...pts.map(p=>p.x)),y0=quantile(pts.map(p=>p.y),.02),y1=quantile(pts.map(p=>p.y),.98);
 if(x1-x0<5||y1-y0<5)throw new Error('Die Schreibprobe ist zu klein.');
 const local=raw.map(s=>s.map(p=>({...p,x:p.x-x0}))),rawWidth=x1-x0,chars=Array.from(text),validCuts=alignedCuts?.length===chars.length+1&&alignedCuts.every(Number.isFinite)&&alignedCuts.every((c,i,a)=>i===0||c>a[i-1]),rawCuts=validCuts?alignedCuts!.map(c=>Math.max(0,Math.min(rawWidth,c-x0))):findCuts(local,text,rawWidth);if(validCuts){rawCuts[0]=0;rawCuts[rawCuts.length-1]=rawWidth;}const frame=bodyFrame(local,text,rawCuts),scale=Math.max(.08,Math.min(20,52/frame.xHeight)),width=rawWidth*scale;
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
 // Punctuation from before the guide-line placement was stretched to letter size: not used.
 const exact=profile.glyphs[char]?.filter(g=>g.source==='pen'&&(!isPunctuation(char)||g.lined))||[];
 if(exact.length)return exact;
 // Accented letters reuse the writer's own base letter plus a handwritten mark.
 const accented=char.normalize('NFD')!==char?(profile.glyphs[char.normalize('NFD')[0]]?.filter(g=>g.source==='pen')||[]).map(g=>composeAccented(char,()=>g)).filter((g):g is Glyph=>!!g):[];
 if(accented.length)return accented;
 const lower=char.toLocaleLowerCase('de-DE');
 if(char===lower||!/[A-Z]/.test(char))return [];
 // A capital derived from the user's own lowercase form is deliberately only
 // a fallback. It remains recognisably theirs and, unlike a demo glyph, never
 // mixes a foreign typeface into an otherwise personal word.
 return (profile.glyphs[lower]?.filter(g=>g.source==='pen')||[]).map(g=>({...g,advance:g.advance*1.1,strokes:g.strokes.map(s=>s.map(p=>({...p,x:p.x*1.1,y:80+(p.y-80)*1.3})))}));
}
export function composeWord(text:string,profile:Profile,rand:()=>number):WordResult {
 const chars=Array.from(text);let learned=0;
 const single=(c:string,i:number):Glyph=>{const targetPosition=chars.length===1?'isolated':i===0?'initial':i===chars.length-1?'final':'medial',personal=writtenGlyphs(profile,c),matching=personal.filter(g=>g.position===targetPosition||(!g.position&&targetPosition==='medial')),choices=matching.length?matching:(personal.length?personal:demoGlyphs[c]);if(personal.length)learned++;return choices?.[Math.floor(rand()*choices.length)]||{source:'demo' as const,advance:55,strokes:[[{x:3,y:5},{x:45,y:5},{x:45,y:80},{x:3,y:80},{x:3,y:5}]]};};
 // Handwritten connections ("ch", "Cl", "sch") replace their single letters: the
 // pair is cut into per-letter glyphs that stay glued, so the real joining stroke remains.
 const glyphs:Glyph[]=[];
 for(const run of pairRuns(text,k=>!!profile.pairs?.[k]?.length)){
  if(run.len>1){const key=chars.slice(run.start,run.start+run.len).join(''),options=profile.pairs![key],parts=splitPair(options[Math.floor(rand()*options.length)],key);if(parts){glyphs.push(...parts);learned+=run.len;continue;}}
  for(let i=run.start;i<run.start+run.len;i++)glyphs.push(single(chars[i],i));
 }
 // Every generated word uses one consistent alphabet. Photographed words,
 // raster snippets and obsolete synthetic words are intentionally never mixed
 // into the result.
 return {glyphs,learned,kind:'letters'};
}

/** Greedy longest match of known pairs, the same way words are composed. */
export function pairRuns(word: string, has: (key: string) => boolean) {
  const chars = Array.from(word), out: { start: number; len: number }[] = [];
  for (let i = 0; i < chars.length;) {
    let len = 1;
    for (const n of [3, 2]) if (i + n <= chars.length && has(chars.slice(i, i + n).join(''))) { len = n; break; }
    out.push({ start: i, len }); i += len;
  }
  return out;
}

/** Splits a pair into one glyph per letter; all but the last stay glued to the next. */
export function splitPair(sample: PairSample, key: string): Glyph[] | null {
  const n = Array.from(key).length, out: Glyph[] = [];
  for (let i = 0; i < n; i++) {
    const strokes = sliceStrokes(sample.strokes, sample.cuts[i], sample.cuts[i + 1]).filter(s => s.length);
    if (!strokes.length) return null;
    out.push({ source: 'pen', advance: Math.max(4, sample.cuts[i + 1] - sample.cuts[i]), strokes, glue: i < n - 1 });
  }
  return out;
}
