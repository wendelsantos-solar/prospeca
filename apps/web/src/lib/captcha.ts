// Cloudflare Turnstile CAPTCHA — anti-bot protection for public forms.
//
// Turnstile is free, privacy-focused (no cookies), and invisible by default.
// When VITE_TURNSTILE_SITE_KEY is not configured, CAPTCHA is bypassed (dev mode).
//
// Setup:
//   1. Go to https://dash.cloudflare.com → Turnstile → Add site
//   2. Copy Site Key → VITE_TURNSTILE_SITE_KEY
//   3. Copy Secret Key → TURNSTILE_SECRET_KEY (supabase secrets set)
//   4. Widget renders automatically when key is present
//
// The server verifies the token via the stripe-billing or a dedicated endpoint.
// See docs/EXTERNAL_CONFIGURATION_CHECKLIST.md.

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

/** Whether CAPTCHA is configured and should be shown. */
export function isCaptchaEnabled(): boolean {
  return !!SITE_KEY;
}

/** Get the Turnstile site key (public, safe to expose). */
export function getCaptchaSiteKey(): string | null {
  return SITE_KEY ?? null;
}

/**
 * Loads the Turnstile script and executes a callback when the widget is ready.
 * Idempotent — calling multiple times loads the script only once.
 */
export function loadTurnstileScript(onLoad?: () => void): void {
  if (!SITE_KEY) return;

  if (
    document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]')
  ) {
    // Already loaded — invoke callback directly.
    onLoad?.();
    return;
  }

  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.onload = () => onLoad?.();
  document.head.appendChild(script);
}

/**
 * Renders a Turnstile widget into the given container element.
 * Returns a function that resolves with the token, or rejects on error/timeout.
 */
export async function renderCaptcha(
  container: HTMLElement,
): Promise<{ getToken: () => Promise<string>; reset: () => void }> {
  if (
    !SITE_KEY ||
    typeof window === "undefined" ||
    !(
      window as unknown as {
        turnstile?: {
          render: (
            el: HTMLElement,
            opts: {
              sitekey: string;
              callback: (token: string) => void;
              "error-callback"?: (err: unknown) => void;
              "expired-callback"?: () => void;
              theme?: string;
            },
          ) => string;
          reset: (widgetId: string) => void;
        };
      }
    ).turnstile
  ) {
    // Turnstile not loaded or not configured — resolve with empty token.
    return {
      getToken: () => Promise.resolve(""),
      reset: () => {},
    };
  }

  const turnstile = (
    window as unknown as {
      turnstile: {
        render: (
          el: HTMLElement,
          opts: {
            sitekey: string;
            callback: (token: string) => void;
            "error-callback"?: (err: unknown) => void;
            "expired-callback"?: () => void;
            theme?: string;
          },
        ) => string;
        reset: (widgetId: string) => void;
      };
    }
  ).turnstile;

  return new Promise<{ getToken: () => Promise<string>; reset: () => void }>((resolveWidget) => {
    let token: string | null = null;
    let error: Error | null = null;

    const widgetId = turnstile.render(container, {
      sitekey: SITE_KEY,
      theme: "light",
      callback: (t: string) => {
        token = t;
        error = null;
      },
      "error-callback": () => {
        error = new Error("Falha na verificação de segurança. Recarregue a página.");
      },
      "expired-callback": () => {
        token = null;
        error = new Error("Verificação expirada. Tente novamente.");
      },
    });

    resolveWidget({
      getToken: async () => {
        // If we already have a token (callback fired), return it.
        if (token) return token;
        // If there was an error, reject.
        if (error) throw error;
        // Wait for the user to complete the challenge (max 30s timeout).
        return new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Verificação de segurança expirada. Tente novamente."));
          }, 30_000);
          const check = setInterval(() => {
            if (token) {
              clearTimeout(timeout);
              clearInterval(check);
              resolve(token);
            }
            if (error) {
              clearTimeout(timeout);
              clearInterval(check);
              reject(error);
            }
          }, 200);
        });
      },
      reset: () => turnstile.reset(widgetId),
    });
  });
}
