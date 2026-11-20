import type { WordSample } from './contextual';
import { t } from './i18n';
export type Point = { x: number; y: number; p?: number };
export type Stroke = Point[];
export type RasterInk = { data: string; x: number; y: number; width: number; height: number };
export type Glyph = { strokes: Stroke[]; advance: number; source: 'pen' | 'photo' | 'demo'; raster?: RasterInk; hiddenByRaster?: boolean; position?:'initial'|'medial'|'final'|'isolated';
  /** Part of a handwritten letter pair: already connected to the next letter, no extra spacing or join. */
  glue?: boolean;
  /** Punctuation placed on the guide lines (newer, correct height). */
  lined?: boolean };
/** Two or three letters written together ("ch", "Cl", "sch"), with the cut positions between them. */
export type PairSample = { strokes: Stroke[]; cuts: number[]; width: number };
/** What the writing-rhythm sentences taught: word gap (glyph units) and how often letters are joined. */
export type Rhythm = { wordGap: number; joining: number; samples: number };
export type Profile = { id: string; name: string; created: string; updated?: string; glyphs: Record<string, Glyph[]>; words?: WordSample[]; styleImages?: string[];
  /** Stufe 4–5: handwritten letter connections. */
  pairs?: Record<string, PairSample[]>;
  /** Stufe 3: writing rhythm from short sentences. */
  rhythm?: Rhythm;
  /** Stufe 4–5 unlocked (once, by a voluntary video). */
  unlocked?: boolean };
export type Paper = 'lined' | 'grid' | 'blank' | 'custom';
/** A user's own paper (image or PDF pages, e.g. a worksheet) as A4 JPEG data URLs. */
export type Template = { id: string; name: string; pages: string[]; created: string };
export type Settings = { size: number; lineHeight: number; wordSpacing: number; variation: number; color: string; penWidth: number; paper: Paper; profileId: string; seed: number; templateId?: string; templatePages?: number;
  /** Text margins in millimetres (A4 = 210 mm wide). Undefined = default. */
  marginLeft?: number; marginRight?: number;
  /** Empty ruled lines kept free at the top of every page, additionally on the first page, and at the bottom. */
  linesTop?: number; linesFirstPage?: number; linesBottom?: number;
  /** Extra space between letters in percent of the letter width. */
  letterSpacing?: number;
  /** Mark all headings with a highlighter in this colour. */
  highlightHeadings?: boolean; highlightColor?: string;
  /** How far line starts wander to the right, like in real handwriting (0–100 %). */
  lineStartShift?: number };
/** The highlighter colours of Goodnotes' standard set. */
export const HIGHLIGHT_COLORS = ['#ffdd33', '#8be05a', '#6cc6ff', '#ff86c8', '#ffaa45'];
export type Edit = { dx?: number; dy?: number; deleted?: boolean; color?: string; hiddenStrokes?: number[] };
export type Annotation = { id: string; page: number; points: Stroke; color: string; width: number };
export type Drawing = { id: string; page: number; name: string; strokes: Stroke[]; strokeColors?: string[]; x: number; y: number; scale: number; width: number; height: number; color: string; penWidth: number; hiddenStrokes?: number[]; deleted?: boolean };
/** An answer area on a worksheet (custom paper): the text is written into this box in the note's handwriting. */
export type Field = { id: string; page: number; x: number; y: number; width: number; height: number; text: string;
  /** Several answer lines below each other: the text sits on each of them. */
  rows?: number;
  /** Name, date, class: never filled from the answer text. */
  role?: 'header';
  /** Found as an empty table cell or above an answer line; drawn by hand otherwise. */
  kind?: 'cell' | 'line' };
export type Note = { id: string; folderId?: string; favorite?: boolean; title: string; text: string; renderedText: string; settings: Settings; edits: Record<string, Edit>; annotations: Annotation[]; drawings?: Drawing[]; fields?: Field[]; updated: string };
export type Folder = { id: string; name: string; color: string; parentId?: string; favorite?: boolean; created: string; updated: string };
export type Library = { version: 1; profiles: Profile[]; notes: Note[]; activeId: string; templates?: Template[]; folders?: Folder[];
  /** Deleted item ids with deletion time, so a sync does not bring them back. */
  deleted?: Record<string, string>;
  /** Choices from the settings for every new document. */
  defaults?: { profileId?: string; penWidth?: number; size?: number; marginLeft?: number; marginRight?: number; lineStartShift?: number } };
