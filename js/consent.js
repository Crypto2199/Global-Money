// ═══════════════════════════════════════════════
//  Global Money v4.2 — js/consent.js
//  Analytics Consent Manager (GDPR-friendly)
//  Shows a consent banner before loading Google Analytics
// ═══════════════════════════════════════════════
import { state } from "./state.js";

const CONSENT_KEY = "gm_analytics_consent";

/**
 * Check stored consent — "granted" | "denied" | null
 */
export function getConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

/**
 * Grant analytics consent and load GA
 */
export function grantConsent() {
  state.setAnalyticsConsent("granted");
  _loadGoogleAnalytics();
  _hideBanner();
}

/**
 * Deny analytics consent
 */
export function denyConsent() {
  state.setAnalyticsConsent("denied");
  _hideBanner();
}

/**
 * Load GA script dynamically — only after consent
 */
function _loadGoogleAnalytics() {
  if (document.getElementById("ga-script")) return; // already loaded
  const s = document.createElement("script");
  s.id    = "ga-script";
  s.async = true;
  s.src   = "https://www.googletagmanager.com/gtag/js?id=G-5QWDCB9350";
  document.head.appendChild(s);

  // Init gtag after script loads
  s.onload = () => {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", "G-5QWDCB9350", { anonymize_ip: true });
    console.log("[GM:Analytics] Loaded after user consent ✓");
  };
}

function _hideBanner() {
  const banner = document.getElementById("consentBanner");
  if (banner) {
    banner.classList.add("consent-hiding");
    setTimeout(() => banner.remove(), 400);
  }
}

/**
 * Show consent banner if no decision has been made
 */
export function initConsent() {
  const stored = getConsent();

  // Already decided — act accordingly
  if (stored === "granted") {
    _loadGoogleAnalytics();
    return;
  }
  if (stored === "denied") return;

  // No decision yet — show banner after short delay
  setTimeout(() => _showBanner(), 1500);
}

function _showBanner() {
  // Don't double-show
  if (document.getElementById("consentBanner")) return;

  const banner = document.createElement("div");
  banner.id        = "consentBanner";
  banner.className = "consent-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Privacy & Analytics Consent");

  banner.innerHTML = `
    <div class="consent-inner">
      <div class="consent-icon">🔒</div>
      <div class="consent-text">
        <p class="consent-title">Privacy & Analytics</p>
        <p class="consent-body">We use anonymous analytics to improve Global Money. No personal data is sold. You can change your choice anytime in settings.</p>
      </div>
      <div class="consent-actions">
        <button class="consent-btn consent-deny"  id="consentDenyBtn">Decline</button>
        <button class="consent-btn consent-accept" id="consentAcceptBtn">Accept</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => banner.classList.add("consent-visible"));

  document.getElementById("consentAcceptBtn").addEventListener("click", grantConsent);
  document.getElementById("consentDenyBtn").addEventListener("click",  denyConsent);
}
