// Kin Extension Service Worker (Manifest V3)
chrome.runtime.onInstalled.addListener(() => {
  console.log("Kin Family Safety Extension installed.");
});

// Configure side panel behavior to open on action click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting side panel behavior:", error));
}
