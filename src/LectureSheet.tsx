import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, AudioLines, Check, Sparkles, ChevronDown, ChevronLeft, ChevronRight, Download, Lock, Mic, Pause, PenLine, Play, RotateCw, Save, Star, Trash2, X } from 'lucide-react';
import { download, safeName } from './export';
import { adFreeUntil, adsAvailable, showInterstitialAd } from './nativeAds';
import { clock, LANGUAGES, LectureRecorder, lectureSupported, lectureText, lectureTitle, paragraphs, ROOMS, timeOfDay, type Availability, type Lecture, type Room } from './lecture';
import { SUBJECTS, subjectTerms } from './subjects';

type Props = { onClose: () => void; onDocument: (title: string, text: string) => void; notify?: (s: string) => void };
const running = (l: Lecture | null | undefined) => !!l && (l.state === 'recording' || l.state === 'paused');
const stored = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };
const roomLabel = (r?: string) => ROOMS.find(x => x.id === r)?.label;
const langLabel = (l?: string) => LANGUAGES.find(x => x.id === l)?.label;
const subjectLabel = (s?: string) => s && s !== 'general' ? SUBJECTS.find(x => x.id === s)?.label : undefined;
const shortDate = (l: Pick<Lecture, 'startedAt'>) => new Date(l.startedAt || Date.now()).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

/** The running transcription (or null), kept up to date from the native recorder. */
export function useLiveLecture() {
  const [live, setLive] = useState<Lecture | null>(null);
  useEffect(() => {
    if (!lectureSupported()) return;
    const pick = (l: Lecture) => setLive(running(l) ? l : null);
    const read = () => { void LectureRecorder.current().then(pick).catch(() => undefined); };
    read();
    const sub = LectureRecorder.addListener('change', pick);
    const wake = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', wake);
    return () => { void sub.then(s => s.remove()); document.removeEventListener('visibilitychange', wake); };
  }, []);
  return [live, setLive] as const;
}

