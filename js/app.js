// ═══════════════════════════════════════════════
//  Global Money v4.3 — js/app.js
// ═══════════════════════════════════════════════

import { state }                        from "./state.js";
import { tr, applyLang, TRANSLATIONS }  from "./i18n.js";
import {
  countryMap, currencyNames, CRYPTOS,
  getAlerts, saveAlerts, getFavs,
  safeGetJSON, safeSetJSON,
  initStorageHealth
} from "./storage.js";
import { initDatabase } from "./database.js";
import { loadFiat, loadCrypto, loadMetals, startAutoRefresh } from "./api.js";
import {
  fmt, fmt6, showToast, animateCount, getFlag,
  buildDropdown, updateSelDisplay, updateCryptoDisplay,
  applyTheme, openSidebar, closeSidebar
} from "./ui.js";
import {
  convert, convertCrypto, updatePct,
  renderHistory, renderAlerts, checkAlerts,
  renderFavChips, openFavPicker, renderCompare,
  populateCompare, renderMultiTable,
  renderCryptoPrices, addHistory
} from "./converter.js";
import { renderBlackMarket }            from "./blackmarket.js";
import { renderMetals, renderMetalsCalc } from "./metals.js";
import { drawChart, switchChartMode, onChartPairChange, setChartTF, setChartType } from "./charts.js";
import { initConsent } from "./consent.js";

// ── Hash-based routing (fixes reload issue) ────────
// Pages that go back to home on close
const SUB_PAGES = new Set([
  "converter","blackmarket","compare","trends","crypto",
  "alerts","history","favorites","metals","contact","about",
  "portfolio","watchlist","rates"
]);

function getPageFromHash() {
  const hash = location.hash.replace("#","").trim();
  return SUB_PAGES.has(hash) ? hash : "home";
}

function setPageHash(page) {
  if (page === "home") {
    history.replaceState(null, "", location.pathname + location.search);
  } else {
    history.replaceState(null, "", "#" + page);
  }
}

// Go home (X button)
window.__gmGoHome = function() {
  navigateTo("home");
};

// Legacy go-back (still supported)
const _pageHistory = [];
window.__gmGoBack = window.__gmGoHome;

// ── Page Navigation ────────────────────────────────
function navigateTo(page, skipHash = false) {
  // Hide all pages
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add("active");

  // Update nav active states
  document.querySelectorAll(".sidebar-link").forEach(l =>
    l.classList.toggle("active", l.dataset.page === page)
  );
  document.querySelectorAll(".bnav-item[data-page]").forEach(l =>
    l.classList.toggle("active", l.dataset.page === page)
  );

  state.setCurrentPage(page);
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Update URL hash
  if (!skipHash) setPageHash(page);

  // Page-specific logic
  if (page === "compare")     renderCompare();
  if (page === "trends") { switchChartMode(state.chartMode || "tradingview"); drawChart(state.fromSel, state.toSel); }
  if (page === "history")     renderHistory();
  if (page === "favorites")   openFavPicker();
  if (page === "alerts")      renderAlerts();
  if (page === "crypto") {
    state.setCryptoPageOpen(true);
    renderCryptoPrices();
    _startCryptoPageRefresh();
  } else if (state.currentPage !== "crypto") {
    state.setCryptoPageOpen(false);
  }
  if (page === "blackmarket") {
    import("./blackmarket.js").then(({ syncBlackMarketRates, fetchAllParallelRates, renderBlackMarket }) => {
      syncBlackMarketRates();
      fetchAllParallelRates();
      renderBlackMarket();
    });
  }
  if (page === "metals")    renderMetals();
  if (page === "portfolio") import("./portfolio.js").then(m => m.renderPortfolio()).catch(() => {});
  if (page === "watchlist") import("./watchlist.js").then(m => m.renderWatchlist()).catch(() => {});
  if (page === "contact")   initContactForm();
  closeSidebar();
}

// Handle browser back/forward and direct hash navigation
window.addEventListener("popstate", () => {
  const page = getPageFromHash();
  navigateTo(page, true);
});

