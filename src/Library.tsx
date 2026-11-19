import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Camera, Check, ChevronRight, Mic, MoreHorizontal, FolderClosed, CircleHelp, CheckCheck, CornerLeftUp, Copy, FilePlus2, Files, FolderInput, FolderPlus, LayoutGrid, List, ListFilter, Palette, Pencil, PenLine, Search, Settings, Star, Trash2, X } from 'lucide-react';
import { FOLDER_COLORS, newNote, pathData, uid, type Folder, type Library, type Note, type Profile, type Template } from './model';
import { firstPageLayout, resolvedDrawingInk } from './engine';

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
  openNote: (id: string) => void; createNote: (folderId?: string) => void; photoImport: (folderId?: string) => void; lecture: () => void;
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
    // Documents first, then folders.
    return [...list.filter(i => i.kind === 'note').sort(by), ...list.filter(i => i.kind === 'folder').sort(by)];
  }, [folders, library.notes, query, view, folderId, filter, sort]);

  const now = () => new Date().toISOString();
  const createFolder = () => { const f: Folder = { id: uid(), name: 'Neuer Ordner', color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length], parentId: view === 'documents' ? folderId : undefined, created: now(), updated: now() }; update(l => ({ ...l, folders: [...(l.folders || []), f] })); setRenaming(f.id); setMenu(null); };
  const editFolder = (id: string, fn: (f: Folder) => Folder) => update(l => ({ ...l, folders: (l.folders || []).map(f => f.id === id ? { ...fn(f), updated: now() } : f) }));
  const editNote = (id: string, fn: (n: Note) => Note) => update(l => ({ ...l, notes: l.notes.map(n => n.id === id ? fn(n) : n) }));
  const rename = (item: Item, name: string) => { const value = name.trim().slice(0, 100); setRenaming(null); if (!value) return; if (item.kind === 'folder') editFolder(item.folder.id, f => ({ ...f, name: value })); else editNote(item.note.id, n => ({ ...n, title: value, updated: now() })); };
  const toggleFavorite = (item: Item) => { if (item.kind === 'folder') update(l => ({ ...l, folders: (l.folders || []).map(f => f.id === item.folder.id ? { ...f, favorite: !f.favorite, updated: now() } : f) })); else editNote(item.note.id, n => ({ ...n, favorite: !n.favorite, updated: now() })); };
  const descendants = (id: string): Set<string> => { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } } return out; };
  const moveItem = (item: Item, target?: string) => { setMenu(null); if (item.kind === 'folder') editFolder(item.folder.id, f => ({ ...f, parentId: target })); else editNote(item.note.id, n => ({ ...n, folderId: target, updated: now() })); notify(`„${item.name}“ verschoben nach ${target ? folders.find(f => f.id === target)?.name : 'Dokumente'}.`); };
  const duplicate = (n: Note) => { const copy = { ...structuredClone(n), id: uid(), title: `${n.title} – Kopie`, favorite: false, updated: now() }; update(l => ({ ...l, notes: [copy, ...l.notes] })); setMenu(null); notify('Dokument dupliziert.'); };
  const remove = (item: Item) => {
    setMenu(null);
    if (item.kind === 'note') { if (!confirm(`Dokument „${item.name}“ löschen?`)) return; update(l => { const notes = l.notes.filter(x => x.id !== item.note.id); if (!notes.length) notes.push(newNote()); return { ...l, notes, activeId: l.activeId === item.note.id ? notes[0].id : l.activeId, deleted: { ...l.deleted, [item.note.id]: now() } }; }); return; }
    const f = item.folder; if (!confirm(`Ordner „${f.name}“ löschen? Sein Inhalt wird eine Ebene nach oben verschoben, es geht nichts verloren.`)) return;
    update(l => ({ ...l, folders: (l.folders || []).filter(x => x.id !== f.id).map(x => x.parentId === f.id ? { ...x, parentId: f.parentId, updated: now() } : x), notes: l.notes.map(n => n.folderId === f.id ? { ...n, folderId: f.parentId, updated: now() } : n), deleted: { ...l.deleted, [f.id]: now() } }));
  };
  // Selection mode: pick several documents/folders, select all, delete them at once.
  const [selecting, setSelecting] = useState(false), [picked, setPicked] = useState<Set<string>>(() => new Set());
  const itemId = (item: Item) => item.kind === 'folder' ? item.folder.id : item.note.id;
  const togglePick = (id: string) => setPicked(p => { const next = new Set(p); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  const removePicked = () => {
    const chosen = items.filter(i => picked.has(itemId(i))); if (!chosen.length) return;
    const folderIds = new Set(chosen.filter(i => i.kind === 'folder').flatMap(i => [...descendants(itemId(i))]));
    const noteIds = new Set([...chosen.filter(i => i.kind === 'note').map(itemId), ...library.notes.filter(n => n.folderId && folderIds.has(n.folderId)).map(n => n.id)]);
    const docs = noteIds.size, dirs = chosen.filter(i => i.kind === 'folder').length;
    if (!confirm(`${[docs ? `${docs} Dokument${docs === 1 ? '' : 'e'}` : '', dirs ? `${dirs} Ordner samt Inhalt` : ''].filter(Boolean).join(' und ')} löschen? Das lässt sich nicht rückgängig machen.`)) return;
    const at = now();
    update(l => { const notes = l.notes.filter(n => !noteIds.has(n.id)); if (!notes.length) notes.push(newNote()); return { ...l, notes, folders: (l.folders || []).filter(f => !folderIds.has(f.id)), activeId: notes.some(n => n.id === l.activeId) ? l.activeId : notes[0].id, deleted: { ...l.deleted, ...Object.fromEntries([...noteIds, ...folderIds].map(id => [id, at])) } }; });
    notify(`${docs + dirs} Element${docs + dirs === 1 ? '' : 'e'} gelöscht.`); stopSelecting();
  };
  const openFolder = (id?: string) => { setPicked(new Set()); setFolderId(id); setQuery(''); setSearching(false); if (view !== 'documents') props.setView('documents'); };
  // Drag & drop: documents and folders onto a folder, or out of the current folder.
  // Mouse: drag after a few pixels. Touch (iPad/iPhone): hold briefly, then drag.
  const [drag, setDrag] = useState<{ item: Item; x: number; y: number; over?: string } | null>(null);
  const suppressClick = useRef(false);
  const dropTarget = (x: number, y: number, item: Item) => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]');
    if (!el) return undefined;
    const target = el.dataset.drop!, id = target === 'root' ? undefined : target;
    const parent = item.kind === 'folder' ? item.folder.parentId : item.note.folderId;
    if (id === parent || (item.kind === 'folder' && id && descendants(item.folder.id).has(id))) return undefined;
    return target;
  };
  const press = (e: ReactPointerEvent, item: Item) => {
    if (e.button !== 0 || renaming) return;
    const touch = e.pointerType !== 'mouse', sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let active = false, last = { x: sx, y: sy }, timer = 0;
    const begin = () => { active = true; suppressClick.current = true; setMenu(null); navigator.vibrate?.(10); setDrag({ item, x: last.x, y: last.y }); };
    const blockScroll = (ev: TouchEvent) => { if (active) ev.preventDefault(); };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      last = { x: ev.clientX, y: ev.clientY };
      const dist = Math.hypot(last.x - sx, last.y - sy);
      if (!active) { if (touch) { if (dist > 10) end(); } else if (dist > 6) begin(); return; }
      setDrag({ item, ...last, over: dropTarget(last.x, last.y, item) });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (active) { const target = dropTarget(ev.clientX, ev.clientY, item); if (target) moveItem(item, target === 'root' ? undefined : target); }
      end();
    };
    const end = () => {
      clearTimeout(timer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); document.removeEventListener('touchmove', blockScroll);
      if (active) { setDrag(null); setTimeout(() => { suppressClick.current = false; }, 50); }
    };
    const cancel = (ev: PointerEvent) => { if (ev.pointerId === pid && !active) end(); };
    if (touch) timer = window.setTimeout(begin, 380);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    document.addEventListener('touchmove', blockScroll, { passive: false });
  };
  const filterLabel = { all: 'Alle', notes: 'Dokumente', folders: 'Ordner' }[filter];
  const home = view === 'documents' && !folderId && !query;
  const recent = useMemo(() => [...library.notes].sort((a, b) => b.updated.localeCompare(a.updated))[0], [library.notes]);
  const title = searching && query ? 'Suche' : view === 'favorites' ? 'Favoriten' : view === 'profiles' ? 'Meine Handschriften' : current?.name || 'Dokumente';

  const card = (item: Item) => {
    const id = item.kind === 'folder' ? item.folder.id : item.note.id, fav = item.kind === 'folder' ? item.folder.favorite : item.note.favorite;
    const open = () => item.kind === 'folder' ? openFolder(item.folder.id) : props.openNote(item.note.id);
    const targets = [{ id: undefined as string | undefined, name: 'Dokumente' }, ...folders.filter(f => item.kind !== 'folder' || !descendants(item.folder.id).has(f.id)).map(f => ({ id: f.id as string | undefined, name: f.name }))]
      .filter(t => t.id !== (item.kind === 'folder' ? item.folder.parentId : item.note.folderId));
    const dropping = drag && drag.over === id, dragged = drag && (drag.item.kind === 'folder' ? drag.item.folder.id : drag.item.note.id) === id;
    const isPicked = selecting && picked.has(id);
    return <article key={id} className={`gn-item gn-${item.kind} ${dropping ? 'drop-over' : ''} ${dragged ? 'dragging' : ''} ${isPicked ? 'picked' : ''}`} data-drop={item.kind === 'folder' ? item.folder.id : undefined}>
      <div className="gn-cover-wrap">
        <button className="gn-cover" onPointerDown={e => { if (!selecting) press(e, item); }} onContextMenu={e => e.preventDefault()} onClick={() => { if (suppressClick.current) return; if (selecting) togglePick(id); else open(); }} aria-label={selecting ? `${item.name} ${isPicked ? 'abwählen' : 'auswählen'}` : `${item.name} öffnen`} aria-pressed={selecting ? isPicked : undefined}>{item.kind === 'folder' ? <FolderIcon color={item.folder.color} /> : <NoteCover note={item.note} profiles={library.profiles} templates={library.templates} />}</button>
        {selecting && <span className={`gn-check ${isPicked ? 'on' : ''}`} aria-hidden="true">{isPicked && <Check size={15} strokeWidth={3} />}</span>}{!selecting && <button className={`gn-star ${fav ? 'on' : ''}`} aria-pressed={!!fav} aria-label={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'} onClick={() => toggleFavorite(item)}><Star size={18} /></button>}
      </div>
      <div className="gn-caption">
        {renaming === id ? <input className="gn-rename" autoFocus defaultValue={item.name} maxLength={100} aria-label="Neuer Name" onFocus={e => e.currentTarget.select()} onBlur={e => rename(item, e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }} />
          : <div className="hs-card-info"><div className="hs-card-text"><strong>{item.name}</strong><small>{item.kind === 'folder' ? `${library.notes.filter(n => n.folderId === item.folder.id).length + folders.filter(f => f.parentId === item.folder.id).length} Elemente · ` : ''}{stamp(item.updated)}</small></div><button className="hs-more gn-menu-trigger" onClick={() => setMenu(menu === id ? null : id)} aria-haspopup="menu" aria-expanded={menu === id} aria-label={`${item.name}: Aktionen`}><MoreHorizontal size={18} /></button></div>}
        {menu === id && <Menu>
          <button role="menuitem" onClick={() => { setMenu(null); setRenaming(id); }}><Pencil size={16} />Umbenennen</button>
          <button role="menuitem" onClick={() => { setMenu(null); toggleFavorite(item); }}><Star size={16} />{fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}</button>
          {item.kind === 'note' && <button role="menuitem" onClick={() => duplicate(item.note)}><Copy size={16} />Duplizieren</button>}
          {item.kind === 'folder' && <div className="gn-colors" role="group" aria-label="Ordnerfarbe"><Palette size={16} />{FOLDER_COLORS.map(c => <button key={c} style={{ background: c }} aria-label={`Farbe ${c}`} className={item.folder.color === c ? 'on' : ''} onClick={() => editFolder(item.folder.id, f => ({ ...f, color: c }))}>{item.folder.color === c && <Check size={11} />}</button>)}</div>}
          {targets.length > 0 && <details className="gn-move"><summary><FolderInput size={16} />Verschieben nach …<ChevronRight size={14} /></summary>{targets.map(t => <button key={t.id || 'root'} role="menuitem" onClick={() => moveItem(item, t.id)}>{t.name}</button>)}</details>}
          <button role="menuitem" className="danger" onClick={() => remove(item)}><Trash2 size={16} />Löschen</button>
        </Menu>}
      </div>
    </article>;
  };

  return <div className={`gn-shell ${collapsed ? 'collapsed' : ''}`}>
    <aside className="gn-sidebar" aria-label="Bibliothek">
      <div className="gn-brand"><PenLine size={28} strokeWidth={1.6} /><span>Handwritten</span>
        <button className="gn-collapse" aria-label="Seitenleiste ausblenden" onClick={() => setCollapsed(true)}><SidebarIcon /></button></div>
      <nav onClick={() => { if (narrow()) setCollapsed(true); }}>
        <button data-drop="root" className={`${view === 'documents' && !searching ? 'active' : ''} ${drag?.over === 'root' ? 'drop-over' : ''}`} onClick={() => { props.setView('documents'); openFolder(undefined); }}><Files size={21} strokeWidth={1.6} />Dokumente</button>
        <button className={view === 'favorites' ? 'active' : ''} onClick={() => { props.setView('favorites'); setQuery(''); setSearching(false); }}><Star size={21} strokeWidth={1.6} />Favoriten</button>
        <button className={view === 'profiles' ? 'active' : ''} onClick={() => props.setView('profiles')}><span className="gn-hand">Aa</span>Handschriften</button>
      </nav>
      <hr />
      <nav onClick={() => { if (narrow()) setCollapsed(true); }}>
        <button onClick={props.openSettings}><Settings size={21} strokeWidth={1.6} />Einstellungen</button>
        <button onClick={props.openHelp}><CircleHelp size={21} strokeWidth={1.6} />Hilfe</button>
      </nav>
    </aside>
    {collapsed && <button className="gn-expand" aria-label="Seitenleiste einblenden" onClick={() => setCollapsed(false)}><SidebarIcon /></button>}
    <div className="gn-pill">
      {searching ? <span className="gn-search"><Search size={18} /><input autoFocus placeholder="Suchen" aria-label="Dokumente und Ordner suchen" value={query} onChange={e => { setQuery(e.target.value); if (view === 'profiles') props.setView('documents'); }} /><button aria-label="Suche schließen" onClick={() => { setQuery(''); setSearching(false); }}><X size={16} /></button></span>
        : view !== 'profiles' && <button aria-label="Suchen" title="Suchen" onClick={() => setSearching(true)}><Search size={24} strokeWidth={1.7} /></button>}
      {collapsed && <button className="gn-gear" aria-label="Einstellungen" title="Einstellungen" onClick={props.openSettings}><Settings size={24} strokeWidth={1.7} /></button>}
    </div>
    <main className="gn-main">
      {path.length > 0 && view === 'documents' && !query && <nav className="gn-crumbs" aria-label="Ordnerpfad"><button data-drop="root" className={drag?.over === 'root' ? 'drop-over' : ''} onClick={() => openFolder(undefined)}>Dokumente</button>{path.map((f, i) => <span key={f.id}><ChevronRight size={14} />{i === path.length - 1 ? <strong>{f.name}</strong> : <button data-drop={f.id} className={drag?.over === f.id ? 'drop-over' : ''} onClick={() => openFolder(f.id)}>{f.name}</button>}</span>)}</nav>}
      {home ? <section className="gn-hero">
        <div className="gn-hero-text"><h1>Dokumente</h1><p>Schreib deinen Text, den Rest erledigt deine Handschrift.</p>
          <button className="gn-primary" onClick={() => props.createNote()}>Neues Dokument<ChevronRight size={20} /></button></div>
        {recent && <button className="gn-recent" onClick={() => props.openNote(recent.id)} aria-label={`${recent.title || 'Unbenannt'} weiterschreiben`}>
          <span className="gn-recent-stack"><span className="gn-sheet-back" /><NoteCover note={recent} profiles={library.profiles} templates={library.templates} /></span>
          <span className="gn-recent-label"><small>Zuletzt bearbeitet</small><strong>{recent.title || 'Unbenannt'}</strong><em>Weiterschreiben<ChevronRight size={15} /></em></span>
        </button>}
      </section> : <h1>{title}</h1>}
      {home && <div className="gn-quick">
        <button onClick={() => props.photoImport()}><Camera size={24} strokeWidth={1.5} /><span>Aus Foto <span className="exp-badge">Experimentell</span></span><ChevronRight size={18} /></button>
        <button onClick={() => props.lecture()}><Mic size={24} strokeWidth={1.5} /><span>Unterricht aufnehmen</span><ChevronRight size={18} /></button>
        <button onClick={() => props.setView('profiles')}><span className="gn-hand">Aa</span><span>Neue Handschrift</span><ChevronRight size={18} /></button>
        <button onClick={createFolder}><FolderPlus size={24} strokeWidth={1.5} /><span>Neuer Ordner</span><ChevronRight size={18} /></button>
      </div>}
      {view === 'profiles' ? props.children : <>
        <div className="gn-toolbar">
          <div className="gn-filter"><button className="gn-menu-trigger" onClick={() => setMenu(menu === 'filter' ? null : 'filter')} aria-haspopup="menu"><ListFilter size={24} strokeWidth={1.6} /><span>{view === 'favorites' ? 'Dokumente' : filterLabel}</span></button>
            {menu === 'filter' && <Menu><small>Anzeigen</small>{(['all', 'notes', 'folders'] as Filter[]).map(f => <button key={f} role="menuitemradio" aria-checked={filter === f} onClick={() => { setFilter(f); remember('hs-filter', f); setMenu(null); }}>{filter === f ? <Check size={16} /> : <span className="gn-gap" />}{{ all: 'Alle', notes: 'Nur Dokumente', folders: 'Nur Ordner' }[f]}</button>)}<small>Sortieren</small>{(['updated', 'name'] as Sort[]).map(s => <button key={s} role="menuitemradio" aria-checked={sort === s} onClick={() => { setSort(s); remember('hs-sort', s); setMenu(null); }}>{sort === s ? <Check size={16} /> : <span className="gn-gap" />}{s === 'updated' ? 'Zuletzt geändert' : 'Name'}</button>)}</Menu>}
          </div>
          {selecting ? <div className="gn-actions gn-selecting">
            <span className="gn-pick-count">{picked.size} ausgewählt</span>
            <button className="gn-text-button" onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map(itemId)))}>{picked.size === items.length && items.length ? 'Keine auswählen' : 'Alle auswählen'}</button>
            <button className="gn-text-button danger" disabled={!picked.size} onClick={removePicked}><Trash2 size={17} />Löschen</button>
            <button className="gn-new-button" onClick={stopSelecting}>Fertig</button>
          </div> : <div className="gn-actions">
            {view === 'documents' && <div className="gn-new"><button className="gn-new-button gn-menu-trigger" onClick={() => setMenu(menu === 'new' ? null : 'new')} aria-haspopup="menu"><span>+</span>Neu</button>
              {menu === 'new' && <Menu><button role="menuitem" onClick={() => { setMenu(null); props.createNote(folderId); }}><FilePlus2 size={18} />Dokument</button><button role="menuitem" onClick={createFolder}><FolderPlus size={18} />Ordner</button><button role="menuitem" onClick={() => { setMenu(null); props.photoImport(folderId); }}><Camera size={18} />Aus Foto (Text oder Tafel) <span className="exp-badge">Experimentell</span></button></Menu>}</div>}
            <button className="gn-icon" aria-label={layoutMode === 'grid' ? 'Als Liste anzeigen' : 'Als Raster anzeigen'} title={layoutMode === 'grid' ? 'Liste' : 'Raster'} onClick={() => { const next = layoutMode === 'grid' ? 'list' : 'grid'; setLayoutMode(next); remember('hs-layout', next); }}>{layoutMode === 'grid' ? <LayoutGrid size={24} strokeWidth={1.6} /> : <List size={24} strokeWidth={1.6} />}</button>
            <span className="gn-divider" />
            <button className="gn-icon" title="Auswählen" aria-label="Auswählen" disabled={!items.length} onClick={() => { setMenu(null); setSelecting(true); }}><CheckCheck size={24} strokeWidth={1.6} /></button>
          </div>}
        </div>
        {items.length ? <div className={`gn-grid ${layoutMode === 'list' ? 'list' : ''}`}>{items.map(card)}</div>
          : <div className="gn-empty"><EmptyIllustration star={view === 'favorites'} /><p>{query ? `Nichts gefunden für „${query}“.` : view === 'favorites' ? 'Es befinden sich keine Dokumente in „Favoriten“.' : 'Dieser Ordner ist leer.'}</p>{view === 'documents' && !query && <button className="gn-new-button" onClick={() => props.createNote(folderId)}><span>+</span>Neues Dokument</button>}</div>}
      </>}
      {drag && current && view === 'documents' && <div className={`gn-dropout ${drag.over === (current.parentId || 'root') ? 'drop-over' : ''}`} data-drop={current.parentId || 'root'}><CornerLeftUp size={18} />Hierher ziehen: raus aus „{current.name}“</div>}
    </main>
    {drag && <div className="gn-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.item.kind === 'folder' ? <FolderIcon color={drag.item.folder.color} /> : <NoteCover note={drag.item.note} profiles={library.profiles} templates={library.templates} />}<span>{drag.over ? (drag.over === 'root' ? 'Nach Dokumente' : `In „${folders.find(f => f.id === drag.over)?.name}“`) : drag.item.name}</span></div>}
  </div>;
}

