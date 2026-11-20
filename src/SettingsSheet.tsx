import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Languages, ALargeSmall, AlignLeft, AlignRight, ArchiveRestore, ChevronRight, IndentIncrease, Minus, Plus, CircleHelp, FileText, Folder, HardDriveDownload, Info, Maximize2, Mail, Megaphone, PenLine, ShieldCheck, UserRound, Smartphone, Type, X } from 'lucide-react';
import { DEFAULT_LINE_START_SHIFT, NEW_MARGIN_LEFT_MM, NEW_MARGIN_RIGHT_MM, PEN_WIDTHS, defaultSettings, type Library, type Profile } from './model';
import { isUnder16, setUnder16 } from './nativeAds';
import { getLang, locale, setLang, t, type Lang } from './i18n';

/** Public pages (privacy policy, support) on the website. */
const SITE = 'https://huelsenfrucht-gif.github.io/handwrite-studio/';

/** Settings in the style of the library: plain grouped rows. */
export function SettingsSheet(props: {
  native: boolean; saveStatus: string; counts: { notes: number; profiles: number; folders: number }; fullscreen: boolean;
  profiles: Profile[]; defaults: NonNullable<Library['defaults']>; onDefaults: (d: NonNullable<Library['defaults']>) => void;
  onClose: () => void; onBackup: () => void; onRestore: () => void; onAdPrivacy: () => void;
  onHelp: () => void; onProfiles: () => void; onHomeScreen: () => void; onFullscreen: () => void;
}) {
  const { native } = props, [closing, setClosing] = useState(false), [minor, setMinor] = useState(isUnder16());
  const close = () => { setClosing(true); setTimeout(props.onClose, 160); };
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
  const saved = props.saveStatus !== t('Speichern fehlgeschlagen');
  // Sections on the left (wide screens), like the sidebar of the library.
  const sections = [
    { id: 'st-lang', label: t('Sprache'), icon: <Languages size={18} /> },
    { id: 'st-docs', label: t('Neue Dokumente'), icon: <PenLine size={18} /> },
    { id: 'st-lib', label: t('Bibliothek'), icon: <Folder size={18} /> },
    { id: 'st-backup', label: t('Sicherung'), icon: <HardDriveDownload size={18} /> },
    native ? { id: 'st-ads', label: t('Werbung & Datenschutz'), icon: <ShieldCheck size={18} /> } : { id: 'st-app', label: t('App'), icon: <Smartphone size={18} /> },
    { id: 'st-help', label: t('Hilfe & Rechtliches'), icon: <CircleHelp size={18} /> },
  ];
  const scroller = useRef<HTMLDivElement>(null), [active, setActive] = useState(sections[0].id);
  const jump = (id: string) => { const el = document.getElementById(id), box = scroller.current; if (el && box) box.scrollTo({ top: el.offsetTop - box.offsetTop - 8, behavior: 'smooth' }); setActive(id); };
  const onScroll = () => { const box = scroller.current; if (!box) return; let cur = sections[0].id; for (const sec of sections) { const el = document.getElementById(sec.id); if (el && el.offsetTop - box.offsetTop - 40 <= box.scrollTop) cur = sec.id; } if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) cur = sections.at(-1)!.id; setActive(cur); };
  return <div className={`st-backdrop ${closing ? 'closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title">
      <header className="st-head"><h2 id="st-title">{t('Einstellungen')}</h2><button className="st-close" aria-label={t('Einstellungen schließen')} onClick={close}><X size={20} /></button></header>
      <div className="st-body">
      <nav className="st-nav" aria-label={t('Bereiche')}>{sections.map(sec => <button key={sec.id} className={active === sec.id ? 'on' : ''} onClick={() => jump(sec.id)}>{sec.icon}{sec.label}</button>)}
        <p className="st-nav-foot">{saved ? t('Alles gespeichert') : t('Nicht gespeichert')}<br />Handwritten 1.0<br />{t('Ein Service der pvh debt capital advisory GmbH')}</p></nav>
      <div className="st-scroll" ref={scroller} onScroll={onScroll}>
        <Group id="st-lang" title={t('Sprache')} footer={t('Die App startet dafür kurz neu. Deine Dokumente bleiben unverändert.')}>
          <label className="st-row st-select"><span className="st-icon"><Languages size={18} /></span><span className="st-label">{t('Sprache der App')}</span><select value={getLang()} onChange={e => { setLang(e.target.value as Lang); location.reload(); }}><option value="de">Deutsch</option><option value="en">English</option></select></label>
        </Group>

        <Group id="st-docs" title={t('Neue Dokumente')} footer={t('Gilt für jedes neue Dokument. Im Studio kannst du alles pro Dokument unter „Spezielle Einstellungen“ ändern.')}>
          <label className="st-row st-select"><span className="st-icon"><Type size={18} /></span><span className="st-label">{t('Standardschrift')}</span><select value={props.defaults.profileId && props.profiles.some(p => p.id === props.defaults.profileId) ? props.defaults.profileId : 'demo'} onChange={e => props.onDefaults({ profileId: e.target.value })}><option value="demo">{t('Studio-Schrift · Demo')}</option>{props.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="st-row st-select"><span className="st-icon"><PenLine size={18} /></span><span className="st-label">{t('Stiftstärke')}</span><select value={props.defaults.penWidth ?? 1.7} onChange={e => props.onDefaults({ penWidth: +e.target.value })}>{PEN_WIDTHS.map(v => <option key={v} value={v}>{v.toLocaleString(locale())} px</option>)}</select></label>
          <Stepper icon={<AlignLeft size={18} />} label={t('Textrand links')} value={props.defaults.marginLeft ?? NEW_MARGIN_LEFT_MM} min={0} max={40} step={0.5} unit="mm" onChange={v => props.onDefaults({ marginLeft: v })} />
          <Stepper icon={<AlignRight size={18} />} label={t('Textrand rechts')} value={props.defaults.marginRight ?? NEW_MARGIN_RIGHT_MM} min={0} max={40} step={0.5} unit="mm" onChange={v => props.onDefaults({ marginRight: v })} />
          <Stepper icon={<ALargeSmall size={18} />} label={t('Schriftgröße')} value={props.defaults.size ?? defaultSettings.size} min={12} max={60} step={1} unit="px" onChange={v => props.onDefaults({ size: v })} />
          <Stepper icon={<IndentIncrease size={18} />} label={t('Zeilenanfänge versetzt')} value={props.defaults.lineStartShift ?? DEFAULT_LINE_START_SHIFT} min={0} max={100} step={5} unit="%" onChange={v => props.onDefaults({ lineStartShift: v })} />
        </Group>

        <Group id="st-lib" title={t('Bibliothek')}>
          <Row icon={<FileText size={18} />} label={t('Dokumente')} detail={String(props.counts.notes)} />
          <Row icon={<Folder size={18} />} label={t('Ordner')} detail={String(props.counts.folders)} />
          <Row icon={<Type size={18} />} label={t('Handschriften')} detail={String(props.counts.profiles)} onClick={props.onProfiles} chevron />
        </Group>

        <Group id="st-backup" title={t('Sicherung')} footer={t('Eine Datei mit Dokumenten, Ordnern, Handschriften und Vorlagen.')}>
          <Row icon={<HardDriveDownload size={18} />} label={t('Sicherung speichern')} onClick={props.onBackup} chevron />
          <Row icon={<ArchiveRestore size={18} />} label={t('Sicherung laden')} onClick={props.onRestore} chevron />
        </Group>

        {native ? <Group id="st-ads" title={t('Werbung & Datenschutz')} footer={t('Handwritten ist kostenlos und wird durch Werbung finanziert. Werbung lässt sich nicht abschalten, und die App braucht dafür eine Internetverbindung. Sie kommt beim Schreiben in Handschrift, vor einer Aufnahme, vor einer neuen Handschrift und bei Sicherungen. Unter 16 gibt es nur nicht-personalisierte Werbung und keine Tracking-Abfrage (gilt ab dem nächsten App-Start).')}>
          <Row icon={<Megaphone size={18} />} label="Werbe-Einstellungen" onClick={props.onAdPrivacy} chevron />
          <label className="st-row st-select"><span className="st-icon"><UserRound size={18} /></span><span className="st-label">{t('Ich bin unter 16')}</span><input type="checkbox" className="st-switch" checked={minor} onChange={e => { setUnder16(e.target.checked); setMinor(e.target.checked); }} /></label>
          <Row icon={<ShieldCheck size={18} />} label={t('Datenschutzerklärung')} onClick={() => window.open(`${SITE}datenschutz.html`, '_blank')} chevron />
        </Group> : <Group id="st-app" title={t('App')}>
          <Row icon={<Smartphone size={18} />} label={t('Zum Home-Bildschirm')} onClick={props.onHomeScreen} chevron />
          <Row icon={<Maximize2 size={18} />} label={props.fullscreen ? t('Vollbild beenden') : t('Vollbild')} onClick={props.onFullscreen} chevron />
        </Group>}

        <Group id="st-help" title={t('Hilfe & Rechtliches')}>
          <Row icon={<CircleHelp size={18} />} label="So funktioniert’s" onClick={props.onHelp} chevron />
          {<Row icon={<ShieldCheck size={18} />} label={t('Datenschutzerklärung')} onClick={() => window.open(`${SITE}datenschutz.html`, '_blank')} chevron />}
          <Row icon={<Mail size={18} />} label={t('Hilfe & Kontakt')} onClick={() => window.open(`${SITE}support.html`, '_blank')} chevron />
          <Row icon={<FileText size={18} />} label={t('Nutzungsbedingungen')} onClick={() => window.open(`${SITE}nutzungsbedingungen.html`, '_blank')} chevron />
          <Row icon={<Info size={18} />} label={t('Impressum')} onClick={() => window.open(`${SITE}impressum.html`, '_blank')} chevron />
          <Row icon={<FileText size={18} />} label={t('Lizenzen & Quellen')} onClick={() => window.open(`${SITE}lizenzen.html`, '_blank')} chevron />
          <details className="st-row st-details"><summary><span className="st-icon"><Info size={18} /></span><span className="st-label">{t('Über die Schriftanalyse')}</span><ChevronRight size={18} className="st-chevron" /></summary>
            <div className="st-details-body"><p>{t('Die Einrichtung lernt dein persönliches Alphabet: Du schreibst a–z und A–Z einzeln. Mehrere Durchläufe liefern natürliche Varianten.')}</p><p>{t('Mit dem Apple Pencil werden Zwischenpunkte und Druck direkt aufgenommen und geglättet – so bleibt dein echter Schreibweg erhalten. Die Ausgabe ist bearbeitbare Vektortinte.')}</p></div>
          </details>
        </Group>

        <p className="st-about">{saved ? t('Alles gespeichert') : t('Nicht gespeichert')} {t('· Deine Dokumente und Handschriften bleiben auf deinem Gerät')}<br />Handwritten 1.0<br />{t('Ein Service der pvh debt capital advisory GmbH')}</p>
      </div>
      </div>
    </section>
  </div>;
}

function Group({ id, title, footer, children }: { id?: string; title: string; footer?: string; children: ReactNode }) {
  return <div className="st-group" id={id}><h3>{title}</h3><div className="st-list">{children}</div>{footer && <p className="st-footer">{footer}</p>}</div>;
}
function Row({ icon, label, detail, onClick, chevron, danger, accent }: { icon: ReactNode; label: string; detail?: ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean; accent?: boolean }) {
  const body = <><span className="st-icon">{icon}</span><span className={`st-label ${danger ? 'danger' : ''} ${accent ? 'accent' : ''}`}>{label}</span>{detail !== undefined && <span className="st-detail">{detail}</span>}{chevron && <ChevronRight size={18} className="st-chevron" />}</>;
  return onClick ? <button className="st-row" onClick={onClick}>{body}</button> : <div className="st-row static">{body}</div>;
}

/** Zeile mit − Wert + ; große Tippflächen, Wert gedrückt halten wiederholt. */
function Stepper({ icon, label, value, min, max, step, unit, onChange }: { icon: ReactNode; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(+Math.min(max, Math.max(min, v)).toFixed(2));
  return <div className="st-row st-stepper"><span className="st-icon">{icon}</span><span className="st-label">{label}</span>
    <span className="st-step"><button type="button" aria-label={t('{label} verringern', { label })} disabled={value <= min} onClick={() => set(value - step)}><Minus size={16} /></button>
      <output>{value.toLocaleString(locale())} {unit}</output>
      <button type="button" aria-label={t('{label} erhöhen', { label })} disabled={value >= max} onClick={() => set(value + step)}><Plus size={16} /></button></span></div>;
}
