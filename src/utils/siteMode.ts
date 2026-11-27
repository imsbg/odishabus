export type SiteMode = 'seo' | 'app';

export const LIVE_APP_URL = 'https://odishabus.netlify.app/';
export const SEO_GUIDE_URL = 'https://imsbg.github.io/odishabus/';

export interface LocationLike {
  hostname: string;
  pathname?: string;
  search?: string;
}

/**
 * Determines whether to render the SEO blog/feature showcase page or the interactive live map app.
 * - GitHub Pages hosts (e.g., https://imsbg.github.io/odishabus/) default to 'seo' for Google ranking.
 * - Netlify / primary app hosts (e.g., https://odishabus.netlify.app/) and localhost default to 'app'.
 * - Query overrides (?view=guide, ?mode=seo, ?view=app, ?bus=OD...) allow instant switching or deep-linking.
 */
export function resolveSiteMode(loc: LocationLike): SiteMode {
  const params = new URLSearchParams(loc.search || '');
  const viewParam = (params.get('view') || params.get('mode') || '').toLowerCase().trim();

  if (viewParam === 'guide' || viewParam === 'seo' || viewParam === 'blog') {
    return 'seo';
  }
  if (
    viewParam === 'app' ||
    viewParam === 'map' ||
    params.has('bus') ||
    params.has('route') ||
    params.has('stop') ||
    (params.has('from') && params.has('to'))
  ) {
    return 'app';
  }

  const host = (loc.hostname || '').toLowerCase().trim();
  if (host === 'imsbg.github.io' || host.endsWith('.github.io')) {
    return 'seo';
  }

  return 'app';
}
