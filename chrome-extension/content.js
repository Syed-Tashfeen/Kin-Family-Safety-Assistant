// Kin Chrome Extension Content Script
// Handles on-page visual pointer and red scam overlay

let pointerEl = null;
let scamOverlayEl = null;

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
