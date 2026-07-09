export async function sendPasswordResetAction({
  supabase,
  forgotPasswordEmail,
  setForgotPasswordError,
  setAuthResetLoading,
  setForgotPasswordOpen,
  openNotice,
  getAuthRedirectOptions,
}) {
  const email = String(forgotPasswordEmail || "").trim().toLowerCase();
  if (!email) {
    setForgotPasswordError("Enter email");
    return false;
  }

  setForgotPasswordError("");
  setAuthResetLoading(true);
  const { error } = await supabase.auth.resetPasswordForEmail(email, getAuthRedirectOptions("/"));
  setAuthResetLoading(false);

  if (error) {
    openNotice("⚠️", "Couldn’t send reset", error.message || "Password reset email failed.");
    return false;
  }

  setForgotPasswordOpen(false);
  openNotice("✅", "Check your email", "If an account exists for that email, a password reset link has been sent.");
  return true;
}

export async function userCreateAccountAction({
  supabase,
  email,
  password,
  full_name,
  phone,
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        phone,
        terms_accepted: true,
        privacy_accepted: true,
        contact_forwarding_consent: true,
        legal_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    return { ok: false, error };
  }

  const uid = data?.user?.id;
  if (uid) {
    const { error: profErr } = await supabase
      .from("profiles")
      .insert([{ user_id: uid, full_name, phone: phone || null, email }]);

    if (profErr) {
      console.error(profErr);
    }
  }

  return { ok: true };
}

export async function saveManagedProfileAction({
  supabase,
  sessionUserId,
  sessionUserEmail,
  profileEmail,
  manageForm,
  reauthAt,
  setReauthIntent,
  setReauthPassword,
  setReauthOpen,
  setManageSaving,
  setProfile,
  setManageEditing,
  openNotice,
}) {
  if (!sessionUserId) return false;

  const full_name = String(manageForm?.full_name || "").trim();
  const phone = String(manageForm?.phone || "").trim();

  if (!full_name) {
    openNotice("⚠️", "Name required", "Please enter your full name.");
    return false;
  }

  if (Date.now() - Number(reauthAt || 0) > 5 * 60 * 1000) {
    setReauthIntent("save_profile");
    setReauthPassword("");
    setReauthOpen(true);
    return false;
  }

  setManageSaving(true);

  const { error: upErr } = await supabase
    .from("profiles")
    .upsert(
      [{
        user_id: sessionUserId,
        full_name,
        phone: phone || null,
        email: profileEmail || sessionUserEmail || null,
      }],
      { onConflict: "user_id" }
    );

  if (upErr) {
    console.error(upErr);
    openNotice("⚠️", "Save failed", "Could not update your profile. Please try again.");
    setManageSaving(false);
    return false;
  }

  const { error: metaErr } = await supabase.auth.updateUser({
    data: { full_name, phone: phone || null },
  });

  if (metaErr) {
    console.warn("[auth.updateUser] warning:", metaErr);
  }

  setProfile((prev) => ({
    ...(prev || {}),
    full_name,
    phone: phone || null,
    email: prev?.email || sessionUserEmail || null,
  }));

  setManageSaving(false);
  setManageEditing(false);
  openNotice("✅", "Saved", "Your account details were updated.");
  return true;
}

export async function performDeleteAccountAction({
  supabase,
  sessionUserId,
  publicAccountDeletePendingAuthKey,
  clearDeleteAccountQuery,
  setDeleteAccountSaving,
  setDeleteAccountOpen,
  setDeleteAccountConfirmText,
  setDeleteAccountDisclosureAccepted,
  setManageOpen,
  setManageEditing,
  setAccountMenuOpen,
  setNotificationPreferencesOpen,
  setFollowedLocationsOpen,
  setAccountView,
  setSession,
  setProfile,
  clearReauthAt,
  markCrossTenantLogout,
  openNotice,
}) {
  if (!sessionUserId) return false;

  setDeleteAccountSaving(true);
  const { data, error } = await supabase.functions.invoke("delete-user-self", { body: {} });
  setDeleteAccountSaving(false);

  if (error || data?.ok === false) {
    const message = data?.error || error?.message || "Please try again.";
    if (String(data?.code || "").trim() === "staff_account") {
      openNotice("⚠️", "Support required", message || "Accounts with organization access must be deleted by support.");
      return false;
    }
    openNotice("⚠️", "Couldn’t delete account", message);
    return false;
  }

  try {
    window.sessionStorage.removeItem(publicAccountDeletePendingAuthKey);
  } catch {
    // ignore storage failures
  }

  clearDeleteAccountQuery();
  setDeleteAccountOpen(false);
  setDeleteAccountConfirmText("");
  setDeleteAccountDisclosureAccepted(false);
  setManageOpen(false);
  setManageEditing(false);
  setAccountMenuOpen(false);
  setNotificationPreferencesOpen(false);
  setFollowedLocationsOpen(false);
  setAccountView("menu");
  clearReauthAt();

  try {
    await supabase.auth.signOut();
  } catch {
    // ignore sign-out failures after account deletion
  }

  markCrossTenantLogout();
  setSession(null);
  setProfile(null);
  openNotice(
    "✅",
    "Account deleted",
    "Your account has been deleted. Some report records may remain with personal details removed."
  );
  return true;
}

