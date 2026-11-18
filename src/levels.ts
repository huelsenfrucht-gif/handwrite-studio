import { analyzeWord, pairRuns, sliceStrokes, type WordSample } from './contextual';
export { pairRuns, splitPair } from './contextual';
import { inkGapRuns } from './calibration';
import { hasOwnGlyph, simplify, type PairSample, type Profile, type Rhythm, type Stroke } from './model';

/**
 * Handschrift-Stufen. Jede Stufe nutzt einen Weg, der auch bei unsauberer Schrift
 * verlässlich bleibt: Buchstaben und Verbindungen werden einzeln in ein Feld
 * geschrieben (kein Zerschneiden ganzer Sätze); aus Sätzen werden nur Maße gelernt.
 *
 * 1 Grundschrift      a–z, A–Z einzeln                        frei
 * 2 Zahlen & Zeichen  0–9, Satzzeichen, Umlaute, ß            frei
 * 3 Schreibrhythmus   drei kurze Sätze → Wortabstand, Grundlinie, wie stark verbunden wird   frei
 * 4 Verbindungen      die 20 häufigsten Buchstabenpaare       einmal Video
 * 5 Feinschliff       weitere Paare + Großbuchstaben-Anfänge, immer die wichtigsten fehlenden
 */
export const BASIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SIGNS = '0123456789.,!?:-()äöüßÄÖÜ';
export const RHYTHM_SENTENCES = ['Clara schreibt heute einen Brief', 'Der kleine Hund spielt im Garten', 'Wir lernen zusammen für die Schule'] as const;
/** The 20 most frequent letter connections in German (word-internal). */
export const PAIRS_CORE = ['en', 'er', 'ch', 'sch', 'ei', 'ie', 'st', 'te', 'in', 'nd', 'ge', 'un', 'de', 'be', 'au', 'an', 'ng', 'll', 'ck', 'tz'];
/** Stufe 5: further connections and capital starts, picked by what still matters most. */
export const PAIRS_MORE = ['es', 'ne', 're', 'le', 'he', 'se', 'it', 'ri', 'li', 'ra', 'ar', 'al', 'or', 'el', 'ht', 'ss', 'mm', 'nn', 'tt', 'ff', 'ig', 'ir', 'ung', 'ich', 'ein',
  'Da', 'De', 'Di', 'Ge', 'Be', 'St', 'Sch', 'Wi', 'Ma', 'Ka', 'Ve', 'Er', 'Ei', 'In', 'Au', 'Zu', 'An', 'So', 'Fr', 'Pr', 'Ch', 'Cl', 'Ca', 'Kl', 'Gr', 'Br', 'Sp', 'Mo', 'Na', 'Le'];
export const PAIR_KEYS = [...PAIRS_CORE, ...PAIRS_MORE];
const PAIR_SET = new Set(PAIR_KEYS);

/** A typical German school/notes text: coverage is measured against it. */
const REFERENCE = `Die Zelle ist die kleinste Einheit des Lebens. Sie besteht aus einer Zellmembran, dem Zellplasma und dem Zellkern. Im Zellkern liegt die Erbinformation, die bei der Teilung an die neuen Zellen weitergegeben wird. Pflanzenzellen haben zusätzlich eine feste Zellwand und Chloroplasten, in denen die Fotosynthese stattfindet. Dabei entsteht aus Wasser und Kohlenstoffdioxid mit Hilfe von Licht Traubenzucker und Sauerstoff. Am Montag schreiben wir die Klassenarbeit in Deutsch. Bitte lest bis dahin das zweite Kapitel und beantwortet die Fragen zum Text. Wer Schwierigkeiten hat, kann sich in der Pause bei mir melden. Gestern waren wir mit der ganzen Klasse im Museum und haben uns die Ausstellung über die Geschichte der Stadt angesehen. Besonders spannend fanden viele die alten Karten und Bilder aus dem Mittelalter. Mathematik: Berechne den Flächeninhalt eines Rechtecks mit den Seitenlängen acht und zwölf Zentimeter. Erkläre deinen Rechenweg in ganzen Sätzen.`;

export type LevelId = 1 | 2 | 3 | 4 | 5;
export type LevelInfo = { id: LevelId; title: string; what: string; effort: string; done: boolean; progress: number; total: number; locked: boolean };

