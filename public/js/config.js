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

  /** True when hosted online (Render, custom domain) — not local dev */
  window.isPublicDeploy = function isPublicDeploy() {
    if (window.__PUBLIC_DEPLOY__) return true;
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return false;
    if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) {
      return false;
    }
    if (h.endsWith('.onrender.com') || h.endsWith('.github.io')) return true;
    // Custom domain or other public host (not a raw IP)
    return !/^\d+\.\d+\.\d+\.\d+$/.test(h);
  };
})();
