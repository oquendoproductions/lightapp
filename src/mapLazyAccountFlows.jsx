import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { openExternalUrl } from "./platform/external.js";
import { ActionButtonIcon } from "./mapUiIconComponentsSupport.jsx";
import {
  buildMailtoHref,
  hasNonEmptyValue,
  normalizePhoneHref,
  normalizeResidentMenuLinkRow,
  normalizeResidentMenuSectionRow,
  normalizeWebsiteHref,
  resolveResidentMenuSections,
} from "./lib/workspaceSupport";

function isMissingRelationErrorLocal(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("relation") || msg.includes("does not exist");
}

function normalizeResidentNotificationDraftLocal(topicKey, raw = {}, topics = []) {
  const key = String(topicKey || "").trim();
  const topic = (Array.isArray(topics) ? topics : []).find((row) => String(row?.topic_key || "").trim() === key);
  const fallbackEnabled = topic && Object.prototype.hasOwnProperty.call(topic, "default_enabled")
    ? Boolean(topic.default_enabled)
    : false;
  const emailEnabled = Boolean(raw?.email_enabled);
  const inAppEnabled = Boolean(raw?.in_app_enabled) || emailEnabled || fallbackEnabled;
  return {
    in_app_enabled: inAppEnabled,
    email_enabled: emailEnabled,
    web_push_enabled: false,
  };
}

