import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Lock, PenLine, Play, RotateCcw, ScanLine, X } from 'lucide-react';
import { Training } from './Training';
import { GuideLines, GuideText } from './Guide';
import { layout } from './engine';
import { defaultSettings, isPunctuation, pathData, smooth, uid, type Glyph, type Note, type PairSample, type Point, type Profile, type Stroke } from './model';
import { levels, measureRhythm, nextPairs, normalisePair, pairCoverage, PAIRS_CORE, RHYTHM_SENTENCES, SIGNS, splitPair, type LevelId } from './levels';
import { adsAvailable, showRewardedAd } from './nativeAds';

type View = { kind: 'list' } | { kind: 'letters' } | { kind: 'signs' } | { kind: 'rhythm' } | { kind: 'pairs'; keys: string[]; level: 4 | 5 };
type Props = { profile: Profile; update: (fn: (p: Profile) => Profile) => void; onClose: () => void; onUse: () => void };

/** All stages of a handwriting in one place: what is done, what comes next, what it brings. */
export function LevelSheet({ profile, update, onClose, onUse }: Props) {
  const list = levels(profile), basicDone = list[0].done;
  const [view, setView] = useState<View>(() => basicDone ? { kind: 'list' } : { kind: 'letters' });
  const [unlocking, setUnlocking] = useState(false);
  const back = () => setView({ kind: 'list' });
  // Satzzeichen replace older versions (those were stretched to letter height); letters collect variants.
  const saveGlyph = (char: string, g: Glyph) => update(p => ({ ...p, glyphs: { ...p.glyphs, [char]: isPunctuation(char) ? [g] : [...(p.glyphs[char] || []).filter(item => item.source === 'pen').slice(-11), g] } }));
  const removeGlyph = (char: string, g: Glyph) => update(p => { const l = p.glyphs[char] || [], i = l.includes(g) ? l.indexOf(g) : l.map(x => x.source).lastIndexOf('pen'); return { ...p, glyphs: { ...p.glyphs, [char]: i < 0 ? l : l.filter((_, k) => k !== i) } }; });
  const batch = (glyphs: Record<string, Glyph[]>) => update(p => ({ ...p, glyphs: { ...p.glyphs, ...glyphs } }));

  if (view.kind === 'letters' || view.kind === 'signs')
    return <Training profile={profile} chars={view.kind === 'signs' ? SIGNS : undefined} onSave={saveGlyph} onRemove={removeGlyph} onBatchSave={batch} onClose={back} />;
  if (view.kind === 'rhythm')
    return <RhythmTraining onClose={back} onSave={(rhythm, words) => update(p => ({ ...p, rhythm, words: [...(p.words || []).filter(w => !w.id.startsWith('rhythm-')), ...words] }))} />;
  if (view.kind === 'pairs')
    return <PairTraining level={view.level} keys={view.keys} onClose={back} onSave={(key, sample) => update(p => ({ ...p, pairs: { ...p.pairs, [key]: [...(p.pairs?.[key] || []).slice(-5), sample] } }))} />;

  const start = (id: LevelId) => {
    if (id === 1) setView({ kind: 'letters' });
    else if (id === 2) setView({ kind: 'signs' });
    else if (id === 3) setView({ kind: 'rhythm' });
    else if (id === 4) setView({ kind: 'pairs', level: 4, keys: PAIRS_CORE.filter(k => !profile.pairs?.[k]?.length).concat(PAIRS_CORE.every(k => profile.pairs?.[k]?.length) ? PAIRS_CORE.slice(0, 10) : []) });
    else { const keys = nextPairs(profile, 10); setView({ kind: 'pairs', level: 5, keys: keys.length ? keys : PAIRS_CORE.slice(0, 10) }); }
  };
  const unlock = async () => { setUnlocking(true); try { if (await showRewardedAd()) update(p => ({ ...p, unlocked: true })); } finally { setUnlocking(false); } };
  const coverage = Math.round(pairCoverage(profile) * 100);
  // Sorted view: the one stage to do now, what is finished, what comes later.
  const reached = list.filter(l => l.done).length, allDone = list.every(l => l.done);
  const next = allDone ? list[4] : basicDone ? list.find(l => !l.done) : list[0];
  const finished = list.filter(l => l.done && l !== next), later = list.filter(l => !l.done && l !== next);

  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal lv-sheet" role="dialog" aria-modal="true" aria-labelledby="lv-title">
    <header className="lv-head"><div><span className="lv-eyebrow">Handschrift</span><h2 id="lv-title">{profile.name}</h2></div><button className="icon-button" aria-label="Schließen" onClick={onClose}><X size={20} /></button></header>
    <div className="lv-scroll">
      {basicDone && <Preview profile={profile} reached={reached} />}
      {next && <section className="lv-group" aria-labelledby="lv-next">
        <h3 id="lv-next" className="lv-group-title">{allDone ? 'Weiter verbessern' : 'Als Nächstes'}</h3>
        <div className="lv-item lv-next">
          <span className="lv-num">{next.id}</span>
          <div className="lv-body">
            <div className="lv-title"><strong>{next.title}</strong><span>{next.effort}</span></div>
            <p>{next.what}</p>
            {next.id >= 4 && basicDone && <p className="lv-note">{next.id === 4 ? `Schon verbunden: ${coverage} % aller Buchstabenübergänge eines typischen Textes.` : 'Jede Runde nimmt die wichtigsten fehlenden Verbindungen.'}</p>}
            {next.progress > 0 && <div className="lv-progress"><progress max={next.total} value={next.progress} /><span>{next.progress}/{next.total}</span></div>}
          </div>
          <div className="lv-action">
            {next.locked ? <button className="button primary" disabled={unlocking} onClick={unlock}><Play size={15} />{unlocking ? 'Video läuft …' : adsAvailable() ? 'Mit Video freischalten' : 'Freischalten'}</button>
              : <button className="button primary" onClick={() => start(next.id)}>{next.done ? (next.id === 5 ? 'Weitere 10' : 'Wiederholen') : next.progress ? 'Fortsetzen' : 'Starten'}</button>}
          </div>
        </div>
        {next.locked && <p className="lv-fine">Stufe 4 und 5 schaltest du einmalig mit einem kurzen, freiwilligen Werbevideo frei. Stufe 1–3 sind immer frei.</p>}
      </section>}
      {finished.length > 0 && <section className="lv-group" aria-labelledby="lv-done">
        <h3 id="lv-done" className="lv-group-title">Fertig</h3>
        <ul className="lv-rows done">{finished.map(l => <li key={l.id} className="lv-row">
          <span className="lv-dot done"><Check size={14} /></span><strong>{l.id} · {l.title}</strong><span className="lv-row-meta">{l.progress}/{l.total}</span>
          {!l.locked && <button className="text-button" onClick={() => start(l.id)}>{l.id === 5 ? 'Weitere 10' : 'Wiederholen'}</button>}
        </li>)}</ul>
      </section>}
      {later.length > 0 && <section className="lv-group" aria-labelledby="lv-later">
        <h3 id="lv-later" className="lv-group-title">Danach</h3>
        <ul className="lv-rows">{later.map(l => <li key={l.id} className="lv-row">
          <span className="lv-dot">{l.id}</span><strong>{l.title}</strong><span className="lv-row-meta">{l.effort}</span>
          {!basicDone ? <span className="lv-hint">Nach Stufe 1</span> : l.locked ? <span className="lv-hint"><Lock size={13} /> mit Stufe 4</span> : <button className="text-button" onClick={() => start(l.id)}>{l.progress ? 'Fortsetzen' : 'Starten'}</button>}
        </li>)}</ul>
      </section>}
    </div>
    <footer className="lv-foot"><button className="button" onClick={onClose}>Schließen</button>{basicDone && <button className="button primary" onClick={onUse}><PenLine size={16} />Im Studio verwenden</button>}</footer>
  </section></div>;
}

