# Kin — Real-Time Family Safety Assistant & Autonomous Scam Defense

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Gemini Live API](https://img.shields.io/badge/Gemini_Live-Multimodal_Bidi_WebSocket-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E_Tested-45BA4B?logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Kin** is an always-on, patient digital companion and proactive cyber guardian for parents and non-technical family members. Built on **Google's Gemini Multimodal Live API**, Kin combines real-time bidirectional voice dialogue, synchronized screen/tab vision, autonomous DOM threat analysis, and instant on-screen defensive interventions to protect loved ones from predatory tech-support takeovers, phishing traps, and social-engineering scams.

---

## 📑 Table of Contents

- [Problem Statement](#-problem-statement)
- [System Highlights & Implemented Features](#-system-highlights--implemented-features)
  - [1. Gemini Multimodal Live Bidirectional Streaming](#1-gemini-multimodal-live-bidirectional-streaming)
  - [2. Autonomous Guardian Scam Engine](#2-autonomous-guardian-scam-engine)
  - [3. Chrome Extension (Manifest V3 Side Panel)](#3-chrome-extension-manifest-v3-side-panel)
  - [4. Visual Guiding Pointer & On-Page Red Scam Barrier](#4-visual-guiding-pointer--on-page-red-scam-barrier)
  - [5. Telegram Family Emergency Relay](#5-telegram-family-emergency-relay)
  - [6. Family Guardian Dashboard & Intervention Records](#6-family-guardian-dashboard--intervention-records)
  - [7. Sandboxed Phishing & Scam Labs](#7-sandboxed-phishing--scam-labs)
  - [8. Structured Gemini Flash Text Chat](#8-structured-gemini-flash-text-chat)
- [System Architecture](#-system-architecture)
- [Gemini Live Tool Calling Protocols](#-gemini-live-tool-calling-protocols)
- [Repository Map](#-repository-map)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Installation](#1-installation)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Running the Stack](#3-running-the-stack)
- [Chrome Extension Installation & Usage](#-chrome-extension-installation--usage)
- [End-to-End Testing](#-end-to-end-testing)
- [Production Hardening & Gotchas](#-production-hardening--gotchas)
- [Privacy & Human-in-the-Loop Principles](#-privacy--human-in-the-loop-principles)
- [License](#-license)

---

## 💡 Problem Statement

Non-technical parents and elderly family members lose over **$10 Billion annually** to social engineering, remote-access fraud (AnyDesk, TeamViewer), and fraudulent banking alerts. Existing antivirus solutions run silently in the background and only detect known malware binaries—they **cannot see or hear** when a live phone scammer coerces a parent into reading a 9-digit remote control code or revealing a one-time verification password.

**Kin bridges this critical gap** by acting as an empathetic, bilingual AI companion on their screen. Kin sees what they see, hears what they hear, and intercedes at the exact second a scam attempt occurs.

---

## 🌟 System Highlights & Implemented Features

### 1. Gemini Multimodal Live Bidirectional Streaming
- **Native Bidi WebSocket**: Direct browser/extension streaming to `wss://generativelanguage.googleapis.com/.../BidiGenerateContentConstrained` using single-use ephemeral tokens.
- **Low-Latency PCM Audio**: Captures mic input (16 kHz PCM 16-bit mono) and streams synthesized model audio back to the speaker (24 kHz PCM) for ultra-responsive spoken dialogue.
- **Continuous Screen & Tab Vision**: Downsamples shared screen or active tab frames (~1 frame/sec) to JPEG format and feeds them directly into the multimodal pipeline.
- **Failover Token Broker**: Express backend rotates across a pool of Gemini API keys (`GEMINI_API_KEYS`) with quota monitoring and automatic failover.
- **Multilingual Support**: Real-time code-switching across English, Hindi, Bengali, Tamil, Telugu, Marathi, and Urdu.

### 2. Autonomous Guardian Scam Engine
- **Targeted Threat Pattern Recognition**:
  - **Remote-Desktop Software Exploits**: Detects AnyDesk 9-digit connection codes (`482 109 773`), QuickSupport prompts, and TeamViewer installation attempts.
  - **Deceptive Banking Gateways**: Detects fake KYC forms, "Account Blocked" intimidation, and credential harvesting fields.
  - **Urgency & Coercion Cues**: Detects deceptive countdown timers, unauthorized payment requests, and suspicious calls.
- **Dual-Layer Evaluation**:
  1. *Client-side DOM Pattern Matcher*: Injects instant safeguards in `< 100ms` directly in `content.js`.
  2. *Gemini Multimodal Live Vision Engine*: Periodically processes screen frames and voice transcripts via tool calls.
- **Auto-Resolving Risk Telemetry**: Automatically resets risk levels to `LOW RISK (10/100) / Device Secured` when sessions conclude, with a manual `✓ Resolve & Clear` override.

### 3. Chrome Extension (Manifest V3 Side Panel)
- **Always-Open Companion**: Uses the modern Chrome Side Panel API (`chrome.sidePanel`) to stay alongside the user's active browsing tabs.
- **Resilient Audio Pipeline**: Seamlessly requests microphone access and automatically falls back to an internal Web Audio carrier stream if browser Omnibox sidepanel permissions are restricted, guaranteeing uninterrupted live video and WebSocket connectivity.
- **Dedicated Permission Hub (`permission.html`)**: Single-click tab permission granting interface for Chrome's strict security boundaries.
- **In-Panel Simulation Tools**: Trigger live visual pointers, simulate high-risk scam states, and clear active on-screen banners on demand.

### 4. Visual Guiding Pointer & On-Page Red Scam Barrier
- **Targeting Visual Pointer (`highlight_screen_element` / `SHOW_POINTER`)**: Injects animated targeting rings with directional arrows and instructions over safe navigation targets (e.g., "Click your Account statement here").
- **Red Scam Overlay Barrier (`raise_scam_alert` / `SHOW_RED_ALERT`)**: Instantly greys out the compromised page with a prominent red security warning banner, preventing accidental clicks on dangerous submission buttons.
- **Auditory Warning Chime & Speech Synthesis**: Emits an alert tone and speaks a clear spoken warning ("Warning! Do not share this 9-digit code with the caller.") via the Web Speech API.

### 5. Telegram Family Emergency Relay
- **Automatic Dispatch (`/api/kin/telegram-alert`)**: Fires immediate alert dispatches containing the detected threat summary, risk score, evidence snippet, and recommended next step to the designated family safety Telegram channel.

### 6. Family Guardian Dashboard & Intervention Records
- **Route `/dashboard`**: Comprehensive overview showing recent security interventions, risk metrics (0–100), active session durations, and detailed forensic audit logs.
- **Persistent or In-Memory History**: Works with PostgreSQL + Drizzle ORM or runs seamlessly with in-memory fallback stores.

### 7. Sandboxed Phishing & Scam Labs
- **AnyDesk Remote Takeover Lab** (`/scam-lab/anydesk.html`): Realistic fake remote desktop interface displaying a 9-digit connection address to test automated detection.
- **Bank Security Gateway Lab** (`/scam-lab/bank.html`): Realistic fake KYC urgency portal with countdown timer and OTP field to test scam blocking.

### 8. Structured Gemini Flash Text Chat
- **Route `/api/kin/chat`**: Direct REST endpoint running `gemini-2.5-flash` with guaranteed JSON schema parsing, returning structured fields: `reply`, `riskScore`, `decision`, `riskReasoning`, and `recommendedAction`.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer["Parent Interface (User Layer)"]
        WebApp["Kin React 19 Web App\n(Port 5173 / 5174)"]
        ExtPanel["Chrome Extension Side Panel\n(Manifest V3)"]
        ActiveTab["Active Browser Tab\n(DOM & Screen Frames)"]
    end

    subgraph DefenseLayer["Defensive Interventions (content.js)"]
        RedAlert["On-Page Red Scam Overlay\n(SHOW_RED_ALERT)"]
        VisualPointer["Glowing Target Pointer\n(SHOW_POINTER)"]
        SpeechSynthesizer["Web Speech Audio Alert\n('Warning! Hang up call!')"]
    end

    subgraph BackendLayer["Local Backend Server (Express 5 - Port 5000)"]
        LiveTokenAPI["POST /api/kin/live-token\n(Token Broker & Key Pool)"]
        TelegramRelay["POST /api/kin/telegram-alert\n(Family Notification Dispatch)"]
        ChatAPI["POST /api/kin/chat\n(Gemini 2.5 Flash Structured JSON)"]
        SessionsAPI["GET/POST /api/kin/sessions & /alerts\n(PostgreSQL / Memory DB)"]
    end

    subgraph GoogleAI["Google Gemini Cloud"]
        LiveWS["Gemini Multimodal Live API\nwss://generativelanguage.googleapis.com\n(BidiGenerateContentConstrained)"]
        FlashModel["Gemini 2.5 Flash\n(generateContent REST)"]
    end

    subgraph FamilyLayer["Family Notifications"]
        TelegramBot["Telegram Family Group\n(@KinGuardianBot)"]
    end

    WebApp <-->|Live Voice + Screen Capture| LiveWS
    ExtPanel <-->|Live Voice + Tab JPEG Frames| LiveWS
    ActiveTab -->|DOM Threat Scan| ExtPanel
    ExtPanel -->|Inject Safeguards| DefenseLayer
    
    WebApp -->|Request Ephemeral Token| LiveTokenAPI
    ExtPanel -->|Request Ephemeral Token| LiveTokenAPI
    LiveTokenAPI -->|Key Rotation Failover| GoogleAI
    
    LiveWS -->|highlight_screen_element| DefenseLayer
    LiveWS -->|guardian_risk_score| ExtPanel
    LiveWS -->|raise_scam_alert| ExtPanel
    
    ExtPanel -->|Trigger Alert| TelegramRelay
    TelegramRelay -->|Instant Message| TelegramBot
    
    WebApp -->|Text Questions| ChatAPI
    ChatAPI -->|Prompt with JSON Schema| FlashModel
```

---

## 🛠️ Gemini Live Tool Calling Protocols

Kin registers three custom function declarations with the Gemini Live model during setup:

### 1. `highlight_screen_element`
Guides the user by projecting a pointer ring onto a specific section of their screen:
```json
{
  "name": "highlight_screen_element",
  "parameters": {
    "x": 0.52,
    "y": 0.41,
    "width": 0.18,
    "height": 0.06,
    "label": "Click this secure blue button to proceed"
  }
}
```

### 2. `guardian_risk_score`
Returns continuous telemetry of the risk environment:
```json
{
  "name": "guardian_risk_score",
  "parameters": {
    "score": 95,
    "decision": "HIGH RISK",
    "screenUnderstanding": "Page contains AnyDesk 9-digit remote access authorization code",
    "conversationUnderstanding": "Caller is pressuring parent to read code aloud",
    "riskReasoning": "Remote desktop access grants full device control to an unverified third party",
    "recommendedAction": "Do not give the 9-digit code. Close the page and hang up immediately."
  }
}
```

### 3. `raise_scam_alert`
Triggers immediate high-priority intervention:
```json
{
  "name": "raise_scam_alert",
  "parameters": {
    "severity": "critical",
    "title": "Remote Desktop Takeover Attempt",
    "summary": "Suspicious AnyDesk connection address detected.",
    "evidence": "Screen displays AnyDesk ID: 482 109 773",
    "recommendedAction": "Disconnect from the internet and terminate the phone call."
  }
}
```

---

## 📂 Repository Map

```text
Kin-Family-Safety-Assistant/
├── artifacts/
│   ├── api-server/                     # Express 5 backend server
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   └── kin.ts              # Live token broker, failover keys, /chat, /alerts
│   │   │   ├── middlewares/            # Origin validation & security policies
│   │   │   └── index.ts                # Server startup & port binding
│   │   ├── .env                        # Backend environment configuration
│   │   └── package.json
│   ├── kin-family-safety/              # Main React 19 + Vite web application
│   │   ├── public/
│   │   │   └── scam-lab/               # Standalone sandboxed phishing testbeds
│   │   │       ├── anydesk.html        # Fake AnyDesk 9-digit takeover page
│   │   │       └── bank.html           # Fake Banking OTP & KYC urgent portal
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── family-dashboard.tsx# Safety dashboard & intervention records
│   │   │   │   └── scam-lab.tsx        # In-app interactive scam lab view
│   │   │   ├── components/             # Reusable UI cards, badges, modals
│   │   │   ├── App.tsx                 # Core live assistant, media loops, & UI shell
│   │   │   └── index.css               # Styling tokens, animations & responsive layout
│   │   └── package.json
│   └── .env                            # Monorepo artifacts environment file
├── chrome-extension/                   # Chrome Extension (Manifest V3)
│   ├── manifest.json                   # MV3 sidePanel, tabCapture & content scripts
│   ├── sidepanel.html                  # Live side panel UI with status & action triggers
│   ├── sidepanel.js                    # Bidi Live WS, resilient audio pipeline & vision loop
│   ├── content.js                      # In-page DOM scam scanner, red banner & pointer ring
│   ├── permission.html                 # Dedicated microphone permission hub
│   ├── overlay.css                     # On-page overlay and pointer ring animation styles
│   └── background.js                   # Extension background service worker
├── e2e/                                # End-to-end Playwright tests
├── lib/                                # Shared TypeScript libraries (DB schemas & types)
├── scripts/                            # Playwright automation & permission scripts
│   └── grant-mic-playwright.mjs        # Automated extension permission helper
├── package.json                        # Root monorepo scripts & package manager setup
├── pnpm-workspace.yaml                 # pnpm workspace configuration
└── README.md                           # Project documentation (this file)
```

---

## 💻 Prerequisites

- **Node.js**: v20.x or v22.x+
- **pnpm**: v9.x or v10.x (`npm install -g pnpm`)
- **Google Chrome**: Version 116+ (with Side Panel support)
- **Google Gemini API Key**: At least one API key from [Google AI Studio](https://aistudio.google.com/)

---

## ⚡ Quick Start Guide

### 1. Installation

Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/Syed-Tashfeen/Kin-Family-Safety-Assistant.git
cd Kin-Family-Safety-Assistant
pnpm install
```

### 2. Environment Configuration

Verify or create `artifacts/api-server/.env` (and `artifacts/.env`):

```env
PORT=5000
# Single key or comma-separated rotation pool:
GEMINI_API_KEYS=your_gemini_api_key_1,your_gemini_api_key_2
GEMINI_API_KEY=your_gemini_api_key_1

# Optional Gemini Live model override (defaults to gemini-3.8-live):
GEMINI_LIVE_MODEL=gemini-3.8-live

# Optional PostgreSQL Database Connection:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kin_db
```

### 3. Running the Stack

You can launch both the API backend and the React frontend concurrently:

```bash
# Option A: Run all services concurrently
pnpm run dev:all

# Option B: Run services individually
# Terminal 1: Backend API Server (Port 5000)
pnpm run dev:api

# Terminal 2: React Frontend App (Port 5173 / 5174)
pnpm run dev:app
```

Open `http://localhost:5173` (or `http://localhost:5174`) in Google Chrome.

---

## 🧩 Chrome Extension Installation & Usage

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn **ON** the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `chrome-extension` directory from this repository:
   ```text
   C:\path\to\Kin-Family-Safety-Assistant\chrome-extension
   ```
5. Click the puzzle icon in the Chrome toolbar and pin **Kin — Family Safety Assistant**.
6. Click the Kin icon in the toolbar. The **Kin Guardian Side Panel** will open beside your current tab.

### Testing the Autonomous Threat Defense:

1. Click the microphone button (`🎙️`) in the side panel to start the live guardian session.
2. Click **Open AnyDesk Lab ↗** (or **Open Bank Lab ↗**) at the bottom of the side panel.
3. The threat detection pipeline will activate:
   - The on-page **Red Scam Barrier** blocks the deceptive form.
   - A **Visual Pointer Ring** highlights the dangerous connection code (`482 109 773`).
   - The side panel updates to **HIGH RISK (95/100)** with a clear risk breakdown.
   - An alert chime sounds and spoken voice guidance warns the user.
   - An emergency alert payload is delivered to the Telegram family relay.
4. Click **Dismiss Alert** or **Clear Overlay** once the threat has been reviewed.

---

## 🧪 End-to-End Testing

Kin includes automated end-to-end testing using Playwright:

```bash
# Run Playwright E2E test suite
pnpm run test:e2e

# Run the Playwright extension microphone permission script
node scripts/grant-mic-playwright.mjs
```

---

## 🛡️ Production Hardening & Gotchas

### 1. Gemini Live Tool Quotas & Compatibility
- **Google Search in Live Mode**: Adding `{ googleSearch: {} }` into `tools` on Live WebSocket sessions triggers Google Gemini error `1011 (Quota Exceeded / Policy Violation)`. Live sessions must strictly include custom `functionDeclarations` (`highlight_screen_element`, `guardian_risk_score`, `raise_scam_alert`). Google Search grounding is retained in standard REST chat endpoints (`/api/kin/chat`).

### 2. Chrome Side Panel Omnibox Microphone Constraints
- Google Chrome blocks microphone permission requests initiated directly inside `chrome.sidePanel` unless previously granted. Kin resolves this by:
  1. Offering a dedicated `permission.html` hub that requests microphone permissions in a standard tab context.
  2. Providing an automatic Web Audio carrier stream fallback so tab video streaming and Gemini Live WebSocket handshakes remain fully functional even if microphone access is withheld.

### 3. Port Conflicts (`EADDRINUSE: 5000`)
- If port 5000 is occupied by a prior server process, run the following in PowerShell before starting:
  ```powershell
  Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  ```

---

## 🔒 Privacy & Human-in-the-Loop Principles

1. **Advisory Assistance Only**: Kin never takes independent device control, clicks buttons on the user's behalf, or enters form fields. It provides guidance via visual pointers and spoken instructions.
2. **Strict Credential Redaction**: Kin's system instructions explicitly prohibit reading, storing, repeating, or logging user passwords, credit card numbers, or one-time verification codes.
3. **One-Click Disconnect**: Users retain complete control with an accessible emergency disconnect button that terminates screen and voice streams instantly.
4. **Auto-Clearing Safety Cards**: Risk scores return to `LOW RISK / Device Secured` automatically when sessions or lab tests end.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
