/**
 * Web Analytics Service — GA4 + Microsoft Clarity
 *
 * Tracks page views and key conversion events on the marketing site.
 * Disabled in Electron desktop app (privacy: no tracking in local installs).
 *
 * Setup:
 *   1. Set VITE_GA4_MEASUREMENT_ID in .env (e.g., G-XXXXXXXXXX)
 *   2. Set VITE_CLARITY_PROJECT_ID in .env (e.g., abc123xyz)
 *   3. Script tags are injected dynamically on first init — no index.html changes needed
 */

// ── Types ──────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    clarity: (...args: unknown[]) => void;
  }
}

type EventParams = Record<string, string | number | boolean | undefined>;

// ── Config ─────────────────────────────────────────────────────────────────

const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

const isElectron = (): boolean => {
  if (typeof window === 'undefined') return false;
  if ((window as any).electron) return true;
  if ((window as any).flowstral) return true;
  if (navigator.userAgent.toLowerCase().includes('electron')) return true;
  return false;
};

let _initialized = false;

// ── UTM Parameter Tracking ─────────────────────────────────────────────────

/**
 * Capture UTM parameters from the URL and store them in sessionStorage.
 * GA4 handles UTM automatically, but we also persist them for CRM/lead capture.
 */
function captureUTMParams(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
    const utm: Record<string, string> = {};
    let hasUTM = false;

    for (const key of utmKeys) {
      const val = params.get(key);
      if (val) {
        utm[key] = val;
        hasUTM = true;
      }
    }

    if (hasUTM) {
      sessionStorage.setItem('flowstral_utm', JSON.stringify(utm));
      // Also fire a custom event so we can build reports in GA4
      if (GA4_ID && window.gtag) {
        window.gtag('event', 'campaign_hit', utm);
      }
    }
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

/** Retrieve stored UTM params (for passing to lead capture forms) */
export function getUTMParams(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem('flowstral_utm');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ── Initialization ─────────────────────────────────────────────────────────

function injectGA4(): void {
  if (!GA4_ID) return;

  // gtag.js async script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);

  // dataLayer + gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, {
    send_page_view: false, // we fire page_view manually on route changes
  });
}

function injectClarity(): void {
  if (!CLARITY_ID) return;

  // Standard Clarity snippet (minified)
  (function (c: any, l: any, a: any, r: string, i: string) {
    c[a] = c[a] || function () {
      (c[a].q = c[a].q || []).push(arguments);
    };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode!.insertBefore(t, y);
  })(window, document, 'clarity', 'script', CLARITY_ID);
}

/**
 * Initialize web analytics. Safe to call multiple times — only runs once.
 * Does nothing in Electron or when IDs are not configured.
 */
export function initAnalytics(): void {
  if (_initialized) return;
  if (isElectron()) return;
  if (!GA4_ID && !CLARITY_ID) return;

  _initialized = true;
  injectGA4();
  injectClarity();
  injectCrisp();
  captureUTMParams();
}

// ── Page View Tracking ─────────────────────────────────────────────────────

/**
 * Track a page view. Call this on every route change.
 */
export function trackPageView(path: string, title?: string): void {
  if (!_initialized || !GA4_ID) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.origin + path,
  });
}

// ── Event Tracking ─────────────────────────────────────────────────────────

/**
 * Track a custom event. Use for CTA clicks, sign-ups, feature engagement, etc.
 *
 * @example
 *   trackEvent('cta_click', { cta_name: 'start_free', page: '/pricing' })
 *   trackEvent('signup_complete', { method: 'email' })
 *   trackEvent('feature_engaged', { feature: 'api_testing' })
 */
export function trackEvent(eventName: string, params?: EventParams): void {
  if (!_initialized || !GA4_ID) return;

  window.gtag('event', eventName, params);
}

// ── Pre-Built Conversion Events ────────────────────────────────────────────

/** User clicked a CTA button (Start Free, Watch Demo, Contact Sales, etc.) */
export function trackCTAClick(ctaName: string, page: string): void {
  trackEvent('cta_click', { cta_name: ctaName, page });
}

/** User completed signup */
export function trackSignup(method: string = 'email'): void {
  trackEvent('sign_up', { method });
}

/** User started using a feature module for the first time */
export function trackFeatureEngaged(feature: string): void {
  trackEvent('feature_engaged', { feature });
}

/** User downloaded the desktop app */
export function trackDownload(platform: string): void {
  trackEvent('app_download', { platform });
}

/** User viewed the pricing page */
export function trackPricingView(): void {
  trackEvent('pricing_view');
}

/** User clicked "Contact Sales" or submitted enterprise inquiry */
export function trackEnterpriseInquiry(): void {
  trackEvent('enterprise_inquiry');
}

/** User watched a demo video/GIF (autoplay or manual) */
export function trackDemoVideoPlay(videoLabel: string): void {
  trackEvent('demo_video_play', { video: videoLabel });
}

// ── Crisp Live Chat ───────────────────────────────────────────────────────

const CRISP_ID = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined;

function injectCrisp(): void {
  if (!CRISP_ID) return;

  // Standard Crisp embed snippet
  (window as any).$crisp = [];
  (window as any).CRISP_WEBSITE_ID = CRISP_ID;

  const s = document.createElement('script');
  s.src = 'https://client.crisp.chat/l.js';
  s.async = true;
  document.head.appendChild(s);
}

/** Open the Crisp chat widget programmatically (e.g., from a "Chat with us" button) */
export function openCrispChat(): void {
  if ((window as any).$crisp) {
    (window as any).$crisp.push(['do', 'chat:open']);
  }
}