/** The same sentence in the current handwriting, so each stage shows its effect. */
function Preview({ profile, reached }: { profile: Profile; reached: number }) {
  const data = useMemo(() => {
    const note: Note = { id: 'preview', title: '', text: '', renderedText: 'Clara schreibt heute ihre Geschichte.', settings: { ...defaultSettings, profileId: profile.id, paper: 'blank', size: 26, lineStartShift: 0, marginLeft: 2, marginRight: 2 }, edits: {}, annotations: [], updated: '' };
    const g = layout(note, [profile]).glyphs.filter(x => x.page === 0), pts = g.flatMap(x => x.strokes.flat());
    if (!pts.length) return null;
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    return { paths: g.flatMap(x => x.strokes).map(s => pathData(s)), box: `${minX - 8} ${minY - 8} ${maxX - minX + 16} ${maxY - minY + 16}` };
  }, [profile]);
  if (!data) return null;
  return <figure className="lv-preview"><svg viewBox={data.box} aria-label="Beispielsatz in deiner Handschrift">{data.paths.map((d, i) => <path key={i} d={d} fill="none" stroke="#1c1d21" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />)}</svg><figcaption><span>So schreibt deine Handschrift gerade.</span><span>{reached} von 5 Stufen</span></figcaption></figure>;
}