// ── Nav listeners ──────────────────────────────────
document.querySelectorAll("[data-page]").forEach(el => {
  if (el.classList.contains("sidebar-link") || el.classList.contains("bnav-item")) {
    el.addEventListener("click", e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  }
});
document.querySelectorAll(".home-card[data-nav]").forEach(el => {
  el.addEventListener("click", () => navigateTo(el.dataset.nav));
});

// ── About / Contact ────────────────────────────────
document.getElementById("aboutBtn")?.addEventListener("click", () => navigateTo("about"));
document.getElementById("contactUsBtn")?.addEventListener("click", e => {
  e.preventDefault();
  navigateTo("contact");
});
document.getElementById("aboutClose")?.addEventListener("click", () => {
  document.getElementById("aboutModal").style.display = "none";
});
document.getElementById("aboutModal")?.addEventListener("click", e => {
  if (e.target === document.getElementById("aboutModal"))
    document.getElementById("aboutModal").style.display = "none";
});

// ── Sidebar ────────────────────────────────────────
document.getElementById("menuBtn")?.addEventListener("click", openSidebar);
document.getElementById("sidebarClose")?.addEventListener("click", closeSidebar);
document.getElementById("sidebarOverlay")?.addEventListener("click", closeSidebar);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeSidebar();
    const m = document.getElementById("aboutModal");
    if (m) m.style.display = "none";
  }
});

// ── Theme ──────────────────────────────────────────
document.getElementById("themeBtn")?.addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
  if (state.currentPage === "trends") {
    import("./charts.js").then(({ renderLWChart }) => renderLWChart());
  }
});
document.getElementById("headerThemeBtn")?.addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("dark"));
  if (state.currentPage === "trends") {
    import("./charts.js").then(({ renderLWChart }) => renderLWChart());
  }
});

// ── Language ───────────────────────────────────────
document.querySelectorAll(".lang-btn").forEach(b => {
  b.addEventListener("click", () => {
    state.setLang(b.dataset.lang);
    applyLang();
    renderHistory();
    renderBlackMarket();
    const cName = document.getElementById("contactName");
    if (cName) {
      cName.placeholder = tr("contactNamePlaceholder");
      document.getElementById("contactEmail").placeholder   = tr("contactEmailPlaceholder");
      document.getElementById("contactSubject").placeholder = tr("contactSubjectPlaceholder");
      document.getElementById("contactMessage").placeholder = tr("contactMessagePlaceholder");
    }
  });
});

// ── Converter actions ──────────────────────────────
let convertTimeout;

document.getElementById("amount")?.addEventListener("input", () => {
  clearTimeout(convertTimeout);
  convertTimeout = setTimeout(convert, 400);
});
document.getElementById("convertBtn")?.addEventListener("click", convert);

document.getElementById("swapBtn")?.addEventListener("click", () => {
  state.swapFiat();
  updateSelDisplay();
  convert();
});

document.getElementById("pctInput")?.addEventListener("input", updatePct);

document.getElementById("copyBtn")?.addEventListener("click", () => {
  const resultEl = document.getElementById("result");
  navigator.clipboard.writeText(resultEl?.innerText.replace(/\s+/g, " ").trim() || "");
  showToast(tr("copied"));
});

document.getElementById("shareBtn")?.addEventListener("click", () => {
  const amountEl = document.getElementById("amount");
  const url = `${location.origin}${location.pathname}?from=${state.fromSel}&to=${state.toSel}&amount=${amountEl?.value || ""}`;
  navigator.clipboard.writeText(url);
  showToast(tr("linkCopied"));
});

document.getElementById("printBtn")?.addEventListener("click", () => {
  const pc = document.getElementById("printContent");
  const pt = document.getElementById("printTime");
  const resultEl   = document.getElementById("result");
  const rateInfoEl = document.getElementById("rateInfo");
  if (pc) {
    pc.textContent = "";
    if (resultEl)   pc.appendChild(resultEl.cloneNode(true));
    if (rateInfoEl) pc.appendChild(document.createTextNode(" " + rateInfoEl.textContent));
  }
  if (pt) pt.textContent = "Generated: " + new Date().toLocaleString();
  window.print();
});

// ── Crypto ─────────────────────────────────────────
let cryptoConvertTimeout;

