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

describe('AI transcription with line marks', () => {
  it('restores every line and empty line, even when copying lost the line breaks', async () => {
    const { fromMarkedLines } = await import('../src/import/PhotoText');
    expect(fromMarkedLines('Ursachen¦ Der Staat war¦ verschuldet.¦ ¦ | Jahr | Ereignis |¦ | 1789 | Bastille |¦')).toBe('Ursachen\nDer Staat war\nverschuldet.\n\n| Jahr | Ereignis |\n| 1789 | Bastille |');
    expect(fromMarkedLines('Ursachen¦\nDer Staat¦\n¦\nFolgen¦')).toBe('Ursachen\nDer Staat\n\nFolgen');
  });
});

describe('document layout from Apple Vision', () => {
  it('keeps header fields on one row, lines exact, and puts tables in place', async () => {
    const { documentToText } = await import('../src/import/boardAnalysis');
    const line = (text: string, x: number, y: number, w = .3) => ({ text, x, y, width: w, height: .015 });
    const para = (lines: ReturnType<typeof line>[]) => ({ kind: 'text' as const, lines, x: Math.min(...lines.map(l => l.x)), y: lines[0].y, width: .5, height: lines.at(-1)!.y + .015 - lines[0].y });
    const text = documentToText([
      para([line('Die Revolution', .2, .05)]),
      para([line('Name:', .05, .1, .05)]), para([line('Datum:', .4, .1, .05)]), para([line('Klasse:', .7, .1, .05)]),
      para([line('Lückentext', .05, .15), line('Die Revolution begann', .05, .17), line('im Jahr 1789.', .05, .19)]),
      para([line('Kurze Fragen', .05, .5)]),
      { kind: 'table', rows: [['Ereignis', 'Jahr'], ['Bastille', '1789']], x: .05, y: .3, width: .9, height: .1 },
    ]);
    expect(text).toBe('Die Revolution\n\nName:   Datum:   Klasse:\n\nLückentext\nDie Revolution begann\nim Jahr 1789.\n\n| Ereignis | Jahr |\n| Bastille | 1789 |\n\nKurze Fragen');
    const gap = documentToText([para([line('Die Revolution begann im Jahr', .05, .2, .3)]), para([line('in', .5, .2, .02)])]);
    expect(gap).toBe('Die Revolution begann im Jahr   in');
  });
});
