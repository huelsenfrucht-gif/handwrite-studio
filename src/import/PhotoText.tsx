import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, X } from 'lucide-react';
import { recognizeLine } from './recognizer';
import { segmentPage } from './segment';
import { correctGermanWord, loadGermanLexicon } from './lexicon';
import { inkImage, joinLines, linesToText } from './boardAnalysis';
import { visionText } from '../native';

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

/**
 * Photo of a board, a book page or a worksheet → text in the same structure:
 * lines, paragraphs, indented points and tables ("| a | b |") as they stand on the photo.
 * Only the text is taken over; drawings on the board are not copied.
 */
export function PhotoText({ initialFiles, onClose, onText }: { initialFiles?: File[]; onClose: () => void; onText: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [photo, setPhoto] = useState('');
  const [text, setText] = useState<string | null>(null);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { cancelled.current = true; }, []);
  // Photos shared from the Photos app are read right away.
  useEffect(() => { if (initialFiles?.length) void load(initialFiles); }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setText(null); setError(''); };
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

  const load = async (chosen: File[]) => {
    if (!chosen.length) return; reset(); cancelled.current = false; files.current = chosen;
    const files_ = chosen;
    setPhoto(URL.createObjectURL(files_[0]));
    setBusy('Erkennung wird geladen …');
    try { await readText(files_); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  return <div className="modal-backdrop"><section className="modal photo-text" role="dialog" aria-modal="true" aria-labelledby="photo-text-title">
    <header className="modal-header"><div><h2 id="photo-text-title">Text aus Foto</h2><p>Tafel, Heft oder Buchseite fotografieren. Der Text wird so übernommen, wie er dasteht: mit Absätzen, Einrückungen und Tabellen.</p></div><button className="icon-button" aria-label="Foto-Import schließen" onClick={onClose}><X size={20} /></button></header>
    <div className="modal-content">
      <input ref={input} hidden type="file" accept="image/*" multiple onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void load(files); }} />
      {busy ? <div className="photo-busy" role="status"><span className="spinner" />{busy}</div>
        : text === null && <button className="drawing-drop" onClick={() => input.current?.click()}><Camera size={40} /><strong>Foto aufnehmen oder wählen</strong><span>Auch mehrere Fotos nacheinander · Tafel, Heft oder gedruckter Text</span></button>}
      {error && <p className="warning-text">{error}</p>}
      {text !== null && !busy && <div className="photo-result">
        {photo && <img src={photo} alt="Dein Foto" />}
        <label>Erkannter Text – bitte kurz prüfen<small>Tabellen stehen als „| Spalte | Spalte |“ und werden mit Linien geschrieben.</small><textarea value={text} maxLength={100000} onChange={e => setText(e.target.value)} /></label>
        <div className="button-row"><button className="button" onClick={() => input.current?.click()}><ImagePlus size={16} />Anderes Foto</button><button className="button primary" disabled={!text.trim()} onClick={() => onText(text.trim())}><Check size={16} />In meine Handschrift umwandeln</button></div>
      </div>}
      <p className="photo-tip">Tipp: Je gerader und heller das Foto, desto besser die Erkennung. Auf dem iPad kannst du gedruckten Text auch mit „Live Text“ im Foto markieren, kopieren und ins Textfeld einfügen.</p>
    </div>
  </section></div>;
}
