import { Capacitor, registerPlugin } from '@capacitor/core';

export type VisionLine = { text: string; confidence: number; x: number; y: number; width: number; height: number };
type SyncFolder = { connected: boolean; name?: string; iCloud?: boolean };
interface HandwriteNativePlugin {
  recognizeText(options: { image: string; languages?: string[] }): Promise<{ lines: VisionLine[] }>;
  pickSyncFolder(): Promise<SyncFolder>;
  syncStatus(): Promise<SyncFolder>;
  disconnectSync(): Promise<void>;
  readSyncFile(options: { name: string }): Promise<{ data: string | null; modified?: string }>;
  writeSyncFile(options: { name: string; data: string }): Promise<void>;
  takeSharedImages(): Promise<{ images: string[] }>;
}

/** The app's own Swift plugin (ios/App/App/HandwriteNativePlugin.swift). */
export const HandwriteNative = registerPlugin<HandwriteNativePlugin>('HandwriteNative');
// Registered in Swift (MainViewController) and present in every native build; isPluginAvailable() does not see
// plugins registered that way, so all calls below are guarded with try/catch instead.
export const hasNative = () => Capacitor.isNativePlatform();

/** Apple Vision text recognition; lines in normalised image coordinates (top-left origin). */
export async function visionText(canvas: HTMLCanvasElement): Promise<VisionLine[] | null> {
  if (!hasNative()) return null;
  try {
    const image = canvas.toDataURL('image/jpeg', .9).split(',')[1];
    return (await HandwriteNative.recognizeText({ image, languages: ['de-DE', 'en-US'] })).lines;
  } catch { return null; }
}

/** Photos shared from the Photos app via "Teilen → Handwrite Studio". */
export async function takeSharedImages(): Promise<File[]> {
  if (!hasNative()) return [];
  try {
    const { images } = await HandwriteNative.takeSharedImages();
    return images.map((b64, i) => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return new File([bytes], `Geteiltes Foto ${i + 1}.jpg`, { type: 'image/jpeg' }); });
  } catch { return []; }
}
