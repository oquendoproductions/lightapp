export async function confirmMappingQueueShared(args = {}) {
  const {
    mappingQueue = [],
    sessionUserId = "",
    supabase,
    makeLightIdFromCoords,
    normalizeOfficialLightRow,
    normalizeOfficialSignRow,
    isValidLatLng,
    incidentDomainQueueItemMatchesVariant,
  } = args;

  if (!supabase) {
    return {
      ok: false,
      errorMessage: "Supabase client unavailable.",
    };
  }

  const lightRows = mappingQueue
    .filter((q) => (q?.domain || "streetlights") === "streetlights")
    .map((q) => ({
      sl_id: makeLightIdFromCoords(q.lat, q.lng),
      lat: Number(q.lat),
      lng: Number(q.lng),
      created_by: sessionUserId,
    }));

  const uniqueLightRows = lightRows.filter(
    (r, i, arr) => arr.findIndex((x) => x.sl_id === r.sl_id) === i
  );

  const signRows = mappingQueue
    .filter((q) => incidentDomainQueueItemMatchesVariant(q, "official_sign"))
    .map((q) => ({
      sign_type: String(q.sign_type || "other").trim().toLowerCase() || "other",
      lat: Number(q.lat),
      lng: Number(q.lng),
      created_by: sessionUserId,
    }));

  const uniqueSignRows = signRows.filter(
    (r, i, arr) => (
      arr.findIndex(
        (x) => (
          x.sign_type === r.sign_type
          && Math.abs(Number(x.lat) - Number(r.lat)) < 0.000001
          && Math.abs(Number(x.lng) - Number(r.lng)) < 0.000001
        )
      ) === i
    )
  );

  let insertedLights = [];
  let insertedSigns = [];
  let existingLights = [];
  let duplicateLightCount = 0;

  if (uniqueLightRows.length) {
    const slIds = uniqueLightRows.map((r) => String(r.sl_id || "").trim()).filter(Boolean);
    if (slIds.length) {
      const { data: existingData, error: existingErr } = await supabase
        .from("official_lights")
        .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
        .in("sl_id", slIds);
      if (existingErr) {
        return {
          ok: false,
          errorMessage: existingErr.message || "Could not validate mapped lights.",
          error: existingErr,
        };
      }
      existingLights = (existingData || [])
        .map(normalizeOfficialLightRow)
        .filter(Boolean);
      const existingSlSet = new Set(existingLights.map((x) => String(x?.sl_id || "").trim()).filter(Boolean));
      duplicateLightCount = existingSlSet.size;
      const rowsToInsert = uniqueLightRows.filter((r) => !existingSlSet.has(String(r.sl_id || "").trim()));
      if (rowsToInsert.length) {
        const { data, error } = await supabase
          .from("official_lights")
          .insert(rowsToInsert)
          .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark");
        if (error) {
          return {
            ok: false,
            errorMessage: error.message || "Could not save mapped lights.",
            error,
          };
        }
        insertedLights = data || [];
      }
    }
  }

  if (uniqueSignRows.length) {
    const { data, error } = await supabase
      .from("official_signs")
      .insert(uniqueSignRows)
      .select("id, sign_type, lat, lng, active");
    if (error) {
      return {
        ok: false,
        errorMessage: error.message || "Could not save mapped signs.",
        error,
      };
    }
    insertedSigns = data || [];
  }

  const cleanInsertedLights = insertedLights
    .map((r) => ({
      id: r.id,
      sl_id: r.sl_id || null,
      lat: Number(r.lat),
      lng: Number(r.lng),
      nearest_address: r.nearest_address || "",
      nearest_cross_street: r.nearest_cross_street || "",
      nearest_landmark: r.nearest_landmark || "",
    }))
    .filter((r) => r.id && isValidLatLng(r.lat, r.lng));

  const cleanExistingLights = (existingLights || [])
    .map((r) => normalizeOfficialLightRow(r))
    .filter(Boolean);

  const cleanInsertedSigns = insertedSigns
    .map((r) => normalizeOfficialSignRow(r))
    .filter(Boolean);

  return {
    ok: true,
    cleanInsertedLights,
    cleanExistingLights,
    cleanInsertedSigns,
    duplicateLightCount,
  };
}

export async function addOfficialLightShared(args = {}) {
  const {
    supabase,
    lat,
    lng,
    createdBy = null,
    makeLightIdFromCoords,
  } = args;
  const slId = makeLightIdFromCoords(lat, lng);
  const { data, error } = await supabase
    .from("official_lights")
    .insert([{
      sl_id: slId,
      lat,
      lng,
      created_by: createdBy,
    }])
    .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
    .single();

  if (error) {
    return {
      ok: false,
      error,
      errorMessage: error.message || "Couldn’t add official light.",
    };
  }

  return { ok: true, data };
}

export async function deleteOfficialLightShared(args = {}) {
  const {
    supabase,
    id,
  } = args;
  const { error } = await supabase.from("official_lights").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error,
      errorMessage: error.message || "Delete failed.",
    };
  }
  return { ok: true };
}

export async function deleteOfficialLightsByIdsShared(args = {}) {
  const {
    supabase,
    ids = [],
    chunkSize = 200,
  } = args;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { error } = await supabase.from("official_lights").delete().in("id", chunk);
    if (error) {
      return {
        ok: false,
        error,
        errorMessage: error.message || "Delete failed.",
      };
    }
  }
  return { ok: true };
}

export async function deleteOfficialSignShared(args = {}) {
  const {
    supabase,
    id,
  } = args;
  const { error } = await supabase.from("official_signs").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error,
      errorMessage: error.message || "Delete failed.",
    };
  }
  return { ok: true };
}

