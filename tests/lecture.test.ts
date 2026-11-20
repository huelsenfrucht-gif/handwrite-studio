import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clock, lectureDocumentTitle, lectureText, paragraphs, type Lecture } from '../src/lecture';

const lesson = (over: Partial<Lecture> = {}): Lecture => ({
  state: 'stopped', id: 'lesson-1', startedAt: new Date(2026, 10, 19, 10, 23).getTime(), duration: 2700, markers: [],
  passages: [
    { start: 2, end: 8, text: 'heute geht es um die Französische Revolution.' },
    { start: 9, end: 15, text: 'Wichtig sind die drei Stände.' },
    { start: 60, end: 70, text: 'Der dritte Stand trug die Steuern.' },
  ], ...over,
});

describe('lesson transcript', () => {
  it('joins passages that follow each other and starts a paragraph after a pause', () => {
    const p = paragraphs(lesson());
    expect(p).toHaveLength(2);
    expect(p[0].text).toBe('Heute geht es um die Französische Revolution. Wichtig sind die drei Stände.');
    expect(p[1].start).toBe(60);
  });
  it('marks the paragraph a marker falls into', () => {
    expect(paragraphs(lesson({ markers: [64] })).map(p => p.marked)).toEqual([false, true]);
  });
  it('writes a heading and optional times into the document text', () => {
    const plain = lectureText(lesson({ markers: [64] }), { times: false }), lines = plain.split('\n');
    expect(lines[0]).toMatch(/^Transkript .*19\.11\.2026, 10:23–11:08$/);
    expect(plain).toContain('Wichtig: Der dritte Stand');
    expect(plain).not.toContain('[10:');
    expect(lectureText(lesson(), { times: true })).toContain('[10:24] Der dritte Stand');
  });
  it('keeps an optional topic in exported text and the handwriting document title', () => {
    const l = lesson({ topic: '  Die Französische Revolution  ' });
    expect(lectureText(l, { times: false })).toContain('\n\nThema: Die Französische Revolution\n\nHeute');
    expect(lectureDocumentTitle(l)).toMatch(/^Die Französische Revolution – Transkript /);
    expect(lectureText(lesson(), { times: false })).not.toContain('Thema:');
  });
  it('shows durations as mm:ss and h:mm:ss', () => {
    expect(clock(65)).toBe('01:05'); expect(clock(3725)).toBe('1:02:05');
  });
  it('asks for everyone’s consent before recording and never records secretly', () => {
    const ui = readFileSync('src/LectureSheet.tsx', 'utf8');
    expect(ui).toContain('§ 201 StGB'); expect(ui).toMatch(/disabled=\{!p\.consent/);
    const plist = readFileSync('ios/App/App/Info.plist', 'utf8');
    expect(plist).toContain('NSMicrophoneUsageDescription'); expect(plist).toContain('NSSpeechRecognitionUsageDescription');
    expect(plist).toMatch(/UIBackgroundModes<\/key>\s*<array>\s*<string>audio<\/string>/);
  });
});
