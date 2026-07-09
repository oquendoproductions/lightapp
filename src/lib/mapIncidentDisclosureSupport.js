export function domainDisclosureAckKey(disclosure, index = 0) {
  const id = String(disclosure?.id || "").trim();
  if (id) return id;
  const position = String(disclosure?.display_position || "inside_form").trim().toLowerCase();
  const title = String(disclosure?.title || "disclosure").trim().toLowerCase().replace(/\s+/g, "_");
  return `${position}:${title || "disclosure"}:${index}`;
}
