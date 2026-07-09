import { useEffect } from "react";

export default function MapLazyIncidentRepairProgressController({
  tenantKey,
  activeTenantKeyValue,
  viewerIdentityKey,
  shouldHydrateIncidentRepairProgress,
  incidentRepairProgressReadyForContext,
  incidentRepairProgressAttemptedContextKey,
  incidentRepairProgressContextKey,
  refreshIncidentRepairProgress,
  supabase,
  loadPersistedIncidentRepairConfirmedKeysDeferred,
  setPersistedIncidentRepairConfirmedKeySet,
  setIncidentRepairProgressAttemptedContextKey,
  setIncidentRepairProgressReadyContextKey,
  setIncidentRepairProgressByKey,
}) {
  useEffect(() => {
    let cancelled = false;
    void loadPersistedIncidentRepairConfirmedKeysDeferred(activeTenantKeyValue)
      .then((keys) => {
        if (cancelled) return;
        setPersistedIncidentRepairConfirmedKeySet(new Set(Array.isArray(keys) ? keys : []));
      })
      .catch(() => {
        if (cancelled) return;
        setPersistedIncidentRepairConfirmedKeySet(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantKeyValue, loadPersistedIncidentRepairConfirmedKeysDeferred, tenantKey, setPersistedIncidentRepairConfirmedKeySet]);

  useEffect(() => {
    setIncidentRepairProgressAttemptedContextKey("");
    setIncidentRepairProgressReadyContextKey("");
    setIncidentRepairProgressByKey({});
  }, [tenantKey, viewerIdentityKey, setIncidentRepairProgressAttemptedContextKey, setIncidentRepairProgressReadyContextKey, setIncidentRepairProgressByKey]);

  useEffect(() => {
    if (!shouldHydrateIncidentRepairProgress) {
      setIncidentRepairProgressAttemptedContextKey("");
      return;
    }
    if (incidentRepairProgressReadyForContext) return;
    if (incidentRepairProgressAttemptedContextKey === incidentRepairProgressContextKey) return;
    setIncidentRepairProgressAttemptedContextKey(incidentRepairProgressContextKey);
    void refreshIncidentRepairProgress(viewerIdentityKey);
  }, [
    shouldHydrateIncidentRepairProgress,
    incidentRepairProgressReadyForContext,
    incidentRepairProgressAttemptedContextKey,
    incidentRepairProgressContextKey,
    viewerIdentityKey,
    refreshIncidentRepairProgress,
    setIncidentRepairProgressAttemptedContextKey,
  ]);

  useEffect(() => {
    if (!shouldHydrateIncidentRepairProgress) return undefined;
    const channel = supabase
      .channel("realtime-incident-repair-signals")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_repair_signals" }, () => {
        void refreshIncidentRepairProgress(viewerIdentityKey);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shouldHydrateIncidentRepairProgress, tenantKey, viewerIdentityKey, refreshIncidentRepairProgress, supabase]);

  return null;
}
