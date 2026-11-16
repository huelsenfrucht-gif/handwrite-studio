import { PAGE, uid, type Field } from './model';

/**
 * Finds the places on a worksheet where an answer belongs:
 * - empty cells of tables and empty boxes (two horizontal + two vertical rules),
 * - answer lines ("Name: ________"), several equal lines below each other as one field.
 * Works on the grey values of the scanned page; coordinates are returned in page units.
 */
export type Rect = { x: number; y: number; width: number; height: number; rows?: number; header?: boolean; kind?: 'cell' | 'line' };
type HLine = { y1: number; y2: number; x1: number; x2: number };
type VLine = { x1: number; x2: number; y1: number; y2: number };

const DARK = 150;

function runs(length: number, dark: (i: number) => boolean, min: number, gap: number) {
  const out: [number, number][] = []; let start = -1, last = -2;
  for (let i = 0; i < length; i++) {
    if (!dark(i)) continue;
    if (start < 0) start = i; else if (i - last > gap + 1) { if (last - start + 1 >= min) out.push([start, last]); start = i; }
    last = i;
  }
  if (start >= 0 && last - start + 1 >= min) out.push([start, last]);
  return out;
}

/** Long thin horizontal and vertical rules. */
export function findRules(gray: Uint8Array | Uint8ClampedArray, w: number, h: number) {
  const minH = Math.round(w * .05), minV = Math.round(h * .011), thick = Math.max(6, Math.round(w * .005));
  const hs: HLine[] = [];
  for (let y = 0; y < h; y++) for (const [x1, x2] of runs(w, x => gray[y * w + x] < DARK, minH, 2)) {
    const open = hs.find(l => y - l.y2 <= 2 && Math.min(x2, l.x2) - Math.max(x1, l.x1) > .8 * Math.max(x2 - x1, l.x2 - l.x1));
    if (open) { open.y2 = y; open.x1 = Math.min(open.x1, x1); open.x2 = Math.max(open.x2, x2); } else hs.push({ y1: y, y2: y, x1, x2 });
  }
  const vs: VLine[] = [];
  for (let x = 0; x < w; x++) for (const [y1, y2] of runs(h, y => gray[y * w + x] < DARK, minV, 2)) {
    const open = vs.find(l => x - l.x2 <= 2 && Math.min(y2, l.y2) - Math.max(y1, l.y1) > .8 * Math.max(y2 - y1, l.y2 - l.y1));
    if (open) { open.x2 = x; open.y1 = Math.min(open.y1, y1); open.y2 = Math.max(open.y2, y2); } else vs.push({ x1: x, x2: x, y1, y2 });
  }
  // A slightly tilted scan breaks one long rule into pieces on neighbouring pixel rows: join them again.
  const joined: HLine[] = [];
  for (const l of hs.filter(l => l.y2 - l.y1 < thick).sort((a, b) => a.x1 - b.x1)) {
    const near = joined.find(j => Math.abs((j.y1 + j.y2) / 2 - (l.y1 + l.y2) / 2) <= 4 && l.x1 <= j.x2 + 4);
    if (near) { near.x2 = Math.max(near.x2, l.x2); near.y1 = Math.min(near.y1, l.y1); near.y2 = Math.max(near.y2, l.y2); } else joined.push({ ...l });
  }
  return { hs: joined, vs: vs.filter(l => l.x2 - l.x1 < thick) };
}

const inkShare = (gray: Uint8Array | Uint8ClampedArray, w: number, x1: number, y1: number, x2: number, y2: number) => {
  let n = 0, all = 0;
  for (let y = Math.max(0, Math.round(y1)); y < Math.round(y2); y++) for (let x = Math.max(0, Math.round(x1)); x < Math.min(w, Math.round(x2)); x++) { all++; if (gray[y * w + x] < DARK) n++; }
  return all ? n / all : 1;
};