export const FOLDER_COLORS = ['#5aa9f8', '#f25c5c', '#9b2c2c', '#38b2ac', '#f6ad55', '#9f7aea', '#68d391', '#a0aec0'];
export type PlacedGlyph = { id: string; char: string; page: number; strokes: Stroke[]; x: number; y: number; width: number; height: number; fallback: boolean; unsupported: boolean; raster?: RasterInk; hiddenByRaster?: boolean };
export const PAGE = { width: 794, height: 1123, margin: 70 };
export const MM = PAGE.width / 210;
export const DEFAULT_MARGIN_MM = PAGE.margin / MM;
/** Fallback for documents without stored margins (keeps older documents unchanged). */
export const DEFAULT_MARGIN_LEFT_MM = 8.5, DEFAULT_MARGIN_RIGHT_MM = 12;
/** Standards for new documents (changeable under Einstellungen → Neue Dokumente). */
export const NEW_MARGIN_LEFT_MM = 5.5, NEW_MARGIN_RIGHT_MM = 12, DEFAULT_LINE_START_SHIFT = 50;
/** Left and right text margin in page pixels. */
export function textMargins(s: Settings) { const l = (s.marginLeft ?? DEFAULT_MARGIN_LEFT_MM) * MM, r = (s.marginRight ?? DEFAULT_MARGIN_RIGHT_MM) * MM; return { left: l, right: PAGE.width - r }; }
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyzäöüßABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.,!?;:-+()„“/=@%';
export const uid = () => crypto.randomUUID();
// Geometry of Goodnotes' standard A4 papers, measured from the bundled
// Goodnotes templates (595.28 × 841.89 pt): ruled = 25 pt line pitch with the
// first line 49.75 pt from the top, full page width, 0.5 pt, #D0D2D3.
export const PT = PAGE.width / 595.28;
export const GOODNOTES = { linePitch: 25*PT, firstLine: 49.75*PT, lastLine: (841.89-17.64)*PT, gridPitch: 16*PT, gridFirst: 15.75*PT, color: '#d0d2d3', width: .5*PT };
/** Goodnotes standard: handwriting sized to sit naturally on the ruled lines. */
export const GOODNOTES_STANDARD = { size: 18, lineHeight: GOODNOTES.linePitch, wordSpacing: 52, paper: 'lined' } satisfies Partial<Settings>;
export const PEN_WIDTHS = [.8, 1.2, 1.7, 2.2, 3, 4];
export const isGoodnotesStandard = (s: Settings) => (Object.keys(GOODNOTES_STANDARD) as (keyof typeof GOODNOTES_STANDARD)[]).every(k => s[k] === GOODNOTES_STANDARD[k]);
export type Rule = { x1: number; y1: number; x2: number; y2: number };
/** First baseline and pitch of text lines for the chosen paper. */
export function textLines(s: Settings) {
  const minimum = Math.max(PAGE.margin * .55, s.size * .8 + 16);
  if (s.paper === 'lined') { const k = Math.max(0, Math.ceil((minimum - GOODNOTES.firstLine) / s.lineHeight - 1e-6)); return { first: GOODNOTES.firstLine + k * s.lineHeight, last: GOODNOTES.lastLine + 1 }; }
  if (s.paper === 'grid') { const k = Math.ceil((PAGE.margin + s.size * .8 - GOODNOTES.gridFirst) / GOODNOTES.gridPitch); return { first: GOODNOTES.gridFirst + k * GOODNOTES.gridPitch, last: PAGE.height - 30 }; }
  return { first: PAGE.margin + s.size * .8, last: PAGE.height - PAGE.margin * .6 };
}
const ruleCache = new Map<string, Rule[]>();
/** Background ruling, identical in the editor, PDF, SVG and previews. */
export function paperRules(s: Settings): Rule[] {
  const key = `${s.paper}:${s.lineHeight}`; const hit = ruleCache.get(key); if (hit) return hit;
  const rules: Rule[] = [];
  if (s.paper === 'lined') for (let y = GOODNOTES.firstLine; y <= GOODNOTES.lastLine + 1; y += s.lineHeight) rules.push({ x1: 0, x2: PAGE.width, y1: y, y2: y });
  if (s.paper === 'grid') { for (let y = GOODNOTES.gridFirst; y < PAGE.height; y += GOODNOTES.gridPitch) rules.push({ x1: 0, x2: PAGE.width, y1: y, y2: y }); for (let x = GOODNOTES.gridFirst; x < PAGE.width; x += GOODNOTES.gridPitch) rules.push({ x1: x, x2: x, y1: 0, y2: PAGE.height }); }
  if (ruleCache.size > 30) ruleCache.clear(); ruleCache.set(key, rules); return rules;
}
export const defaultSettings: Settings = { ...GOODNOTES_STANDARD, variation: 100, penWidth: 1.7, color: '#000000', profileId: 'demo', seed: 42 };
export function newNote(title = t('Unbenanntes Dokument'), defaults?: Library['defaults']): Note { return { id: uid(), title, text: '', renderedText: '', settings: { ...defaultSettings, marginLeft: defaults?.marginLeft ?? NEW_MARGIN_LEFT_MM, marginRight: defaults?.marginRight ?? NEW_MARGIN_RIGHT_MM, lineStartShift: defaults?.lineStartShift ?? DEFAULT_LINE_START_SHIFT, ...(defaults?.profileId ? { profileId: defaults.profileId } : {}), ...(defaults?.penWidth ? { penWidth: defaults.penWidth } : {}), ...(defaults?.size ? { size: defaults.size } : {}) }, edits: {}, annotations: [], drawings: [], updated: new Date().toISOString() }; }
export function initialLibrary(): Library {
  const note = newNote(t('Ein kleiner Anfang'));
  note.text = note.renderedText = t('Ein kleiner Anfang\n\nManchmal braucht eine gute Idee\nnur ein leeres Blatt Papier.\n\nPlatz für Gedanken, große Pläne\nund all die kleinen Dinge, die\nwir nicht vergessen möchten.\n\nMach etwas Eigenes daraus.');
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
/**
 * Drops points that do not change the visible line (Ramer–Douglas–Peucker).
 * The pencil delivers ~240 points per second and smooth() adds four more per
 * point; a letter then holds ~600 points. With a tolerance of 0.12 units
 * (x-height is 42) the shape stays identical on screen and in exports while
 * long documents need about a tenth of the memory.
 */
export function simplify(points: Stroke, tolerance = .12): Stroke {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]], tol2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop()!, A = points[a], B = points[b], dx = B.x - A.x, dy = B.y - A.y, len2 = dx * dx + dy * dy;
    let worst = 0, index = -1;
    for (let i = a + 1; i < b; i++) {
      const P = points[i]; let ex = P.x - A.x, ey = P.y - A.y;
      if (len2 > 0) { const t = Math.max(0, Math.min(1, (ex * dx + ey * dy) / len2)); ex -= t * dx; ey -= t * dy; }
      const d = ex * ex + ey * ey; if (d > worst) { worst = d; index = i; }
    }
    if (index > 0 && worst > tol2) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const pathCache = new WeakMap<Stroke, string>();