export async function addOfficialLightForMapShared(context = {}) {
  const {
    isAdmin = false,
    supabase,
    lat,
    lng,
    createdBy = null,
    makeLightIdFromCoords,
    normalizeOfficialLightRow,
    setOfficialLights,
    openNotice,
  } = context;

  if (!isAdmin) return;

  const tempId = `temp-${Date.now()}`;
  const optimistic = { id: tempId, sl_id: makeLightIdFromCoords(lat, lng), lat, lng };
  setOfficialLights((prev) => [...prev, optimistic]);

  const result = await addOfficialLightShared({
    supabase,
    lat,
    lng,
    createdBy,
    makeLightIdFromCoords,
  });

  if (!result?.ok) {
    console.error(result?.error);
    setOfficialLights((prev) => prev.filter((x) => x.id !== tempId));
    openNotice("⚠️", "Insert failed", result?.errorMessage || "Couldn’t add official light.");
    return;
  }

  const normalizedInsertedLight =
    typeof normalizeOfficialLightRow === "function"
      ? normalizeOfficialLightRow(result.data)
      : result.data;
  if (!normalizedInsertedLight) {
    setOfficialLights((prev) => prev.filter((x) => x.id !== tempId));
    openNotice("⚠️", "Insert failed", "Inserted light returned invalid coordinates.");
    return;
  }

  setOfficialLights((prev) => prev.map((x) => (x.id === tempId ? normalizedInsertedLight : x)));
}

export async function deleteOfficialLightForMapShared(context = {}) {
  const {
    isAdmin = false,
    supabase,
    id,
    officialLights = [],
    closeAnyPopup,
    suppressPopupsSafe,
    setOfficialLights,
    openNotice,
  } = context;

  if (!isAdmin) return;

  closeAnyPopup();
  suppressPopupsSafe(1600);

  const snapshot = [...officialLights];
  setOfficialLights((prev) => prev.filter((x) => x.id !== id));

  try {
    const result = await deleteOfficialLightShared({
      supabase,
      id,
    });

    if (!result?.ok) {
      console.error(result?.error);
      setOfficialLights(snapshot);
      openNotice("⚠️", "Couldn’t delete light", result?.errorMessage || "Delete failed.");
    }
  } catch (err) {
    console.error(err);
    setOfficialLights(snapshot);
    openNotice("⚠️", "Couldn’t delete light", "Delete failed.");
  }
}

export async function deleteOfficialLightsByIdsForMapShared(context = {}) {
  const {
    isAdmin = false,
    ids = [],
    supabase,
    closeAnyPopup,
    suppressPopupsSafe,
    setDeleteCircleConfirmOpen,
    setSaving,
    officialLights = [],
    setOfficialLights,
    selectedOfficialId = null,
    setSelectedOfficialId,
    setDeleteCircleDraft,
    openNotice,
  } = context;

  if (!isAdmin) return;
  const uniqueIds = Array.from(new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!uniqueIds.length) {
    openNotice("⚠️", "No lights selected", "No lights were found in the selected circle.");
    return;
  }

  closeAnyPopup();
  suppressPopupsSafe(1600);
  setDeleteCircleConfirmOpen(false);
  setSaving(true);

  const snapshot = [...officialLights];
  const idSet = new Set(uniqueIds);
  setOfficialLights((prev) => prev.filter((x) => !idSet.has(String(x?.id || "").trim())));
  if (selectedOfficialId && idSet.has(String(selectedOfficialId || "").trim())) {
    setSelectedOfficialId(null);
  }

  try {
    const result = await deleteOfficialLightsByIdsShared({
      supabase,
      ids: uniqueIds,
      chunkSize: 200,
    });
    if (!result?.ok) throw result?.error || new Error(result?.errorMessage || "Delete failed.");
    setDeleteCircleDraft(null);
    openNotice(
      "✅",
      "Lights deleted",
      `${uniqueIds.length} official light${uniqueIds.length === 1 ? "" : "s"} deleted.`
    );
  } catch (err) {
    console.error(err);
    setOfficialLights(snapshot);
    openNotice("⚠️", "Couldn’t delete lights", err?.message || "Delete failed.");
  } finally {
    setSaving(false);
  }
}

export async function deleteOfficialSignForMapShared(context = {}) {
  const {
    isAdmin = false,
    supabase,
    id,
    configuredIncidentSeededRowsStateByDomain,
    setConfiguredIncidentSeededRowsForDomain,
    closeAnyPopup,
    suppressPopupsSafe,
    openNotice,
  } = context;

  if (!isAdmin) return;

  closeAnyPopup();
  suppressPopupsSafe(1600);

  const snapshot = Array.isArray(configuredIncidentSeededRowsStateByDomain?.street_signs)
    ? [...configuredIncidentSeededRowsStateByDomain.street_signs]
    : [];
  setConfiguredIncidentSeededRowsForDomain("street_signs", (prev) => prev.filter((x) => x.id !== id));

  try {
    const result = await deleteOfficialSignShared({
      supabase,
      id,
    });
    if (!result?.ok) {
      console.error(result?.error);
      setConfiguredIncidentSeededRowsForDomain("street_signs", snapshot);
      openNotice("⚠️", "Couldn’t delete sign", result?.errorMessage || "Delete failed.");
    }
  } catch (err) {
    console.error(err);
    setConfiguredIncidentSeededRowsForDomain("street_signs", snapshot);
    openNotice("⚠️", "Couldn’t delete sign", "Delete failed.");
  }
}