function ModalShell({ open, children, zIndex = 9999, panelStyle, fullScreen = false, overlayStyle = null }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: fullScreen ? "var(--sl-ui-modal-bg)" : "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: fullScreen ? "stretch" : "center",
        zIndex,
        padding: fullScreen ? 0 : 16,
        animation: fullScreen ? "none" : "sl-modal-overlay-enter 140ms ease-out both",
        ...(overlayStyle || {}),
      }}
    >
      <div
        style={{
          background: "var(--sl-ui-modal-bg)",
          border: fullScreen ? "none" : "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          fontFamily: "var(--app-header-font-family)",
          padding: fullScreen
            ? "calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 12px)"
            : 18,
          borderRadius: fullScreen ? 0 : 10,
          width: fullScreen ? "100vw" : "min(360px, 100%)",
          maxWidth: fullScreen ? "100vw" : undefined,
          minWidth: fullScreen ? "100vw" : undefined,
          height: fullScreen ? "100dvh" : undefined,
          maxHeight: fullScreen ? "100dvh" : undefined,
          display: "grid",
          gap: 12,
          boxShadow: fullScreen ? "none" : "var(--sl-ui-modal-shadow)",
          pointerEvents: "auto",
          animation: fullScreen
            ? "sl-mobile-page-enter 155ms cubic-bezier(0.2, 0.8, 0.2, 1) both"
            : "sl-modal-panel-enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
          ...(panelStyle || {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ManageAccountModal({
  open,
  onClose,
  onBack,
  profile,
  session,
  saving,
  editing,
  setEditing,
  form,
  setForm,
  onSave,
  onOpenChangePassword,
  onOpenDeleteAccount,
  onRequestEdit,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  inputStyle = {},
  btnPrimary = {},
  btnSecondary = {},
  btnPrimaryDark = {},
}) {
  if (!open) return null;

  const email = (profile?.email || session?.user?.email || "").trim() || "—";
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const closeManage = () => {
    setEditing(false);
    onClose();
  };

  return (
    <ModalShell
      open={open}
      zIndex={pageMode ? 10050 : 10010}
      panelStyle={{
        width: pageMode ? "100vw" : "min(420px, 100%)",
        maxHeight: pageMode ? undefined : "min(88vh, 900px)",
        height: pageMode ? "100%" : undefined,
        borderRadius: pageMode ? 0 : 10,
        padding: 0,
        overflow: "hidden",
      }}
      fullScreen={pageMode}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
      } : null}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          height: pageMode ? "100%" : undefined,
          maxHeight: pageMode ? undefined : "min(88vh, 900px)",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: pageMode ? (isWidePageMode ? "22px 22px 16px" : "14px 14px 12px") : 18 }}>
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            {pageMode ? (
              <button
                type="button"
                onClick={onBack || closeManage}
                style={{
                  width: "fit-content",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: pageMode ? (isWidePageMode ? 30 : 24) : 16, fontWeight: 950, lineHeight: 1.05 }}>Manage Account</div>
              {!editing ? (
                <button
                  onClick={onRequestEdit}
                  style={{
                    ...btnPrimaryDark,
                    width: 34,
                    minWidth: 34,
                    height: 34,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  disabled={saving}
                  aria-label="Edit account info"
                  title="Edit account info"
                >
                  <ActionButtonIcon action="edit" darkMode={darkMode} emphasis="filled" />
                </button>
              ) : null}
            </div>
          </div>
          {!pageMode ? (
            <button
              onClick={closeManage}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div style={{ overflowY: "auto", padding: pageMode ? (isWidePageMode ? "16px 22px 24px" : "12px 14px 18px") : "0 18px 18px", fontSize: isWidePageMode ? 14 : 12.5, lineHeight: 1.45 }}>
          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Full name</div>
            <input
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              style={{ ...inputStyle, width: "100%", borderRadius: 14, minHeight: isWidePageMode ? 48 : undefined, fontSize: isWidePageMode ? 15 : undefined }}
              disabled={!editing || saving}
              placeholder="Your full name"
            />
          </label>

          <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Email</div>
            <input
              value={email}
              readOnly
              style={{ ...inputStyle, width: "100%", borderRadius: 14, minHeight: isWidePageMode ? 48 : undefined, fontSize: isWidePageMode ? 15 : undefined, opacity: 0.88 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Phone</div>
            <input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              style={{ ...inputStyle, width: "100%", borderRadius: 14, minHeight: isWidePageMode ? 48 : undefined, fontSize: isWidePageMode ? 15 : undefined }}
              disabled={!editing || saving}
              placeholder="555-555-5555"
            />
          </label>

          <button
            onClick={onOpenChangePassword}
            style={{ ...btnPrimary, width: "100%", marginTop: 12, minHeight: isWidePageMode ? 48 : undefined, fontSize: isWidePageMode ? 15 : undefined }}
            disabled={saving}
          >
            Change Password
          </button>

          <button
            onClick={onOpenDeleteAccount}
            style={{
              ...btnSecondary,
              width: "100%",
              marginTop: 10,
              minHeight: isWidePageMode ? 48 : undefined,
              fontSize: isWidePageMode ? 15 : undefined,
              borderColor: "rgba(183, 28, 28, 0.2)",
              color: "#b71c1c",
            }}
            disabled={saving}
          >
            Delete Account
          </button>
          <div style={{ marginTop: 8, fontSize: isWidePageMode ? 13 : 11.5, lineHeight: 1.4, opacity: 0.78 }}>
            Deleting your account removes your sign-in access and personal profile data. Report records may be retained with
            identifying details removed.
          </div>
        </div>

        {editing ? (
          <div style={{ display: "flex", gap: 10, padding: pageMode ? (isWidePageMode ? "14px 22px calc(14px + env(safe-area-inset-bottom))" : "10px 14px calc(10px + env(safe-area-inset-bottom))") : "0 18px 18px", borderTop: "1px solid var(--sl-ui-modal-border)" }}>
            <button
              onClick={() => {
                setEditing(false);
                setForm({
                  full_name: (profile?.full_name || "").trim(),
                  phone: (profile?.phone || "").trim(),
                });
              }}
              style={btnSecondary}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              onClick={onSave}
              style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

export function DeleteAccountModal({
  open,
  onClose,
  onBack = null,
  confirmText,
  setConfirmText,
  disclosureAccepted,
  setDisclosureAccepted,
  saving,
  onSubmit,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  inputStyle = {},
  btnPrimary = {},
  btnSecondary = {},
}) {
  if (!open) return null;

  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const typedDelete = String(confirmText || "").trim().toUpperCase() === "DELETE";
  const canSubmit = typedDelete && Boolean(disclosureAccepted) && !saving;

  return (
    <ModalShell
      open={open}
      zIndex={pageMode ? 10080 : 10018}
      fullScreen={pageMode}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
      } : null}
      panelStyle={{
        width: pageMode ? "100%" : "min(520px, 100%)",
        maxHeight: pageMode ? undefined : "min(88vh, 900px)",
        padding: 0,
        borderRadius: pageMode ? 0 : 20,
        overflow: "hidden",
        height: pageMode ? "100%" : undefined,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          height: pageMode ? "100%" : undefined,
          maxHeight: pageMode ? undefined : "min(88vh, 900px)",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: pageMode ? (isWidePageMode ? "22px 22px 16px" : "14px 14px 12px") : 18 }}>
          <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
            {pageMode ? (
              <button
                type="button"
                onClick={onBack || onClose}
                style={{
                  width: "fit-content",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            ) : null}
            <div style={{ fontSize: pageMode ? (isWidePageMode ? 30 : 24) : 22, fontWeight: 950, lineHeight: 1.05 }}>
              Delete Account
            </div>
            <div style={{ fontSize: isWidePageMode ? 15 : 13, lineHeight: 1.5, opacity: 0.88, maxWidth: isWidePageMode ? "62ch" : undefined }}>
              This permanently removes your sign-in account, saved profile, and notification preferences. Existing reports may remain for
              municipal recordkeeping, but personal details will be removed where supported.
            </div>
          </div>
          {!pageMode ? (
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div style={{ overflowY: "auto", padding: pageMode ? (isWidePageMode ? "16px 22px 24px" : "12px 14px 18px") : "0 18px 18px", fontSize: isWidePageMode ? 14 : 12.5, lineHeight: 1.45 }}>
          <div
            style={{
              padding: isWidePageMode ? "16px 18px" : "14px 16px",
              borderRadius: 16,
              border: "1px solid rgba(183, 28, 28, 0.18)",
              background: darkMode ? "rgba(109, 27, 27, 0.18)" : "rgba(255, 235, 238, 0.92)",
              color: darkMode ? "#ffd9d9" : "#7f1d1d",
              fontSize: isWidePageMode ? 13.5 : 12.5,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            If your account has organization or staff access, self-service deletion may be blocked and support will need to help.
          </div>

          <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.88 }}>
              Type <span style={{ letterSpacing: "0.08em" }}>DELETE</span> to confirm
            </div>
            <input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{
                ...inputStyle,
                width: "100%",
                minHeight: isWidePageMode ? 48 : undefined,
                fontSize: isWidePageMode ? 15 : undefined,
                borderRadius: 14,
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSubmit) onSubmit();
              }}
            />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: isWidePageMode ? "14px 16px" : "12px 14px",
              borderRadius: 14,
              border: "1px solid var(--sl-ui-modal-border)",
              background: "var(--sl-ui-modal-input-bg)",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.75 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(disclosureAccepted)}
              onChange={(event) => setDisclosureAccepted(event.target.checked)}
              disabled={saving}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: isWidePageMode ? 13.5 : 12.5, lineHeight: 1.45, opacity: 0.9 }}>
              I have read and agree to the disclosure above.
            </span>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, padding: pageMode ? (isWidePageMode ? "14px 22px calc(14px + env(safe-area-inset-bottom))" : "10px 14px calc(10px + env(safe-area-inset-bottom))") : "0 18px 18px", borderTop: "1px solid var(--sl-ui-modal-border)" }}>
          <button onClick={onClose} style={btnSecondary} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{
              ...btnPrimary,
              background: !canSubmit ? "rgba(183, 28, 28, 0.4)" : "#b71c1c",
              color: "#fff",
              boxShadow: "none",
              cursor: !canSubmit ? "not-allowed" : "pointer",
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function ReauthModal({
  open,
  onClose,
  password,
  setPassword,
  saving,
  onConfirm,
  inputStyle = {},
  btnPrimary = {},
  btnSecondary = {},
}) {
  const [show, setShow] = useState(false);
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10074}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Password</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Enter your current password to continue.
      </div>

      <div style={{ position: "relative" }}>
        <input
          placeholder="Current password"
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving && String(password || "").trim()) onConfirm();
          }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            color: "#1976d2",
            fontWeight: 800,
            cursor: "pointer",
            padding: 0,
            fontSize: 12.5,
            lineHeight: 1,
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={btnSecondary} disabled={saving}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ ...btnPrimary, opacity: saving ? 0.75 : 1, cursor: saving ? "not-allowed" : "pointer" }}
          disabled={saving || !String(password || "").trim()}
        >
          {saving ? "Verifying…" : "Continue"}
        </button>
      </div>
    </ModalShell>
  );
}

export function ChangePasswordModal({
  open,
  onClose,
  onBack = null,
  password,
  setPassword,
  password2,
  setPassword2,
  currentPassword,
  setCurrentPassword,
  saving,
  onSubmit,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  inputStyle = {},
  btnPrimary = {},
  btnSecondary = {},
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  if (!open) return null;
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const compactLayout = (pageMode && !isWidePageMode) || (typeof window !== "undefined" ? window.innerWidth <= 520 : true);

  const hasLen = String(password || "").length >= 8;
  const hasUpper = /[A-Z]/.test(String(password || ""));
  const hasLower = /[a-z]/.test(String(password || ""));
  const hasNumber = /[0-9]/.test(String(password || ""));
  const hasSpecial = /[^A-Za-z0-9]/.test(String(password || ""));
  const strongEnough = hasLen && hasUpper && hasLower && hasNumber && hasSpecial;
  const matches = !!password2 && password === password2;
  const hasCurrentPassword = String(currentPassword || "").trim().length > 0;
  const canSubmit = !saving && strongEnough && matches && hasCurrentPassword;
  const reqColor = (ok) => (ok ? "#2ecc71" : "#ff5252");
  const fieldWrapStyle = { position: "relative" };
  const fieldInputStyle = {
    ...inputStyle,
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 74,
    fontSize: 16,
  };
  const fieldShowButtonStyle = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "#1f6fd6",
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
    fontSize: 12.5,
    lineHeight: 1,
  };

  return (
    <ModalShell
      open={open}
      zIndex={10072}
      fullScreen={pageMode}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
      } : null}
      panelStyle={{
        width: pageMode ? "100%" : compactLayout ? "min(420px, 100%)" : "min(520px, 100%)",
        padding: pageMode ? (isWidePageMode ? 24 : 20) : compactLayout ? 20 : 24,
        borderRadius: pageMode ? 0 : compactLayout ? 20 : 24,
        gap: 14,
        height: pageMode ? "100%" : undefined,
        alignContent: "start",
      }}
    >
      {pageMode ? (
        <button
          type="button"
          onClick={onBack || onClose}
          style={{
            width: "fit-content",
            padding: 0,
            border: "none",
            background: "transparent",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontSize: 13,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ fontSize: pageMode ? (isWidePageMode ? 28 : 18) : 22, lineHeight: 1.1, fontWeight: 950, color: "#111111" }}>Change Password</div>
        {!pageMode ? (
          <button
            onClick={onClose}
            style={{
              width: compactLayout ? 42 : 48,
              height: compactLayout ? 42 : 48,
              borderRadius: compactLayout ? 14 : 16,
              border: "1px solid #d8d8d8",
              background: "#ffffff",
              color: "#111111",
              fontWeight: 900,
              fontSize: compactLayout ? 24 : 28,
              cursor: "pointer",
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: isWidePageMode ? 12 : 10, maxWidth: isWidePageMode ? "720px" : undefined }}>
        <div style={fieldWrapStyle}>
          <input
            aria-label="New Password"
            placeholder="New password"
            type={show1 ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={fieldInputStyle}
          />
          <button type="button" onClick={() => setShow1((v) => !v)} style={fieldShowButtonStyle}>
            {show1 ? "Hide" : "Show"}
          </button>
        </div>

        <div style={fieldWrapStyle}>
          <input
            aria-label="Confirm New Password"
            placeholder="Re-enter new password"
            type={show2 ? "text" : "password"}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={fieldInputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
          />
          <button type="button" onClick={() => setShow2((v) => !v)} style={fieldShowButtonStyle}>
            {show2 ? "Hide" : "Show"}
          </button>
        </div>
        <div style={{ fontSize: isWidePageMode ? 13.5 : 12.5, fontWeight: 900, color: "#252525", opacity: 0.9 }}>
          Password Requirements
        </div>
        <div style={{ fontSize: isWidePageMode ? 13.5 : 12.5, lineHeight: 1.35, display: "grid", gap: 2 }}>
          <div style={{ color: reqColor(hasLen), fontWeight: 800 }}>- 8 or more characters</div>
          <div style={{ color: reqColor(hasUpper), fontWeight: 800 }}>- 1 uppercase</div>
          <div style={{ color: reqColor(hasLower), fontWeight: 800 }}>- 1 lowercase</div>
          <div style={{ color: reqColor(hasNumber), fontWeight: 800 }}>- 1 number</div>
          <div style={{ color: reqColor(hasSpecial), fontWeight: 800 }}>- 1 special character</div>
          <div style={{ color: reqColor(matches), fontWeight: 800 }}>- Passwords match</div>
        </div>

        <div style={fieldWrapStyle}>
          <input
            aria-label="Current Password"
            placeholder="Current password"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={fieldInputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
          />
          <button type="button" onClick={() => setShowCurrent((v) => !v)} style={fieldShowButtonStyle}>
            {showCurrent ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            ...btnSecondary,
            minHeight: 48,
            borderRadius: 14,
          }}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          style={{
            ...btnPrimary,
            minHeight: 48,
            borderRadius: 14,
            background: "#8c98ae",
            opacity: canSubmit ? 1 : 0.75,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
          disabled={!canSubmit}
        >
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </ModalShell>
  );
}

export function RecoveryPasswordModal({
  open,
  onClose,
  password,
  setPassword,
  password2,
  setPassword2,
  saving,
  onSubmit,
  inputStyle = {},
  btnPrimary = {},
  btnSecondary = {},
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  if (!open) return null;

  const hasLen = String(password || "").length >= 8;
  const hasUpper = /[A-Z]/.test(String(password || ""));
  const hasLower = /[a-z]/.test(String(password || ""));
  const hasNumber = /[0-9]/.test(String(password || ""));
  const hasSpecial = /[^A-Za-z0-9]/.test(String(password || ""));
  const strongEnough = hasLen && hasUpper && hasLower && hasNumber && hasSpecial;
  const matches = !!password2 && password === password2;
  const canSubmit = !saving && strongEnough && matches;
  const reqColor = (ok) => (ok ? "#2ecc71" : "#ff5252");

  return (
    <ModalShell open={open} zIndex={10075}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Set New Password</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <input
            placeholder="New password"
            type={show1 ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
          />
          <button
            type="button"
            onClick={() => setShow1((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              fontSize: 12.5,
              lineHeight: 1,
            }}
          >
            {show1 ? "Hide" : "Show"}
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <input
            placeholder="Re-enter new password"
            type={show2 ? "text" : "password"}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
          />
          <button
            type="button"
            onClick={() => setShow2((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              fontSize: 12.5,
              lineHeight: 1,
            }}
          >
            {show2 ? "Hide" : "Show"}
          </button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, color: "var(--sl-ui-text)", opacity: 0.9 }}>
          Password Requirements
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.35, display: "grid", gap: 2 }}>
          <div style={{ color: reqColor(hasLen), fontWeight: 800 }}>- 8 or more characters</div>
          <div style={{ color: reqColor(hasUpper), fontWeight: 800 }}>- 1 uppercase</div>
          <div style={{ color: reqColor(hasLower), fontWeight: 800 }}>- 1 lowercase</div>
          <div style={{ color: reqColor(hasNumber), fontWeight: 800 }}>- 1 number</div>
          <div style={{ color: reqColor(hasSpecial), fontWeight: 800 }}>- 1 special character</div>
          <div style={{ color: reqColor(matches), fontWeight: 800 }}>- Passwords match</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={btnSecondary} disabled={saving}>
          Cancel
        </button>
        <button
          onClick={onSubmit}
          style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? "pointer" : "not-allowed" }}
          disabled={!canSubmit}
        >
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </ModalShell>
  );
}

export function MobileHeaderMenuPanel({
  open,
  onClose,
  onContactUs,
  onOpenAbout,
  tenantKey = "",
  readClient = null,
  showCitySwitcher = false,
  onOpenCitySwitcher,
  showLocationDiagnostics = false,
  onOpenLocationDiagnostics,
  pageTopInset = "0px",
  pageBottomInset = "0px",
}) {
  const [residentMenuLinks, setResidentMenuLinks] = useState([]);
  const [residentMenuSections, setResidentMenuSections] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadResidentMenuLinks() {
      const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
      if (!normalizedTenantKey) {
        if (!cancelled) {
          setResidentMenuLinks([]);
          setResidentMenuSections([]);
        }
        return;
      }

      const scopedReadClient = readClient || supabase;
      const [{ data, error }, { data: sectionData, error: sectionError }] = await Promise.all([
        scopedReadClient
          .from("organization_menu_links")
          .select("id,label,section_label,description,link_type,url,phone,email,audience,sort_order,enabled")
          .eq("tenant_key", normalizedTenantKey)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
        scopedReadClient
          .from("organization_menu_sections")
          .select("id,label,sort_order")
          .eq("tenant_key", normalizedTenantKey)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      if (error) {
        if (!isMissingRelationErrorLocal(error)) {
          console.warn("[resident menu links]", error?.message || error);
        }
        setResidentMenuLinks([]);
        setResidentMenuSections([]);
        return;
      }

      setResidentMenuLinks((data || []).filter((row) => row?.enabled !== false));
      if (sectionError && !isMissingRelationErrorLocal(sectionError)) {
        console.warn("[resident menu sections]", sectionError?.message || sectionError);
      }
      setResidentMenuSections(sectionError ? [] : (sectionData || []));
    }

    void loadResidentMenuLinks();
    return () => {
      cancelled = true;
    };
  }, [open, readClient, tenantKey]);

  useEffect(() => {
    if (!open) {
      setResidentMenuLinks([]);
      setResidentMenuSections([]);
    }
  }, [open, tenantKey]);

  if (!open) return null;
  const resolvedResidentMenuSections = residentMenuSections.length
    ? resolveResidentMenuSections(
      residentMenuSections.map((row) => normalizeResidentMenuSectionRow(row)),
      residentMenuLinks.map((row) => normalizeResidentMenuLinkRow(row))
    )
    : resolveResidentMenuSections([], residentMenuLinks.map((row) => normalizeResidentMenuLinkRow(row)));
  const cityReportTextLinkStyle = {
    width: "auto",
    justifySelf: "start",
    padding: "3px 0",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.35,
    textAlign: "left",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        zIndex: 10062,
        pointerEvents: "auto",
        background: "rgba(4, 10, 16, 0.18)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(320px, calc(100vw - 22px))",
          maxWidth: "calc(100vw - 22px)",
          borderLeft: "1px solid var(--sl-ui-header-menu-border)",
          background: "var(--sl-ui-header-menu-bg)",
          boxShadow: "var(--sl-ui-header-menu-shadow)",
          color: "var(--sl-ui-text)",
          padding: "16px 14px 18px",
          overflowY: "auto",
          display: "grid",
          alignContent: "start",
          gap: 14,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>
              Menu
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
            aria-label="Close menu"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="workspace-menu-actions" style={{ display: "grid", gap: 10 }}>
          {resolvedResidentMenuSections.length ? (
            <>
              {resolvedResidentMenuSections.map((section) => (
                <div key={section.key} style={{ display: "grid", gap: 8 }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--sl-ui-header-eyebrow)",
                    }}
                  >
                    {section.label}
                  </div>
                  {section.links.map((linkRow) => (
                    <button
                      key={String(linkRow?.id || `${linkRow?.label || "link"}-${linkRow?.sort_order || 0}`)}
                      type="button"
                      className="workspace-menu-button"
                      style={{
                        width: "100%",
                        display: "grid",
                        justifyItems: "start",
                        textAlign: "left",
                        gap: 6,
                        border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: "var(--sl-ui-modal-btn-secondary-bg)",
                        color: "var(--sl-ui-modal-btn-secondary-text)",
                      }}
                      onClick={() => {
                        const linkType = String(linkRow?.link_type || "").trim().toLowerCase();
                        const href =
                          linkType === "phone"
                            ? normalizePhoneHref(linkRow?.phone)
                            : linkType === "email"
                              ? buildMailtoHref({ to: String(linkRow?.email || "").trim() })
                              : normalizeWebsiteHref(linkRow?.url);
                        onClose?.();
                        if (href) {
                          void openExternalUrl(href);
                        }
                      }}
                    >
                      <span style={{ display: "block", width: "100%", fontSize: 15.5, fontWeight: 900 }}>
                        {String(linkRow?.label || "").trim() || "Open Link"}
                      </span>
                      {String(linkRow?.description || "").trim() ? (
                        <span
                          style={{
                            display: "block",
                            width: "100%",
                            fontSize: 12.5,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            color: "var(--sl-ui-feed-muted-text)",
                            whiteSpace: "normal",
                          }}
                        >
                          {String(linkRow.description).trim()}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
            </>
          ) : null}
          <div
            style={{
              display: "grid",
              justifyItems: "start",
              gap: 7,
              marginTop: resolvedResidentMenuSections.length ? 8 : 0,
              paddingTop: 14,
              borderTop: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--sl-ui-header-eyebrow)",
              }}
            >
              CityReport.io
            </div>
            {showCitySwitcher && typeof onOpenCitySwitcher === "function" ? (
              <button type="button" onClick={onOpenCitySwitcher} style={cityReportTextLinkStyle}>
                Switch Location
              </button>
            ) : null}
            {showLocationDiagnostics && typeof onOpenLocationDiagnostics === "function" ? (
              <button type="button" onClick={onOpenLocationDiagnostics} style={cityReportTextLinkStyle}>
                Location Diagnostics
              </button>
            ) : null}
            <button type="button" onClick={onContactUs} style={cityReportTextLinkStyle}>
              Contact CityReport.io
            </button>
            <button type="button" onClick={onOpenAbout} style={cityReportTextLinkStyle}>
              About CityReport.io
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContactUsModal({
  open,
  onClose,
  organizationDisplayName,
  contactEmail,
  contactPhone,
  websiteUrl,
}) {
  const emailValue = String(contactEmail || "").trim();
  const phoneValue = String(contactPhone || "").trim();
  const websiteValue = String(websiteUrl || "").trim();

  const contactItems = [
    hasNonEmptyValue?.(emailValue)
      ? {
          label: "Email",
          value: emailValue,
          href: buildMailtoHref?.({ to: emailValue }),
        }
      : null,
    hasNonEmptyValue?.(phoneValue)
      ? {
          label: "Phone",
          value: phoneValue,
          href: normalizePhoneHref?.(phoneValue),
        }
      : null,
    hasNonEmptyValue?.(websiteValue)
      ? {
          label: "Website",
          value: websiteValue,
          href: normalizeWebsiteHref?.(websiteValue),
        }
      : null,
  ].filter(Boolean);

  const contactEyebrowColor = "var(--sl-ui-header-eyebrow)";
  const contactTileBorder = "1px solid var(--sl-ui-contact-tile-border)";
  const contactTileBackground = "var(--sl-ui-contact-tile-bg)";
  const contactMutedColor = "var(--sl-ui-feed-muted-text)";

  return (
    <ModalShell
      open={open}
      zIndex={10055}
      panelStyle={{
        width: "min(480px, 100%)",
        borderRadius: 24,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gap: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "22px 22px 18px" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: contactEyebrowColor }}>
              Contact Us
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>
              {organizationDisplayName || "Organization"}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: contactMutedColor }}>
              Reach this organization using the contact options they have made available for the reporting map.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
            aria-label="Close contact us"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, padding: "0 22px 22px" }}>
          {contactItems.length ? (
            contactItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.label === "Website" ? "_blank" : undefined}
                rel={item.label === "Website" ? "noreferrer" : undefined}
                style={{
                  display: "grid",
                  gap: 4,
                  textDecoration: "none",
                  color: "inherit",
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: contactTileBorder,
                  background: contactTileBackground,
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: contactEyebrowColor }}>
                  {item.label}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35, color: "var(--sl-ui-text)", overflowWrap: "anywhere" }}>
                  {item.value}
                </span>
              </a>
            ))
          ) : (
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 18,
                border: contactTileBorder,
                background: contactTileBackground,
                fontSize: 14,
                lineHeight: 1.5,
                color: contactMutedColor,
              }}
            >
              Contact information is not available for this organization yet.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

export function NotificationPreferencesModal({
  open,
  onClose,
  onBack,
  onSave,
  onResetDraft,
  topics,
  preferencesByTopic,
  updatePreferenceDraft,
  saving,
  loading,
  status,
  locationLabel = "",
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  btnPrimaryDark = {},
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const hasError = String(status || "").toLowerCase().includes("could not");
  const sectionEyebrowColor = darkMode ? "#9cb6cf" : "#4f6983";
  const topicCardBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.18)" : "1px solid rgba(23, 49, 79, 0.08)";
  const topicCardBackground = darkMode
    ? "linear-gradient(180deg, rgba(23, 37, 53, 0.96) 0%, rgba(17, 28, 40, 0.96) 100%)"
    : "linear-gradient(180deg, rgba(251, 253, 255, 0.96) 0%, rgba(242, 247, 251, 0.96) 100%)";
  const topicDescriptionColor = darkMode ? "#c4d6e8" : "#58718a";
  const footerBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.08)";
  const checkboxLabelColor = darkMode ? "#edf6ff" : "var(--sl-ui-text)";
  const resolvedLocationLabel = String(locationLabel || "").trim() || "Current location";

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
  }, [open]);

  return (
    <ModalShell
      open={open}
      zIndex={10050}
      panelStyle={{
        width: pageMode ? "100vw" : "min(820px, 100%)",
        maxHeight: pageMode ? undefined : "min(88vh, 900px)",
        height: pageMode ? "100%" : undefined,
        borderRadius: pageMode ? 0 : 24,
        padding: 0,
        overflow: "hidden",
      }}
      fullScreen={pageMode}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
      } : null}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          height: pageMode ? "100%" : undefined,
          maxHeight: pageMode ? undefined : "min(88vh, 900px)",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: pageMode ? (isWidePageMode ? "22px 22px 16px" : "14px 14px 12px") : "22px 22px 18px" }}>
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            {pageMode ? (
              <button
                type="button"
                onClick={onBack || onClose}
                style={{
                  width: "fit-content",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            ) : null}
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: sectionEyebrowColor,
                lineHeight: 1,
              }}
            >
              {resolvedLocationLabel}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "end",
                columnGap: 8,
                marginTop: -3,
              }}
            >
              <div style={{ fontSize: isWidePageMode ? 30 : 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)", minWidth: 0 }}>
                Notification Preferences
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={loading}
                  style={{
                    ...btnPrimaryDark,
                    width: 34,
                    minWidth: 34,
                    height: 34,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: loading ? 0.65 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                  aria-label="Edit notification preferences"
                  title="Edit notification preferences"
                >
                  <ActionButtonIcon action="edit" darkMode={darkMode} emphasis="filled" />
                </button>
              ) : null}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              justifyItems: "end",
              alignContent: "start",
              gap: 8,
              flex: "0 0 auto",
            }}
          >
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onResetDraft?.();
                    setIsEditing(false);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || loading}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "none",
                    background: "var(--sl-ui-brand-blue)",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: saving || loading ? "not-allowed" : "pointer",
                    opacity: saving || loading ? 0.65 : 1,
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : null}
            {!pageMode ? (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                  flex: "0 0 auto",
                }}
                aria-label="Close notification preferences"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: pageMode ? (isWidePageMode ? "0 18px 0 22px" : "0 10px 0 14px") : "0 14px 0 22px",
            marginRight: 4,
            minHeight: 0,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {loading ? (
            <div style={{ fontSize: 13, opacity: 0.82, paddingBottom: 12 }}>Loading your notification preferences…</div>
          ) : (
            <div style={{ display: "grid", gap: 14, paddingBottom: 12 }}>
              {topics.map((topic) => {
                const current = normalizeResidentNotificationDraftLocal(
                  topic.topic_key,
                  preferencesByTopic?.[topic.topic_key] || {},
                  topics,
                );
                return (
                  <article
                    key={topic.topic_key}
                    style={{
                      padding: isWidePageMode ? "16px 18px" : "13px 14px",
                      borderRadius: isWidePageMode ? 16 : 14,
                      border: topicCardBorder,
                      background: topicCardBackground,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        alignItems: "start",
                        gap: 12,
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          minWidth: 0,
                          fontSize: isWidePageMode ? 18 : 16,
                          lineHeight: 1.2,
                        }}
                      >
                        {topic.label}
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: isWidePageMode ? 18 : 14,
                          flexWrap: "nowrap",
                          justifySelf: "end",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: checkboxLabelColor,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(current.in_app_enabled)}
                            disabled={!isEditing}
                            onChange={(event) => updatePreferenceDraft(topic.topic_key, "in_app_enabled", event.target.checked)}
                          />
                          In-app
                        </label>
                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 7,
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: checkboxLabelColor,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(current.email_enabled)}
                            disabled={!isEditing}
                            onChange={(event) => updatePreferenceDraft(topic.topic_key, "email_enabled", event.target.checked)}
                          />
                          Email
                        </label>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: isWidePageMode ? 13.5 : 12.5, lineHeight: 1.4, color: topicDescriptionColor }}>
                      {topic.description}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 12, padding: pageMode ? "14px 14px 18px" : "14px 22px 22px", borderTop: status ? footerBorder : "none" }}>
          {status ? (
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                color: hasError ? "#ffb4b4" : "var(--sl-ui-text)",
                opacity: hasError ? 1 : 0.84,
              }}
            >
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}

