export async function loadReportAccessShared({
  sessionUserId,
  tenantKey,
  supabase,
  isMissingFunctionError,
  isExpectedPermissionError,
  setCanAccessAdminReports,
  setCanAccessDomainReports,
  setCanEditDomainReports,
  setReportAccessResolved,
  writeCachedUserReportAccess,
  userId,
}) {
  if (!sessionUserId) {
    setCanAccessAdminReports(false);
    setCanAccessDomainReports(false);
    setCanEditDomainReports(false);
    setReportAccessResolved(true);
    return;
  }

  const [adminRes, domainRes, editRes] = await Promise.all([
    supabase.rpc("can_access_tenant_admin_reports", { p_tenant: tenantKey }),
    supabase.rpc("can_access_tenant_domain_reports", { p_tenant: tenantKey }),
    supabase.rpc("can_edit_tenant_domain_reports", { p_tenant: tenantKey }),
  ]);

  const adminError = adminRes?.error || null;
  const domainError = domainRes?.error || null;
  const editError = editRes?.error || null;
  if (adminError && !isMissingFunctionError(adminError) && !isExpectedPermissionError(adminError)) {
    console.warn("[map report access admin]", adminError?.message || adminError);
  }
  if (domainError && !isMissingFunctionError(domainError) && !isExpectedPermissionError(domainError)) {
    console.warn("[map report access domain]", domainError?.message || domainError);
  }
  if (editError && !isMissingFunctionError(editError) && !isExpectedPermissionError(editError)) {
    console.warn("[map report edit domain]", editError?.message || editError);
  }

  const nextAdmin = !adminError ? Boolean(adminRes?.data) : false;
  const nextDomain = !domainError ? Boolean(domainRes?.data) : false;
  const nextEdit = !editError ? Boolean(editRes?.data) : false;
  setCanAccessAdminReports(nextAdmin);
  setCanAccessDomainReports(nextDomain || nextAdmin);
  setCanEditDomainReports(nextEdit || nextAdmin);
  setReportAccessResolved(true);
  if (userId && tenantKey) {
    writeCachedUserReportAccess(userId, tenantKey, {
      canAccessAdminReports: nextAdmin,
      canAccessDomainReports: nextDomain || nextAdmin,
      canEditDomainReports: nextEdit || nextAdmin,
    });
  }
}
