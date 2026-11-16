import { useEffect, useState, type ReactNode } from 'react';
import { ArchiveRestore, ChevronRight, CircleHelp, Cloud, FileText, Folder, FolderSync, HardDriveDownload, Info, Maximize2, Megaphone, RefreshCw, Smartphone, Type, Unlink, X } from 'lucide-react';
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
  const saved = !props.saveStatus.includes('fehl');
  const last = sync.last ? new Date(sync.last).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : undefined;
  return <div className={`st-backdrop ${closing ? 'closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title">
      <header className="st-head"><h2 id="st-title">Einstellungen</h2><button className="st-close" aria-label="Einstellungen schließen" onClick={close}><X size={20} /></button></header>
      <div className="st-scroll">
        {native && <Group title="iCloud" footer={sync.connected ? (sync.iCloud === false ? 'Dieser Ordner liegt nicht in iCloud Drive und wird nur auf diesem Gerät gesichert.' : 'Wähl auf jedem Gerät denselben Ordner, dann ist alles überall gleich.') : 'Wähl einen Ordner in iCloud Drive, zum Beispiel „Handwrite Studio“.'}>
          <Row icon={<Cloud size={18} />} label="iCloud-Abgleich" detail={sync.connected ? 'An' : 'Aus'} />
          {sync.connected ? <>
            <Row icon={<FolderSync size={18} />} label="Ordner" detail={sync.folder} />
            <Row icon={<RefreshCw size={18} className={sync.busy ? 'st-spin' : ''} />} label={sync.busy ? 'Gleicht ab …' : 'Jetzt abgleichen'} detail={sync.error ? <span className="st-error">Fehler</span> : last ? `zuletzt ${last} Uhr` : undefined} onClick={sync.busy ? undefined : props.onSyncNow} />
            <Row icon={<Unlink size={18} />} label="Abgleich trennen" danger onClick={props.onDisconnect} />
          </> : <Row icon={<FolderSync size={18} />} label="iCloud-Ordner wählen" accent onClick={props.onPickSync} chevron />}
          {sync.error && <p className="st-inline-error">{sync.error}</p>}
        </Group>}

        <Group title="Bibliothek">
          <Row icon={<FileText size={18} />} label="Dokumente" detail={String(props.counts.notes)} />
          <Row icon={<Folder size={18} />} label="Ordner" detail={String(props.counts.folders)} />
          <Row icon={<Type size={18} />} label="Handschriften" detail={String(props.counts.profiles)} onClick={props.onProfiles} chevron />
        </Group>

        <Group title="Sicherung" footer="Eine Datei mit Dokumenten, Ordnern, Handschriften und Vorlagen.">
          <Row icon={<HardDriveDownload size={18} />} label="Sicherung speichern" onClick={props.onBackup} chevron />
          <Row icon={<ArchiveRestore size={18} />} label="Sicherung laden" onClick={props.onRestore} chevron />
        </Group>

        {native ? <Group title="Werbung & Datenschutz" footer="Werbung kommt nur vor einem Export und vor einer neuen Handschrift.">
          <Row icon={<Megaphone size={18} />} label="Werbe-Einstellungen" onClick={props.onAdPrivacy} chevron />
        </Group> : <Group title="App" >
          <Row icon={<Smartphone size={18} />} label="Zum Home-Bildschirm" onClick={props.onHomeScreen} chevron />
          <Row icon={<Maximize2 size={18} />} label={props.fullscreen ? 'Vollbild beenden' : 'Vollbild'} onClick={props.onFullscreen} chevron />
        </Group>}

        <Group title="Hilfe">
          <Row icon={<CircleHelp size={18} />} label="So funktioniert’s" onClick={props.onHelp} chevron />
          <details className="st-row st-details"><summary><span className="st-icon"><Info size={18} /></span><span className="st-label">Über die Schriftanalyse</span><ChevronRight size={18} className="st-chevron" /></summary>
            <div className="st-details-body"><p>Die Einrichtung lernt dein persönliches Alphabet: Du schreibst a–z und A–Z einzeln. Mehrere Durchläufe liefern natürliche Varianten.</p><p>Mit dem Apple Pencil werden Zwischenpunkte und Druck direkt aufgenommen und geglättet – so bleibt dein echter Schreibweg erhalten. Die Ausgabe ist bearbeitbare Vektortinte.</p></div>
          </details>
        </Group>

        <p className="st-about">{saved ? 'Alles gespeichert' : 'Nicht gespeichert'} · Daten bleiben auf deinem Gerät{native ? ' und in deinem iCloud-Ordner' : ''}<br />Handwrite Studio 1.0</p>
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
