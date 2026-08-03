import { afterEach, beforeEach, expect, test } from "bun:test";
import { getStoredActiveOrganizationId, setActiveOrganizationId } from "./active-organization";

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const values = new Map<string, string>();

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  if (originalDescriptor) Object.defineProperty(globalThis, "localStorage", originalDescriptor);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

test("persists the organization selected by an invited multi-workspace user", () => {
  expect(getStoredActiveOrganizationId()).toBeNull();
  setActiveOrganizationId("00000000-0000-4000-8000-000000000002");
  expect(getStoredActiveOrganizationId()).toBe("00000000-0000-4000-8000-000000000002");
});
