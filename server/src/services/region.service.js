import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/validators.js';
import { reverseGeocode } from './nominatim.service.js';

/**
 * Provisions (or reuses) the LOCALITY region that contains a coordinate.
 * Uses the Nominatim polygon boundary when available; otherwise buffers the
 * point so the region always contains the reporter (keeps verifyJurisdiction correct).
 *
 * Race-safe upsert via the unique `regions.name` constraint.
 */
export async function provisionRegion(client, lat, lng) {
  const { name, geojson } = await reverseGeocode(lat, lng);
  if (!name) {
    throw new HttpError(400, 'Could not determine a civic locality for these coordinates.');
  }

  const isPolygon = geojson && ['Polygon', 'MultiPolygon'].includes(geojson.type);

  let result;
  if (isPolygon) {
    const geoJsonStr = JSON.stringify(geojson);
    result = await client.query(
      `INSERT INTO regions (name, type, boundary)
       VALUES ($1, 'LOCALITY', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)))
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [name, geoJsonStr],
    );
  } else {
    result = await client.query(
      `INSERT INTO regions (name, type, boundary)
       VALUES ($1, 'LOCALITY',
         ST_Multi(ST_Buffer(ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)::geometry))
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [name, lng, lat, env.regionBufferMeters],
    );
  }

  if (result.rows.length > 0) {
    return { regionId: result.rows[0].id, regionName: name };
  }

  const existing = await client.query('SELECT id FROM regions WHERE name = $1', [name]);
  return { regionId: existing.rows[0].id, regionName: name };
}

/** Finds the most specific region (Locality > Ward > City) containing a point. */
export async function getRegionByCoordinates(lat, lng) {
  const { rows } = await query(
    `SELECT id, name, type, parent_region_id
     FROM regions
     WHERE ST_Covers(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
     ORDER BY CASE type
       WHEN 'LOCALITY' THEN 1
       WHEN 'WARD' THEN 2
       WHEN 'CITY' THEN 3
     END ASC
     LIMIT 1`,
    [lng, lat],
  );
  return rows[0] || null;
}

/**
 * Zero-trust jurisdiction check: does the point fall inside the region
 * OR any of its descendant child regions?
 */
export async function verifyJurisdiction(regionId, lat, lng) {
  if (!regionId) return false;

  const { rows } = await query(
    `WITH RECURSIVE RegionTree AS (
       SELECT id, boundary FROM regions WHERE id = $1
       UNION ALL
       SELECT r.id, r.boundary
       FROM regions r
       INNER JOIN RegionTree rt ON r.parent_region_id = rt.id
     )
     SELECT EXISTS (
       SELECT 1 FROM RegionTree
       WHERE ST_Covers(boundary, ST_SetSRID(ST_MakePoint($2, $3), 4326))
     ) AS "isAuthorized"`,
    [regionId, lng, lat],
  );
  return Boolean(rows[0]?.isAuthorized);
}
