/**
 * App language (German or English). Texts are written in German in the code and looked up
 * in the English table when English is chosen. Placeholders: {name}.
 * Changing the language reloads the app, so every text (also module-level ones) is fresh.
 */
import { EN } from './i18n.en';

export type Lang = 'de' | 'en';
const KEY = 'hs-lang';

function initial(): Lang {
  try { const v = localStorage.getItem(KEY); if (v === 'de' || v === 'en') return v; } catch { /* private mode */ }
  // First start: follow the iPad's language (German unless it is set to something else). Outside a browser (tests): German.
  const nav = typeof window !== 'undefined' && typeof navigator !== 'undefined' ? (navigator.languages?.[0] || navigator.language || 'de') : 'de';
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en';
}

let lang: Lang = initial();
if (typeof document !== 'undefined') { document.documentElement.lang = lang; if (lang === 'en') document.title = 'Handwritten – Your words. Your handwriting.'; }

export const getLang = () => lang;
/** BCP 47 locale for dates and numbers. */
export const locale = () => (lang === 'en' ? 'en-GB' : 'de-DE');
export function setLang(next: Lang) {
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  lang = next;
}

const missing = new Set<string>();
/** Translate a German UI text. */
export function t(de: string, vars?: Record<string, string | number>): string {
  let s = de;
  if (lang === 'en') {
    const en = EN[de];
    if (en !== undefined) s = en;
    else if (import.meta.env?.DEV && !missing.has(de)) { missing.add(de); console.warn('[i18n] missing:', de); }
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}
/** Singular/plural helper: t1(n, 'Dokument', 'Dokumente') → "1 Dokument" / "3 Dokumente" (translated). */
export const plural = (n: number, one: string, many: string) => `${n.toLocaleString(locale())} ${t(n === 1 ? one : many)}`;
