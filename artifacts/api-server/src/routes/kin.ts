import { Router, type IRouter } from "express";
import {
  CreateKinLiveTokenBody,
  CreateKinLiveTokenResponse,
} from "@workspace/api-zod";
import { db, sessionsTable, alertsTable } from "@workspace/db";

const router: IRouter = Router();
const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
const TOKEN_WINDOW_MS = 10 * 60 * 1000;
const TOKEN_REQUEST_LIMIT = 1000;
const tokenRequests = new Map<string, number[]>();

function getGeminiApiKeys(): string[] {
  const rawList = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return rawList
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

let activeKeyIndex = 0;

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
      origin === "null" ||
      origin.startsWith("file://") ||
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
  return res.json(inMemorySessions);
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
  return res.status(201).json(session);
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
  return res.json(inMemoryAlerts);
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
  return res.status(201).json(alert);
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
  return res.json(dispatchRecord);
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

  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    return res.status(503).json({ error: "Live sessions are not configured yet. You can still try Kin in demo mode." });
  }

  const parsed = CreateKinLiveTokenBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Choose a supported language and try again." });
  }

  const now = Date.now();
  const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  const startIndex = activeKeyIndex;
  let lastErrorMessage = "Unknown error";

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const keyIndex = (startIndex + attempt) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];

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
        const errorMsg =
          typeof payload.error?.message === "string"
            ? payload.error.message
            : `HTTP ${response.status}`;
        lastErrorMessage = errorMsg;
        req.log.warn(
          {
            keyIndex,
            totalKeys: apiKeys.length,
            statusCode: response.status,
            providerMessage: errorMsg,
          },
          `Gemini API key [${keyIndex + 1}/${apiKeys.length}] failed or exhausted; failing over to next key...`,
        );
        continue;
      }

      if (typeof payload.name !== "string" || !payload.name) {
        req.log.error("Gemini Live token response did not include a token name");
        lastErrorMessage = "Missing token name in response";
        continue;
      }

      // Rotate active index forward so the next user starts with the next key
      activeKeyIndex = (keyIndex + 1) % apiKeys.length;
      req.log.info({ keyIndex: keyIndex + 1, totalKeys: apiKeys.length }, "Gemini Live token issued successfully");

      const data = CreateKinLiveTokenResponse.parse({
        token: payload.name,
        model: LIVE_MODEL,
        expiresAt:
          typeof payload.expireTime === "string" ? payload.expireTime : expiresAt,
      });
      return res.json(data);
    } catch (error) {
      req.log.warn(
        { keyIndex: keyIndex + 1, err: error },
        `Could not reach Gemini Live with key [${keyIndex + 1}/${apiKeys.length}], trying next...`,
      );
      lastErrorMessage = error instanceof Error ? error.message : "Network error";
    }
  }

  req.log.error(
    { lastErrorMessage, keysTested: apiKeys.length },
    "All Gemini API keys in rotation pool failed or exceeded quota",
  );
  return res.status(503).json({
    error: `All ${apiKeys.length} Gemini API key(s) in the rotation pool have exceeded quota or failed (${lastErrorMessage}). Please add fresh keys from a different Google account or use demo mode.`,
  });
});

// -------------------------------------------------------------
// REST Endpoint for Direct Text Chat using Gemini
// -------------------------------------------------------------
router.post("/kin/chat", async (req, res) => {
  const { message, history, preferredLanguage } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    return res.status(503).json({ error: "Gemini API key is not configured" });
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (Array.isArray(history)) {
    for (const item of history.slice(-6)) {
      const role = (item.role === "you" || item.role === "user") ? "user" : "model";
      if (item.text && typeof item.text === "string") {
        contents.push({
          role,
          parts: [{ text: item.text }],
        });
      }
    }
  }
  contents.push({
    role: "user",
    parts: [{ text: message }],
  });

  const languagePrompt =
    preferredLanguage && preferredLanguage !== "auto"
      ? `Respond in language code ${preferredLanguage}.`
      : "Detect the parent's language and reply in the same natural language.";

  const systemPrompt = [
    "You are Kin, a patient, warm, and protective technology guide for parents and families.",
    "Explain one simple step at a time, in clear, plain language.",
    languagePrompt,
    "Help the parent feel confident, calm, and safe.",
    "Carefully evaluate safety and scam risks:",
    "- If someone asks them to install remote-access software (like AnyDesk, TeamViewer, QuickSupport), share an OTP, PIN, password, wire money, or keep a call secret, classify as HIGH RISK with a high score (80-99) and warn them urgently with clear next steps.",
    "- If they ask a normal question, general assistance, or standard inquiry, classify as LOW RISK (0-20).",
    "Always return valid JSON according to the schema.",
  ].join(" ");

  const startIndex = activeKeyIndex;
  let lastErrorMessage = "Unknown error";

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const keyIndex = (startIndex + attempt) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  reply: { type: "STRING", description: "Warm, plain-language response to the parent." },
                  riskScore: { type: "INTEGER", description: "Calculated risk score from 0 to 100." },
                  decision: { type: "STRING", enum: ["LOW RISK", "MEDIUM RISK", "HIGH RISK"] },
                  screenUnderstanding: { type: "STRING", description: "Screen or context understanding." },
                  conversationUnderstanding: { type: "STRING", description: "Conversation summary." },
                  riskReasoning: { type: "STRING", description: "Clear risk reasoning." },
                  recommendedAction: { type: "STRING", description: "One safe next step for the parent." },
                },
                required: ["reply", "riskScore", "decision", "riskReasoning", "recommendedAction"],
              },
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as any;
        lastErrorMessage = errJson.error?.message || `HTTP ${response.status}`;
        continue;
      }

      const data = (await response.json()) as any;
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastErrorMessage = "Empty response from Gemini";
        continue;
      }

      const parsed = JSON.parse(rawText);
      activeKeyIndex = (keyIndex + 1) % apiKeys.length;
      return res.json(parsed);
    } catch (err: any) {
      lastErrorMessage = err instanceof Error ? err.message : "Network error";
    }
  }

  return res.status(503).json({ error: `Could not generate AI response: ${lastErrorMessage}` });
});

export default router;