/** Answer areas in image pixels. */
export function findAnswerAreas(gray: Uint8Array | Uint8ClampedArray, w: number, h: number): Rect[] {
  const { hs, vs } = findRules(gray, w, h), tol = Math.max(5, w * .006), cells: Rect[] = [], borders = new Set<HLine>();
  const sorted = [...hs].sort((a, b) => a.y1 - b.y1);
  // Cells: between a rule and the next rule below it that shares an x-range, split by verticals spanning both.
  for (const a of sorted) {
    for (const b of sorted) {
      if (b.y1 <= a.y2 + h * .012) continue;
      const ox1 = Math.max(a.x1, b.x1), ox2 = Math.min(a.x2, b.x2);
      if (ox2 - ox1 < w * .04) continue;
      const between = sorted.some(c => c !== a && c !== b && c.y1 > a.y2 && c.y2 < b.y1 && Math.min(c.x2, ox2) - Math.max(c.x1, ox1) > (ox2 - ox1) * .5);
      if (between) continue;
      const xs = vs.filter(v => v.y1 <= a.y2 + tol && v.y2 >= b.y1 - tol && v.x2 >= ox1 - tol && v.x1 <= ox2 + tol).map(v => (v.x1 + v.x2) / 2).sort((p, q) => p - q);
      if (xs.length < 2) continue;
      borders.add(a); borders.add(b);
      for (let i = 0; i < xs.length - 1; i++) {
        const cell = { x: xs[i], y: (a.y1 + a.y2) / 2, width: xs[i + 1] - xs[i], height: (b.y1 + b.y2) / 2 - (a.y1 + a.y2) / 2 };
        // Small squares are tick boxes (multiple choice), not places to write.
        if (cell.width < w * .045 || cell.height < h * .012 || cell.width * cell.height > w * h * .45) continue;
        const m = Math.max(4, w * .004);
        if (inkShare(gray, w, cell.x + m, cell.y + m, cell.x + cell.width - m, cell.y + cell.height - m) < .003) cells.push({ ...cell, kind: 'cell' });
      }
      break;
    }
  }
  // Answer lines: rules that are not borders of a box; the free space above is the writing area.
  // Pieces of box or table borders (broken by rounded corners or anti-aliasing) are skipped,
  // as are the top/bottom edges of frames (a vertical side starts or ends at one of their ends).
  const borderList = [...borders], onBorder = (l: HLine) => borderList.some(b => Math.abs((b.y1 + b.y2) / 2 - (l.y1 + l.y2) / 2) < tol && l.x2 >= b.x1 - tol * 4 && l.x1 <= b.x2 + tol * 4);
  const reach = h * .02, near = (v: VLine, x: number) => Math.abs((v.x1 + v.x2) / 2 - x) < tol * 1.2 && v.y2 - v.y1 > h * .02;
  const startsAt = (l: HLine, x: number) => vs.some(v => near(v, x) && v.y1 >= l.y1 - tol && v.y1 <= l.y2 + reach), endsAt = (l: HLine, x: number) => vs.some(v => near(v, x) && v.y2 <= l.y2 + tol && v.y2 >= l.y1 - reach);
  const frameEdge = (l: HLine) => (startsAt(l, l.x1) && startsAt(l, l.x2)) || (endsAt(l, l.x1) && endsAt(l, l.x2));
  // Answer lines are printed black; frames, separators and shaded bands are grey.
  const darkness = (l: HLine) => { let t = 0, n = 0; for (let x = l.x1; x <= l.x2; x += 2) { let m = 255; for (let y = Math.max(0, l.y1 - 1); y <= Math.min(h - 1, l.y2 + 1); y++) m = Math.min(m, gray[y * w + x]); t += m; n++; } return t / n; };
  // A long rule broken by small circles or marks (a time line, a separator) is no answer line.
  const broken = (l: HLine) => hs.some(o => o !== l && Math.abs((o.y1 + o.y2) / 2 - (l.y1 + l.y2) / 2) <= 6 && ((o.x1 >= l.x2 && o.x1 - l.x2 <= w * .015) || (o.x2 <= l.x1 && l.x1 - o.x2 <= w * .015)));
  const atEdge = (l: HLine) => l.x1 < w * .01 || l.x2 > w * .99 || l.y1 > h * .985;
  // A short line is a gap in a sentence: there is printed text right next to it on the same line.
  const besideText = (l: HLine) => { const top = l.y1 - h * .018, bottom = l.y1 - 2; return inkShare(gray, w, l.x2 + 4, top, Math.min(w, l.x2 + w * .15), bottom) > .01 || inkShare(gray, w, Math.max(0, l.x1 - w * .15), top, l.x1 - 4, bottom) > .01; };
  const lines: (Rect & { stop: number; line: HLine })[] = [];
  for (const l of sorted) {
    if (borders.has(l) || onBorder(l) || atEdge(l) || frameEdge(l) || broken(l) || darkness(l) > 100 || (l.x2 - l.x1 < w * .2 && !besideText(l))) continue;
    const max = Math.round(h * .03), x1 = l.x1 + 2, x2 = l.x2 - 2; let free = 0, y = l.y1 - 3;
    for (; y > l.y1 - max && y > 0; y--) { if (inkShare(gray, w, x1, y, x2, y + 1) > .01) break; free++; }
    if (free >= h * .009) lines.push({ x: l.x1, y: l.y1 - free - 2, width: l.x2 - l.x1, height: free + 2, stop: y, line: l });
  }
  // Wide lines right below each other (nothing printed in between) form one writing area with several rows.
  // Short gaps in a text are never joined, even when two of them stand exactly below each other.
  const merged: (Rect & { lastLine: HLine })[] = [];
  for (const r of lines) {
    const wide = r.width > w * .28;
    const area = wide ? merged.find(m => m.kind === 'line' && Math.abs(m.x - r.x) < tol * 3 && Math.abs(m.width - r.width) < tol * 6 && r.stop <= m.lastLine.y2 + 4 && r.stop >= m.lastLine.y1 - 4) : undefined;
    if (area) { area.rows = (area.rows || 1) + 1; area.height = r.y + r.height - area.y; area.lastLine = r.line; }
    else merged.push({ x: r.x, y: r.y, width: r.width, height: r.height, kind: 'line', lastLine: r.line });
  }
  // Name, date and class at the top of the sheet are not answers.
  for (const r of merged) if (!r.rows && r.y + r.height < h * .15) r.header = true;
  return [...cells, ...merged.filter(r => !r.header).map(({ lastLine: _, ...r }) => r)];
}