/** Pointer handling for one writing pad: pencil writes, finger scrolls (unless allowed). */
function usePad(w: number, h: number, allowTouch: boolean) {
  const [strokes, setStrokes] = useState<Stroke[]>([]), [live, setLive] = useState<Stroke>([]), cur = useRef<Stroke | null>(null);
  const pts = (e: PointerEvent<SVGSVGElement>): Point[] => {
    const el = e.currentTarget, n = e.nativeEvent, evs = typeof n.getCoalescedEvents === 'function' && n.getCoalescedEvents().length ? n.getCoalescedEvents() : [n];
    return evs.map(ev => { const p = el.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(el.getScreenCTM()!.inverse()); return { x: Math.max(0, Math.min(w, q.x)), y: Math.max(0, Math.min(h, q.y)), p: ev.pressure || .5 }; });
  };
  const add = (s: Stroke, ps: Point[]) => { for (const p of ps) { const l = s.at(-1); if (!l || Math.hypot(p.x - l.x, p.y - l.y) > .2) s.push(p); } };
  return {
    strokes, live, setStrokes, clear: () => { setStrokes([]); setLive([]); },
    handlers: {
      onPointerDown: (e: PointerEvent<SVGSVGElement>) => { if (e.button !== 0 || (e.pointerType === 'touch' && !allowTouch)) return; e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } cur.current = []; add(cur.current, pts(e)); setLive([...cur.current]); },
      onPointerMove: (e: PointerEvent<SVGSVGElement>) => { if (!cur.current) return; e.preventDefault(); add(cur.current, pts(e)); setLive([...cur.current]); },
      onPointerUp: (e: PointerEvent<SVGSVGElement>) => { if (!cur.current) return; add(cur.current, pts(e)); const done = cur.current; cur.current = null; setStrokes(s => [...s, done]); setLive([]); },
      onPointerCancel: () => { cur.current = null; setLive([]); },
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
  };
}
const COLORS = ['#1c1d21', '#d0574a', '#2f7d5b'];

