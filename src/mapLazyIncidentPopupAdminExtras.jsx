import React from "react";
import { ActionButtonIcon } from "./mapUiIconComponentsSupport.jsx";

export default function IncidentPopupAdminExtras({
  descriptor = null,
  prefersDarkMode = false,
  onDeleteOfficialSignConfirm = null,
}) {
  const mode = String(descriptor?.mode || "").trim();
  if (mode !== "mapped_asset_delete_button") return null;
  const targetId = String(descriptor?.targetId || "").trim();
  const actionLabel = String(descriptor?.actionLabel || "Delete asset").trim() || "Delete asset";
  if (!targetId) return null;

  return (
    <button
      type="button"
      onClick={() => onDeleteOfficialSignConfirm?.(targetId)}
      style={{
        padding: 10,
        borderRadius: 12,
        border: "1px solid rgba(255,99,132,0.45)",
        background: "rgba(255,99,132,0.16)",
        color: "#fff",
        fontWeight: 800,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label={actionLabel}
      title={actionLabel}
    >
      <ActionButtonIcon action="delete" darkMode={prefersDarkMode} emphasis="danger" />
    </button>
  );
}