const pen = hasOwnGlyph;
const referenceWords = REFERENCE.match(/[\p{L}]+/gu) || [];
/** Share (0–1) of letter-to-letter transitions in a typical text that are written as a real connection. */
export function pairCoverage(p: Profile) {
  let total = 0, covered = 0;
  for (const w of referenceWords) { const n = Array.from(w).length; if (n < 2) continue; total += n - 1; for (const r of pairRuns(w, k => !!p.pairs?.[k]?.length)) covered += r.len - 1; }
  return total ? covered / total : 0;
}
/** How often a pair occurs in the reference text (to pick the most useful next ones). */
const pairWeight = (key: string) => { let n = 0; for (const w of referenceWords) { let i = w.indexOf(key); while (i >= 0) { n++; i = w.indexOf(key, i + 1); } } return n; };
/** Stufe 5: the most useful pairs that are still missing. */
export function nextPairs(p: Profile, count = 10) {
  return PAIRS_MORE.filter(k => !p.pairs?.[k]?.length).map((k, i) => ({ k, w: pairWeight(k) + (/[A-Z]/.test(k[0]) ? 3 : 0) - i * .01 })).sort((a, b) => b.w - a.w).slice(0, count).map(x => x.k);
}

export function levels(p: Profile): LevelInfo[] {
  const l1 = Array.from(BASIC).filter(c => pen(p, c)).length, l2 = Array.from(SIGNS).filter(c => pen(p, c)).length;
  const l4 = PAIRS_CORE.filter(k => p.pairs?.[k]?.length).length, l5 = PAIRS_MORE.filter(k => p.pairs?.[k]?.length).length;
  const base = l1 === BASIC.length, locked = !p.unlocked;
  return [
    { id: 1, title: 'Grundschrift', what: 'Jeden Klein- und Großbuchstaben einmal einzeln schreiben.', effort: '52 Buchstaben · ca. 5 Min.', done: base, progress: l1, total: BASIC.length, locked: false },
    { id: 2, title: 'Zahlen & Zeichen', what: 'Ziffern, Satzzeichen, Umlaute und ß in deiner Schrift statt der Ersatzschrift.', effort: `${SIGNS.length} Zeichen · ca. 2 Min.`, done: l2 === SIGNS.length, progress: l2, total: SIGNS.length, locked: false },
    { id: 3, title: 'Schreibrhythmus', what: 'Drei kurze Sätze. Die App lernt daraus deinen Wortabstand, wie gerade du auf der Linie schreibst und ob du Buchstaben verbindest.', effort: '3 Sätze · ca. 1 Min.', done: (p.rhythm?.samples || 0) > 0, progress: p.rhythm?.samples ? 3 : 0, total: 3, locked: false },
    { id: 4, title: 'Verbindungen', what: 'Die 20 häufigsten Buchstabenpaare wie „ch“, „ei“ oder „st“ – so wie du sie zusammenhängend schreibst.', effort: '20 Paare · ca. 3 Min.', done: l4 === PAIRS_CORE.length, progress: l4, total: PAIRS_CORE.length, locked },
    { id: 5, title: 'Feinschliff', what: 'Weitere Verbindungen und Wortanfänge wie „Cl“, „Sch“ oder „St“. Die App wählt immer die wichtigsten fehlenden.', effort: 'je 10 Paare · beliebig oft', done: l5 === PAIRS_MORE.length, progress: l5, total: PAIRS_MORE.length, locked },
  ];
}
/** The highest level reached in a row (0 = not even the basic alphabet). */
export function currentLevel(p: Profile) { let n = 0; for (const l of levels(p)) { if (!l.done) break; n = l.id; } return n; }

/** Like a single letter, but the frame comes from all letters of the pair (ascender/descender). */
export function normalisePair(strokes: Stroke[], text: string): PairSample {
  const pts = strokes.flat(); if (pts.length < 3) throw new Error('Bitte zuerst die Buchstaben schreiben.');
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const tall = /[A-ZÄÖÜbdfhklt]/.test(text), desc = /[gjpqy]/.test(text), top = tall ? 4 : 34, bottom = desc ? 100 : 80, scale = (bottom - top) / Math.max(1, maxY - minY);
  const local = strokes.map(s => simplify(s.map(p => ({ x: (p.x - minX) * scale + 3, y: (p.y - minY) * scale + top, p: p.p }))));
  const width = Math.min(600, (maxX - minX) * scale + 13);
  if (width > 590) throw new Error('Bitte die Buchstaben etwas enger schreiben.');
  const cuts = pairCuts(local, Array.from(text).length, width);
  return { strokes: local, cuts, width };
}
/**
 * Where to split 2–3 letters written together. Connected writing has exactly one line
 * (the joining stroke) between two letters, inside a letter there are at least two;
 * a gap has none. So the split goes to the column crossed by the fewest strokes, only
 * mildly pulled towards an even split, and every letter keeps some ink.
 */