/** Duration that counts up smoothly between the native updates. */
function useTicking(l: Lecture) {
  const paused = l.state !== 'recording', [now, setNow] = useState(Date.now()), base = useRef({ at: Date.now(), d: l.duration });
  useEffect(() => { base.current = { at: Date.now(), d: l.duration }; }, [l.duration, l.state]);
  useEffect(() => { if (paused) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [paused]);
  return paused ? l.duration : base.current.d + (now - base.current.at) / 1000;
}

/** Recent input levels (newest last) for the waveforms. */
function useLevels(l: Lecture, count: number) {
  const [levels, setLevels] = useState<number[]>(() => Array(count).fill(0));
  useEffect(() => { if (l.state === 'recording') setLevels(v => [...v.slice(1 - count), Math.max(.04, Math.min(1, (l.level || 0) * 1.6))]); }, [l.level, l.duration, l.state, count]);
  return levels;
}

/** The last thing that was said, for the banner on the home screen. */
function lastWords(l: Lecture) {
  const text = (l.volatile || paragraphs(l).at(-1)?.text || '').trim();
  return text.length > 110 ? `… ${text.slice(-110).replace(/^\S*\s/, '')}` : text;
}

/**
 * „Transkribieren“: start, leave the app if you like, and get the spoken text as a
 * document afterwards. Speech recognition runs on the iPad; nothing is uploaded.
 */
export function LectureSheet({ onClose, onDocument, notify }: Props) {
  const [live, setLive] = useLiveLecture();
  const [review, setReview] = useState<Lecture | null>(null);
  const [saved, setSaved] = useState<Lecture[]>([]);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [locale, setLocale] = useState(() => stored('hs-tr-locale', 'de-DE'));
  const [room, setRoom] = useState<Room>(() => stored('hs-tr-room', 'classroom') as Room);
  const [subject, setSubject] = useState(() => stored('hs-tr-subject', 'general'));
  const [consent, setConsent] = useState(false);
  const [liveText, setLiveText] = useState(() => stored('hs-tr-live', 'on') !== 'off');
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const native = lectureSupported();

  const refreshSaved = async () => { if (native) setSaved((await LectureRecorder.saved()).lessons.filter(l => l.passages.length || l.hasAudio)); };
  useEffect(() => { void refreshSaved(); }, [native]);
  useEffect(() => { if (native) void LectureRecorder.availability({ locale }).then(setAvail).catch(() => setAvail(null)); }, [native, locale]);

  const run = async (label: string, fn: () => Promise<void>) => { setBusy(label); setError(''); try { await fn(); } catch (e) { setError((e as Error).message || String(e)); } finally { setBusy(''); } };
  const start = () => run('Wird gestartet …', async () => {
    remember('hs-tr-locale', locale); remember('hs-tr-room', room); remember('hs-tr-subject', subject); remember('hs-tr-live', liveText ? 'on' : 'off');
    let a = avail;
    if (!a?.microphone || !a?.speech) {
      const r = await LectureRecorder.requestAccess();
      if (!r.microphone || !r.speech) throw new Error('Ohne Mikrofon und Spracherkennung geht es nicht. Du kannst beides in den iPad-Einstellungen unter „Handwritten“ erlauben.');
      a = await LectureRecorder.availability({ locale }); setAvail(a);
    }
    // The microphone normally starts at once; say so clearly if the system keeps it blocked.
    const slow = setTimeout(() => setError('Das Mikrofon startet gerade nicht. Schließe andere Apps, die das Mikrofon nutzen (z. B. Anrufe oder Sprachmemos), und versuche es erneut.'), 12000);
    // A short ad before the recording starts (the app is free); never blocks the start.
    if (adsAvailable() && Date.now() >= adFreeUntil()) { setBusy('Kurze Werbung …'); await showInterstitialAd(); setBusy('Wird gestartet …'); }
    const terms = [...new Set([...subjectTerms(subject), ...(subject === 'general' ? [] : subjectTerms('general'))])].slice(0, 90);
    try { setLive(await LectureRecorder.start({ locale, room, subject, terms, live: liveText })); setError(''); } finally { clearTimeout(slow); }
  });
  const stop = () => run('Wird abgeschlossen …', async () => {
    const done = await LectureRecorder.stop(); setLive(null); setReview(done);
    // Live text was off (or not ready): recognise the recording now, quickly with the iPad's own recogniser.
    if (done.id && done.hasAudio !== false && (!done.passages.length || done.missedText)) { setBusy('Text wird erkannt …'); try { setReview(await LectureRecorder.transcribeAudio({ id: done.id })); } catch { /* keep the recording; the buttons can retry */ } }
  });
  const toDocument = (l: Lecture, opts: { times: boolean; marks: boolean }) => run('Wird übernommen …', async () => {
    onDocument(lectureTitle(l), lectureText(l, opts));
    if (l.id) await LectureRecorder.remove({ id: l.id }).catch(() => undefined);
  });
  const discard = (l: Lecture) => { if (!l.id || !confirm('Dieses Transkript und die Tonaufnahme endgültig löschen?')) return; void run('', async () => { await LectureRecorder.remove({ id: l.id! }); setReview(r => r?.id === l.id ? null : r); await refreshSaved(); }); };
  const exportText = (l: Lecture, opts: { times: boolean; marks: boolean }) => run('Wird exportiert …', async () => { await download(lectureText(l, opts), `${safeName(lectureTitle(l))}.txt`, 'text/plain'); exported.current = l.id || null; });
  // Everything is already stored on the iPad; leaving keeps the transcript for later.
  // After an export the recording is no longer needed: it goes when the transcript is left (it can be large).
  const exported = useRef<string | null>(null);
  const dropAudio = async (l: Lecture) => { if (l.id && l.hasAudio !== false) await LectureRecorder.remove({ id: l.id, audioOnly: true }).catch(() => undefined); };
  const keep = () => { if (review && exported.current === review.id) void dropAudio(review); exported.current = null; onClose(); notify?.('Transkript gespeichert. Du findest es unter „Transkribieren“.'); };
  const deleteAudio = (l: Lecture) => { if (!confirm('Tonaufnahme löschen? Der Text bleibt erhalten, kann danach aber nicht mehr neu erkannt werden.')) return; void run('', async () => { await LectureRecorder.remove({ id: l.id!, audioOnly: true }); setReview({ ...l, hasAudio: false, audioMB: 0 }); notify?.('Tonaufnahme gelöscht.'); }); };
  const [accurate, setAccurate] = useState<{ phase: string; progress: number } | null>(null);
  const fromWhisper = async (l: Lecture) => {
    if (!l.id || l.hasAudio === false) return;
    const pw = await LectureRecorder.power().catch(() => null);
    if (pw && !pw.charging && (pw.level < 0.3 || pw.lowPower) && !confirm(`Genau erkennen braucht einige Minuten viel Strom${pw.level < 1 ? ` (Akku ${Math.round(pw.level * 100)} %)` : ''}. Am besten schließt du das iPad vorher ans Ladekabel an.\n\nTrotzdem jetzt starten?`)) return;
    const st = await LectureRecorder.accurateStatus().catch(() => null);
    if (st && !st.downloaded && !confirm(`Für die genaue Erkennung lädt das iPad einmalig ein Sprachmodell (ca. ${(st.sizeMB / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB). Am besten im WLAN. Danach funktioniert es ohne Internet.\n\nJetzt laden?`)) return;
    const sub = await LectureRecorder.addListener('accurate', p => setAccurate(p));
    setAccurate({ phase: st?.downloaded ? 'load' : 'download', progress: 0 });
    await run('Wird genau erkannt …', async () => { setReview(await LectureRecorder.transcribeAccurate({ id: l.id! })); notify?.('Genau erkannt.'); });
    void sub.remove(); setAccurate(null);
  };
  const fromAudio = (l: Lecture) => run('Wird neu erkannt …', async () => { if (l.id && l.hasAudio !== false) setReview(await LectureRecorder.transcribeAudio({ id: l.id })); });

  const err = error && <p className="tr-error" role="alert"><AlertTriangle size={16} />{error}</p>;
  if (native && live) return <Live live={live} busy={busy} error={err} onBack={onClose}
    onPause={() => run('', async () => setLive(await LectureRecorder.pause()))} onResume={() => run('', async () => setLive(await LectureRecorder.resume()))}
    onMark={() => run('', async () => { await LectureRecorder.mark(); setLive(await LectureRecorder.current()); })} onStop={stop} />;
  if (native && review) return <Review lecture={review} busy={busy} error={err} onBack={keep} onSave={keep} onExport={o => exportText(review, o)} onUse={o => toDocument(review, o)} onDiscard={() => discard(review)} onAudio={() => fromAudio(review)} onWhisper={() => void fromWhisper(review)} onDeleteAudio={() => deleteAudio(review)} accurate={accurate} />;

  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal lv-sheet tr-sheet" role="dialog" aria-modal="true" aria-labelledby="tr-title">
      {!native ? <><header className="lv-head"><div><span className="lv-eyebrow">Transkribieren</span><h2 id="tr-title">Neues Transkript</h2></div><button className="icon-button" aria-label="Schließen" onClick={onClose}><X size={20} /></button></header><div className="tr-body"><p className="tr-sub">Transkribieren ist in der iPad-App verfügbar.</p></div></>
        : <Intro liveText={liveText} setLiveText={setLiveText} avail={avail} locale={locale} setLocale={setLocale} room={room} setRoom={setRoom} subject={subject} setSubject={setSubject} consent={consent} setConsent={setConsent} busy={busy} onStart={start} onCancel={onClose} saved={saved} onOpen={setReview} onDelete={discard} error={err} />}
      {!native && err}
    </section>
  </div>;
}

function Intro(p: { liveText: boolean; setLiveText: (v: boolean) => void; avail: Availability | null; locale: string; setLocale: (l: string) => void; room: Room; setRoom: (r: Room) => void; subject: string; setSubject: (s: string) => void; consent: boolean; setConsent: (v: boolean) => void; busy: string; onStart: () => void; onCancel: () => void; saved: Lecture[]; onOpen: (l: Lecture) => void; onDelete: (l: Lecture) => void; error: ReactNode }) {
  const unavailable = p.avail && !p.avail.available;
  return <div className="tr-simple">
    <button className="icon-button tr-close" aria-label="Schließen" onClick={p.onCancel}><X size={20} /></button>
    <div className="tr-hero">
      <span className="tr-hero-icon"><Mic size={26} strokeWidth={1.8} /></span>
      <h2 id="tr-title">Neues Transkript</h2>
      <p>Nimm den Unterricht auf. Der Text erscheint, während gesprochen wird.</p>
    </div>
    <label className="tr-field"><span>Fach</span>
      <span className="tr-select"><select value={p.subject} onChange={e => p.setSubject(e.target.value)}>{SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><ChevronDown size={18} /></span>
    </label>
    <details className="tr-more">
      <summary><span>Weitere Einstellungen</span><small>{langLabel(p.locale)} · {roomLabel(p.room)}{p.liveText ? '' : ' · Live-Text aus'}</small><ChevronDown size={18} /></summary>
      <div className="tr-more-body">
        <label className="tr-field small"><span>Sprache</span><span className="tr-select"><select value={p.locale} onChange={e => p.setLocale(e.target.value)}>{LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select><ChevronDown size={16} /></span></label>
        <div className="tr-field small"><span>Raum</span>
          <div className="tr-segment" role="radiogroup" aria-label="Raum">{ROOMS.map(r => <button key={r.id} role="radio" aria-checked={p.room === r.id} className={p.room === r.id ? 'on' : ''} onClick={() => p.setRoom(r.id)}>{r.label}</button>)}</div>
          <small>{ROOMS.find(r => r.id === p.room)?.hint}</small>
        </div>
        <label className="tr-field small tr-switch-row"><span>Live-Text während der Aufnahme<small>Aus spart Akku. Der Text wird dann direkt nach der Aufnahme erkannt.</small></span><input type="checkbox" className="st-switch" checked={p.liveText} onChange={e => p.setLiveText(e.target.checked)} /></label>
      </div>
    </details>
    {unavailable && <p className="tr-sub">{p.avail!.reason || 'Die Spracherkennung ist auf diesem iPad nicht verfügbar.'}</p>}
    <label className="tr-consent"><input type="checkbox" checked={p.consent} onChange={e => p.setConsent(e.target.checked)} />
      <span><strong>Alle Anwesenden sind einverstanden</strong><small>Niemand darf heimlich aufgenommen werden (§ 201 StGB).</small></span></label>
    {p.error}
    <button className="tr-start big" disabled={!p.consent || !!p.busy || !!unavailable} onClick={p.onStart}><span className="tr-rec-dot" aria-hidden="true" />{p.busy || 'Aufnahme starten'}</button>
    <p className="tr-tip">Leg das iPad einfach vor dich auf den Tisch. Es hört über die Rückseite nach vorne zur Tafel.</p>
    {p.saved.length > 0 && <details className="tr-more">
      <summary><span>Gespeicherte Transkripte</span><small>{p.saved.length}</small><ChevronDown size={18} /></summary>
      <div className="tr-saved">{p.saved.map(l => <div key={l.id} className="tr-saved-row">
        <span className="tr-saved-icon"><AudioLines size={16} /></span>
        <button onClick={() => p.onOpen(l)}><strong>{lectureTitle(l)}</strong><small>{clock(l.duration)} · {l.passages.length ? (paragraphs(l).length === 1 ? '1 Absatz' : `${paragraphs(l).length} Absätze`) : 'nur Ton'}{l.hasAudio ? ((l.audioMB || 0) >= 1 ? ` · Ton ${Math.round(l.audioMB!)} MB` : ' · mit Ton') : ''}</small></button>
        <button className="tr-round small" aria-label="Transkript löschen" onClick={() => p.onDelete(l)}><Trash2 size={16} /></button>
      </div>)}</div>
    </details>}
  </div>;
}

const LIVE_BARS = 64;
function Live(p: { live: Lecture; busy: string; error: ReactNode; onBack: () => void; onPause: () => void; onResume: () => void; onMark: () => void; onStop: () => void }) {
  const { live } = p, paused = live.state === 'paused', shown = useTicking(live), levels = useLevels(live, LIVE_BARS);
  const [follow, setFollow] = useState(() => stored('hs-tr-follow', '1') === '1');
  const items = useMemo(() => paragraphs(live), [live]);
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [items.length, live.volatile, follow]);
  // About 0.2 s per bar: markers from the last few seconds are shown on the timeline.
  const span = LIVE_BARS * .2, marks = live.markers.filter(t => t > live.duration - span).map(t => 1 - (live.duration - t) / span);
  const status = paused ? (live.reason === 'interrupted' ? 'Unterbrochen, z. B. durch einen Anruf' : 'Pausiert')
    : live.prep === 'loading' ? `Sprachpaket wird geladen${live.progress ? ` · ${Math.round(live.progress * 100)} %` : ' …'} · Ton wird schon aufgenommen`
      : live.prep === 'unavailable' || live.prep === 'off' ? 'Nimmt auf · Text wird nach dem Beenden erkannt' : 'Nimmt auf';
  const meta = [langLabel(live.locale), subjectLabel(live.subject), roomLabel(live.room)].filter(Boolean).join(' · ');
  return <div className="tr-screen" role="dialog" aria-modal="true" aria-label="Transkription läuft">
    <header className="tr-top">
      <button className="tr-round ghost" onClick={p.onBack} aria-label="Zurück – die Transkription läuft weiter"><ChevronLeft size={24} /></button>
      <span className="tr-gap" />
      {meta && <span className={`tr-chip ${paused ? 'paused' : ''}`}><span className="tr-rec-dot" aria-hidden="true" />{meta}</span>}
    </header>
    <main className="tr-text" ref={scroller}>
      <div className="tr-doc">
        <div className="tr-doc-head"><h1>Transkript · {shortDate(live)}</h1><span>Seit {timeOfDay(live.startedAt, 0)}{live.markers.length ? ` · ${live.markers.length} markiert` : ''}</span></div>
        {!follow ? <p className="tr-hidden">Der Text ist ausgeblendet. Die Aufnahme läuft weiter.</p>
          : !items.length && !live.volatile ? <p className="tr-hidden">{live.prep === 'off' ? 'Live-Text ist aus, um Akku zu sparen. Die Aufnahme läuft, der Text wird direkt nach dem Beenden erkannt.' : live.prep === 'loading' ? 'Der Text erscheint, sobald die Spracherkennung bereit ist. Bis dahin wird alles aufgenommen.' : 'Sobald gesprochen wird, erscheint hier der Text.'}</p>
            : <>{items.map((it, i) => <div key={i} className={`tr-para ${it.marked ? 'marked' : ''}`}><time>{timeOfDay(live.startedAt, it.start)}</time><p>{it.text}{i === items.length - 1 && !live.volatile && !paused && <span className="tr-caret" />}</p></div>)}
              {live.volatile && <div className="tr-para"><time>{items.length ? '' : timeOfDay(live.startedAt, live.duration)}</time><p><span className="tr-volatile">{live.volatile}</span>{!paused && <span className="tr-caret" />}</p></div>}</>}
      </div>
    </main>
    <section className="tr-panel">
      <div className="tr-clockrow"><output className="tr-clock" aria-label="Dauer">{clock(shown)}</output><span>{status}</span></div>
      <div className="tr-timeline" aria-hidden="true">
        <div className="tr-wave">{levels.map((v, i) => <i key={i} style={{ height: `${Math.round(6 + v * 50)}px`, opacity: .35 + .65 * (i / LIVE_BARS) }} />)}
          {marks.map((x, i) => <b key={i} style={{ left: `${x * 100}%` }}><Star size={11} fill="currentColor" /></b>)}</div>
        <span className={`tr-now ${paused ? 'paused' : ''}`} />
        <div className="tr-future" />
      </div>
      <div className="tr-controls">
        {live.prep === 'off' ? <span className="tr-toggle-gap" /> : <button className={`tr-toggle ${follow ? 'on' : ''}`} role="switch" aria-checked={follow} onClick={() => { setFollow(!follow); remember('hs-tr-follow', follow ? '0' : '1'); }}>Text mitlesen<span className="tr-switch" /></button>}
        <div className="tr-buttons">
          {paused ? <button className="tr-round outline" onClick={p.onResume} disabled={!!p.busy} aria-label="Fortsetzen" title="Fortsetzen"><Play size={24} fill="currentColor" /></button>
            : <button className="tr-round outline" onClick={p.onPause} disabled={!!p.busy} aria-label="Pausieren" title="Pausieren"><Pause size={24} fill="currentColor" /></button>}
          <button className="tr-stop" onClick={p.onStop} disabled={!!p.busy} aria-label="Beenden" title="Beenden"><span /></button>
          <button className="tr-round dark" onClick={p.onMark} disabled={!!p.busy || paused} aria-label="Stelle als wichtig markieren" title="Wichtig markieren"><Star size={24} /></button>
        </div>
        <span className="tr-lock">{p.busy || <><Lock size={15} />Läuft auch bei gesperrtem iPad</>}</span>
      </div>
      {p.error}
    </section>
  </div>;
}

function Review(p: { lecture: Lecture; busy: string; error: ReactNode; onBack: () => void; onSave: () => void; onExport: (o: { times: boolean; marks: boolean }) => void; onUse: (o: { times: boolean; marks: boolean }) => void; onDiscard: () => void; onAudio: () => void; onWhisper: () => void; onDeleteAudio: () => void; accurate: { phase: string; progress: number } | null }) {
  const l = p.lecture, items = paragraphs(l), empty = !items.length, canAudio = l.hasAudio !== false;
  const [times, setTimes] = useState(false), [marks, setMarks] = useState(true), [next, setNext] = useState(false);
  useEffect(() => { if (!next) return; const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.tr-next')) setNext(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, [next]);
  const end = l.startedAt ? timeOfDay(l.startedAt, l.duration) : '';
  return <div className="tr-screen review" role="dialog" aria-modal="true" aria-label="Transkript fertig">
    <header className="tr-top">
      <button className="tr-round ghost" onClick={p.onBack} aria-label="Zurück"><ChevronLeft size={24} /></button>
      <span className="tr-gap" />
      <button className="tr-pillbtn" onClick={p.onDiscard} disabled={!!p.busy}>Verwerfen</button>
      <div className="tr-next">
        <button className="tr-pillbtn primary" onClick={() => setNext(!next)} disabled={!!p.busy} aria-haspopup="menu" aria-expanded={next}>{p.busy || 'Weiter'}<ChevronRight size={17} /></button>
        {next && <div className="tr-menu" role="menu">
          <button role="menuitem" disabled={empty} onClick={() => { setNext(false); p.onUse({ times, marks }); }}><PenLine size={19} /><span><strong>In Handschrift übernehmen</strong><small>Als Dokument öffnen und in deiner Schrift schreiben</small></span></button>
          <button role="menuitem" disabled={empty} onClick={() => { setNext(false); p.onExport({ times, marks }); }}><Download size={19} /><span><strong>Als Text exportieren</strong><small>Textdatei teilen oder in „Dateien“ sichern</small></span></button>
          <button role="menuitem" onClick={() => { setNext(false); p.onSave(); }}><Save size={19} /><span><strong>Speichern</strong><small>Für später behalten</small></span></button>
        </div>}
      </div>
    </header>
    <div className="tr-review">
      <main className="tr-text">
        <div className="tr-doc">
          <div className="tr-doc-head"><h1>Transkript · {shortDate(l)}</h1><span>{timeOfDay(l.startedAt, 0)}{end ? `–${end}` : ''} · {clock(l.duration)} · {empty ? 'noch kein Text' : `${items.length === 1 ? "1 Absatz" : `${items.length} Absätze`}`}{l.markers.length ? ` · ${l.markers.length} markiert` : ''}{l.accurate ? ' · genau erkannt' : ''}</span></div>
          {p.busy === 'Text wird erkannt …' ? <p className="tr-hidden">Der Text wird gerade aus der Aufnahme erkannt. Das dauert meist nur wenige Sekunden.</p> : (empty || l.missedText) && canAudio && !l.accurate && <p className="tr-hidden">{empty ? 'Während der Aufnahme konnte noch kein Text erkannt werden.' : 'Ein Teil wurde aufgenommen, bevor die Spracherkennung bereit war.'} Tippe rechts auf „Genau erkennen“.</p>}
          {items.map((it, i) => <div key={i} className={`tr-para ${it.marked ? 'marked' : ''}`}><time>{timeOfDay(l.startedAt, it.start)}</time><p>{it.text}</p></div>)}
        </div>
      </main>
      <aside className="tr-aside">
        <section className={`tr-card ${canAudio ? '' : 'no-audio'}`}>
          <h3>Text verbessern</h3>
          <p className="tr-state">{!canAudio ? 'Tonaufnahme gelöscht: Der Text kann nicht mehr neu erkannt werden.' : l.accurate ? <><Check size={15} />Mit dem großen Sprachmodell erkannt</> : empty ? 'Noch kein Text erkannt' : 'Jetzt: schnelle Erkennung des iPads'}</p>
          {p.accurate ? <div className="tr-progress" role="status">
            <strong>{{ download: 'Sprachmodell wird geladen', load: 'Sprachmodell wird vorbereitet', transcribe: 'Wird genau erkannt', done: 'Fertig' }[p.accurate.phase] || 'Wird genau erkannt'}{p.accurate.phase !== 'load' ? ` · ${Math.round(p.accurate.progress * 100)} %` : ' …'}</strong>
            <span className="tr-bar"><i style={{ width: `${p.accurate.phase === 'load' ? 100 : Math.max(3, p.accurate.progress * 100)}%` }} className={p.accurate.phase === 'load' ? 'busy' : ''} /></span>
            <small>{p.accurate.phase === 'download' ? 'Nur beim ersten Mal. Danach geht es ohne Internet.' : p.accurate.phase === 'load' ? 'Beim ersten Mal kann das ein paar Minuten dauern.' : 'Lass die App dabei geöffnet.'}</small>
          </div> : <div className="tr-choices">
            <button className="tr-redo strong" onClick={p.onWhisper} disabled={!!p.busy || !canAudio}><Sparkles size={17} /><span><strong>Genau erkennen</strong><small>Am genauesten, dauert einige Minuten</small></span></button>
            <button className="tr-redo strong" onClick={p.onAudio} disabled={!!p.busy || !canAudio}><RotateCw size={17} /><span><strong>Schnell neu erkennen</strong><small>In wenigen Sekunden</small></span></button>
          </div>}
        </section>
        <details className="tr-more">
          <summary><span>Beim Übernehmen</span><small>{[times && 'Uhrzeiten', marks && '„Wichtig:“'].filter(Boolean).join(' · ') || 'nur Text'}</small><ChevronDown size={18} /></summary>
          <div className="tr-more-body tr-rows">
            <label className="tr-row"><span>Uhrzeiten vor Absätzen</span><input type="checkbox" checked={times} onChange={e => setTimes(e.target.checked)} /></label>
            <label className="tr-row"><span>„Wichtig:“ vor markierten</span><input type="checkbox" checked={marks} onChange={e => setMarks(e.target.checked)} /></label>
          </div>
        </details>
        {canAudio && <div className="tr-audio">
          <div className="tr-audio-head"><AudioLines size={17} /><strong>Tonaufnahme{(l.audioMB || 0) >= 1 ? ` · ${Math.round(l.audioMB!)} MB` : ''}</strong><button className="tr-pillbtn" onClick={p.onDeleteAudio} disabled={!!p.busy || !!p.accurate}>Löschen</button></div>
          <small>Wird gelöscht, sobald du übernimmst oder exportierst, sonst nach 7 Tagen. Der Text bleibt.</small>
        </div>}
        {p.error}
      </aside>
    </div>
  </div>;
}

/** Shown in the studio while a transcription runs and its screen is closed. */
export function LecturePill({ onOpen }: { onOpen: () => void }) {
  const [live] = useLiveLecture();
  if (!live) return null;
  return <LiveBadge live={live} className="tr-pill" onOpen={onOpen} />;
}

/** Small red dot, state and running time. */
export function LiveBadge({ live, onOpen, className }: { live: Lecture; onOpen: () => void; className: string }) {
  const shown = useTicking(live), paused = live.state === 'paused';
  return <button className={`${className} ${paused ? 'paused' : ''}`} onClick={onOpen} aria-label={`${paused ? 'Transkription pausiert' : 'Transkription läuft'}, ${clock(shown)} – öffnen`}>
    <span className="tr-rec-dot" aria-hidden="true" /><span>{paused ? 'Pausiert' : 'Transkription läuft'}</span><b>{clock(shown)}</b>
  </button>;
}

/** The bar at the top of the home screen while a transcription runs. */
export function LiveBanner({ live, onOpen }: { live: Lecture; onOpen: () => void }) {
  const shown = useTicking(live), paused = live.state === 'paused', levels = useLevels(live, 12), words = lastWords(live);
  const [flash, setFlash] = useState(false);
  const meta = [subjectLabel(live.subject), roomLabel(live.room)].filter(Boolean).join(' · ');
  const act = (fn: () => Promise<unknown>) => { void fn().catch(() => undefined); };
  return <div className={`tr-banner ${paused ? 'paused' : ''}`}>
    <button className="tr-banner-main" onClick={onOpen} aria-label="Transkription öffnen">
      <span className="tr-banner-dot"><span className="tr-rec-dot" /></span>
      <span className="tr-banner-text">
        <span><strong>{paused ? 'Transkription pausiert' : 'Transkription läuft'}</strong><b>{clock(shown)}</b>{meta && <small>{meta}</small>}</span>
        <em>{flash ? 'Stelle als wichtig markiert' : words || (live.prep === 'off' ? 'Nimmt auf · Live-Text aus, der Text kommt nach dem Beenden' : live.prep === 'loading' ? 'Spracherkennung wird vorbereitet, der Ton wird schon aufgenommen.' : 'Wartet auf Sprache …')}</em>
      </span>
      <span className="tr-banner-wave" aria-hidden="true">{levels.map((v, i) => <i key={i} style={{ height: `${Math.round(4 + v * 24)}px` }} />)}</span>
    </button>
    <button className="tr-round small" aria-label="Stelle als wichtig markieren" disabled={paused} onClick={() => act(async () => { await LectureRecorder.mark(); setFlash(true); setTimeout(() => setFlash(false), 1600); })}><Star size={18} /></button>
    <button className="tr-round small" aria-label={paused ? 'Fortsetzen' : 'Pausieren'} onClick={() => act(() => paused ? LectureRecorder.resume() : LectureRecorder.pause())}>{paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}</button>
    <button className="tr-pillbtn primary" onClick={onOpen}>Öffnen</button>
  </div>;
}