export function pathData(points: Stroke) { const hit = pathCache.get(points); if (hit !== undefined) return hit; let d = ''; for (let i = 0; i < points.length; i++) d += `${i ? ' L' : 'M'}${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`; if (points.length === 1) d += ' l0.01,0'; pathCache.set(points, d); return d; }
// Normalise to a baseline of 80 and an x-height of 42; preserve ascenders/descenders.
/**
 * Punctuation keeps the height at which it was written relative to the guide lines of the
 * writing pad (baseline and x-height line), so „.“ sits on the line, „,“ hangs below it,
 * „-“ floats in the middle and „““ stays at the top – instead of being stretched to letter size.
 */
export function normaliseOnLines(strokes: Stroke[], source: Glyph['source'], baseline: number, xLine: number): Glyph {
  const pts = strokes.flat(); if (!pts.length) throw new Error(t('Schreibe zuerst das Zeichen.'));
  // Pads use three equal zones; each zone maps onto the matching zone of the letters
  // (Oberlänge 4–34, x-height 34–80, Unterlänge 80–104), so nothing gets squashed.
  const zone = Math.max(10, baseline - xLine), scale = 46 / zone, minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  const y = (v: number) => v < xLine ? 34 - (xLine - v) * 30 / zone : v <= baseline ? 34 + (v - xLine) * scale : 80 + (v - baseline) * 24 / zone;
  return { source, lined: true, advance: Math.max(10, Math.min(145, (maxX - minX) * scale + 11)), strokes: strokes.map(s => simplify(s.map(p => ({ x: (p.x - minX) * scale + 3, y: Math.max(-20, Math.min(115, y(p.y))), p: p.p })))) };
}
/** Top of the frame for letters with dots (i, j, ä, ö, ü). */
export const DOT_TOP = 16;
/** A small separate mark in the top third – the dot of an i/j or the dots of an umlaut. */
export function hasDot(strokes: Stroke[]): boolean {
  const pts = strokes.flat(); if (strokes.length < 2 || !pts.length) return false;
  const minY = Math.min(...pts.map(p => p.y)), h = Math.max(1, Math.max(...pts.map(p => p.y)) - minY);
  return strokes.some(s => { const ys = s.map(p => p.y), xs = s.map(p => p.x); return Math.max(...ys) <= minY + h * .35 && Math.max(...ys) - Math.min(...ys) <= h * .22 && Math.max(...xs) - Math.min(...xs) <= h * .3; });
}
/**
 * Letters saved before the dot fix were framed from the dot down to the x-height,
 * so their body came out too small. Stretch them once to the new frame.
 */
