const SCROLL_TOLERANCE_PX = 10;
const SYNTHETIC_CLICK_GUARD_MS = 500;

export function beginMobileDomainSelectorGesture(event, gestureRef) {
  if (event?.pointerType !== "touch") return;
  gestureRef.current = {
    pointerId: event.pointerId,
    startX: Number(event.clientX || 0),
    startY: Number(event.clientY || 0),
    moved: false,
    suppressClickUntil: 0,
  };
}

export function updateMobileDomainSelectorGesture(event, gestureRef) {
  const gesture = gestureRef.current;
  if (event?.pointerType !== "touch" || !gesture || event.pointerId !== gesture.pointerId) return;
  const distance = Math.hypot(Number(event.clientX || 0) - gesture.startX, Number(event.clientY || 0) - gesture.startY);
  if (distance > SCROLL_TOLERANCE_PX) gesture.moved = true;
}

export function endMobileDomainSelectorGesture(event, gestureRef, action) {
  const gesture = gestureRef.current;
  if (event?.pointerType !== "touch" || !gesture || event.pointerId !== gesture.pointerId) return false;
  gesture.suppressClickUntil = Date.now() + SYNTHETIC_CLICK_GUARD_MS;
  gestureRef.current = gesture;
  if (gesture.moved) return false;
  event.preventDefault();
  event.stopPropagation();
  action?.();
  return true;
}

export function cancelMobileDomainSelectorGesture(event, gestureRef) {
  const gesture = gestureRef.current;
  if (event?.pointerType !== "touch" || !gesture || event.pointerId !== gesture.pointerId) return;
  gestureRef.current = { ...gesture, moved: true, suppressClickUntil: Date.now() + SYNTHETIC_CLICK_GUARD_MS };
}

export function shouldIgnoreMobileDomainSelectorClick(gestureRef) {
  return Date.now() < Number(gestureRef.current?.suppressClickUntil || 0);
}
