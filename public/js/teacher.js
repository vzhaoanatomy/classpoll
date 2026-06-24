/**
 * Teacher dashboard — controls session, displays live results.
 */

console.log('[teacher.js] loaded');

const WIFI_IP_KEY = 'classpolling-wifi-ip';

// Session code from ?session=CODE or /teacher/CODE
function getSessionIdFromPath() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('session');
  if (fromQuery && fromQuery.trim()) {
    return fromQuery.trim().toUpperCase();
  }

  const parts = window.location.pathname.split('/').filter(Boolean);
  const teacherIdx = parts.indexOf('teacher');
  if (teacherIdx >= 0 && parts[teacherIdx + 1]) {
    return parts[teacherIdx + 1].toUpperCase();
  }

  return '';
}

const sessionId = getSessionIdFromPath();
console.log('[teacher.js] sessionId:', sessionId);

const socket = typeof io !== 'undefined'
  ? (window.socketOrigin && window.socketOrigin !== window.location.origin
      ? io(window.socketOrigin, { transports: ['websocket', 'polling'] })
      : io())
  : {
      emit: () => {},
      on: () => {},
      get connected() { return false; },
    };

if (typeof io === 'undefined') {
  console.warn('[teacher.js] Socket.io not loaded — live polling requires the Node server (local or Render)');
}

// DOM references
const sessionCodeEl = document.getElementById('session-code');
const statusBadge = document.getElementById('status-badge');
const participantCountEl = document.getElementById('participant-count');
const qrCodeEl = document.getElementById('qr-code');
const qrTargetEl = document.getElementById('qr-target-url');
const qrErrorEl = document.getElementById('qr-error');
const joinLinkEl = document.getElementById('join-link');
const localhostJoinLinkEl = document.getElementById('localhost-join-link');
const wifiIpInput = document.getElementById('wifi-ip-input');
const regenerateBtn = document.getElementById('regenerate-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');
const copyLocalhostBtn = document.getElementById('copy-localhost-btn');
const anonymousToggle = document.getElementById('anonymous-toggle');
const questionInput = document.getElementById('question-input');
const questionDisplay = document.getElementById('question-display');
const mcResults = document.getElementById('mc-results');
const textListResults = document.getElementById('text-list-results');
const textCloudResults = document.getElementById('text-cloud-results');
const textViewToggle = document.getElementById('text-view-toggle');
const textList = document.getElementById('text-list');
const wordCloudEl = document.getElementById('word-cloud');
const responseCountEl = document.getElementById('response-count');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const endBtn = document.getElementById('end-btn');

const countEls = {
  A: document.getElementById('count-a'),
  B: document.getElementById('count-b'),
  C: document.getElementById('count-c'),
  D: document.getElementById('count-d'),
};

let currentSession = null;
let barChart = null;

// --- Control handlers (registered early so they work even if chart/init fails) ---

function joinAsTeacher() {
  console.log('[teacher.js] emitting teacher-join', sessionId);
  socket.emit('teacher-join', { sessionId });
}

if (!startBtn) {
  console.error('[teacher.js] Start Poll button (#start-btn) not found in DOM');
} else {
  startBtn.addEventListener('click', () => {
    console.log('[teacher.js] Start Poll clicked, sessionId:', sessionId);
    socket.emit('start-poll', { sessionId });
  });
  console.log('[teacher.js] Start Poll click listener attached');
}

if (stopBtn) {
  stopBtn.addEventListener('click', () => {
    console.log('[teacher.js] Stop Poll clicked');
    socket.emit('stop-poll', { sessionId });
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all responses?')) {
      console.log('[teacher.js] Reset Poll clicked');
      socket.emit('reset-poll', { sessionId });
    }
  });
}

if (endBtn) {
  endBtn.addEventListener('click', () => {
    if (confirm('End this session? All data will be deleted.')) {
      socket.emit('end-session', { sessionId });
      window.location.href = appUrl('');
    }
  });
}

socket.on('connect', () => {
  console.log('[teacher.js] socket connected');
  joinAsTeacher();
});

socket.on('disconnect', () => {
  console.log('[teacher.js] socket disconnected');
});

// --- Join URL helpers ---

function getPort() {
  return window.location.port || '3000';
}

function buildBaseOrigin(wifiIpOverride) {
  const ip = (wifiIpOverride || '').trim();
  if (ip) {
    return `${window.location.protocol}//${ip}:${getPort()}`;
  }
  return window.location.origin;
}

function buildJoinUrl(baseOrigin) {
  const origin = baseOrigin.replace(/\/$/, '');
  return `${origin}${appUrl(`join.html?session=${encodeURIComponent(sessionId)}`)}`;
}

function buildLocalhostJoinUrl() {
  return `http://localhost:${getPort()}${appUrl(`join.html?session=${encodeURIComponent(sessionId)}`)}`;
}

