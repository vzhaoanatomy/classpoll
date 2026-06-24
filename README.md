# ClassPolling

Interactive classroom polling system. Teachers run live polls; students respond from their phones.

## Quick Start

```bash
npm install
npm start
```

Open **http://localhost:3000** on the teacher's computer.

## Same Wi-Fi Network Required

For students to join from their phones, **the teacher's laptop and every student device must be on the same Wi‑Fi network**.

The teacher dashboard builds the student join link using the current browser address (`window.location.origin`). On your laptop that is usually `http://localhost:3000`. For phones, enter your laptop's Wi‑Fi IP (e.g. `192.168.1.23`) in the **Wi‑Fi IP override** field and click **Update**.

Student join link format:

```
http://192.168.1.23:3000/join.html?session=ABC123
```

If auto-detection fails, the dashboard falls back to `window.location.origin`. You can also set the server IP manually:

```bash
HOST=192.168.1.42 npm start
```

When the server starts, it prints both URLs:

```
ClassPolling running:
  Teacher (this computer):  http://localhost:3000
  Students (phones/Wi-Fi):  http://192.168.x.x:3000
```

**Firewall tip:** If phones cannot connect, allow incoming connections on port 3000 in your Mac/Windows firewall.

## How It Works

1. **Teacher** clicks "Start a New Session" on the home page.
2. A **6-character join code**, QR code, and link appear on the dashboard.
3. **Students** scan the QR code or open the link on their devices.
4. Teacher configures settings (anonymous/named, A/B/C/D or text mode), enters a question, and clicks **Start Poll**.
5. Results update live on the teacher's projector view.
6. Teacher can **Stop**, **Reset**, or **End Session** (data is deleted).

## Tech Stack

- **Node.js + Express** — web server
- **Socket.io** — real-time updates
- **Chart.js** — live bar chart
- **qrcode** — QR code generation
- In-memory session storage (no database)

## Project Structure

```
ClassPolling/
├── server.js              # Express + Socket.io server
├── package.json
└── public/
    ├── index.html         # Landing page
    ├── teacher.html       # Teacher dashboard
    ├── join.html          # Student join page
    ├── css/
    │   ├── styles.css     # Shared styles
    │   └── teacher.css    # Teacher dashboard styles
    └── js/
        ├── teacher.js     # Teacher dashboard logic
        └── student.js     # Student page logic
```

## Testing Locally

### Same computer (quick test)

Open two browser windows on the teacher laptop:

1. **Teacher**: http://localhost:3000 → create session
2. **Student**: use the localhost join link from "Testing on this computer only"

### Phones on Wi‑Fi (real classroom use)

1. **Teacher**: http://localhost:3000 → create session
2. **Students**: scan the QR code or open the **Student join link** on their phones
3. Confirm both devices are on the same Wi‑Fi before troubleshooting

Try both multiple-choice and text modes, anonymous and named responses.

## Deploy to Render (recommended)

This app needs a Node.js server — **GitHub Pages will not work**. Use [Render](https://render.com) (free tier).

### One-time setup

1. Push this repo to GitHub: [github.com/vzhaoanatomy/classpoll](https://github.com/vzhaoanatomy/classpoll)
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect GitHub and select the **classpoll** repo (Render reads `render.yaml` automatically)
4. Click **Apply** — Render builds and deploys the app
5. Open your live URL, e.g. `https://classpoll.onrender.com`

Students can join from any network using the public join link or QR code — no Wi‑Fi IP override needed when deployed online.

**Free tier note:** The app sleeps after ~15 min idle; first load after sleep may take 30–60 seconds.

### Manual Render setup (without Blueprint)

| Setting | Value |
|---------|-------|
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | Free |
