export function hasIssueTypeOptionDetail(details = []) {
  return (Array.isArray(details) ? details : []).some((detail) => {
    const detailKey = String(detail?.key || "").trim().toLowerCase();
    const detailLabel = String(detail?.label || "").trim().toLowerCase();
    return detailKey === "issue_type" || detailLabel === "issue type";
  });
}
