import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, X } from 'lucide-react';
import { documentToText, linesToText } from './boardAnalysis';
import { visionDocument, visionText } from '../native';
import { getLang, t } from '../i18n';

const canvasOf = (rgba: Uint8ClampedArray, width: number, height: number) => { const c = document.createElement('canvas'); c.width = width; c.height = height; c.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0); return c; };

async function loadImage(file: File, max: number) {
  if (file.size > 30 * 1024 * 1024) throw new Error(t('Bitte ein Foto mit höchstens 30 MB wählen.'));
  const bitmap = await createImageBitmap(file), ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Prompt for an AI chat that copies the photo exactly; every line ends with ¦ so no copy method can lose a line. */
export const TRANSCRIBE_PROMPT = () => getLang() === 'en' ? TRANSCRIBE_PROMPT_EN : TRANSCRIBE_PROMPT_DE;
const TRANSCRIBE_PROMPT_DE = `Schreibe den Text auf dem angehängten Foto (Tafel, Heft, Buch oder Arbeitsblatt) exakt ab.

Regeln:
- Jede Zeile genau so wie auf dem Foto: gleiche Zeilenumbrüche, nichts zusammenfassen, nichts weglassen, nichts ergänzen.
- Setze an das Ende JEDER Zeile das Zeichen ¦ – auch an leere Zeilen (dann steht dort nur ¦).
- Tabellen: jede Tabellenzeile als | Zelle | Zelle | und danach ¦.
- Eingerückte Unterpunkte mit einem Tabulator am Zeilenanfang.
- Schreibe in der Sprache, die auf dem Foto steht – nichts übersetzen.
- Keine Überschrift, keine Erklärung, kein Markdown, keine Zeichnungen beschreiben.
- Benutze das Zeichen ¦ sonst nirgends.`;
const TRANSCRIBE_PROMPT_EN = `Copy the text in the attached photo (board, notebook, book or worksheet) exactly.

Rules:
- Every line exactly as in the photo: same line breaks, do not summarise, leave out or add anything.
- Put the character ¦ at the end of EVERY line – also on empty lines (then only ¦ is there).
- Tables: each table row as | cell | cell | followed by ¦.
- Indented sub-points with a tab at the start of the line.
- Write in the language shown in the photo – do not translate anything.
- No heading, no explanation, no Markdown, do not describe drawings.
- Do not use the character ¦ anywhere else.`;
/** Turns an AI reply in the ¦ format back into lines, however it was copied. */
export function fromMarkedLines(reply: string) {
  if (!/[¦￤]/.test(reply)) return reply.trim();
  const lines = reply.replace(/\r/g, '').split(/[¦￤]/).map(l => l.replace(/^\s*\n/, '').replace(/\n/g, ' ').replace(/[ ]+$/,'').replace(/^ (?=\S)/, ''));
  if (!lines.at(-1)?.trim()) lines.pop();
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function PhotoText({ initialFiles, onClose, onText }: { initialFiles?: File[]; onClose: () => void; onText: (text: string) => void }) {
  const input = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [photo, setPhoto] = useState('');
  const [text, setText] = useState<string | null>(null), [aiOpen, setAiOpen] = useState(false), [aiReply, setAiReply] = useState('');
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => () => { cancelled.current = true; }, []);
  // Photos shared from the Photos app are read right away.
  useEffect(() => { if (initialFiles?.length) void load(initialFiles); }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setText(null); setError(''); };
  const files = useRef<File[]>([]);

  // Apple's text recognition on the iPad: document reading (iPadOS 26) first, plain line recognition as fallback.
  const readText = async (files: File[]) => {
    const parts: string[] = [];
    for (let f = 0; f < files.length; f++) {
      if (cancelled.current) return;
      setBusy(`Foto ${f + 1}/${files.length} wird gelesen …`);
      const original = await loadImage(files[f], 2800), photo = canvasOf(original.data, original.width, original.height);
      const doc = await visionDocument(photo);
      if (doc) { parts.push(documentToText(doc)); continue; }
      const vision = await visionText(photo);
      if (vision?.length) { parts.push(linesToText(vision.map(l => ({ text: l.text, x: l.x * original.width, y: l.y * original.height, width: l.width * original.width, height: l.height * original.height })))); continue; }
      throw new Error(t('Auf dem Foto wurde kein Text erkannt. Fotografiere gerade und hell – oder nutze „Mit KI abschreiben lassen“.'));
    }
    setText(parts.join('\n\n'));
  };

  const load = async (chosen: File[]) => {
    if (!chosen.length) return; reset(); cancelled.current = false; files.current = chosen;
    const files_ = chosen;
    setPhoto(URL.createObjectURL(files_[0]));
    setBusy(t('Erkennung wird geladen …'));
    try { await readText(files_); }
    catch (e) { setError(t((e as Error).message)); }
    finally { setBusy(''); }
  };

  return <div className="modal-backdrop"><section className="modal photo-text" role="dialog" aria-modal="true" aria-labelledby="photo-text-title">
    <header className="modal-header"><div><h2 id="photo-text-title">{t('Text aus Foto')} <span className="exp-badge">{t('Experimentell')}</span></h2><p>{t('Tafel, Heft oder Buchseite fotografieren. Der Text wird so übernommen, wie er dasteht: mit Absätzen, Einrückungen und Tabellen. Die Erkennung ist noch in Erprobung – bitte das Ergebnis vor dem Übernehmen prüfen.')}</p></div><button className="icon-button" aria-label={t('Foto-Import schließen')} onClick={onClose}><X size={20} /></button></header>
    <div className="modal-content">
      <input ref={input} hidden type="file" accept="image/*" multiple onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; void load(files); }} />
      {busy ? <div className="photo-busy" role="status"><span className="spinner" />{busy}</div>
        : text === null && <button className="drawing-drop" onClick={() => input.current?.click()}><Camera size={40} /><strong>{t('Foto aufnehmen oder wählen')}</strong><span>{t('Auch mehrere Fotos nacheinander · Tafel, Heft oder gedruckter Text')}</span></button>}
      {error && <p className="warning-text">{error}</p>}
      {text !== null && !busy && <div className="photo-result">
        {photo && <img src={photo} alt={t('Dein Foto')} />}
        <div className="photo-ai"><button className="text-link" onClick={() => setAiOpen(o => !o)}>{t('Nicht genau genug? Mit KI abschreiben lassen')}</button>{aiOpen && <div className="photo-ai-body"><p>{t('1. Prompt kopieren · 2. Bei der KI mit diesem Foto einfügen · 3. Antwort hier einfügen')}</p><button className="button" onClick={() => void navigator.clipboard?.writeText(TRANSCRIBE_PROMPT())}>{t('Prompt kopieren')}</button><textarea value={aiReply} placeholder={t('Antwort der KI hier einfügen …')} onChange={e => setAiReply(e.target.value)} /><button className="button primary" disabled={!aiReply.trim()} onClick={() => { setText(fromMarkedLines(aiReply)); setAiOpen(false); setAiReply(''); }}>{t('Antwort übernehmen')}</button></div>}</div>
        <label>{t('Erkannter Text – bitte kurz prüfen')}<small>{t('Tabellen stehen als „| Spalte | Spalte |“ und werden mit Linien geschrieben.')}</small><textarea value={text} maxLength={100000} onChange={e => setText(e.target.value)} /></label>
        <div className="button-row"><button className="button" onClick={() => input.current?.click()}><ImagePlus size={16} />{t('Anderes Foto')}</button><button className="button primary" disabled={!text.trim()} onClick={() => onText(text.trim())}><Check size={16} />{t('In meine Handschrift umwandeln')}</button></div>
      </div>}
      <p className="photo-tip">{t('Tipp: Je gerader und heller das Foto, desto besser die Erkennung. Auf dem iPad kannst du gedruckten Text auch mit „Live Text“ im Foto markieren, kopieren und ins Textfeld einfügen.')}</p>
    </div>
  </section></div>;
}
