import { describe, expect, it } from 'vitest';
import { normalise, simplify, smooth, type Stroke } from '../src/model';

// A dense pencil stroke like the iPad records it: a loop sampled every 0.1 units.
const dense: Stroke = Array.from({ length: 1200 }, (_, i) => { const t = i / 1199 * Math.PI * 2; return { x: 40 + 30 * Math.cos(t) + i * .01, y: 50 + 30 * Math.sin(t), p: .5 }; });
const distance = (p: { x: number; y: number }, line: Stroke) => Math.min(...line.slice(1).map((b, i) => { const a = line[i], dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }));

describe('memory-friendly strokes', () => {
  it('drops redundant pencil samples without changing the visible line', () => {
    const slim = simplify(dense);
    expect(slim.length).toBeLessThan(dense.length / 10);
    expect(slim[0]).toBe(dense[0]); expect(slim.at(-1)).toBe(dense.at(-1));
    expect(Math.max(...dense.map(p => distance(p, slim)))).toBeLessThanOrEqual(.12 + 1e-9);
  });
  it('stores newly learned letters already simplified', () => {
    const glyph = normalise([smooth(dense.filter((_, i) => i % 5 === 0))], 'o', 'pen');
    expect(glyph.strokes[0].length).toBeLessThan(150);
  });
  it('keeps tiny strokes such as dots untouched', () => {
    const dot: Stroke = [{ x: 1, y: 1, p: .5 }, { x: 1.01, y: 1, p: .5 }];
    expect(simplify(dot)).toBe(dot);
  });
});
