import React, { Fragment, Suspense, lazy } from "react";

const LazyAccountMenuPanel = lazy(() => import("./mapLazyAccountPanels.jsx").then((module) => ({ default: module.AccountMenuPanel })));
const LazyFollowedLocationsModal = lazy(() => import("./mapLazyAccountPanels.jsx").then((module) => ({ default: module.FollowedLocationsController })));
const LazyManageAccountModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.ManageAccountModal })));
const LazyDeleteAccountModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.DeleteAccountModal })));
const LazyReauthModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.ReauthModal })));
const LazyChangePasswordModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.ChangePasswordModal })));
const LazyRecoveryPasswordModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.RecoveryPasswordModal })));
const LazyContactUsModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.ContactUsModal })));
const LazyNotificationPreferencesModal = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.NotificationPreferencesController })));

export default function MapLazyAccountWorkspace({
  accountWorkspaceShared,
  desktopAccountMenuWorkspaceConfig,
  manageWorkspaceConfig,
  deleteAccountWorkspaceConfig,
  reauthWorkspaceConfig,
  changePasswordWorkspaceConfig,
  recoveryPasswordWorkspaceConfig,
  followedLocationsWorkspaceConfig,
  notificationPreferencesWorkspaceConfig,
  contactWorkspaceConfig,
}) {
  const {
    useAppShellLayout,
    session,
    profile,
    tenant,
    prefersDarkMode,
    mobileTabPageTopInset,
    mobileReportsPageBottomInset,
    inputStyle,
    btnPrimary,
    btnSecondary,
    btnPrimaryDark,
    organizationDisplayName,
    headerOrganizationProfile,
    sessionUserId,
    activeTenantKey,
    supabase,
    openNotice,
    closeAnyPopup,
  } = accountWorkspaceShared;
  const desktopAccountMenuWorkspace = {
    ...desktopAccountMenuWorkspaceConfig,
    useAppShellLayout,
    session,
    profile,
    tenant,
    prefersDarkMode,
  };
  const manageWorkspace = {
    ...manageWorkspaceConfig,
    prefersDarkMode,
    useAppShellLayout,
    mobileTabPageTopInset,
    mobileReportsPageBottomInset,
    inputStyle,
    btnPrimary,
    btnSecondary,
    btnPrimaryDark,
  };
  const deleteAccountWorkspace = {
    ...deleteAccountWorkspaceConfig,
    prefersDarkMode,
    useAppShellLayout,
    deletePageTopInset: mobileTabPageTopInset,
    deletePageBottomInset: mobileReportsPageBottomInset,
    deleteInputStyle: inputStyle,
    deleteBtnPrimary: btnPrimary,
    deleteBtnSecondary: btnSecondary,
  };
  const reauthWorkspace = {
    ...reauthWorkspaceConfig,
    reauthInputStyle: inputStyle,
    reauthBtnPrimary: btnPrimary,
    reauthBtnSecondary: btnSecondary,
  };
  const changePasswordWorkspace = {
    ...changePasswordWorkspaceConfig,
    changePasswordPageMode: useAppShellLayout,
    changePasswordPageTopInset: mobileTabPageTopInset,
    changePasswordPageBottomInset: mobileReportsPageBottomInset,
    changePasswordInputStyle: inputStyle,
    changePasswordBtnPrimary: btnPrimary,
    changePasswordBtnSecondary: btnSecondary,
  };
  const recoveryPasswordWorkspace = {
    ...recoveryPasswordWorkspaceConfig,
    recoveryInputStyle: inputStyle,
    recoveryBtnPrimary: btnPrimary,
    recoveryBtnSecondary: btnSecondary,
  };
  const followedLocationsWorkspace = {
    ...followedLocationsWorkspaceConfig,
    tenant,
    sessionUserId,
    supabase,
    openNotice,
    organizationDisplayName,
    closeAnyPopup,
    prefersDarkMode,
    followedPageMode: useAppShellLayout,
    followedPageTopInset: mobileTabPageTopInset,
    followedPageBottomInset: mobileReportsPageBottomInset,
    followedInputStyle: inputStyle,
  };
  const notificationPreferencesWorkspace = {
    ...notificationPreferencesWorkspaceConfig,
    notificationSessionUserId: sessionUserId,
    notificationTenantKey: activeTenantKey,
    notificationLocationLabel: organizationDisplayName,
    notificationPrefersDarkMode: prefersDarkMode,
    notificationPageMode: useAppShellLayout,
    notificationPageTopInset: mobileTabPageTopInset,
    notificationPageBottomInset: mobileReportsPageBottomInset,
    notificationBtnPrimaryDark: btnPrimaryDark,
  };
  const contactWorkspace = {
    ...contactWorkspaceConfig,
    organizationDisplayName,
    headerOrganizationProfile,
  };
  const {
    accountMenuOpen,
    showNotificationPreferencesEntry,
    desktopAccountMenuPanelRef,
    setAccountMenuOpen,
    setAccountView,
    setNotificationPreferencesOpen,
    setFollowedLocationsOpen,
    setManageEditing,
    setManageOpen,
    openMyReports,
    setInfoMenuOpen,
    setCitySwitcherOpen,
    setContactUsOpen,
    signOut,
  } = desktopAccountMenuWorkspace;
  const {
    manageOpen,
    manageSaving,
    manageEditing,
    setManageEditing: setManageEditingFromManage,
    manageForm,
    setManageForm,
    saveManagedProfile,
    requestEditManagedProfile,
    prefersDarkMode: managePrefersDarkMode,
    useAppShellLayout: manageUseAppShellLayout,
    setChangePasswordValue,
    setChangePasswordValue2,
    setChangePasswordCurrentValue,
    setChangePasswordOpen,
    openDeleteAccountFlow,
    inputStyle: manageInputStyle,
    btnPrimary: manageBtnPrimary,
    btnSecondary: manageBtnSecondary,
    btnPrimaryDark: manageBtnPrimaryDark,
  } = manageWorkspace;
  const {
    deleteAccountOpen,
    deleteAccountSaving,
    setDeleteAccountOpen,
    setDeleteAccountConfirmText,
    setDeleteAccountDisclosureAccepted,
    deleteAccountConfirmText,
    deleteAccountDisclosureAccepted,
    requestDeleteAccount,
    prefersDarkMode: deletePrefersDarkMode,
    useAppShellLayout: deleteUseAppShellLayout,
    deletePageTopInset,
    deletePageBottomInset,
    deleteInputStyle,
    deleteBtnPrimary,
    deleteBtnSecondary,
    setManageOpen: reopenManageFromDelete,
  } = deleteAccountWorkspace;
  const {
    reauthOpen,
    reauthSaving,
    setReauthOpen,
    setReauthPassword,
    setReauthIntent,
    reauthPassword,
    confirmReauth,
    reauthInputStyle,
    reauthBtnPrimary,
    reauthBtnSecondary,
  } = reauthWorkspace;
  const {
    changePasswordOpen,
    changePasswordSaving,
    setChangePasswordOpen: setChangePasswordOpenState,
    setChangePasswordValue: clearChangePasswordValue,
    setChangePasswordValue2: clearChangePasswordValue2,
    setChangePasswordCurrentValue: clearChangePasswordCurrentValue,
    changePasswordValue,
    setChangePasswordValue: setChangePasswordValueState,
    changePasswordValue2,
    setChangePasswordValue2: setChangePasswordValue2State,
    changePasswordCurrentValue,
    setChangePasswordCurrentValue: setChangePasswordCurrentValueState,
    handleChangePassword,
    changePasswordPageMode,
    changePasswordPageTopInset,
    changePasswordPageBottomInset,
    changePasswordInputStyle,
    changePasswordBtnPrimary,
    changePasswordBtnSecondary,
  } = changePasswordWorkspace;
  const {
    recoveryPasswordOpen,
    recoveryPasswordSaving,
    setRecoveryPasswordOpen,
    setRecoveryPasswordValue,
    setRecoveryPasswordValue2,
    recoveryPasswordValue,
    recoveryPasswordValue2,
    handleRecoveryPasswordUpdate,
    recoveryInputStyle,
    recoveryBtnPrimary,
    recoveryBtnSecondary,
  } = recoveryPasswordWorkspace;
  const {
    followedLocationsOpen,
    tenant: followedTenant,
    sessionUserId: followedSessionUserId,
    supabase: followedSupabase,
    openNotice: followedOpenNotice,
    organizationDisplayName: followedOrganizationDisplayName,
    closeAnyPopup: followedCloseAnyPopup,
    prefersDarkMode: followedPrefersDarkMode,
    followedPageMode,
    followedPageTopInset,
    followedPageBottomInset,
    followedInputStyle,
  } = followedLocationsWorkspace;
  const {
    notificationPreferencesOpen,
    notificationTopics,
    savedNotificationPreferencesByTopic,
    setSavedNotificationPreferencesByTopic,
    notificationSessionUserId,
    notificationTenantKey,
    notificationLocationLabel,
    notificationPrefersDarkMode,
    notificationPageMode,
    notificationPageTopInset,
    notificationPageBottomInset,
    notificationBtnPrimaryDark,
  } = notificationPreferencesWorkspace;
  const {
    contactUsOpen,
    organizationDisplayName: contactOrganizationDisplayName,
    headerOrganizationProfile: contactHeaderOrganizationProfile,
  } = contactWorkspace;

  return (
    <Fragment>
      {(accountMenuOpen && !useAppShellLayout) ? (
        <Suspense fallback={null}>
          <LazyAccountMenuPanel
            open={accountMenuOpen && !useAppShellLayout}
            session={session}
            profile={profile}
            showCitySwitcher={true}
            showNotificationPreferences={showNotificationPreferencesEntry}
            variant="desktop-popout"
            containerRef={desktopAccountMenuPanelRef}
            onClose={() => {
              setAccountMenuOpen(false);
              setAccountView("menu");
            }}
            onManage={() => {
              setAccountMenuOpen(false);
              setNotificationPreferencesOpen(false);
              setFollowedLocationsOpen(false);
              setManageEditing(false);
              setManageOpen(true);
            }}
            onFollowedLocations={() => {
              setAccountMenuOpen(false);
              setManageOpen(false);
              setManageEditing(false);
              setNotificationPreferencesOpen(false);
              void tenant?.ensureAvailableTenantsLoaded?.();
              setFollowedLocationsOpen(true);
            }}
            onNotificationPreferences={() => {
              setAccountMenuOpen(false);
              setManageOpen(false);
              setManageEditing(false);
              setFollowedLocationsOpen(false);
              setNotificationPreferencesOpen(true);
            }}
            onMyReports={() => {
              setAccountMenuOpen(false);
              openMyReports();
            }}
            onOpenCitySwitcher={() => {
              setAccountMenuOpen(false);
              setInfoMenuOpen(false);
              void tenant?.ensureAvailableTenantsLoaded?.();
              setCitySwitcherOpen(true);
            }}
            darkMode={prefersDarkMode}
            onContactUs={() => {
              setAccountMenuOpen(false);
              setContactUsOpen(true);
            }}
            onOpenInfo={() => {
              setAccountMenuOpen(false);
              setCitySwitcherOpen(false);
              setInfoMenuOpen(true);
            }}
            onLogout={() => {
              signOut();
              setAccountMenuOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      {manageOpen ? (
        <Suspense fallback={null}>
          <LazyManageAccountModal
            open={manageOpen}
            onClose={() => {
              setManageOpen(false);
              setManageEditingFromManage(false);
            }}
            onBack={() => {
              setManageOpen(false);
              setManageEditingFromManage(false);
              setAccountView("menu");
              setAccountMenuOpen(true);
            }}
            profile={profile}
            session={session}
            saving={manageSaving}
            editing={manageEditing}
            setEditing={setManageEditingFromManage}
            form={manageForm}
            setForm={setManageForm}
            onSave={saveManagedProfile}
            onRequestEdit={requestEditManagedProfile}
            darkMode={managePrefersDarkMode}
            pageMode={manageUseAppShellLayout}
            pageTopInset={mobileTabPageTopInset}
            pageBottomInset={mobileReportsPageBottomInset}
            onOpenChangePassword={() => {
              setChangePasswordValue("");
              setChangePasswordValue2("");
              setChangePasswordCurrentValue("");
              setChangePasswordOpen(true);
            }}
            onOpenDeleteAccount={() => {
              openDeleteAccountFlow();
            }}
            inputStyle={manageInputStyle}
            btnPrimary={manageBtnPrimary}
            btnSecondary={manageBtnSecondary}
            btnPrimaryDark={manageBtnPrimaryDark}
          />
        </Suspense>
      ) : null}

      {deleteAccountOpen ? (
        <Suspense fallback={null}>
          <LazyDeleteAccountModal
            open={deleteAccountOpen}
            onClose={() => {
              if (deleteAccountSaving) return;
              setDeleteAccountOpen(false);
              setDeleteAccountConfirmText("");
              setDeleteAccountDisclosureAccepted(false);
            }}
            onBack={() => {
              if (deleteAccountSaving) return;
              setDeleteAccountOpen(false);
              setDeleteAccountConfirmText("");
              setDeleteAccountDisclosureAccepted(false);
              reopenManageFromDelete(true);
            }}
            confirmText={deleteAccountConfirmText}
            setConfirmText={setDeleteAccountConfirmText}
            disclosureAccepted={deleteAccountDisclosureAccepted}
            setDisclosureAccepted={setDeleteAccountDisclosureAccepted}
            saving={deleteAccountSaving}
            onSubmit={requestDeleteAccount}
            darkMode={deletePrefersDarkMode}
            pageMode={deleteUseAppShellLayout}
            pageTopInset={deletePageTopInset}
            pageBottomInset={deletePageBottomInset}
            inputStyle={deleteInputStyle}
            btnPrimary={deleteBtnPrimary}
            btnSecondary={deleteBtnSecondary}
          />
        </Suspense>
      ) : null}

      {reauthOpen ? (
        <Suspense fallback={null}>
          <LazyReauthModal
            open={reauthOpen}
            onClose={() => {
              if (reauthSaving) return;
              setReauthOpen(false);
              setReauthPassword("");
              setReauthIntent(null);
            }}
            password={reauthPassword}
            setPassword={setReauthPassword}
            saving={reauthSaving}
            onConfirm={confirmReauth}
            inputStyle={reauthInputStyle}
            btnPrimary={reauthBtnPrimary}
            btnSecondary={reauthBtnSecondary}
          />
        </Suspense>
      ) : null}

      {changePasswordOpen ? (
        <Suspense fallback={null}>
          <LazyChangePasswordModal
            open={changePasswordOpen}
            onClose={() => {
              if (changePasswordSaving) return;
              setChangePasswordOpenState(false);
              clearChangePasswordValue("");
              clearChangePasswordValue2("");
              clearChangePasswordCurrentValue("");
            }}
            onBack={() => {
              if (changePasswordSaving) return;
              setChangePasswordOpenState(false);
            }}
            password={changePasswordValue}
            setPassword={setChangePasswordValueState}
            password2={changePasswordValue2}
            setPassword2={setChangePasswordValue2State}
            currentPassword={changePasswordCurrentValue}
            setCurrentPassword={setChangePasswordCurrentValueState}
            saving={changePasswordSaving}
            onSubmit={handleChangePassword}
            pageMode={changePasswordPageMode}
            pageTopInset={changePasswordPageTopInset}
            pageBottomInset={changePasswordPageBottomInset}
            inputStyle={changePasswordInputStyle}
            btnPrimary={changePasswordBtnPrimary}
            btnSecondary={changePasswordBtnSecondary}
          />
        </Suspense>
      ) : null}

      {recoveryPasswordOpen ? (
        <Suspense fallback={null}>
          <LazyRecoveryPasswordModal
            open={recoveryPasswordOpen}
            onClose={() => {
              if (recoveryPasswordSaving) return;
              setRecoveryPasswordOpen(false);
              setRecoveryPasswordValue("");
              setRecoveryPasswordValue2("");
            }}
            password={recoveryPasswordValue}
            setPassword={setRecoveryPasswordValue}
            password2={recoveryPasswordValue2}
            setPassword2={setRecoveryPasswordValue2}
            saving={recoveryPasswordSaving}
            onSubmit={handleRecoveryPasswordUpdate}
            inputStyle={recoveryInputStyle}
            btnPrimary={recoveryBtnPrimary}
            btnSecondary={recoveryBtnSecondary}
          />
        </Suspense>
      ) : null}

      {followedLocationsOpen ? (
        <Suspense fallback={null}>
          <LazyFollowedLocationsModal
            open={followedLocationsOpen}
            onClose={() => setFollowedLocationsOpen(false)}
            onBack={() => {
              setFollowedLocationsOpen(false);
              setAccountView("menu");
              setAccountMenuOpen(true);
            }}
            cities={followedTenant?.availableTenants || []}
            sessionUserId={followedSessionUserId}
            supabase={followedSupabase}
            openNotice={followedOpenNotice}
            currentTenantKey={followedTenant?.tenantKey || ""}
            currentCityLabel={followedOrganizationDisplayName}
            onSwitchTenant={async (nextTenantKey) => {
              followedCloseAnyPopup();
              setFollowedLocationsOpen(false);
              setAccountView("menu");
              setAccountMenuOpen(false);
              await followedTenant?.switchTenant?.(nextTenantKey);
            }}
            darkMode={followedPrefersDarkMode}
            pageMode={followedPageMode}
            pageTopInset={followedPageTopInset}
            pageBottomInset={followedPageBottomInset}
            inputStyle={followedInputStyle}
          />
        </Suspense>
      ) : null}

      {notificationPreferencesOpen ? (
        <Suspense fallback={null}>
          <LazyNotificationPreferencesModal
            open={notificationPreferencesOpen}
            onClose={() => {
              setNotificationPreferencesOpen(false);
            }}
            onBack={() => {
              setNotificationPreferencesOpen(false);
              setAccountView("menu");
              setAccountMenuOpen(true);
            }}
            onAfterSave={() => {
              setNotificationPreferencesOpen(false);
              setAccountView("menu");
              if (notificationPageMode) setAccountMenuOpen(true);
            }}
            topics={notificationTopics}
            savedPreferences={savedNotificationPreferencesByTopic}
            onSavedPreferencesChange={setSavedNotificationPreferencesByTopic}
            sessionUserId={notificationSessionUserId}
            tenantKey={notificationTenantKey}
            locationLabel={notificationLocationLabel}
            darkMode={notificationPrefersDarkMode}
            pageMode={notificationPageMode}
            pageTopInset={notificationPageTopInset}
            pageBottomInset={notificationPageBottomInset}
            btnPrimaryDark={notificationBtnPrimaryDark}
          />
        </Suspense>
      ) : null}

      {contactUsOpen ? (
        <Suspense fallback={null}>
          <LazyContactUsModal
            open={contactUsOpen}
            onClose={() => setContactUsOpen(false)}
            organizationDisplayName={contactOrganizationDisplayName}
            contactEmail={contactHeaderOrganizationProfile?.contact_primary_email}
            contactPhone={contactHeaderOrganizationProfile?.contact_primary_phone}
            websiteUrl={contactHeaderOrganizationProfile?.website_url}
          />
        </Suspense>
      ) : null}
    </Fragment>
  );
}
