import { analyzeWord, sliceStrokes } from './contextual';
import type { Glyph, Stroke } from './model';

export const CALIBRATION_LINES=['mr jock tv quiz','phd bags few lynx'] as const;

function inkGaps(strokes:Stroke[],expected:number){
 const points=strokes.flat();if(points.length<12)throw new Error('Bitte schreibe die vollständige Zeile.');
 const min=Math.floor(Math.min(...points.map(p=>p.x))),max=Math.ceil(Math.max(...points.map(p=>p.x))),density=new Float64Array(max-min+2);
 for(const stroke of strokes)for(let i=1;i<stroke.length;i++){const a=stroke[i-1],b=stroke[i],steps=Math.max(1,Math.ceil(Math.abs(b.x-a.x)));for(let k=0;k<=steps;k++){const x=Math.round(a.x+(b.x-a.x)*k/steps)-min;if(x>=0&&x<density.length)density[x]++;}}
 const runs:{from:number;to:number;width:number}[]=[];let from=-1;
 for(let i=1;i<density.length-1;i++){if(density[i]===0&&from<0)from=i;if((density[i]>0||i===density.length-2)&&from>=0){const to=density[i]>0?i-1:i;if(to-from>=2)runs.push({from:from+min,to:to+min,width:to-from+1});from=-1;}}
 const chosen=runs.sort((a,b)=>b.width-a.width).slice(0,expected).sort((a,b)=>a.from-b.from);
 if(chosen.length!==expected)throw new Error('Die Wortabstände waren nicht deutlich genug. Bitte lasse zwischen den Wörtern etwas mehr Platz.');
 return chosen.map(g=>(g.from+g.to)/2);
}

export function extractCalibrationLine(strokes:Stroke[],text:string):Record<string,Glyph>{
 const words=text.split(' '),gaps=inkGaps(strokes,words.length-1),points=strokes.flat(),left=Math.min(...points.map(p=>p.x))-2,right=Math.max(...points.map(p=>p.x))+2,bounds=[left,...gaps,right],glyphs:Record<string,Glyph>={};
 for(let w=0;w<words.length;w++){
  const local=sliceStrokes(strokes,bounds[w],bounds[w+1]);
  const sample=analyzeWord(local,words[w],'pen',`cal-${w}`);
  Array.from(words[w]).forEach((char,i)=>{const shape=sliceStrokes(sample.strokes,sample.cuts[i],sample.cuts[i+1]);if(shape.flat().length<2)throw new Error(`„${char}“ konnte nicht sauber getrennt werden. Schreibe die Buchstaben etwas deutlicher.`);glyphs[char]={source:'pen',advance:sample.cuts[i+1]-sample.cuts[i],strokes:shape};});
 }
 return glyphs;
}

export function extractCalibrationAlphabet(lines:Stroke[][]):Record<string,Glyph>{
 if(lines.length!==CALIBRATION_LINES.length)throw new Error('Bitte schreibe beide Zeilen.');
 const glyphs=Object.assign({},...CALIBRATION_LINES.map((text,i)=>extractCalibrationLine(lines[i],text)));
 const missing=Array.from('abcdefghijklmnopqrstuvwxyz').filter(c=>!glyphs[c]);
 if(missing.length)throw new Error(`Nicht sicher erkannt: ${missing.join(' ')}. Bitte versuche die Kurzzeile erneut oder nutze a–z einzeln.`);
 return glyphs;
}
