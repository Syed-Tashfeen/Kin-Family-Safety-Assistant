// Kin Chrome Extension Side Panel Controller (P0 Demo)
// Live Voice + Tab Vision + Gemini Live WS + Autonomous Threat Triggering + Overlays

const BACKEND_URL = "http://localhost:5000";

let isLive = false;
let socket = null;
let audioContext = null;
let audioStream = null;
let processorNode = null;
let sourceNode = null;
let frameTimer = null;
let audioQueue = [];
let isAudioPlaying = false;
let activeSource = null;
let evaluationTurnCounter = 0;

// DOM Elements
const micBtn = document.getElementById("mic-toggle-btn");
const micStatusLabel = document.getElementById("mic-status-label");
const micStatusSub = document.getElementById("mic-status-sub");
const liveBadge = document.getElementById("live-badge");
const badgeText = document.getElementById("badge-text");

const riskScorePill = document.getElementById("risk-score-pill");
const analysisBox = document.getElementById("analysis-box");
const termScreen = document.getElementById("term-screen");
const termVoice = document.getElementById("term-voice");
const termReason = document.getElementById("term-reason");
const termDecisionPill = document.getElementById("term-decision-pill");

const testPointerBtn = document.getElementById("test-pointer-btn");
const testScamOverlayBtn = document.getElementById("test-scam-overlay-btn");
const clearOverlayBtn = document.getElementById("clear-overlay-btn");
const openAnyDeskBtn = document.getElementById("open-anydesk-lab-btn");
const openBankBtn = document.getElementById("open-bank-lab-btn");

// -------------------------------------------------------------
// Audio Chime Synthesizer
// -------------------------------------------------------------
function playAlertChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// -------------------------------------------------------------
// Content Script Messaging Helpers
// -------------------------------------------------------------
async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch {
    return null;
  }
}

async function sendToActiveTab(action, data = {}) {
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action, data });
    }
  } catch (err) {
    // Normal when active tab is a chrome:// internal page or restricted
  }
}

// -------------------------------------------------------------
// UI State Updates
// -------------------------------------------------------------
function setLiveState(live, hasRealMic = true) {
  isLive = live;
  if (live) {
    micBtn.classList.add("active");
    micBtn.textContent = "🛑";
    micStatusLabel.textContent = "Live Guardian Active";
    micStatusSub.textContent = hasRealMic
      ? "Streaming voice & active tab frames (~1 FPS)"
      : "Active tab vision & AI monitoring running";
    liveBadge.classList.add("live");
    badgeText.textContent = "WATCHING LIVE";
  } else {
    micBtn.classList.remove("active");
    micBtn.textContent = "🎙️";
    micStatusLabel.textContent = "Start Guardian Live Session";
    micStatusSub.textContent = "Captures tab ~1 FPS and streams live voice to Gemini";
    liveBadge.classList.remove("live");
    badgeText.textContent = "READY";
  }
}

function updateGuardianAnalysis({ score, screen, voice, reason, decision }) {
  riskScorePill.textContent = `RISK ${score}/100`;
  termScreen.textContent = `✓ ${screen}`;
  termVoice.textContent = `✓ ${voice}`;
  termReason.textContent = `✓ ${reason}`;
  termDecisionPill.textContent = decision;

  if (decision === "HIGH RISK" || score > 70) {
    analysisBox.classList.add("high-risk");
    termDecisionPill.className = "decision-pill danger";
    riskScorePill.style.color = "#ef4444";
  } else {
    analysisBox.classList.remove("high-risk");
    termDecisionPill.className = "decision-pill safe";
    riskScorePill.style.color = "#10b981";
  }
}