/** Loads a template page and returns the answer fields in page units. */
export async function detectFields(image: string, page: number): Promise<Field[]> {
  const img = new Image(); img.src = image; await img.decode();
  const w = Math.min(1588, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth), canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  const k = PAGE.width / w;
  return findAnswerAreas(gray, w, h).map(r => ({ id: uid(), page, x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k, text: '', ...(r.rows && r.rows > 1 ? { rows: r.rows } : {}), ...(r.header ? { role: 'header' as const } : {}), ...(r.kind ? { kind: r.kind } : {}) }));
}

const TABLE = /^\s*\|.*\|\s*$/, RULE = /^[\s|:\-]+$/;
/** Ends every answer in the AI reply. Copy buttons of AI chats often drop line breaks; this sign survives. */
export const ANSWER_END = '¦';
const ANSWER_SPLIT = /[¦￤]/;

/** Answer fields in reading order: page, then row by row (fields on one line from left to right). */
export function readingOrder(fields: Field[]) {
  const sorted = [...fields].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), rows: Field[][] = [];
  for (const f of sorted) { const row = rows.at(-1); if (row && row[0].page === f.page && Math.abs(row[0].y + row[0].height / 2 - (f.y + f.height / 2)) < Math.min(row[0].height, f.height) * .5) row.push(f); else rows.push([f]); }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

/**
 * Puts the text typed into the big text field into the worksheet's answer fields, in reading order:
 * one line (or one item of a "a; b; c" list) per field, a table row "| … | … |" fills one row of cells.
 * Name/date fields are skipped. Returns the updated fields and how many answers had no field left.
 */
