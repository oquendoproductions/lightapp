function isExpectedPermissionErrorLocal(err) {
  if (!err) return false;
  const statusNum = Number(err?.status);
  const rawCode = String(err?.code || "").toUpperCase();
  const combined = `${String(err?.message || "").toLowerCase()} ${String(err?.details || "").toLowerCase()} ${String(err?.hint || "").toLowerCase()}`;
  if (statusNum === 401 || statusNum === 403) return true;
  if (rawCode === "42501" || rawCode === "PGRST301") return true;
  return (
    combined.includes("permission denied") ||
    combined.includes("row-level security") ||
    combined.includes("forbidden") ||
    combined.includes("not authorized")
  );
}

function isMissingFunctionErrorLocal(err) {
  if (!err) return false;
  const code = String(err?.code || "").trim().toUpperCase();
  const msg = String(err?.message || "").toLowerCase();
  return code === "42883" || msg.includes("function") || msg.includes("does not exist");
}

export async function loadCommunityFeedAccessPermissions({
  supabase,
  tenantKey,
  userId,
  onWarn = null,
} = {}) {
  const safeTenantKey = String(tenantKey || "").trim().toLowerCase();
  const safeUserId = String(userId || "").trim();
  if (!supabase || !safeTenantKey || !safeUserId) {
    return { canManage: false, canDelete: false };
  }

  const [manageRes, deleteRes] = await Promise.all([
    supabase.rpc("can_manage_tenant_communications", { p_tenant: safeTenantKey }),
    supabase.rpc("can_delete_tenant_communications", { p_tenant: safeTenantKey }),
  ]);

  const manageError = manageRes?.error || null;
  const deleteError = deleteRes?.error || null;
  if (manageError && !isMissingFunctionErrorLocal(manageError) && !isExpectedPermissionErrorLocal(manageError)) {
    onWarn?.("[map communications access]", manageError);
  }
  if (deleteError && !isMissingFunctionErrorLocal(deleteError) && !isExpectedPermissionErrorLocal(deleteError)) {
    onWarn?.("[map communications delete access]", deleteError);
  }
  if (manageError) {
    return { canManage: false, canDelete: false };
  }

  return {
    canManage: Boolean(manageRes?.data),
    canDelete: !deleteError && Boolean(deleteRes?.data),
  };
}