// -------------------------------------------------------------
// Autonomous Threat Handler (Triggered via DOM or Gemini Vision)
// -------------------------------------------------------------
function handleThreatDetected(threat) {
  playAlertChime();

  // Voice announcement
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        "Warning: Kin detected an active remote-access scam pattern on this screen. Do not share your connection code."
      );
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch {}

  // 1. Show Red Scam Overlay on page
  sendToActiveTab("SHOW_RED_ALERT", {
    title: threat.title || "Critical Remote-Access Attack Detected",
    summary: threat.summary || "Suspicious page attempting to solicit remote desktop takeover credentials.",
    evidence: threat.evidence || "Remote access takeover pattern observed on screen.",
    recommendedAction: threat.recommendedAction || "Do not read the connection code. Disconnect immediately.",
  });

  // 2. Show visual pointer at the threat element
  if (threat.targetRect) {
    sendToActiveTab("SHOW_POINTER", threat.targetRect);
  }

  // 3. Update Guardian Analysis Card in sidepanel
  updateGuardianAnalysis({
    score: threat.score || 95,
    screen: threat.title || "AnyDesk QuickSupport Remote Takeover Form",
    voice: "Active threat pattern detected on page",
    reason: threat.evidence || "Severe social engineering & tech support scam vector",
    decision: "HIGH RISK",
  });

  // 4. Dispatch Telegram Relay to family group
  fetch(`${BACKEND_URL}/api/kin/telegram-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: threat.title || "Remote-Access Scam Triggered",
      summary: threat.summary || "Parent was prompted to share connection code with an unexpected caller.",
      evidence: threat.evidence || "Visual recognition of connection address on page.",
      screenshotPreview: true,
    }),
  }).catch(() => {});
}

// -------------------------------------------------------------
// Tab Frame Capturer (~1 FPS)
// -------------------------------------------------------------
function captureAndSendTabFrame() {
  if (!isLive) return;

  chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 50 }, (dataUrl) => {
    // Check runtime error cleanly (e.g. on chrome:// pages) to avoid unhandled exceptions
    if (chrome.runtime.lastError || !dataUrl) return;

    const base64Data = dataUrl.split(",")[1];
    if (base64Data && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          realtimeInput: {
            video: {
              mimeType: "image/jpeg",
              data: base64Data,
            },
          },
        })
      );

      evaluationTurnCounter++;
      // Every 4 seconds, prompt Gemini vision to evaluate the scene
      if (evaluationTurnCounter % 4 === 0) {
        socket.send(
          JSON.stringify({
            realtimeInput: {
              text: "Guardian evaluation turn: Examine the visible tab frame carefully. If any remote-access code (AnyDesk, QuickSupport), scam OTP fields, or deceptive threats are present, immediately call raise_scam_alert and guardian_risk_score.",
            },
          })
        );
      }
    }
  });

  // Instruct active tab content script to run on-page pattern detection
  sendToActiveTab("SCAN_PAGE_NOW");
}

// -------------------------------------------------------------
// Gemini Live WebSocket Audio & Vision Pipeline
// -------------------------------------------------------------
async function startLiveSession() {
  try {
    micStatusLabel.textContent = "Connecting Guardian Live…";

    // 1. Resilient Microphone Pipeline:
    // Try real microphone first; if restricted in side panel, fall back to clean Web Audio stream
    let hasRealMic = false;
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      hasRealMic = true;
    } catch (micErr) {
      console.warn("Direct microphone unavailable in sidepanel, using Web Audio stream:", micErr);
      try {
        const fallbackCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = fallbackCtx.createMediaStreamDestination();
        const osc = fallbackCtx.createOscillator();
        const gain = fallbackCtx.createGain();
        gain.gain.value = 0.0;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        audioStream = dest.stream;
      } catch (e) {
        console.warn("Fallback audio stream error:", e);
      }
    }

    micStatusLabel.textContent = "Requesting secure token…";

    // 2. Fetch ephemeral token from backend
    const res = await fetch(`${BACKEND_URL}/api/kin/live-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLanguage: "auto" }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Token gateway returned ${res.status}`);
    }

    const { token, model } = await res.json();

    // 3. Open Gemini Live Multimodal WebSocket
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = async () => {
      // Send session setup with function declarations
      socket.send(
        JSON.stringify({
          setup: {
            model: `models/${model}`,
            generationConfig: { responseModalities: ["AUDIO"] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [
                {
                  text: "You are Kin, an empathetic protective technology guardian for parents. Look at the tab frames and listen. If you see remote desktop prompts (AnyDesk, QuickSupport), suspicious OTP fields, or pressure tactics, call raise_scam_alert immediately with high severity, evidence, and safe next step. Use highlight_screen_element to point out safe controls.",
                },
              ],
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "highlight_screen_element",
                    description: "Point at a visible element on the user page.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        x: { type: "NUMBER", description: "Horizontal fraction (0-1)" },
                        y: { type: "NUMBER", description: "Vertical fraction (0-1)" },
                        label: { type: "STRING", description: "Instruction text" },
                      },
                      required: ["x", "y", "label"],
                    },
                  },
                  {
                    name: "guardian_risk_score",
                    description: "Rolling risk assessment of tab activity.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        score: { type: "INTEGER" },
                        screenUnderstanding: { type: "STRING" },
                        conversationUnderstanding: { type: "STRING" },
                        riskReasoning: { type: "STRING" },
                        decision: { type: "STRING", enum: ["LOW RISK", "MEDIUM RISK", "HIGH RISK"] },
                        recommendedAction: { type: "STRING" },
                      },
                      required: ["score", "screenUnderstanding", "conversationUnderstanding", "riskReasoning", "decision", "recommendedAction"],
                    },
                  },
                  {
                    name: "raise_scam_alert",
                    description: "Trigger immediate scam intervention with red overlay.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        severity: { type: "STRING", enum: ["warning", "high", "critical"] },
                        title: { type: "STRING" },
                        summary: { type: "STRING" },
                        evidence: { type: "STRING" },
                        recommendedAction: { type: "STRING" },
                      },
                      required: ["severity", "title", "summary", "evidence", "recommendedAction"],
                    },
                  },
                ],
              },
            ],
          },
        })
      );

      // Start Audio Capture pipeline (if audioStream is active)
      if (audioStream) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();

        sourceNode = audioContext.createMediaStreamSource(audioStream);
        processorNode = audioContext.createScriptProcessor(4096, 1, 1);

        processorNode.onaudioprocess = (e) => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const ratio = audioContext.sampleRate / 16000;
          const length = Math.floor(input.length / ratio);
          const pcm = new Int16Array(length);

          for (let i = 0; i < length; i++) {
            const sample = input[Math.floor(i * ratio)];
            pcm[i] = Math.max(-1, Math.min(1, sample)) * 32767;
          }

          let binary = "";
          new Uint8Array(pcm.buffer).forEach((byte) => (binary += String.fromCharCode(byte)));

          socket.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  mimeType: "audio/pcm;rate=16000",
                  data: btoa(binary),
                },
              },
            })
          );
        };

        sourceNode.connect(processorNode);
        processorNode.connect(audioContext.destination);
      }

      // Start Tab Frame Capture Loop (~1 FPS)
      evaluationTurnCounter = 0;
      frameTimer = setInterval(captureAndSendTabFrame, 1000);
      captureAndSendTabFrame();

      setLiveState(true, hasRealMic);
    };

    socket.onmessage = async (event) => {
      try {
        const rawText = typeof event.data === "string" ? event.data : await event.data.text();
        const packet = JSON.parse(rawText);
        const parts = packet.serverContent?.modelTurn?.parts || [];

        // Synthesized audio playback
        for (const part of parts) {
          if (part.inlineData?.data) {
            audioQueue.push(part.inlineData.data);
            playNextAudio();
          }
        }

        // Handle Tool Calls
        const calls = [
          ...(packet.toolCall?.functionCalls || []),
          ...parts.map((p) => p.functionCall).filter(Boolean),
        ];

        for (const call of calls) {
          const { name, args, id } = call;

          if (name === "highlight_screen_element") {
            sendToActiveTab("SHOW_POINTER", {
              x: args.x,
              y: args.y,
              label: args.label,
            });
            socket.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses: [{ name, id, response: { success: true } }],
                },
              })
            );
          }

          if (name === "guardian_risk_score") {
            updateGuardianAnalysis({
              score: args.score || 85,
              screen: args.screenUnderstanding || "Tab content monitored",
              voice: args.conversationUnderstanding || "Listening to speech",
              reason: args.riskReasoning || "Threat vector evaluated",
              decision: args.decision || "HIGH RISK",
            });
            socket.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses: [{ name, id, response: { received: true } }],
                },
              })
            );
          }

          if (name === "raise_scam_alert") {
            handleThreatDetected({
              title: args.title,
              summary: args.summary,
              evidence: args.evidence,
              recommendedAction: args.recommendedAction,
              score: 95,
            });

            socket.send(
              JSON.stringify({
                toolResponse: {
                  functionResponses: [{ name, id, response: { interventionExecuted: true } }],
                },
              })
            );
          }
        }
      } catch (err) {
        console.warn("WebSocket packet parse error:", err);
      }
    };

    socket.onerror = () => {
      console.error("Gemini Live WebSocket error");
      stopLiveSession();
    };

    socket.onclose = () => {
      stopLiveSession();
    };
  } catch (err) {
    console.error("Could not start live session:", err);
    alert(`Could not start live session: ${err.message}. Make sure backend is running on http://localhost:5000`);
    stopLiveSession();
  }
}

