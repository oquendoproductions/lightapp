export async function reverseGeocodeRoadLabelShared(lat, lng, options = {}, deps = {}) {
  const fallbackLabel = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  const mode = String(options?.mode || "full").trim().toLowerCase();
  const useRoadsApi = options?.useRoadsApi === true;
  const validationOnly = options?.validationOnly === true;
  const includeLandmark = !validationOnly && mode !== "quick";
  const includeIntersection = !validationOnly && mode !== "quick";
  const includeCrossStreet = !validationOnly && mode !== "quick";

  const trace = typeof deps?.trace === "function" ? deps.trace : () => {};
  const roadHitThresholdMeters = Number.isFinite(Number(deps?.roadHitThresholdMeters))
    ? Number(deps.roadHitThresholdMeters)
    : 5;
  const gmapsActiveKey = String(deps?.gmapsActiveKey || "").trim();
  const enableLegacyPlacesService = deps?.enableLegacyPlacesService === true;
  const isGeocoderLookupTemporarilyBlocked =
    typeof deps?.isGeocoderLookupTemporarilyBlocked === "function"
      ? deps.isGeocoderLookupTemporarilyBlocked
      : () => false;
  const markGeocoderLookupBlocked =
    typeof deps?.markGeocoderLookupBlocked === "function"
      ? deps.markGeocoderLookupBlocked
      : () => {};
  const isPlacesLookupTemporarilyBlocked =
    typeof deps?.isPlacesLookupTemporarilyBlocked === "function"
      ? deps.isPlacesLookupTemporarilyBlocked
      : () => false;
  const markPlacesLookupBlocked =
    typeof deps?.markPlacesLookupBlocked === "function"
      ? deps.markPlacesLookupBlocked
      : () => {};
  const ensureGooglePlacesLibraryLoaded =
    typeof deps?.ensureGooglePlacesLibraryLoaded === "function"
      ? deps.ensureGooglePlacesLibraryLoaded
      : async () => null;
  const resolvedFetch =
    typeof deps?.fetchImpl === "function"
      ? deps.fetchImpl
      : globalThis?.fetch;
  const windowLike = deps?.windowLike || globalThis?.window;
  const roadValidationRequest =
    typeof deps?.roadValidationRequest === "function"
      ? deps.roadValidationRequest
      : null;

  const buildUnavailableResult = () => ({
    isRoad: true,
    label: fallbackLabel,
    nearestAddress: "",
    nearestStreet: "",
    nearestCrossStreet: "",
    nearestLandmark: "",
    nearestIntersection: "",
    snappedLat: lat,
    snappedLng: lng,
    distance: Infinity,
    validationUnavailable: true,
  });

  const buildNegativeRoadResult = () => ({
    isRoad: false,
    label: fallbackLabel,
    nearestAddress: "",
    nearestStreet: "",
    nearestCrossStreet: "",
    nearestLandmark: "",
    nearestIntersection: "",
    snappedLat: null,
    snappedLng: null,
    distance: Infinity,
    validationUnavailable: false,
  });

  const shouldBlockGeocoderStatus = (status) => {
    const normalized = String(status || "").trim().toUpperCase();
    return (
      normalized === "OVER_QUERY_LIMIT"
      || normalized === "REQUEST_DENIED"
      || normalized === "OVER_DAILY_LIMIT"
    );
  };

  const geocodeLookup = async (geocoder, qlat, qlng, label = "geocoder") => {
    if (isGeocoderLookupTemporarilyBlocked()) {
      trace("geocoder-blocked", { label, qlat, qlng });
      return { results: [], status: "OVER_QUERY_LIMIT", blocked: true };
    }
    trace("geocoder-request", { label, qlat, qlng });
    const res = await new Promise((resolve) => {
      geocoder.geocode({ location: { lat: qlat, lng: qlng } }, (results, status) => {
        resolve({ results: Array.isArray(results) ? results : [], status });
      });
    });
    trace("geocoder-response", {
      label,
      qlat,
      qlng,
      status: res.status,
      results: Array.isArray(res.results) ? res.results.length : 0,
    });
    if (shouldBlockGeocoderStatus(res.status)) {
      markGeocoderLookupBlocked(res.status);
      return { ...res, blocked: true };
    }
    return { ...res, blocked: false };
  };

  if (!useRoadsApi && isGeocoderLookupTemporarilyBlocked()) {
    return buildUnavailableResult();
  }

  const distanceMeters = (aLat, aLng, bLat, bLng) => {
    const R = 6371000;
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const aa =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  };

  let roadValidationCandidate = null;

  const geocodeAddressAt = async (qlat, qlng) => {
    try {
      const geocoder = new windowLike.google.maps.Geocoder();
      const res = await geocodeLookup(geocoder, qlat, qlng, "address");
      if (res.status !== "OK" || !res.results.length) return "";
      const ranked = res.results.find((r) => {
        const t = Array.isArray(r?.types) ? r.types : [];
        const comps = Array.isArray(r?.address_components) ? r.address_components : [];
        const hasStreetNo = comps.some((c) => (Array.isArray(c?.types) ? c.types : []).includes("street_number"));
        const hasRoute = comps.some((c) => (Array.isArray(c?.types) ? c.types : []).includes("route"));
        const hasPremise = comps.some((c) => {
          const ct = Array.isArray(c?.types) ? c.types : [];
          return ct.includes("premise") || ct.includes("subpremise");
        });
        return t.includes("street_address") || (hasStreetNo && hasRoute) || (hasPremise && hasRoute);
      });
      return String(ranked?.formatted_address || "").trim();
    } catch {
      return "";
    }
  };

  const lookupStreetNameAt = async (qlat, qlng) => {
    try {
      const geocoder = new windowLike.google.maps.Geocoder();
      const res = await geocodeLookup(geocoder, qlat, qlng, "street-name");
      if (res.status !== "OK" || !res.results.length) return "";
      for (const r of res.results) {
        const comps = Array.isArray(r?.address_components) ? r.address_components : [];
        const routeComp = comps.find((c) =>
          (Array.isArray(c?.types) ? c.types : []).includes("route")
        );
        const routeName = String(routeComp?.long_name || "").trim();
        if (routeName) return routeName;
      }
    } catch {
      // ignore
    }
    return "";
  };

  const lookupClosestCrossStreetAt = async (qlat, qlng, onStreetName) => {
    const normalizeRoad = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const onStreetKey = normalizeRoad(onStreetName);
    try {
      const geocoder = new windowLike.google.maps.Geocoder();
      const probeStep = 0.00045;
      const probes = [
        [qlat, qlng],
        [qlat + probeStep, qlng],
        [qlat - probeStep, qlng],
        [qlat, qlng + probeStep],
        [qlat, qlng - probeStep],
        [qlat + probeStep, qlng + probeStep],
        [qlat + probeStep, qlng - probeStep],
        [qlat - probeStep, qlng + probeStep],
        [qlat - probeStep, qlng - probeStep],
      ];
      const bestByRoute = new Map();
      for (const [plat, plng] of probes) {
        const res = await geocodeLookup(geocoder, plat, plng, "cross-street-probe");
        if (res.blocked) break;
        if (res.status !== "OK" || !res.results.length) continue;
        for (const r of res.results) {
          const rLat = Number(r?.geometry?.location?.lat?.());
          const rLng = Number(r?.geometry?.location?.lng?.());
          if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
          const comps = Array.isArray(r?.address_components) ? r.address_components : [];
          const routeComp = comps.find((c) => (Array.isArray(c?.types) ? c.types : []).includes("route"));
          const routeName = String(routeComp?.long_name || "").trim();
          if (!routeName) continue;
          const routeKey = normalizeRoad(routeName);
          if (!routeKey) continue;
          if (onStreetKey) {
            if (routeKey === onStreetKey) continue;
            if (routeKey.includes(onStreetKey) || onStreetKey.includes(routeKey)) continue;
          }
          const d = distanceMeters(qlat, qlng, rLat, rLng);
          const existing = bestByRoute.get(routeKey);
          if (!existing || d < existing.distance) {
            bestByRoute.set(routeKey, { name: routeName, distance: d });
          }
        }
      }
      const nearest = Array.from(bestByRoute.values()).sort((a, b) => a.distance - b.distance)[0];
      return String(nearest?.name || "").trim();
    } catch {
      return "";
    }
  };

  const bearingDegrees = (fromLat, fromLng, toLat, toLng) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const toDeg = (v) => (v * 180) / Math.PI;
    const phi1 = toRad(fromLat);
    const phi2 = toRad(toLat);
    const lam1 = toRad(fromLng);
    const lam2 = toRad(toLng);
    const y = Math.sin(lam2 - lam1) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  const directionFromBearing = (deg) => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const idx = Math.round((deg % 360) / 45) % 8;
    return dirs[idx];
  };

  const lookupNearestIntersectionWithDirection = async (qlat, qlng) => {
    const routeNameFromResult = (r) => {
      const comps = Array.isArray(r?.address_components) ? r.address_components : [];
      const routeComp = comps.find((c) =>
        (Array.isArray(c?.types) ? c.types : []).includes("route")
      );
      return String(routeComp?.long_name || "").trim();
    };

    const extractIntersectionRoutes = (r) => {
      const comps = Array.isArray(r?.address_components) ? r.address_components : [];
      const names = [];
      for (const c of comps) {
        const ct = Array.isArray(c?.types) ? c.types : [];
        if (!ct.includes("route")) continue;
        const nm = String(c?.long_name || "").trim();
        if (nm) names.push(nm);
      }
      return Array.from(new Set(names));
    };

    try {
      const geocoder = new windowLike.google.maps.Geocoder();
      const centerGeocode = await geocodeLookup(geocoder, qlat, qlng, "intersection-center");
      let preferredRoute = "";
      if (centerGeocode.status === "OK" && centerGeocode.results.length) {
        preferredRoute = routeNameFromResult(centerGeocode.results[0]);
      }
      const preferredRoutePoints = [];
      const routeCandidates = [];

      const probeStep = 0.00035;
      const probes = [
        [qlat, qlng],
        [qlat + probeStep, qlng],
        [qlat - probeStep, qlng],
        [qlat, qlng + probeStep],
        [qlat, qlng - probeStep],
        [qlat + probeStep, qlng + probeStep],
        [qlat + probeStep, qlng - probeStep],
        [qlat - probeStep, qlng + probeStep],
        [qlat - probeStep, qlng - probeStep],
      ];

      const candidates = [];
      for (const [plat, plng] of probes) {
        const res = await geocodeLookup(geocoder, plat, plng, "intersection-probe");
        if (res.blocked) break;
        if (res.status !== "OK" || !res.results.length) continue;
        for (const r of res.results) {
          const t = Array.isArray(r?.types) ? r.types : [];
          const rLat = Number(r?.geometry?.location?.lat?.());
          const rLng = Number(r?.geometry?.location?.lng?.());
          const comps = Array.isArray(r?.address_components) ? r.address_components : [];
          const routeComp = comps.find((c) =>
            (Array.isArray(c?.types) ? c.types : []).includes("route")
          );
          const routeName = String(routeComp?.long_name || "").trim();
          if (
            preferredRoute &&
            routeName &&
            routeName.toLowerCase() === preferredRoute.toLowerCase()
          ) {
            preferredRoutePoints.push([rLat, rLng]);
          }
          if (routeName && Number.isFinite(rLat) && Number.isFinite(rLng)) {
            routeCandidates.push({
              name: routeName,
              lat: rLat,
              lng: rLng,
              distance: distanceMeters(qlat, qlng, rLat, rLng),
            });
          }
          if (!t.includes("intersection")) continue;
          if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
          const label = String(r?.formatted_address || "").trim();
          if (!label) continue;
          candidates.push({
            label,
            lat: rLat,
            lng: rLng,
            routes: extractIntersectionRoutes(r),
            distance: distanceMeters(qlat, qlng, rLat, rLng),
          });
        }
      }

      if (candidates.length) {
        let ranked = candidates;
        if (preferredRoute) {
          const preferredKey = preferredRoute.toLowerCase();
          const matched = candidates.filter((c) =>
            (c.routes || []).some((nm) => String(nm || "").toLowerCase() === preferredKey)
          );
          if (matched.length) ranked = matched;
        }
        ranked.sort((a, b) => a.distance - b.distance);
        const nearest = ranked[0];
        if (nearest.distance <= 8) return `At ${nearest.label}`;
        const formatIntersection = (candidate) => {
          const cross = (candidate.routes || []).find(
            (nm) => String(nm || "").toLowerCase() !== String(preferredRoute || "").toLowerCase()
          );
          if (preferredRoute && cross) return `${preferredRoute} & ${cross}`;
          return candidate.label;
        };
        if (preferredRoutePoints.length >= 2) {
          let minLat = Infinity;
          let maxLat = -Infinity;
          let minLng = Infinity;
          let maxLng = -Infinity;
          for (const [plat, plng] of preferredRoutePoints) {
            if (plat < minLat) minLat = plat;
            if (plat > maxLat) maxLat = plat;
            if (plng < minLng) minLng = plng;
            if (plng > maxLng) maxLng = plng;
          }
          const midLat = (minLat + maxLat) / 2;
          const latMeters = (maxLat - minLat) * 111320;
          const lngMeters = (maxLng - minLng) * 111320 * Math.cos((midLat * Math.PI) / 180);
          const isEastWest = Math.abs(lngMeters) >= Math.abs(latMeters);

          if (preferredRoute) {
            const onRoute = ranked.filter((candidate) =>
              (candidate.routes || []).some(
                (nm) => String(nm || "").toLowerCase() === String(preferredRoute || "").toLowerCase()
              )
            );
            if (onRoute.length >= 2) {
              let nearestPos = null;
              let nearestNeg = null;
              for (const candidate of onRoute) {
                const delta = isEastWest ? qlng - candidate.lng : qlat - candidate.lat;
                if (delta >= 0) {
                  if (!nearestPos || Math.abs(delta) < Math.abs(nearestPos.delta)) {
                    nearestPos = { candidate, delta };
                  }
                } else if (!nearestNeg || Math.abs(delta) < Math.abs(nearestNeg.delta)) {
                  nearestNeg = { candidate, delta };
                }
              }
              if (nearestPos && nearestNeg) {
                return `On ${preferredRoute}, between ${formatIntersection(nearestNeg.candidate)} and ${formatIntersection(nearestPos.candidate)}`;
              }
            }
            return `On ${preferredRoute} near ${formatIntersection(nearest)}`;
          }
        }
        if (preferredRoute) {
          return `On ${preferredRoute} near ${formatIntersection(nearest)}`;
        }
        const dir = directionFromBearing(
          bearingDegrees(nearest.lat, nearest.lng, qlat, qlng)
        );
        return `${dir} of ${formatIntersection(nearest)}`;
      }
    } catch {
      // continue to route-based fallback below
    }

    try {
      const geocoder = new windowLike.google.maps.Geocoder();
      const probeStep = 0.00055;
      const probes = [
        [qlat, qlng],
        [qlat + probeStep, qlng],
        [qlat - probeStep, qlng],
        [qlat, qlng + probeStep],
        [qlat, qlng - probeStep],
        [qlat + probeStep, qlng + probeStep],
        [qlat + probeStep, qlng - probeStep],
        [qlat - probeStep, qlng + probeStep],
        [qlat - probeStep, qlng - probeStep],
      ];

      const routeHits = [];
      for (const [plat, plng] of probes) {
        const res = await geocodeLookup(geocoder, plat, plng, "intersection-route-fallback");
        if (res.blocked) break;
        if (res.status !== "OK" || !res.results.length) continue;
        for (const r of res.results) {
          const rLat = Number(r?.geometry?.location?.lat?.());
          const rLng = Number(r?.geometry?.location?.lng?.());
          if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
          const comps = Array.isArray(r?.address_components) ? r.address_components : [];
          const routeComp = comps.find((c) =>
            (Array.isArray(c?.types) ? c.types : []).includes("route")
          );
          const routeName = String(routeComp?.long_name || "").trim();
          if (!routeName) continue;
          routeHits.push({
            name: routeName,
            lat: rLat,
            lng: rLng,
            distance: distanceMeters(qlat, qlng, rLat, rLng),
          });
        }
      }

      if (!routeHits.length) return "";

      const byRoute = new Map();
      for (const hit of routeHits) {
        const key = hit.name.toLowerCase();
        const cur = byRoute.get(key);
        if (!cur || hit.distance < cur.distance) byRoute.set(key, hit);
      }
      const uniqueRoutes = Array.from(byRoute.values()).sort((a, b) => a.distance - b.distance);
      if (uniqueRoutes.length < 2) return "";

      const a = uniqueRoutes[0];
      const b = uniqueRoutes[1];
      const midpointLat = (a.lat + b.lat) / 2;
      const midpointLng = (a.lng + b.lng) / 2;
      const dir = directionFromBearing(
        bearingDegrees(midpointLat, midpointLng, qlat, qlng)
      );
      return `${dir} of ${a.name} & ${b.name}`;
    } catch {
      return "";
    }
  };

  const lookupNearestLandmark = async (qlat, qlng) => {
    const sanitizeLandmarkName = (raw) => {
      const v = String(raw || "").trim();
      if (!v) return "";
      const lower = v.toLowerCase();
      if (
        lower === "ashtabula" ||
        lower === "ohio" ||
        lower === "usa" ||
        lower === "ashtabula county" ||
        lower === "ashtabula, ohio" ||
        lower === "ashtabula, oh"
      ) {
        return "";
      }
      if (/^\d+\s*\/\s*\d+$/.test(v)) return "";
      if (/^\d+$/.test(v)) return "";
      return v;
    };
    const normalizeStreetKey = (raw) =>
      String(raw || "")
        .toLowerCase()
        .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|court|ct|lane|ln|boulevard|blvd|place|pl|terrace|ter|circle|cir|way|highway|hwy)\b/g, " ")
        .replace(/[^a-z0-9]/g, "")
        .trim();
    const extractStreetNumber = (raw) => {
      const match = String(raw || "").trim().match(/^(\d+)/);
      return match ? Number(match[1]) : Number.NaN;
    };
    const extractStreetLabel = (raw) => {
      const text = String(raw || "").trim();
      if (!text) return "";
      const parts = text.split(",");
      const first = String(parts[0] || "").trim();
      const noNumber = first.replace(/^\d+\s+/, "").trim();
      return noNumber || first;
    };
    const publicFacingTypeSet = new Set([
      "restaurant",
      "bar",
      "cafe",
      "meal_takeaway",
      "meal_delivery",
      "bakery",
      "store",
      "shopping_mall",
      "supermarket",
      "department_store",
      "convenience_store",
      "liquor_store",
      "florist",
      "gas_station",
      "car_dealer",
      "car_repair",
      "hardware_store",
      "home_goods_store",
      "pharmacy",
      "bank",
      "atm",
      "hospital",
      "school",
      "park",
      "tourist_attraction",
      "stadium",
      "museum",
      "library",
      "lodging",
    ]);
    const civicTypeSet = new Set([
      "city_hall",
      "courthouse",
      "fire_station",
      "police",
      "post_office",
      "place_of_worship",
      "transit_station",
    ]);
    const officeLikeTypeSet = new Set([
      "insurance_agency",
      "real_estate_agency",
      "accounting",
      "finance",
      "lawyer",
      "local_government_office",
    ]);
    const buildPlacesCandidateContext = (candidate, context) => {
      const candidateStreetSource =
        String(candidate?.vicinity || "").trim() ||
        String(candidate?.formattedAddress || "").trim();
      const candidateStreetLabel = extractStreetLabel(candidateStreetSource);
      const candidateStreetKey = normalizeStreetKey(candidateStreetLabel);
      const candidateStreetNumber = extractStreetNumber(candidateStreetSource);
      const isSameStreet = Boolean(
        context?.targetStreetKey &&
        candidateStreetKey &&
        context.targetStreetKey === candidateStreetKey
      );
      const streetNumberDiff =
        Number.isFinite(context?.targetStreetNumber) && Number.isFinite(candidateStreetNumber)
          ? Math.abs(candidateStreetNumber - context.targetStreetNumber)
          : Infinity;
      return {
        candidateStreetKey,
        candidateStreetNumber,
        isSameStreet,
        streetNumberDiff,
      };
    };
    const rankPlacesCandidate = (candidate, context) => {
      const types = Array.isArray(candidate?.types) ? candidate.types : [];
      const name = sanitizeLandmarkName(candidate?.name || "");
      if (!name) return Number.NEGATIVE_INFINITY;
      const distance = Number(candidate?.d);
      const candidateContext = buildPlacesCandidateContext(candidate, context);
      let score = Number.isFinite(distance) ? Math.max(0, 240 - (distance * 1.35)) : 0;
      if (String(candidate?.businessStatus || "").trim().toUpperCase() === "OPERATIONAL") score += 10;

      if (candidateContext.isSameStreet) {
        score += 80;
        if (Number.isFinite(candidateContext.streetNumberDiff)) {
          const diff = candidateContext.streetNumberDiff;
          if (diff <= 2) score += 160;
          else if (diff <= 6) score += 120;
          else if (diff <= 15) score += 70;
          else if (diff <= 30) score += 25;
        }
      }

      if (types.some((type) => publicFacingTypeSet.has(type))) score += 130;
      if (types.some((type) => civicTypeSet.has(type))) score += 110;
      if (types.some((type) => officeLikeTypeSet.has(type))) score -= 25;

      if (Number.isFinite(distance)) {
        if (distance <= 25) score += 160;
        else if (distance <= 50) score += 110;
        else if (distance <= 90) score += 55;
        else if (distance > 150) score -= 80;
        else if (distance > 225) score -= 180;
      }

      if (/\b(associates|association|llc|inc|ltd|financial|accounting|attorney|law office|law offices)\b/i.test(name)) {
        score -= 15;
      }
      if (/\b(grill|bar|cafe|restaurant|park|hospital|school|bank|pharmacy|museum|library|church)\b/i.test(name)) {
        score += 20;
      }

      return score;
    };
    const extractLandmarkCandidate = (result) => {
      const types = Array.isArray(result?.types) ? result.types : [];
      const comps = Array.isArray(result?.address_components) ? result.address_components : [];
      const interestingTypeSet = new Set([
        "establishment",
        "point_of_interest",
        "premise",
        "subpremise",
        "park",
        "school",
        "shopping_mall",
        "tourist_attraction",
        "place_of_worship",
        "transit_station",
        "natural_feature",
      ]);
      const namedComp = comps.find((c) => {
        const ct = Array.isArray(c?.types) ? c.types : [];
        return ct.some((type) => interestingTypeSet.has(type));
      });
      const compName = sanitizeLandmarkName(namedComp?.long_name || "");
      if (compName && !/^\d+\s/.test(compName)) return compName;
      if (types.some((type) => interestingTypeSet.has(type))) {
        const formatted = String(result?.formatted_address || "").trim();
        const firstChunk = sanitizeLandmarkName(formatted.split(",")[0] || "");
        if (firstChunk && !/^\d+\s/.test(firstChunk)) return firstChunk;
      }
      return "";
    };

    try {
      let landmarkContext = null;
      if (enableLegacyPlacesService && !isPlacesLookupTemporarilyBlocked()) {
        const placesNS = await ensureGooglePlacesLibraryLoaded();
        if (placesNS?.PlacesService) {
          const service = new placesNS.PlacesService(document.createElement("div"));
          if (!landmarkContext) {
            const [targetStreetRaw, targetAddressRaw] = await Promise.all([
              lookupStreetNameAt(qlat, qlng),
              geocodeAddressAt(qlat, qlng),
            ]);
            landmarkContext = {
              targetStreetKey: normalizeStreetKey(targetStreetRaw || extractStreetLabel(targetAddressRaw)),
              targetStreetNumber: extractStreetNumber(targetAddressRaw),
            };
          }

          const nearbyByType = async (type) =>
            new Promise((resolve) => {
              service.nearbySearch(
                {
                  location: { lat: qlat, lng: qlng },
                  radius: 305,
                  type,
                },
                (results, status) => {
                  const blocked =
                    status === placesNS.PlacesServiceStatus.REQUEST_DENIED;
                  if (blocked) {
                    markPlacesLookupBlocked("REQUEST_DENIED");
                  }
                  resolve({
                    results: Array.isArray(results) ? results : [],
                    ok:
                      status === placesNS.PlacesServiceStatus.OK ||
                      status === placesNS.PlacesServiceStatus.ZERO_RESULTS,
                    blocked,
                  });
                }
              );
            });

          const candidates = [];
          let legacyLookupBlocked = false;
          for (const type of ["establishment", "point_of_interest"]) {
            const res = await nearbyByType(type);
            if (res?.blocked) {
              legacyLookupBlocked = true;
              break;
            }
            if (!res.ok || !res.results.length) continue;
            for (const r of res.results) {
              const nm = String(r?.name || "").trim();
              const rLat = Number(r?.geometry?.location?.lat?.());
              const rLng = Number(r?.geometry?.location?.lng?.());
              if (!nm || !Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
              candidates.push({
                name: nm,
                d: distanceMeters(qlat, qlng, rLat, rLng),
                types: Array.isArray(r?.types) ? r.types : [],
                vicinity: String(r?.vicinity || "").trim(),
                formattedAddress: String(r?.formatted_address || "").trim(),
                businessStatus: String(r?.business_status || "").trim(),
              });
            }
            if (candidates.length) break;
          }

          if (candidates.length) {
            const closestDistance = candidates.reduce((min, candidate) => {
              const distance = Number(candidate?.d);
              return Number.isFinite(distance) ? Math.min(min, distance) : min;
            }, Infinity);
            const proximityShortlist = candidates.filter((candidate) => {
              const distance = Number(candidate?.d);
              if (!Number.isFinite(distance)) return false;
              const candidateContext = buildPlacesCandidateContext(candidate, landmarkContext);
              if (distance <= 70) return true;
              if (distance <= closestDistance + 45) return true;
              return candidateContext.isSameStreet && candidateContext.streetNumberDiff <= 20 && distance <= 140;
            });
            const rankedCandidates = (proximityShortlist.length ? proximityShortlist : candidates).slice();
            rankedCandidates.sort((a, b) => {
              const scoreDiff = rankPlacesCandidate(b, landmarkContext) - rankPlacesCandidate(a, landmarkContext);
              if (scoreDiff !== 0) return scoreDiff;
              return Number(a.d || Infinity) - Number(b.d || Infinity);
            });
            return sanitizeLandmarkName(rankedCandidates[0]?.name || "");
          }

          if (!legacyLookupBlocked) {
            const byDistance = await new Promise((resolve) => {
              service.nearbySearch(
                {
                  location: { lat: qlat, lng: qlng },
                  rankBy: placesNS.RankBy.DISTANCE,
                  type: "establishment",
                },
                (results, status) => {
                  const blocked =
                    status === placesNS.PlacesServiceStatus.REQUEST_DENIED;
                  if (blocked) {
                    markPlacesLookupBlocked("REQUEST_DENIED");
                  }
                  resolve({
                    results: Array.isArray(results) ? results : [],
                    ok:
                      status === placesNS.PlacesServiceStatus.OK ||
                      status === placesNS.PlacesServiceStatus.ZERO_RESULTS,
                    blocked,
                  });
                }
              );
            });
            if (byDistance?.ok && byDistance.results.length) {
              const ranked = byDistance.results
                .map((r) => {
                  const rLat = Number(r?.geometry?.location?.lat?.());
                  const rLng = Number(r?.geometry?.location?.lng?.());
                  return {
                    name: sanitizeLandmarkName(r?.name || ""),
                    d: Number.isFinite(rLat) && Number.isFinite(rLng)
                      ? distanceMeters(qlat, qlng, rLat, rLng)
                      : Infinity,
                    types: Array.isArray(r?.types) ? r.types : [],
                    vicinity: String(r?.vicinity || "").trim(),
                    formattedAddress: String(r?.formatted_address || "").trim(),
                    businessStatus: String(r?.business_status || "").trim(),
                  };
                })
                .filter((r) => r.name);
              const closestDistance = ranked.reduce((min, candidate) => {
                const distance = Number(candidate?.d);
                return Number.isFinite(distance) ? Math.min(min, distance) : min;
              }, Infinity);
              const proximityShortlist = ranked.filter((candidate) => {
                const distance = Number(candidate?.d);
                if (!Number.isFinite(distance)) return false;
                const candidateContext = buildPlacesCandidateContext(candidate, landmarkContext);
                if (distance <= 70) return true;
                if (distance <= closestDistance + 45) return true;
                return candidateContext.isSameStreet && candidateContext.streetNumberDiff <= 20 && distance <= 140;
              });
              const shortlist = proximityShortlist.length ? proximityShortlist : ranked;
              shortlist.sort((a, b) => {
                const scoreDiff = rankPlacesCandidate(b, landmarkContext) - rankPlacesCandidate(a, landmarkContext);
                if (scoreDiff !== 0) return scoreDiff;
                return Number(a.d || Infinity) - Number(b.d || Infinity);
              });
              if (shortlist.length) {
                return shortlist[0].name;
              }
            }
          }
        }
      }

      const geocoder = new windowLike.google.maps.Geocoder();
      const probeStep = 0.00035;
      const probes = [
        [qlat, qlng],
        [qlat + probeStep, qlng],
        [qlat - probeStep, qlng],
        [qlat, qlng + probeStep],
        [qlat, qlng - probeStep],
        [qlat + probeStep, qlng + probeStep],
        [qlat + probeStep, qlng - probeStep],
        [qlat - probeStep, qlng + probeStep],
        [qlat - probeStep, qlng - probeStep],
      ];
      const candidateByName = new Map();
      for (const [plat, plng] of probes) {
        const geo = await geocodeLookup(geocoder, plat, plng, "landmark-geocoder-probe");
        if (geo.blocked) break;
        if (geo.status !== "OK" || !geo.results.length) continue;
        for (const result of geo.results) {
          const candidate = extractLandmarkCandidate(result);
          if (!candidate) continue;
          const rLat = Number(result?.geometry?.location?.lat?.());
          const rLng = Number(result?.geometry?.location?.lng?.());
          const distance = Number.isFinite(rLat) && Number.isFinite(rLng)
            ? distanceMeters(qlat, qlng, rLat, rLng)
            : distanceMeters(qlat, qlng, plat, plng);
          const key = candidate.toLowerCase();
          const existing = candidateByName.get(key);
          if (!existing || distance < existing.distance) {
            candidateByName.set(key, { name: candidate, distance });
          }
        }
      }
      if (candidateByName.size) {
        return Array.from(candidateByName.values()).sort((a, b) => a.distance - b.distance)[0]?.name || "";
      }
      return "";
    } catch (error) {
      const msg = String(error?.message || error || "").toLowerCase();
      if (
        msg.includes("apitargetblockedmaperror") ||
        msg.includes("request_denied") ||
        msg.includes("not authorized to use this service or api")
      ) {
        markPlacesLookupBlocked(msg);
      }
      return "";
    }
  };

  if (useRoadsApi) {
    try {
      if (!roadValidationRequest && (!gmapsActiveKey || typeof resolvedFetch !== "function")) {
        return buildUnavailableResult();
      }
      let json = null;
      if (roadValidationRequest) {
        trace("road-validation-function-request", { lat, lng });
        json = await roadValidationRequest(lat, lng);
        trace("road-validation-function-response", {
          ok: json?.ok === true,
          results: Array.isArray(json?.snappedPoints) ? json.snappedPoints.length : 0,
        });
        if (json?.ok !== true) return buildUnavailableResult();
      } else {
        const points = `${lat},${lng}`;
        trace("roads-request", { lat, lng });
        const resp = await resolvedFetch(
          `https://roads.googleapis.com/v1/nearestRoads?points=${encodeURIComponent(points)}&key=${encodeURIComponent(gmapsActiveKey)}`
        );
        trace("roads-response", { ok: resp.ok, status: resp.status });
        if (!resp.ok) return buildUnavailableResult();
        json = await resp.json();
      }
      const snapped = Array.isArray(json?.snappedPoints) ? json.snappedPoints : [];
      if (snapped.length) {
        let best = null;
        for (const sp of snapped) {
          const slat = Number(sp?.location?.latitude);
          const slng = Number(sp?.location?.longitude);
          if (!Number.isFinite(slat) || !Number.isFinite(slng)) continue;
          const dMeters = distanceMeters(lat, lng, slat, slng);
          if (!best || dMeters < best.distance) best = { lat: slat, lng: slng, distance: dMeters };
        }
        if (best) {
          const isRoad = best.distance <= roadHitThresholdMeters;
          if (validationOnly) {
            trace("roads-validation-result", {
              isRoad,
              distance: best.distance,
              threshold: roadHitThresholdMeters,
              snappedLat: best.lat,
              snappedLng: best.lng,
            });
            return {
              isRoad,
              label: fallbackLabel,
              nearestAddress: "",
              nearestStreet: "",
              nearestCrossStreet: "",
              nearestLandmark: "",
              nearestIntersection: "",
              snappedLat: best.lat,
              snappedLng: best.lng,
              distance: best.distance,
              validationUnavailable: false,
            };
          }
          const [nearestAddressRaw, nearestStreetRaw, nearestLandmarkRaw, nearestIntersectionRaw] = await Promise.all([
            geocodeAddressAt(best.lat, best.lng),
            includeCrossStreet ? lookupStreetNameAt(best.lat, best.lng) : Promise.resolve(""),
            includeLandmark ? lookupNearestLandmark(best.lat, best.lng) : Promise.resolve(""),
            includeIntersection ? lookupNearestIntersectionWithDirection(best.lat, best.lng) : Promise.resolve(""),
          ]);
          const nearestAddress = String(nearestAddressRaw || "").trim();
          const nearestStreet = String(nearestStreetRaw || "").trim();
          const nearestCrossStreet = includeCrossStreet
            ? ((await lookupClosestCrossStreetAt(best.lat, best.lng, nearestStreet)) || "")
            : "";
          const nearestLandmark = String(nearestLandmarkRaw || "").trim();
          const nearestIntersection = String(nearestIntersectionRaw || "").trim();
          roadValidationCandidate = {
            isRoad,
            label: nearestAddress || fallbackLabel,
            nearestAddress,
            nearestStreet,
            nearestCrossStreet,
            nearestLandmark,
            nearestIntersection,
            snappedLat: best.lat,
            snappedLng: best.lng,
            distance: best.distance,
            validationUnavailable: false,
          };
          trace("roads-enrichment-result", {
            isRoad,
            distance: best.distance,
            threshold: roadHitThresholdMeters,
          });
          if (isRoad) return roadValidationCandidate;
        }
      }
    } catch {
      trace("roads-error");
      return roadValidationCandidate || buildUnavailableResult();
    }
    if (validationOnly) {
      trace("roads-validation-negative", roadValidationCandidate || { distance: Infinity, threshold: roadHitThresholdMeters });
      return roadValidationCandidate || buildNegativeRoadResult();
    }
  }

  if (validationOnly) {
    trace("validation-skip-geocoder-fallback", roadValidationCandidate || { distance: Infinity, threshold: roadHitThresholdMeters });
    return roadValidationCandidate || buildNegativeRoadResult();
  }

  try {
    const geocoder = new windowLike.google.maps.Geocoder();
    const geocodeOnce = (qlat, qlng) =>
      geocodeLookup(geocoder, qlat, qlng, "road-fallback-probe");

    const isRoadLikeResult = (result) => {
      const types = Array.isArray(result?.types) ? result.types : [];
      if (
        types.includes("route") ||
        types.includes("street_address") ||
        types.includes("intersection") ||
        types.includes("range_interpolated")
      ) {
        return true;
      }
      const comps = Array.isArray(result?.address_components) ? result.address_components : [];
      return comps.some((c) => {
        const ct = Array.isArray(c?.types) ? c.types : [];
        return ct.includes("route");
      });
    };

    const probes = [
      [lat, lng],
      [lat + 0.0001, lng],
      [lat - 0.0001, lng],
      [lat, lng + 0.0001],
      [lat, lng - 0.0001],
    ];

    let best = null;
    let bestLabel = "";
    let gotAnyResults = false;

    for (const [plat, plng] of probes) {
      const { results, status } = await geocodeOnce(plat, plng);
      if (shouldBlockGeocoderStatus(status)) break;
      if (status !== "OK" || !results.length) continue;
      gotAnyResults = true;
      for (const result of results) {
        if (!isRoadLikeResult(result)) continue;
        const rLat = Number(result?.geometry?.location?.lat?.());
        const rLng = Number(result?.geometry?.location?.lng?.());
        if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
        const dMeters = distanceMeters(lat, lng, rLat, rLng);
        if (!best || dMeters < best.distance) {
          best = { lat: rLat, lng: rLng, distance: dMeters };
          const maybe = String(result?.formatted_address || "").trim();
          if (maybe) bestLabel = maybe;
        }
      }
    }

    if (best) {
      const [nearestStreetRaw, nearestLandmarkRaw, nearestIntersectionRaw] = await Promise.all([
        includeCrossStreet ? lookupStreetNameAt(best.lat, best.lng) : Promise.resolve(""),
        includeLandmark ? lookupNearestLandmark(best.lat, best.lng) : Promise.resolve(""),
        includeIntersection ? lookupNearestIntersectionWithDirection(best.lat, best.lng) : Promise.resolve(""),
      ]);
      const nearestAddress = bestLabel || "";
      const nearestStreet = String(nearestStreetRaw || "").trim();
      const nearestCrossStreet = includeCrossStreet
        ? ((await lookupClosestCrossStreetAt(best.lat, best.lng, nearestStreet)) || "")
        : "";
      const nearestLandmark = String(nearestLandmarkRaw || "").trim();
      const nearestIntersection = String(nearestIntersectionRaw || "").trim();
      const geocoderCandidate = {
        isRoad: best.distance <= roadHitThresholdMeters,
        label: nearestAddress || fallbackLabel,
        nearestAddress,
        nearestStreet,
        nearestCrossStreet,
        nearestLandmark,
        nearestIntersection,
        snappedLat: best.lat,
        snappedLng: best.lng,
        distance: best.distance,
        validationUnavailable: false,
      };
      trace("geocoder-fallback-result", {
        isRoad: geocoderCandidate.isRoad,
        distance: geocoderCandidate.distance,
        threshold: roadHitThresholdMeters,
      });
      if (geocoderCandidate.isRoad) return geocoderCandidate;
      if (!roadValidationCandidate || geocoderCandidate.distance < roadValidationCandidate.distance) {
        roadValidationCandidate = geocoderCandidate;
      }
    }

    if (gotAnyResults) {
      if (roadValidationCandidate) return roadValidationCandidate;
      const [nearestStreetRaw, nearestLandmarkRaw, nearestIntersectionRaw] = await Promise.all([
        includeCrossStreet ? lookupStreetNameAt(lat, lng) : Promise.resolve(""),
        includeLandmark ? lookupNearestLandmark(lat, lng) : Promise.resolve(""),
        includeIntersection ? lookupNearestIntersectionWithDirection(lat, lng) : Promise.resolve(""),
      ]);
      const nearestAddress = bestLabel || "";
      const nearestStreet = String(nearestStreetRaw || "").trim();
      const nearestCrossStreet = includeCrossStreet
        ? ((await lookupClosestCrossStreetAt(lat, lng, nearestStreet)) || "")
        : "";
      const nearestLandmark = String(nearestLandmarkRaw || "").trim();
      const nearestIntersection = String(nearestIntersectionRaw || "").trim();
      trace("geocoder-fallback-negative", { threshold: roadHitThresholdMeters });
      return {
        isRoad: false,
        label: nearestAddress || fallbackLabel,
        nearestAddress,
        nearestStreet,
        nearestCrossStreet,
        nearestLandmark,
        nearestIntersection,
        snappedLat: null,
        snappedLng: null,
        distance: Infinity,
        validationUnavailable: false,
      };
    }
  } catch {
    trace("geocoder-fallback-error");
  }

  if (roadValidationCandidate) {
    trace("return-road-validation-candidate", {
      isRoad: roadValidationCandidate.isRoad,
      distance: roadValidationCandidate.distance,
    });
    return roadValidationCandidate;
  }

  trace("return-unavailable");
  return buildUnavailableResult();
}

