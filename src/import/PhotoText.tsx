import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Presentation, ScanText, X } from 'lucide-react';
import { newNote, PAGE, pathData, uid, type Drawing, type Profile, type Settings, type Stroke } from '../model';
import { layout } from '../engine';
import { recognizeLine } from './recognizer';
import { segmentPage } from './segment';
import { correctGermanWord, loadGermanLexicon } from './lexicon';
import { vectorize } from '../vectorize';
import { analyseBoard, binarize, bounds, components, diagramOutside, inkImage, joinLines, linesToText, maskImage } from './boardAnalysis';
import { visionText } from '../native';

type Mode = 'text' | 'board';
type Label = { id: string; x: number; y: number; width: number; height: number; text: string };
type Board = { width: number; height: number; diagram: Stroke[]; labels: Label[]; board: boolean };

const canvasOf = (rgba: Uint8ClampedArray, width: number, height: number) => { const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0); return c; };
const grayToRGBA = (gray: Uint8ClampedArray) => { const out = new Uint8ClampedArray(gray.length * 4); for (let i = 0; i < gray.length; i++) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = gray[i]; out[i * 4 + 3] = 255; } return out; };

async function loadImage(file: File, max: number) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Bitte ein Foto mit höchstens 30 MB wählen.');
  const bitmap = await createImageBitmap(file), ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Reads a text line word by word: wide empty column runs are word spaces,
 * which the line model alone tends to swallow ("DerBundespräsident"). */
async function readWords(canvas: HTMLCanvasElement): Promise<{ text: string; confidence: number }> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!, { width, height } = canvas, data = ctx.getImageData(0, 0, width, height).data, inked = new Uint8Array(width);
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) if (data[(y * width + x) * 4] < 110) { inked[x] = 1; break; }
  const words: [number, number][] = [], gap = Math.max(4, height * .24); let start = -1, last = -1;
  for (let x = 0; x < width; x++) { if (!inked[x]) continue; if (start < 0) start = x; else if (x - last > gap) { words.push([start, last + 1]); start = x; } last = x; }
  if (start >= 0) words.push([start, last + 1]);
  if (words.length < 2) return readLine(canvas);
  const parts: { text: string; confidence: number }[] = [], pad = Math.round(height * .15);
  for (const [a, b] of words) { const from = Math.max(0, a - pad), to = Math.min(width, b + pad), c = document.createElement('canvas'); c.width = to - from; c.height = height; c.getContext('2d')!.drawImage(canvas, from, 0, to - from, height, 0, 0, to - from, height); parts.push(await readLine(c)); }
  return { text: parts.map(p => p.text.trim()).filter(Boolean).join(' '), confidence: parts.reduce((n, p) => n + p.confidence, 0) / parts.length };
}

/** Recognises one line image; very wide crops are cut at the emptiest column first. */
async function readLine(canvas: HTMLCanvasElement): Promise<{ text: string; confidence: number }> {
  if (canvas.width / canvas.height > 14) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!, data = ctx.getImageData(0, 0, canvas.width, canvas.height).data, mid = canvas.width / 2, range = canvas.width / 4;
    let best = Math.round(mid), score = Infinity;
    for (let x = Math.floor(mid - range); x < mid + range; x++) { let n = 0; for (let y = 0; y < canvas.height; y++) n += data[(y * canvas.width + x) * 4] < 128 ? 1 : 0; const v = n + Math.abs(x - mid) * .01; if (v < score) { score = v; best = x; } }
    const part = (from: number, to: number) => { const c = document.createElement('canvas'); c.width = to - from; c.height = canvas.height; c.getContext('2d')!.drawImage(canvas, from, 0, to - from, canvas.height, 0, 0, to - from, canvas.height); return c; };
    const [a, b] = [await readLine(part(0, best)), await readLine(part(best, canvas.width))];
    return { text: `${a.text}${score < 1 ? ' ' : ''}${b.text}`, confidence: (a.confidence + b.confidence) / 2 };
  }
  const r = await recognizeLine(canvas), chars = r.characters;
  return { text: r.text, confidence: chars.length ? chars.reduce((n, c) => n + c.confidence, 0) / chars.length : 0 };
}

