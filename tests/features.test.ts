import { describe, expect, it } from 'vitest';
import { initialLibrary, MM, newNote, PAGE } from '../src/model';
import { layout } from '../src/engine';
import { validateLibrary } from '../src/storage';
import { analyseBoard, binarize, components, inkImage, joinLines } from '../src/import/boardAnalysis';

describe('bullet points', () => {
  it('writes "* " and "- " at a line start as a handwritten dot with a hanging indent', () => {
    const n = newNote(); n.settings.size = 40;
    n.renderedText = '* Staatsoberhaupt Deutschlands mit vielen weiteren Worten die sicher umbrechen müssen\n- zweiter Punkt\nkein * Stern mitten im Satz';
    const r = layout(n, []), chars = r.glyphs.map(g => g.char).join('');
    expect(chars.startsWith('•Staatsoberhaupt')).toBe(true);
    expect(chars).toContain('•zweiter');
    expect(chars).toContain('kein*Stern');
    const first = r.glyphs.find(g => g.char === 'S')!, lines = [...new Set(r.glyphs.map(g => Math.round(g.y)))];
    expect(lines.length).toBeGreaterThan(3);
    const wrapped = r.glyphs.find(g => Math.round(g.y) === lines[1])!;
    expect(Math.abs(wrapped.x - first.x)).toBeLessThan(1);
    expect(r.missing).toEqual([]);
  });
});

describe('text margins and blank lines', () => {
  it('honours left and right margins in millimetres', () => {
    const n = newNote(); n.settings.marginLeft = 30; n.settings.marginRight = 30;
    n.renderedText = 'Wort '.repeat(300);
    const r = layout(n, []);
    expect(Math.min(...r.glyphs.map(g => g.x))).toBeCloseTo(30 * MM, 1);
    expect(Math.max(...r.glyphs.map(g => g.x + g.width))).toBeLessThanOrEqual(PAGE.width - 30 * MM + .01);
  });
  it('keeps blank lines at the top, on the first page and at the bottom', () => {
    const base = newNote(); base.renderedText = 'Zeile\n'.repeat(80);
    const plain = layout(base, []), tops = (r: typeof plain, p: number) => Math.min(...r.glyphs.filter(g => g.page === p).map(g => g.y));
    const spaced = { ...base, settings: { ...base.settings, linesTop: 2, linesFirstPage: 3, linesBottom: 1 } }, r = layout(spaced, []);
    const lh = base.settings.lineHeight;
    expect(tops(r, 1) - tops(plain, 1)).toBeCloseTo(2 * lh, 3);
    expect(tops(r, 0) - tops(plain, 0)).toBeCloseTo(5 * lh, 3);
    const perPage = (x: typeof plain) => x.glyphs.filter(g => g.page === 1).length;
    expect(perPage(r)).toBe(perPage(plain) - 3 * 5);
  });
  it('adds letter spacing', () => {
    const n = newNote(); n.renderedText = 'Hallo';
    const a = layout(n, []).glyphs, b = layout({ ...n, settings: { ...n.settings, letterSpacing: 30 } }, []).glyphs;
    expect(b.at(-1)!.x - b[0].x).toBeGreaterThan((a.at(-1)!.x - a[0].x) * 1.2);
  });
});

describe('folders and favourites', () => {
  it('stores folders, favourites and new settings', () => {
    const l = initialLibrary(); l.folders = [{ id: 'f1', name: 'Q-Phase', color: '#9b2c2c', created: 'x', updated: 'x', favorite: true }, { id: 'f2', name: 'PoWi', color: '#5aa9f8', parentId: 'f1', created: 'x', updated: 'x' }];
    l.notes[0].folderId = 'f2'; l.notes[0].favorite = true; Object.assign(l.notes[0].settings, { marginLeft: 7.1, marginRight: 7.1, linesTop: 1, linesFirstPage: 2, linesBottom: 0, letterSpacing: 5 });
    const v = validateLibrary(structuredClone(l));
    expect(v.folders).toHaveLength(2); expect(v.notes[0].folderId).toBe('f2'); expect(v.notes[0].settings.marginLeft).toBe(7.1);
  });
  it('moves documents of a missing folder back to the top level', () => {
    const l = initialLibrary(); l.folders = []; l.notes[0].folderId = 'gone';
    expect(validateLibrary(l).notes[0].folderId).toBeUndefined();
  });
});

describe('board photo analysis', () => {
  // A synthetic "blackboard": dark board, two chalk words and a long connecting line.
  const width = 400, height = 200, rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { rgba[i * 4] = 30; rgba[i * 4 + 1] = 60; rgba[i * 4 + 2] = 45; rgba[i * 4 + 3] = 255; }
  const paint = (x0: number, y0: number, w: number, h: number) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const j = (y * width + x) * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = 240; } };
  // letters: 3 blocks 12×20 with small gaps, twice
  for (const start of [20, 300]) for (let k = 0; k < 3; k++) { paint(start + k * 16, 40, 3, 20); paint(start + k * 16, 40, 12, 3); paint(start + k * 16 + 9, 40, 3, 20); }
  paint(80, 150, 220, 3); // the mind-map line
  it('inverts a board, keeps words as labels and the line as drawing', () => {
    const { gray, board } = inkImage(rgba, width, height); expect(board).toBe(true);
    const ink = binarize(gray, width, height), { list } = components(ink, width, height), result = analyseBoard(list);
    expect(result.labels).toHaveLength(2);
    expect(result.labels[0].x).toBeLessThan(30);
    const line = list.find(c => c.width > 200)!; expect(result.diagram).toContain(line.id);
  });
  it('joins recognised lines with paragraph breaks', () => {
    expect(joinLines([{ y: 0, height: 20, text: 'Erste  Zeile' }, { y: 25, height: 20, text: 'zweite' }, { y: 90, height: 20, text: 'Absatz' }])).toBe('Erste Zeile\nzweite\n\nAbsatz');
  });
});
