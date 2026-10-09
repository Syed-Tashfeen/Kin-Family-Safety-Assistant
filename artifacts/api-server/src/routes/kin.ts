import { Router, type IRouter } from "express";
import {
  CreateKinLiveTokenBody,
  CreateKinLiveTokenResponse,
} from "@workspace/api-zod";
import { db, sessionsTable, alertsTable } from "@workspace/db";

const router: IRouter = Router();
const LIVE_MODEL = "gemini-3.8-live";
const TOKEN_WINDOW_MS = 10 * 60 * 1000;
const TOKEN_REQUEST_LIMIT = 8;
const tokenRequests = new Map<string, number[]>();

const highlightParameters = {
  type: "OBJECT",
  properties: {
    x: { type: "NUMBER", description: "Left position as a fraction from 0 to 1." },
    y: { type: "NUMBER", description: "Top position as a fraction from 0 to 1." },
    width: { type: "NUMBER", description: "Width as a fraction from 0 to 1." },
    height: { type: "NUMBER", description: "Height as a fraction from 0 to 1." },
    label: { type: "STRING", description: "A short instruction for the user." },
  },
  required: ["x", "y", "width", "height", "label"],
};

const scamAlertParameters = {
  type: "OBJECT",
  properties: {
    severity: {
      type: "STRING",
      enum: ["warning", "high", "critical"],
      description: "Risk level. Use high or critical for active scam indicators.",
    },
    title: { type: "STRING" },
    summary: { type: "STRING" },
    evidence: { type: "STRING" },
    recommendedAction: { type: "STRING" },
    x: { type: "NUMBER", description: "Optional screen highlight left position from 0 to 1." },
    y: { type: "NUMBER", description: "Optional screen highlight top position from 0 to 1." },
    width: { type: "NUMBER", description: "Optional screen highlight width from 0 to 1." },
    height: { type: "NUMBER", description: "Optional screen highlight height from 0 to 1." },
  },
  required: ["severity", "title", "summary", "evidence", "recommendedAction"],
};

const guardianRiskScoreParameters = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "Calculated risk score from 0 to 100." },
    screenUnderstanding: { type: "STRING", description: "Brief visual assessment of what is currently on screen." },
    conversationUnderstanding: { type: "STRING", description: "Brief assessment of what the user/caller is saying." },
    riskReasoning: { type: "STRING", description: "Reasoning evaluating pressure tactics, deception, or danger." },
    decision: { type: "STRING", enum: ["LOW RISK", "MEDIUM RISK", "HIGH RISK"] },
    recommendedAction: { type: "STRING", description: "Specific safe next step for the parent." },
  },
  required: ["score", "screenUnderstanding", "conversationUnderstanding", "riskReasoning", "decision", "recommendedAction"],
};

const systemInstruction = (language: string) => {
  const languagePreference =
    language === "auto"
      ? "Detect the parent's language and reply in the same language. Follow natural code-switching and do not ask them to choose a language."
      : `Speak in the language selected by the parent (language code: ${language}), while still understanding mixed-language speech.`;

  return [
    "You are Kin, a patient, protective technology guide for parents. Explain one simple step at a time, in plain language, and allow the parent to interrupt you at any moment.",
    languagePreference,
    "The shared screen is private. Describe only what is visible and never claim to have clicked a control or changed the device yourself.",
    "If a person, website, or pop-up asks the parent to install remote-access software (like AnyDesk or QuickSupport), share an OTP or PIN, move money, or keep a call secret, warn them immediately. Do not reassure them without evidence.",
    "When you see a useful screen control, call highlight_screen_element with normalized coordinates (0 to 1) and a short instruction.",
    "When you observe risks or changes, call guardian_risk_score with a 0-100 score, clear screen understanding, conversation understanding, risk reasoning, decision, and recommended action.",
    "When you detect a likely scam or urgent risk, call raise_scam_alert immediately with severity, a concise evidence-based summary, and one safe next step. Include a normalized screen region when the suspicious item is visible.",
    "You may use Google Search grounding to verify current contact details, warnings, or claims. Clearly distinguish confirmed information from uncertainty, and never ask for or repeat a password, PIN, or one-time code.",
  ].join(" ");
};

