import { expect, test } from "bun:test";
import { evaluatePilotConfiguration } from "./pilot-readiness.ts";

const configured = {
  APP_URL: "https://app.prospeca.com.br",
  APP_ENV: "production",
  GOOGLE_MAPS_SERVER_KEY: "configured",
  RESEND_API_KEY: "configured",
  SALES_NOTIFY_EMAIL: "vendas@prospeca.com.br",
  ADMIN_ALERT_EMAIL: "alertas@prospeca.com.br",
  ANTHROPIC_API_KEY: "configured",
};

test("pilot readiness accepts a complete production configuration", () => {
  expect(evaluatePilotConfiguration(configured)).toEqual({
    app: { status: "ok" },
    discovery: { status: "ok" },
    salesNotifications: { status: "ok" },
    errorNotifications: { status: "ok" },
    aiContactMessage: { status: "ok" },
  });
});

test("pilot readiness reports missing capabilities without exposing secret values", () => {
  const checks = evaluatePilotConfiguration({ APP_ENV: "development" });

  expect(checks.app.status).toBe("fail");
  expect(checks.discovery).toEqual({ status: "fail", missing: ["GOOGLE_MAPS_SERVER_KEY"] });
  expect(checks.salesNotifications).toEqual({
    status: "fail",
    missing: ["RESEND_API_KEY", "SALES_NOTIFY_EMAIL"],
  });
  expect(checks.errorNotifications).toEqual({
    status: "fail",
    missing: ["RESEND_API_KEY", "ADMIN_ALERT_EMAIL"],
  });
  expect(checks.aiContactMessage).toEqual({
    status: "fail",
    missing: ["ANTHROPIC_API_KEY"],
  });
  expect(JSON.stringify(checks)).not.toContain("configured");
});
