const PRELOAD_RECOVERY_KEY = "cityreport.vite_preload_recovery_at_v1";
const PRELOAD_RECOVERY_COOLDOWN_MS = 30_000;

export function installVitePreloadRecovery(targetWindow = globalThis?.window) {
  if (!targetWindow?.addEventListener) return () => {};

  const handlePreloadError = (event) => {
    event?.preventDefault?.();
    const now = Date.now();
    let lastRecoveryAt = 0;
    try {
      lastRecoveryAt = Number(targetWindow.sessionStorage?.getItem(PRELOAD_RECOVERY_KEY) || 0);
    } catch {
      lastRecoveryAt = 0;
    }
    if (now - lastRecoveryAt < PRELOAD_RECOVERY_COOLDOWN_MS) return;
    try {
      targetWindow.sessionStorage?.setItem(PRELOAD_RECOVERY_KEY, String(now));
    } catch {
      // Reload still provides the best recovery when storage is unavailable.
    }
    targetWindow.location?.reload?.();
  };

  targetWindow.addEventListener("vite:preloadError", handlePreloadError);
  return () => targetWindow.removeEventListener("vite:preloadError", handlePreloadError);
}
