import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, Cloud, Copy, FilePlus2, FolderInput, FolderPlus, LayoutGrid, List, ListFilter, Palette, Pencil, Search, Settings, Star, Trash2, X } from 'lucide-react';
import { FOLDER_COLORS, newNote, pathData, uid, type Folder, type Library, type Note, type Profile, type Template } from './model';
import { layout, resolvedDrawingInk } from './engine';

export type LibraryView = 'documents' | 'favorites' | 'profiles';
type Filter = 'all' | 'notes' | 'folders';
type Sort = 'updated' | 'name';
type Item = { kind: 'folder'; folder: Folder; updated: string; name: string } | { kind: 'note'; note: Note; updated: string; name: string };

const stored = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 820px)').matches;
const stamp = (iso: string) => { const d = new Date(iso), p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function LibraryShell(props: {
  view: LibraryView; library: Library; saveStatus: string; children?: ReactNode;
  setView: (v: LibraryView) => void; update: (fn: (l: Library) => Library) => void;
  openNote: (id: string) => void; createNote: (folderId?: string) => void; photoImport: (folderId?: string) => void;
  openSettings: () => void; openHelp: () => void; openStudio: () => void; notify: (s: string) => void;
}) {
  const { view, library, update, notify } = props;
  const folders = library.folders || [];
  const [folderId, setFolderId] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>(() => stored('hs-filter', 'all') as Filter);
  const [sort, setSort] = useState<Sort>(() => stored('hs-sort', 'updated') as Sort);
  const [layoutMode, setLayoutMode] = useState(() => stored('hs-layout', 'grid'));
  const [query, setQuery] = useState(''), [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState<string | null>(null), [renaming, setRenaming] = useState<string | null>(null), [collapsed, setCollapsed] = useState(narrow);
  const current = folders.find(f => f.id === folderId);
  useEffect(() => { if (folderId && !current) setFolderId(undefined); }, [folderId, current]);
  useEffect(() => { const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.gn-menu, .gn-menu-trigger')) setMenu(null); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, []);
  const path = useMemo(() => { const out: Folder[] = []; let f = current; while (f && out.length < 50) { out.unshift(f); f = folders.find(x => x.id === f!.parentId); } return out; }, [current, folders]);
  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('de-DE');
    let list: Item[] = [
      ...folders.map(f => ({ kind: 'folder' as const, folder: f, updated: f.updated, name: f.name })),
      ...library.notes.map(n => ({ kind: 'note' as const, note: n, updated: n.updated, name: n.title || 'Unbenannt' })),
    ];
    if (q) list = list.filter(i => i.name.toLocaleLowerCase('de-DE').includes(q) || (i.kind === 'note' && i.note.text.toLocaleLowerCase('de-DE').includes(q)));
    else if (view === 'favorites') list = list.filter(i => i.kind === 'folder' ? i.folder.favorite : i.note.favorite);
    else list = list.filter(i => i.kind === 'folder' ? (i.folder.parentId || undefined) === folderId : (i.note.folderId || undefined) === folderId);
    if (filter === 'notes') list = list.filter(i => i.kind === 'note');
    if (filter === 'folders') list = list.filter(i => i.kind === 'folder');
    const by = sort === 'name' ? (a: Item, b: Item) => a.name.localeCompare(b.name, 'de') : (a: Item, b: Item) => b.updated.localeCompare(a.updated);
    // Documents first, then folders — like Goodnotes.
    return [...list.filter(i => i.kind === 'note').sort(by), ...list.filter(i => i.kind === 'folder').sort(by)];
  }, [folders, library.notes, query, view, folderId, filter, sort]);

  const now = () => new Date().toISOString();
  const createFolder = () => { const f: Folder = { id: uid(), name: 'Neuer Ordner', color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length], parentId: view === 'documents' ? folderId : undefined, created: now(), updated: now() }; update(l => ({ ...l, folders: [...(l.folders || []), f] })); setRenaming(f.id); setMenu(null); };
  const editFolder = (id: string, fn: (f: Folder) => Folder) => update(l => ({ ...l, folders: (l.folders || []).map(f => f.id === id ? { ...fn(f), updated: now() } : f) }));
  const editNote = (id: string, fn: (n: Note) => Note) => update(l => ({ ...l, notes: l.notes.map(n => n.id === id ? fn(n) : n) }));
  const rename = (item: Item, name: string) => { const value = name.trim().slice(0, 100); setRenaming(null); if (!value) return; if (item.kind === 'folder') editFolder(item.folder.id, f => ({ ...f, name: value })); else editNote(item.note.id, n => ({ ...n, title: value, updated: now() })); };
  const toggleFavorite = (item: Item) => { if (item.kind === 'folder') update(l => ({ ...l, folders: (l.folders || []).map(f => f.id === item.folder.id ? { ...f, favorite: !f.favorite } : f) })); else editNote(item.note.id, n => ({ ...n, favorite: !n.favorite })); };
  const descendants = (id: string): Set<string> => { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } } return out; };
  const move = (item: Item, target?: string) => { setMenu(null); if (item.kind === 'folder') editFolder(item.folder.id, f => ({ ...f, parentId: target })); else editNote(item.note.id, n => ({ ...n, folderId: target })); notify(`„${item.name}“ verschoben nach ${target ? folders.find(f => f.id === target)?.name : 'Dokumente'}.`); };
  const duplicate = (n: Note) => { const copy = { ...structuredClone(n), id: uid(), title: `${n.title} – Kopie`, favorite: false, updated: now() }; update(l => ({ ...l, notes: [copy, ...l.notes] })); setMenu(null); notify('Dokument dupliziert.'); };
  const remove = (item: Item) => {
    setMenu(null);
    if (item.kind === 'note') { if (!confirm(`Dokument „${item.name}“ löschen?`)) return; update(l => { const notes = l.notes.filter(x => x.id !== item.note.id); if (!notes.length) notes.push(newNote()); return { ...l, notes, activeId: l.activeId === item.note.id ? notes[0].id : l.activeId }; }); return; }
    const f = item.folder; if (!confirm(`Ordner „${f.name}“ löschen? Sein Inhalt wird eine Ebene nach oben verschoben, es geht nichts verloren.`)) return;
    update(l => ({ ...l, folders: (l.folders || []).filter(x => x.id !== f.id).map(x => x.parentId === f.id ? { ...x, parentId: f.parentId } : x), notes: l.notes.map(n => n.folderId === f.id ? { ...n, folderId: f.parentId } : n) }));
  };
  const openFolder = (id?: string) => { setFolderId(id); setQuery(''); setSearching(false); if (view !== 'documents') props.setView('documents'); };
  const filterLabel = { all: 'Alle', notes: 'Dokumente', folders: 'Ordner' }[filter];
  const title = searching && query ? 'Suche' : view === 'favorites' ? 'Favoriten' : view === 'profiles' ? 'Meine Handschriften' : current?.name || 'Dokumente';

  const card = (item: Item) => {
    const id = item.kind === 'folder' ? item.folder.id : item.note.id, fav = item.kind === 'folder' ? item.folder.favorite : item.note.favorite;
    const open = () => item.kind === 'folder' ? openFolder(item.folder.id) : props.openNote(item.note.id);
    const targets = [{ id: undefined as string | undefined, name: 'Dokumente' }, ...folders.filter(f => item.kind !== 'folder' || !descendants(item.folder.id).has(f.id)).map(f => ({ id: f.id as string | undefined, name: f.name }))]
      .filter(t => t.id !== (item.kind === 'folder' ? item.folder.parentId : item.note.folderId));
    return <article key={id} className={`gn-item gn-${item.kind}`}>
      <div className="gn-cover-wrap">
        <button className="gn-cover" onClick={open} aria-label={`${item.name} öffnen`}>{item.kind === 'folder' ? <FolderIcon color={item.folder.color} /> : <NoteCover note={item.note} profiles={library.profiles} templates={library.templates} />}</button>
        <button className={`gn-star ${fav ? 'on' : ''}`} aria-pressed={!!fav} aria-label={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'} onClick={() => toggleFavorite(item)}><Star size={18} /></button>
      </div>
      <div className="gn-caption">
        {renaming === id ? <input className="gn-rename" autoFocus defaultValue={item.name} maxLength={100} aria-label="Neuer Name" onFocus={e => e.currentTarget.select()} onBlur={e => rename(item, e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
          : <button className="gn-title gn-menu-trigger" onClick={() => setMenu(menu === id ? null : id)} aria-haspopup="menu" aria-expanded={menu === id}><span>{item.name}</span><ChevronDown size={14} /></button>}
        <small>{stamp(item.updated)}</small>
        {menu === id && <div className="gn-menu" role="menu">
          <button role="menuitem" onClick={() => { setMenu(null); setRenaming(id); }}><Pencil size={16} />Umbenennen</button>
          <button role="menuitem" onClick={() => { setMenu(null); toggleFavorite(item); }}><Star size={16} />{fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}</button>
          {item.kind === 'note' && <button role="menuitem" onClick={() => duplicate(item.note)}><Copy size={16} />Duplizieren</button>}
          {item.kind === 'folder' && <div className="gn-colors" role="group" aria-label="Ordnerfarbe"><Palette size={16} />{FOLDER_COLORS.map(c => <button key={c} style={{ background: c }} aria-label={`Farbe ${c}`} className={item.folder.color === c ? 'on' : ''} onClick={() => editFolder(item.folder.id, f => ({ ...f, color: c }))}>{item.folder.color === c && <Check size={11} />}</button>)}</div>}
          {targets.length > 0 && <details className="gn-move"><summary><FolderInput size={16} />Verschieben nach …<ChevronRight size={14} /></summary>{targets.map(t => <button key={t.id || 'root'} role="menuitem" onClick={() => move(item, t.id)}>{t.name}</button>)}</details>}
          <button role="menuitem" className="danger" onClick={() => remove(item)}><Trash2 size={16} />Löschen</button>
        </div>}
      </div>
    </article>;
  };

  return <div className={`gn-shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="gn-sidebar" aria-label="Bibliothek">
      <button className="gn-collapse" aria-label={collapsed ? 'Seitenleiste einblenden' : 'Seitenleiste ausblenden'} onClick={() => setCollapsed(c => !c)}><SidebarIcon /></button>
      <nav onClick={() => { if (narrow()) setCollapsed(true); }}>
        <button className={view === 'documents' && !searching ? 'active' : ''} onClick={() => { props.setView('documents'); openFolder(undefined); }}><DocsIcon active={view === 'documents'} />Dokumente</button>
        <button className={view === 'favorites' ? 'active' : ''} onClick={() => { props.setView('favorites'); setQuery(''); setSearching(false); }}><FavIcon active={view === 'favorites'} />Favoriten</button>
        <button className={view === 'profiles' ? 'active' : ''} onClick={() => props.setView('profiles')}><span className="gn-hand">Aa</span>Handschriften</button>
        <button onClick={props.openStudio}><Pencil size={22} strokeWidth={1.6} />Zuletzt geöffnet</button>
      </nav>
      <button className="gn-help" onClick={props.openHelp}>Hilfe</button>
    </aside>
    {collapsed && <button className="gn-expand" aria-label="Seitenleiste einblenden" onClick={() => setCollapsed(false)}><SidebarIcon /></button>}
    <div className="gn-pill">
      {searching ? <span className="gn-search"><Search size={18} /><input autoFocus placeholder="Suchen" aria-label="Dokumente und Ordner suchen" value={query} onChange={e => { setQuery(e.target.value); if (view === 'profiles') props.setView('documents'); }} /><button aria-label="Suche schließen" onClick={() => { setQuery(''); setSearching(false); }}><X size={16} /></button></span>
        : view !== 'profiles' && <button aria-label="Suchen" title="Suchen" onClick={() => setSearching(true)}><Search size={24} strokeWidth={1.7} /></button>}
      <button className="gn-gear" aria-label="Einstellungen" title="Einstellungen" onClick={props.openSettings}><Settings size={24} strokeWidth={1.7} /></button>
    </div>
    <main className="gn-main">
      {path.length > 0 && view === 'documents' && !query && <nav className="gn-crumbs" aria-label="Ordnerpfad"><button onClick={() => openFolder(undefined)}>Dokumente</button>{path.map((f, i) => <span key={f.id}><ChevronRight size={14} />{i === path.length - 1 ? <strong>{f.name}</strong> : <button onClick={() => openFolder(f.id)}>{f.name}</button>}</span>)}</nav>}
      <h1>{title}</h1>
      {view === 'profiles' ? props.children : <>
        <div className="gn-toolbar">
          <div className="gn-filter"><button className="gn-menu-trigger" onClick={() => setMenu(menu === 'filter' ? null : 'filter')} aria-haspopup="menu"><ListFilter size={24} strokeWidth={1.6} /><span>{view === 'favorites' ? 'Dokumente' : filterLabel}</span></button>
            {menu === 'filter' && <div className="gn-menu" role="menu"><small>Anzeigen</small>{(['all', 'notes', 'folders'] as Filter[]).map(f => <button key={f} role="menuitemradio" aria-checked={filter === f} onClick={() => { setFilter(f); remember('hs-filter', f); setMenu(null); }}>{filter === f ? <Check size={16} /> : <span className="gn-gap" />}{{ all: 'Alle', notes: 'Nur Dokumente', folders: 'Nur Ordner' }[f]}</button>)}<small>Sortieren</small>{(['updated', 'name'] as Sort[]).map(s => <button key={s} role="menuitemradio" aria-checked={sort === s} onClick={() => { setSort(s); remember('hs-sort', s); setMenu(null); }}>{sort === s ? <Check size={16} /> : <span className="gn-gap" />}{s === 'updated' ? 'Zuletzt geändert' : 'Name'}</button>)}</div>}
          </div>
          <div className="gn-actions">
            {view === 'documents' && <div className="gn-new"><button className="gn-new-button gn-menu-trigger" onClick={() => setMenu(menu === 'new' ? null : 'new')} aria-haspopup="menu"><span>+</span>Neu</button>
              {menu === 'new' && <div className="gn-menu" role="menu"><button role="menuitem" onClick={() => { setMenu(null); props.createNote(folderId); }}><FilePlus2 size={18} />Dokument</button><button role="menuitem" onClick={createFolder}><FolderPlus size={18} />Ordner</button><button role="menuitem" onClick={() => { setMenu(null); props.photoImport(folderId); }}><Camera size={18} />Aus Foto (Text oder Tafelbild)</button></div>}</div>}
            <button className="gn-icon" aria-label={layoutMode === 'grid' ? 'Als Liste anzeigen' : 'Als Raster anzeigen'} title={layoutMode === 'grid' ? 'Liste' : 'Raster'} onClick={() => { const next = layoutMode === 'grid' ? 'list' : 'grid'; setLayoutMode(next); remember('hs-layout', next); }}>{layoutMode === 'grid' ? <LayoutGrid size={24} strokeWidth={1.6} /> : <List size={24} strokeWidth={1.6} />}</button>
            <span className="gn-divider" />
            <button className={`gn-icon gn-cloud ${props.saveStatus.includes('fehl') ? 'error' : ''}`} title={props.saveStatus} aria-label={`${props.saveStatus} – Sicherung öffnen`} onClick={props.openSettings}><Cloud size={26} strokeWidth={1.6} /><Check size={11} strokeWidth={3} /></button>
          </div>
        </div>
        {items.length ? <div className={`gn-grid ${layoutMode === 'list' ? 'list' : ''}`}>{items.map(card)}</div>
          : <div className="gn-empty"><EmptyIllustration star={view === 'favorites'} /><p>{query ? `Nichts gefunden für „${query}“.` : view === 'favorites' ? 'Es befinden sich keine Dokumente in „Favoriten“.' : 'Dieser Ordner ist leer.'}</p>{view === 'documents' && !query && <button className="gn-new-button" onClick={() => props.createNote(folderId)}><span>+</span>Neues Dokument</button>}</div>}
      </>}
    </main>
  </div>;
}

const NoteCover = memo(function NoteCover({ note, profiles, templates }: { note: Note; profiles: Profile[]; templates?: Template[] }) {
  const background = note.settings.paper === 'custom' ? templates?.find(t => t.id === note.settings.templateId)?.pages[0] : undefined;
  return <span className={`gn-page paper-${note.settings.paper}`} style={background ? { backgroundImage: `url(${background})` } : undefined}><MiniPreview note={note} profiles={profiles} /></span>;
});

export function MiniPreview({ note, profiles }: { note: Note; profiles: Profile[] }) {
  const data = layout(note, profiles);
  return <svg viewBox="0 0 794 1123" aria-hidden="true">{data.glyphs.filter(g => g.page === 0 && !note.edits[g.id]?.deleted).slice(0, 600).map(g => { const e = note.edits[g.id]; return <g key={g.id} transform={`translate(${e?.dx || 0},${e?.dy || 0})`}>{g.raster && <image href={g.raster.data} x={g.raster.x} y={g.raster.y} width={g.raster.width} height={g.raster.height} preserveAspectRatio="none" />}{!g.hiddenByRaster && g.strokes.filter((_, i) => !e?.hiddenStrokes?.includes(i)).map((s, i) => <path key={i} d={pathData(s)} fill="none" stroke={e?.color || note.settings.color} strokeWidth={note.settings.penWidth + 1.5} strokeLinecap="round" />)}</g>; })}{(note.drawings || []).filter(d => d.page === 0 && !d.deleted).flatMap(d => resolvedDrawingInk(d).map((ink, i) => <path key={`${d.id}-${i}`} d={pathData(ink.points)} fill="none" stroke={ink.color} strokeWidth={d.penWidth * d.scale + 1} strokeLinecap="round" />))}</svg>;
}

function FolderIcon({ color }: { color: string }) {
  return <svg className="gn-folder-svg" viewBox="0 0 210 170" aria-hidden="true">
    <path d="M14 18c0-7 5-12 12-12h52c5 0 8 2 11 6l9 11h86c7 0 12 5 12 12v18H14z" fill={color} style={{ filter: 'brightness(.88)' }} />
    <rect x="4" y="34" width="202" height="132" rx="14" fill={color} />
    <rect x="4" y="34" width="202" height="132" rx="14" fill="url(#gn-shine)" />
    <defs><linearGradient id="gn-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
  </svg>;
}
const SidebarIcon = () => <svg width="34" height="26" viewBox="0 0 34 26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="1.5" y="1.5" width="31" height="23" rx="5" /><path d="M12 1.5v23M5 7h3.5M5 11h3.5M5 15h3.5" /></svg>;
const DocsIcon = ({ active }: { active: boolean }) => <svg width="30" height="26" viewBox="0 0 30 26" aria-hidden="true"><path d="M2 5.5C2 3.6 3.6 2 5.5 2h6.3c1 0 1.9.4 2.5 1.2L16 5.5h8.5c1.9 0 3.5 1.6 3.5 3.5v11.5c0 1.9-1.6 3.5-3.5 3.5h-19C3.6 24 2 22.4 2 20.5z" fill={active ? '#36b6f5' : 'none'} stroke={active ? '#1d9be0' : 'currentColor'} strokeWidth="1.8" /><path d="M2 9.5h26" stroke={active ? '#7fd3fb' : 'currentColor'} strokeWidth="1.8" /></svg>;
const FavIcon = ({ active }: { active: boolean }) => <svg width="26" height="28" viewBox="0 0 26 28" aria-hidden="true"><path d="M4 4.5C4 3.1 5.1 2 6.5 2h13C20.9 2 22 3.1 22 4.5V26l-9-5.5L4 26z" fill={active ? '#f0453a' : 'none'} stroke={active ? '#f0453a' : 'currentColor'} strokeWidth="1.8" strokeLinejoin="round" /><path d="m13 7.2 1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill={active ? '#fff' : 'none'} stroke={active ? 'none' : 'currentColor'} strokeWidth="1.4" strokeLinejoin="round" /></svg>;
const EmptyIllustration = ({ star }: { star: boolean }) => <svg width="130" height="170" viewBox="0 0 130 170" aria-hidden="true"><rect x="8" y="22" width="114" height="146" rx="4" fill="#dcecf8" /><rect x="8" y="150" width="114" height="18" rx="3" fill="#cfe6f8" /><path d="M42 66h30" stroke="#64a9ec" strokeWidth="3" strokeLinecap="round" />{star && <><path d="m104 18 4 8 9 1.3-6.5 6.3 1.5 8.9-8-4.2-8 4.2 1.5-8.9-6.5-6.3 9-1.3z" fill="#f59c8f" /><path d="M93 5l4 6M104 2v6M115 5l-4 6" stroke="#64a9ec" strokeWidth="1.5" strokeLinecap="round" /></>}</svg>;
