// ═══════════════════════════════════════════════
//  Global Money — js/errors.js
//  Unified error handling: API, Charts, Storage
// ═══════════════════════════════════════════════

// ── Error Registry ────────────────────────────────
const _errorLog = [];
const MAX_LOG = 50;

const ErrorTypes = {
  API:     "api",
  CHART:   "chart",
  STORAGE: "storage",
  GENERAL: "general",
};

export { ErrorTypes };

// ── Core Logger ───────────────────────────────────
function _record(type, context, err, extra = {}) {
  const entry = {
    id:        `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    type,
    context,
    message:   err instanceof Error ? err.message : String(err),
    stack:     err instanceof Error ? err.stack    : null,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  _errorLog.unshift(entry);
  if (_errorLog.length > MAX_LOG) _errorLog.length = MAX_LOG;

  // Console output (dev-friendly, no sensitive data)
  const label = `[GM:${type.toUpperCase()}] ${context}`;
  if (extra.severity === "critical") {
    console.error(label, entry.message);
  } else {
    console.warn(label, entry.message);
  }

  return entry;
}

// ── Public API ────────────────────────────────────

/**
 * Log an API fetch/response error.
 * @param {string} context  - e.g. "loadFiat", "loadCrypto"
 * @param {Error|string} err
 * @param {{ url?: string, source?: string }} [meta]
 */
export function logApiError(context, err, meta = {}) {
  return _record(ErrorTypes.API, context, err, { severity: "warning", ...meta });
}

/**
 * Log a chart rendering/data error.
 * @param {string} context  - e.g. "drawChart", "LightweightCharts"
 * @param {Error|string} err
 */
export function logChartError(context, err) {
  return _record(ErrorTypes.CHART, context, err, { severity: "warning" });
}

/**
 * Log a storage (localStorage) error.
 * @param {string} context  - e.g. "safeSetJSON", "corruptRecovery"
 * @param {Error|string} err
 * @param {{ key?: string }} [meta]
 */
export function logStorageError(context, err, meta = {}) {
  return _record(ErrorTypes.STORAGE, context, err, { severity: "warning", ...meta });
}

/**
 * Log a general/unclassified error.
 */
export function logError(context, err, severity = "warning") {
  return _record(ErrorTypes.GENERAL, context, err, { severity });
}

// ── User-Facing Messages ──────────────────────────
const _messages = {
  api: {
    ar: "تعذّر تحميل البيانات. يُستخدم آخر تحديث محفوظ.",
    fr: "Impossible de charger les données. Utilisation du cache.",
    en: "Could not load live data. Using last cached rates.",
  },
  chart: {
    ar: "تعذّر تحميل الرسم البياني. حاول مجدداً.",
    fr: "Impossible de charger le graphique. Réessayez.",
    en: "Chart failed to load. Please try again.",
  },
  storage: {
    ar: "خطأ في التخزين المحلي. قد تكون بعض البيانات غير متاحة.",
    fr: "Erreur de stockage local. Certaines données peuvent manquer.",
    en: "Local storage error. Some data may be unavailable.",
  },
  general: {
    ar: "حدث خطأ غير متوقع.",
    fr: "Une erreur inattendue s'est produite.",
    en: "An unexpected error occurred.",
  },
};

/**
 * Get a translated user-facing message for an error type.
 * @param {string} type  - ErrorTypes value
 * @param {string} [lang] - "ar"|"fr"|"en"
 */
export function getUserMessage(type, lang = "en") {
  const group = _messages[type] || _messages.general;
  return group[lang] || group.en;
}

/**
 * Show toast with appropriate error message.
 * Lazy-imports showToast to avoid circular deps.
 */
export async function notifyUser(type, lang = "en") {
  const msg = getUserMessage(type, lang);
  try {
    const { showToast } = await import("./ui.js");
    showToast(`⚠️ ${msg}`);
  } catch (_) {
    console.warn("errors.js: could not import ui.js for toast");
  }
}

// ── Accessors ─────────────────────────────────────
export function getErrorLog()                    { return [..._errorLog]; }
export function getErrorsByType(type)            { return _errorLog.filter(e => e.type === type); }
export function clearErrorLog()                  { _errorLog.length = 0; }

// ── Global unhandled error capture ────────────────
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", evt => {
    _record(ErrorTypes.GENERAL, "unhandledRejection", evt.reason || "Promise rejected", { severity: "critical" });
  });
  window.addEventListener("error", evt => {
    _record(ErrorTypes.GENERAL, "windowError", evt.error || evt.message, { severity: "critical" });
  });
}
