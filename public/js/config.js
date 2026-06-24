/**
 * Base path for assets and API calls.
 * Works on localhost, Render (root), and GitHub Pages (/classpoll/).
 *
 * Set RENDER_BACKEND after deploy if using GitHub Pages for static UI only.
 */
(function () {
  const RENDER_BACKEND = 'https://classpoll.onrender.com';

  const parts = window.location.pathname.split('/').filter(Boolean);
  const repoNames = ['classpoll'];
  const repoIndex = parts.findIndex((p) => repoNames.includes(p.toLowerCase()));
  const onGitHubPages = window.location.hostname.endsWith('github.io');

  if (onGitHubPages) {
    window.APP_BASE = repoIndex >= 0
      ? '/' + parts.slice(0, repoIndex + 1).join('/') + '/'
      : '/classpoll/';
    window.API_ORIGIN = RENDER_BACKEND;
  } else if (repoIndex >= 0) {
    window.APP_BASE = '/' + parts.slice(0, repoIndex + 1).join('/') + '/';
    window.API_ORIGIN = '';
  } else {
    window.APP_BASE = '/';
    window.API_ORIGIN = '';
  }

  window.appUrl = function appUrl(path) {
    const clean = (path || '').replace(/^\//, '');
    if (window.API_ORIGIN && clean.startsWith('api/')) {
      return window.API_ORIGIN.replace(/\/$/, '') + '/' + clean;
    }
    return window.APP_BASE + clean;
  };

  window.socketOrigin = window.API_ORIGIN || window.location.origin;
})();
