import { describe,expect,it } from 'vitest';
import { initialLibrary,newNote,type Profile,type Stroke } from '../src/model';
import { layout,random,resolvedStrokes } from '../src/engine';
import { analyzeWord,composeWord,sliceStrokes } from '../src/contextual';
import { vectorize } from '../src/vectorize';
import { validateLibrary } from '../src/storage';
import { makeSVG } from '../src/export';
const wave:Stroke=Array.from({length:161},(_,i)=>({x:i*2,y:60+30*Math.sin(i/8),p:.2+i/300}));
const word=analyzeWord([wave],'meine','pen','sample');
const profile:Profile={id:'personal',name:'Meine Handschrift',created:new Date().toISOString(),glyphs:{},words:[word]};
describe('connected handwriting',()=>{
 it('keeps a learned word geometrically intact across editable character boundaries',()=>{
  const out=composeWord('meine',profile,random(1));expect(out.kind).toBe('original');expect(out.glyphs).toHaveLength(5);
  let x=0;const recovered:Stroke=[];for(const g of out.glyphs){for(const s of g.strokes)recovered.push(...s.map(p=>({...p,x:p.x+x})));x+=g.advance;}
  expect(x).toBeCloseTo(word.width,5);
  for(const p of word.strokes.flat())expect(recovered.some(q=>Math.abs(p.x-q.x)<.001&&Math.abs(p.y-q.y)<.001)).toBe(true);
 });
 it('uses entire observed fragments inside unseen words without inserting joins within them',()=>{
  const out=composeWord('meinen',profile,random(1));expect(out.kind).toBe('contextual');
  const original=composeWord('meine',profile,random(1));for(let i=0;i<4;i++)expect(out.glyphs[i]).toEqual(original.glyphs[i]);
 });
 it('interpolates exact clip intersections and preserves reverse pen motion',()=>{
  const strokes=sliceStrokes([[{x:0,y:0},{x:100,y:50},{x:0,y:100}]],25,75);
  expect(strokes).toHaveLength(2);expect(strokes[0][0]).toEqual({x:0,y:12.5,p:.5});expect(strokes[0].at(-1)?.x).toBe(50);expect(strokes[1][0].x).toBe(50);expect(strokes[1].at(-1)?.x).toBe(0);
 });
 it('refuses unlabelled sentences and blank drawings',()=>{expect(()=>analyzeWord([wave],'two words','pen','x')).toThrow();expect(()=>analyzeWord([],'word','pen','x')).toThrow();});
 it('detects connected writing and retains pressure measurements',()=>{expect(word.metrics.joining).toBeGreaterThan(.7);expect(word.strokes[0][0].p).toBe(.2);expect(word.cuts).toHaveLength(6);});
});
describe('document layout and editing',()=>{
 it('paginates long notes without dropping characters',()=>{const n=newNote();n.renderedText=('Ein langer Text mit Umlauten äöü und Zahlen 123.\n').repeat(160);const r=layout(n,[]);expect(r.pages).toBeGreaterThan(3);expect(r.glyphs).toHaveLength(Array.from(n.renderedText.replace(/\s/g,'')).length);expect(r.glyphs.every(g=>g.x>=70&&g.y>=70)).toBe(true);});
 it('is deterministic for a fixed seed',()=>{const n=initialLibrary().notes[0];expect(layout(n,[])).toEqual(layout(n,[]));});
 it('reports unlearned personal characters and unsupported symbols separately',()=>{const n=newNote();n.settings.profileId=profile.id;n.renderedText='meine Z 🦋';const r=layout(n,[profile]);expect(r.originalWords).toBe(1);expect(r.fallback).toContain('Z');expect(r.fallback).not.toContain('m');expect(r.missing).toContain('🦋');});
 it('keeps original word boundaries connected after variation transforms',()=>{const n=newNote();n.settings.profileId=profile.id;n.settings.variation=100;n.renderedText='meine';const r=layout(n,[profile]);for(let i=0;i<4;i++){const a=r.glyphs[i].strokes.at(-1)!.at(-1)!,b=r.glyphs[i+1].strokes[0][0];expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.001);}});
 it('exports moved ink and erases only the targeted stroke',()=>{const n=newNote();n.renderedText='i';const g=layout(n,[]).glyphs[0];expect(g.strokes.length).toBe(2);n.edits[g.id]={dx:30,dy:-8,hiddenStrokes:[1],color:'#ff0000'};const r=resolvedStrokes(g,n);expect(r.strokes).toHaveLength(1);expect(r.strokes[0][0].x).toBeCloseTo(g.strokes[0][0].x+30);const svg=makeSVG(n,[],0);expect(svg).toContain('stroke="#ff0000"');expect(svg).not.toContain('<text');});
});
describe('photo vectorization',()=>{
 const raster=(w:number,h:number,predicate:(x:number,y:number)=>boolean)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=predicate(x,y)?0:255;data[i+3]=255;}return data;};
 it('extracts a centreline from a thick photographed stroke',()=>{const paths=vectorize(raster(50,60,(x,y)=>x>=20&&x<=27&&y>7&&y<52),50,60,155);const pts=paths.flat();expect(pts.length).toBeGreaterThan(20);expect(Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x))).toBeLessThan(3);});
 it('preserves closed loops',()=>{const paths=vectorize(raster(60,60,(x,y)=>{const d=Math.hypot(x-30,y-30);return d>14&&d<20;}),60,60,155);expect(paths.flat().length).toBeGreaterThan(60);});
 it('rejects empty crops',()=>{expect(()=>vectorize(raster(20,20,()=>false),20,20,155)).toThrow('Keine dunklen Striche');});
});
describe('portable backup validation',()=>{
 it('round-trips real word training, edits and annotations',()=>{const lib=initialLibrary();lib.profiles=[profile];lib.notes[0].settings.profileId=profile.id;lib.notes[0].annotations=[{id:'a',page:0,points:wave,color:'#123456',width:2}];expect(validateLibrary(JSON.parse(JSON.stringify(lib)))).toEqual(lib);});
 it('rejects malicious colors, invalid references, bad cuts, and non-finite positions',()=>{
  const a=initialLibrary();a.notes[0].settings.color='red"/><script>';expect(()=>validateLibrary(a)).toThrow();
  const b=initialLibrary();b.notes[0].settings.profileId='missing';expect(()=>validateLibrary(b)).toThrow();
  const c=initialLibrary();c.profiles=[structuredClone(profile)];c.profiles[0].words![0].cuts[1]=-3;expect(()=>validateLibrary(c)).toThrow();
  const d=initialLibrary();d.notes[0].edits['0']={dx:Infinity};expect(()=>validateLibrary(d)).toThrow();
 });
});
describe('PDF export',()=>{
 it('creates valid multi-page vector PDF output with edits applied',async()=>{const {createPDF}=await import('../src/export');const n=newNote('Export-Test');n.renderedText=('Ein Wort pro Zeile.\n').repeat(70);n.edits['0']={deleted:true};n.annotations=[{id:'manual',page:0,color:'#123456',width:2,points:[{x:100,y:200},{x:150,y:220}]}];const pdf=await createPDF(n,[]);expect(pdf.getNumberOfPages()).toBe(layout(n,[]).pages);expect(pdf.getNumberOfPages()).toBeGreaterThan(1);const data=pdf.output();expect(data.startsWith('%PDF-')).toBe(true);expect(data).toContain('/Title (Export-Test)');expect(data).not.toContain('/Subtype /Image');});
});
describe('learned fragment transition directions',()=>{
 it('preserves endpoint positions and follows the observed pen tangents',async()=>{const {connect}=await import('../src/joins');const result=connect({point:{x:20,y:60,p:.2},tangent:{x:1,y:-1}},{point:{x:0,y:50,p:.8},tangent:{x:1,y:1}},40);expect(result[0]).toEqual({x:20,y:60,p:.2});expect(result.at(-1)).toEqual({x:40,y:50,p:.8});expect(result[1].y).toBeLessThan(60);expect(result.at(-2)!.y).toBeLessThan(50);});
 it('does not change geometric exit direction when a photo path is reversed',async()=>{const {endpoints}=await import('../src/joins');const s=[{x:0,y:80},{x:10,y:70},{x:20,y:60}];const forward=endpoints([s],'exit').find(e=>e.point.x===20);const reverse=endpoints([[...s].reverse()],'exit').find(e=>e.point.x===20);expect(forward).toEqual(reverse);expect(forward!.tangent.y).toBeLessThan(0);});
});
