import { expect, test } from "bun:test";
import { pickPriceId } from "./billing-price.ts";

const plan = {
  provider_monthly_price_id: "price_monthly_123",
  provider_annual_price_id: "price_annual_456",
};

test("monthly interval -> monthly price id", () => {
  expect(pickPriceId(plan, "monthly")).toBe("price_monthly_123");
});

test("annual interval -> annual price id", () => {
  expect(pickPriceId(plan, "annual")).toBe("price_annual_456");
});

test("plan missing the requested interval -> null", () => {
  expect(
    pickPriceId({ provider_monthly_price_id: "price_m", provider_annual_price_id: null }, "annual"),
  ).toBe(null);
  expect(
    pickPriceId(
      { provider_monthly_price_id: null, provider_annual_price_id: "price_a" },
      "monthly",
    ),
  ).toBe(null);
});

test("plan not found -> null", () => {
  expect(pickPriceId(null, "monthly")).toBe(null);
  expect(pickPriceId(undefined, "annual")).toBe(null);
});

test("empty string price id counts as missing", () => {
  expect(
    pickPriceId({ provider_monthly_price_id: "", provider_annual_price_id: "" }, "monthly"),
  ).toBe(null);
});
