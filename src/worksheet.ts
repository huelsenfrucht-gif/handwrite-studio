import { PAGE, uid, type Field } from './model';

/**
 * Finds the places on a worksheet where an answer belongs:
 * - empty cells of tables and empty boxes (two horizontal + two vertical rules),
 * - answer lines ("Name: ________"), several equal lines below each other as one field.
 * Works on the grey values of the scanned page; coordinates are returned in page units.
 */
export type Rect = { x: number; y: number; width: number; height: number; rows?: number };
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
  return { hs: hs.filter(l => l.y2 - l.y1 < thick), vs: vs.filter(l => l.x2 - l.x1 < thick) };
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
        if (cell.width < w * .02 || cell.width * cell.height > w * h * .45) continue;
        const m = Math.max(4, w * .004);
        if (inkShare(gray, w, cell.x + m, cell.y + m, cell.x + cell.width - m, cell.y + cell.height - m) < .003) cells.push(cell);
      }
      break;
    }
  }
  // Answer lines: rules that are not borders of a box; the free space above is the writing area.
  const lines: Rect[] = [];
  for (const l of sorted) {
    if (borders.has(l) || vs.some(v => Math.abs((v.x1 + v.x2) / 2 - l.x1) < tol && v.y2 >= l.y1 - tol && v.y1 <= l.y2 + tol && v.y2 - v.y1 > h * .02)) continue;
    const max = Math.round(h * .03), x1 = l.x1 + 2, x2 = l.x2 - 2; let free = 0;
    for (let y = l.y1 - 3; y > l.y1 - max && y > 0; y--) { if (inkShare(gray, w, x1, y, x2, y + 1) > .01) break; free++; }
    if (free >= h * .009) lines.push({ x: l.x1, y: l.y1 - free - 2, width: l.x2 - l.x1, height: free + 2 });
  }
  // Equal lines right below each other form one larger writing area with several rows.
  const merged: Rect[] = [];
  for (const r of lines) {
    const prev = merged.at(-1);
    if (prev && Math.abs(prev.x - r.x) < tol && Math.abs(prev.width - r.width) < tol * 2 && r.y - (prev.y + prev.height) < h * .025) { prev.rows = (prev.rows || 1) + 1; prev.height = r.y + r.height - prev.y; }
    else merged.push({ ...r });
  }
  return [...cells, ...merged];
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
  return findAnswerAreas(gray, w, h).map(r => ({ id: uid(), page, x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k, text: '', ...(r.rows && r.rows > 1 ? { rows: r.rows } : {}) }));
}