const functionTools = [
  {
    name: "highlight_screen_element",
    description:
      "Point out a visible screen control to help the parent with the next step. Coordinates are normalized fractions of the shared screen.",
    parameters: highlightParameters,
  },
  {
    name: "guardian_risk_score",
    description:
      "Periodically return the rolling guardian risk score and structured analysis.",
    parameters: guardianRiskScoreParameters,
  },
  {
    name: "raise_scam_alert",
    description:
      "Immediately warn the parent about a likely scam or urgent safety risk and show a safe next step.",
    parameters: scamAlertParameters,
  },
];

// Resilient in-memory store for sessions and alerts
type StoredSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  language: string;
  riskScore: number;
  toolsTriggered: number;
};

type StoredAlert = {
  id: string;
  sessionId?: string;
  createdAt: string;
  severity: string;
  title: string;
  summary: string;
  evidence: string;
  recommendedAction: string;
  screenshotUrl?: string;
  telegramNotified: boolean;
};

const inMemorySessions: StoredSession[] = [
  {
    id: "sess-01",
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 2 + 180000).toISOString(),
    status: "completed",
    language: "auto",
    riskScore: 94,
    toolsTriggered: 2,
  },
  {
    id: "sess-02",
    startedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    endedAt: new Date(Date.now() - 3600000 * 6 + 240000).toISOString(),
    status: "completed",
    language: "en",
    riskScore: 12,
    toolsTriggered: 1,
  },
];

const inMemoryAlerts: StoredAlert[] = [
  {
    id: "alert-01",
    sessionId: "sess-01",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    severity: "high",
    title: "Remote-Access Software Warning (AnyDesk)",
    summary: "Suspicious caller prompted parent to read aloud a 9-digit remote connection address.",
    evidence: "Screen capture displayed QuickSupport Desktop Agent with address 482 109 773.",
    recommendedAction: "Do not install or authorize connection. Hang up and call your bank's official number.",
    telegramNotified: true,
  },
];

function isSameOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) return true;
  try {
    if (
      origin.startsWith("chrome-extension://") ||
      origin.startsWith("moz-extension://") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1")
    ) {
      return true;
    }
    const originUrl = new URL(origin);
    const hostName = host.split(":")[0];
    return originUrl.hostname === hostName || originUrl.host === host;
  } catch {
    return true;
  }
}

function canIssueToken(ip: string) {
  const now = Date.now();
  const active = (tokenRequests.get(ip) ?? []).filter(
    (timestamp) => now - timestamp < TOKEN_WINDOW_MS,
  );
  if (active.length >= TOKEN_REQUEST_LIMIT) {
    tokenRequests.set(ip, active);
    return false;
  }
  active.push(now);
  tokenRequests.set(ip, active);
  return true;
}

// -------------------------------------------------------------
// REST Endpoints for Family Dashboard & Intervention History
// -------------------------------------------------------------

router.get("/kin/sessions", async (_req, res) => {
  try {
    if (db) {
      const dbSessions = await db.select().from(sessionsTable).limit(50);
      if (dbSessions.length > 0) return res.json(dbSessions);
    }
  } catch {
    // fallback to in-memory
  }
  res.json(inMemorySessions);
});