function showQrError(message) {
  qrErrorEl.textContent = message;
  qrErrorEl.classList.remove('hidden');
  qrCodeEl.classList.add('hidden');
}

function clearQrError() {
  qrErrorEl.textContent = '';
  qrErrorEl.classList.add('hidden');
  qrCodeEl.classList.remove('hidden');
}

/** Update the visible "QR code points to" line */
function setQrTargetUrl(url) {
  if (!qrTargetEl) return;
  qrTargetEl.textContent = url ? `QR code points to: ${url}` : 'QR code points to: …';
}

/** Build and set the student join link input (source of truth for QR) */
function updateStudentJoinLink() {
  const wifiIp = wifiIpInput.value.trim();
  localStorage.setItem(WIFI_IP_KEY, wifiIp);

  const joinUrl = buildJoinUrl(buildBaseOrigin(wifiIp));
  joinLinkEl.value = joinUrl;
  localhostJoinLinkEl.value = buildLocalhostJoinUrl();
  sessionCodeEl.textContent = sessionId;

  console.log('[teacher.js] Student join link updated:', joinUrl);
  return joinUrl;
}

/** Generate QR from the exact URL currently in the join link input */
async function regenerateQrCode() {
  const joinUrl = joinLinkEl.value.trim();

  if (!joinUrl) {
    setQrTargetUrl('');
    qrCodeEl.removeAttribute('src');
    showQrError('No join link to encode.');
    return;
  }

  // Show target immediately so it always matches the join link field
  setQrTargetUrl(joinUrl);
  qrCodeEl.removeAttribute('src');
  clearQrError();

  console.log('[teacher.js] Generating QR for:', joinUrl);

  try {
    const res = await fetch(appUrl('api/qr'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: joinUrl }),
    });
    const data = await res.json();

    if (!res.ok || !data.qrDataUrl) {
      throw new Error(data.error || `Server returned ${res.status}`);
    }

    // Always use the join link field value — never a different URL from the server
    qrCodeEl.src = data.qrDataUrl;
    setQrTargetUrl(joinUrl);
    clearQrError();

    if (joinLinkEl.value.trim() !== joinUrl) {
      console.warn('[teacher.js] Join link changed during QR generation — regenerating');
      await regenerateQrCode();
      return;
    }

    console.log('[teacher.js] QR code updated for:', joinUrl);
  } catch (err) {
    console.error('[teacher.js] QR generation failed:', err);
    qrCodeEl.removeAttribute('src');
    setQrTargetUrl(joinUrl);
    showQrError(`Could not generate QR code: ${err.message}`);
  }
}

/** Update join link, then regenerate QR to match it exactly */
async function updateJoinInfo() {
  if (!sessionId) {
    showQrError('Missing session code in URL.');
    joinLinkEl.value = '';
    localhostJoinLinkEl.value = '';
    setQrTargetUrl('');
    return;
  }

  updateStudentJoinLink();
  await regenerateQrCode();
}

sessionCodeEl.textContent = sessionId || '—';

async function initJoinInfo() {
  const savedIp = localStorage.getItem(WIFI_IP_KEY);
  if (savedIp) {
    wifiIpInput.value = savedIp;
  } else {
    try {
      const res = await fetch(appUrl('api/network-info'));
      if (res.ok) {
        const info = await res.json();
        if (info.detectedIp) {
          // Pre-fill detected Wi-Fi IP so QR doesn't default to localhost
          wifiIpInput.value = info.detectedIp;
        }
      }
    } catch (err) {
      console.warn('[teacher.js] Could not fetch network info:', err);
    }
  }

  await updateJoinInfo();
}

initJoinInfo();

if (regenerateBtn) {
  regenerateBtn.addEventListener('click', () => {
    console.log('[teacher.js] Update clicked — refreshing join link and QR');
    updateJoinInfo();
  });
}
if (wifiIpInput) {
  wifiIpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') updateJoinInfo();
  });
}

// --- Bar chart (optional — poll controls work without it) ---
function initChart() {
  if (typeof Chart === 'undefined') {
    console.warn('[teacher.js] Chart.js not loaded — bar chart disabled, poll controls still work');
    return;
  }

  const canvas = document.getElementById('bar-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['A', 'B', 'C', 'D'],
      datasets: [{
        label: 'Responses',
        data: [0, 0, 0, 0],
        backgroundColor: ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2'],
        borderRadius: 8,
        barPercentage: 0.6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 16 } },
          grid: { color: '#e2e8f0' },
        },
        x: {
          ticks: { font: { size: 20, weight: 'bold' } },
          grid: { display: false },
        },
      },
      animation: { duration: 400 },
    },
  });
  console.log('[teacher.js] bar chart initialized');
}

