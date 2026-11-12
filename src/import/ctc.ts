export type Recognition = {text:string; characters:{text:string;start:number;end:number;confidence:number}[]};
/** Decode CTC while retaining time alignment for mapping words back to ink. */
export function decodeCTC(logits:ArrayLike<number>,frames:number,classes:number,alphabet:string):Recognition {
 const symbols=Array.from(alphabet);if(classes!==symbols.length+1||logits.length!==frames*classes)throw new Error('Unpassende Modell-Ausgabe.');
 const characters:Recognition['characters']=[];let previous=0;
 for(let frame=0;frame<frames;frame++){
  let best=0,max=-Infinity;for(let c=0;c<classes;c++){const value=logits[frame*classes+c];if(value>max){max=value;best=c;}}
  let sum=0;for(let c=0;c<classes;c++)sum+=Math.exp(logits[frame*classes+c]-max);
  const confidence=1/sum;
  if(best!==0){if(best===previous){const last=characters.at(-1)!;last.end=frame+1;last.confidence=Math.max(last.confidence,confidence);}else characters.push({text:symbols[best-1],start:frame,end:frame+1,confidence});}
  previous=best;
 }
 return {text:characters.map(c=>c.text).join(''),characters};
}