const NoteCover = memo(function NoteCover({ note, profiles, templates }: { note: Note; profiles: Profile[]; templates?: Template[] }) {
  const background = note.settings.paper === 'custom' ? templates?.find(t => t.id === note.settings.templateId)?.pages[0] : undefined;
  return <span className={`gn-page paper-${note.settings.paper}`} style={background ? { backgroundImage: `url(${background})` } : undefined}><MiniPreview note={note} profiles={profiles} /></span>;
});

// Covers are drawn once per document version and kept, so switching views or folding the sidebar
// does not lay out every document again (that made the library stutter with many documents).
const coverCache = new Map<string, { strokes: { d: string; color: string; w: number }[]; rasters: { href: string; x: number; y: number; w: number; h: number }[] }>();
function coverData(note: Note, profiles: Profile[]) {
  const key = `${note.id}:${note.updated}:${note.settings.profileId}:${profiles.find(p => p.id === note.settings.profileId)?.updated || ''}`;
  let hit = coverCache.get(key);
  if (hit) return hit;
  const strokes: { d: string; color: string; w: number }[] = [], rasters: { href: string; x: number; y: number; w: number; h: number }[] = [];
  const byColor = new Map<string, string[]>();
  for (const g of firstPageLayout(note, profiles).slice(0, 900)) {
    const e = note.edits[g.id]; if (e?.deleted) continue;
    const dx = e?.dx || 0, dy = e?.dy || 0, color = e?.color || note.settings.color;
    if (g.raster) rasters.push({ href: g.raster.data, x: g.raster.x + dx, y: g.raster.y + dy, w: g.raster.width, h: g.raster.height });
    if (g.hiddenByRaster) continue;
    const list = byColor.get(color) || []; byColor.set(color, list);
    g.strokes.forEach((s, i) => { if (!e?.hiddenStrokes?.includes(i)) list.push(pathData(dx || dy ? s.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) : s)); });
  }
  for (const [color, ds] of byColor) strokes.push({ d: ds.join(' '), color, w: note.settings.penWidth + 1.5 });
  for (const d of (note.drawings || []).filter(d => d.page === 0 && !d.deleted)) for (const ink of resolvedDrawingInk(d)) strokes.push({ d: pathData(ink.points), color: ink.color, w: d.penWidth * d.scale + 1 });
  hit = { strokes, rasters };
  if (coverCache.size > 400) coverCache.delete(coverCache.keys().next().value!);
  coverCache.set(key, hit);
  return hit;
}
export const MiniPreview = memo(function MiniPreview({ note, profiles }: { note: Note; profiles: Profile[] }) {
  // Drawn only when the cover comes into view; until then an empty page (no work for off-screen covers).
  const ref = useRef<SVGSVGElement>(null), [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el); return () => io.disconnect();
  }, [visible]);
  const data = visible ? coverData(note, profiles) : null;
  return <svg ref={ref} viewBox="0 0 794 1123" aria-hidden="true">{data?.rasters.map((r, i) => <image key={i} href={r.href} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" />)}{data?.strokes.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={s.w} strokeLinecap="round" />)}</svg>;
});

