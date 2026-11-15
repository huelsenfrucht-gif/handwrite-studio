import { describe,expect,it } from 'vitest';
import { demoGlyphs } from '../src/demo';
import { findCuts } from '../src/contextual';
import { layout } from '../src/engine';
import { newNote, type Stroke } from '../src/model';

// Builds a connected, slanted "handwritten" word from demo letters, so the true
// letter boundaries are known exactly.
function connectedWord(text:string,slant=0){
 let x=0;const strokes:Stroke[]=[],truth=[0];
 for(const c of text){const g=demoGlyphs[c][0];for(const s of g.strokes)strokes.push(s.map(p=>({...p,x:p.x+x-slant*(p.y-80)})));x+=g.advance;truth.push(x);}
 return {strokes,truth};
}
describe('letter segmentation',()=>{
 it('finds boundaries close to the real ones',()=>{
  for(const text of ['Philipp','Oskar','Jacques','Quinn','Matt']){
   const {strokes,truth}=connectedWord(text),cuts=findCuts(strokes,text,truth.at(-1)!),avg=truth.at(-1)!/text.length;
   const error=cuts.reduce((n,c,i)=>n+Math.abs(c-truth[i]),0)/cuts.length;
   expect(cuts).toHaveLength(text.length+1);
   expect(error/avg).toBeLessThan(.3);
  }
 });
});
describe('punctuation',()=>{
 it('renders quotes, apostrophes, bullets and accents without placeholders',()=>{
  const note=newNote();note.renderedText='„Das ist’s“ – « café » • Punkt … ‘x’ ‚y‘ * & # § € ° [a] {b} <c> ~ ç ñ é à å ł ž';
  const result=layout(note,[]);
  expect(result.missing).toEqual([]);
 });
});
describe('Goodnotes paper',()=>{
 it('puts every baseline exactly on a Goodnotes ruled line',async()=>{
  const {GOODNOTES,paperRules}=await import('../src/model');
  const note=newNote();note.renderedText='Zeile eins\nZeile zwei\n\nZeile vier';
  expect(note.settings.lineHeight).toBeCloseTo(25*794/595.28,1);
  const lines=paperRules(note.settings).map(r=>r.y1),r=layout(note,[]);
  expect(lines).toHaveLength(32);expect(lines[0]).toBeCloseTo(GOODNOTES.firstLine,3);
  for(const g of r.glyphs){const baseline=g.y+note.settings.size*.8;expect(lines.some(y=>Math.abs(y-baseline)<.01)).toBe(true);}
 });
});
describe('own templates',()=>{
 it('keeps every template page and draws no ruling over it',async()=>{
  const {paperRules,newNote:fresh}=await import('../src/model');
  const note=fresh();note.renderedText='Kurz';note.settings={...note.settings,paper:'custom',templateId:'t1',templatePages:3};
  expect(layout(note,[]).pages).toBe(3);expect(paperRules(note.settings)).toEqual([]);
 });
});
