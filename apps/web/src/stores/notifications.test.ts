import { test, expect, beforeEach } from "bun:test";
import { useNotificationsStore } from "./notifications";

beforeEach(() => {
  useNotificationsStore.setState({ readIds: [], dismissedIds: [] });
});

test("markRead is idempotent and persists the id in state", () => {
  useNotificationsStore.getState().markRead("n1");
  useNotificationsStore.getState().markRead("n1");
  expect(useNotificationsStore.getState().readIds).toEqual(["n1"]);
});

test("markAllRead adds every id exactly once", () => {
  useNotificationsStore.getState().markRead("n1");
  useNotificationsStore.getState().markAllRead(["n1", "n2", "n3"]);
  expect(useNotificationsStore.getState().readIds).toEqual(["n1", "n2", "n3"]);
});

test("dismiss hides a notification by id", () => {
  useNotificationsStore.getState().dismiss("n1");
  useNotificationsStore.getState().dismiss("n1");
  expect(useNotificationsStore.getState().dismissedIds).toEqual(["n1"]);
});

test("dismissAll tracks the full visible set", () => {
  useNotificationsStore.getState().dismissAll(["n1", "n2"]);
  useNotificationsStore.getState().dismissAll(["n2", "n3"]);
  expect(useNotificationsStore.getState().dismissedIds).toEqual(["n1", "n2", "n3"]);
});
