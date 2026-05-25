import { afterEach, describe, expect, it, vi } from "vitest";

import { CLIENT_ERROR_EVENT, reportClientError } from "./reportClientError";

describe("reportClientError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches a browser-safe client error event with context", () => {
    const listener = vi.fn();
    window.addEventListener(CLIENT_ERROR_EVENT, listener);

    reportClientError(new Error("session expired"), "AuthProvider.login");

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      context: "AuthProvider.login",
      message: "session expired",
    });

    window.removeEventListener(CLIENT_ERROR_EVENT, listener);
  });

  it("normalizes non-Error values without logging to the console", () => {
    const consoleError = vi.spyOn(console, "error");
    const listener = vi.fn();
    window.addEventListener(CLIENT_ERROR_EVENT, listener);

    reportClientError({ code: "unknown" }, "AuthProvider.logout");

    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      context: "AuthProvider.logout",
      message: "Unknown client error",
    });
    expect(consoleError).not.toHaveBeenCalled();

    window.removeEventListener(CLIENT_ERROR_EVENT, listener);
  });
});
