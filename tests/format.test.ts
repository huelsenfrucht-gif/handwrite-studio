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
