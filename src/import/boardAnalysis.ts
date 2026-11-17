import type { Stroke } from '../model';
import type { Region } from './segment';

/** Grayscale copy in which ink is dark on a light background. A blackboard
 * (dark board, bright chalk) is detected by its overall brightness and inverted. */
export function inkImage(rgba: Uint8ClampedArray, width: number, height: number) {
  const gray = new Uint8ClampedArray(width * height); let sum = 0;
  for (let i = 0; i < gray.length; i++) { const g = .2126 * rgba[i * 4] + .7152 * rgba[i * 4 + 1] + .0722 * rgba[i * 4 + 2]; gray[i] = g; sum += g; }
  const board = sum / gray.length < 118;
  if (board) for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];
  return { gray, board };
}

/** Adaptive binarisation: a pixel is ink when it is clearly darker than its surroundings. */
export function binarize(gray: Uint8ClampedArray, width: number, height: number) {
  const integral = new Float64Array((width + 1) * (height + 1)), stride = width + 1;
  for (let y = 0; y < height; y++) { let row = 0; for (let x = 0; x < width; x++) { row += gray[y * width + x]; integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row; } }
  const r = Math.max(10, Math.min(40, Math.round(Math.min(width, height) / 30))), ink = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(width, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(height, y + r + 1);
    const mean = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0)), g = gray[y * width + x];
    if (g < 90 || g < Math.min(215, mean - 22)) ink[y * width + x] = 1;
  }
  return ink;
}

export type Component = Region & { id: number; pixels: number };
/** 8-connected ink blobs with their bounding boxes. */
export function components(ink: Uint8Array, width: number, height: number) {
  const label = new Int32Array(width * height), out: Component[] = [], stack: number[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || label[start]) continue;
    const id = out.length + 1; let minX = width, minY = height, maxX = 0, maxY = 0, pixels = 0;
    label[start] = id; stack.push(start);
    while (stack.length) {
      const i = stack.pop()!, x = i % width, y = (i - x) / width; pixels++;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx; if (ink[j] && !label[j]) { label[j] = id; stack.push(j); }
      }
    }
    out.push({ id, x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels });
  }
  return { label, list: out };
}

export type Layout = { textHeight: number; labels: (Region & { parts: number[] })[]; diagram: number[] };
/** Splits a board photo into handwriting (letters grouped to words and labels)
 * and diagram ink (lines, arrows, circles and boxes of a mind map). */
export function analyseBoard(list: Component[]): Layout {
  const blobs = list.filter(c => c.pixels >= 6);
  const sizes = blobs.filter(c => c.height >= 5 && c.width < c.height * 3).map(c => c.height).sort((a, b) => a - b);
  const textHeight = sizes.length ? sizes[Math.floor(sizes.length * .6)] : 20;
  const isLine = (c: Component) => { const long = Math.max(c.width, c.height), thickness = c.pixels / Math.max(1, long); return long > textHeight * 3.2 && thickness < textHeight * .35; };
  const textLike = (c: Component) => c.height <= textHeight * 2.3 && c.height >= textHeight * .28 && !isLine(c) && c.pixels / (c.width * c.height) > .05;
  const letters = blobs.filter(textLike), small = blobs.filter(c => c.height < textHeight * .28 && c.width < textHeight * .6);
  const diagram = new Set(blobs.filter(c => !textLike(c) && !small.includes(c)).map(c => c.id));
  // Union neighbouring letters on a common baseline into one label.
  const parent = new Map(letters.map(c => [c.id, c.id])), find = (id: number): number => { let p = parent.get(id)!; while (p !== parent.get(p)) p = parent.get(p)!; parent.set(id, p); return p; };
  const sorted = [...letters].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
    const a = sorted[i], b = sorted[j]; if (b.x - (a.x + a.width) > textHeight * 1.15) break;
    const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    if (overlap > Math.min(a.height, b.height) * .35) parent.set(find(a.id), find(b.id));
  }
  // Sorted by x, a later letter can lie far beyond the break; a second pass
  // over the grouped boxes merges what is still adjacent.
  const groups = new Map<number, Component[]>(); for (const c of letters) { const root = find(c.id); groups.set(root, [...(groups.get(root) || []), c]); }
  let labels = [...groups.values()].map(parts => { const x = Math.min(...parts.map(p => p.x)), y = Math.min(...parts.map(p => p.y)), r = Math.max(...parts.map(p => p.x + p.width)), b = Math.max(...parts.map(p => p.y + p.height)); return { x, y, width: r - x, height: b - y, parts: parts.map(p => p.id) }; });
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < labels.length; i++) for (let j = 0; j < labels.length; j++) {
      if (i === j) continue; const a = labels[i], b = labels[j], gap = b.x - (a.x + a.width), overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (gap > -textHeight * .3 && gap < textHeight * 1.15 && overlap > Math.min(a.height, b.height) * .45) {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); labels[i] = { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y, parts: [...a.parts, ...b.parts] };
        labels.splice(j, 1); merged = true; break outer;
      }
    }
  }
  // A single isolated mark is more likely part of the drawing (an arrow head, a tick).
  labels = labels.filter(l => { const keep = l.parts.length > 1 || l.width > textHeight * .9; if (!keep) l.parts.forEach(id => diagram.add(id)); return keep; });
  // Dots (i, ä, punctuation) belong to the nearest label, otherwise they are dropped as noise.
  for (const d of small) { const host = labels.find(l => d.x >= l.x - textHeight * .4 && d.x <= l.x + l.width + textHeight * .4 && d.y >= l.y - textHeight * .9 && d.y <= l.y + l.height + textHeight * .3); if (host) { host.parts.push(d.id); const top = Math.min(host.y, d.y); host.height += host.y - top; host.y = top; } }
  labels.sort((a, b) => a.y - b.y || a.x - b.x);
  return { textHeight, labels, diagram: [...diagram] };
}

