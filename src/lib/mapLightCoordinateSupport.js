export function getCoordsForLightId(lightId, reports, officialLights) {
  const officialLight = (officialLights || []).find((row) => row.id === lightId);
  if (officialLight) return { lat: officialLight.lat, lng: officialLight.lng, isOfficial: true };

  const rows = (reports || []).filter((row) => (row.light_id || "") === lightId);
  if (!rows.length) return null;

  const avg = rows.reduce(
    (acc, row) => ({ lat: acc.lat + row.lat, lng: acc.lng + row.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: avg.lat / rows.length, lng: avg.lng / rows.length, isOfficial: false };
}
