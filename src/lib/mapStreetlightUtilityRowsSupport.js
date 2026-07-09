export function splitStreetlightAddressParts(rawAddress) {
  const raw = String(rawAddress || "").trim();
  if (!raw) {
    return { houseNumber: "", street: "", city: "", state: "", zip: "" };
  }
  const parts = raw
    .split(",")
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part) => part.toLowerCase() !== "usa");
  if (!parts.length) {
    return { houseNumber: "", street: "", city: "", state: "", zip: "" };
  }
  const line1 = parts[0] || "";
  const line2 = parts[1] || "";
  const line3 = parts[2] || "";
  const streetMatch = line1.match(/^\s*(\d+[A-Za-z0-9\-]*)\s+(.+)\s*$/);
  const stateZipSource = parts.find((part) => /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(part)) || "";
  const stateZipMatch = stateZipSource.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  return {
    houseNumber: String(streetMatch?.[1] || "").trim(),
    street: String(streetMatch?.[2] || line1 || "").trim() || "Address unavailable",
    city: line2 || line3 || "",
    state: stateZipMatch?.[1] || "",
    zip: stateZipMatch?.[2] || "",
  };
}

export function deriveStreetlightCrossStreet(onStreetRaw, intersectionRaw, nearestCrossStreetRaw) {
  if (String(nearestCrossStreetRaw || "").trim()) return String(nearestCrossStreetRaw || "").trim();
  if (!String(intersectionRaw || "").trim()) return "";
  const normalizeRoad = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const onStreetKey = normalizeRoad(onStreetRaw);
  const cleaned = String(intersectionRaw || "")
    .replace(/\b(at|on|between|near|of|north|south|east|west|n|s|e|w)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(/&|\/|,|\band\b|\bnear\b|\bbetween\b|\bof\b/i)
    .map((token) => String(token || "").trim())
    .filter(Boolean);
  for (const token of tokens) {
    const tokenKey = normalizeRoad(token);
    if (!tokenKey) continue;
    if (!onStreetKey) return token;
    if (tokenKey === onStreetKey) continue;
    if (tokenKey.includes(onStreetKey) || onStreetKey.includes(tokenKey)) continue;
    return token;
  }
  return "";
}

export function buildStreetlightUtilityRows(util, coords) {
  const latVal = Number(coords?.lat);
  const lngVal = Number(coords?.lng);
  const coordsText =
    Number.isFinite(latVal) && Number.isFinite(lngVal)
      ? `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`
      : "Unavailable";
  const parts = splitStreetlightAddressParts(String(util?.nearestAddress || util?.nearest_address || "").trim());
  const onStreet = String(util?.nearestStreet || util?.nearest_street || "").trim();
  const intersectionRaw = String(util?.nearestIntersection || util?.nearest_intersection || "").trim();
  const nearestCrossStreetRaw = String(util?.nearestCrossStreet || util?.nearest_cross_street || "").trim();
  const nearestLandmark = String(util?.nearestLandmark || util?.nearest_landmark || "").trim();
  return [
    { label: "City", value: parts.city || "Unavailable" },
    { label: "State", value: parts.state || "Unavailable" },
    { label: "Zip", value: parts.zip || "Unavailable" },
    { label: "House Number", value: parts.houseNumber || "Unavailable" },
    { label: "Street", value: parts.street || "Unavailable" },
    {
      label: "Cross Street",
      value: deriveStreetlightCrossStreet(onStreet, intersectionRaw, nearestCrossStreetRaw) || "Unavailable",
    },
    { label: "Landmark", value: nearestLandmark || "Unavailable" },
    { label: "Coordinates", value: coordsText },
  ];
}
