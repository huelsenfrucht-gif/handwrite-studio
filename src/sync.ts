import { newNote, type Library } from './model';
import { validateLibrary } from './storage';
import { HandwriteNative, hasNative } from './native';

/**
 * iCloud sync without an iCloud entitlement: the user picks a folder in
 * iCloud Drive once (on every device the same one). The app keeps one library
 * file there and merges it with the local library item by item, the newer
 * version of each document, folder, handwriting and template wins. Deletions
 * are remembered as tombstones so they do not come back from another device.
 */
export const SYNC_FILE = 'Handwrite-Studio-Sync.json';
const TOMBSTONE_DAYS = 120;

type Item = { id: string };
const stamp = (item: { updated?: string; created?: string }) => item.updated || item.created || '';

function mergeList<T extends Item>(a: T[], b: T[], time: (x: T) => string, deleted: Record<string, string>): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) { const seen = byId.get(item.id); if (!seen || time(item) > time(seen)) byId.set(item.id, item); }
  // Deleted after its last change → stays deleted. Changed after deletion → restored.
  return [...byId.values()].filter(item => !deleted[item.id] || time(item) > deleted[item.id]);
}

/** Merges two libraries; local keeps its open document. Pure and idempotent. */
export function mergeLibraries(local: Library, remote: Library, now = new Date()): Library {
  const cutoff = new Date(now.getTime() - TOMBSTONE_DAYS * 864e5).toISOString(), deleted: Record<string, string> = {};
  for (const [id, at] of [...Object.entries(remote.deleted || {}), ...Object.entries(local.deleted || {})]) if (at >= cutoff && (!deleted[id] || at > deleted[id])) deleted[id] = at;
  const notes = mergeList(local.notes, remote.notes, n => n.updated, deleted);
  if (!notes.length) notes.push(newNote());
  const profiles = mergeList(local.profiles, remote.profiles, stamp, deleted);
  const folders = mergeList(local.folders || [], remote.folders || [], f => f.updated, deleted);
  const templates = mergeList(local.templates || [], remote.templates || [], t => t.created, deleted);
  const known = new Set(profiles.map(p => p.id)), folderIds = new Set(folders.map(f => f.id));
  return {
    ...local,
    // A document may point to a handwriting or folder that was removed elsewhere.
    notes: notes.map(n => ({ ...n, folderId: n.folderId && folderIds.has(n.folderId) ? n.folderId : undefined, settings: known.has(n.settings.profileId) || n.settings.profileId === 'demo' ? n.settings : { ...n.settings, profileId: 'demo' } })),
    profiles, folders: folders.map(f => f.parentId && !folderIds.has(f.parentId) ? { ...f, parentId: undefined } : f), templates, deleted,
    activeId: notes.some(n => n.id === local.activeId) ? local.activeId : notes[0].id,
  };
}

const fingerprint = (l: Library) => JSON.stringify([l.notes.map(n => [n.id, n.updated]), l.profiles.map(p => [p.id, stamp(p)]), (l.folders || []).map(f => [f.id, f.updated]), (l.templates || []).map(t => t.id), Object.keys(l.deleted || {}).length]);

export type SyncState = { connected: boolean; folder?: string; iCloud?: boolean; last?: string; error?: string };
export async function syncState(): Promise<SyncState> {
  if (!hasNative()) return { connected: false };
  try { const s = await HandwriteNative.syncStatus(); return { connected: s.connected, folder: s.name, iCloud: s.iCloud }; } catch { return { connected: false }; }
}

/** Reads the shared file, merges, writes back if needed. Returns the merged library, or null if nothing changed locally. */
export async function syncLibrary(local: Library): Promise<Library | null> {
  const { data } = await HandwriteNative.readSyncFile({ name: SYNC_FILE });
  let remote: Library | null = null;
  if (data) { try { remote = validateLibrary(JSON.parse(data)); } catch { throw new Error('Die Sync-Datei in iCloud ist beschädigt. Sie wird nicht überschrieben.'); } }
  const merged = remote ? mergeLibraries(local, remote) : local;
  if (!remote || fingerprint(merged) !== fingerprint(remote)) await HandwriteNative.writeSyncFile({ name: SYNC_FILE, data: JSON.stringify({ ...merged, activeId: merged.activeId }) });
  return remote && fingerprint(merged) !== fingerprint(local) ? merged : null;
}
