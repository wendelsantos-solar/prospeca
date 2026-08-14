import { describe, expect, test } from "bun:test";
import {
  backoffDelayMs,
  canTransitionJob,
  classifyRetryableError,
  companyProcessingKey,
  DEFAULT_MAX_ATTEMPTS,
  isDeadLetter,
  isRetryableError,
  isTerminalJobStatus,
} from "./job";

describe("classifyRetryableError", () => {
  test("429 → rate_limited", () => {
    expect(classifyRetryableError({ status: 429 })).toBe("rate_limited");
  });
  test("5xx → provider_unavailable", () => {
    expect(classifyRetryableError({ status: 500 })).toBe("provider_unavailable");
    expect(classifyRetryableError({ status: 503 })).toBe("provider_unavailable");
  });
  test("400/422 → invalid_data (permanent)", () => {
    expect(classifyRetryableError({ status: 400 })).toBe("invalid_data");
    expect(classifyRetryableError({ status: 422 })).toBe("invalid_data");
  });
  test("401/403/404 → non_retryable", () => {
    expect(classifyRetryableError({ status: 401 })).toBe("non_retryable");
    expect(classifyRetryableError({ status: 404 })).toBe("non_retryable");
  });
  test("timeout message → retryable", () => {
    expect(classifyRetryableError({ message: "ETIMEDOUT: connection timed out" })).toBe(
      "retryable",
    );
  });
  test("provider unavailable message → provider_unavailable", () => {
    expect(classifyRetryableError({ message: "service unavailable" })).toBe("provider_unavailable");
  });
  test("unknown → retryable (bounded)", () => {
    expect(classifyRetryableError({})).toBe("retryable");
  });
});

describe("isRetryableError", () => {
  test("transient classes retry, permanent do not", () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ message: "timeout" })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 401 })).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  test("exponential and capped", () => {
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(2)).toBe(4000);
    expect(backoffDelayMs(3)).toBe(8000);
    expect(backoffDelayMs(100, 2000, 60_000)).toBe(60_000);
  });
});

describe("job status machine", () => {
  test("queued → processing allowed; terminal → nothing", () => {
    expect(canTransitionJob("queued", "processing")).toBe(true);
    expect(canTransitionJob("processing", "failed")).toBe(true);
    expect(canTransitionJob("completed", "processing")).toBe(false);
  });
  test("admin requeue: failed → queued allowed", () => {
    expect(canTransitionJob("failed", "queued")).toBe(true);
    expect(canTransitionJob("failed", "completed")).toBe(false);
  });
  test("sweeper path: processing → retrying → queued allowed; direct processing → queued NOT allowed", () => {
    expect(canTransitionJob("processing", "retrying")).toBe(true);
    expect(canTransitionJob("retrying", "queued")).toBe(true);
    expect(canTransitionJob("processing", "queued")).toBe(false);
  });
  test("retrying → processing allowed (claim-after-backoff)", () => {
    expect(canTransitionJob("retrying", "processing")).toBe(true);
  });
  test("terminal detection", () => {
    expect(isTerminalJobStatus("completed")).toBe(true);
    expect(isTerminalJobStatus("failed")).toBe(true);
    expect(isTerminalJobStatus("queued")).toBe(false);
    expect(isTerminalJobStatus("retrying")).toBe(false);
  });
});

describe("dead letter", () => {
  test("failed + exhausted attempts = dead letter", () => {
    expect(isDeadLetter({ status: "failed", attempt: DEFAULT_MAX_ATTEMPTS })).toBe(true);
    expect(isDeadLetter({ status: "failed", attempt: 1 })).toBe(false);
    expect(isDeadLetter({ status: "processing", attempt: DEFAULT_MAX_ATTEMPTS })).toBe(false);
  });
  test("failed + attempts beyond max also dead letter", () => {
    expect(isDeadLetter({ status: "failed", attempt: 4 })).toBe(true);
    expect(isDeadLetter({ status: "failed", attempt: 99 })).toBe(true);
  });
  test("retrying is never dead letter", () => {
    expect(isDeadLetter({ status: "retrying", attempt: DEFAULT_MAX_ATTEMPTS })).toBe(false);
  });
});

describe("companyProcessingKey", () => {
  test("namespaced and tenant-scoped", () => {
    expect(companyProcessingKey("org1", "search1", "co1")).toBe(
      "company-processing:org1:search1:co1",
    );
  });
});
