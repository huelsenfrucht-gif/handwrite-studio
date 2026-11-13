export type Recognition = {text:string; characters:{text:string;start:number;end:number;confidence:number}[]};
const logAdd=(a:number,b:number)=>{if(a===-Infinity)return b;if(b===-Infinity)return a;const hi=Math.max(a,b);return hi+Math.log1p(Math.exp(Math.min(a,b)-hi));};
function logProbabilities(logits:ArrayLike<number>,frames:number,classes:number){const out=new Float32Array(frames*classes);for(let t=0;t<frames;t++){let max=-Infinity;for(let c=0;c<classes;c++)max=Math.max(max,logits[t*classes+c]);let sum=0;for(let c=0;c<classes;c++)sum+=Math.exp(logits[t*classes+c]-max);const normal=max+Math.log(sum);for(let c=0;c<classes;c++)out[t*classes+c]=logits[t*classes+c]-normal;}return out;}
/** Decode CTC while retaining time alignment for mapping words back to ink. */
export function decodeCTC(logits:ArrayLike<number>,frames:number,classes:number,alphabet:string):Recognition {
 const symbols=Array.from(alphabet);if(classes!==symbols.length+1||logits.length!==frames*classes)throw new Error('Unpassende Modell-Ausgabe.');
 const characters:Recognition['characters']=[];const samples:number[]=[];let previous=0;
 for(let frame=0;frame<frames;frame++){
  let best=0,max=-Infinity;for(let c=0;c<classes;c++){const value=logits[frame*classes+c];if(value>max){max=value;best=c;}}
  let sum=0;for(let c=0;c<classes;c++)sum+=Math.exp(logits[frame*classes+c]-max);
  const confidence=1/sum;
  if(best!==0){if(best===previous){const last=characters.at(-1)!,index=characters.length-1;last.end=frame+1;last.confidence=(last.confidence*samples[index]+confidence)/(samples[index]+1);samples[index]++;}else{characters.push({text:symbols[best-1],start:frame,end:frame+1,confidence});samples.push(1);}}
  previous=best;
 }
 return {text:characters.map(c=>c.text).join(''),characters};
}

/** Prefix beam search sums competing CTC paths, then Viterbi-aligns the winning
 * sequence back to image frames so crops still follow the actual ink. */
export function decodeCTCBeam(logits:ArrayLike<number>,frames:number,classes:number,alphabet:string,beamWidth=6):Recognition{
 const symbols=Array.from(alphabet);if(classes!==symbols.length+1||logits.length!==frames*classes)throw new Error('Unpassende Modell-Ausgabe.');
 const logp=logProbabilities(logits,frames,classes),key=(ids:number[])=>ids.join(','),beams=new Map<string,{ids:number[];blank:number;nonblank:number}>();beams.set('',{ids:[],blank:0,nonblank:-Infinity});let current=beams;
 for(let t=0;t<frames;t++){
  const ranked=Array.from({length:classes-1},(_,i)=>i+1).sort((a,b)=>logp[t*classes+b]-logp[t*classes+a]).slice(0,Math.min(8,classes-1)),next=new Map<string,{ids:number[];blank:number;nonblank:number}>(),touch=(ids:number[])=>{const k=key(ids);let hit=next.get(k);if(!hit){hit={ids,blank:-Infinity,nonblank:-Infinity};next.set(k,hit);}return hit;};
  for(const beam of current.values()){
   const total=logAdd(beam.blank,beam.nonblank),same=touch(beam.ids);same.blank=logAdd(same.blank,total+logp[t*classes]);const last=beam.ids.at(-1);
   for(const c of ranked){const score=logp[t*classes+c];if(c===last){same.nonblank=logAdd(same.nonblank,beam.nonblank+score);const extended=touch([...beam.ids,c]);extended.nonblank=logAdd(extended.nonblank,beam.blank+score);}else{const extended=touch([...beam.ids,c]);extended.nonblank=logAdd(extended.nonblank,total+score);}}
  }
  current=new Map([...next.entries()].sort((a,b)=>logAdd(b[1].blank,b[1].nonblank)-logAdd(a[1].blank,a[1].nonblank)).slice(0,beamWidth));
 }
 const target=[...current.values()].sort((a,b)=>logAdd(b.blank,b.nonblank)-logAdd(a.blank,a.nonblank))[0]?.ids||[];if(!target.length)return{text:'',characters:[]};
 const states=target.length*2+1,score=new Float64Array(states).fill(-Infinity),back=new Int16Array(frames*states).fill(-1);score[0]=0;
 for(let t=0;t<frames;t++){const row=new Float64Array(states).fill(-Infinity);for(let s=0;s<states;s++){const symbol=s%2?target[(s-1)/2]:0;let best=score[s],from=s;if(s>0&&score[s-1]>best){best=score[s-1];from=s-1;}if(s>1&&s%2&&target[(s-1)/2]!==target[(s-3)/2]&&score[s-2]>best){best=score[s-2];from=s-2;}if(best>-Infinity){row[s]=best+logp[t*classes+symbol];back[t*states+s]=from;}}score.set(row);}
 let state=states-1;if(states>1&&score[states-2]>score[state])state=states-2;const aligned=new Int16Array(frames);for(let t=frames-1;t>=0;t--){aligned[t]=state;state=back[t*states+state];if(state<0&&t>0)state=0;}
 const characters:Recognition['characters']=target.map((id,i)=>{const wanted=i*2+1,assigned=[] as number[];for(let t=0;t<frames;t++)if(aligned[t]===wanted)assigned.push(t);const start=assigned[0]??0,end=(assigned.at(-1)??start)+1,confidence=assigned.length?assigned.reduce((n,t)=>n+Math.exp(logp[t*classes+id]),0)/assigned.length:0;return{text:symbols[id-1],start,end,confidence};});
 return{text:characters.map(c=>c.text).join(''),characters};
}
