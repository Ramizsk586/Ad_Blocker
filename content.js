(() => {
  if (window.__YT_AD_BLOCKER_V5__) return;
  window.__YT_AD_BLOCKER_V5__ = true;

  const AD_SELECTORS = [
    ".ytp-ad-overlay-container",
    ".ytp-ad-text-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-module",
    ".ytp-ad-player-overlay",
    ".ytp-ad-player-overlay-layout",
    ".ytp-ad-player-overlay-skip-or-preview",
    ".ytp-ad-progress",
    ".ytp-ad-progress-list",
    ".ytp-ad-persistent-progress-bar-container",
    ".ytp-ad-skip-button-container",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-action-interstitial",
    ".ytp-ad-action-interstitial-background-color",
    ".ytp-ad-preview-container",
    ".ytp-ad-preview-text-container",
    ".video-ads",
    ".ytp-ad-visit-advertiser-button",
    "#player-ads",
    "#masthead-ad",
    "#ad-div",
    "#watch-sidebar-ads",
    "ytd-ad-slot-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-promoted-video-renderer",
    "ytd-display-ad-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-companion-slot-renderer",
    "ytd-statement-banner-renderer",
    "ytd-carousel-ad-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-rich-item-renderer[is-ad]",
    "ytd-video-masthead-ad-v3-renderer",
    "ytd-banner-promo-renderer",
    "ytd-primetime-promo-renderer",
    "ytd-brand-video-singleton-renderer",
    "ytd-brand-video-shelf-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-sparkles-text-search-renderer",
    "ytd-search-pyv-renderer",
    "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']",
    "ytd-ad-overlay-renderer",
    "ytd-ad-inline-stream-renderer",
    "ytd-ad-slot-module-renderer",
    "ytd-ad-signals-renderer",
    "ytd-sticky-controls-ad-renderer",
    ".ytd-display-ad-renderer",
    ".ytd-mealbar-promo-renderer",
    ".ytp-ad-overlay-close-button",
    ".ytp-ad-overlay-close",
    ".ytp-ad-overlay-ad-info-row-container",
    ".ytp-ad-overlay-time-display",
    ".ytp-ad-overlay-survey-companion",
    ".ytp-ad-active-show",
    ".ytp-ad-active-hide",
    "#ytp-ad-error-message",
    ".ytp-ad-warning-bar",
    "#feedmodule-PRO",
    "#homepage-chrome-high-viz",
    "[data-google-av-cxn]",
    "ytd-merch-shelf-renderer[slot='merch-shelf']",
    "ytd-ad-feedback-renderer",
    "ytd-ad-cta-renderer",
    "ytd-ad-meta-renderer",
    "ytd-ad-overlay-slot-renderer",
    "ytd-ad-overlay-skip-renderer",
    "ytd-ad-container-renderer",
    "ytd-ad-layout-renderer",
    "ytd-player-ads-renderer",
    "ytd-innertube-ad-renderer",
    "ytd-promoted-film-renderer",
    "ytd-promoted-music-renderer",
    "ytd-scroll-ads-renderer",
    "ytd-in-video-overlay-ad-renderer",
    "ytd-video-masthead-ad-advertiser-renderer",
    "ytd-video-masthead-ad-renderer"
  ];

  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-skip-ad-button-modern",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-ads-button",
    ".ytp-ad-skip-button-container button",
    "button.ytp-ad-skip-button-modern",
    "[class*='skip-button']",
    "[class*='skip-ads']",
    "[class*='Skip']",
    "[class*='SkipAd']",
    "[role='button'][aria-label*='kip']",
    "[aria-label*='kip ad']",
    "[aria-label*='Skip']",
    "[data-testid='skip-button']"
  ];

  const HIDE_CSS = `
    ${AD_SELECTORS.join(",\n    ")} {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      width: 0 !important;
      position: absolute !important;
      left: -9999px !important;
      clip: rect(0, 0, 0, 0) !important;
      overflow: hidden !important;
    }

    .video-ads,
    .video-ads * {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    [aria-label="Ad"],
    [aria-label="Sponsored"],
    [aria-label="Advertisement"] {
      display: none !important;
    }

    .ytp-ad-player-overlay-flyout-cta,
    .ytp-ad-player-overlay-instream-info,
    .ytp-ad-overlay-open,
    .ytp-ad-overlay-close-button,
    .ytp-ad-overlay-mute,
    .ytp-ad-overlay-skip-button,
    .ytp-ad-overlay-title,
    .ytp-ad-overlay-causal-buttons {
      display: none !important;
    }

    ytd-rich-item-renderer[is-ad] {
      display: none !important;
    }
  `;

  let enabled = true;
  let styleEl = null;
  let observer = null;
  let pollTimer = null;
  let rafPending = false;
  let navListenerBound = false;
  let storageListenerBound = false;
  let restoreRate = null;
  let adPatterns = null;
  let originalFetch = null;
  let originalXHROpen = null;
  let originalXHRSend = null;
  let messageListenerBound = false;

  let stats = {
    adsBlocked: 0,
    adsSkipped: 0,
    prerollSkipped: 0,
    midrollSkipped: 0,
    displayAdsBlocked: 0,
    overlayAdsBlocked: 0
  };

  let activeAdSessions = new Set();
  let pendingStatsUpdate = null;

  function safeString(value) {
    if (typeof value === "string") return value;
    if (value && typeof value.baseVal === "string") return value.baseVal;
    return "";
  }

  function send(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => void chrome.runtime?.lastError);
    } catch (_) {}
  }

  function updateStats(type, increment = 1) {
    if (type === "blocked") stats.adsBlocked += increment;
    else if (type === "skipped") stats.adsSkipped += increment;
    else if (type === "preroll") stats.prerollSkipped += increment;
    else if (type === "midroll") stats.midrollSkipped += increment;
    else if (type === "display") stats.displayAdsBlocked += increment;
    else if (type === "overlay") stats.overlayAdsBlocked += increment;

    if (pendingStatsUpdate) return;
    pendingStatsUpdate = setTimeout(() => {
      pendingStatsUpdate = null;
      send({
        type: "UPDATE_STATS",
        stats: { ...stats }
      });
    }, 150);
  }

  function initAdPatterns() {
    if (adPatterns) return;
    adPatterns = [
      { pattern: /doubleclick\.net/i, type: "display" },
      { pattern: /googlesyndication\.com/i, type: "display" },
      { pattern: /googleadservices\.com/i, type: "display" },
      { pattern: /googleads\.g\.doubleclick\.net/i, type: "display" },
      { pattern: /pagead2\.googlesyndication\.com/i, type: "display" },
      { pattern: /pagead(1|2|3)?\.google\.com/i, type: "display" },
      { pattern: /adservice\.google\./i, type: "display" },
      { pattern: /ads\.youtube\.com/i, type: "display" },
      { pattern: /youtube\.com\/get_video_info.*ad/i, type: "preroll" },
      { pattern: /youtube\.com\/api\/stats\/ads/i, type: "preroll" },
      { pattern: /youtube\.com\/pagead/i, type: "display" },
      { pattern: /youtube\.com\/ptracking/i, type: "preroll" },
      { pattern: /youtube\.com\/ad_/i, type: "preroll" },
      { pattern: /youtube\.com\/api\/stats\/qoe.*adformat/i, type: "preroll" },
      { pattern: /admob\.com/i, type: "display" },
      { pattern: /flashtalking\.com/i, type: "display" },
      { pattern: /moatads\.com/i, type: "display" },
      { pattern: /outbrain\.com/i, type: "display" },
      { pattern: /taboola\.com/i, type: "display" },
      { pattern: /criteo\.com/i, type: "display" },
      { pattern: /adnxs\.com/i, type: "display" },
      { pattern: /advertising\.com/i, type: "display" },
      { pattern: /2mdn\.net/i, type: "display" },
      { pattern: /serving-sys\.com/i, type: "display" },
      { pattern: /casalemedia\.com/i, type: "display" },
      { pattern: /pubmatic\.com/i, type: "display" },
      { pattern: /rubiconproject\.com/i, type: "display" },
      { pattern: /openx\.net/i, type: "display" },
      { pattern: /amazon-adsystem\.com/i, type: "display" },
      { pattern: /media\.net/i, type: "display" },
      { pattern: /adcolony\.com/i, type: "display" },
      { pattern: /unity3d\.com\/ads/i, type: "display" },
      { pattern: /chartboost\.com/i, type: "display" },
      { pattern: /vungle\.com/i, type: "display" },
      { pattern: /applovin\.com/i, type: "display" },
      { pattern: /ironsource/i, type: "display" },
      { pattern: /youtube\.com\/youtubei\/v\d+\/player.*ad_/i, type: "preroll" }
    ];
  }

  function blockAdRequest(url) {
    if (!url) return { blocked: false, type: null };

    initAdPatterns();

    for (const { pattern, type } of adPatterns) {
      if (pattern.test(url)) {
        return { blocked: true, type };
      }
    }

    if (url.includes("/api/stats/") && url.includes("ad")) {
      return { blocked: true, type: "preroll" };
    }
    if (url.includes("ad_break")) {
      return { blocked: true, type: "midroll" };
    }
    if (url.includes("adunit")) {
      return { blocked: true, type: "display" };
    }
    if (url.includes("&adformat=")) {
      return { blocked: true, type: "preroll" };
    }
    if (url.includes("ctier=L")) {
      return { blocked: true, type: "preroll" };
    }

    return { blocked: false, type: null };
  }

  function injectCSS() {
    if (styleEl && styleEl.isConnected) return;
    styleEl = document.createElement("style");
    styleEl.id = "__ytab_hide_v5__";
    styleEl.textContent = HIDE_CSS;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  function removeCSS() {
    document.getElementById("__ytab_hide_v5__")?.remove();
    styleEl = null;
  }

  function getPlayer() {
    return document.querySelector("#movie_player, .html5-video-player");
  }

  function getVideo() {
    return document.querySelector("video.html5-main-video, video");
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (_) {
      return false;
    }
  }

  function detectNewAd() {
    const player = getPlayer();
    if (!player) return { isAd: false, isNew: false, key: null };

    const adShowing = player.classList?.contains("ad-showing") || player.classList?.contains("ad-playing");
    const video = getVideo();
    const key = `${location.href}|${adShowing ? "1" : "0"}|${video?.src || ""}`;

    if (!adShowing) return { isAd: false, isNew: false, key: null };

    const isNew = !activeAdSessions.has(key);
    if (isNew) activeAdSessions.add(key);

    return { isAd: true, isNew, key };
  }

  function isAdPlaying() {
    const player = getPlayer();
    if (!player) return false;

    if (player.classList?.contains("ad-showing") || player.classList?.contains("ad-playing")) {
      return true;
    }

    if (document.querySelector(".ytp-ad-module, .ytp-ad-overlay-container, .video-ads")) {
      return true;
    }

    return false;
  }

  function getAdType() {
    const player = getPlayer();
    if (!player) return "display";

    if (document.querySelector(".ytp-ad-overlay-container, .ytp-ad-player-overlay")) {
      return "overlay";
    }

    const video = getVideo();
    if (player.classList?.contains("ad-showing") && video) {
      if (video.currentTime < 2) return "preroll";
      return "midroll";
    }

    return "display";
  }

  function removeAdElements() {
    for (const selector of AD_SELECTORS) {
      let nodes = [];
      try {
        nodes = document.querySelectorAll(selector);
      } catch (_) {
        continue;
      }

      nodes.forEach((el) => {
        try {
          el.style?.setProperty("display", "none", "important");
          el.style?.setProperty("visibility", "hidden", "important");
          el.style?.setProperty("opacity", "0", "important");
          el.style?.setProperty("pointer-events", "none", "important");
          el.remove?.();
        } catch (_) {}
      });
    }
  }

  function trySkipButtons() {
    let clicked = false;

    for (const selector of SKIP_SELECTORS) {
      let buttons = [];
      try {
        buttons = document.querySelectorAll(selector);
      } catch (_) {
        continue;
      }

      buttons.forEach((btn) => {
        try {
          if (isVisible(btn)) {
            btn.click();
            clicked = true;
          }
        } catch (_) {}
      });
    }

    return clicked;
  }

  function tryCloseOverlays() {
    const selectors = [
      ".ytp-ad-overlay-close-button",
      ".ytp-ad-overlay-close",
      "[aria-label*='Close ad']",
      "[aria-label*='Close']"
    ];

    let closed = false;
    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = document.querySelectorAll(selector);
      } catch (_) {
        continue;
      }

      nodes.forEach((btn) => {
        try {
          if (isVisible(btn)) {
            btn.click();
            closed = true;
          }
        } catch (_) {}
      });
    }

    return closed;
  }

  function fastForwardVideo() {
    const video = getVideo();
    if (!video) return false;

    try {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const remaining = video.duration - video.currentTime;
        if (remaining > 0 && remaining < 900) {
          if (restoreRate === null) restoreRate = video.playbackRate;
          video.currentTime = Math.max(video.duration - 0.01, 0);
          video.playbackRate = 16;
          return true;
        }
      }
    } catch (_) {}

    return false;
  }

  function restoreVideoState() {
    const video = getVideo();
    if (!video) return;

    if (restoreRate !== null) {
      try {
        video.playbackRate = restoreRate;
      } catch (_) {}
      restoreRate = null;
    }

    try {
      video.muted = false;
    } catch (_) {}
  }

  function tryPlayerMethods() {
    const player = getPlayer();
    if (!player) return false;

    let changed = false;

    try {
      if (typeof player.skipAd === "function") {
        player.skipAd();
        changed = true;
      }
    } catch (_) {}

    try {
      const clockObj = player.getVideoPlayerCoreClockObject?.();
      if (clockObj && typeof clockObj.skipAd === "function") {
        clockObj.skipAd();
        changed = true;
      }
    } catch (_) {}

    try {
      player.classList?.remove("ad-showing");
      player.classList?.remove("ad-playing");
    } catch (_) {}

    return changed;
  }

  function trySkipAd() {
    if (!enabled) return false;

    const adType = getAdType();
    let acted = false;

    if (trySkipButtons()) acted = true;
    if (tryCloseOverlays()) acted = true;
    if (tryPlayerMethods()) acted = true;
    if (fastForwardVideo()) acted = true;

    if (acted) {
      updateStats("skipped");
      if (adType === "preroll") updateStats("preroll");
      else if (adType === "midroll") updateStats("midroll");
      else if (adType === "overlay") updateStats("overlay");
    }

    return acted;
  }

  function skipAdElement(el) {
    if (!el || el.dataset.omxAdSkipped) return;

    el.dataset.omxAdSkipped = "1";

    try {
      el.style?.setProperty("display", "none", "important");
      el.style?.setProperty("visibility", "hidden", "important");
      el.style?.setProperty("opacity", "0", "important");
      el.style?.setProperty("pointer-events", "none", "important");
      el.style?.setProperty("height", "0", "important");
      el.style?.setProperty("width", "0", "important");
      el.remove?.();
    } catch (_) {}
  }

  function checkAndSkipAd() {
    removeAdElements();

    const player = getPlayer();
    if (player && (player.classList?.contains("ad-showing") || player.classList?.contains("ad-playing"))) {
      trySkipAd();
    }

    let adElements = [];
    try {
      adElements = document.querySelectorAll(
        ".ytp-ad-module, .ytp-ad-overlay-container, .ytp-ad-player-overlay, ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-display-ad-renderer, .ytp-ad-overlay-open"
      );
    } catch (_) {}

    adElements.forEach(skipAdElement);

    document.body?.classList?.remove("ad-showing");
    document.documentElement?.classList?.remove("ad-showing");
  }

  function sanitizePlayerResponse(obj) {
    if (!obj || typeof obj !== "object") return obj;

    try {
      if (obj.adPlacements) obj.adPlacements = [];
      if (obj.playerAds) obj.playerAds = [];
      if (obj.adSlots) obj.adSlots = [];
      if (obj.auxiliaryUi?.messageRenderers?.bkaEnforcementMessageViewModel) {
        delete obj.auxiliaryUi.messageRenderers.bkaEnforcementMessageViewModel;
      }
      if (obj.streamingData?.serverAbrStreamingUrl?.includes?.("oad")) {
        delete obj.streamingData.serverAbrStreamingUrl;
      }
      if (obj.playabilityStatus?.errorScreen?.playerLegacyDesktopYpcOfferRenderer) {
        delete obj.playabilityStatus.errorScreen.playerLegacyDesktopYpcOfferRenderer;
      }
    } catch (_) {}

    return obj;
  }

  function patchInitialPlayerResponse() {
    try {
      if (window.ytInitialPlayerResponse) {
        sanitizePlayerResponse(window.ytInitialPlayerResponse);
      }
    } catch (_) {}

    const props = ["ytInitialPlayerResponse", "ytInitialData"];
    for (const prop of props) {
      try {
        let currentValue = window[prop];
        Object.defineProperty(window, prop, {
          configurable: true,
          enumerable: true,
          get() {
            return currentValue;
          },
          set(value) {
            currentValue = sanitizePlayerResponse(value);
          }
        });
      } catch (_) {}
    }
  }

  function interceptNetwork() {
    if (!originalFetch) {
      originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const input = args[0];
        const url =
          typeof input === "string"
            ? input
            : input?.url || "";

        const decision = blockAdRequest(url);
        if (decision.blocked) {
          updateStats("blocked");
          if (decision.type) updateStats(decision.type);
          return new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        return originalFetch.apply(this, args);
      };
    }

    const XHRProto = window.XMLHttpRequest?.prototype;
    if (!XHRProto) return;

    if (!originalXHROpen) {
      originalXHROpen = XHRProto.open;
      XHRProto.open = function (method, url, ...rest) {
        this.__ytab_url = typeof url === "string" ? url : "";
        return originalXHROpen.call(this, method, url, ...rest);
      };
    }

    if (!originalXHRSend) {
      originalXHRSend = XHRProto.send;
      XHRProto.send = function (...args) {
        const url = this.__ytab_url || "";
        const decision = blockAdRequest(url);

        if (decision.blocked) {
          updateStats("blocked");
          if (decision.type) updateStats(decision.type);

          queueMicrotask(() => {
            try {
              Object.defineProperty(this, "readyState", { configurable: true, value: 4 });
              Object.defineProperty(this, "status", { configurable: true, value: 200 });
              Object.defineProperty(this, "responseText", { configurable: true, value: "{}" });
              Object.defineProperty(this, "response", { configurable: true, value: "{}" });
            } catch (_) {}

            try { this.onreadystatechange?.(); } catch (_) {}
            try { this.onload?.(); } catch (_) {}
          });

          return;
        }

        return originalXHRSend.apply(this, args);
      };
    }
  }

  function scheduleRun() {
    if (rafPending || !enabled) return;
    rafPending = true;

    requestAnimationFrame(() => {
      rafPending = false;
      run();
    });
  }

  function startObserver() {
    observer?.disconnect();

    observer = new MutationObserver((mutations) => {
      let shouldRun = false;

      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;

            const id = safeString(node.id);
            const className = safeString(node.className);
            const tagName = safeString(node.tagName).toUpperCase();

            if (
              id.includes("ad") ||
              className.includes("ad") ||
              id.includes("player-ads") ||
              className.includes("ytp-ad") ||
              tagName.includes("AD") ||
              tagName === "YTD-AD-SLOT-RENDERER"
            ) {
              shouldRun = true;
              break;
            }
          }
          if (shouldRun) break;
        }

        if (m.type === "attributes" && m.target instanceof Element) {
          const id = safeString(m.target.id);
          const className = safeString(m.target.className);
          const tagName = safeString(m.target.tagName).toUpperCase();

          if (
            className.includes("ad-showing") ||
            className.includes("ad-playing") ||
            className.includes("ytp-ad-module") ||
            className.includes("ytp-ad-player-overlay") ||
            className.includes("ytp-ad-overlay-open") ||
            id.includes("ad") ||
            tagName.includes("AD")
          ) {
            shouldRun = true;
            break;
          }
        }
      }

      if (shouldRun) scheduleRun();
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "hidden", "style", "id"]
      });
    }
  }

  function startPoll() {
    stopPoll();
    pollTimer = setInterval(run, 120);
  }

  function stopPoll() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function run() {
    if (!enabled) return;

    injectCSS();
    removeAdElements();

    const { isAd, isNew } = detectNewAd();
    if (isAd && isNew) {
      trySkipAd();
    }

    if (isAdPlaying()) {
      trySkipAd();
    } else {
      restoreVideoState();
    }

    checkAndSkipAd();
  }

  function bindNavigationListeners() {
    if (navListenerBound) return;

    const navEvents = [
      "yt-navigate-finish",
      "yt-navigate-start",
      "yt-page-data-updated",
      "spfdone",
      "spfrequest",
      "yt-before-navigate",
      "popstate"
    ];

    navEvents.forEach((eventName) => {
      window.addEventListener(eventName, () => {
        activeAdSessions.clear();
        injectCSS();
        scheduleRun();
      }, { passive: true });
    });

    navListenerBound = true;
  }

  function bindStorageListener() {
    if (storageListenerBound || !chrome?.storage?.onChanged) return;

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      if ("enabled" in changes) {
        const next = changes.enabled.newValue !== false;
        if (next !== enabled) {
          enabled = next;
          if (enabled) start();
          else stop();
        }
      }
    });

    storageListenerBound = true;
  }

  function bindMessageListener() {
    if (messageListenerBound) return;

    window.addEventListener("message", (event) => {
      if (event.data?.type === "GET_ADBLOCKER_STATS") {
        event.source?.postMessage(
          {
            type: "ADBLOCKER_STATS",
            stats: { ...stats }
          },
          event.origin
        );
      }
    });

    messageListenerBound = true;
  }

  function start() {
    if (!enabled) return;

    injectCSS();
    startObserver();
    startPoll();
    bindNavigationListeners();
    run();
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    stopPoll();
    removeCSS();
    restoreVideoState();

    if (pendingStatsUpdate) {
      clearTimeout(pendingStatsUpdate);
      pendingStatsUpdate = null;
    }

    send({ type: "UPDATE_STATS", stats: { ...stats } });
  }

  async function init() {
    injectCSS();
    patchInitialPlayerResponse();
    interceptNetwork();

    try {
      const result = await chrome.storage.local.get(["enabled", "stats"]);
      enabled = result.enabled !== false;
      if (result.stats && typeof result.stats === "object") {
        stats = { ...stats, ...result.stats };
      }
    } catch (_) {
      enabled = true;
    }

    bindStorageListener();
    bindMessageListener();

    if (enabled) start();
  }

  init().catch(() => {});
})();