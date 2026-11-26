import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteMode } from './siteMode';

test('resolveSiteMode renders SEO blog page on GitHub Pages and live map app on Netlify', () => {
  assert.equal(
    resolveSiteMode({ hostname: 'imsbg.github.io', pathname: '/odishabus/', search: '' }),
    'seo'
  );
  assert.equal(
    resolveSiteMode({ hostname: 'odishabus.netlify.app', pathname: '/', search: '' }),
    'app'
  );
  assert.equal(
    resolveSiteMode({ hostname: 'localhost', pathname: '/', search: '' }),
    'app'
  );
});

test('resolveSiteMode respects explicit query overrides and bus deep links', () => {
  assert.equal(
    resolveSiteMode({ hostname: 'localhost', pathname: '/', search: '?view=guide' }),
    'seo'
  );
  assert.equal(
    resolveSiteMode({ hostname: 'odishabus.netlify.app', pathname: '/', search: '?mode=seo' }),
    'seo'
  );
  assert.equal(
    resolveSiteMode({ hostname: 'imsbg.github.io', pathname: '/odishabus/', search: '?view=app' }),
    'app'
  );
  assert.equal(
    resolveSiteMode({
      hostname: 'imsbg.github.io',
      pathname: '/odishabus/',
      search: '?bus=OD06M9141'
    }),
    'app'
  );
});