export function distributeAnswers(text: string, fields: Field[]) {
  const rows = readingOrder(fields.filter(f => f.role !== 'header')), slots = rows.flat(), out = new Map<string, string>();
  const rowOf = new Map(rows.flatMap((r, i) => r.map(f => [f.id, i] as const)));
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0, left = 0;
  const put = (value: string) => { if (i < slots.length) out.set(slots[i++].id, value); else left++; };
  const empty = (line: string) => /^[-–—]$/.test(line);
  // Exactly one line per field (the format the AI prompt asks for): taken over 1:1, "-" leaves a field empty.
  // A numbering "1. … 2. …" that an AI adds anyway is removed.
  // Reply in the prompt format "Antwort ¦ Antwort ¦ …": split at the sign, however the text was copied.
  if (ANSWER_SPLIT.test(text)) {
    const pieces = text.split(ANSWER_SPLIT).map(p => p.replace(/\s+/g, ' ').trim());
    if (!pieces.at(-1)) pieces.pop();
    const numbered = pieces.length > 1 && pieces.every((p, k) => new RegExp(`^${k + 1}[.):]\\s`).test(p));
    pieces.forEach(p => { const v = numbered ? p.replace(/^\d+[.):]\s*/, '') : p; put(!v || empty(v) ? '' : v); });
    return { fields: fields.map(f => f.role === 'header' ? f : { ...f, text: out.get(f.id) ?? '' }), filled: [...out.values()].filter(Boolean).length, left };
  }
  const given = lines.map(l => l.trim()).filter(Boolean);
  if (given.length === slots.length && !given.some(l => TABLE.test(l))) {
    const numbered = given.every((l, k) => new RegExp(`^${k + 1}[.):]\\s`).test(l));
    given.forEach(l => { const v = numbered ? l.replace(/^\d+[.):]\s*/, '') : l; put(empty(v) ? '' : v); });
    return { fields: fields.map(f => f.role === 'header' ? f : { ...f, text: out.get(f.id) ?? '' }), filled: [...out.values()].filter(Boolean).length, left };
  }
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim();
    if (empty(line)) { put(''); continue; }
    if (!line || RULE.test(line) && line.includes('-')) continue;
    if (TABLE.test(line)) {
      if (RULE.test(lines[n + 1] || '') && (lines[n + 1] || '').includes('-')) continue; // header row of a table
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (i >= slots.length) { left++; continue; }
      const row = rows[rowOf.get(slots[i].id)!], free = row.length - row.indexOf(slots[i]);
      // A pasted table often repeats the printed first column: keep only as many cells as there are fields.
      const values = cells.length > free ? cells.slice(cells.length - free) : cells;
      for (let k = 0; k < free; k++) put(values[k] || '');
      continue;
    }
    // Headings like "Lückentext:" separate parts of the answer text but are no answers themselves.
    if (/:\s*$/.test(line) && line.length <= 40) continue;
    const clean = line.replace(/^(?:[-•*·]|[①-⑳]|\(?[a-zA-Z]\)|\d+\))\s*/, '').trim();
    const parts = clean.split(';').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3 && parts.every(p => p.length <= 40)) parts.forEach(put); else if (clean) put(clean);
  }
  return { fields: fields.map(f => f.role === "header" ? f : { ...f, text: out.get(f.id) ?? "" }), filled: [...out.values()].filter(Boolean).length, left };
}

/** What kind of answer a field expects, for the AI prompt. */
function fieldType(f: Field): 'cell' | 'gap' | 'line' | 'area' | 'box' {
  if (f.kind === 'cell') return 'cell';
  if (f.rows && f.rows > 1) return 'area';
  if (f.kind === 'line') return f.width > PAGE.width * .55 ? 'line' : 'gap';
  return 'box';
}

/**
 * A prompt for an AI chat that matches this worksheet: it tells the AI how many fields there are,
 * in which order and what kind of answer each group expects, and asks for exactly one line per field,
 * so the reply can be pasted and lands in the right fields.
 */
