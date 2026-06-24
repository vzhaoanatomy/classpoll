/**
 * ClassPolling Server
 * Express + Socket.io with in-memory session storage.
 * No database — all session data is cleared when the teacher ends a session.
 */

const express = require('express');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
// Optional server-side override: HOST=192.168.1.5 npm start
const LAN_HOST = process.env.HOST || process.env.LAN_HOST || null;

/**
 * Find this computer's local network IPv4 address (e.g. 192.168.x.x).
 * Returns null if detection fails — the teacher page falls back to window.location.origin.
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const ifaces of Object.values(interfaces)) {
    for (const iface of ifaces) {
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (!isIPv4 || iface.internal) continue;
      candidates.push(iface.address);
    }
  }

  const preferred = candidates.find(
    (ip) =>
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
  const ip = preferred || candidates[0] || null;
  return ip === 'localhost' ? null : ip;
}

/** Safe LAN IP for startup logging — never throws */
function getSafeLanHost() {
  if (LAN_HOST) return LAN_HOST;
  try {
    return getLocalIpAddress() || 'localhost';
  } catch (err) {
    console.warn('LAN IP detection failed:', err.message);
    return 'localhost';
  }
}

const lanHost = getSafeLanHost();

// In-memory store: sessionId -> session object
const sessions = new Map();

// Generate a short 6-character join code
function generateSessionId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  // Avoid collisions
  if (sessions.has(id)) return generateSessionId();
  return id;
}

// Create a fresh session with default settings
function createSession() {
  const id = generateSessionId();
  const session = {
    id,
    status: 'waiting', // waiting | active | stopped | ended
    anonymous: true,
    mode: 'multiple-choice', // multiple-choice | text
    textView: 'list', // list | wordcloud
    question: '',
    // Map of socketId -> { name, choice, text, timestamp }
    responses: new Map(),
    // Set of connected student socket IDs
    participants: new Set(),
    teacherSocketId: null,
  };
  sessions.set(id, session);
  return session;
}

// Serialize session for clients (strip internal socket references)
function serializeSession(session) {
  const responses = [];
  session.responses.forEach((r) => responses.push(r));

  // Aggregate multiple-choice counts
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  responses.forEach((r) => {
    if (r.choice && counts[r.choice] !== undefined) {
      counts[r.choice]++;
    }
  });

  return {
    id: session.id,
    status: session.status,
    anonymous: session.anonymous,
    mode: session.mode,
    textView: session.textView,
    question: session.question,
    participantCount: session.participants.size,
    responseCount: responses.length,
    counts,
    responses,
  };
}

// Broadcast updated session state to everyone in the room
function broadcastSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const data = serializeSession(session);
  console.log('Broadcast session-update:', sessionId, 'status=', data.status);
  io.to(sessionId).emit('session-update', data);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Teacher dashboard
app.get('/teacher/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

// Student join page
app.get('/join/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

// API: create a new session
app.post('/api/sessions', (req, res) => {
  const session = createSession();
  res.json({ sessionId: session.id });
});

// API: optional network hint for the teacher dashboard (never returns undefined)
app.get('/api/network-info', (req, res) => {
  let detectedIp = null;
  try {
    detectedIp = LAN_HOST || getLocalIpAddress();
  } catch (err) {
    console.warn('LAN IP detection failed:', err.message);
  }
  res.json({
    port: PORT,
    detectedIp: detectedIp || null,
  });
});

// API: generate a QR code for the exact join URL sent by the teacher dashboard
app.post('/api/qr', async (req, res) => {
  const joinUrl = (req.body?.url || '').trim();
  if (!joinUrl) {
    return res.status(400).json({ error: 'A valid join URL is required' });
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 280, margin: 2 });
    console.log('QR generated for:', joinUrl);
    // Echo back the exact URL that was encoded
    res.json({ joinUrl, qrDataUrl });
  } catch (err) {
    console.error('QR generation failed for', joinUrl, ':', err.message);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// API: check if session exists (for join page validation)
app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session || session.status === 'ended') {
    return res.status(404).json({ error: 'Session not found or ended' });
  }
  res.json(serializeSession(session));
});

