function trimOrEmpty(value) {
  return String(value || "").trim();
}

export function humanizeLabel(value, fallback = "") {
  const label = trimOrEmpty(value);
  if (!label) return trimOrEmpty(fallback);
  return label
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
