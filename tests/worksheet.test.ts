import { describe, expect, it } from 'vitest';
import { newNote } from '../src/model';
import { layout } from '../src/engine';
import { findAnswerAreas } from '../src/worksheet';

describe('tables in the text', () => {
  it('writes "| a | b |" rows as a table with drawn rules', () => {
    const n = newNote(); n.renderedText = 'Bäume\n| Laub | Nadel |\n|---|---|\n| Eiche | Fichte |\nEnde';
    const r = layout(n, []), rules = r.glyphs.filter(g => g.char === ''), letters = r.glyphs.filter(g => g.char);
    expect(rules.length).toBe(2 * 4 + 1); // per row: top rule + three verticals; one bottom rule
    expect(letters.map(g => g.char).join('')).toBe('BäumeLaubNadelEicheFichteEnde');
    const nadel = letters.find(g => g.char === 'N')!, laub = letters.find(g => g.char === 'L')!;
    expect(Math.abs(nadel.y - laub.y)).toBeLessThan(1); // same row
    expect(nadel.x).toBeGreaterThan(laub.x + 40); // own column
  });
});

describe('worksheet fields', () => {
  it('writes field text inside its box', () => {
    const n = newNote(); n.fields = [{ id: 'f', page: 0, x: 300, y: 400, width: 200, height: 30, text: 'Antwort' }];
    const g = layout(n, []).glyphs;
    expect(g).toHaveLength(7);
    for (const glyph of g) for (const p of glyph.strokes.flat()) { expect(p.x).toBeGreaterThanOrEqual(298); expect(p.x).toBeLessThanOrEqual(502); expect(p.y).toBeGreaterThan(395); expect(p.y).toBeLessThan(435); }
  });
  it('shrinks long answers until they fit the box', () => {
    const n = newNote(); n.fields = [{ id: 'f', page: 0, x: 100, y: 100, width: 120, height: 60, text: 'Eine längere Antwort mit vielen Wörtern' }];
    const ys = layout(n, []).glyphs.flatMap(g => g.strokes.flat().map(p => p.y));
    expect(Math.max(...ys)).toBeLessThanOrEqual(164); expect(Math.min(...ys)).toBeGreaterThanOrEqual(96);
  });
  it('finds empty table cells and answer lines on a scanned sheet', () => {
    const w = 800, h = 1130, gray = new Uint8Array(w * h).fill(255);
    const hline = (y: number, x1: number, x2: number) => { for (let x = x1; x <= x2; x++) gray[y * w + x] = gray[(y + 1) * w + x] = 0; };
    const vline = (x: number, y1: number, y2: number) => { for (let y = y1; y <= y2; y++) gray[y * w + x] = gray[y * w + x + 1] = 0; };
    // 2 × 2 table: left cells printed, right cells empty.
    for (const y of [100, 160, 220]) hline(y, 100, 600);
    for (const x of [100, 350, 600]) vline(x, 100, 221);
    for (const y of [120, 180]) for (let x = 130; x < 200; x += 3) for (let k = 0; k < 14; k++) gray[(y + k) * w + x] = 0;
    // "Name: ______"
    for (let x = 100; x < 140; x += 4) for (let k = 0; k < 14; k++) gray[(400 + k) * w + x] = 0;
    hline(414, 160, 500);
    const areas = findAnswerAreas(gray, w, h);
    expect(areas).toHaveLength(3);
    expect(areas.filter(a => Math.abs(a.x - 350) < 3)).toHaveLength(2);
    const line = areas.find(a => a.y > 300)!;
    expect(line.x).toBeCloseTo(160, -1); expect(line.y + line.height).toBeGreaterThan(405);
  });
});
