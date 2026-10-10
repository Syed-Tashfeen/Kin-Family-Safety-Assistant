// Kin Chrome Extension Content Script
// Handles on-page visual pointer, red scam overlay, and autonomous threat scanning

let pointerEl = null;
let scamOverlayEl = null;
let alertedThreatKey = null;

// Pattern definitions for instant client-side autonomous detection
function scanForScamPatterns() {
  if (alertedThreatKey) return; // Already warned on this page

  const bodyText = document.body ? document.body.innerText : "";
  const pageUrl = window.location.href;

  // 1. Remote-Access & AnyDesk Patterns
  const remoteKeywords = /QuickSupport|AnyDesk|TeamViewer|Remote Assistance|unattended access/i;
  const codeRegex = /\b\d{3}[ -]\d{3}[ -]\d{3}\b/; // e.g. 482 109 773
  const hasRemoteText = remoteKeywords.test(bodyText) || remoteKeywords.test(pageUrl);
  const codeMatch = bodyText.match(codeRegex);

  if (hasRemoteText && (codeMatch || bodyText.includes("Your Address") || bodyText.includes("partner connects"))) {
    const codeVal = codeMatch ? codeMatch[0] : "connection code";
    const targetEl = document.querySelector(".access-code") || document.querySelector("h1, .card, form") || document.body;
    const rect = targetEl.getBoundingClientRect();
    const x = Math.max(0.1, Math.min(0.9, (rect.left + rect.width / 2) / (window.innerWidth || 1000)));
    const y = Math.max(0.1, Math.min(0.9, (rect.top + rect.height / 2) / (window.innerHeight || 800)));

    alertedThreatKey = "remote_takeover";
    const threat = {
      type: "remote_takeover",
      title: "Critical Remote-Access Attack Detected",
      summary: `Suspicious page attempting to solicit remote desktop takeover credentials (${codeVal}).`,
      evidence: `Visual detection of remote desktop software asking for connection code (${codeVal}).`,
      recommendedAction: "Do not read this code to anyone. Close this tab immediately.",
      score: 95,
      targetRect: { x, y, label: "⚠️ Scam Target: Do not share this 9-digit code" }
    };

    try {
      chrome.runtime.sendMessage({ action: "AUTONOMOUS_THREAT_DETECTED", data: threat });
    } catch {}
    return;
  }

  // 2. Urgent KYC / Bank Phishing Patterns
  const bankKeywords = /Urgent KYC|Fraud Reversal|Account Suspended|Enter 6-digit OTP|National Banking Security/i;
  if (bankKeywords.test(bodyText) || (pageUrl.includes("bank") && bodyText.includes("OTP"))) {
    const targetEl = document.querySelector("#otp-input, input[type='password'], form, .card") || document.body;
    const rect = targetEl.getBoundingClientRect();
    const x = Math.max(0.1, Math.min(0.9, (rect.left + rect.width / 2) / (window.innerWidth || 1000)));
    const y = Math.max(0.1, Math.min(0.9, (rect.top + rect.height / 2) / (window.innerHeight || 800)));

    alertedThreatKey = "bank_phishing";
    const threat = {
      type: "bank_phishing",
      title: "Urgent Bank Impersonation & OTP Harvest",
      summary: "Deceptive gateway attempting to capture one-time passwords under false urgency.",
      evidence: "Fake banking security gateway demanding immediate verification to prevent suspension.",
      recommendedAction: "Never type an OTP into an unfamiliar page. Call your bank's verified number.",
      score: 92,
      targetRect: { x, y, label: "⚠️ Phishing Field: Do not enter OTP or PIN" }
    };

    try {
      chrome.runtime.sendMessage({ action: "AUTONOMOUS_THREAT_DETECTED", data: threat });
    } catch {}
    return;
  }
}

// Run scanner periodically
setInterval(scanForScamPatterns, 1500);
setTimeout(scanForScamPatterns, 500);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SHOW_POINTER") {
    showVisualPointer(message.data);
    sendResponse({ success: true });
  } else if (message.action === "HIDE_POINTER") {
    hideVisualPointer();
    sendResponse({ success: true });
  } else if (message.action === "SHOW_RED_ALERT") {
    showRedScamOverlay(message.data);
    sendResponse({ success: true });
  } else if (message.action === "CLEAR_RED_ALERT") {
    clearRedScamOverlay();
    alertedThreatKey = null;
    sendResponse({ success: true });
  } else if (message.action === "SCAN_PAGE_NOW") {
    alertedThreatKey = null;
    scanForScamPatterns();
    sendResponse({ success: true });
  }
  return true;
});

function showVisualPointer({ x, y, label }) {
  if (!pointerEl) {
    pointerEl = document.createElement("div");
    pointerEl.id = "kin-pointer-container";
    pointerEl.innerHTML = `
      <div class="kin-pointer-label" id="kin-pointer-text"></div>
      <div class="kin-pointer-arrow"></div>
      <div class="kin-pointer-target-ring"></div>
    `;
    document.body.appendChild(pointerEl);
  }

  const pxX = Math.round(x * window.innerWidth);
  const pxY = Math.round(y * window.innerHeight);

  pointerEl.style.left = `${pxX}px`;
  pointerEl.style.top = `${pxY}px`;
  document.getElementById("kin-pointer-text").textContent = label || "Tap here";
  pointerEl.style.display = "flex";
}

function hideVisualPointer() {
  if (pointerEl) {
    pointerEl.style.display = "none";
  }
}

function showRedScamOverlay({ title, summary, evidence, recommendedAction }) {
  if (scamOverlayEl) {
    scamOverlayEl.remove();
  }

  scamOverlayEl = document.createElement("div");
  scamOverlayEl.id = "kin-scam-overlay";
  scamOverlayEl.innerHTML = `
    <div class="kin-overlay-card">
      <div class="kin-overlay-header">
        <span>🚨</span>
        <span>Kin Scam Intervention · Urgent Threat Detected</span>
      </div>
      <div class="kin-overlay-title">${escapeHtml(title || "High-Risk Threat Detected")}</div>
      <div class="kin-overlay-summary">${escapeHtml(summary || "A suspicious activity was detected on this page.")}</div>
      <div class="kin-overlay-evidence">
        <strong>What Kin noticed:</strong>
        <div>${escapeHtml(evidence || "Urgent request to install software or disclose credentials.")}</div>
      </div>
      <div class="kin-overlay-action">
        <span>🛡️ Safe Next Step:</span>
        <span>${escapeHtml(recommendedAction || "Close this tab and call your bank.")}</span>
      </div>
      <div class="kin-overlay-buttons">
        <button class="kin-btn-dismiss" id="kin-dismiss-btn">Dismiss Warning</button>
      </div>
    </div>
  `;

  document.body.appendChild(scamOverlayEl);

  document.getElementById("kin-dismiss-btn")?.addEventListener("click", () => {
    clearRedScamOverlay();
  });
}

function clearRedScamOverlay() {
  if (scamOverlayEl) {
    scamOverlayEl.remove();
    scamOverlayEl = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}
