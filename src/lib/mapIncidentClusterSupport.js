function lightIdForClusterCoords(lat, lng) {
  return `${Number(lat).toFixed(5)}:${Number(lng).toFixed(5)}`;
}

export function uniqueLightIdsForClusterShared(light) {
  const ids = new Set();
  if (light?.lightId) ids.add(light.lightId);
  for (const row of light?.reports || []) {
    const id = row?.light_id || lightIdForClusterCoords(row?.lat, row?.lng);
    ids.add(id);
  }
  return Array.from(ids);
}