document.getElementById("cryptoAmount")?.addEventListener("input", () => {
  clearTimeout(cryptoConvertTimeout);
  cryptoConvertTimeout = setTimeout(convertCrypto, 400);
});
document.getElementById("cryptoConvertBtn")?.addEventListener("click", convertCrypto);
document.getElementById("cryptoSwapBtn")?.addEventListener("click", () => {
  state.swapCrypto();
  updateCryptoDisplay();
  convertCrypto();
});

// ── Alerts ─────────────────────────────────────────
document.getElementById("setAlertBtn")?.addEventListener("click", () => {
  const target = parseFloat(document.getElementById("alertTarget").value);
  const dir    = document.getElementById("alertDir").value;
  if (isNaN(target) || target <= 0) return;
  const alerts = getAlerts();
  const key = `${state.fromSel}-${state.toSel}-${dir}-${target}`;
  if (alerts.find(a => a.key === key)) { showToast(tr("alertExists")); return; }
  alerts.push({ key, from: state.fromSel, to: state.toSel, dir, target, active: true });
  saveAlerts(alerts);
  renderAlerts();
  showToast(tr("alertSet"));
  document.getElementById("alertTarget").value = "";
  if ("Notification" in window && Notification.permission !== "granted")
    Notification.requestPermission();
});

// ── History ────────────────────────────────────────
document.getElementById("clearHistBtn")?.addEventListener("click", () => {
  localStorage.removeItem("convHistory");
  renderHistory();
});

// ── Favorites ──────────────────────────────────────
document.getElementById("manageFavBtn")?.addEventListener("click", () => navigateTo("favorites"));
document.getElementById("saveFavBtn")?.addEventListener("click", () => {
  const checked = [...document.querySelectorAll(".fav-pick:checked")].map(c => c.value);
  safeSetJSON("favCurrencies", checked.slice(0, 8));
  showToast("✅ " + tr("saveFav"));
  renderFavChips();
  renderMultiTable();
  navigateTo("converter");
});

// ── Metals listeners ───────────────────────────────
document.getElementById("metalsAmount")?.addEventListener("input", renderMetalsCalc);
document.getElementById("metalsUnit")?.addEventListener("change", renderMetalsCalc);
document.getElementById("metalsCurrency")?.addEventListener("change", renderMetalsCalc);

// ── PWA ────────────────────────────────────────────
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;

function showInstallUI() {
  const banner = document.getElementById("installBanner");
  const headerBtn = document.getElementById("headerInstallBtn");
  if (banner) banner.style.display = "flex";
  if (headerBtn) headerBtn.style.display = "inline-flex";
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  state.setInstallPrompt(e);
  showInstallUI();
});

if (isIOS && !isStandalone) showInstallUI();

async function triggerInstall() {
  if (isIOS) {
    const modal = document.getElementById("iosInstallModal");
    if (modal) modal.style.display = "flex";
    return;
  }
  const prompt = state.deferredInstallPrompt;
  if (!prompt) return;
  prompt.prompt();
  await prompt.userChoice;
  state.setInstallPrompt(null);
  const banner = document.getElementById("installBanner");
  const headerBtn = document.getElementById("headerInstallBtn");
  if (banner) banner.style.display = "none";
  if (headerBtn) headerBtn.style.display = "none";
}

document.getElementById("installBtn")?.addEventListener("click", triggerInstall);
document.getElementById("headerInstallBtn")?.addEventListener("click", triggerInstall);
document.getElementById("installClose")?.addEventListener("click", () => {
  const banner = document.getElementById("installBanner");
  if (banner) banner.style.display = "none";
});

// ── Service Worker ─────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });
  }).catch(() => {});
}

function showUpdateBanner() {
  const banner = document.createElement("div");
  banner.id = "updateBanner";
  banner.className = "update-banner";
  banner.textContent = tr("newVersionAvailable");
  banner.addEventListener("click", () => window.location.reload());
  document.body.appendChild(banner);
}

// ── Share URL ──────────────────────────────────────
function handleShareUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get("from")) state.setFromSel(p.get("from"));
  if (p.get("to"))   state.setToSel(p.get("to"));
  const amountEl = document.getElementById("amount");
  if (p.get("amount") && amountEl) amountEl.value = p.get("amount");
}