/** Stufe 4–5: letter pairs written together; the split between the letters is shown and adjustable. */
function PairTraining({ keys, level, onSave, onClose }: { keys: string[]; level: 4 | 5; onSave: (key: string, s: PairSample) => void; onClose: () => void }) {
  const [i, setI] = useState(0), [touch, setTouch] = useState(false), [nudge, setNudge] = useState<number[]>([]), [msg, setMsg] = useState('');
  const pad = usePad(900, 260, touch), key = keys[i], done = i >= keys.length;
  const sample = useMemo(() => { if (!pad.strokes.length || done) return null; try { const s = normalisePair(pad.strokes.map(x => smooth(x)), key); const cuts = s.cuts.map((c, k) => k === 0 || k === s.cuts.length - 1 ? c : Math.max(s.cuts[k - 1] + 4, Math.min(s.cuts[k + 1] - 4, c + (nudge[k] || 0)))); return { ...s, cuts }; } catch { return null; } }, [pad.strokes, key, nudge, done]);
  const parts = sample ? splitPair(sample, key) : null;
  const next = () => { if (!sample || !parts) return; onSave(key, sample); pad.clear(); setNudge([]); setMsg(`„${key}“ gespeichert.`); setI(n => n + 1); };
  const skip = () => { pad.clear(); setNudge([]); setMsg(`„${key}“ übersprungen.`); setI(n => n + 1); };
  return <div className="modal-backdrop"><section className="modal training-modal guided-training lv-train" role="dialog" aria-modal="true" aria-labelledby="pair-title">
    <header className="modal-header"><div><span className="eyebrow">STUFE {level} · {level === 4 ? 'VERBINDUNGEN' : 'FEINSCHLIFF'}</span><h2 id="pair-title">Buchstaben zusammen schreiben</h2><p>{Math.min(i, keys.length)}/{keys.length} geschafft</p></div><button className="icon-button" aria-label="Schließen" onClick={onClose}><X size={21} /></button></header>
    <div className="guided-progress"><progress max={keys.length} value={i} /><span>{Math.round(i / keys.length * 100)} %</span></div>
    {done ? <div className="guided-complete"><span className="complete-icon"><Check size={30} /></span><h3>Diese Runde ist geschafft.</h3><p>Deine Wörter verwenden ab jetzt diese Verbindungen so, wie du sie geschrieben hast.</p><div className="complete-actions"><button className="button primary" onClick={onClose}><Check size={17} />Zur Übersicht</button></div></div>
      : <div className="lv-pair">
        <div className="lv-pair-top"><div className="letter-prompt"><div><span>Schreibe zusammenhängend, wie in einem Wort</span><strong>{key}</strong></div></div><button className={`button touch-writing-toggle ${touch ? 'active' : ''}`} aria-pressed={touch} onClick={() => setTouch(t => !t)}><PenLine size={16} />{touch ? 'Finger schreibt mit' : 'Finger schreibt nicht'}</button></div>
        <svg viewBox="0 0 900 260" className="training-pad lv-pad" aria-label={`Zeichenfläche für ${key}`} {...pad.handlers}><rect width={900} height={260} fill="#fffefa" /><GuideLines x1={30} x2={870} top={50} zone={60} /><GuideText text={key} cx={450} top={50} zone={60} />{!pad.strokes.length && !pad.live.length && <text x={450} y={250} textAnchor="middle" fill="#9aa3b0" fontSize={13}>„{key}“ in einem Zug schreiben – so wie mitten in einem Wort</text>}{[...pad.strokes, pad.live].filter(s => s.length).map((s, k) => <path key={k} d={pathData(s)} fill="none" stroke="#243f62" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />)}</svg>
        <div className="lv-split">
          {parts && sample ? <>
            <svg viewBox={`-4 0 ${sample.width + 8} 104`} className="lv-split-view" aria-label="So wird getrennt">{parts.map((g, k) => { const off = sample.cuts[k]; return g.strokes.map((s, j) => <path key={`${k}-${j}`} d={pathData(s.map(p => ({ ...p, x: p.x + off })))} fill="none" stroke={COLORS[k % 3]} strokeWidth={2.4} strokeLinecap="round" />); })}{sample.cuts.slice(1, -1).map((c, k) => <line key={k} x1={c} x2={c} y1={0} y2={104} stroke="#9aa6b8" strokeDasharray="3 3" />)}</svg>
            <div className="lv-split-ctl"><span>Trennung zwischen den Buchstaben</span>{sample.cuts.slice(1, -1).map((_, k) => <span key={k} className="lv-nudge"><button aria-label="Trennung nach links" onClick={() => setNudge(n => { const m = [...n]; m[k + 1] = (m[k + 1] || 0) - 3; return m; })}><ChevronLeft size={18} /></button><button aria-label="Trennung nach rechts" onClick={() => setNudge(n => { const m = [...n]; m[k + 1] = (m[k + 1] || 0) + 3; return m; })}><ChevronRight size={18} /></button></span>)}</div>
          </> : <p className="lv-split-empty">Hier siehst du gleich, wo die App die Buchstaben trennt. Jede Farbe ist ein Buchstabe.</p>}
        </div>
        <div className="training-save"><button className="button" onClick={skip}>Überspringen</button><button className="text-button" disabled={!pad.strokes.length} onClick={() => pad.setStrokes(s => s.slice(0, -1))}><RotateCcw size={15} />Letzten Strich entfernen</button><p role="status">{msg}</p><button className="button primary" disabled={!parts} onClick={next}><PenLine size={17} />Speichern & weiter</button></div>
      </div>}
  </section></div>;
}

