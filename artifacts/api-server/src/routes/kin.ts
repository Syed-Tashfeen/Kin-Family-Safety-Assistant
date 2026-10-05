import { Router, type IRouter } from "express";
import {
  CreateKinLiveTokenBody,
  CreateKinLiveTokenResponse,
} from "@workspace/api-zod";

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

const systemInstruction = (language: string) => {
  const languagePreference =
    language === "auto"
      ? "Detect the parent's language and reply in the same language. Follow natural code-switching and do not ask them to choose a language."
      : `Speak in the language selected by the parent (language code: ${language}), while still understanding mixed-language speech.`;

  return [
    "You are Kin, a patient, protective technology guide for parents. Explain one simple step at a time, in plain language, and allow the parent to interrupt you at any moment.",
    languagePreference,
    "The shared screen is private. Describe only what is visible and never claim to have clicked a control or changed the device yourself.",
    "If a person, website, or pop-up asks the parent to install remote-access software, share a password or one-time code, move money, or keep a financial request secret, warn them immediately. Do not reassure them without evidence.",
    "When you see a useful screen control, call highlight_screen_element with normalized coordinates (0 to 1) and a short instruction.",
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
    name: "raise_scam_alert",
    description:
      "Immediately warn the parent about a likely scam or urgent safety risk and show a safe next step.",
    parameters: scamAlertParameters,
  },
];

function isSameOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
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
