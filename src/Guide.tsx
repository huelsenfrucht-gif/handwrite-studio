import { demoGlyphs } from './demo';
import type { Glyph } from './model';

/**
 * Writing guide like a school exercise book: four lines in three equal zones
 * (Oberlänge · x-height · Unterlänge) and a very light model text behind it.
 * The model only helps with orientation; it is never saved.
 */
const LINE = '#cdd4de', MODEL = '#e9ecf1';

/** Glyph space (ascender 4, x-height 34, baseline 80, descender ~104) → three equal zones. */
export const guideY = (y: number, top: number, zone: number) =>
  y < 34 ? top + zone * (y - 4) / 30 : y <= 80 ? top + zone + zone * (y - 34) / 46 : top + 2 * zone + zone * (y - 80) / 24;

export function GuideLines({ x1, x2, top, zone }: { x1: number; x2: number; top: number; zone: number }) {
  return <g stroke={LINE} strokeWidth={1.3} aria-hidden="true" pointerEvents="none">
    {[0, 1, 2, 3].map(i => <line key={i} x1={x1} x2={x2} y1={top + i * zone} y2={top + i * zone} />)}
  </g>;
}

/** Light model text drawn from the built-in single-line letters; `cx` centres it, otherwise it starts at `x`. */
export function GuideText({ text, top, zone, x = 0, cx, maxWidth = Infinity }: { text: string; top: number; zone: number; x?: number; cx?: number; maxWidth?: number }) {
  const placed: { strokes: Glyph['strokes']; at: number }[] = [];
  let pos = 0;
  for (const c of Array.from(text)) {
    const g = demoGlyphs[c]?.[0];
    if (!g) { pos += 28; continue; }
    placed.push({ at: pos, strokes: g.strokes });
    pos += g.advance;
  }
  // Natural width is a bit wider than the x-height; long sentences get narrowed only as far as needed.
  const sx = Math.min(zone / 40, maxWidth / Math.max(1, pos)), start = cx === undefined ? x : cx - pos * sx / 2;
  const path = (s: Glyph['strokes'][number], at: number) => s.map((p, i) => `${i ? 'L' : 'M'}${(start + (at + p.x) * sx).toFixed(1)} ${guideY(p.y, top, zone).toFixed(1)}`).join(' ');
  return <g fill="none" stroke={MODEL} strokeWidth={Math.max(1.6, zone * .05)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" pointerEvents="none">
    {placed.flatMap((g, i) => g.strokes.map((s, j) => <path key={`${i}-${j}`} d={path(s, g.at)} />))}
  </g>;
}