/** Stufe 3: three short sentences on lines; only rhythm measurements are taken from them. */
function RhythmTraining({ onSave, onClose }: { onSave: (r: NonNullable<Profile['rhythm']>, words: NonNullable<Profile['words']>) => void; onClose: () => void }) {
  const [touch, setTouch] = useState(false), [msg, setMsg] = useState(''), [done, setDone] = useState(false);
  const pads = [usePad(1000, 124, touch), usePad(1000, 124, touch), usePad(1000, 124, touch)];
  const evaluate = () => { try { const r = measureRhythm(pads.map(p => p.strokes.map(s => smooth(s)))); onSave(r.rhythm, r.words.map(w => ({ ...w, id: `rhythm-${uid()}` }))); setDone(true); } catch (e) { setMsg((e as Error).message); } };
  return <div className="modal-backdrop"><section className="modal training-modal guided-training lv-train" role="dialog" aria-modal="true" aria-labelledby="rhythm-title">
    <header className="modal-header"><div><span className="eyebrow">STUFE 3 · SCHREIBRHYTHMUS</span><h2 id="rhythm-title">Drei kurze Sätze</h2><p>Schreib so, wie du sonst auch schreibst – nicht schöner.</p></div><button className="icon-button" aria-label="Schließen" onClick={onClose}><X size={21} /></button></header>
    {done ? <div className="guided-complete"><span className="complete-icon"><Check size={30} /></span><h3>Stufe 3 geschafft.</h3><p>Wortabstand, Grundlinie und wie oft du Buchstaben verbindest kommen jetzt aus deiner Schrift.</p><div className="complete-actions"><button className="button primary" onClick={onClose}><Check size={17} />Zur Übersicht</button></div></div>
      : <div className="line-route">
        <div className="line-instructions"><div><h3>Ein Satz pro Zeile</h3><p>Lass zwischen den Wörtern so viel Platz wie sonst auch. Die Buchstaben werden hier nicht ausgeschnitten – die App misst nur deinen Rhythmus.</p></div><button className={`button touch-writing-toggle ${touch ? 'active' : ''}`} aria-pressed={touch} onClick={() => setTouch(t => !t)}><PenLine size={16} />{touch ? 'Finger schreibt mit' : 'Finger schreibt nicht'}</button></div>
        {RHYTHM_SENTENCES.map((text, k) => { const p = pads[k]; return <div className="calibration-row" key={text}>
          <div className="calibration-copy"><span>Satz {k + 1}</span><strong>{text}</strong></div>
          <div className="calibration-pad-wrap"><svg viewBox="0 0 1000 124" className="training-pad calibration-pad lv-line-pad" aria-label={`Satz ${k + 1}: ${text}`} {...p.handlers}><rect width={1000} height={124} fill="#fffefa" /><GuideLines x1={16} x2={984} top={26} zone={24} /><GuideText text={text} x={28} top={26} zone={24} maxWidth={900} />{[...p.strokes, p.live].filter(s => s.length).map((s, j) => <path key={j} d={pathData(s)} fill="none" stroke="#243f62" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />)}</svg><button className="icon-button clear-line" aria-label={`Letzten Strich in Satz ${k + 1} entfernen`} disabled={!p.strokes.length} onClick={() => p.setStrokes(s => s.slice(0, -1))}><RotateCcw size={17} /></button></div>
        </div>; })}
        <div className="training-save line-save"><button className="button" onClick={onClose}><ArrowLeft size={16} />Zurück</button><p role="status">{msg || 'Die Auswertung bleibt vollständig auf diesem Gerät.'}</p><button className="button primary" disabled={pads.some(p => !p.strokes.length)} onClick={evaluate}><ScanLine size={17} />Auswerten</button></div>
      </div>}
  </section></div>;
}
