import { useEffect, useState, type ReactNode } from 'react';
import { ArchiveRestore, ChevronRight, CircleHelp, FileText, Folder, HardDriveDownload, Info, Maximize2, Mail, Megaphone, PenLine, ShieldCheck, UserRound, Smartphone, Type, X } from 'lucide-react';
import { PEN_WIDTHS, type Library, type Profile } from './model';
import { isUnder16, setUnder16 } from './nativeAds';

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
  const saved = !props.saveStatus.includes('fehl');
  return <div className={`st-backdrop ${closing ? 'closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title">
      <header className="st-head"><h2 id="st-title">Einstellungen</h2><button className="st-close" aria-label="Einstellungen schließen" onClick={close}><X size={20} /></button></header>
      <div className="st-scroll">
        <Group title="Neue Dokumente" footer="Gilt für jedes neue Dokument. Im Studio kannst du beides pro Dokument ändern.">
          <label className="st-row st-select"><span className="st-icon"><Type size={18} /></span><span className="st-label">Standardschrift</span><select value={props.defaults.profileId && props.profiles.some(p => p.id === props.defaults.profileId) ? props.defaults.profileId : 'demo'} onChange={e => props.onDefaults({ profileId: e.target.value })}><option value="demo">Studio-Schrift · Demo</option>{props.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="st-row st-select"><span className="st-icon"><PenLine size={18} /></span><span className="st-label">Stiftstärke</span><select value={props.defaults.penWidth ?? 1.7} onChange={e => props.onDefaults({ penWidth: +e.target.value })}>{PEN_WIDTHS.map(v => <option key={v} value={v}>{v.toLocaleString('de')} px</option>)}</select></label>
        </Group>

        <Group title="Bibliothek">
          <Row icon={<FileText size={18} />} label="Dokumente" detail={String(props.counts.notes)} />
          <Row icon={<Folder size={18} />} label="Ordner" detail={String(props.counts.folders)} />
          <Row icon={<Type size={18} />} label="Handschriften" detail={String(props.counts.profiles)} onClick={props.onProfiles} chevron />
        </Group>

        <Group title="Sicherung" footer="Eine Datei mit Dokumenten, Ordnern, Handschriften und Vorlagen.">
          <Row icon={<HardDriveDownload size={18} />} label="Sicherung speichern" onClick={props.onBackup} chevron />
          <Row icon={<ArchiveRestore size={18} />} label="Sicherung laden" onClick={props.onRestore} chevron />
        </Group>

        {native ? <Group title="Werbung & Datenschutz" footer="Werbung kommt beim Schreiben in Handschrift, vor einer neuen Handschrift und bei Sicherungen. Unter 16 gibt es nur nicht-personalisierte Werbung und keine Tracking-Abfrage (gilt ab dem nächsten App-Start).">
          <Row icon={<Megaphone size={18} />} label="Werbe-Einstellungen" onClick={props.onAdPrivacy} chevron />
          <label className="st-row st-select"><span className="st-icon"><UserRound size={18} /></span><span className="st-label">Ich bin unter 16</span><input type="checkbox" className="st-switch" checked={minor} onChange={e => { setUnder16(e.target.checked); setMinor(e.target.checked); }} /></label>
          <Row icon={<ShieldCheck size={18} />} label="Datenschutzerklärung" onClick={() => window.open(`${SITE}datenschutz.html`, '_blank')} chevron />
        </Group> : <Group title="App" >
          <Row icon={<Smartphone size={18} />} label="Zum Home-Bildschirm" onClick={props.onHomeScreen} chevron />
          <Row icon={<Maximize2 size={18} />} label={props.fullscreen ? 'Vollbild beenden' : 'Vollbild'} onClick={props.onFullscreen} chevron />
        </Group>}

        <Group title="Hilfe">
          <Row icon={<CircleHelp size={18} />} label="So funktioniert’s" onClick={props.onHelp} chevron />
          {!native && <Row icon={<ShieldCheck size={18} />} label="Datenschutzerklärung" onClick={() => window.open(`${SITE}datenschutz.html`, '_blank')} chevron />}
          <Row icon={<Mail size={18} />} label="Hilfe & Kontakt" onClick={() => window.open(`${SITE}support.html`, '_blank')} chevron />
          <Row icon={<Info size={18} />} label="Impressum" onClick={() => window.open(`${SITE}impressum.html`, '_blank')} chevron />
          <Row icon={<FileText size={18} />} label="Lizenzen & Quellen" onClick={() => window.open(`${SITE}lizenzen.html`, '_blank')} chevron />
          <details className="st-row st-details"><summary><span className="st-icon"><Info size={18} /></span><span className="st-label">Über die Schriftanalyse</span><ChevronRight size={18} className="st-chevron" /></summary>
            <div className="st-details-body"><p>Die Einrichtung lernt dein persönliches Alphabet: Du schreibst a–z und A–Z einzeln. Mehrere Durchläufe liefern natürliche Varianten.</p><p>Mit dem Apple Pencil werden Zwischenpunkte und Druck direkt aufgenommen und geglättet – so bleibt dein echter Schreibweg erhalten. Die Ausgabe ist bearbeitbare Vektortinte.</p></div>
          </details>
        </Group>

        <p className="st-about">{saved ? 'Alles gespeichert' : 'Nicht gespeichert'} · Deine Dokumente und Handschriften bleiben auf deinem Gerät<br />Handwrite Studio 1.0</p>
      </div>
    </section>
  </div>;
}

function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return <div className="st-group"><h3>{title}</h3><div className="st-list">{children}</div>{footer && <p className="st-footer">{footer}</p>}</div>;
}
function Row({ icon, label, detail, onClick, chevron, danger, accent }: { icon: ReactNode; label: string; detail?: ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean; accent?: boolean }) {
  const body = <><span className="st-icon">{icon}</span><span className={`st-label ${danger ? 'danger' : ''} ${accent ? 'accent' : ''}`}>{label}</span>{detail !== undefined && <span className="st-detail">{detail}</span>}{chevron && <ChevronRight size={18} className="st-chevron" />}</>;
  return onClick ? <button className="st-row" onClick={onClick}>{body}</button> : <div className="st-row static">{body}</div>;
}