export function pairCuts(strokes: Stroke[], n: number, width: number): number[] {
  if (n < 2) return [0, width];
  const pts = strokes.flat(), x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), span = Math.max(1, x1 - x0);
  const cols = 240, at = (c: number) => x0 + span * c / cols;
  const cross = new Float64Array(cols + 1), inkY = new Float64Array(cols + 1);
  for (let c = 0; c <= cols; c++) {
    const x = at(c); let k = 0, y = 0;
    for (const s of strokes) for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i]; if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) { k++; y += Math.abs(b.y - a.y); } }
    cross[c] = k; inkY[c] = y;
  }
  // Mean crossings in a small window, so single sample columns don't dominate.
  const cost = (c: number) => { let v = 0, m = 0; for (let d = -2; d <= 2; d++) { const j = c + d; if (j < 0 || j > cols) continue; v += cross[j] + inkY[j] * .02; m++; } return v / m; };
  const minPart = Math.round(cols * .12), best = { v: Infinity, cuts: [] as number[] };
  const search = (from: number, left: number, chosen: number[]) => {
    if (!left) { const v = chosen.reduce((sum, c, i) => sum + cost(c) + 1.2 * ((c / cols - (i + 1) / n)) ** 2, 0); if (v < best.v) { best.v = v; best.cuts = [...chosen]; } return; }
    for (let c = from + minPart; c <= cols - minPart * left; c++) search(c, left - 1, [...chosen, c]);
  };
  search(0, n - 1, []);
  return [0, ...best.cuts.map(c => at(c)), width];
}
export const isPairKey = (k: string) => PAIR_SET.has(k);

/**
 * Stufe 3: reads three handwritten sentences. Only robust measurements are taken:
 * the gap between words, the joining tendency and the words themselves (baseline wobble).
 */
export function measureRhythm(lines: Stroke[][], sentences: readonly string[] = RHYTHM_SENTENCES): { rhythm: Rhythm; words: WordSample[] } {
  const gaps: number[] = [], joins: number[] = [], words: WordSample[] = [];
  lines.forEach((strokes, li) => {
    const text = sentences[li], parts = text.split(' ');
    const runs = inkGapRuns(strokes, parts.length - 1), pts = strokes.flat();
    const bounds = [Math.min(...pts.map(p => p.x)) - 2, ...runs.map(r => (r.from + r.to) / 2), Math.max(...pts.map(p => p.x)) + 2];
    const scales: number[] = [];
    parts.forEach((w, i) => {
      try {
        const slice = sliceStrokes(strokes, bounds[i], bounds[i + 1]).filter(s => s.length);
        const xs = slice.flat().map(p => p.x); if (xs.length < 5) return;
        const sample = analyzeWord(slice, w, 'pen', `rhythm-${li}-${i}`), raw = Math.max(...xs) - Math.min(...xs);
        if (raw > 0) scales.push(sample.width / raw);
        if (w.length > 2) joins.push(sample.metrics.joining);
        words.push(sample);
      } catch { /* a single unclear word does not spoil the rest */ }
    });
    const scale = median(scales); if (!scale) return;
    // analyzeWord normalises the x-height to 52, letters use 46 → convert to glyph units.
    for (const r of runs) gaps.push((r.to - r.from) * scale * 46 / 52);
  });
  if (!gaps.length || words.length < 4) throw new Error('Die Sätze waren nicht deutlich genug. Bitte zwischen den Wörtern etwas Platz lassen und noch einmal schreiben.');
  return { rhythm: { wordGap: Math.round(median(gaps) * 10) / 10, joining: Math.round(median(joins) * 100) / 100, samples: lines.length }, words };
}
function median(v: number[]) { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }

/**
 * Word spacing for a profile with learnt rhythm: the setting stays the user's control,
 * the measured gap only shifts its centre (52 px = the person's own gap).
 * Letters carry ~13 units of side bearing, which is part of the visible gap.
 */
export function wordGapFactor(p?: Profile) {
  const g = p?.rhythm?.wordGap; if (!g) return 1;
  // Moves 60 % of the way towards the measured gap: noticeable, but never a sudden jump.
  const own = (g - 13) / 52;
  return Math.max(.75, Math.min(1.4, 1 + (own - 1) * .6));
}