type Lexicon = Awaited<ReturnType<typeof loadGermanLexicon>>;
const known = (word: string, lexicon: Lexicon) => { const c = correctGermanWord(word, lexicon); return c.known && c.distance === 0; };
/** Words read without a space ("beträgtfünfjahre") are split where every part is a real word. */
function splitParts(word: string, lexicon: Lexicon, depth = 3): string[] | null {
  if (known(word, lexicon) || known(word.toLocaleLowerCase('de-DE'), lexicon)) return [word];
  if (depth <= 1 || word.length < 5) return null;
  let best: string[] | null = null;
  for (let i = 2; i <= word.length - 2; i++) { const head = word.slice(0, i); if (!known(head, lexicon)) continue; const rest = splitParts(word.slice(i), lexicon, depth - 1); if (rest && (!best || Math.min(...[head, ...rest].map(p => p.length)) > Math.min(...best.map(p => p.length)))) best = [head, ...rest]; }
  return best;
}
function splitJoined(word: string, lexicon: Lexicon) {
  if (word.length < 6) return word; const parts = splitParts(word, lexicon);
  if (!parts || parts.length < 2) return word;
  // German nouns inside a run are capitalised when the dictionary knows them that way.
  return parts.map((p, i) => i && !known(p, lexicon) ? p[0].toLocaleUpperCase('de-DE') + p.slice(1) : p).join(' ');
}
const correct = (text: string, lexicon?: Lexicon) => {
  let out = lexicon ? text.replace(/[\p{L}]{4,}/gu, word => { const split = splitJoined(word, lexicon); if (split !== word) return split; const c = correctGermanWord(word, lexicon); return !c.ambiguous && c.distance === 1 && c.rank <= 25000 ? c.text : word; }) : text;
  // Sentences and paragraphs start with a capital letter.
  out = out.replace(/(^|[.!?]\s+|\n)(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase('de-DE'));
  return out;
};

/** The note's own handwriting for a short label, normalised to start at 0/0. */
function handwrite(text: string, profiles: Profile[], settings: Settings) {
  const note = { ...newNote(), id: 'label', renderedText: text, settings: { ...settings, size: 40, paper: 'blank' as const, marginLeft: 0, marginRight: 0, linesTop: 0, linesFirstPage: 0, linesBottom: 0, lineHeight: 70 } };
  const strokes = layout(note, profiles).glyphs.flatMap(g => g.strokes.map(s => s.map(p => ({ ...p, y: p.y + g.page * PAGE.height }))));
  const b = bounds(strokes);
  return { strokes: strokes.map(s => s.map(p => ({ ...p, x: p.x - b.minX, y: p.y - b.minY }))), width: b.maxX - b.minX, height: b.maxY - b.minY, capHeight: 40 * .76 };
}

export function PhotoText({ profiles, settings, page, insertY, initialFiles, onClose, onText, onDrawing }: { profiles: Profile[]; settings: Settings; page: number; insertY: number; initialFiles?: File[]; onClose: () => void; onText: (text: string) => void; onDrawing: (d: Drawing) => void }) {
  const input = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  const [mode, setMode] = useState<Mode>('text'), [busy, setBusy] = useState(''), [error, setError] = useState(''), [photo, setPhoto] = useState('');
  const [text, setText] = useState<string | null>(null), [board, setBoard] = useState<Board | null>(null), [withLines, setWithLines] = useState(true);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { cancelled.current = true; }, []);
  // Photos shared from the Photos app are read right away.
  useEffect(() => { if (initialFiles?.length) void load(initialFiles, 'text'); }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setText(null); setBoard(null); setError(''); };
  const files = useRef<File[]>([]);

  const readText = async (files: File[]) => {
    const lexicon = await loadGermanLexicon().catch(() => undefined), parts: string[] = [];
    for (let f = 0; f < files.length; f++) {
      // In the iOS app Apple's own text recognition reads print, boards and handwriting best.
      setBusy(`Foto ${f + 1}/${files.length} wird gelesen …`);
      const original = await loadImage(files[f], 2400), vision = await visionText(canvasOf(original.data, original.width, original.height));
      if (vision?.length) { parts.push(linesToText(vision.map(l => ({ text: l.text, x: l.x * original.width, y: l.y * original.height, width: l.width * original.width, height: l.height * original.height })))); continue; }
      const image = await loadImage(files[f], 2200), { gray } = inkImage(image.data, image.width, image.height), rgba = grayToRGBA(gray), source = canvasOf(rgba, image.width, image.height);
      const found = segmentPage(rgba, image.width, image.height), heights = found.map(r => r.height).sort((a, b) => a - b), median = heights[Math.floor(heights.length / 2)] || 1;
      const regions = found.filter(r => r.height >= median * .35 && r.height <= median * 2.6);
      if (!regions.length) throw new Error('Auf dem Foto wurde keine Schrift gefunden. Fotografiere den Text gerade und gut ausgeleuchtet.');
      const lines: { y: number; height: number; text: string }[] = [];
      for (let i = 0; i < regions.length; i++) {
        if (cancelled.current) return;
        setBusy(`Foto ${f + 1}/${files.length} · Zeile ${i + 1} von ${regions.length} wird gelesen …`);
        const r = regions[i], crop = document.createElement('canvas'); crop.width = r.width; crop.height = r.height; crop.getContext('2d')!.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
        const read = await readWords(crop), same = lines.at(-1);
        // segmentPage splits long lines into pieces of one band; glue them back together.
        if (same && same.y === r.y && same.height === r.height) {
          // A long line is cut into pieces; a word split at the cut ("Bundes. versammlung") is rejoined.
          const left = same.text.replace(/[.,·]\s*$/, ''), tail = left.match(/(\p{L}+)$/u)?.[1], head = read.text.trim().match(/^(\p{L}+)/u)?.[1];
          same.text = lexicon && tail && head && known(`${tail}${head}`.toLocaleLowerCase('de-DE'), lexicon) ? `${left}${read.text.trim()}` : `${same.text} ${read.text}`;
        } else lines.push({ y: r.y, height: r.height, text: read.text });
        await new Promise(res => setTimeout(res, 0));
      }
      parts.push(correct(joinLines(lines), lexicon));
    }
    setText(parts.join('\n\n'));
  };

  const readBoard = async (file: File) => {
    const lexicon = await loadGermanLexicon().catch(() => undefined);
    setBusy('Tafelbild wird analysiert …'); await new Promise(res => setTimeout(res, 30));
    const image = await loadImage(file, 1500), { gray, board: dark } = inkImage(image.data, image.width, image.height), ink = binarize(gray, image.width, image.height);
    const { label, list } = components(ink, image.width, image.height);
    const vision = (await visionText(canvasOf(image.data, image.width, image.height)))?.filter(l => l.text.trim() && l.confidence >= .3);
    if (vision?.length) {
      const boxes = vision.map(l => ({ id: uid(), text: l.text.trim(), x: l.x * image.width, y: l.y * image.height, width: l.width * image.width, height: l.height * image.height }));
      const textHeight = boxes.map(b => b.height).sort((a, b) => a - b)[Math.floor(boxes.length / 2)] || 20, ids = diagramOutside(list, boxes, textHeight);
      setBusy('Linien und Formen werden nachgezeichnet …'); await new Promise(res => setTimeout(res, 0));
      const mask = maskImage(label, image.width, image.height, ids);
      const diagram = ids.length ? vectorize(mask.rgba, mask.width, mask.height, 165).filter(s => s.length > 1) : [];
      setBoard({ width: image.width, height: image.height, diagram, labels: boxes, board: dark });
      return;
    }
    const result = analyseBoard(list);
    if (!result.labels.length && !result.diagram.length) throw new Error('Auf dem Foto wurde kein Tafelbild erkannt.');
    const labels: Label[] = [], dropped: number[] = [];
    for (let i = 0; i < result.labels.length; i++) {
      if (cancelled.current) return;
      setBusy(`Beschriftung ${i + 1} von ${result.labels.length} wird gelesen …`);
      const l = result.labels[i], pad = Math.round(result.textHeight * .3), m = maskImage(label, image.width, image.height, l.parts, l, pad), read = await readLine(canvasOf(m.rgba, m.width, m.height)), clean = read.text.trim();
      if (!clean || read.confidence < .3) { dropped.push(...l.parts); continue; }
      labels.push({ id: uid(), x: l.x, y: l.y, width: l.width, height: l.height, text: correct(clean, lexicon) });
      await new Promise(res => setTimeout(res, 0));
    }
    setBusy('Linien und Formen werden nachgezeichnet …'); await new Promise(res => setTimeout(res, 0));
    const lines = maskImage(label, image.width, image.height, [...result.diagram, ...dropped]);
    const diagram = result.diagram.length || dropped.length ? vectorize(lines.rgba, lines.width, lines.height, 165).filter(s => s.length > 1) : [];
    setBoard({ width: image.width, height: image.height, diagram, labels, board: dark });
  };

  const load = async (chosen: File[], as: Mode = mode) => {
    if (!chosen.length) return; reset(); cancelled.current = false; files.current = chosen;
    const files_ = chosen;
    setPhoto(URL.createObjectURL(files_[0]));
    setBusy('Erkennung wird geladen …');
    try { if (as === 'text') await readText(files_); else await readBoard(files_[0]); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  // Board labels are rewritten in the note's handwriting, sized and placed like on the board.
  const drawing = useMemo(() => {
    if (!board) return null;
    const strokes: Stroke[] = withLines ? [...board.diagram] : [];
    for (const l of board.labels) {
      if (!l.text.trim()) continue;
      const hand = handwrite(l.text.trim(), profiles, settings); if (!hand.strokes.length) continue;
      const k = Math.min(l.height * .8 / hand.capHeight, l.width * 1.25 / Math.max(1, hand.width)), dy = l.y + l.height / 2 - hand.height * k / 2;
      strokes.push(...hand.strokes.map(s => s.map(p => ({ ...p, x: l.x + p.x * k, y: dy + p.y * k }))));
    }
    if (!strokes.length) return null;
    const b = bounds(strokes), width = Math.max(1, b.maxX - b.minX), height = Math.max(1, b.maxY - b.minY);
    return { strokes: strokes.map(s => s.map(p => ({ ...p, x: p.x - b.minX, y: p.y - b.minY }))), width, height };
  }, [board, withLines, profiles, settings]);

  const insert = () => {
    if (!drawing) return;
    let targetPage = page, y = Math.max(70, Math.min(PAGE.height - 180, insertY));
    if (PAGE.height - y - 70 < 320) { targetPage = page + 1; y = 90; }
    const scale = Math.min((PAGE.width - 140) / drawing.width, (PAGE.height - y - 70) / drawing.height);
    onDrawing({ id: uid(), page: targetPage, name: 'Tafelbild', strokes: drawing.strokes, x: (PAGE.width - drawing.width * scale) / 2, y, scale, width: drawing.width, height: drawing.height, color: settings.color, penWidth: Math.min(20, Math.max(.5, settings.penWidth / scale)) });
  };

  return <div className="modal-backdrop"><section className="modal photo-text" role="dialog" aria-modal="true" aria-labelledby="photo-text-title">
    <header className="modal-header"><div><span className="eyebrow">NICHT MEHR ABSCHREIBEN</span><h2 id="photo-text-title">Foto in deine Handschrift</h2><p>Text, Buchseite oder Tafelbild fotografieren – die App liest es und schreibt es in deiner Schrift.</p></div><button className="icon-button" aria-label="Foto-Import schließen" onClick={onClose}><X size={20} /></button></header>
    <div className="modal-content">
      <div className="photo-modes" role="tablist">
        <button role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'active' : ''} onClick={() => { setMode('text'); reset(); if (files.current.length) void load(files.current, 'text'); }}><ScanText size={20} /><span><strong>Text</strong><small>Buch, Arbeitsblatt, Tafeltext</small></span></button>
        <button role="tab" aria-selected={mode === 'board'} className={mode === 'board' ? 'active' : ''} onClick={() => { setMode('board'); reset(); if (files.current.length) void load(files.current, 'board'); }}><Presentation size={20} /><span><strong>Tafelbild</strong><small>Mindmap, Skizze mit Beschriftung</small></span></button>
      </div>
      <input ref={input} hidden type="file" accept="image/*" multiple={mode === 'text'} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void load(files); }} />
      {busy ? <div className="photo-busy" role="status"><span className="spinner" />{busy}</div>
        : text === null && !board && <button className="drawing-drop" onClick={() => input.current?.click()}><Camera size={40} /><strong>{mode === 'text' ? 'Foto vom Text aufnehmen oder wählen' : 'Foto vom Tafelbild aufnehmen oder wählen'}</strong><span>{mode === 'text' ? 'Auch mehrere Fotos nacheinander · Tafel, Heft oder gedruckter Text' : 'Linien, Pfeile und Kreise bleiben als Zeichnung, die Beschriftung wird deine Handschrift'}</span></button>}
      {error && <p className="warning-text">{error}</p>}
      {text !== null && !busy && <div className="photo-result">
        {photo && <img src={photo} alt="Dein Foto" />}
        <label>Erkannter Text – bitte kurz prüfen und korrigieren<textarea value={text} maxLength={100000} onChange={e => setText(e.target.value)} /></label>
        <div className="button-row"><button className="button" onClick={() => input.current?.click()}><ImagePlus size={16} />Anderes Foto</button><button className="button primary" disabled={!text.trim()} onClick={() => onText(text.trim())}><Check size={16} />In meine Handschrift umwandeln</button></div>
      </div>}
      {board && !busy && <div className="photo-result board">
        <div className="board-compare">{photo && <img src={photo} alt="Dein Tafelbild" />}{drawing && <svg viewBox={`-10 -10 ${drawing.width + 20} ${drawing.height + 20}`} aria-label="Vorschau in deiner Handschrift">{drawing.strokes.map((s, i) => <path key={i} d={pathData(s)} fill="none" stroke={settings.color} strokeWidth={Math.max(1.2, drawing.width / 420)} strokeLinecap="round" strokeLinejoin="round" />)}</svg>}</div>
        <label className="board-toggle"><input type="checkbox" checked={withLines} onChange={e => setWithLines(e.target.checked)} />Linien, Pfeile und Formen übernehmen ({board.diagram.length} Striche)</label>
        {board.labels.length > 0 && <div className="board-labels"><strong>Erkannte Beschriftungen – antippen zum Korrigieren</strong>{board.labels.map(l => <input key={l.id} value={l.text} aria-label="Beschriftung" onChange={e => setBoard(b => b && { ...b, labels: b.labels.map(x => x.id === l.id ? { ...x, text: e.target.value } : x) })} />)}</div>}
        <div className="button-row"><button className="button" onClick={() => input.current?.click()}><ImagePlus size={16} />Anderes Foto</button><button className="button primary" disabled={!drawing} onClick={insert}><Check size={16} />Tafelbild einfügen</button></div>
      </div>}
      <p className="photo-tip">Tipp: Je gerader und heller das Foto, desto besser die Erkennung. Auf dem iPad kannst du gedruckten Text auch mit „Live Text“ im Foto markieren, kopieren und ins Textfeld einfügen.</p>
    </div>
  </section></div>;
}
