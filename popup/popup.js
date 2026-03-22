function updateUiFromStats(stats) {
  const enabled = stats?.enabled !== false;
  const statsData = stats?.stats || {};

  const blockedEl = document.getElementById("blocked-count");
  const skippedEl = document.getElementById("skipped-count");
  const prerollEl = document.getElementById("preroll-count");
  const midrollEl = document.getElementById("midroll-count");
  const displayEl = document.getElementById("display-count");
  const overlayEl = document.getElementById("overlay-count");
  const toggleEl = document.getElementById("toggle-switch");
  const statusText = document.getElementById("status-text");
  const statusDot = document.getElementById("status-dot");

  if (blockedEl) blockedEl.textContent = formatNumber(statsData.adsBlocked || 0);
  if (skippedEl) skippedEl.textContent = formatNumber(statsData.adsSkipped || 0);
  if (prerollEl) prerollEl.textContent = formatNumber(statsData.prerollSkipped || 0);
  if (midrollEl) midrollEl.textContent = formatNumber(statsData.midrollSkipped || 0);
  if (displayEl) displayEl.textContent = formatNumber(statsData.displayAdsBlocked || 0);
  if (overlayEl) overlayEl.textContent = formatNumber(statsData.overlayAdsBlocked || 0);
  if (toggleEl) toggleEl.checked = enabled;
  if (statusText) statusText.textContent = enabled ? "Active" : "Paused";
  if (statusDot) {
    statusDot.classList.remove("active", "paused");
    statusDot.classList.add(enabled ? "active" : "paused");
  }
}

function formatNumber(num) {
  num = Number(num) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

function sendMessage(msg) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, res => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(res ?? null);
      });
    } catch (_) { resolve(null); }
  });
}

async function refreshStats() {
  const stats = await sendMessage({ type: "GET_STATS" });
  if (stats) updateUiFromStats(stats);
}

async function updateFooter() {
  const footer = document.getElementById("footer-text");
  if (!footer) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs?.[0]?.url || "";
    footer.textContent = /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(url)
      ? "Running on YouTube"
      : "Open YouTube to activate";
  } catch (_) {
    footer.textContent = "Open YouTube to activate";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const toggleSwitch = document.getElementById("toggle-switch");
  const resetBtn = document.getElementById("reset-btn");

  await sendMessage({ type: "UPDATE_OPTIONS", strictMode: true, debug: false });
  await refreshStats();
  await updateFooter();

  if (toggleSwitch) {
    toggleSwitch.addEventListener("change", async () => {
      const enabled = toggleSwitch.checked;
      chrome.storage.local.set({ enabled });
      const response = await sendMessage({ type: "SET_ENABLED", enabled });
      if (response) updateUiFromStats(response);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("Reset all ad blocker statistics?")) {
        await sendMessage({ type: "RESET_STATS" });
        await refreshStats();
      }
    });
  }

  setInterval(async () => {
    await refreshStats();
    await updateFooter();
  }, 2000);
});