function lookupCooldownMsForReason(reason = "", fallbackMs = 120000) {
  const normalized = String(reason || "").trim().toUpperCase();
  if (normalized === "OVER_DAILY_LIMIT") return 15 * 60 * 1000;
  if (normalized === "REQUEST_DENIED") return 10 * 60 * 1000;
  if (normalized === "OVER_QUERY_LIMIT") return 2 * 60 * 1000;
  return fallbackMs;
}

export async function reverseGeocodeRoadLabelRuntimeShared(
  lat,
  lng,
  options = {},
  state = {},
  deps = {}
) {
  const mode = String(options?.mode || "full").trim().toLowerCase();
  const useRoadsApi = options?.useRoadsApi === true;
  const validationOnly = options?.validationOnly === true;
  const debugSource = String(options?.debugSource || "unspecified").trim() || "unspecified";

  const nextTraceId =
    typeof deps?.nextTraceId === "function"
      ? deps.nextTraceId
      : (() => 1);
  const traceId = nextTraceId();
  const trace = (event, details = null) => {
    try {
      if (details && typeof details === "object") {
        console.warn(`[geo-trace:${traceId}] ${debugSource} :: ${event}`, details);
      } else {
        console.warn(`[geo-trace:${traceId}] ${debugSource} :: ${event}`);
      }
    } catch {
      // ignore logging failures
    }
  };

  const reverseGeocodeInFlightMap =
    state?.reverseGeocodeInFlightMap instanceof Map
      ? state.reverseGeocodeInFlightMap
      : new Map();
  const placesLookupBlockedUntilRef = state?.placesLookupBlockedUntilRef || { current: 0 };
  const placesBlockedNoticeShownRef = state?.placesBlockedNoticeShownRef || { current: false };
  const placesLibraryLoadPromiseRef = state?.placesLibraryLoadPromiseRef || { current: null };
  const geocoderLookupBlockedUntilRef = state?.geocoderLookupBlockedUntilRef || { current: 0 };
  const geocoderBlockedNoticeShownRef = state?.geocoderBlockedNoticeShownRef || { current: false };
  const isAdmin = deps?.isAdmin === true;
  const openConfiguredNotice =
    typeof deps?.openConfiguredNotice === "function"
      ? deps.openConfiguredNotice
      : () => {};
  const windowLike = deps?.windowLike || globalThis?.window;

  const isPlacesLookupTemporarilyBlocked = () =>
    Date.now() < Number(placesLookupBlockedUntilRef.current || 0);

  const isGeocoderLookupTemporarilyBlocked = () =>
    Date.now() < Number(geocoderLookupBlockedUntilRef.current || 0);

  const markPlacesLookupBlocked = (reason = "") => {
    const msg = String(reason || "").trim();
    const cooldownMs = lookupCooldownMsForReason(msg, 10 * 60 * 1000);
    const blockedUntil = Date.now() + cooldownMs;
    if (blockedUntil > Number(placesLookupBlockedUntilRef.current || 0)) {
      placesLookupBlockedUntilRef.current = blockedUntil;
    }
    console.warn("[places] landmark lookups paused temporarily:", msg || "unknown");
    if (isAdmin && !placesBlockedNoticeShownRef.current) {
      placesBlockedNoticeShownRef.current = true;
      openConfiguredNotice("landmark_details_unavailable", {
        icon: "ℹ️",
        title: "Landmark details temporarily unavailable",
        message: "Closest landmark details are temporarily unavailable right now. Reporting still works normally.",
      });
    }
  };

  const markGeocoderLookupBlocked = (reason = "") => {
    const msg = String(reason || "").trim();
    const cooldownMs = lookupCooldownMsForReason(msg);
    const blockedUntil = Date.now() + cooldownMs;
    if (blockedUntil > Number(geocoderLookupBlockedUntilRef.current || 0)) {
      geocoderLookupBlockedUntilRef.current = blockedUntil;
    }
    console.warn("[geocoder] reverse-geocode lookups paused temporarily:", msg || "unknown");
    if (isAdmin && !geocoderBlockedNoticeShownRef.current) {
      geocoderBlockedNoticeShownRef.current = true;
      openConfiguredNotice("location_details_unavailable", {
        icon: "ℹ️",
        title: "Location details temporarily unavailable",
        message:
          "Street addresses and nearby place names are temporarily unavailable right now. Reporting still works normally, and any saved location details will still appear.",
      });
    }
  };

  const ensureGooglePlacesLibraryLoaded = async () => {
    const mapsNS = windowLike?.google?.maps;
    if (!mapsNS) return null;
    if (mapsNS.places?.PlacesService) return mapsNS.places;
    if (typeof mapsNS.importLibrary !== "function") {
      return mapsNS.places || null;
    }
    if (!placesLibraryLoadPromiseRef.current) {
      placesLibraryLoadPromiseRef.current = mapsNS
        .importLibrary("places")
        .then(() => windowLike?.google?.maps?.places || null)
        .catch((error) => {
          console.warn("[places] lazy import failed:", error?.message || error);
          placesLibraryLoadPromiseRef.current = null;
          return null;
        });
    }
    return placesLibraryLoadPromiseRef.current;
  };

  const suppliedRoadValidationRequest = typeof deps?.roadValidationRequest === "function"
    ? deps.roadValidationRequest
    : null;
  const roadValidationFunctionUrl = String(deps?.roadValidationFunctionUrl || "").trim();
  const roadValidationPublishableKey = String(deps?.roadValidationPublishableKey || "").trim();
  const roadValidationTenantKey = String(deps?.roadValidationTenantKey || "").trim().toLowerCase();
  const roadValidationTimeoutMs = Math.max(1000, Number(deps?.roadValidationTimeoutMs || 30000));
  const directRoadValidationRequest = (
    useRoadsApi
    && typeof deps?.fetchImpl === "function"
    && roadValidationFunctionUrl
    && roadValidationPublishableKey
    && roadValidationTenantKey
  )
    ? async (requestLat, requestLng) => {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timeoutId = controller
          ? setTimeout(() => controller.abort(), roadValidationTimeoutMs)
          : null;
        try {
          const response = await deps.fetchImpl(roadValidationFunctionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: roadValidationPublishableKey,
              Authorization: `Bearer ${roadValidationPublishableKey}`,
              "x-tenant-key": roadValidationTenantKey,
            },
            body: JSON.stringify({
              tenant_key: roadValidationTenantKey,
              lat: requestLat,
              lng: requestLng,
            }),
            ...(controller ? { signal: controller.signal } : {}),
          });
          if (!response.ok) {
            const responseText = typeof response.text === "function"
              ? await response.text().catch(() => "")
              : "";
            console.warn("[road-validation] function request failed", {
              status: response.status,
              tenantKey: roadValidationTenantKey,
              response: responseText.slice(0, 500),
            });
            return null;
          }
          return response.json();
        } catch (error) {
          console.warn("[road-validation] function request unavailable", {
            tenantKey: roadValidationTenantKey,
            error: String(error?.message || error || "unknown"),
          });
          return null;
        } finally {
          if (timeoutId !== null) clearTimeout(timeoutId);
        }
      }
    : null;
  const roadValidationRequest = useRoadsApi && (suppliedRoadValidationRequest || directRoadValidationRequest)
    ? async (requestLat, requestLng) => {
        if (suppliedRoadValidationRequest) {
          try {
            const suppliedResult = await suppliedRoadValidationRequest(requestLat, requestLng);
            if (suppliedResult?.ok === true) return suppliedResult;
          } catch (error) {
            console.warn("[road-validation] scoped function invoke unavailable", {
              tenantKey: roadValidationTenantKey,
              error: String(error?.message || error || "unknown"),
            });
          }
        }
        return directRoadValidationRequest?.(requestLat, requestLng) || null;
      }
    : null;

  const lookupKey = [
    mode,
    useRoadsApi ? "roads" : "geo",
    validationOnly ? "validate" : "enrich",
    Number(lat).toFixed(5),
    Number(lng).toFixed(5),
  ].join("|");
  const inFlightLookup = reverseGeocodeInFlightMap.get(lookupKey);
  if (inFlightLookup) {
    trace("reuse-inflight", { lookupKey, lat, lng, mode, useRoadsApi, validationOnly });
    return inFlightLookup;
  }

  const lookupPromise = (async () => {
    trace("start", { lookupKey, lat, lng, mode, useRoadsApi, validationOnly });
    return reverseGeocodeRoadLabelShared(lat, lng, options, {
      trace,
      roadHitThresholdMeters: deps?.roadHitThresholdMeters,
      gmapsActiveKey: deps?.gmapsActiveKey,
      roadValidationRequest,
      enableLegacyPlacesService: deps?.enableLegacyPlacesService,
      isGeocoderLookupTemporarilyBlocked,
      markGeocoderLookupBlocked,
      isPlacesLookupTemporarilyBlocked,
      markPlacesLookupBlocked,
      ensureGooglePlacesLibraryLoaded,
      fetchImpl: deps?.fetchImpl,
      windowLike,
    });
  })();

  reverseGeocodeInFlightMap.set(lookupKey, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    if (reverseGeocodeInFlightMap.get(lookupKey) === lookupPromise) {
      reverseGeocodeInFlightMap.delete(lookupKey);
    }
  }
}

