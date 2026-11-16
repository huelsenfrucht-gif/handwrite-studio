import { describe, expect, it } from 'vitest';
import { initialLibrary, newNote, type Library } from '../src/model';
import { mergeLibraries } from '../src/sync';
import { diagramOutside, linesToText } from '../src/import/boardAnalysis';

const lib = (): Library => { const l = initialLibrary(); l.notes[0].updated = '2026-11-10T10:00:00.000Z'; return l; };

describe('iCloud merge', () => {
  it('keeps the newer version of each document and adds documents from the other device', () => {
    const ipad = lib(), iphone = structuredClone(ipad);
    iphone.notes[0] = { ...iphone.notes[0], text: 'neuer Text vom iPhone', updated: '2026-11-11T10:00:00.000Z' };
    const extra = { ...newNote('Nur auf dem iPad'), updated: '2026-11-11T09:00:00.000Z' }; ipad.notes.push(extra);
    const merged = mergeLibraries(ipad, iphone);
    expect(merged.notes).toHaveLength(2);
    expect(merged.notes.find(n => n.id === ipad.notes[0].id)!.text).toBe('neuer Text vom iPhone');
    expect(mergeLibraries(iphone, ipad).notes).toHaveLength(2);
  });
  it('does not bring back deleted items, but keeps items changed after the deletion', () => {
    const a = lib(), gone = { ...newNote('Gelöscht'), updated: '2026-11-11T08:00:00.000Z' }, kept = { ...newNote('Später bearbeitet'), updated: '2026-11-12T08:00:00.000Z' };
    const b = structuredClone(a); b.notes.push(gone, kept);
    a.deleted = { [gone.id]: '2026-11-11T09:00:00.000Z', [kept.id]: '2026-11-11T09:00:00.000Z' };
    const merged = mergeLibraries(a, b, new Date('2026-11-16'));
    expect(merged.notes.some(n => n.id === gone.id)).toBe(false);
    expect(merged.notes.some(n => n.id === kept.id)).toBe(true);
    expect(merged.deleted![gone.id]).toBeDefined();
  });
  it('is idempotent and falls back to the demo handwriting when a profile was deleted elsewhere', () => {
    const a = lib(); a.profiles = [{ id: 'p1', name: 'Meine', created: '2026-11-01T00:00:00.000Z', glyphs: {} }]; a.notes[0].settings.profileId = 'p1';
    const b = structuredClone(a); b.profiles = []; b.deleted = { p1: '2026-11-12T00:00:00.000Z' };
    const once = mergeLibraries(a, b, new Date('2026-11-16')), twice = mergeLibraries(once, b, new Date('2026-11-16'));
    expect(once.profiles).toHaveLength(0); expect(once.notes[0].settings.profileId).toBe('demo');
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

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
