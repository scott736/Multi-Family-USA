export type Lang = 'en' | 'es';

export function getLangFromUrl(url: URL): Lang {
  return url.pathname === '/es' || url.pathname.startsWith('/es/') ? 'es' : 'en';
}

export function useTranslations(_lang: Lang = 'en') {
  return (key: string) => key;
}

export function useTranslatedPath(lang: Lang = 'en') {
  return (path: string) => {
    if (lang === 'es') {
      if (path === '/') return '/es';
      return path.startsWith('/es') ? path : `/es${path.startsWith('/') ? '' : '/'}${path}`;
    }
    if (path === '/es') return '/';
    return path.startsWith('/es/') ? path.slice(3) : path;
  };
}
