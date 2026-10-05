# Kin — Family Safety Assistant

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-green.svg)](https://expressjs.com/)
[![Gemini Live API](https://img.shields.io/badge/Gemini_Live-Multimodal-orange.svg)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A patient, protective, real-time technology guide and scam defense assistant designed for parents and family members.

---

## Overview

**Kin** acts as an always-on digital guardian and guide. By combining real-time audio conversation with live screen sharing, Kin helps less tech-savvy family members navigate digital tasks, understand unfamiliar interfaces, and avoid online scams, phishing, and predatory remote-access fraud.

Powered by Google's **Gemini Live Multimodal API**, Kin listens to questions, observes the shared screen, highlights exact UI elements to click, and actively intervenes if it detects scam indicators like urgent wire transfer requests, fake antivirus alerts, or demands for OTPs and PINs.

---

## Key Features

- 🎙️ **Real-Time Voice Assistant**: Natural, low-latency, interruptible spoken conversations powered by Gemini Live Multimodal WebSocket streams.
- 🖥️ **Live Screen Guidance**: Analyzes screen frames in real time and highlights relevant buttons and controls with visual bounding boxes (`highlight_screen_element`).
- 🚨 **Proactive Scam Detection**: Automatically recognizes social engineering tactics, unauthorized remote-access requests (e.g., AnyDesk, TeamViewer), phishing pop-ups, and urgent financial traps (`raise_scam_alert`).
- 🌐 **Multilingual & Code-Switching**: Built-in support for:
  - English (`en`)
  - Hindi / हिन्दी (`hi`)
  - Bengali / বাংলা (`bn`)
  - Tamil / தமிழ் (`ta`)
  - Telugu / తెలుగు (`te`)
  - Marathi / मराठी (`mr`)
  - Urdu / اردو (`ur`)
  - Intelligent Auto-Detection with mixed-language code-switching
- 🔍 **Google Search Grounding**: Fact-checks suspicious claims, phone numbers, and company identities against real-time web results.
- 🔒 **Privacy-First Design**: Ephemeral media streaming with explicit user controls, one-click session termination, and local preference storage.
- 🌓 **Modern UI / UX**: Clean, accessible design featuring light and dark modes, high-contrast alerts, and readable transcripts.

---

## Architecture

```mermaid
graph TD
    User([Parent / User]) <-->|Microphone & Screen Share| Frontend[Kin Web App - React + Vite]
    Frontend <-->|Token Minting & Config| Backend[API Server - Express 5]
    Backend <-->|Auth & Session Setup| GeminiAPI[Google Gemini Live API]
    Frontend <===>|Direct Bidirectional WebSocket| GeminiAPI
    GeminiAPI -->|highlight_screen_element| Frontend
    GeminiAPI -->|raise_scam_alert| Frontend
```

---

## Repository Structure

```text
Kin-Family-Safety-Assistant/
├── artifacts/
│   ├── api-server/             # Express 5 backend server
│   │   ├── src/
│   │   │   ├── routes/         # API routes (Kin live token, health checks)
│   │   │   ├── middlewares/    # Request validation & rate limiting
│   │   │   └── app.ts          # Server configuration
│   │   └── package.json
│   ├── kin-family-safety/      # React + Vite frontend web application
│   │   ├── src/
│   │   │   ├── components/     # UI components (Radix UI, alerts, overlays)
│   │   │   ├── hooks/          # Audio capture & screen share hooks
│   │   │   ├── App.tsx         # Main application shell & session coordinator
│   │   │   └── index.css       # Design tokens & styling
│   │   └── package.json
│   └── mockup-sandbox/         # UI sandbox & mockup previews
├── lib/                        # Shared workspace libraries (API specs, schemas)
├── scripts/                    # Automation and build scripts
├── package.json                # Root workspace configuration
├── pnpm-workspace.yaml         # pnpm monorepo workspace definition
└── tsconfig.base.json          # Shared TypeScript configuration
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or v24 recommended)
- [pnpm](https://pnpm.io/) (v9 or v10 recommended)
- [Google Gemini API Key](https://aistudio.google.com/) with access to Gemini Live / Multimodal endpoints

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Syed-Tashfeen/Kin-Family-Safety-Assistant.git
cd Kin-Family-Safety-Assistant
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root or inside `artifacts/api-server/`:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
# Optional database connection if using persistence:
DATABASE_URL=postgresql://user:password@localhost:5432/kin_db
```

### 4. Run the Development Servers

Run the backend API server:
```bash
pnpm --filter @workspace/api-server run dev
```

In a separate terminal, run the frontend:
```bash
pnpm --filter @workspace/kin-family-safety run dev
```

Open your browser at `http://localhost:5173` (or the port specified in terminal output).

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm run build` | Builds all packages across the workspace |
| `pnpm run typecheck` | Typechecks all libraries and artifacts with `tsc` |
| `pnpm --filter @workspace/api-server run dev` | Runs the API backend in watch mode |
| `pnpm --filter @workspace/kin-family-safety run dev` | Starts the Vite frontend dev server |

---

## Safety & Privacy Principles

1. **No Silent Control**: Kin guides the user visually and auditorily. It never takes control of the device or performs actions behind the user's back.
2. **Zero Sensitive Data Extraction**: Kin explicitly instructs models never to request, store, or echo passwords, banking PINs, or one-time passcodes (OTPs).
3. **Emergency Disconnect**: Users can cut off microphone input, screen capture, and audio output at any instant with a single tap.

---

## License

This project is licensed under the [MIT License](LICENSE).
