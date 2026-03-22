import { describe, expect, it, vi } from "vitest";
import { trackEvent } from "../lib/analytics";

describe("trackEvent", () => {
  it("dispatches to plausible and gtag when available", () => {
    const plausible = vi.fn();
    const gtag = vi.fn();

    window.plausible = plausible;
    window.gtag = gtag;

    trackEvent("hero_primary_cta_click", { target: "lead" });

    expect(plausible).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});