export async function changePasswordAction({
  supabase,
  sessionUserEmail,
  profileEmail,
  changePasswordCurrentValue,
  changePasswordValue,
  changePasswordValue2,
  validateStrongPassword,
  openNotice,
  setChangePasswordSaving,
  setChangePasswordValue,
  setChangePasswordValue2,
  setChangePasswordCurrentValue,
  setChangePasswordOpen,
  setSession,
  setReauthAt,
}) {
  const p1 = String(changePasswordValue || "");
  const p2 = String(changePasswordValue2 || "");
  const current = String(changePasswordCurrentValue || "");
  if (!(await validateStrongPassword(p1))) {
    openNotice("⚠️", "Weak password", "Use 8+ chars with uppercase, lowercase, number, and special character.");
    return false;
  }
  if (p1 !== p2) {
    openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
    return false;
  }
  if (!current.trim()) {
    openNotice("⚠️", "Current password required", "Enter your current password to continue.");
    return false;
  }

  setChangePasswordSaving(true);
  const email = String(sessionUserEmail || profileEmail || "").trim().toLowerCase();
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (reauthError) {
    setChangePasswordSaving(false);
    openNotice("⚠️", "Re-auth failed", reauthError.message || "Please verify your current password.");
    return false;
  }

  setReauthAt(Date.now());
  const { error } = await supabase.auth.updateUser({ password: p1 });
  setChangePasswordSaving(false);

  if (error) {
    openNotice("⚠️", "Couldn’t update password", error.message || "Please try again.");
    return false;
  }

  setChangePasswordValue("");
  setChangePasswordValue2("");
  setChangePasswordCurrentValue("");
  setChangePasswordOpen(false);
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session) setSession(data.session);
  } catch {
    // no-op
  }
  openNotice("✅", "Password updated", "Your password was changed successfully.");
  return true;
}

export async function recoveryPasswordUpdateAction({
  supabase,
  recoveryPasswordValue,
  recoveryPasswordValue2,
  validateStrongPassword,
  openNotice,
  setRecoveryPasswordSaving,
  setRecoveryPasswordValue,
  setRecoveryPasswordValue2,
  setRecoveryPasswordOpen,
  setSession,
}) {
  const p1 = String(recoveryPasswordValue || "");
  const p2 = String(recoveryPasswordValue2 || "");
  if (!(await validateStrongPassword(p1))) {
    openNotice("⚠️", "Weak password", "Use 8+ chars with uppercase, lowercase, number, and special character.");
    return false;
  }
  if (p1 !== p2) {
    openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
    return false;
  }

  setRecoveryPasswordSaving(true);
  const { error } = await supabase.auth.updateUser({ password: p1 });
  setRecoveryPasswordSaving(false);

  if (error) {
    openNotice("⚠️", "Couldn’t update password", error.message || "Please try again.");
    return false;
  }

  setRecoveryPasswordValue("");
  setRecoveryPasswordValue2("");
  setRecoveryPasswordOpen(false);
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session) setSession(data.session);
  } catch {
    // no-op
  }
  openNotice("✅", "Password updated", "Your password was reset successfully.");
  return true;
}

export async function confirmReauthAction({
  supabase,
  sessionUserEmail,
  profileEmail,
  reauthPassword,
  reauthIntent,
  openNotice,
  setReauthSaving,
  setReauthOpen,
  setReauthPassword,
  setReauthIntent,
  setManageEditing,
  setReauthAt,
  onSaveProfile,
  onDeleteAccount,
}) {
  const email = String(sessionUserEmail || profileEmail || "").trim().toLowerCase();
  const password = String(reauthPassword || "");
  if (!email || !password) {
    openNotice("⚠️", "Re-auth failed", "Current password is required.");
    return false;
  }

  setReauthSaving(true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setReauthSaving(false);

  if (error) {
    openNotice("⚠️", "Re-auth failed", error.message || "Please verify your current password.");
    return false;
  }

  setReauthAt(Date.now());
  const intent = reauthIntent;
  setReauthOpen(false);
  setReauthPassword("");
  setReauthIntent(null);

  if (intent === "edit_profile") {
    setManageEditing(true);
    return true;
  }
  if (intent === "save_profile") {
    await onSaveProfile();
    return true;
  }
  if (intent === "delete_account") {
    await onDeleteAccount();
    return true;
  }

  return true;
}
