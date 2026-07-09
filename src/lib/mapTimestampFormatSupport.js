export function formatTs(input) {
  try {
    if (input == null || input === "") return "";
    const value = typeof input === "number" ? input : Date.parse(String(input));
    if (!Number.isFinite(value) || value <= 0) return "";
    return new Date(value).toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
