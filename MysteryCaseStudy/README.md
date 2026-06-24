# Mystery Case Study Generator

A single-page web app that helps teachers create **progressive, mystery-diagnosis case studies** for a 12th-grade Honors Anatomy & Physiology course. Students act like clinical investigators: they receive clues one part at a time, discuss evidence, revise hypotheses, interpret data, and explain the underlying anatomy and physiology before the diagnosis is revealed.

> For classroom education only. This tool does not provide real medical advice.

## Quick start

No build step and no backend required.

- **Easiest:** double-click `index.html` to open it in a browser.
- **Recommended (avoids browser file restrictions):** serve the folder statically:

```bash
cd MysteryCaseStudy
python3 -m http.server 8000
# then open http://localhost:8000
```

The app loads pre-populated with a built-in **Cyanide poisoning** sample so you can see how it works immediately.

## What it generates

Four outputs, organized as tabs:

1. **Student Case** — Parts I–V (Initial Mystery, History & Exam, Lab Data, Mechanism Clue, Diagnosis Reveal & Synthesis). The diagnosis stays hidden behind a "Reveal Diagnosis" button until the end.
2. **Teacher Guide** — case overview, per-part answer key, reasoning pathway, vocabulary support, common misconceptions, differentiation, pacing plan, and an exit ticket.
3. **Reveal Mode** — projector-friendly, one clue card at a time with a progress indicator (Clue 1 of 5 → Diagnosis Reveal), Pause & Discuss and Current Hypothesis prompts, navigation, and hidden teacher notes.
4. **Collaboration Mode** — format-aware student roles, an editable Evidence Board, a Hypothesis Tracker, and discussion prompts.

## Teacher inputs

- **Disease or condition** (free text)
- **Body system** (dropdown)
- **Difficulty level** — Introductory / Standard / Challenge (changes the number of lab values, amount of guidance, and emphasis on ruling out alternatives)
- **Class format** — Individual / Small group / Whole class discussion (changes the roles)
- **Case length** — 20-minute short case / Full-class case (changes the pacing plan)

## Output controls

Generate Case, Regenerate, Copy Student Version, Copy Teacher Guide, Copy Reveal Slides Text, Print Case, Reset Form, Load Sample Case, plus Save/Load cases via browser local storage.

## How case generation works

The app ships with a hand-authored, condition-specific content library (`CONDITIONS`) so output is medically realistic and not generic. Built-in conditions include cyanide poisoning, asthma, myocardial infarction, diabetes mellitus, iron-deficiency anemia, pulmonary embolism, bacterial meningitis, and hypothyroidism. Any other free-text condition falls back to a coherent, body-system-driven template.

## Connecting a real AI API later

The whole engine flows through one function, `generateCase(form)`. Inside it there is a clearly marked **AI HOOK BOUNDARY**. To use a real LLM, build a prompt from `form`, request JSON, and parse it into the same shape (`meta`, `parts`, `teacherGuide`, `collaboration`, `exitTicket`). No other part of the app needs to change.

## Tech

- React 18 + ReactDOM (UMD) and Babel Standalone via CDN
- All styles and logic in one self-contained `index.html`
- Local component state; `localStorage` for saved cases and last-used form
