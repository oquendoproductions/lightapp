import { describe, expect, it, vi } from "vitest";

import {
  isExpectedPermissionErrorShared,
  isMissingFunctionErrorShared,
} from "../lib/mapErrorClassifierSupport.js";
import { installVitePreloadRecovery } from "../lib/vitePreloadRecovery.js";

describe("map runtime recovery support", () => {
  it("classifies expected permission and missing RPC errors", () => {
    expect(isExpectedPermissionErrorShared({ status: 403 })).toBe(true);
    expect(isExpectedPermissionErrorShared({ code: "42501" })).toBe(true);
    expect(isExpectedPermissionErrorShared({ message: "network timeout" })).toBe(false);
    expect(isMissingFunctionErrorShared({ code: "PGRST202" })).toBe(true);
    expect(isMissingFunctionErrorShared({ message: "function x does not exist" })).toBe(true);
  });

  it("reloads only once during a stale lazy-chunk failure burst", () => {
    const listeners = new Map<string, EventListener>();
    const reload = vi.fn();
    const storage = new Map<string, string>();
    const targetWindow = {
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)),
      sessionStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      location: { reload },
    };
    const preventDefault = vi.fn();

    const dispose = installVitePreloadRecovery(targetWindow);
    listeners.get("vite:preloadError")?.({ preventDefault } as unknown as Event);
    listeners.get("vite:preloadError")?.({ preventDefault } as unknown as Event);

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
    dispose();
    expect(targetWindow.removeEventListener).toHaveBeenCalledWith("vite:preloadError", expect.any(Function));
  });
});
