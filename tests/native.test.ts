import { describe, expect, it } from 'vitest';
import { diagramOutside, linesToText } from '../src/import/boardAnalysis';

describe('Apple Vision results', () => {
  it('joins row segments and keeps paragraph breaks', () => {
    const text = linesToText([
      { text: 'Bundespräsident', x: 300, y: 100, width: 260, height: 30 },
      { text: 'Der', x: 100, y: 102, width: 60, height: 30 },
      { text: 'wird gewählt.', x: 100, y: 140, width: 220, height: 30 },
      { text: 'Neuer Absatz', x: 100, y: 260, width: 200, height: 30 },
    ]);
    expect(text).toBe('Der Bundespräsident\nwird gewählt.\n\nNeuer Absatz');
  });
  it('treats ink inside text boxes as letters and the rest as drawing', () => {
    const list = [{ id: 1, x: 105, y: 102, width: 20, height: 25, pixels: 120 }, { id: 2, x: 0, y: 300, width: 400, height: 4, pixels: 1600 }, { id: 3, x: 10, y: 10, width: 2, height: 2, pixels: 3 }];
    expect(diagramOutside(list, [{ x: 100, y: 100, width: 200, height: 30 }], 30)).toEqual([2]);
  });
});

describe('layout from photos', () => {
  it('turns aligned columns into a table and keeps indents', () => {
    const box = (text: string, x: number, y: number) => ({ text, x, y, width: text.length * 14, height: 30 });
    const text = linesToText([
      box('Merkmale', 100, 100),
      box('Laubbaum', 100, 160), box('Nadelbaum', 500, 160),
      box('Blätter', 100, 200), box('Nadeln', 500, 200),
      box('wirft ab', 100, 240), box('immergrün', 500, 240),
      box('Fazit', 100, 340), box('Unterpunkt', 220, 380),
    ]);
    expect(text).toBe('Merkmale\n| Laubbaum | Nadelbaum |\n| Blätter | Nadeln |\n| wirft ab | immergrün |\n\nFazit\n\tUnterpunkt');
  });
});