export function requestCurrentPositionReliableRuntimeShared(options = {}, deps = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 12000,
    maximumAge = 0,
  } = options || {};

  const isNativeAppRuntime =
    typeof deps?.isNativeAppRuntime === "function"
      ? deps.isNativeAppRuntime
      : () => false;
  const loadCapacitorGeolocationModule =
    typeof deps?.loadCapacitorGeolocationModule === "function"
      ? deps.loadCapacitorGeolocationModule
      : async () => ({ Geolocation: null });
  const navigatorLike = deps?.navigatorLike || globalThis?.navigator;
  const setTimeoutImpl =
    typeof deps?.setTimeoutImpl === "function"
      ? deps.setTimeoutImpl
      : globalThis?.setTimeout;
  const clearTimeoutImpl =
    typeof deps?.clearTimeoutImpl === "function"
      ? deps.clearTimeoutImpl
      : globalThis?.clearTimeout;

  return new Promise((resolve, reject) => {
    if (isNativeAppRuntime()) {
      let timeoutId = null;
      const rejectOnce = (err) => {
        if (timeoutId) {
          clearTimeoutImpl?.(timeoutId);
          timeoutId = null;
        }
        reject(err);
      };
      timeoutId = setTimeoutImpl?.(() => {
        rejectOnce({ code: 3, message: "Location request timed out." });
      }, Math.max(2000, timeout + 2000));
      loadCapacitorGeolocationModule()
        .then(({ Geolocation }) =>
          Geolocation.getCurrentPosition({
            enableHighAccuracy,
            timeout,
            maximumAge,
          })
        )
        .then((pos) => {
          if (timeoutId) {
            clearTimeoutImpl?.(timeoutId);
            timeoutId = null;
          }
          resolve(pos);
        })
        .catch((err) => {
          rejectOnce(err);
        });
      return;
    }

    if (!navigatorLike?.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    let settled = false;
    let watchId = null;
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeoutImpl?.(timeoutId);
        timeoutId = null;
      }
      if (watchId != null) {
        try {
          navigatorLike.geolocation.clearWatch(watchId);
        } catch {
          // ignore cleanup failures
        }
        watchId = null;
      }
    };

    const resolveOnce = (pos) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(pos);
    };

    const rejectOnce = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    timeoutId = setTimeoutImpl?.(() => {
      rejectOnce({ code: 3, message: "Location request timed out." });
    }, Math.max(2000, timeout + 2000));

    try {
      watchId = navigatorLike.geolocation.watchPosition(
        resolveOnce,
        (err) => {
          if (Number(err?.code) === 1) rejectOnce(err);
        },
        {
          enableHighAccuracy,
          maximumAge,
          timeout,
        }
      );
    } catch {
      watchId = null;
    }

    try {
      navigatorLike.geolocation.getCurrentPosition(
        resolveOnce,
        rejectOnce,
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      );
    } catch (err) {
      rejectOnce(err);
    }
  });
}

