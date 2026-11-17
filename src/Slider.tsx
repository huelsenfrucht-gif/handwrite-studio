import { startTransition, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** Großer, flüssiger Schieberegler für Finger und Apple Pencil.
 *  - Die ganze Leiste (44 pt hoch) ist greifbar; Tippen springt an die Stelle.
 *  - Während des Ziehens bewegt sich der Griff sofort (lokaler Zustand); die teure
 *    Neuberechnung der Seite läuft gedrosselt und mit niedriger Priorität.
 *  - onStart wird einmal pro Zug aufgerufen (z. B. für einen einzigen Undo-Schritt). */
type SliderProps = {
  value: number; min: number; max: number; step?: number; label: string; throttle?: number;
  onChange: (v: number) => void; onStart?: () => void; onLive?: (v: number) => void;
};
export function Slider({ value, min, max, step = 1, onChange, onStart, onLive, label, throttle = 90 }: SliderProps) {
  const [local, setLocal] = useState(value);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const dragging = useRef(false), track = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null), timer = useRef<number | null>(null), last = useRef(value);
  useEffect(() => { if (!dragging.current) { setLocal(value); last.current = value; } }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const snap = (v: number) => { const s = Math.round((Math.min(max, Math.max(min, v)) - min) / step) * step + min; return +s.toFixed(4); };
  const flush = () => { timer.current = null; const v = pending.current; pending.current = null; if (v != null && v !== last.current) { last.current = v; startTransition(() => onChangeRef.current(v)); } };
  const push = (v: number, now = false) => {
    setLocal(v); onLive?.(v); pending.current = v;
    if (now) { if (timer.current) clearTimeout(timer.current); flush(); }
    else if (!timer.current) timer.current = window.setTimeout(flush, throttle);
  };
  const fromPointer = (e: PointerEvent) => { const r = track.current!.getBoundingClientRect(); return snap(min + (e.clientX - r.left) / r.width * (max - min)); };

  // Startet ein Zug auf dem Griff, geht es sofort los. Sonst erst bei waagerechter
  // Bewegung oder beim Loslassen (Tippen = Sprung) – so verstellt senkrechtes
  // Scrollen der Spalte nichts aus Versehen.
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const begin = (e: PointerEvent<HTMLDivElement>) => { start.current = null; dragging.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* schon beendet */ } onStart?.(); push(fromPointer(e)); };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const r = track.current!.getBoundingClientRect(), thumbX = r.left + (local - min) / (max - min || 1) * r.width;
    if (Math.abs(e.clientX - thumbX) < 26 || e.pointerType === 'mouse') { e.preventDefault(); begin(e); }
    else start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) { push(fromPointer(e)); return; }
    const s0 = start.current; if (!s0 || s0.id !== e.pointerId) return;
    const dx = Math.abs(e.clientX - s0.x), dy = Math.abs(e.clientY - s0.y);
    if (dx > 6 && dx > dy) begin(e); else if (dy > 8) start.current = null;
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current && start.current.id === e.pointerId) { begin(e); }
    start.current = null;
    if (!dragging.current) return; dragging.current = false; push(pending.current ?? local, true);
  };
  const cancel = () => { start.current = null; if (!dragging.current) return; dragging.current = false; push(pending.current ?? local, true); };
  const key = (e: KeyboardEvent) => {
    const d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key];
    const v = e.key === 'Home' ? min : e.key === 'End' ? max : d != null ? snap(local + d) : null;
    if (v == null) return; e.preventDefault(); onStart?.(); push(v, true);
  };

  const pct = max > min ? (local - min) / (max - min) * 100 : 0;
  return <div className="hs-slider" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={local}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}>
    <div className="hs-slider-track" ref={track}><div className="hs-slider-fill" style={{ width: `${pct}%` }} /><div className="hs-slider-thumb" style={{ left: `${pct}%` }} /></div>
  </div>;
}

/** Zeigt beim Ziehen den Live-Wert an, ohne auf die Neuberechnung zu warten. */
export function SliderRow({ title, format, ...p }: SliderProps & { title: string; format: (v: number) => string }) {
  const [shown, setShown] = useState(p.value);
  useEffect(() => setShown(p.value), [p.value]);
  return <div className="range-label hs-slider-row"><div className="hs-slider-head"><span className="hs-slider-title">{title}</span><span className="hs-slider-value">{format(shown)}</span></div><Slider {...p} onLive={setShown} /></div>;
}
