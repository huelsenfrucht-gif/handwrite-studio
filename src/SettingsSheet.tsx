import { useEffect, useState, type ReactNode } from 'react';
import { ArchiveRestore, ChevronRight, CircleHelp, Cloud, CloudOff, FolderSync, HardDriveDownload, Maximize2, Megaphone, PenLine, RefreshCw, ShieldCheck, Smartphone, Sparkles, Unlink, X } from 'lucide-react';
import type { SyncState } from './sync';

/** Settings in the style of the library and of iOS: grouped rows with coloured icon tiles. */
export function SettingsSheet(props: {
  native: boolean; saveStatus: string; counts: { notes: number; profiles: number; folders: number };
  sync: SyncState & { busy?: boolean }; fullscreen: boolean;
  onClose: () => void; onBackup: () => void; onRestore: () => void;
  onPickSync: () => void; onSyncNow: () => void; onDisconnect: () => void; onAdPrivacy: () => void;
  onHelp: () => void; onProfiles: () => void; onHomeScreen: () => void; onFullscreen: () => void;
}) {
  const { sync, native } = props, [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(props.onClose, 160); };
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
  const saved = !props.saveStatus.includes('fehl'), plural = (n: number, one: string, many: string) => `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`;
  const last = sync.last ? new Date(sync.last).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : undefined;
  return <div className={`st-backdrop ${closing ? 'closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title">
      <header className="st-head"><h2 id="st-title">Einstellungen</h2><button className="st-close" aria-label="Einstellungen schließen" onClick={close}><X size={18} strokeWidth={2.4} /></button></header>
      <div className="st-scroll">
        <div className="st-hero">
          <span className="st-appicon" aria-hidden="true"><PenLine size={30} strokeWidth={1.9} /></span>
          <div className="st-hero-text"><strong>Handwrite Studio</strong><span>Deine Worte. Deine Handschrift.</span>
            <div className="st-chips"><span>{plural(props.counts.notes, 'Dokument', 'Dokumente')}</span><span>{plural(props.counts.profiles, 'Handschrift', 'Handschriften')}</span><span>{plural(props.counts.folders, 'Ordner', 'Ordner')}</span></div>
          </div>
          <span className={`st-status ${saved ? '' : 'error'}`}><i />{saved ? 'Gespeichert' : 'Nicht gespeichert'}</span>
        </div>

        {native && <Group title="iCloud" footer={sync.connected ? (sync.iCloud === false ? 'Der gewählte Ordner liegt nicht in iCloud Drive – es wird nur auf diesem Gerät gesichert. Wähle für den Abgleich mit anderen Geräten einen Ordner in iCloud Drive.' : 'Dokumente, Ordner, Handschriften und Vorlagen werden automatisch gesichert und mit jedem iPad und iPhone abgeglichen, das denselben Ordner nutzt.') : 'Lege in iCloud Drive einen Ordner an (z. B. „Handwrite Studio“) und wähle ihn auf jedem Gerät aus. Danach gleicht die App alles automatisch ab.'}>
          <Row icon={sync.connected ? <Cloud size={17} /> : <CloudOff size={17} />} tint={sync.connected ? 'sky' : 'gray'} label="iCloud-Abgleich" detail={<span className={`st-pill ${sync.connected ? 'on' : ''}`}>{sync.connected ? 'An' : 'Aus'}</span>} />
          {sync.connected ? <>
            <Row icon={<FolderSync size={17} />} tint="blue" label="Ordner" detail={sync.folder} />
            <Row icon={<RefreshCw size={17} className={sync.busy ? 'st-spin' : ''} />} tint="green" label={sync.busy ? 'Gleicht ab …' : 'Jetzt abgleichen'} detail={sync.error ? <span className="st-error">Fehler</span> : last ? `zuletzt ${last} Uhr` : undefined} onClick={sync.busy ? undefined : props.onSyncNow} />
            <Row icon={<Unlink size={17} />} tint="red" label="Abgleich trennen" danger onClick={props.onDisconnect} />
          </> : <Row icon={<FolderSync size={17} />} tint="blue" label="iCloud-Ordner wählen" accent onClick={props.onPickSync} chevron />}
          {sync.error && <p className="st-inline-error">{sync.error}</p>}
        </Group>}

        <Group title="Sicherung" footer="Eine Datei mit allem: Dokumente, Ordner, Handschriften und Vorlagen. Damit kannst du wiederherstellen oder auf ein anderes Gerät umziehen.">
          <Row icon={<HardDriveDownload size={17} />} tint="blue" label="Sicherung speichern" onClick={props.onBackup} chevron />
          <Row icon={<ArchiveRestore size={17} />} tint="green" label="Sicherung laden" onClick={props.onRestore} chevron />
        </Group>

        {native ? <Group title="Werbung & Datenschutz" footer="Handwrite Studio ist kostenlos und finanziert sich über Werbung. Sie erscheint vor einem Export und bevor du eine neue Handschrift anlegst – nie beim Schreiben. Deine Texte und Handschriften werden dafür nicht verwendet.">
          <Row icon={<Megaphone size={17} />} tint="purple" label="Werbe-Einstellungen" onClick={props.onAdPrivacy} chevron />
        </Group> : <Group title="App" footer="Auf iPhone und iPad startet Handwrite Studio vom Home-Bildschirm wie eine eigene App – ohne Adressleiste und auch offline.">
          <Row icon={<Smartphone size={17} />} tint="orange" label="Zum Home-Bildschirm" onClick={props.onHomeScreen} chevron />
          <Row icon={<Maximize2 size={17} />} tint="indigo" label={props.fullscreen ? 'Vollbild beenden' : 'Vollbild'} onClick={props.onFullscreen} chevron />
        </Group>}

        <Group title="Hilfe">
          <Row icon={<CircleHelp size={17} />} tint="teal" label="So funktioniert’s" onClick={props.onHelp} chevron />
          <Row icon={<span className="st-aa">Aa</span>} tint="pink" label="Handschriften verwalten" onClick={props.onProfiles} chevron />
          <details className="st-row st-details"><summary><Tile tint="yellow"><Sparkles size={17} /></Tile><span className="st-label">Was die Schriftanalyse kann</span><ChevronRight size={17} className="st-chevron" /></summary>
            <div className="st-details-body"><p>Die Einrichtung lernt dein persönliches Alphabet aus kurzen Zeilen in klein und GROSS oder aus a–z und A–Z einzeln. Mehrere Durchläufe liefern natürliche Varianten.</p><p>Mit dem Apple Pencil werden Zwischenpunkte und Druck direkt aufgenommen und geglättet – so bleibt dein echter Schreibweg erhalten. Die Ausgabe ist bearbeitbare Vektortinte.</p></div>
          </details>
        </Group>

        <div className="st-privacy"><ShieldCheck size={22} /><strong>Privat, kostenlos & ohne Konto</strong><p>Alles bleibt auf deinem Gerät{native ? ' und in deinem eigenen iCloud-Ordner' : ''}. Erkennung und Handschrift laufen lokal, nichts wird an einen KI-Server geschickt. Keine Anmeldung, kein Limit.</p><small>Handwrite Studio · Version 1.0</small></div>
      </div>
    </section>
  </div>;
}

function Group({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return <div className="st-group"><h3>{title}</h3><div className="st-list">{children}</div>{footer && <p className="st-footer">{footer}</p>}</div>;
}
const Tile = ({ tint, children }: { tint: string; children: ReactNode }) => <span className={`st-tile ${tint}`}>{children}</span>;
function Row({ icon, tint, label, detail, onClick, chevron, danger, accent }: { icon: ReactNode; tint: string; label: string; detail?: ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean; accent?: boolean }) {
  const body = <><Tile tint={tint}>{icon}</Tile><span className={`st-label ${danger ? 'danger' : ''} ${accent ? 'accent' : ''}`}>{label}</span>{detail !== undefined && <span className="st-detail">{detail}</span>}{chevron && <ChevronRight size={17} className="st-chevron" />}</>;
  return onClick ? <button className="st-row" onClick={onClick}>{body}</button> : <div className="st-row static">{body}</div>;
}
