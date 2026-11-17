import { describe, expect, it } from 'vitest';
import { newNote } from '../src/model';
import { cleanText, layout } from '../src/engine';

describe('pasted text keeps its formatting', () => {
  it('removes markdown characters but keeps lines, blank lines, lists and tables', () => {
    const text = '## Antwort\r\n\n**Bismarck** war *Kanzler*.\n- Punkt `eins`\n+ Punkt zwei\n> Zitat\n---\n| a | b |\n|---|---|\n| 1 | 2 |\nSiehe [Quelle](https://example.org). Ende​';
    expect(cleanText(text)).toBe('Antwort\n\nBismarck war Kanzler.\n- Punkt eins\n- Punkt zwei\nZitat\n\n| a | b |\n|---|---|\n| 1 | 2 |\nSiehe Quelle. Ende');
  });
  it('keeps multiplication signs, snake_case and lone asterisks', () => {
    expect(cleanText('3 * 4 = 12 und a_b_c, Stern*')).toBe('3 * 4 = 12 und a_b_c, Stern*');
  });
  it('writes wrapped lines of numbered and indented items under their text', () => {
    const n = newNote(); n.renderedText = '1. ' + 'Wort '.repeat(40) + '\n    eingerückt ' + 'Wort '.repeat(40);
    const g = layout(n, []).glyphs, firstWord = g.find(x => x.char === 'W')!;
    const rows = new Map<number, number>(); for (const x of g) if (x.char === 'W') rows.set(Math.round(x.y), Math.min(rows.get(Math.round(x.y)) ?? Infinity, x.x));
    const starts = [...rows.values()];
    expect(starts[1]).toBeCloseTo(firstWord.x, 0); // second line of item 1 starts under its text, not under "1."
    const e = g.find(x => x.char === 'e')!;
    expect(starts.at(-1)).toBeCloseTo(e.x, 0); // the indented paragraph stays indented when it wraps
    expect(g.some(x => x.char === '*' || x.char === '#')).toBe(false);
  });
});

describe('marking headings', () => {
  const text = '# Die Französische Revolution\n\nEinleitung\nIm Jahr 1789 begann eine Revolution.\n\nKurzer Satz am Ende.\n\n- Punkt eins\n\nUrsachen:\nDer Staat war verschuldet.\n\nLiebe Grüße';
  it('finds marked headings and short lines that start a block', async () => {
    const { headingLines } = await import('../src/engine');
    const lines = cleanText(text).split('\n'), found = [...headingLines(text)].map(i => lines[i]);
    expect(found).toEqual(['Die Französische Revolution', 'Einleitung', 'Ursachen:']);
  });
  it('draws one highlighter bar per heading line, only when switched on', () => {
    const n = newNote(); n.renderedText = text;
    expect(layout(n, []).highlights).toHaveLength(0);
    n.settings = { ...n.settings, highlightHeadings: true };
    const bars = layout(n, []).highlights;
    expect(bars).toHaveLength(3);
    for (const b of bars) { expect(b.height).toBeGreaterThan(8); expect(b.width).toBeGreaterThan(20); }
  });
});

describe('line starts', () => {
  it('stay on the margin by default and wander to the right when set', () => {
    const n = newNote(); n.renderedText = Array.from({ length: 12 }, (_, i) => `Zeile ${i}`).join('\n');
    const starts = (r: ReturnType<typeof layout>) => [...new Map(r.glyphs.filter(g => g.char === 'Z').map(g => [Math.round(g.y), g.x])).values()];
    const plain = starts(layout(n, []));
    expect(Math.max(...plain) - Math.min(...plain)).toBeLessThan(.5);
    n.settings = { ...n.settings, lineStartShift: 100 };
    const moved = starts(layout(n, []));
    expect(Math.max(...moved) - Math.min(...moved)).toBeGreaterThan(4);
    expect(Math.min(...moved)).toBeGreaterThanOrEqual(Math.min(...plain) - .5);
    expect(Math.max(...moved)).toBeLessThanOrEqual(Math.min(...plain) + 16.5);
  });
});