/** Black-on-white RGBA image containing only the given components. */
export function maskImage(label: Int32Array, width: number, height: number, ids: Iterable<number>, region: Region = { x: 0, y: 0, width, height }, pad = 0) {
  const keep = new Set(ids), w = region.width + pad * 2, h = region.height + pad * 2, rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
    const sx = region.x + x, sy = region.y + y; if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
    if (keep.has(label[sy * width + sx])) { const j = ((y + pad) * w + x + pad) * 4; rgba[j] = rgba[j + 1] = rgba[j + 2] = 0; }
  }
  return { rgba, width: w, height: h };
}

/** Lines of text in reading order, with a blank line where the spacing to the
 * previous line is clearly larger than the usual line pitch (a new paragraph). */
export function joinLines(lines: { y: number; height: number; text: string }[]) {
  const kept = lines.map(l => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter(l => l.text);
  const pitches = kept.slice(1).map((l, i) => l.y - kept[i].y).filter(p => p > 0).sort((a, b) => a - b);
  const heights = kept.map(l => l.height).sort((a, b) => a - b), pitch = pitches.length >= 2 ? pitches[Math.floor((pitches.length - 1) / 2)] : (heights[Math.floor(heights.length / 2)] || 1) * 1.6;
  return kept.map((l, i) => (i === 0 ? '' : l.y - kept[i - 1].y > pitch * 1.9 ? '\n\n' : '\n') + l.text).join('');
}

/** Bounding box of strokes. */
export function bounds(strokes: Stroke[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
  return minX === Infinity ? { minX: 0, minY: 0, maxX: 0, maxY: 0 } : { minX, minY, maxX, maxY };
}

export type TextBox = { text: string; x: number; y: number; width: number; height: number };
/** Apple Vision lines (in pixels) → plain text: segments of one row are joined,
 * rows in reading order, blank lines where a paragraph break is visible. */
export function linesToText(lines: TextBox[]) {
  const sorted = [...lines].filter(l => l.text.trim()).sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  if (!sorted.length) return '';
  const rows: TextBox[][] = [];
  for (const line of sorted) {
    const row = rows.at(-1), mid = line.y + line.height / 2;
    if (row && Math.abs(mid - (row[0].y + row[0].height / 2)) < Math.min(line.height, row[0].height) * .5) row.push(line); else rows.push([line]);
  }
  const heights = sorted.map(l => l.height).sort((a, b) => a - b), size = heights[Math.floor(heights.length / 2)] || 1;
  // Pieces of one row that are close together are one phrase; wide gaps separate columns.
  type Segment = { text: string; x: number; right: number };
  const lineRows = rows.map(r => {
    r.sort((a, b) => a.x - b.x);
    const segments: Segment[] = [];
    for (const box of r) { const last = segments.at(-1); if (last && box.x - last.right < size * 1.6) { last.text += ` ${box.text.trim()}`; last.right = Math.max(last.right, box.x + box.width); } else segments.push({ text: box.text.trim(), x: box.x, right: box.x + box.width }); }
    return { y: Math.min(...r.map(l => l.y)), height: Math.max(...r.map(l => l.height)), segments };
  });
  const left = Math.min(...lineRows.map(r => r.segments[0].x));
  // Rows with several columns that line up form a table ("| a | b |"), like on the board or sheet.
  const entries: { y: number; end: number; text: string; table?: boolean }[] = [];
  for (let i = 0; i < lineRows.length;) {
    if (lineRows[i].segments.length >= 2) {
      let j = i; const starts: number[] = [];
      while (j < lineRows.length && (lineRows[j].segments.length >= 2 || (j > i && starts.some(x => Math.abs(x - lineRows[j].segments[0].x) < size * 2)))) { starts.push(...lineRows[j].segments.map(s => s.x)); j++; }
      // A table needs at least two rows with several columns; single rows at the end belong to the text.
      while (j > i && lineRows[j - 1].segments.length < 2) j--;
      if (lineRows.slice(i, j).filter(r => r.segments.length >= 2).length >= 2) {
        const columns: number[] = [];
        for (const x of [...starts].sort((a, b) => a - b)) if (!columns.length || x - columns.at(-1)! > size * 2) columns.push(x);
        const cells = (r: typeof lineRows[number]) => { const out = columns.map(() => ''); for (const s of r.segments) { let c = 0; for (let k = 0; k < columns.length; k++) if (s.x >= columns[k] - size * 2) c = k; out[c] = out[c] ? `${out[c]} ${s.text}` : s.text; } return out; };
        const group = lineRows.slice(i, j);
        entries.push({ y: group[0].y, end: group.at(-1)!.y, table: true, text: group.map(r => `| ${cells(r).map(c => c.replace(/\|/g, '/')).join(' | ')} |`).join('\n') });
        i = j; continue;
      }
    }
    // Indented lines (sub-points on a board) keep their indent as tabs.
    const r = lineRows[i], level = Math.min(4, Math.max(0, Math.floor((r.segments[0].x - left) / (size * 3))));
    entries.push({ y: r.y, end: r.y, text: '\t'.repeat(level) + r.segments.map(s => s.text).join(' ') });
    i++;
  }
  const pitches = entries.slice(1).map((l, i) => l.y - entries[i].end).filter(p => p > 0).sort((a, b) => a - b);
  const pitch = pitches.length >= 2 ? pitches[Math.floor((pitches.length - 1) / 2)] : size * 1.6;
  // Exactly one text line per line on the photo; an empty line only where the photo really has an empty line.
  return entries.map((e, i) => (i === 0 ? '' : e.y - entries[i - 1].end - size > size * 1.6 ? '\n\n' : '\n') + e.text).join('');
}

/** Ink blobs that lie inside a recognised text box are letters; everything else is drawing. */
export function diagramOutside(list: Component[], boxes: Region[], textHeight: number) {
  const pad = textHeight * .25;
  return list.filter(c => c.pixels >= 6 && !boxes.some(b => {
    const w = Math.min(c.x + c.width, b.x + b.width + pad) - Math.max(c.x, b.x - pad), h = Math.min(c.y + c.height, b.y + b.height + pad) - Math.max(c.y, b.y - pad);
    return w > 0 && h > 0 && w * h >= c.width * c.height * .6;
  })).map(c => c.id);
}

type Box = { x: number; y: number; width: number; height: number };
export type DocumentBlock = Box & ({ kind: 'table'; rows: string[][] } | { kind: 'text'; lines: (Box & { text: string })[] });
/**
 * Apple's document reading (paragraphs in reading order, exact lines, tables) → text with the same layout:
 * every line stays a line, items on one row (e.g. "Name: … Datum: …") stay on one row,
 * an empty line only where there is real space, tables as "| a | b |".
 */
export function documentToText(blocks: DocumentBlock[]) {
  // Vision splits a printed line at every gap (e.g. at the blanks of a gap text). Pieces at the same
  // height are joined back into one line, so every line on the photo is exactly one line of text.
  const pieces = blocks.flatMap(b => b.kind === 'text' ? b.lines.filter(l => l.text.trim()) : []);
  const heights = pieces.map(l => l.height).sort((a, b) => a - b), lh = heights[Math.floor(heights.length / 2)] || .015;
  type Row = { y: number; bottom: number; text: string; table?: boolean };
  const rows: Row[] = [];
  for (const l of [...pieces].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2))) {
    const mid = l.y + l.height / 2, row = rows.find(r => !r.table && Math.abs((r.y + r.bottom) / 2 - mid) < Math.min(lh, l.height) * .55);
    if (row) (row as Row & { parts: typeof pieces }).parts.push(l); else rows.push(Object.assign({ y: l.y, bottom: l.y + l.height, text: '' }, { parts: [l] }));
  }
  for (const r of rows as (Row & { parts: typeof pieces })[]) {
    r.parts.sort((a, b) => a.x - b.x);
    r.text = r.parts.map((p, i) => (i === 0 ? '' : p.x - (r.parts[i - 1].x + r.parts[i - 1].width) > lh * 2.5 ? '   ' : ' ') + p.text.trim()).join('');
    r.y = Math.min(...r.parts.map(p => p.y)); r.bottom = Math.max(...r.parts.map(p => p.y + p.height));
  }
  for (const b of blocks) if (b.kind === 'table') rows.push({ y: b.y, bottom: b.y + b.height, table: true, text: b.rows.map(r => `| ${r.map(c => c.replace(/\|/g, '/').trim()).join(' | ')} |`).join('\n') });
  // Lines inside a table area belong to the table.
  const tables = rows.filter(r => r.table), kept = rows.filter(r => r.table || !tables.some(t => (r.y + r.bottom) / 2 > t.y && (r.y + r.bottom) / 2 < t.bottom)).sort((a, b) => a.y - b.y);
  return kept.map((r, i) => (i === 0 ? '' : r.table || kept[i - 1].table || r.y - kept[i - 1].bottom > lh * 1.3 ? '\n\n' : '\n') + r.text).join('').replace(/\n{3,}/g, '\n\n').trim();
}
