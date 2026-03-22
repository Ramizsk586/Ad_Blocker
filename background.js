const DEFAULT_STATE = {
  enabled: true,
  strictMode: true,
  debug: false,
  stats: {
    adsBlocked: 0,
    adsSkipped: 0,
    prerollSkipped: 0,
    midrollSkipped: 0,
    displayAdsBlocked: 0,
    overlayAdsBlocked: 0
  }
};

function isYouTubeUrl(url) {
  return /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(String(url || ""));
}

function isTrustedSender(sender) {
  return isYouTubeUrl(sender?.url || sender?.tab?.url || "");
}

async function ensureRulesetEnabled(enabled) {
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? ["main_rules"] : [],
      disableRulesetIds: enabled ? [] : ["main_rules"]
    });
  } catch (e) {
    console.error("[BG] ruleset toggle failed:", e);
  }
}

async function getStats() {
  const s = await chrome.storage.local.get(["stats", "enabled"]);
  const defaultStats = { ...DEFAULT_STATE.stats };
  const storedStats = s.stats || {};
  return {
    enabled: s.enabled !== false,
    strictMode: true,
    debug: false,
    stats: { ...defaultStats, ...storedStats }
  };
}

async function updateStats(newStats) {
  if (!newStats || typeof newStats !== 'object') return;
  const current = await chrome.storage.local.get(["stats"]);
  const existing = current.stats || {};
  const merged = {
    adsBlocked: Math.max(0, Number(newStats.adsBlocked ?? existing.adsBlocked ?? 0)),
    adsSkipped: Math.max(0, Number(newStats.adsSkipped ?? existing.adsSkipped ?? 0)),
    prerollSkipped: Math.max(0, Number(newStats.prerollSkipped ?? existing.prerollSkipped ?? 0)),
    midrollSkipped: Math.max(0, Number(newStats.midrollSkipped ?? existing.midrollSkipped ?? 0)),
    displayAdsBlocked: Math.max(0, Number(newStats.displayAdsBlocked ?? existing.displayAdsBlocked ?? 0)),
    overlayAdsBlocked: Math.max(0, Number(newStats.overlayAdsBlocked ?? existing.overlayAdsBlocked ?? 0))
  };
  await chrome.storage.local.set({ stats: merged });
}

async function incrementCounter(key, amount) {
  const n = Math.max(0, Number(amount) || 0);
  if (n < 1) return;
  const current = await chrome.storage.local.get(["stats"]);
  const existing = current.stats || {};
  const newValue = Math.max(0, Number(existing[key] ?? 0) + n);
  await chrome.storage.local.set({
    stats: { ...existing, [key]: newValue }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
    const existingStats = existing.stats || {};
    await chrome.storage.local.set({
      ...DEFAULT_STATE,
      ...existing,
      strictMode: true,
      debug: false,
      stats: { ...DEFAULT_STATE.stats, ...existingStats }
    });
    await ensureRulesetEnabled(existing.enabled ?? DEFAULT_STATE.enabled);
  } catch (e) {
    console.error("[BG] install error:", e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const s = await chrome.storage.local.get(["enabled"]);
    await ensureRulesetEnabled(s.enabled !== false);
  } catch (e) {
    console.error("[BG] startup error:", e);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const stats = await getStats();

    switch (message?.type) {
      case "GET_STATS":
        sendResponse(stats);
        break;

      case "GET_OPTIONS":
        sendResponse({ strictMode: true, debug: false });
        break;

      case "SET_ENABLED": {
        const next = message.enabled !== false;
        await chrome.storage.local.set({ enabled: next });
        await ensureRulesetEnabled(next);
        sendResponse({ ...stats, enabled: next });
        break;
      }

      case "UPDATE_OPTIONS":
        await chrome.storage.local.set({ strictMode: true, debug: false });
        sendResponse({ strictMode: true, debug: false });
        break;

      case "INCREMENT_BLOCKED":
        if (!isTrustedSender(sender)) { sendResponse({ ok: false }); break; }
        await incrementCounter("adsBlocked", message.amount ?? 1);
        sendResponse({ ok: true });
        break;

      case "INCREMENT_SKIPPED":
        if (!isTrustedSender(sender)) { sendResponse({ ok: false }); break; }
        await incrementCounter("adsSkipped", message.amount ?? 1);
        sendResponse({ ok: true });
        break;

      case "UPDATE_STATS":
        if (!isTrustedSender(sender)) { sendResponse({ ok: false }); break; }
        if (message.stats) {
          await updateStats(message.stats);
        }
        sendResponse({ ok: true });
        break;

      case "RESET_STATS":
        await chrome.storage.local.set({ stats: { ...DEFAULT_STATE.stats } });
        sendResponse({ ok: true });
        break;

      case "GET_DETAILED_STATS":
        sendResponse(stats);
        break;

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })().catch(e => {
    console.error("[BG] error:", e);
    sendResponse({ ok: false, error: "Internal error" });
  });

  return true;
});