// ── Contact Form ───────────────────────────────────
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = "1";

  document.getElementById("contactName").placeholder    = tr("contactNamePlaceholder");
  document.getElementById("contactEmail").placeholder   = tr("contactEmailPlaceholder");
  document.getElementById("contactSubject").placeholder = tr("contactSubjectPlaceholder");
  document.getElementById("contactMessage").placeholder = tr("contactMessagePlaceholder");

  form.addEventListener("submit", e => {
    e.preventDefault();
    handleContactSubmit();
  });
}

function handleContactSubmit() {
  const name    = document.getElementById("contactName")?.value.trim();
  const email   = document.getElementById("contactEmail")?.value.trim();
  const subject = document.getElementById("contactSubject")?.value.trim();
  const message = document.getElementById("contactMessage")?.value.trim();

  ["nameError","emailError","subjectError","messageError"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });

  let valid = true;
  if (!name)    { document.getElementById("nameError").textContent    = tr("contactValidName");    valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                { document.getElementById("emailError").textContent   = tr("contactValidEmail");   valid = false; }
  if (!subject) { document.getElementById("subjectError").textContent = tr("contactValidSubject"); valid = false; }
  if (!message || message.length < 10)
                { document.getElementById("messageError").textContent = tr("contactValidMessage"); valid = false; }
  if (!valid) return;

  const btn = document.getElementById("contactSubmitBtn");
  const btnLabel = btn?.querySelector("span");
  if (btn) { btn.disabled = true; if (btnLabel) btnLabel.textContent = tr("loading"); }

  const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
  const mailtoUrl = `mailto:globalmoneyspace@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const statusEl = document.getElementById("contactStatus");

  try {
    window.open(mailtoUrl, "_blank");
    setTimeout(() => {
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.className = "contact-status success";
        statusEl.textContent = tr("contactSuccess");
      }
      document.getElementById("contactForm").reset();
      if (btn)      { btn.disabled = false; }
      if (btnLabel) { btnLabel.textContent = tr("contactSend"); }
    }, 500);
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.className = "contact-status error";
      statusEl.textContent = tr("contactError");
    }
    if (btn)      btn.disabled = false;
    if (btnLabel) btnLabel.textContent = tr("contactSend");
  }
}

// ── Init ───────────────────────────────────────────
window.addEventListener("load", async () => {
  // Apply saved theme (default dark)
  const savedTheme = localStorage.getItem("theme");
  applyTheme(savedTheme === null ? true : savedTheme === "dark");

  // Apply language (default Arabic)
  applyLang();
  handleShareUrl();

  const splash = document.getElementById("splash");

  try {
    await Promise.all([loadFiat(), loadCrypto(), loadMetals()]);

    buildDropdown(
      document.getElementById("fromDropdown"),
      document.getElementById("fromSearchInput"),
      false,
      code => { state.setFromSel(code); updateSelDisplay(); convert(); }
    );
    buildDropdown(
      document.getElementById("toDropdown"),
      document.getElementById("toSearchInput"),
      false,
      code => { state.setToSel(code); updateSelDisplay(); convert(); }
    );
    buildDropdown(
      document.getElementById("cryptoFromDropdown"),
      document.getElementById("cryptoFromSearch"),
      true,
      code => { state.setCryptoFrom(code); updateCryptoDisplay(); convertCrypto(); }
    );
    buildDropdown(
      document.getElementById("cryptoToDropdown"),
      document.getElementById("cryptoToSearch"),
      true,
      code => { state.setCryptoTo(code); updateCryptoDisplay(); convertCrypto(); }
    );

    populateCompare();
    updateSelDisplay();
    updateCryptoDisplay();
    renderFavChips();
    await convert();
    startAutoRefresh(() => {
      convert();
      showToast(tr("refreshed"));
    });
  } catch (err) {
    console.error("App initialization error:", err);
    const resultEl = document.getElementById("result");
    if (resultEl) resultEl.textContent = "⚠️ Failed to load data. Check connection.";
  }

  if (splash) {
    splash.classList.add("fade-out");
    setTimeout(() => (splash.style.display = "none"), 600);
  }

  // Navigate to page from hash (for reload fix)
  const initialPage = getPageFromHash();
  if (initialPage !== "home") {
    navigateTo(initialPage, true);
  }

  if ("Notification" in window && Notification.permission === "default")
    setTimeout(() => Notification.requestPermission(), 4000);
});

// ── Market Status ──────────────────────────────────
function updateMarketStatus() {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const forexOpen = !(day === 0 || day === 6 || (day === 5 && hour >= 22));

  const forexDot = document.getElementById("forexDot");
  const forexStatus = document.getElementById("forexStatus");
  if (forexDot && forexStatus) {
    forexDot.className = "mstatus-dot " + (forexOpen ? "mstatus-open" : "mstatus-closed");
    forexStatus.textContent = forexOpen ? "Open" : "Closed";
  }

  const metalsOpen = forexOpen;
  const metalsDot = document.getElementById("metalsDot");
  const metalsStatusEl = document.getElementById("metalsStatus");
  if (metalsDot && metalsStatusEl) {
    metalsDot.className = "mstatus-dot " + (metalsOpen ? "mstatus-open" : "mstatus-closed");
    metalsStatusEl.textContent = metalsOpen ? "Open" : "Closed";
  }
}

let _cryptoRefreshInterval = null;
function _startCryptoPageRefresh() {
  if (_cryptoRefreshInterval) clearInterval(_cryptoRefreshInterval);
  _cryptoRefreshInterval = setInterval(() => {
    if (state.currentPage === "crypto") renderCryptoPrices();
    else { clearInterval(_cryptoRefreshInterval); _cryptoRefreshInterval = null; }
  }, 3000);
}

// ── Top Movers ─────────────────────────────────────
let _lastTopMoversHash = "";
let _topMoversRafId    = null;

function _hashMovers(items) {
  return items.map(i => `${i.sym}:${i.pct?.toFixed(2)}`).join(",");
}

function renderTopMoversOptimized() {
  const grid  = document.getElementById("topMoversGrid");
  if (!grid) return;

  const crypto = state.cryptoRates;
  const ch24   = state.cryptoChange24h;

  const items = [];
  Object.entries(crypto).forEach(([sym, price]) => {
    const pct = ch24[sym];
    if (pct == null) return;
    const priceStr = price >= 1
      ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : `$${price.toFixed(6)}`;
    items.push({ sym, price: priceStr, pct });
  });

  items.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const top  = items.slice(0, 6);
  const hash = _hashMovers(top);
  if (hash === _lastTopMoversHash) return;
  _lastTopMoversHash = hash;

  if (top.length === 0) {
    grid.innerHTML = '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:12px 0">⏳ جارٍ تحميل البيانات…</p>';
    return;
  }

  if (_topMoversRafId) cancelAnimationFrame(_topMoversRafId);
  _topMoversRafId = requestAnimationFrame(() => {
    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    top.forEach(item => {
      const row    = document.createElement("div");
      row.className = "mover-row";
      const sign   = item.pct >= 0 ? "+" : "";
      const arrow  = item.pct > 0.01 ? "↑" : item.pct < -0.01 ? "↓" : "→";
      const cls    = item.pct > 0.01 ? "up" : item.pct < -0.01 ? "down" : "flat";

      const symEl   = document.createElement("span"); symEl.className = "mover-sym";   symEl.textContent = item.sym;
      const priceEl = document.createElement("span"); priceEl.className = "mover-price"; priceEl.textContent = item.price;
      const pctEl   = document.createElement("span"); pctEl.className = `mover-pct ${cls}`;
      pctEl.textContent = `${arrow} ${sign}${item.pct.toFixed(2)}%`;
      row.appendChild(symEl);
      row.appendChild(priceEl);
      row.appendChild(pctEl);
      frag.appendChild(row);
    });
    grid.appendChild(frag);
  });
}

const renderTopMovers = renderTopMoversOptimized;

document.addEventListener("DOMContentLoaded", () => {
  initStorageHealth();
  initDatabase().catch(() => {});
  initConsent();

  updateMarketStatus();
  setInterval(updateMarketStatus, 60_000);
  setTimeout(renderTopMovers, 3000);
  setInterval(renderTopMovers, 10_000);
});
