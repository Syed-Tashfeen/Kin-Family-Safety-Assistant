// Kin Chrome Extension Side Panel Controller (P0 Demo)
// Live Voice + Tab Vision + Gemini Live WS + Function Calling + Content Script Overlays

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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActiveTab(action, data = {}) {
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action, data });
    }
  } catch (err) {
    console.warn("Could not message content script on active tab:", err);
  }
}

// -------------------------------------------------------------
// UI State Updates
// -------------------------------------------------------------
function setLiveState(live) {
  isLive = live;
  if (live) {
    micBtn.classList.add("active");
    micBtn.textContent = "🛑";
    micStatusLabel.textContent = "Live Session Active";
    micStatusSub.textContent = "Streaming mic & active tab frames (~1 FPS)";
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
// Tab Frame Capturer (~1 FPS)
// -------------------------------------------------------------
function captureAndSendTabFrame() {
  if (!isLive || !socket || socket.readyState !== WebSocket.OPEN) return;

  chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 50 }, (dataUrl) => {
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
    }
  });
}

// -------------------------------------------------------------
// Gemini Live WebSocket Audio & Vision Pipeline
// -------------------------------------------------------------
async function startLiveSession() {
  try {
    micStatusLabel.textContent = "Requesting secure token…";

    // 1. Fetch ephemeral token from backend
    const res = await fetch(`${BACKEND_URL}/api/kin/live-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLanguage: "auto" }),
    });

    if (!res.ok) {
      throw new Error(`Token gateway returned ${res.status}`);
    }

    const { token, model } = await res.json();

    // 2. Open Gemini Live Multimodal WebSocket
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
              { googleSearch: {} },
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

      // 3. Start Microphone Audio Capture (16kHz PCM)
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });

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

      // 4. Start Tab Frame Capture Loop (~1 FPS)
      frameTimer = setInterval(captureAndSendTabFrame, 1000);
      captureAndSendTabFrame();

      setLiveState(true);
    };

    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
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
            playAlertChime();
            // Trigger on-page red overlay
            sendToActiveTab("SHOW_RED_ALERT", {
              title: args.title,
              summary: args.summary,
              evidence: args.evidence,
              recommendedAction: args.recommendedAction,
            });
            // Update Guardian card
            updateGuardianAnalysis({
              score: 95,
              screen: args.title,
              voice: "Coercive instruction identified",
              reason: args.evidence,
              decision: "HIGH RISK",
            });
            // Dispatch Telegram Alert
            fetch(`${BACKEND_URL}/api/kin/telegram-alert`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: args.title,
                summary: args.summary,
                evidence: args.evidence,
                screenshotPreview: true,
              }),
            }).catch(() => {});

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

testScamOverlayBtn.addEventListener("click", async () => {
  playAlertChime();
  // 1. On-page Red Scam Overlay
  await sendToActiveTab("SHOW_RED_ALERT", {
    title: "Critical Remote-Access Attack Detected",
    summary: "Suspicious page attempting to solicit remote desktop takeover credentials (482 109 773).",
    evidence: "QuickSupport AnyDesk takeover address observed on screen.",
    recommendedAction: "Do not read the connection code. Disconnect immediately.",
  });

  // 2. Update Guardian Analysis Card
  updateGuardianAnalysis({
    score: 95,
    screen: "AnyDesk QuickSupport Remote Takeover Form",
    voice: "Caller asked for 9-digit connection address",
    reason: "Severe social engineering & tech support scam vector",
    decision: "HIGH RISK",
  });

  // 3. Dispatch Telegram Relay
  fetch(`${BACKEND_URL}/api/kin/telegram-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Remote-Access Scam Triggered (AnyDesk)",
      summary: "Parent was prompted to share remote connection code with an unexpected caller.",
      evidence: "Visual recognition of connection address 482 109 773.",
      screenshotPreview: true,
    }),
  }).catch(() => {});
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
