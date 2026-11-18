import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initialLibrary, newNote, type Profile, type Stroke } from '../src/model';
import { composeWord } from '../src/contextual';
import { layout, random } from '../src/engine';
import { validateLibrary } from '../src/storage';
import { currentLevel, levels, measureRhythm, nextPairs, normalisePair, pairCoverage, pairRuns, PAIRS_CORE, RHYTHM_SENTENCES, splitPair, wordGapFactor } from '../src/levels';

/** A connected scribble that looks like n letters written in one movement. */
const cursive = (n: number, x0 = 0): Stroke => Array.from({ length: n * 30 + 1 }, (_, i) => ({ x: x0 + i * 1.6, y: 40 + 22 * Math.sin(i / 30 * Math.PI * 2), p: .5 }));
const letter = (): Stroke[] => [[{ x: 0, y: 0 }, { x: 20, y: 40 }, { x: 40, y: 0 }]];
const base = (): Profile => ({ id: 'p', name: 'Test', created: '2026-11-18', glyphs: Object.fromEntries(Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ').map(c => [c, [{ source: 'pen' as const, advance: 40, strokes: letter() }]])) });

describe('handwriting stages', () => {
  it('start at stage 0, reach stage 1 with the full alphabet and keep 4–5 locked until unlocked', () => {
    expect(currentLevel({ id: 'x', name: 'x', created: '', glyphs: {} })).toBe(0);
    const p = base(); expect(currentLevel(p)).toBe(1);
    expect(levels(p)[3].locked).toBe(true);
    expect(levels({ ...p, unlocked: true })[3].locked).toBe(false);
  });
  it('split a written pair into glued letters that line up again without a gap', () => {
    const s = normalisePair([cursive(2)], 'ch');
    expect(s.cuts).toHaveLength(3); expect(s.cuts[0]).toBe(0); expect(s.cuts[2]).toBe(s.width);
    const parts = splitPair(s, 'ch')!;
    expect(parts.map(g => g.glue)).toEqual([true, false]);
    expect(parts[0].advance + parts[1].advance).toBeCloseTo(s.width, 5);
  });
  it('use a written pair inside words, longest match first, and count it as coverage', () => {
    const p = base(); p.pairs = { sch: [normalisePair([cursive(3)], 'sch')], ch: [normalisePair([cursive(2)], 'ch')] };
    expect(pairRuns('Schachtel', k => !!p.pairs?.[k])).toEqual([{ start: 0, len: 1 }, { start: 1, len: 2 }, { start: 3, len: 1 }, { start: 4, len: 2 }, { start: 6, len: 1 }, { start: 7, len: 1 }, { start: 8, len: 1 }]);
    const w = composeWord('waschen', p, random(1));
    expect(w.glyphs).toHaveLength(7); expect(w.glyphs.filter(g => g.glue)).toHaveLength(2);
    expect(pairCoverage(p)).toBeGreaterThan(0); expect(pairCoverage(base())).toBe(0);
  });
  it('lay out glued letters exactly next to each other (no letter spacing, no extra join)', () => {
    const p = base(); p.pairs = { ch: [normalisePair([cursive(2)], 'ch')] };
    const n = newNote(); n.settings = { ...n.settings, profileId: 'p', letterSpacing: 30, variation: 100 }; n.renderedText = 'ach';
    const g = layout(n, [p]).glyphs, c = g.find(x => x.char === 'c')!, h = g.find(x => x.char === 'h')!;
    expect(h.x - (c.x + c.width)).toBeCloseTo(0, 3);
  });
  it('picks the most useful missing pairs for stage 5 and never repeats written ones', () => {
    const p = base(), first = nextPairs(p, 10); expect(first).toHaveLength(10);
    p.pairs = { [first[0]]: [normalisePair([cursive(2)], first[0].slice(0, 2))] };
    expect(nextPairs(p, 10)).not.toContain(first[0]);
  });
  it('learns word gap and joining from three sentences and turns it into a word-spacing factor', () => {
    const lines = RHYTHM_SENTENCES.map(s => { let x = 0; const out: Stroke[] = []; for (const w of s.split(' ')) { out.push(cursive(w.length, x)); x += w.length * 48 + 60; } return out; });
    const { rhythm, words } = measureRhythm(lines);
    expect(rhythm.samples).toBe(3); expect(words.length).toBeGreaterThanOrEqual(12); expect(rhythm.wordGap).toBeGreaterThan(0);
    const f = wordGapFactor({ ...base(), rhythm }); expect(f).toBeGreaterThanOrEqual(.6); expect(f).toBeLessThanOrEqual(1.8);
    expect(wordGapFactor(base())).toBe(1);
  });
  it('stores pairs, rhythm and the unlock in backups and rejects broken pairs', () => {
    const lib = initialLibrary(), p = base(); p.pairs = { ch: [normalisePair([cursive(2)], 'ch')] }; p.rhythm = { wordGap: 50, joining: .5, samples: 3 }; p.unlocked = true; lib.profiles = [p];
    expect(validateLibrary(JSON.parse(JSON.stringify(lib))).profiles[0].pairs?.ch).toHaveLength(1);
    const bad = JSON.parse(JSON.stringify(lib)); bad.profiles[0].pairs.ch[0].cuts = [0, 5]; expect(() => validateLibrary(bad)).toThrow();
  });
  it('covers the 20 core connections and unlocks 4–5 only through a voluntary button', () => {
    expect(PAIRS_CORE).toHaveLength(20);
    const ui = readFileSync('src/LevelSheet.tsx', 'utf8');
    expect(ui).toMatch(/onClick=\{unlock\}/); expect(ui).toContain('freiwilligen Werbevideo');
  });
});

describe('fixes from real handwriting', () => {
  // "el" written in one movement: e loop, joining stroke, tall l loop (pad coordinates, baseline 190).
  const el = (): Stroke => { const pts: Stroke = []; for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push({ x: 100 + i * 1.5 + 18 * Math.sin(t * Math.PI * 2), y: 170 - 30 * Math.sin(t * Math.PI * 1.8), p: .5 }); } for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push({ x: 160 + t * 40 + 14 * Math.sin(t * Math.PI * 2), y: 190 - 150 * Math.sin(t * Math.PI), p: .5 }); } return pts; };
  it('split connected pairs like „el“, „ll“ and „ie“ without writing them apart', async () => {
    const { smooth } = await import('../src/model');
    for (const [key, strokes] of [['el', [el()]], ['ll', [el().map(p => ({ ...p, y: p.x < 160 ? 190 - (190 - p.y) * 4 : p.y }))]], ['ie', [[{ x: 100, y: 120 }, { x: 104, y: 190 }, { x: 130, y: 150 }, { x: 150, y: 170 }, { x: 135, y: 190 }, { x: 170, y: 180 }], [{ x: 101, y: 95 }, { x: 102, y: 96 }]]]] as [string, Stroke[]][]) {
      const s = normalisePair(strokes.map(x => smooth(x)), key), parts = splitPair(s, key);
      expect(parts, key).not.toBeNull();
      expect(parts!.every(g => g.strokes.length > 0 && g.advance > 4), key).toBe(true);
    }
  });
  it('never stretches a t crossbar into a line to the next letter', async () => {
    const { random: r } = await import('../src/engine');
    const p = base(); // t: stem plus a crossbar whose right end is the rightmost point, high up
    p.glyphs.t = [{ source: 'pen', advance: 40, strokes: [[{ x: 12, y: 8 }, { x: 14, y: 80 }, { x: 22, y: 78 }], [{ x: 3, y: 36 }, { x: 36, y: 34 }]] }];
    p.glyphs.e = [{ source: 'pen', advance: 36, strokes: [[{ x: 4, y: 60 }, { x: 30, y: 50 }, { x: 18, y: 36 }, { x: 6, y: 60 }, { x: 30, y: 78 }]] }];
    const n = newNote(); n.settings = { ...n.settings, profileId: 'p' }; n.renderedText = 'te';
    const t = layout(n, [p]).glyphs.find(g => g.char === 't')!;
    expect(t.strokes).toHaveLength(2); void r;
  });
  it('keeps punctuation at the height it was written on the guide lines', async () => {
    const { normaliseOnLines } = await import('../src/model');
    const dot = normaliseOnLines([[{ x: 100, y: 183 }, { x: 103, y: 185 }]], 'pen', 185, 90);
    const comma = normaliseOnLines([[{ x: 100, y: 180 }, { x: 96, y: 205 }]], 'pen', 185, 90);
    const dash = normaliseOnLines([[{ x: 100, y: 140 }, { x: 140, y: 141 }]], 'pen', 185, 90);
    const ys = (g: { strokes: Stroke[] }) => g.strokes.flat().map(q => q.y);
    expect(Math.max(...ys(dot))).toBeCloseTo(80, 0); expect(Math.max(...ys(dot)) - Math.min(...ys(dot))).toBeLessThan(3);
    expect(Math.max(...ys(comma))).toBeGreaterThan(85);
    expect(Math.min(...ys(dash))).toBeGreaterThan(50); expect(Math.max(...ys(dash))).toBeLessThan(65);
    expect(dot.lined).toBe(true);
  });
  it('treats old, stretched punctuation as not yet written for stage 2', () => {
    const p = base(); p.glyphs['.'] = [{ source: 'pen', advance: 20, strokes: letter() }];
    expect(levels(p)[1].progress).toBe(0);
  });
});

describe('writing guide', () => {
  it('splits the guide into three equal zones and fits the model letters into them', async () => {
    const { guideY } = await import('../src/Guide');
    expect(guideY(4, 40, 60)).toBeCloseTo(40); expect(guideY(34, 40, 60)).toBeCloseTo(100);
    expect(guideY(80, 40, 60)).toBeCloseTo(160); expect(guideY(104, 40, 60)).toBeCloseTo(220);
  });
  it('maps punctuation written on equal thirds to letter height', async () => {
    const { normaliseOnLines } = await import('../src/model');
    const bang = normaliseOnLines([[{ x: 0, y: 40 }, { x: 0, y: 140 }], [{ x: 0, y: 158 }, { x: 1, y: 160 }]], 'pen', 160, 100);
    const ys = bang.strokes.flat().map(p => p.y);
    expect(Math.min(...ys)).toBeCloseTo(4, 0); expect(Math.max(...ys)).toBeCloseTo(80, 0);
  });
});
