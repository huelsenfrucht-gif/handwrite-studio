import { describe, expect, it } from 'vitest';
import { newNote } from '../src/model';
import { layout } from '../src/engine';
import { answerPrompt, distributeAnswers, findAnswerAreas } from '../src/worksheet';

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

describe('answers from the text field', () => {
  // Fields as found on a real worksheet (Reichsgründung 1871), in image pixels.
  const raw: [number, number, number, number, string?][] = [[556,916,240,64],[795,916,742,64],[556,980,240,63],[795,980,742,63],[556,1043,240,64],[795,1043,742,64],[556,1106,240,64],[795,1106,742,64],[556,1170,240,64],[795,1170,742,64],[179,133,423,65,'header'],[1220,133,289,65,'header'],[406,364,372,66],[760,433,380,54],[427,490,354,56],[1084,490,338,56],[135,549,338,56],[392,608,387,56],[134,1404,1383,58],[134,1515,1384,55]];
  const fields = raw.map(([x, y, width, height, role], i) => ({ id: `f${i}`, page: 0, x: x / 2, y: y / 2, width: width / 2, height: height / 2, text: '', kind: (i < 10 ? 'cell' : 'line') as 'cell' | 'line', ...(role ? { role: 'header' as const } : {}) }));
  const textAt = (r: ReturnType<typeof distributeAnswers>, x: number, y: number) => r.fields.find(f => f.x === x / 2 && f.y === y / 2)!.text;
  it('fills gaps, table and questions in reading order and leaves name and date empty', () => {
    const r = distributeAnswers(`Bismarck; Preußen; Österreich; Norddeutsche; 18. Januar 1871; Wilhelm

| Ereignis | Jahr | Ergebnis |
|---|---|---|
| Deutsch-Dänischer Krieg | 1864 | Dänemark verliert Schleswig und Holstein. |
| Deutscher Krieg | 1866 | Preußen besiegt Österreich; Deutscher Bund wird aufgelöst. |
| Norddeutscher Bund | 1867 | Zusammenschluss der norddeutschen Staaten. |
| Deutsch-Französischer Krieg | 1870/71 | Frankreich wird besiegt. |
| Reichsgründung | 1871 | Gründung des Deutschen Kaiserreichs. |

a) Einigung Deutschlands unter preußischer Führung.
b) Fehlende Einigkeit, Widerstand der Fürsten.`, fields);
    expect(textAt(r, 179, 133)).toBe(''); expect(textAt(r, 1220, 133)).toBe('');
    expect(textAt(r, 406, 364)).toBe('Bismarck');
    expect(textAt(r, 427, 490)).toBe('Österreich'); expect(textAt(r, 1084, 490)).toBe('Norddeutsche');
    expect(textAt(r, 392, 608)).toBe('Wilhelm');
    expect(textAt(r, 556, 916)).toBe('1864'); expect(textAt(r, 795, 980)).toBe('Preußen besiegt Österreich; Deutscher Bund wird aufgelöst.');
    expect(textAt(r, 556, 1170)).toBe('1871');
    expect(textAt(r, 134, 1404)).toBe('Einigung Deutschlands unter preußischer Führung.');
    expect(textAt(r, 134, 1515)).toBe('Fehlende Einigkeit, Widerstand der Fürsten.');
    expect(r.left).toBe(0); expect(r.filled).toBe(18);
  });
  it('takes one answer per line as well', () => {
    const r = distributeAnswers('Bismarck\nPreußen\nÖsterreich', fields);
    expect(textAt(r, 760, 433)).toBe('Preußen'); expect(textAt(r, 427, 490)).toBe('Österreich'); expect(textAt(r, 1084, 490)).toBe('');
  });
  it('writes a prompt that asks for exactly one line per field and describes the groups', () => {
    const prompt = answerPrompt(fields);
    expect(prompt).toContain('genau 18 Zeilen');
    expect(prompt).toContain('Zeile 1–6: 6 Lücken');
    expect(prompt).toContain('Zeile 7–16: die 10 leeren Zellen einer Tabelle (5 Zeilen mit je 2 leeren Spalten)');
    expect(prompt).toContain('Zeile 17–18: 2 Antwortlinien');
  });
  it('takes an AI reply line by line, also when it numbered the lines, and "-" leaves a field empty', () => {
    const reply = ['Bismarck', 'Preußen', 'Österreich', 'Norddeutsche', '18. Januar 1871', 'Wilhelm', '1864', 'Dänemark verliert Schleswig; Holstein; Lauenburg', '1866', '-', '1867', 'x', '1870/71', 'x', '1871', 'x', 'Einigung', 'Uneinigkeit'];
    const r = distributeAnswers(reply.map((l, k) => `${k + 1}. ${l}`).join('\n'), fields);
    expect(textAt(r, 760, 433)).toBe('Preußen'); expect(textAt(r, 135, 549)).toBe('18. Januar 1871');
    expect(textAt(r, 795, 916)).toBe('Dänemark verliert Schleswig; Holstein; Lauenburg');
    expect(textAt(r, 795, 980)).toBe('');
    expect(textAt(r, 134, 1515)).toBe('Uneinigkeit');
  });
});