export function undotSquash(strokes: Stroke[], text: string): Stroke[] {
  if (!/[ijäöü]/.test(text) || /[A-ZÄÖÜbdfhklt]/.test(text)) return strokes;
  const ys = strokes.flat().map(p => p.y); if (!ys.length || Math.min(...ys) < 30 || !hasDot(strokes)) return strokes;
  const desc = /[gjpqy]/.test(text), base = desc ? 100 : 80, f = (base - DOT_TOP) / (base - (desc ? 35 : 34));
  return strokes.map(s => s.map(p => ({ ...p, y: base - (base - p.y) * f })));
}
/** Satzzeichen: everything that is neither a letter nor a digit. */
export const isPunctuation = (char: string) => !/[\p{L}\p{N}]/u.test(char);
/** Written by hand and usable; punctuation only in the newer, line-placed form. */
export const hasOwnGlyph = (p: Profile, char: string) => !!p.glyphs[char]?.some(g => g.source === 'pen' && (!isPunctuation(char) || g.lined));
export function normalise(strokes: Stroke[], char: string, source: Glyph['source']): Glyph {
  const pts = strokes.flat(); if (!pts.length) throw new Error(t('Schreibe oder markiere zuerst einen Buchstaben.'));
  const minX=Math.min(...pts.map(p=>p.x)), maxX=Math.max(...pts.map(p=>p.x));
  const minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y));
  const desc=/[gjpqy]/.test(char), tall=/[A-ZÄÖÜbdfhklt0-9ß!?()]/.test(char), dot=/[.,:;"„“'\-+=]/.test(char), dotted=/^[ijäöü]$/.test(char)&&hasDot(strokes);
  // i, j and umlauts: the dots sit above the x-height, so the frame starts higher (else the letter body shrinks).
  const height=dot?18:dotted?(char==='j'?84:64):desc?65:tall?76:46;
  const scale=height/Math.max(maxY-minY,1), top=dot?62:dotted?DOT_TOP:desc?35:80-height;
  return { source, advance: Math.max(16,Math.min(145,(maxX-minX)*scale+13)), strokes: strokes.map(s=>simplify(s.map(p=>({x:(p.x-minX)*scale+3,y:(p.y-minY)*scale+top,p:p.p})))) };
}