try {
  initChart();
} catch (err) {
  console.error('[teacher.js] Chart init failed — poll controls still work:', err);
}

// --- Update UI from session state ---

function updateUI(session) {
  console.log('[teacher.js] session-update received, status:', session.status);
  currentSession = session;

  statusBadge.textContent = session.status;
  statusBadge.className = `status-badge ${session.status}`;

  participantCountEl.textContent =
    `${session.participantCount} student${session.participantCount !== 1 ? 's' : ''} joined`;

  if (session.question) {
    questionDisplay.innerHTML = `<h2>${escapeHtml(session.question)}</h2>`;
  } else if (session.status === 'active') {
    questionDisplay.innerHTML = '<p class="placeholder">Poll is live — question asked verbally</p>';
  } else {
    questionDisplay.innerHTML = '<p class="placeholder">Enter a question (optional) and start the poll</p>';
  }

  anonymousToggle.checked = session.anonymous;

  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === session.mode);
  });
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === session.textView);
  });

  textViewToggle.classList.toggle('hidden', session.mode !== 'text');

  const isActive = session.status === 'active';
  if (startBtn) startBtn.disabled = isActive;
  if (stopBtn) stopBtn.disabled = !isActive;

  mcResults.classList.toggle('hidden', session.mode !== 'multiple-choice');
  textListResults.classList.toggle('hidden', session.mode !== 'text' || session.textView !== 'list');
  textCloudResults.classList.toggle('hidden', session.mode !== 'text' || session.textView !== 'wordcloud');

  if (session.mode === 'multiple-choice' && barChart) {
    const counts = session.counts;
    barChart.data.datasets[0].data = [counts.A, counts.B, counts.C, counts.D];
    barChart.update();
    Object.keys(countEls).forEach((k) => {
      if (countEls[k]) countEls[k].textContent = counts[k];
    });
  } else if (session.mode === 'multiple-choice') {
    Object.keys(countEls).forEach((k) => {
      if (countEls[k]) countEls[k].textContent = session.counts[k];
    });
  }

  if (session.mode === 'text') {
    renderTextList(session.responses, session.anonymous);
    renderWordCloud(session.responses);
  }

  responseCountEl.textContent =
    `${session.responseCount} response${session.responseCount !== 1 ? 's' : ''}`;
}

function renderTextList(responses, anonymous) {
  textList.innerHTML = '';
  responses.forEach((r) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(r.text)}</span>` +
      (anonymous ? '' : `<span class="response-name">${escapeHtml(r.name)}</span>`);
    textList.appendChild(li);
  });
}

function renderWordCloud(responses) {
  wordCloudEl.innerHTML = '';
  if (responses.length === 0) return;

  const freq = {};
  responses.forEach((r) => {
    r.text.split(/\s+/).forEach((word) => {
      const w = word.toLowerCase().replace(/[^a-z0-9'-]/gi, '');
      if (w.length > 1) freq[w] = (freq[w] || 0) + 1;
    });
  });

  const words = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const maxFreq = words[0]?.[1] || 1;
  const colors = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#16a34a', '#d97706'];

  words.forEach(([word, count], i) => {
    const span = document.createElement('span');
    const size = 14 + (count / maxFreq) * 36;
    span.textContent = word;
    span.style.fontSize = `${size}px`;
    span.style.color = colors[i % colors.length];
    span.style.fontWeight = count > 1 ? '700' : '400';
    wordCloudEl.appendChild(span);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Socket events ---

socket.on('session-update', (session) => {
  updateUI(session);
  if (document.activeElement !== questionInput && questionInput.value !== session.question) {
    questionInput.value = session.question;
  }
});

socket.on('error', ({ message }) => {
  console.error('[teacher.js] server error:', message);
  alert(message);
});

// --- Settings handlers ---

let questionTimeout;
questionInput.addEventListener('input', () => {
  clearTimeout(questionTimeout);
  questionTimeout = setTimeout(() => {
    socket.emit('update-settings', { question: questionInput.value });
  }, 300);
});

anonymousToggle.addEventListener('change', () => {
  socket.emit('update-settings', { anonymous: anonymousToggle.checked });
});

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    socket.emit('update-settings', { mode: btn.dataset.mode });
  });
});

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    socket.emit('update-settings', { textView: btn.dataset.view });
  });
});

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(joinLinkEl.value);
  copyLinkBtn.textContent = 'Copied!';
  setTimeout(() => { copyLinkBtn.textContent = 'Copy'; }, 2000);
});

copyLocalhostBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(localhostJoinLinkEl.value);
  copyLocalhostBtn.textContent = 'Copied!';
  setTimeout(() => { copyLocalhostBtn.textContent = 'Copy'; }, 2000);
});

// Join immediately if socket is already connected (before 'connect' event fires)
if (socket.connected) {
  joinAsTeacher();
}
