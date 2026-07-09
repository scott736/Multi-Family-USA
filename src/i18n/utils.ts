import { defaultLang, ui } from './ui';

export type Lang = keyof typeof ui;
type Key = keyof (typeof ui)[typeof defaultLang];

export function getLangFromUrl(url: URL): Lang {
  return url.pathname === '/es' || url.pathname.startsWith('/es/') ? 'es' : 'en';
}

const translationCache = new Map<Lang, (key: Key) => string>();

export function useTranslations(lang: Lang = defaultLang) {
  const cached = translationCache.get(lang);
  if (cached) return cached;
  const dict = ui[lang] ?? ui[defaultLang];
  const t = (key: Key) =>
    (dict as Record<string, string>)[key] ??
    (ui[defaultLang] as Record<string, string>)[key] ??
    String(key);
  translationCache.set(lang, t);
  return t;
}

export type TranslateFn = ReturnType<typeof useTranslations>;

function useTranslatedPath(lang: Lang = 'en') {
  return (path: string) => {
    if (lang === 'es') {
      if (path === '/') return '/es';
      return path.startsWith('/es') ? path : `/es${path.startsWith('/') ? '' : '/'}${path}`;
    }
    if (path === '/es') return '/';
    return path.startsWith('/es/') ? path.slice(3) : path;
  };
}
