import type { WordSample } from './contextual';
export type Point = { x: number; y: number; p?: number };
export type Stroke = Point[];
export type RasterInk = { data: string; x: number; y: number; width: number; height: number };
export type Glyph = { strokes: Stroke[]; advance: number; source: 'pen' | 'photo' | 'demo'; raster?: RasterInk; hiddenByRaster?: boolean; position?:'initial'|'medial'|'final'|'isolated' };
export type Profile = { id: string; name: string; created: string; glyphs: Record<string, Glyph[]>; words?: WordSample[]; styleImages?: string[] };
export type Paper = 'lined' | 'grid' | 'blank';
export type Settings = { size: number; lineHeight: number; variation: number; color: string; penWidth: number; paper: Paper; profileId: string; seed: number };
export type Edit = { dx?: number; dy?: number; deleted?: boolean; color?: string; hiddenStrokes?: number[] };
export type Annotation = { id: string; page: number; points: Stroke; color: string; width: number };
export type Drawing = { id: string; page: number; name: string; strokes: Stroke[]; x: number; y: number; scale: number; width: number; height: number; color: string; penWidth: number; hiddenStrokes?: number[]; deleted?: boolean };
export type Note = { id: string; title: string; text: string; renderedText: string; settings: Settings; edits: Record<string, Edit>; annotations: Annotation[]; drawings?: Drawing[]; updated: string };
export type Library = { version: 1; profiles: Profile[]; notes: Note[]; activeId: string };
export type PlacedGlyph = { id: string; char: string; page: number; strokes: Stroke[]; x: number; y: number; width: number; height: number; fallback: boolean; unsupported: boolean; raster?: RasterInk; hiddenByRaster?: boolean };
export const PAGE = { width: 794, height: 1123, margin: 70 };
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyzäöüßABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.,!?;:-+()„“/=@%';
export const uid = () => crypto.randomUUID();
export const defaultSettings: Settings = { size: 27, lineHeight: 43, variation: 25, color: '#263e62', penWidth: 1.7, paper: 'lined', profileId: 'demo', seed: 42 };
export function newNote(title = 'Unbenanntes Dokument'): Note { return { id: uid(), title, text: '', renderedText: '', settings: { ...defaultSettings }, edits: {}, annotations: [], drawings: [], updated: new Date().toISOString() }; }
export function initialLibrary(): Library {
  const note = newNote('Ein kleiner Anfang');
  note.text = note.renderedText = 'Ein kleiner Anfang\n\nManchmal braucht eine gute Idee\nnur ein leeres Blatt Papier.\n\nPlatz für Gedanken, große Pläne\nund all die kleinen Dinge, die\nwir nicht vergessen möchten.\n\nMach etwas Eigenes daraus.';
  return { version: 1, profiles: [], notes: [note], activeId: note.id };
}
export function smooth(points: Stroke): Stroke {
  if (points.length < 3) return points;
  const result: Stroke = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0,i-1)], b = points[i], c = points[i+1], d = points[Math.min(points.length-1,i+2)];
    for (let s=0;s<5;s++) { const t=s/5,t2=t*t,t3=t2*t;
      result.push({x:.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t2+(-a.x+3*b.x-3*c.x+d.x)*t3), y:.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t2+(-a.y+3*b.y-3*c.y+d.y)*t3),p:b.p});
    }
  }
  result.push(points[points.length-1]); return result;
}
export function pathData(points: Stroke) { return points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+(points.length===1?` l0.01,0`:''); }
// Normalise to a baseline of 80 and an x-height of 42; preserve ascenders/descenders.
export function normalise(strokes: Stroke[], char: string, source: Glyph['source']): Glyph {
  const pts = strokes.flat(); if (!pts.length) throw new Error('Schreibe oder markiere zuerst einen Buchstaben.');
  const minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x));
  const minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
  const desc=/[gjpqy]/.test(char), tall=/[A-ZÄÖÜbdfhklt0-9ß!?()]/.test(char), dot=/[.,:;"„“'\-+=]/.test(char);
  const height=dot?18:desc?65:tall?76:46;
  const scale=height/Math.max(maxY-minY,1), top=dot?62:desc?35:80-height;
  return { source, advance: Math.max(16,Math.min(145,(maxX-minX)*scale+13)), strokes: strokes.map(s=>s.map(p=>({x:(p.x-minX)*scale+3,y:(p.y-minY)*scale+top,p:p.p}))) };
}
