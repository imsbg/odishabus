import React, { useEffect, useState } from 'react';
import App from './App';
import { OdishaSeoBlogPage } from './components/OdishaSeoBlogPage';
import { resolveSiteMode, SiteMode } from './utils/siteMode';

export const RootRouter: React.FC = () => {
  const [mode, setMode] = useState<SiteMode>(() => resolveSiteMode(window.location));

  // Sync dynamic canonical URL & og:url plus body scroll behavior for SEO blog vs full-screen map
  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;

    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalUrl;

    if (mode === 'seo') {
      document.title =
        'Odisha Bus – Live GPS Bus Tracker, OSRTC, Shree Jagannath Express & Ama Bus Guide';
      document.body.classList.remove('overflow-hidden');
      document.body.classList.add('overflow-y-auto');
    } else {
      document.title = 'Odisha Bus – Live GPS Bus Tracker, OSRTC & Ama Bus Routes';
      document.body.classList.remove('overflow-y-auto');
      document.body.classList.add('overflow-hidden');
    }
  }, [mode]);

  if (mode === 'seo') {
    const isLocalPreview =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('run.app') ||
      window.location.hostname.includes('netlify.app');

    return (
      <OdishaSeoBlogPage
        isLocalPreview={isLocalPreview}
        onOpenLocalApp={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          url.searchParams.delete('mode');
          url.searchParams.delete('page');
          window.history.replaceState({}, '', url.toString());
          setMode('app');
        }}
      />
    );
  }

  return <App />;
};
