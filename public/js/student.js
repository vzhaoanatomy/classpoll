/**
 * Student join page — enter session, submit responses.
 */

/** Read session code from ?session=CODE or /join/CODE (legacy) */
function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('session');
  if (fromQuery && fromQuery.trim()) {
    return fromQuery.trim().toUpperCase();
  }

  const parts = window.location.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last !== 'join.html' && last !== 'join') {
    return last.toUpperCase();
  }

  return null;
}

const sessionId = getSessionId();
const socket = io();

// Screen elements
const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const mcScreen = document.getElementById('mc-screen');
const textScreen = document.getElementById('text-screen');
const endedScreen = document.getElementById('ended-screen');

const sessionCodeEl = document.getElementById('session-code');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const joinBtn = document.getElementById('join-btn');
const errorMsg = document.getElementById('error-msg');

const mcQuestion = document.getElementById('mc-question');
const mcSubmitted = document.getElementById('mc-submitted');
const textQuestion = document.getElementById('text-question');
const textInput = document.getElementById('text-input');
const textSubmitBtn = document.getElementById('text-submit-btn');
const textSubmitted = document.getElementById('text-submitted');

let hasJoined = false;
let hasSubmitted = false;
let currentSession = null;

// Reset UI when poll is reset or restarted
function resetSubmissionState() {
  hasSubmitted = false;
  mcSubmitted.classList.add('hidden');
  textSubmitted.classList.add('hidden');
  textSubmitBtn.disabled = false;
  textInput.value = '';
  document.querySelectorAll('.choice-btn').forEach((b) => b.classList.remove('selected'));
}

sessionCodeEl.textContent = sessionId || '—';

if (!sessionId) {
  errorMsg.textContent = 'No session code found. Scan the QR code or use the join link from your teacher.';
  errorMsg.classList.remove('hidden');
  joinBtn.disabled = true;
}

// Check session exists and whether names are required
async function checkSession() {
  if (!sessionId) return;
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (!res.ok) throw new Error();
    const session = await res.json();
    currentSession = session;

    // Show name field if not anonymous
    if (!session.anonymous) {
      nameForm.classList.remove('hidden');
    }
  } catch {
    errorMsg.textContent = 'This session does not exist or has ended.';
    errorMsg.classList.remove('hidden');
    joinBtn.disabled = true;
  }
}

checkSession();

// Show a specific screen, hide all others
function showScreen(screen) {
  [joinScreen, waitingScreen, mcScreen, textScreen, endedScreen].forEach((s) => {
    s.classList.add('hidden');
  });
  screen.classList.remove('hidden');
}

// Join the session
joinBtn.addEventListener('click', () => {
  if (!sessionId) return;
  errorMsg.classList.add('hidden');
  const name = nameInput.value.trim();
  socket.emit('student-join', { sessionId, name });
});

// Enter key on name input
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

socket.on('joined', (session) => {
  hasJoined = true;
  currentSession = session;
  showResponseScreen(session);
});

socket.on('session-update', (session) => {
  currentSession = session;
  if (!hasJoined) return;
  showResponseScreen(session);
});

function showResponseScreen(session) {
  if (session.status === 'ended') {
    showScreen(endedScreen);
    return;
  }

  if (session.status === 'waiting' || session.status === 'stopped') {
    showScreen(waitingScreen);
    resetSubmissionState();
    return;
  }

  // Active poll
  if (session.mode === 'multiple-choice') {
    mcQuestion.textContent = session.question || 'Select your answer:';
    showScreen(mcScreen);
    if (hasSubmitted) mcSubmitted.classList.remove('hidden');
  } else {
    textQuestion.textContent = session.question || 'Enter your response:';
    showScreen(textScreen);
    if (hasSubmitted) textSubmitted.classList.remove('hidden');
  }
}

// Multiple choice buttons
document.querySelectorAll('.choice-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (hasSubmitted) return;

    document.querySelectorAll('.choice-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    socket.emit('submit-response', { choice: btn.dataset.choice });
    hasSubmitted = true;
    mcSubmitted.classList.remove('hidden');
  });
});

// Text response submit
textSubmitBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  if (!text) return;

  socket.emit('submit-response', { text });
  hasSubmitted = true;
  textSubmitted.classList.remove('hidden');
  textSubmitBtn.disabled = true;
});

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    textSubmitBtn.click();
  }
});

socket.on('session-ended', () => {
  showScreen(endedScreen);
});

socket.on('error', ({ message }) => {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
});
