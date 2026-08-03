export interface PilotReadinessCheck {
  status: "ok" | "fail";
  missing?: string[];
}

export type PilotReadinessChecks = Record<
  "app" | "discovery" | "salesNotifications" | "errorNotifications" | "aiContactMessage",
  PilotReadinessCheck
>;

type Environment = Record<string, string | undefined>;

function checkRequired(environment: Environment, names: string[]): PilotReadinessCheck {
  const missing = names.filter((name) => !environment[name]?.trim());
  return missing.length > 0 ? { status: "fail", missing } : { status: "ok" };
}

/**
 * Checks whether the paid-pilot capabilities are configured. Values are never
 * returned, so this result is safe to expose from an unauthenticated health
 * endpoint and to consume from deployment automation.
 */
export function evaluatePilotConfiguration(environment: Environment): PilotReadinessChecks {
  const app = checkRequired(environment, ["APP_URL", "APP_ENV"]);
  if (
    app.status === "ok" &&
    (environment.APP_ENV !== "production" || !environment.APP_URL?.startsWith("https://"))
  ) {
    app.status = "fail";
    app.missing = ["APP_URL_HTTPS", "APP_ENV_PRODUCTION"];
  }

  return {
    app,
    discovery: checkRequired(environment, ["GOOGLE_MAPS_SERVER_KEY"]),
    salesNotifications: checkRequired(environment, ["RESEND_API_KEY", "SALES_NOTIFY_EMAIL"]),
    errorNotifications: checkRequired(environment, ["RESEND_API_KEY", "ADMIN_ALERT_EMAIL"]),
    aiContactMessage: checkRequired(environment, ["ANTHROPIC_API_KEY"]),
  };
}
