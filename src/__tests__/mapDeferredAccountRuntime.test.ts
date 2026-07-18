import { describe, expect, it, vi } from "vitest";

import { scheduleAdminStateLoadRuntimeShared } from "../lib/mapDeferredAccountRuntime.js";

function createAdminQuery(result: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, maybeSingle };
}

describe("map deferred account runtime", () => {
  it("resolves an eager admin lookup without waiting for idle time", async () => {
    const query = createAdminQuery({ data: { user_id: "user-1" }, error: null });
    const setIsAdmin = vi.fn();
    const setAdminStateResolved = vi.fn();

    const dispose = scheduleAdminStateLoadRuntimeShared({
      sessionUserId: "user-1",
      shouldLoadAdminStateEagerly: true,
      nonCriticalStartupReady: false,
      cachedAdminFlag: null,
    }, {
      supabase: { from: query.from },
      isExpectedPermissionError: () => false,
      setIsAdmin,
      setAdminStateResolved,
      writeCachedUserAdminFlag: vi.fn(),
    });

    expect(query.from).toHaveBeenCalledWith("admins");
    await vi.waitFor(() => expect(setAdminStateResolved).toHaveBeenCalledWith(true));
    expect(setIsAdmin).toHaveBeenCalledWith(true);
    dispose();
  });
});