function stopLiveSession() {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
  if (processorNode) {
    processorNode.disconnect();
    processorNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  audioQueue = [];
  isAudioPlaying = false;
  setLiveState(false);
}

function playNextAudio() {
  if (isAudioPlaying || audioQueue.length === 0 || !audioContext) return;
  const chunkBase64 = audioQueue.shift();
  if (!chunkBase64) return;

  isAudioPlaying = true;
  const binary = atob(chunkBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const samples = new Int16Array(bytes.buffer);
  const buffer = audioContext.createBuffer(1, samples.length, 24000);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;

  const src = audioContext.createBufferSource();
  activeSource = src;
  src.buffer = buffer;
  src.connect(audioContext.destination);
  src.onended = () => {
    isAudioPlaying = false;
    playNextAudio();
  };
  src.start();
}

// -------------------------------------------------------------
// Event Listeners for UI Buttons
// -------------------------------------------------------------
micBtn.addEventListener("click", () => {
  if (isLive) {
    stopLiveSession();
  } else {
    startLiveSession();
  }
});

// Interactive Test Triggers
testPointerBtn.addEventListener("click", async () => {
  await sendToActiveTab("SHOW_POINTER", {
    x: 0.5,
    y: 0.35,
    label: "Safe verification link · Click here",
  });
});

testScamOverlayBtn.addEventListener("click", () => {
  handleThreatDetected({
    title: "Critical Remote-Access Attack Detected",
    summary: "Suspicious page attempting to solicit remote desktop takeover credentials (482 109 773).",
    evidence: "QuickSupport AnyDesk takeover address observed on screen.",
    recommendedAction: "Do not read the connection code. Disconnect immediately.",
    score: 95,
  });
});

clearOverlayBtn.addEventListener("click", async () => {
  await sendToActiveTab("CLEAR_RED_ALERT");
  await sendToActiveTab("HIDE_POINTER");
  updateGuardianAnalysis({
    score: 12,
    screen: "Active tab monitored for deceptive forms",
    voice: "Audio channel listening for social engineering",
    reason: "No coercive language or remote software",
    decision: "LOW RISK",
  });
});

// Quick Lab Launchers
openAnyDeskBtn?.addEventListener("click", () => {
  const targetPort = "5174";
  chrome.tabs.create({ url: `http://localhost:${targetPort}/scam-lab/anydesk.html` });
});

openBankBtn?.addEventListener("click", () => {
  const targetPort = "5174";
  chrome.tabs.create({ url: `http://localhost:${targetPort}/scam-lab/bank.html` });
});

// Listen for messages from permission tab or content script
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.action === "MIC_PERMISSION_GRANTED") {
      micStatusLabel.textContent = "Microphone permitted! Ready to start.";
      micStatusSub.textContent = "Click mic to begin live Guardian session";
    } else if (msg?.action === "AUTONOMOUS_THREAT_DETECTED" && msg?.data) {
      handleThreatDetected(msg.data);
    }
  });
}
