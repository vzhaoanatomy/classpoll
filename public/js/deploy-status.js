/**
 * Deploy status bar — shows live server version and polls for updates after a push.
 */
(function () {
  const bar = document.getElementById('deploy-bar');
  if (!bar) return;

  const versionEl = document.getElementById('deploy-version');
  const progressWrap = document.getElementById('deploy-progress');
  const progressFill = document.getElementById('deploy-progress-fill');
  const statusEl = document.getElementById('deploy-status-text');
  const checkBtn = document.getElementById('deploy-check-btn');

  let serverVersion = null;
  let pollTimer = null;

  function setProgress(pct, text) {
    if (progressWrap) progressWrap.classList.remove('hidden');
    if (progressFill) progressFill.style.width = `${Math.min(100, pct)}%`;
    if (statusEl && text) statusEl.textContent = text;
  }

  function hideProgress() {
    if (progressWrap) progressWrap.classList.add('hidden');
    if (progressFill) progressFill.style.width = '0%';
  }

  async function fetchVersion() {
    const res = await fetch(appUrl('api/version'), { cache: 'no-store' });
    if (!res.ok) throw new Error('Version check failed');
    return res.json();
  }

  async function showCurrentVersion() {
    try {
      const info = await fetchVersion();
      serverVersion = info.commit;
      const mode = info.isPublic ? ' · Online' : ' · Local';
      if (versionEl) {
        versionEl.textContent = `Live: ${info.commit}${mode}`;
      }
      if (info.isPublic && statusEl) {
        statusEl.textContent = 'Students join via public link — any network';
      }
      return info;
    } catch {
      if (versionEl) versionEl.textContent = 'Live: offline';
      return null;
    }
  }

  async function pollForUpdate(maxSeconds) {
    const startVersion = serverVersion;
    const start = Date.now();
    setProgress(5, 'Checking for new deploy…');

    return new Promise((resolve) => {
      pollTimer = setInterval(async () => {
        const elapsed = (Date.now() - start) / 1000;
        const pct = Math.min(95, (elapsed / maxSeconds) * 100);
        setProgress(pct, `Waiting for Render deploy… ${Math.round(elapsed)}s`);

        try {
          const info = await fetchVersion();
          if (info.commit && info.commit !== startVersion) {
            clearInterval(pollTimer);
            setProgress(100, 'Update ready! Reloading…');
            setTimeout(() => window.location.reload(true), 800);
            resolve(true);
            return;
          }
        } catch { /* keep polling */ }

        if (elapsed >= maxSeconds) {
          clearInterval(pollTimer);
          hideProgress();
          if (statusEl) {
            statusEl.textContent = 'No new deploy yet — try again in a minute or hard-refresh (Cmd+Shift+R)';
          }
          resolve(false);
        }
      }, 3000);
    });
  }

  showCurrentVersion();

  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      checkBtn.disabled = true;
      pollForUpdate(90).finally(() => {
        checkBtn.disabled = false;
      });
    });
  }
})();