export async function findMyLocationRuntimeShared(
  force = false,
  state = {},
  deps = {}
) {
  const isNativeAppRuntime =
    typeof deps?.isNativeAppRuntime === "function"
      ? deps.isNativeAppRuntime
      : () => false;
  const openNotice =
    typeof deps?.openNotice === "function"
      ? deps.openNotice
      : () => {};
  const loadCapacitorGeolocationModule =
    typeof deps?.loadCapacitorGeolocationModule === "function"
      ? deps.loadCapacitorGeolocationModule
      : async () => ({ Geolocation: null });
  const requestCurrentPositionReliable =
    typeof deps?.requestCurrentPositionReliable === "function"
      ? deps.requestCurrentPositionReliable
      : async () => null;
  const applyLocatedPosition =
    typeof deps?.applyLocatedPosition === "function"
      ? deps.applyLocatedPosition
      : () => {};
  const setGeoDeniedPersist =
    typeof deps?.setGeoDeniedPersist === "function"
      ? deps.setGeoDeniedPersist
      : () => {};
  const setLocating =
    typeof deps?.setLocating === "function"
      ? deps.setLocating
      : () => {};

  const geoDenied = state?.geoDenied === true;
  const followHeadingEnabledRef = state?.followHeadingEnabledRef || { current: false };
  const navigatorLike = deps?.navigatorLike || globalThis?.navigator;
  const windowLike = deps?.windowLike || globalThis?.window;

  if (!isNativeAppRuntime() && !windowLike?.isSecureContext) {
    openNotice("⚠️", "Needs HTTPS", "Location requires HTTPS. Use your ngrok HTTPS URL when testing.");
    return;
  }

  if (!isNativeAppRuntime() && !navigatorLike?.geolocation) {
    openNotice("⚠️", "Location unavailable", "Location is not available on this device.");
    return;
  }

  if (geoDenied && !force) {
    openNotice("⚠️", "Location denied", "Turn on Location Services for CityReport in your device settings.");
    return;
  }

  try {
    if (isNativeAppRuntime()) {
      const { Geolocation } = await loadCapacitorGeolocationModule();
      const status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        const requested = await Geolocation.requestPermissions({ permissions: ["location"] });
        if (requested.location !== "granted") {
          setGeoDeniedPersist(true);
          openNotice("⚠️", "Location denied", "Unable to access location. You can still pan and tap the map.");
          return;
        }
      }
      if (geoDenied) setGeoDeniedPersist(false);
    } else if (navigatorLike?.permissions?.query) {
      const status = await navigatorLike.permissions.query({ name: "geolocation" });

      if (status.state === "denied" && !force) {
        setGeoDeniedPersist(true);
        openNotice("⚠️", "Location denied", "Turn on Location Services for CityReport in your browser or device settings.");
        return;
      }

      if (status.state === "granted" && geoDenied) {
        setGeoDeniedPersist(false);
      }
    }
  } catch (err) {
    const msg = String(err?.message || err || "").toLowerCase();
    if (msg.includes("disabled") || msg.includes("location services")) {
      openNotice("⚠️", "Location disabled", "Turn on Location Services for CityReport in your device settings.");
      return;
    }
  }

  setLocating(true);
  followHeadingEnabledRef.current = true;

  try {
    const pos = await requestCurrentPositionReliable({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
    await applyLocatedPosition(pos);
    if (geoDenied) setGeoDeniedPersist(false);
  } catch (err) {
    const code = Number(err?.code);
    if (code === 1) {
      setGeoDeniedPersist(true);
      openNotice("⚠️", "Location denied", "Unable to access location. You can still pan and tap the map.");
      return;
    }

    setGeoDeniedPersist(false);

    if (code === 3) {
      try {
        const fallbackPos = await requestCurrentPositionReliable({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 10000,
        });
        await applyLocatedPosition(fallbackPos);
        return;
      } catch {
        openNotice("⚠️", "Location timeout", "Couldn’t get GPS quickly. Try again in a clearer area.");
        return;
      }
    }

    if (code === 2) {
      try {
        const fallbackPos = await requestCurrentPositionReliable({
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 30000,
        });
        await applyLocatedPosition(fallbackPos);
        return;
      } catch {
        openNotice("⚠️", "Location unavailable", "Your device could not determine location right now.");
        return;
      }
    }

    const msg = String(err?.message || err || "").toLowerCase();
    if (msg.includes("disabled") || msg.includes("location services")) {
      openNotice("⚠️", "Location disabled", "Turn on Location Services for CityReport in your device settings.");
      return;
    }

    openNotice("⚠️", "Location error", "Could not determine your location right now.");
  } finally {
    setLocating(false);
  }
}

export function processTrackedPositionRuntimeShared(pos, state = {}, deps = {}) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const nextPos = { lat, lng };
  const prevPos = state?.lastTrackedPosRef?.current;
  const ts = Number(pos?.timestamp) || Date.now();
  const accuracyM = Number(pos?.coords?.accuracy);
  const rawHeadingAccuracy =
    Number(pos?.coords?.headingAccuracy ?? pos?.coords?.heading_accuracy);
  const rawHeadingForUi = Number(
    pos?.coords?.trueHeading ??
    pos?.coords?.heading ??
    pos?.coords?.magneticHeading
  );

  const setUserHeading =
    typeof deps?.setUserHeading === "function"
      ? deps.setUserHeading
      : () => {};
  const metersBetween =
    typeof deps?.metersBetween === "function"
      ? deps.metersBetween
      : () => 0;
  const bearingBetween =
    typeof deps?.bearingBetween === "function"
      ? deps.bearingBetween
      : () => Number.NaN;
  const predictedMovingDisplayPosition =
    typeof deps?.predictedMovingDisplayPosition === "function"
      ? deps.predictedMovingDisplayPosition
      : ((value) => value);
  const recordLocationDiagnostics =
    typeof deps?.recordLocationDiagnostics === "function"
      ? deps.recordLocationDiagnostics
      : () => {};
  const updateUserLocUi =
    typeof deps?.updateUserLocUi === "function"
      ? deps.updateUserLocUi
      : () => {};
  const queueFollowCameraTarget =
    typeof deps?.queueFollowCameraTarget === "function"
      ? deps.queueFollowCameraTarget
      : () => {};

  const liveMotionRef = state?.liveMotionRef || { current: null };
  const stationaryAnchorRef = state?.stationaryAnchorRef || { current: null };
  const stationaryReleaseStreakRef = state?.stationaryReleaseStreakRef || { current: 0 };
  const smoothedHeadingRef = state?.smoothedHeadingRef || { current: null };
  const navigationHeadingRef = state?.navigationHeadingRef || { current: null };
  const followHeadingEnabledRef = state?.followHeadingEnabledRef || { current: false };
  const lastFollowCameraRef = state?.lastFollowCameraRef || { current: { lat: null, lng: null, heading: null } };
  const followTargetRef = state?.followTargetRef || { current: null };
  const lastTrackedPosRef = state?.lastTrackedPosRef || { current: null };
  const followCamera = state?.followCamera === true;
  const travelFollowMode = state?.travelFollowMode === true;
  const userDragPanRef = state?.userDragPanRef || { current: false };

  const updateUserHeadingUi = (nextHeading) => {
    const headingValue = Number(nextHeading);
    setUserHeading((prev) => {
      const prevNum = Number(prev);
      if (!Number.isFinite(headingValue)) {
        return Number.isFinite(prevNum) ? null : prev;
      }
      if (!Number.isFinite(prevNum)) return headingValue;
      const delta = Math.abs(((headingValue - prevNum + 540) % 360) - 180);
      return delta >= 3 ? headingValue : prev;
    });
  };

  const rawSpeed = Number(pos?.coords?.speed);
  let speedMps = Number.isFinite(rawSpeed) && rawSpeed >= 0 ? rawSpeed : Number.NaN;
  const headingFreezeMps = 2.2;
  const headingHeavyDampMps = 5.0;

  const prevMotionTs = Number(liveMotionRef.current?.ts);
  if ((!Number.isFinite(speedMps) || speedMps < 0) && prevPos && Number.isFinite(prevMotionTs)) {
    const dtSec = (ts - prevMotionTs) / 1000;
    if (dtSec > 0.2) speedMps = metersBetween(prevPos, nextPos) / dtSec;
  }

  const movedMetersFromPrev = prevPos ? metersBetween(prevPos, nextPos) : 0;
  const lowSpeedLikely = !Number.isFinite(speedMps) || speedMps < 1.15;
  const stationaryAnchor =
    stationaryAnchorRef.current ||
    (prevPos ? { lat: prevPos.lat, lng: prevPos.lng, ts } : null);
  const driftFromAnchor = stationaryAnchor
    ? metersBetween({ lat: stationaryAnchor.lat, lng: stationaryAnchor.lng }, nextPos)
    : Infinity;
  const stationaryReleaseMeters = Number.isFinite(accuracyM)
    ? Math.max(10, Math.min(22, accuracyM * 1.35))
    : 12;
  const hasConvincingStep = movedMetersFromPrev >= Math.max(4.5, stationaryReleaseMeters * 0.42);
  const strongReleaseSignal =
    (Number.isFinite(speedMps) && speedMps >= 1.6) ||
    driftFromAnchor >= stationaryReleaseMeters * 1.45;
  const recordStationaryLock = (status = "Stationary lock") => {
    const lockedLat = Number(liveMotionRef.current?.lat);
    const lockedLng = Number(liveMotionRef.current?.lng);
    const fallbackLat = Number(stationaryAnchor?.lat);
    const fallbackLng = Number(stationaryAnchor?.lng);
    const displayLat = Number.isFinite(lockedLat) ? lockedLat : fallbackLat;
    const displayLng = Number.isFinite(lockedLng) ? lockedLng : fallbackLng;
    recordLocationDiagnostics({
      status,
      rawLat: lat,
      rawLng: lng,
      displayLat,
      displayLng,
      rawToDisplayM:
        Number.isFinite(displayLat) && Number.isFinite(displayLng)
          ? metersBetween(nextPos, { lat: displayLat, lng: displayLng })
          : null,
      accuracyM,
      speedMps: Number.isFinite(speedMps) ? speedMps : null,
      headingDeg: Number.isFinite(liveMotionRef.current?.heading) ? liveMotionRef.current.heading : null,
      rawHeadingDeg: Number.isFinite(rawHeadingForUi) ? rawHeadingForUi : null,
      headingAccuracyDeg: Number.isFinite(rawHeadingAccuracy) ? rawHeadingAccuracy : null,
      fixAgeMs: Date.now() - ts,
      movedMeters: movedMetersFromPrev,
      stationaryDriftM: driftFromAnchor,
      stationaryLocked: true,
      predictionActive: false,
      followCamera,
      travelFollowMode,
      timestamp: ts,
    });
  };

  if (lowSpeedLikely && stationaryAnchor) {
    stationaryAnchorRef.current = stationaryAnchor;
    if (Number.isFinite(rawHeadingForUi) && (!Number.isFinite(rawHeadingAccuracy) || rawHeadingAccuracy <= 15)) {
      updateUserHeadingUi(rawHeadingForUi);
    }
    if (driftFromAnchor < stationaryReleaseMeters || !hasConvincingStep || !strongReleaseSignal) {
      stationaryReleaseStreakRef.current = 0;
      liveMotionRef.current = {
        lat: Number.isFinite(liveMotionRef.current?.lat) ? liveMotionRef.current.lat : stationaryAnchor.lat,
        lng: Number.isFinite(liveMotionRef.current?.lng) ? liveMotionRef.current.lng : stationaryAnchor.lng,
        heading: Number.isFinite(liveMotionRef.current?.heading) ? liveMotionRef.current.heading : null,
        speed: 0,
        ts,
      };
      recordStationaryLock();
      return;
    }

    stationaryReleaseStreakRef.current += 1;
    if (stationaryReleaseStreakRef.current < 3) {
      liveMotionRef.current = {
        lat: Number.isFinite(liveMotionRef.current?.lat) ? liveMotionRef.current.lat : stationaryAnchor.lat,
        lng: Number.isFinite(liveMotionRef.current?.lng) ? liveMotionRef.current.lng : stationaryAnchor.lng,
        heading: Number.isFinite(liveMotionRef.current?.heading) ? liveMotionRef.current.heading : null,
        speed: 0,
        ts,
      };
      recordStationaryLock("Confirming movement");
      return;
    }
  } else {
    stationaryReleaseStreakRef.current = 0;
  }

  if (lowSpeedLikely && !stationaryAnchorRef.current) {
    stationaryAnchorRef.current = { lat, lng, ts };
  } else if (!lowSpeedLikely || driftFromAnchor >= stationaryReleaseMeters) {
    stationaryAnchorRef.current = { lat, lng, ts };
  }

  let heading = Number(pos?.coords?.heading);
  const poorHeadingAccuracy =
    (Number.isFinite(rawHeadingAccuracy) && rawHeadingAccuracy > 18) ||
    (Number.isFinite(accuracyM)
      && (
        accuracyM > 28 ||
        (accuracyM > 18 && (!Number.isFinite(speedMps) || speedMps < headingHeavyDampMps))
      ));
  if (!Number.isFinite(heading) || heading < 0 || poorHeadingAccuracy) {
    if (
      prevPos &&
      movedMetersFromPrev >= 8 &&
      Number.isFinite(speedMps) &&
      speedMps >= headingFreezeMps &&
      (!Number.isFinite(accuracyM) || accuracyM <= 20)
    ) {
      heading = bearingBetween(prevPos, nextPos);
    } else {
      heading = Number.NaN;
    }
  }

  if (Number.isFinite(heading)) {
    const prev = smoothedHeadingRef.current;
    if (!Number.isFinite(prev)) {
      if (!Number.isFinite(speedMps) || speedMps >= headingFreezeMps) {
        smoothedHeadingRef.current = heading;
      }
    } else {
      const speedForSmoothing = Number.isFinite(speedMps) ? speedMps : 0;
      const headingAlpha =
        speedForSmoothing >= 12 ? 0.50 :
        speedForSmoothing >= 8 ? 0.36 :
        speedForSmoothing >= headingHeavyDampMps ? 0.24 :
        0.14;
      const delta = ((heading - prev + 540) % 360) - 180;
      const headingDeadband =
        speedForSmoothing >= 12 ? 1.5 :
        speedForSmoothing >= 8 ? 2.4 :
        speedForSmoothing >= headingHeavyDampMps ? 4 :
        8;
      if (speedForSmoothing >= headingFreezeMps && Math.abs(delta) >= headingDeadband) {
        smoothedHeadingRef.current = (prev + delta * headingAlpha + 360) % 360;
      }
    }
  }

  const speedForHeading = Number.isFinite(speedMps) ? speedMps : 0;
  const effectiveHeading =
    speedForHeading < headingFreezeMps
      ? Number(liveMotionRef.current?.heading)
      : (Number.isFinite(smoothedHeadingRef.current) ? smoothedHeadingRef.current : heading);
  let navigationHeading = Number(navigationHeadingRef.current);
  if (Number.isFinite(heading) && speedForHeading >= headingFreezeMps) {
    const prevNavHeading = Number(navigationHeadingRef.current);
    if (!Number.isFinite(prevNavHeading)) {
      navigationHeading = heading;
    } else {
      const navDelta = ((heading - prevNavHeading + 540) % 360) - 180;
      const navDeltaAbs = Math.abs(navDelta);
      const navHeadingAlpha =
        travelFollowMode
          ? (
            navDeltaAbs >= 50 ? 0.92 :
            navDeltaAbs >= 28 ? 0.82 :
            navDeltaAbs >= 14 ? 0.68 :
            speedForHeading >= 8 ? 0.52 :
            0.40
          )
          : (
            navDeltaAbs >= 50 ? 0.78 :
            navDeltaAbs >= 28 ? 0.66 :
            navDeltaAbs >= 14 ? 0.50 :
            speedForHeading >= 8 ? 0.34 :
            0.26
          );
      navigationHeading = (prevNavHeading + navDelta * navHeadingAlpha + 360) % 360;
    }
    navigationHeadingRef.current = navigationHeading;
  }
  const followHeading =
    travelFollowMode && Number.isFinite(navigationHeading)
      ? navigationHeading
      : effectiveHeading;
  const headingForUi = Number.isFinite(effectiveHeading) ? effectiveHeading : null;
  updateUserHeadingUi(headingForUi);

  const displayPos = predictedMovingDisplayPosition(
    nextPos,
    speedMps,
    Number.isFinite(followHeading) ? followHeading : headingForUi,
    accuracyM,
    ts
  );
  const followCameraAnchorPos = travelFollowMode ? nextPos : displayPos;
  const rawToDisplayM = metersBetween(nextPos, displayPos);
  recordLocationDiagnostics({
    status: "Tracking",
    rawLat: lat,
    rawLng: lng,
    displayLat: displayPos.lat,
    displayLng: displayPos.lng,
    rawToDisplayM,
    accuracyM,
    speedMps: Number.isFinite(speedMps) ? speedMps : null,
    headingDeg: Number.isFinite(headingForUi) ? headingForUi : null,
    followHeadingDeg: Number.isFinite(followHeading) ? followHeading : null,
    rawHeadingDeg: Number.isFinite(rawHeadingForUi) ? rawHeadingForUi : null,
    headingAccuracyDeg: Number.isFinite(rawHeadingAccuracy) ? rawHeadingAccuracy : null,
    fixAgeMs: Date.now() - ts,
    movedMeters: movedMetersFromPrev,
    stationaryDriftM: driftFromAnchor,
    stationaryLocked: false,
    predictionActive: Number.isFinite(rawToDisplayM) && rawToDisplayM >= 0.5,
    followCamera,
    travelFollowMode,
    timestamp: ts,
  });
  updateUserLocUi(displayPos.lat, displayPos.lng, false);
  lastTrackedPosRef.current = nextPos;

  liveMotionRef.current = {
    lat,
    lng,
    heading: Number.isFinite(headingForUi)
      ? headingForUi
      : Number(liveMotionRef.current?.heading),
    speed: Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0,
    ts,
  };

  if (followCamera) {
    if (travelFollowMode && userDragPanRef.current) return;
    const speedForThresholds = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
    const poorAccuracySmallMove =
      Number.isFinite(accuracyM) &&
      accuracyM > 25 &&
      prevPos &&
      metersBetween(prevPos, nextPos) < Math.min(accuracyM * 0.5, 18);

    const last = lastFollowCameraRef.current;
    const movedMeters = Number.isFinite(last.lat) && Number.isFinite(last.lng)
      ? metersBetween({ lat: last.lat, lng: last.lng }, followCameraAnchorPos)
      : Infinity;

    const headingDelta = !followHeadingEnabledRef.current
      ? 0
      : Number.isFinite(last.heading) && Number.isFinite(followHeading)
        ? Math.abs(((followHeading - last.heading + 540) % 360) - 180)
        : Infinity;

    const moveTriggerMeters =
      travelFollowMode && speedForThresholds >= 12 ? 0.55 :
      travelFollowMode && speedForThresholds >= headingFreezeMps ? 0.75 :
      Number.isFinite(accuracyM) && accuracyM > 40 ? 4 :
      Number.isFinite(accuracyM) && accuracyM > 20 ? 2.8 :
      speedForThresholds >= 12 ? 1.8 :
      speedForThresholds >= 6 ? 1.4 :
      speedForThresholds >= headingHeavyDampMps ? 2.4 : 3.4;
    const headingTriggerDeg =
      travelFollowMode && speedForThresholds >= 12 ? 0.55 :
      travelFollowMode && speedForThresholds >= headingFreezeMps ? 1.0 :
      speedForThresholds >= 12 ? 4 :
      speedForThresholds >= 8 ? 6 :
      speedForThresholds >= headingHeavyDampMps ? 10 :
      18;

    if (!poorAccuracySmallMove && (movedMeters >= moveTriggerMeters || headingDelta >= headingTriggerDeg || !followTargetRef.current)) {
      const queuedHeading =
        (followHeadingEnabledRef.current && speedForThresholds >= headingFreezeMps)
          ? followHeading
          : null;
      queueFollowCameraTarget({
        lat: followCameraAnchorPos.lat,
        lng: followCameraAnchorPos.lng,
        heading: queuedHeading,
      });
      lastFollowCameraRef.current = {
        lat: followCameraAnchorPos.lat,
        lng: followCameraAnchorPos.lng,
        heading: queuedHeading,
      };
    }
  }
}

