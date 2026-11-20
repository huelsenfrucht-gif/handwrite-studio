import { analyzeWord, estimateSlant, findCuts, sliceStrokes } from './contextual';
import type { Glyph, Stroke } from './model';
import { t } from './i18n';

// Six minimal name lines cover a–z and A–Z together. The selected names also
// contain every required lowercase form, so no filler sentence is necessary.
export const CALIBRATION_LINES=[
 'Anja Ben Cora Dan Eva',
 'Felix Gabi Hugo Ida',
 'Jacques Kyle Liz Matt',
 'Noa Oskar Philipp Quinn',
 'Ralf Sam Tom Uwe Vic',
 'Wim Xu Yan Zoe',
] as const;

/** The `expected` widest empty columns between words, left to right (from/to in input units). */
export function inkGapRuns(strokes:Stroke[],expected:number){
 const points=strokes.flat();if(points.length<12)throw new Error(t('Bitte schreibe die vollständige Zeile.'));
 const min=Math.floor(Math.min(...points.map(p=>p.x))),max=Math.ceil(Math.max(...points.map(p=>p.x))),density=new Float64Array(max-min+2);
 for(const stroke of strokes)for(let i=1;i<stroke.length;i++){const a=stroke[i-1],b=stroke[i],steps=Math.max(1,Math.ceil(Math.abs(b.x-a.x)));for(let k=0;k<=steps;k++){const x=Math.round(a.x+(b.x-a.x)*k/steps)-min;if(x>=0&&x<density.length)density[x]++;}}
 const runs:{from:number;to:number;width:number}[]=[];let from=-1;
 for(let i=1;i<density.length-1;i++){if(density[i]===0&&from<0)from=i;if((density[i]>0||i===density.length-2)&&from>=0){const to=density[i]>0?i-1:i;if(to-from>=2)runs.push({from:from+min,to:to+min,width:to-from+1});from=-1;}}
 const chosen=runs.sort((a,b)=>b.width-a.width).slice(0,expected).sort((a,b)=>a.from-b.from);
 if(chosen.length!==expected)throw new Error(t('Die Wortabstände waren nicht deutlich genug. Bitte lasse zwischen den Wörtern etwas mehr Platz.'));
 return chosen;
}
function inkGaps(strokes:Stroke[],expected:number){return inkGapRuns(strokes,expected).map(g=>(g.from+g.to)/2);}

export function extractCalibrationLine(strokes:Stroke[],text:string):Record<string,Glyph[]>{
 const words=text.split(' '),gaps=inkGaps(strokes,words.length-1),points=strokes.flat(),left=Math.min(...points.map(p=>p.x))-2,right=Math.max(...points.map(p=>p.x))+2,bounds=[left,...gaps,right],glyphs:Record<string,Glyph[]>={};
 for(let w=0;w<words.length;w++){
  const local=sliceStrokes(strokes,bounds[w],bounds[w+1]);
  const sample=analyzeWord(local,words[w],'pen',`cal-${w}`);
  // Slanted handwriting is cut along its own slant: shear upright, find the
  // letter boundaries, then restore the original slant for every letter.
  const k=estimateSlant(sample.strokes),upright=sample.strokes.map(s=>s.map(p=>({...p,x:p.x+k*(p.y-80)}))),ux=upright.flat().map(p=>p.x),u0=Math.min(...ux),shifted=upright.map(s=>s.map(p=>({...p,x:p.x-u0}))),uw=Math.max(...ux)-u0;
  const cuts=findCuts(shifted,words[w],uw);
  Array.from(words[w]).forEach((char,i)=>{const shape=sliceStrokes(shifted,cuts[i],cuts[i+1]).map(s=>s.map(p=>({...p,x:p.x-k*(p.y-80)})));if(shape.flat().length<2)throw new Error(t('„{c}“ konnte nicht sauber getrennt werden. Schreibe die Buchstaben etwas deutlicher.',{c:char}));(glyphs[char]??=[]).push({source:'pen',advance:cuts[i+1]-cuts[i],strokes:shape});});
 }
 return glyphs;
}

export function extractCalibrationAlphabet(lines:Stroke[][]):Record<string,Glyph[]>{
 if(lines.length!==CALIBRATION_LINES.length)throw new Error(t('Bitte schreibe alle Klein- und Großbuchstaben-Zeilen.'));
 const glyphs:Record<string,Glyph[]>={};
 CALIBRATION_LINES.forEach((text,i)=>{for(const [char,variants] of Object.entries(extractCalibrationLine(lines[i],text)))(glyphs[char]??=[]).push(...variants);});
 for(const [char,variants] of Object.entries(glyphs)){const widths=variants.map(g=>g.advance).sort((a,b)=>a-b),median=widths[Math.floor(widths.length/2)];glyphs[char]=variants.filter(g=>g.advance>median*.45&&g.advance<median*1.9).slice(0,4);}
 const missing=Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').filter(c=>!glyphs[c]);
 if(missing.length)throw new Error(t('Nicht sicher erkannt: {chars}. Bitte versuche die Zeilen erneut oder nutze die Einzeleingabe.',{chars:missing.join(' ')}));
 return glyphs;
}