// --- Socket.io real-time events ---
io.on('connection', (socket) => {
  // Teacher joins and claims a session
  socket.on('teacher-join', ({ sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      console.log('teacher-join failed: session not found', sessionId);
      socket.emit('error', { message: 'Session not found' });
      return;
    }
    session.teacherSocketId = socket.id;
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.role = 'teacher';
    console.log('Teacher joined session', sessionId);
    socket.emit('session-update', serializeSession(session));
  });

  // Student joins a session
  socket.on('student-join', ({ sessionId, name }) => {
    const session = sessions.get(sessionId);
    if (!session || session.status === 'ended') {
      socket.emit('error', { message: 'Session not found or has ended' });
      return;
    }
    if (!session.anonymous && (!name || !name.trim())) {
      socket.emit('error', { message: 'Name is required for this session' });
      return;
    }

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.role = 'student';
    socket.studentName = session.anonymous ? 'Anonymous' : name.trim();
    session.participants.add(socket.id);

    socket.emit('joined', serializeSession(session));
    broadcastSession(sessionId);
  });

  // Teacher updates session settings
  socket.on('update-settings', (settings) => {
    const session = sessions.get(socket.sessionId);
    if (!session || socket.role !== 'teacher') return;

    if (settings.anonymous !== undefined) session.anonymous = settings.anonymous;
    if (settings.mode !== undefined) session.mode = settings.mode;
    if (settings.textView !== undefined) session.textView = settings.textView;
    if (settings.question !== undefined) session.question = settings.question;

    broadcastSession(session.id);
  });

  // Teacher starts the poll (students can submit)
  socket.on('start-poll', (payload) => {
    const sessionId = payload?.sessionId || socket.sessionId;
    const session = sessions.get(sessionId);
    if (!session) {
      console.log('start-poll rejected: session not found', sessionId);
      socket.emit('error', { message: 'Session not found. Create a new session.' });
      return;
    }
    if (socket.role !== 'teacher') {
      console.log('start-poll rejected: not teacher', socket.id);
      socket.emit('error', { message: 'Only the teacher can start the poll.' });
      return;
    }
    session.status = 'active';
    console.log('Poll started for session', sessionId);
    broadcastSession(session.id);
  });

  // Teacher stops accepting responses
  socket.on('stop-poll', (payload) => {
    const sessionId = payload?.sessionId || socket.sessionId;
    const session = sessions.get(sessionId);
    if (!session || socket.role !== 'teacher') return;
    session.status = 'stopped';
    console.log('Poll stopped for session', sessionId);
    broadcastSession(session.id);
  });

  // Teacher clears all responses (keeps participants)
  socket.on('reset-poll', (payload) => {
    const sessionId = payload?.sessionId || socket.sessionId;
    const session = sessions.get(sessionId);
    if (!session || socket.role !== 'teacher') return;
    session.responses.clear();
    session.status = 'waiting';
    console.log('Poll reset for session', sessionId);
    broadcastSession(session.id);
  });

  // Teacher ends session — data is deleted
  socket.on('end-session', (payload) => {
    const sessionId = payload?.sessionId || socket.sessionId;
    const session = sessions.get(sessionId);
    if (!session || socket.role !== 'teacher') return;
    session.status = 'ended';
    io.to(session.id).emit('session-ended');
    sessions.delete(session.id);
    console.log('Session ended', sessionId);
  });

  // Student submits a response
  socket.on('submit-response', (data) => {
    const session = sessions.get(socket.sessionId);
    if (!session || socket.role !== 'student') return;
    if (session.status !== 'active') {
      socket.emit('error', { message: 'Poll is not accepting responses' });
      return;
    }

    const response = {
      name: socket.studentName,
      timestamp: Date.now(),
    };

    if (session.mode === 'multiple-choice') {
      const choice = data.choice?.toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(choice)) {
        socket.emit('error', { message: 'Invalid choice' });
        return;
      }
      response.choice = choice;
    } else {
      const text = data.text?.trim();
      if (!text) {
        socket.emit('error', { message: 'Response cannot be empty' });
        return;
      }
      response.text = text;
    }

    // One response per student — overwrite if they change their answer
    session.responses.set(socket.id, response);
    broadcastSession(session.id);
  });

  // Clean up when a client disconnects
  socket.on('disconnect', () => {
    const session = sessions.get(socket.sessionId);
    if (!session) return;

    if (socket.role === 'student') {
      session.participants.delete(socket.id);
      // Keep their response even if they disconnect (optional — remove line below to keep)
      broadcastSession(session.id);
    }
  });
});

// Listen on all interfaces so phones on the same Wi-Fi can connect
server.listen(PORT, '0.0.0.0', () => {
  console.log('ClassPolling running:');
  console.log(`  Teacher (this computer):  http://localhost:${PORT}`);
  console.log(`  Students (phones/Wi-Fi):  http://${lanHost}:${PORT}`);
  if (lanHost === 'localhost') {
    console.log('  Warning: Could not detect a LAN IP. Set HOST=192.168.x.x if needed.');
  }
});
