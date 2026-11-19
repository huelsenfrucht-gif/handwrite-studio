import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Circle, FileText, Mic, Pause, Play, ScanLine, Square, Star, Trash2, X } from 'lucide-react';
import { clock, LANGUAGES, LectureRecorder, lectureSupported, lectureText, lectureTitle, paragraphs, timeOfDay, type Availability, type Lecture } from './lecture';

type Props = { onClose: () => void; onDocument: (title: string, text: string) => void };

/**
 * „Unterricht aufnehmen“: start a recording, leave the app if you like, and get the
 * lesson as text afterwards. Speech recognition runs on the iPad; nothing is uploaded.
 */
export function LectureSheet({ onClose, onDocument }: Props) {
  const [live, setLive] = useState<Lecture | null>(null);
  const [review, setReview] = useState<Lecture | null>(null);
  const [saved, setSaved] = useState<Lecture[]>([]);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [locale, setLocale] = useState('de-DE');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [times, setTimes] = useState(false);
  const native = lectureSupported();

  const refresh = async () => {
    if (!native) return;
    const [cur, list] = await Promise.all([LectureRecorder.current(), LectureRecorder.saved()]);
    setLive(cur.state === 'recording' || cur.state === 'paused' ? cur : null);
    setSaved(list.lessons.filter(l => l.passages.length || l.hasAudio));
  };
  useEffect(() => {
    if (!native) return;
    void refresh();
    const sub = LectureRecorder.addListener('change', l => setLive(l.state === 'recording' || l.state === 'paused' ? l : null));
    const wake = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', wake);
    return () => { void sub.then(s => s.remove()); document.removeEventListener('visibilitychange', wake); };
  }, [native]);
  useEffect(() => { if (native) void LectureRecorder.availability({ locale }).then(setAvail).catch(() => setAvail(null)); }, [native, locale]);

  const run = async (label: string, fn: () => Promise<void>) => { setBusy(label); setError(''); try { await fn(); } catch (e) { setError((e as Error).message || String(e)); } finally { setBusy(''); } };
  const start = () => run('Startet …', async () => {
    let a = avail;
    if (!a?.microphone || !a?.speech) { const r = await LectureRecorder.requestAccess(); if (!r.microphone || !r.speech) throw new Error('Ohne Zugriff auf Mikrofon und Spracherkennung geht es nicht. Du kannst ihn in den iPad-Einstellungen unter „Handwritten“ erlauben.'); a = await LectureRecorder.availability({ locale }); setAvail(a); }
    setLive(await LectureRecorder.start({ locale }));
  });
  const stop = () => run('Wird abgeschlossen …', async () => { const done = await LectureRecorder.stop(); setLive(null); setReview(done); });
  const toDocument = (l: Lecture) => run('Wird übernommen …', async () => {
    onDocument(lectureTitle(l), lectureText(l, { times }));
    if (l.id) await LectureRecorder.remove({ id: l.id }).catch(() => undefined);
  });
  const discard = (l: Lecture) => { if (!l.id || !confirm('Diese Aufnahme und ihren Text endgültig löschen?')) return; void run('', async () => { await LectureRecorder.remove({ id: l.id! }); setReview(r => r?.id === l.id ? null : r); await refresh(); }); };
  const fromAudio = (l: Lecture) => run('Text wird aus der Tonaufnahme erkannt …', async () => { if (l.id) setReview(await LectureRecorder.transcribeAudio({ id: l.id })); });

  const title = live ? 'Aufnahme läuft' : review ? 'Aufnahme fertig' : 'Unterricht aufnehmen';
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal lc-sheet" role="dialog" aria-modal="true" aria-labelledby="lc-title">
      <header className="lv-head"><div><span className="lv-eyebrow">Unterricht</span><h2 id="lc-title">{title}</h2></div>
        <button className="icon-button" aria-label={live ? 'Fenster schließen – die Aufnahme läuft weiter' : 'Schließen'} onClick={onClose}><X size={20} /></button></header>
      <div className="lc-body">
        {!native ? <p className="lc-note">Die Aufnahme ist nur in der iPad-App verfügbar.</p>
          : live ? <Recording live={live} busy={busy} onPause={() => run('', async () => setLive(await LectureRecorder.pause()))} onResume={() => run('', async () => setLive(await LectureRecorder.resume()))} onMark={() => run('', async () => { await LectureRecorder.mark(); setLive(await LectureRecorder.current()); })} onStop={stop} />
            : review ? <Review lecture={review} times={times} setTimes={setTimes} busy={busy} onUse={() => toDocument(review)} onDiscard={() => discard(review)} onAudio={() => fromAudio(review)} />
              : <Intro avail={avail} locale={locale} setLocale={setLocale} consent={consent} setConsent={setConsent} busy={busy} onStart={start} saved={saved} onOpen={setReview} onDelete={discard} />}
        {error && <p className="lc-error" role="alert"><AlertTriangle size={16} />{error}</p>}
      </div>
    </section>
  </div>;
}