export function answerPrompt(fields: Field[]) {
  const rows = readingOrder(fields.filter(f => f.role !== 'header')), slots = rows.flat();
  const rowIndex = new Map(rows.flatMap((r, i) => r.map(f => [f.id, i] as const)));
  const groups: { type: ReturnType<typeof fieldType>; page: number; from: number; to: number; ids: string[] }[] = [];
  slots.forEach((f, i) => { const t = fieldType(f), g = groups.at(-1); if (g && g.type === t && g.page === f.page) { g.to = i; g.ids.push(f.id); } else groups.push({ type: t, page: f.page, from: i, to: i, ids: [f.id] }); });
  const pages = [...new Set(slots.map(f => f.page))].sort((a, b) => a - b), multi = pages.length > 1;
  const range = (g: typeof groups[number]) => g.from === g.to ? `Zeile ${g.from + 1}` : `Zeile ${g.from + 1}–${g.to + 1}`;
  const describe = (g: typeof groups[number]) => {
    const n = g.to - g.from + 1;
    if (g.type === 'cell') {
      const tableRows = new Set(g.ids.map(id => rowIndex.get(id))).size, cols = Math.max(...[...new Set(g.ids.map(id => rowIndex.get(id)))].map(r => g.ids.filter(id => rowIndex.get(id) === r).length));
      return `${range(g)}: die ${n} leeren Zellen einer Tabelle (${tableRows} Zeile${tableRows === 1 ? '' : 'n'} mit je ${cols} leeren Spalte${cols === 1 ? '' : 'n'}), Zeile für Zeile von links nach rechts. Vorgedruckte Zellen und die Kopfzeile auslassen. Knapp, höchstens ein kurzer Satz.`;
    }
    if (g.type === 'gap') return `${range(g)}: ${n === 1 ? 'eine Lücke' : `${n} Lücken`} im Text – jeweils nur das fehlende Wort oder die kurze Angabe, ohne den umgebenden Satz.`;
    if (g.type === 'line') return `${range(g)}: ${n === 1 ? 'eine Antwortlinie' : `${n} Antwortlinien`} unter einer Frage oder Aufgabe – jeweils eine kurze, vollständige Antwort in einem Satz.`;
    if (g.type === 'area') return `${range(g)}: ${n === 1 ? 'ein Antwortbereich' : `${n} Antwortbereiche`} mit mehreren Linien – jeweils eine ausführlichere Antwort in einer einzigen Zeile.`;
    return `${range(g)}: ${n === 1 ? 'ein markiertes Feld' : `${n} markierte Felder`} – jeweils die passende Antwort.`;
  };
  const order = multi
    ? pages.flatMap((p, k) => [`Seite ${k + 1}:`, ...groups.filter(g => g.page === p).map(g => `  ${describe(g)}`)])
    : groups.map(describe);
  return [
    multi ? `Fülle die ${pages.length} angehängten Arbeitsblatt-Seiten aus. Sie gehören zusammen und sind in der richtigen Reihenfolge angehängt (zuerst Seite 1, dann Seite 2 …).` : 'Fülle das angehängte Arbeitsblatt aus.',
    '',
    `Antworte ausschließlich mit genau ${slots.length} Antworten – eine pro Antwortfeld, in genau dieser Reihenfolge. Setze direkt nach jeder Antwort das Zeichen ${ANSWER_END} (auch nach der letzten) und schreibe jede Antwort in eine eigene Zeile. Benutze das Zeichen ${ANSWER_END} sonst nirgends. Keine Nummerierung, keine Überschriften, keine Erklärungen, kein Markdown, keine Tabelle.`,
    '',
    multi ? 'Reihenfolge: Seite für Seite, auf jeder Seite von oben nach unten, innerhalb einer Zeile von links nach rechts. Die Zählung läuft über alle Seiten weiter. Felder für Name, Datum und Klasse zählen nicht mit.' : 'Reihenfolge: von oben nach unten, innerhalb einer Zeile von links nach rechts. Felder für Name, Datum und Klasse zählen nicht mit.',
    'Ankreuzaufgaben (Multiple Choice, Richtig/Falsch) und kleine Kästchen zum Zuordnen oder Nummerieren gehören nicht dazu – ignoriere sie komplett.',
    ...order,
    '',
    `Wenn du ein Feld nicht beantworten kannst, schreibe dafür nur „-${ANSWER_END}“. Schreibe auf Deutsch, so wie eine Schülerin oder ein Schüler es auf das Blatt schreiben würde.`,
    '',
    'Format:',
    `Antwort 1${ANSWER_END}`,
    `Antwort 2${ANSWER_END}`,
    '…',
  ].join('\n');
}
