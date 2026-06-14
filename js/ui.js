// ═══════════════════════════════════════════════
//  Global Money — js/ui.js
//  UI helpers: theme, toast, animations, display updates
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { tr } from "./i18n.js";
import { countryMap, currencyNames, CRYPTOS } from "./storage.js";

// ── Formatters ────────────────────────────────────
export const fmt  = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 });
export const fmt6 = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 6 });

export function getFlag(code) {
  const cc = countryMap[code];
  return cc ? `https://flagcdn.com/24x18/${cc}.png` : "";
}

// ── Text-safe element creation ────────────────────
/**
 * Create an element with textContent (XSS-safe).
 * attrs: { className, id, style, ... }
 */
export function el(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== null && text !== undefined) node.textContent = text;
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "className") node.className = v;
    else if (k === "style") node.style.cssText = v;
    else node.setAttribute(k, v);
  });
  return node;
}

// ── Toast ─────────────────────────────────────────
export function showToast(msg) {
  let toastEl = document.getElementById("toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
}

// ── Animate counter ───────────────────────────────
export function animateCount(el, endVal, duration = 600) {
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(endVal * ease);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(endVal);
  }
  requestAnimationFrame(step);
}

// ── Theme ─────────────────────────────────────────
export function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  const lang = state.lang;

  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.classList.toggle("on", dark);

  const label = document.getElementById("themeBtnLabel");
  if (label) {
    label.textContent = dark
      ? (lang === "ar" ? "الوضع النهاري" : lang === "fr" ? "Mode Jour" : "Light Mode")
      : (lang === "ar" ? "الوضع الليلي" : lang === "fr" ? "Mode Nuit" : "Dark Mode");
  }

  const hi = document.getElementById("headerThemeIcon");
  if (hi) {
    hi.innerHTML = dark
      ? '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
      : '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
    hi.setAttribute("stroke", "currentColor");
    hi.setAttribute("stroke-width", "2");
    hi.setAttribute("fill", "none");
  }

  localStorage.setItem("theme", dark ? "dark" : "light");
}

// ── Currency selector display ─────────────────────
export function updateSelDisplay() {
  const { fromSel, toSel } = state;
  _updateOneSel(fromSel,
    document.getElementById("fromFlag"),
    document.getElementById("fromCode"),
    document.getElementById("fromName"),
    document.getElementById("fromLabel")
  );
  _updateOneSel(toSel,
    document.getElementById("toFlag"),
    document.getElementById("toCode"),
    document.getElementById("toName"),
    null
  );
  const alertPairEl = document.getElementById("alertPair");
  if (alertPairEl) alertPairEl.textContent = `${fromSel} → ${toSel}`;
}

function _updateOneSel(sel, flagEl, codeEl, nameEl, labelEl) {
  const isCrypto = CRYPTOS[sel];
  if (flagEl) {
    if (isCrypto) {
      flagEl.style.display = "none";
    } else {
      const fl = getFlag(sel);
      flagEl.src = fl;
      flagEl.alt = sel;
      flagEl.style.display = fl ? "" : "none";
    }
  }
  if (codeEl) codeEl.textContent = sel;
  if (nameEl) nameEl.textContent = isCrypto ? isCrypto.name : (currencyNames[sel] || sel);
  if (labelEl) labelEl.textContent = sel;
}

export function updateCryptoDisplay() {
  const { cryptoFrom, cryptoTo } = state;
  const cf = CRYPTOS[cryptoFrom], ct = CRYPTOS[cryptoTo];
  const safe = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };

  // Update icon elements with logo if available
  const fromIconEl = document.getElementById("cryptoFromIcon");
  if (fromIconEl) {
    if (cf?.logo) {
      fromIconEl.innerHTML = `<img src="${cf.logo}" alt="${cryptoFrom}" class="crypto-icon-img" onerror="this.style.display='none';this.parentNode.textContent='${cf.icon}'">`;
    } else {
      fromIconEl.textContent = cf?.icon || cryptoFrom;
    }
  }
  const toIconEl = document.getElementById("cryptoToIcon");
  if (toIconEl) {
    if (ct?.logo) {
      toIconEl.innerHTML = `<img src="${ct.logo}" alt="${cryptoTo}" class="crypto-icon-img" onerror="this.style.display='none';this.parentNode.textContent='${ct.icon}'">`;
    } else {
      toIconEl.textContent = ct?.icon || cryptoTo;
    }
  }

  safe("cryptoFromCode",  cryptoFrom);
  safe("cryptoFromName",  cf?.name || cryptoFrom);
  safe("cryptoToCode",    cryptoTo);
  safe("cryptoToName",    ct?.name || cryptoTo);
  const lbl = document.getElementById("cryptoFromLabel");
  if (lbl) lbl.textContent = cryptoFrom;
}

// ── Dropdown builder ──────────────────────────────
export function buildDropdown(ddEl, inputEl, isCrypto, onSelect) {
  const { allFiatCodes } = state;
  const items = isCrypto
    ? Object.entries(CRYPTOS).map(([code, d]) => ({ code, name: d.name, icon: d.icon, logo: d.logo }))
    : allFiatCodes.map(c => ({ code: c, name: currencyNames[c] || c, flag: getFlag(c) }));

  function render(filter = "") {
    const q = filter.toLowerCase();
    const filtered = items.filter(i =>
      i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    ).slice(0, 50);

    // Clear and rebuild safely without innerHTML
    ddEl.textContent = "";
    if (!filtered.length) {
      const empty = el("div", "No results", { className: "dd-empty" });
      ddEl.appendChild(empty);
      return;
    }
    filtered.forEach(i => {
      const item = document.createElement("div");
      item.className = "dd-item";
      item.dataset.code = i.code;

      if (i.flag) {
        const img = document.createElement("img");
        img.src = i.flag;
        img.alt = "";
        img.className = "dd-flag";
        item.appendChild(img);
      } else if (i.logo) {
        const img = document.createElement("img");
        img.src = i.logo;
        img.alt = i.code;
        img.className = "dd-flag dd-crypto-logo";
        img.onerror = () => { img.style.display = "none"; const sp = el("span", i.icon, { className: "dd-icon" }); item.insertBefore(sp, item.firstChild); };
        item.appendChild(img);
      } else if (i.icon) {
        const iconSpan = el("span", i.icon, { className: "dd-icon" });
        item.appendChild(iconSpan);
      }
      item.appendChild(el("span", i.code));
      item.appendChild(el("small", i.name || i.code));

      item.addEventListener("click", () => {
        onSelect(i.code);
        ddEl.classList.remove("open");
        inputEl.value = "";
      });
      ddEl.appendChild(item);
    });
  }

  inputEl.addEventListener("focus", () => { render(inputEl.value); ddEl.classList.add("open"); });
  inputEl.addEventListener("input", () => render(inputEl.value));
  render();
}

// ── Sidebar ───────────────────────────────────────
export function openSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
}