/** Folder tile: a stack of coloured sheets with a folder symbol (own design, no desktop folder look-alike). */
function FolderIcon({ color }: { color: string }) {
  return <span className="hs-folder" style={{ ['--fc' as string]: color }} aria-hidden="true"><span className="hs-folder-sheet b" /><span className="hs-folder-sheet a" /><span className="hs-folder-face"><FolderClosed size={30} strokeWidth={1.6} /></span></span>;
}
const SidebarIcon = () => <svg width="34" height="26" viewBox="0 0 34 26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="1.5" y="1.5" width="31" height="23" rx="5" /><path d="M12 1.5v23M5 7h3.5M5 11h3.5M5 15h3.5" /></svg>;
const EmptyIllustration = ({ star }: { star: boolean }) => <svg width="130" height="170" viewBox="0 0 130 170" aria-hidden="true"><rect x="8" y="22" width="114" height="146" rx="4" fill="#dcecf8" /><rect x="8" y="150" width="114" height="18" rx="3" fill="#cfe6f8" /><path d="M42 66h30" stroke="#64a9ec" strokeWidth="3" strokeLinecap="round" />{star && <><path d="m104 18 4 8 9 1.3-6.5 6.3 1.5 8.9-8-4.2-8 4.2 1.5-8.9-6.5-6.3 9-1.3z" fill="#f59c8f" /><path d="M93 5l4 6M104 2v6M115 5l-4 6" stroke="#64a9ec" strokeWidth="1.5" strokeLinecap="round" /></>}</svg>;

/** Drop-down menu that always stays inside the visible screen: shifted sideways, opened upwards when there is no room below. */
function Menu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      el.style.translate = ''; el.classList.remove('up');
      const m = 12, vw = Math.min(window.visualViewport?.width ?? window.innerWidth, document.documentElement.clientWidth), vh = window.visualViewport?.height ?? window.innerHeight;
      let r = el.getBoundingClientRect();
      if (r.bottom > vh - m) {
        const below = vh - m - r.top, trigger = el.parentElement?.querySelector('.gn-menu-trigger')?.getBoundingClientRect();
        const above = (trigger ? trigger.top : r.top) - m;
        if (above > below) { el.classList.add('up'); r = el.getBoundingClientRect(); }
      }
      let dx = 0, dy = 0;
      if (r.left < m) dx = m - r.left; else if (r.right > vw - m) dx = vw - m - r.right;
      if (r.bottom > vh - m) dy = vh - m - r.bottom;
      if (r.top + dy < m) dy = m - r.top;
      if (dx || dy) el.style.translate = `${dx}px ${dy}px`;
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  return <div ref={ref} className="gn-menu" role="menu">{children}</div>;
}
