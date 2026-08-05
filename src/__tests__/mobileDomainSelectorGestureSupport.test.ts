import { describe, expect, it, vi } from "vitest";
import {
  beginMobileDomainSelectorGesture,
  endMobileDomainSelectorGesture,
  shouldIgnoreMobileDomainSelectorClick,
  updateMobileDomainSelectorGesture,
} from "../lib/mobileDomainSelectorGestureSupport";

function touchEvent(type: string, x: number, y: number) {
  return {
    pointerType: type,
    pointerId: 1,
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

describe("mobile domain selector gestures", () => {
  it("does not change a domain while the selector list is being scrolled", () => {
    const gestureRef = { current: null as any };
    const action = vi.fn();
    beginMobileDomainSelectorGesture(touchEvent("touch", 20, 100), gestureRef);
    updateMobileDomainSelectorGesture(touchEvent("touch", 20, 132), gestureRef);

    expect(endMobileDomainSelectorGesture(touchEvent("touch", 20, 132), gestureRef, action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it("runs one action for a completed tap and ignores its follow-up click", () => {
    vi.useFakeTimers();
    const gestureRef = { current: null as any };
    const action = vi.fn();
    beginMobileDomainSelectorGesture(touchEvent("touch", 20, 100), gestureRef);

    expect(endMobileDomainSelectorGesture(touchEvent("touch", 20, 100), gestureRef, action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(shouldIgnoreMobileDomainSelectorClick(gestureRef)).toBe(true);
    vi.useRealTimers();
  });
});
