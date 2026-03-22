# CityReport Aggregation Strategy Contract v1.0

## Purpose
Define one normalized aggregation interface that every domain must implement so Open Reports and exports consume one stable shape.

## Supported Strategy Types
1. `asset_based`
2. `proximity_based`
3. `area_based`
4. `severity_based`

No custom strategy labels are allowed in production.

## Normalized Output Contract (Required)
Each strategy must return this exact shape:

```json
{
  "aggregation_id": "string",
  "related_incidents": ["incident_id_1", "incident_id_2"],
  "aggregation_state": "reported|aggregated|confirmed|in_progress|fixed|reopened|archived",
  "severity_score": 0,
  "last_activity_at": "2026-03-02T12:00:00Z"
}
```

## Field Rules
- `aggregation_id`:
  stable identifier for the aggregate grouping (asset key, cluster key, area key, or severity bucket key).
- `related_incidents`:
  ordered incident IDs included in the aggregate; must never be null (empty array allowed).
- `aggregation_state`:
  must use canonical lifecycle states only.
- `severity_score`:
  normalized integer score (0-100 recommended) used for sort/ranking only.
- `last_activity_at`:
  max activity timestamp from incidents/events in the aggregate.

## Domain Mapping (Week 1)

### Streetlights
- Strategy type: `asset_based`
- `aggregation_id`: official light identifier (`sl_id` fallback `light_id`)
- `related_incidents`: incidents linked to the same official light

### Potholes
- Strategy type: `proximity_based`
- `aggregation_id`: pothole cluster ID
- `related_incidents`: incidents linked to the same pothole cluster

### Power Outage (spec only)
- Strategy type: `area_based`
- `aggregation_id`: outage area/cell identifier

### Water Main (spec only)
- Strategy type: `severity_based` (or `area_based` fallback by policy)
- `aggregation_id`: severity/zone grouping identifier

## Consumer Rules
- Open Reports must read only normalized contract fields above.
- Export pipelines must read only normalized contract fields above.
- UI/domain-specific fields may be attached separately but cannot replace core contract fields.

## Governance Rules
- No domain exceptions.
- Any new domain must select one strategy type and produce normalized output before UI launch.
- Contract changes require governance review and version bump.

## Acceptance Criteria
- Streetlights and potholes conform to the normalized output shape.
- Open Reports renders from normalized fields without domain-specific branching for core state/sort behavior.
- Power and water specifications are documented against the same interface before public rollout.
