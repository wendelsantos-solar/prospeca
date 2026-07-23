import { test, expect } from "bun:test";
import { whatsappDisplay } from "./whatsapp";

test("returns scraped/verified whatsapp as-is (not probable)", () => {
  expect(whatsappDisplay("5521999998888", null)).toEqual({
    value: "5521999998888",
    probable: false,
  });
});

test("infers whatsapp from a BR mobile phone (probable)", () => {
  const r = whatsappDisplay(null, "+55 21 99189-8369");
  expect(r?.value).toBe("+5521991898369");
  expect(r?.probable).toBe(true);
});

test("landline phone yields no whatsapp", () => {
  expect(whatsappDisplay(null, "(21) 3333-4444")).toBeNull();
});

test("no whatsapp and no phone → null", () => {
  expect(whatsappDisplay(null, null)).toBeNull();
});

test("scraped value wins even when a mobile phone exists", () => {
  const r = whatsappDisplay("5511888887777", "+55 21 99189-8369");
  expect(r).toEqual({ value: "5511888887777", probable: false });
});