export function handleTrackedPositionErrorRuntimeShared(err, deps = {}) {
  const setAutoFollow =
    typeof deps?.setAutoFollow === "function"
      ? deps.setAutoFollow
      : () => {};
  const setGeoDeniedPersist =
    typeof deps?.setGeoDeniedPersist === "function"
      ? deps.setGeoDeniedPersist
      : () => {};
  const openNotice =
    typeof deps?.openNotice === "function"
      ? deps.openNotice
      : () => {};

  const code = Number(err?.code);
  if (code === 1) {
    setAutoFollow(false);
    setGeoDeniedPersist(true);
    openNotice("⚠️", "Location denied", "Location access was blocked.");
    return;
  }

  setGeoDeniedPersist(false);
}

export function applyLocatedPositionRuntimeShared(pos, state = {}, deps = {}) {
  const updateUserLocUi =
    typeof deps?.updateUserLocUi === "function"
      ? deps.updateUserLocUi
      : () => {};
  const flyToTarget =
    typeof deps?.flyToTarget === "function"
      ? deps.flyToTarget
      : () => {};
  const setAutoFollow =
    typeof deps?.setAutoFollow === "function"
      ? deps.setAutoFollow
      : () => {};
  const setFollowCamera =
    typeof deps?.setFollowCamera === "function"
      ? deps.setFollowCamera
      : () => {};
  const locateZoom = Number.isFinite(Number(deps?.locateZoom))
    ? Number(deps.locateZoom)
    : 0;

  const lat = Number(pos?.coords?.latitude);
  const lng = Number(pos?.coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid location coordinates");
  }

  updateUserLocUi(lat, lng, true);
  if (state?.lastTrackedPosRef) state.lastTrackedPosRef.current = { lat, lng };
  if (state?.smoothedHeadingRef) state.smoothedHeadingRef.current = null;
  if (state?.navigationHeadingRef) state.navigationHeadingRef.current = null;
  if (state?.lastFollowCameraRef) state.lastFollowCameraRef.current = { lat, lng, heading: null };
  if (state?.followAnimatedCameraRef) state.followAnimatedCameraRef.current = { lat, lng, heading: null };
  if (state?.stationaryAnchorRef) state.stationaryAnchorRef.current = { lat, lng, ts: Date.now() };
  if (state?.stationaryReleaseStreakRef) state.stationaryReleaseStreakRef.current = 0;
  flyToTarget([lat, lng], locateZoom);
  setAutoFollow(true);
  setFollowCamera(true);
}
