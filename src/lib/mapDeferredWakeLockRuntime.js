export function attachWakeLockRuntimeShared(state = {}, deps = {}) {
  const wakeLockRef = state?.wakeLockRef || null;
  const navigatorLike = deps?.navigatorLike || globalThis?.navigator;
  const documentLike = deps?.documentLike || globalThis?.document;
  const shouldKeepAwake =
    typeof deps?.shouldKeepAwake === "function"
      ? deps.shouldKeepAwake
      : () => false;
  const logger =
    typeof deps?.logger?.warn === "function"
      ? deps.logger
      : console;

  const supportedWakeLock = navigatorLike?.wakeLock;
  if (!supportedWakeLock || !documentLike) return () => {};

  let disposed = false;

  const releaseWakeLock = async () => {
    const lock = wakeLockRef?.current;
    if (wakeLockRef) wakeLockRef.current = null;
    if (!lock) return;
    try {
      await lock.release?.();
    } catch {
      // ignore
    }
  };

  const requestWakeLock = async () => {
    if (!shouldKeepAwake() || disposed || documentLike.visibilityState !== "visible") {
      await releaseWakeLock();
      return;
    }
    if (wakeLockRef?.current) return;
    try {
      wakeLockRef.current = await navigatorLike.wakeLock.request("screen");
      wakeLockRef.current?.addEventListener?.("release", () => {
        if (wakeLockRef.current?.released) {
          wakeLockRef.current = null;
        }
      }, { once: true });
    } catch (error) {
      logger.warn("[wake-lock]", error?.message || error);
    }
  };

  const syncWakeLock = () => {
    void requestWakeLock();
  };

  documentLike.addEventListener("visibilitychange", syncWakeLock);
  void requestWakeLock();

  return () => {
    disposed = true;
    documentLike.removeEventListener("visibilitychange", syncWakeLock);
    void releaseWakeLock();
  };
}