function Intro(p: { avail: Availability | null; locale: string; setLocale: (l: string) => void; consent: boolean; setConsent: (v: boolean) => void; busy: string; onStart: () => void; saved: Lecture[]; onOpen: (l: Lecture) => void; onDelete: (l: Lecture) => void }) {
  const unavailable = p.avail && !p.avail.available;
  return <>
    <ul className="lc-points">
      <li><Mic size={18} /><span><strong>Starten und weiterarbeiten.</strong> Die Aufnahme läuft weiter, wenn du die App verlässt oder das iPad sperrst. Das Symbol oben am Bildschirmrand zeigt an, dass das Mikrofon aktiv ist.</span></li>
      <li><ScanLine size={18} /><span><strong>Text entsteht auf dem iPad.</strong> Die Spracherkennung arbeitet ohne Internet. Ton und Text verlassen das Gerät nicht.</span></li>
      <li><FileText size={18} /><span><strong>Danach in deiner Handschrift.</strong> Das Transkript wird ein normales Dokument, das du bearbeiten und in Handschrift umwandeln kannst.</span></li>
    </ul>
    <div className="lc-legal">
      <strong>Nur mit Erlaubnis aufnehmen</strong>
      <p>Gespräche dürfen in Deutschland nicht heimlich aufgenommen werden (§ 201 StGB). Frage vorher die Lehrkraft und alle, die zu hören sind, und beachte die Regeln deiner Schule.</p>
      <label className="lc-check"><input type="checkbox" checked={p.consent} onChange={e => p.setConsent(e.target.checked)} /><span>Alle, die zu hören sein werden, sind mit der Aufnahme einverstanden.</span></label>
    </div>
    <div className="lc-start">
      <label className="lc-lang">Sprache<select value={p.locale} onChange={e => p.setLocale(e.target.value)}>{LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
      <button className="button primary lc-rec" disabled={!p.consent || !!p.busy || !!unavailable} onClick={p.onStart}><Circle size={16} fill="currentColor" />{p.busy || 'Aufnahme starten'}</button>
    </div>
    {unavailable && <p className="lc-note">{p.avail!.reason || 'Die Spracherkennung ist auf diesem iPad nicht verfügbar.'}</p>}
    {p.avail?.engine === 'analyzer' && <p className="lc-fine">Beim ersten Mal lädt das iPad einmalig das Sprachpaket von Apple. Danach funktioniert alles ohne Internet.</p>}
    {p.saved.length > 0 && <section className="lv-group"><h3 className="lv-group-title">Noch nicht übernommen</h3>
      <ul className="lv-rows">{p.saved.map(l => <li key={l.id} className="lv-row">
        <span className="lv-dot"><Mic size={13} /></span><strong>{lectureTitle(l)}</strong><span className="lv-row-meta">{clock(l.duration)} · {l.passages.length ? `${paragraphs(l).length} Absätze` : 'nur Ton'}</span>
        <button className="text-button" onClick={() => p.onOpen(l)}>Öffnen</button>
        <button className="icon-button" aria-label="Aufnahme löschen" onClick={() => p.onDelete(l)}><Trash2 size={16} /></button>
      </li>)}</ul></section>}
  </>;
}

function Recording(p: { live: Lecture; busy: string; onPause: () => void; onResume: () => void; onMark: () => void; onStop: () => void }) {
  const { live } = p, paused = live.state === 'paused', list = useRef<HTMLOListElement>(null);
  const items = useMemo(() => paragraphs(live), [live]);
  // Count up smoothly between native updates.
  const [now, setNow] = useState(Date.now()), [base, setBase] = useState({ at: Date.now(), d: live.duration });
  useEffect(() => setBase({ at: Date.now(), d: live.duration }), [live.duration, live.state]);
  useEffect(() => { if (paused) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [paused]);
  const shown = paused ? live.duration : base.d + (now - base.at) / 1000;
  useEffect(() => { list.current?.lastElementChild?.scrollIntoView({ block: 'end' }); }, [items.length, live.volatile]);
  return <>
    <div className={`lc-status ${paused ? 'paused' : ''}`}>
      <span className="lc-dot" aria-hidden="true" /><span>{paused ? (live.reason === 'interrupted' ? 'Unterbrochen – z. B. durch einen Anruf' : 'Pausiert') : 'Aufnahme läuft'}</span>
      <output className="lc-time" aria-label="Aufnahmedauer">{clock(shown)}</output>
    </div>
    <ol className="lc-transcript" ref={list} aria-live="polite">
      {!items.length && !live.volatile && <li className="lc-empty">Sobald gesprochen wird, erscheint hier der Text.</li>}
      {items.map((it, i) => <li key={i} className={it.marked ? 'marked' : ''}><time>{timeOfDay(live.startedAt, it.start)}</time><p>{it.marked && <Star size={13} fill="currentColor" aria-label="markiert" />}{it.text}</p></li>)}
      {live.volatile && <li className="volatile"><time>…</time><p>{live.volatile}</p></li>}
    </ol>
    <p className="lc-fine">Du kannst die App jetzt verlassen oder das iPad sperren. Die Aufnahme läuft weiter, bis du sie beendest.</p>
    <div className="lc-actions">
      {paused ? <button className="button" onClick={p.onResume} disabled={!!p.busy}><Play size={16} />Fortsetzen</button> : <button className="button" onClick={p.onPause} disabled={!!p.busy}><Pause size={16} />Pausieren</button>}
      <button className="button" onClick={p.onMark} disabled={!!p.busy || paused}><Star size={16} />Wichtig markieren{live.markers.length ? ` (${live.markers.length})` : ''}</button>
      <span className="lc-gap" />
      <button className="button primary" onClick={p.onStop} disabled={!!p.busy}><Square size={15} fill="currentColor" />{p.busy || 'Beenden'}</button>
    </div>
  </>;
}

function Review(p: { lecture: Lecture; times: boolean; setTimes: (v: boolean) => void; busy: string; onUse: () => void; onDiscard: () => void; onAudio: () => void }) {
  const items = paragraphs(p.lecture), empty = !items.length;
  return <>
    <p className="lc-summary"><strong>{lectureTitle(p.lecture)}</strong> · {clock(p.lecture.duration)} · {empty ? 'kein Text erkannt' : `${items.length} Absätze${p.lecture.markers.length ? `, ${p.lecture.markers.length} markiert` : ''}`}</p>
    {empty ? <div className="lc-note"><p>Es wurde kein Text erkannt. Wenn die Tonaufnahme vorhanden ist, kann das iPad den Text jetzt daraus erkennen.</p>
      {p.lecture.hasAudio !== false && <button className="button" onClick={p.onAudio} disabled={!!p.busy}><ScanLine size={16} />{p.busy || 'Text aus der Tonaufnahme erkennen'}</button>}</div>
      : <ol className="lc-transcript review">{items.map((it, i) => <li key={i} className={it.marked ? 'marked' : ''}><time>{timeOfDay(p.lecture.startedAt, it.start)}</time><p>{it.marked && <Star size={13} fill="currentColor" aria-label="markiert" />}{it.text}</p></li>)}</ol>}
    <label className="lc-check"><input type="checkbox" checked={p.times} onChange={e => p.setTimes(e.target.checked)} /><span>Uhrzeiten vor jedem Absatz übernehmen</span></label>
    <p className="lc-fine">Beim Übernehmen wird die Tonaufnahme von diesem iPad gelöscht; der Text bleibt als Dokument erhalten.</p>
    <div className="lc-actions">
      <button className="button" onClick={p.onDiscard} disabled={!!p.busy}><Trash2 size={16} />Verwerfen</button>
      <span className="lc-gap" />
      <button className="button primary" onClick={p.onUse} disabled={!!p.busy || empty}><Check size={16} />{p.busy || 'Als Dokument übernehmen'}</button>
    </div>
  </>;
}

/** Small reminder in the corner while a recording runs and the sheet is closed. */
export function LecturePill({ onOpen }: { onOpen: () => void }) {
  const [live, setLive] = useState<Lecture | null>(null);
  useEffect(() => {
    if (!lectureSupported()) return;
    const pick = (l: Lecture) => setLive(l.state === 'recording' || l.state === 'paused' ? l : null);
    void LectureRecorder.current().then(pick).catch(() => undefined);
    const sub = LectureRecorder.addListener('change', pick);
    const wake = () => { if (document.visibilityState === 'visible') void LectureRecorder.current().then(pick).catch(() => undefined); };
    document.addEventListener('visibilitychange', wake);
    return () => { void sub.then(s => s.remove()); document.removeEventListener('visibilitychange', wake); };
  }, []);
  if (!live) return null;
  return <button className={`lc-pill ${live.state === 'paused' ? 'paused' : ''}`} onClick={onOpen}><span className="lc-dot" aria-hidden="true" />{live.state === 'paused' ? 'Aufnahme pausiert' : 'Aufnahme läuft'} · {clock(live.duration)}</button>;
}
