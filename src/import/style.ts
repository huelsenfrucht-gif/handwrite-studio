import type {Candidate} from './pipeline';

/** Pick references that are clear, genuinely handwritten and complementary.
 * Five near-identical short words teach the style encoder less than five clear
 * samples with different lengths and letter shapes. */
export function selectStyleImages(candidates:Candidate[],limit=5){
 const pool=candidates.filter(candidate=>candidate.selected&&candidate.image&&candidate.text.length>=2),selected:Candidate[]=[];const letters=new Set<string>();
 while(selected.length<limit&&pool.length){
  let best=pool[0],bestScore=-Infinity;
  for(const candidate of pool){const text=Array.from(candidate.text.toLocaleLowerCase('de-DE')),fresh=text.filter(letter=>!letters.has(letter)).length/Math.max(1,text.length),lengthDiversity=selected.length?Math.min(1,Math.min(...selected.map(item=>Math.abs(item.text.length-candidate.text.length)))/5):1,metrics=candidate.sample.metrics,base=candidate.confidence*.38+(metrics.quality||0)*.32+(metrics.joining||0)*.2,score=base+fresh*.16+lengthDiversity*.08;if(score>bestScore){best=candidate;bestScore=score;}}
  selected.push(best);for(const letter of best.text.toLocaleLowerCase('de-DE'))letters.add(letter);pool.splice(pool.indexOf(best),1);
 }
 return selected.map(candidate=>candidate.image);
}