router.post("/kin/sessions", async (req, res) => {
  const session: StoredSession = {
    id: req.body.id || `sess-${Date.now()}`,
    startedAt: req.body.startedAt || new Date().toISOString(),
    endedAt: req.body.endedAt,
    status: req.body.status || "completed",
    language: req.body.language || "auto",
    riskScore: Number(req.body.riskScore) || 0,
    toolsTriggered: Number(req.body.toolsTriggered) || 0,
  };
  inMemorySessions.unshift(session);
  try {
    if (db) {
      await db.insert(sessionsTable).values({
        id: session.id,
        startedAt: new Date(session.startedAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
        status: session.status,
        language: session.language,
        riskScore: session.riskScore,
        toolsTriggered: session.toolsTriggered,
      });
    }
  } catch {
    // fallback maintained in memory
  }
  res.status(201).json(session);
});

router.get("/kin/alerts", async (_req, res) => {
  try {
    if (db) {
      const dbAlerts = await db.select().from(alertsTable).limit(50);
      if (dbAlerts.length > 0) return res.json(dbAlerts);
    }
  } catch {
    // fallback to in-memory
  }
  res.json(inMemoryAlerts);
});

router.post("/kin/alerts", async (req, res) => {
  const alert: StoredAlert = {
    id: req.body.id || `alert-${Date.now()}`,
    sessionId: req.body.sessionId,
    createdAt: req.body.createdAt || new Date().toISOString(),
    severity: req.body.severity || "high",
    title: req.body.title || "Scam Alert",
    summary: req.body.summary || "",
    evidence: req.body.evidence || "",
    recommendedAction: req.body.recommendedAction || "",
    screenshotUrl: req.body.screenshotUrl,
    telegramNotified: req.body.telegramNotified ?? true,
  };
  inMemoryAlerts.unshift(alert);
  try {
    if (db) {
      await db.insert(alertsTable).values({
        id: alert.id,
        sessionId: alert.sessionId,
        createdAt: new Date(alert.createdAt),
        severity: alert.severity,
        title: alert.title,
        summary: alert.summary,
        evidence: alert.evidence,
        recommendedAction: alert.recommendedAction,
        screenshotUrl: alert.screenshotUrl,
        telegramNotified: alert.telegramNotified,
      });
    }
  } catch {
    // fallback maintained in memory
  }
  res.status(201).json(alert);
});

// Telegram notification simulation & relay
router.post("/kin/telegram-alert", async (req, res) => {
  const { title, summary, evidence, screenshotPreview } = req.body;
  const dispatchRecord = {
    id: `tg-${Date.now()}`,
    channel: "@KinGuardianBot",
    deliveredAt: new Date().toISOString(),
    status: "delivered",
    recipient: "Family Safety Group (3 members)",
    message: `🚨 *KIN SAFETY INTERVENTION*\n\n*Incident:* ${title}\n*Summary:* ${summary}\n*Evidence:* ${evidence}\n\n_Auto-dispatched by Kin Guardian Service._`,
    hasScreenshot: Boolean(screenshotPreview),
  };
  res.json(dispatchRecord);
});

// -------------------------------------------------------------
// Live Token Broker for Google Gemini Live Multimodal WebSocket
// -------------------------------------------------------------

router.post("/kin/live-token", async (req, res) => {
  if (!isSameOrigin(req.get("origin"), req.get("host"))) {
    return res.status(403).json({ error: "Kin sessions can only be started from this app." });
  }

  if (!canIssueToken(req.ip || "unknown")) {
    return res.status(429).json({ error: "Please wait a few minutes before starting another live session." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "Live sessions are not configured yet. You can still try Kin in demo mode." });
  }

  const parsed = CreateKinLiveTokenBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Choose a supported language and try again." });
  }

  const now = Date.now();
  const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          uses: 1,
          expireTime: expiresAt,
          newSessionExpireTime,
          bidiGenerateContentSetup: {
            model: `models/${LIVE_MODEL}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            systemInstruction: {
              parts: [{ text: systemInstruction(parsed.data.preferredLanguage ?? "auto") }],
            },
            tools: [
              { googleSearch: {} },
              { functionDeclarations: functionTools },
            ],
          },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    const payload = (await response.json().catch(() => ({}))) as {
      name?: unknown;
      expireTime?: unknown;
      error?: { message?: unknown };
    };

    if (!response.ok) {
      req.log.error(
        {
          statusCode: response.status,
          providerMessage:
            typeof payload.error?.message === "string"
              ? payload.error.message
              : "No provider error message",
        },
        "Gemini Live token request failed",
      );
      return res.status(503).json({ error: "Kin could not start a live session. Please try again or use demo mode." });
    }

    if (typeof payload.name !== "string" || !payload.name) {
      req.log.error("Gemini Live token response did not include a token name");
      return res.status(503).json({ error: "Kin received an incomplete response. Please try again." });
    }

    const data = CreateKinLiveTokenResponse.parse({
      token: payload.name,
      model: LIVE_MODEL,
      expiresAt:
        typeof payload.expireTime === "string" ? payload.expireTime : expiresAt,
    });
    return res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "Could not create Gemini Live token");
    return res.status(503).json({ error: "Kin could not reach Gemini Live. Please try again or use demo mode." });
  }
});

export default router;
