/**
 * Base path for assets and API calls.
 * Works on localhost, Render (root), and GitHub Pages (/classpoll/).
 */
(function () {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const repoNames = ['classpoll'];
  const repoIndex = parts.findIndex((p) => repoNames.includes(p.toLowerCase()));

  if (repoIndex >= 0) {
    window.APP_BASE = '/' + parts.slice(0, repoIndex + 1).join('/') + '/';
  } else {
    window.APP_BASE = '/';
  }

  window.appUrl = function appUrl(path) {
    const clean = (path || '').replace(/^\//, '');
    return window.APP_BASE + clean;
  };
})();