export function NotificationPreferencesController({
  open,
  onClose,
  onBack,
  onAfterSave,
  topics = [],
  savedPreferences = {},
  onSavedPreferencesChange,
  sessionUserId = "",
  tenantKey = "",
  locationLabel = "",
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  btnPrimaryDark = {},
}) {
  const [preferencesByTopic, setPreferencesByTopic] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const normalizedUserId = String(sessionUserId || "").trim();
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();

  useEffect(() => {
    if (!open) {
      setPreferencesByTopic({});
      setLoading(false);
      setSaving(false);
      setStatus("");
      return;
    }
    setPreferencesByTopic(savedPreferences || {});
    setStatus("");
  }, [open, savedPreferences]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotificationPreferences() {
      if (!open) return;
      if (!normalizedUserId || !normalizedTenantKey) {
        if (!cancelled) {
          setPreferencesByTopic({});
          setLoading(false);
          setStatus("");
        }
        return;
      }

      setLoading(true);
      setStatus("");
      const { data, error } = await supabase
        .from("resident_notification_preferences")
        .select("topic_key,in_app_enabled,email_enabled,web_push_enabled")
        .eq("tenant_key", normalizedTenantKey)
        .eq("user_id", normalizedUserId);

      if (cancelled) return;

      if (error) {
        setLoading(false);
        if (isMissingRelationErrorLocal(error)) {
          setPreferencesByTopic({});
          onSavedPreferencesChange?.({});
          return;
        }
        setStatus(error.message || "Could not load your notification preferences.");
        return;
      }

      const next = {};
      for (const row of data || []) {
        next[row.topic_key] = normalizeResidentNotificationDraftLocal(row?.topic_key, row, topics);
      }
      setPreferencesByTopic(next);
      onSavedPreferencesChange?.(next);
      setLoading(false);
      setStatus("");
    }

    void loadNotificationPreferences();
    return () => {
      cancelled = true;
    };
  }, [normalizedTenantKey, normalizedUserId, onSavedPreferencesChange, open, topics]);

  const resetDraft = React.useCallback(() => {
    setPreferencesByTopic(savedPreferences || {});
    setStatus("");
  }, [savedPreferences]);

  const updatePreferenceDraft = React.useCallback((topicKey, field, nextValue) => {
    setPreferencesByTopic((prev) => {
      const current = normalizeResidentNotificationDraftLocal(topicKey, prev?.[topicKey] || {}, topics);
      const nextDraft = {
        ...current,
        [field]: nextValue,
      };
      if (field === "email_enabled" && nextValue) {
        nextDraft.in_app_enabled = true;
      }
      if (field === "in_app_enabled" && !nextValue && nextDraft.email_enabled) {
        nextDraft.email_enabled = false;
      }
      return {
        ...prev,
        [topicKey]: normalizeResidentNotificationDraftLocal(topicKey, nextDraft, topics),
      };
    });
  }, [topics]);

  const saveNotificationPreferences = React.useCallback(async () => {
    if (!normalizedUserId || !normalizedTenantKey) return;

    setSaving(true);
    setStatus("");
    const rows = topics.map((topic) => {
      const current = normalizeResidentNotificationDraftLocal(
        topic.topic_key,
        preferencesByTopic?.[topic.topic_key] || {},
        topics,
      );
      return {
        tenant_key: normalizedTenantKey,
        user_id: normalizedUserId,
        topic_key: topic.topic_key,
        in_app_enabled: current.in_app_enabled,
        email_enabled: current.email_enabled ?? false,
        web_push_enabled: false,
      };
    });

    const { error } = await supabase
      .from("resident_notification_preferences")
      .upsert(rows, { onConflict: "tenant_key,user_id,topic_key" });

    setSaving(false);
    if (error) {
      setStatus(error.message || "Could not save your notification preferences.");
      return;
    }

    onSavedPreferencesChange?.(preferencesByTopic);
    setStatus("Notification preferences saved.");
    onAfterSave?.();
  }, [normalizedTenantKey, normalizedUserId, onAfterSave, onSavedPreferencesChange, preferencesByTopic, topics]);

  return (
    <NotificationPreferencesModal
      open={open}
      onClose={onClose}
      onBack={onBack}
      onSave={saveNotificationPreferences}
      onResetDraft={resetDraft}
      topics={topics}
      preferencesByTopic={preferencesByTopic}
      updatePreferenceDraft={updatePreferenceDraft}
      saving={saving}
      loading={loading}
      status={status}
      locationLabel={locationLabel}
      darkMode={darkMode}
      pageMode={pageMode}
      pageTopInset={pageTopInset}
      pageBottomInset={pageBottomInset}
      btnPrimaryDark={btnPrimaryDark}
    />
  );
}
