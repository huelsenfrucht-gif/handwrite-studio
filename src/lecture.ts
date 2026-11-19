import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { hasNative } from './native';

/** One recognised passage, in seconds of recorded audio (pauses do not count). */
export type Passage = { start: number; end: number; text: string };
export type LectureState = 'idle' | 'recording' | 'paused' | 'stopped';
export type Lecture = {
  state: LectureState; reason?: string; id?: string; startedAt?: number; locale?: string; room?: Room; subject?: string;
  duration: number; volatile?: string; passages: Passage[]; markers: number[]; hasAudio?: boolean;
  /** Speech recognition: being prepared (first time: language download), ready, or not possible. */
  prep?: 'idle' | 'loading' | 'ready' | 'unavailable'; progress?: number; level?: number; missedText?: boolean;
  /** Recognised again with the large Whisper model („Genau erkennen“). */
  accurate?: boolean;
};
/** How far away the speaker is; decides how much the quiet, distant voice is lifted. */
export type Room = 'near' | 'classroom' | 'hall';
export const ROOMS: { id: Room; label: string; hint: string }[] = [
  { id: 'near', label: 'Ruhig, nah', hint: 'Für Gespräche am Tisch. Der Ton bleibt unverändert.' },
  { id: 'classroom', label: 'Klassenzimmer', hint: 'Hebt die Stimme der Lehrkraft an und dämpft Brummen und Rauschen.' },
  { id: 'hall', label: 'Hörsaal', hint: 'Für große Räume: hebt weit entfernte Stimmen stärker an.' },
];

export type Availability = { available: boolean; engine: 'analyzer' | 'classic' | 'none'; reason: string; microphone: boolean; speech: boolean };

type Plugin = {
  availability(o: { locale: string }): Promise<Availability>;
  requestAccess(): Promise<{ microphone: boolean; speech: boolean }>;
  start(o: { locale: string; room: Room; subject: string; terms: string[] }): Promise<Lecture>;
  pause(): Promise<Lecture>;
  resume(): Promise<Lecture>;
  mark(): Promise<{ t: number }>;
  stop(): Promise<Lecture>;
  current(): Promise<Lecture>;
  saved(): Promise<{ lessons: Lecture[] }>;
  transcribeAudio(o: { id: string }): Promise<Lecture>;
  remove(o: { id: string }): Promise<void>;
  accurateStatus(): Promise<{ downloaded: boolean; model: string; sizeMB: number; busy: boolean }>;
  transcribeAccurate(o: { id: string }): Promise<Lecture>;
  addListener(event: 'change', fn: (l: Lecture) => void): Promise<PluginListenerHandle>;
  addListener(event: 'accurate', fn: (p: { phase: 'download' | 'load' | 'transcribe' | 'done'; progress: number }) => void): Promise<PluginListenerHandle>;
};

/** Native recorder (iPad app only); everything happens on the device. */
export const LectureRecorder = registerPlugin<Plugin>('LectureRecorder');
export const lectureSupported = hasNative;

export const LANGUAGES = [
  { id: 'de-DE', label: 'Deutsch' }, { id: 'en-US', label: 'Englisch' }, { id: 'fr-FR', label: 'Französisch' },
  { id: 'es-ES', label: 'Spanisch' }, { id: 'it-IT', label: 'Italienisch' },
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
/** 0:05:07 style duration. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
/** Wall-clock time of a moment in the recording (approximate when the lesson was paused). */
export function timeOfDay(startedAt: number | undefined, offset: number) {
  if (!startedAt) return clock(offset);
  const d = new Date(startedAt + offset * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function lectureTitle(l: Pick<Lecture, 'startedAt'>) {
  const d = new Date(l.startedAt || Date.now());
  return `Transkript ${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type Paragraph = { start: number; text: string; marked: boolean };
/** Passages grouped into readable paragraphs: a new one after a pause in speech or when it gets long. */
export function paragraphs(l: Pick<Lecture, 'passages' | 'markers'>): Paragraph[] {
  const out: (Paragraph & { end: number })[] = [];
  for (const p of [...l.passages].sort((a, b) => a.start - b.start)) {
    const text = p.text.replace(/\s+/g, ' ').trim(); if (!text) continue;
    const last = out.at(-1);
    if (last && p.start - last.end < 4 && last.text.length + text.length < 700) { last.text += ` ${text}`; last.end = p.end; }
    else out.push({ start: p.start, end: p.end, text, marked: false });
  }
  for (const t of l.markers) {
    const hit = out.find(p => t >= p.start - 5 && t <= p.end + 3) || out.filter(p => p.start <= t).at(-1);
    if (hit) hit.marked = true;
  }
  return out.map(({ start, text, marked }) => ({ start, text: text[0].toLocaleUpperCase('de-DE') + text.slice(1), marked }));
}

/** The document text: a heading, then one paragraph per passage; marked ones start with „Wichtig:“. */
export function lectureText(l: Lecture, opts: { times: boolean; marks?: boolean }) {
  const end = l.startedAt ? timeOfDay(l.startedAt, l.duration) : '';
  const head = `${lectureTitle(l)}${end ? `–${end}` : ''}`;
  const body = paragraphs(l).map(p => `${opts.times ? `[${timeOfDay(l.startedAt, p.start)}] ` : ''}${p.marked && opts.marks !== false ? 'Wichtig: ' : ''}${p.text}`);
  return [head, '', ...body.flatMap((b, i) => i ? ['', b] : [b])].join('\n').slice(0, 100000);
}
