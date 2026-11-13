export type Correction={text:string;original:string;distance:number;known:boolean;rank:number};
type Lexicon={words:string[];exact:Set<string>;rank:Map<string,number>;grams:Map<string,number[]>;lengths:Map<number,number[]>;bloom?:Uint8Array};
let loading:Promise<Lexicon>|undefined;
const clean=(word:string)=>word.normalize('NFC').toLocaleLowerCase('de-DE');
const wordPattern=/^[a-zäöüß]{2,30}$/;
const ngrams=(word:string)=>{const n=word.length<5?2:3,padded=`^${word}$`,out=new Set<string>();for(let i=0;i<=padded.length-n;i++)out.add(padded.slice(i,i+n));return [...out];};
const bloomHashes=(word:string)=>{let a=2166136261,b=0x7f4a7c15;for(let i=0;i<word.length;i++){const code=word.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b^code,2246822519);}return[a>>>0,(b|1)>>>0] as const;};
export function buildBloomFilter(words:string[],bits=1<<20){if(bits<8||(bits&(bits-1)))throw new Error('Bloom-Filter-Größe muss eine Zweierpotenz sein.');const bloom=new Uint8Array(bits>>3);for(const raw of words){const word=clean(raw);if(!wordPattern.test(word))continue;const[a,b]=bloomHashes(word);for(let i=0;i<7;i++){const bit=(a+Math.imul(i,b)+i*i)&(bits-1);bloom[bit>>3]|=1<<(bit&7);}}return bloom;}
const inBloom=(word:string,lexicon:Lexicon)=>{const bloom=lexicon.bloom;if(!bloom)return false;const bits=bloom.byteLength*8,[a,b]=bloomHashes(word);for(let i=0;i<7;i++){const bit=(a+Math.imul(i,b)+i*i)&(bits-1);if(!(bloom[bit>>3]&(1<<(bit&7))))return false;}return true;};
export function buildGermanLexicon(lemmaText:string,frequencyText:string):Lexicon{
  const ranks=new Map(frequencyText.split(/\r?\n/).filter(Boolean).map((w,i)=>[clean(w),i+1] as const)),seen=new Set<string>(),words:string[]=[];
  for(const line of lemmaText.split(/\r?\n/)){const surface=clean(line.split('\t',1)[0]);if(wordPattern.test(surface)&&!seen.has(surface)){seen.add(surface);words.push(surface);}}
  const grams=new Map<string,number[]>(),lengths=new Map<number,number[]>();words.forEach((word,index)=>{const bucket=lengths.get(word.length)||[];bucket.push(index);lengths.set(word.length,bucket);for(const gram of ngrams(word)){const list=grams.get(gram)||[];list.push(index);grams.set(gram,list);}});
  return{words,exact:seen,rank:ranks,grams,lengths};
}
export async function loadGermanLexicon(){
 if(!loading)loading=Promise.all([fetch('/models/de-lexicon/lemmas.tsv'),fetch('/models/de-lexicon/frequency.txt'),fetch('/models/de-lexicon/words.bloom')]).then(async([lemmas,frequency,wordForms])=>{
  if(!lemmas.ok||!frequency.ok||!wordForms.ok)throw new Error('Deutsches Korrekturwörterbuch konnte nicht geladen werden.');
  const lexicon=buildGermanLexicon(await lemmas.text(),await frequency.text());lexicon.bloom=new Uint8Array(await wordForms.arrayBuffer());return lexicon;
 }).catch(e=>{loading=undefined;throw e;});return loading;
}
function distance(a:string,b:string,limit:number){
 if(Math.abs(a.length-b.length)>limit)return limit+1;let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];let best=row[0];for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));best=Math.min(best,row[j]);}if(best>limit)return limit+1;previous=row;}return previous[b.length];
}
const restoreCase=(original:string,word:string)=>original===original.toLocaleUpperCase('de-DE')?word.toLocaleUpperCase('de-DE'):/^\p{Lu}/u.test(original)?word[0].toLocaleUpperCase('de-DE')+word.slice(1):word;
export function correctGermanWord(original:string,lexicon:Awaited<ReturnType<typeof loadGermanLexicon>>):Correction{
 const query=clean(original),known=lexicon.exact.has(query)||(query.length>=4&&inBloom(query,lexicon));if(!wordPattern.test(query)||query.length<4)return{text:original,original,distance:0,known,rank:lexicon.rank.get(query)||Number.MAX_SAFE_INTEGER};
 if(known)return{text:original,original,distance:0,known:true,rank:lexicon.rank.get(query)||Number.MAX_SAFE_INTEGER};
 const limit=query.length>=12?3:query.length>=6?2:1,counts=new Map<number,number>();for(const gram of ngrams(query))for(const index of lexicon.grams.get(gram)||[])if(Math.abs(lexicon.words[index].length-query.length)<=limit)counts.set(index,(counts.get(index)||0)+1);
 let candidates=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,500).map(([index,shared])=>({index,shared}));
 if(!candidates.length)for(let length=query.length-limit;length<=query.length+limit;length++)for(const index of lexicon.lengths.get(length)||[])candidates.push({index,shared:0});
 let best:{word:string;distance:number;rank:number;shared:number}|undefined;for(const candidate of candidates){const word=lexicon.words[candidate.index],d=distance(query,word,limit);if(d>limit)continue;const rank=lexicon.rank.get(word)||20000+candidate.index;if(!best||d<best.distance||(d===best.distance&&(candidate.shared>best.shared||(candidate.shared===best.shared&&rank<best.rank))))best={word,distance:d,rank,shared:candidate.shared};}
 if(!best)return{text:original,original,distance:limit+1,known:false,rank:Number.MAX_SAFE_INTEGER};
 return{text:restoreCase(original,best.word),original,distance:best.distance,known:true,rank:best.rank};
}
