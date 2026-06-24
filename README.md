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

## Deploy to GitHub Pages (static site)

GitHub Pages hosts the **HTML/CSS/JS only**. Live polling still needs the Node server (local `npm start` or Render).

### Setup

1. On GitHub: repo **Settings → Pages → Build and deployment → Source** → choose **GitHub Actions**
2. Push to `main` — the workflow in `.github/workflows/deploy-pages.yml` publishes the `public/` folder
3. Your site will be at: **https://vzhaoanatomy.github.io/classpoll/**

The landing page (`index.html`) loads at that URL. Teacher and student pages use relative paths so CSS and JS work under `/classpoll/`.

**Note:** "Start a New Session" and live updates require the Node backend. For full functionality, deploy to Render (below) or run locally.

## Deploy to Render (live polling — recommended)

Use Render to run the full app (Node + Socket.io). Students can join from any network.

### Deploy in 3 clicks

1. Open **[Render Blueprint deploy →](https://dashboard.render.com/blueprint/new?repo=https://github.com/vzhaoanatomy/classpoll)**
2. Sign in with GitHub and click **Apply** (Render reads `render.yaml` automatically)
3. Wait ~3–5 minutes for the first deploy

Your live URL will be:

**`https://classpoll.onrender.com`**

(or similar — check the Render dashboard)

### After deploy

1. Open your Render URL
2. Click **Start a New Session**
3. Share the **Student join link** or **QR code** — no Wi‑Fi IP override needed online
4. Click **Start Poll** and have students respond from their phones

**Free tier:** The app sleeps after ~15 min idle. Open the URL a minute before class so it can wake up.

### Manual Render setup (without Blueprint)

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | Free |
