import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// Small in-memory cache so repeated signups from the same cell don't hammer Nominatim.
const cache = new Map(); // key -> { value, expires }

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Reverse-geocodes a coordinate via OpenStreetMap Nominatim.
 * Returns the locality name plus any polygon boundary (if available).
 */
export async function reverseGeocode(lat, lng) {
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const url = 'https://nominatim.openstreetmap.org/reverse';
  const { data } = await axios.get(url, {
    params: {
      lat,
      lon: lng,
      format: 'jsonv2',
      polygon_geojson: 1,
      addressdetails: 1,
      zoom: 16,
    },
    headers: { 'User-Agent': env.nominatimUserAgent || 'CivicFix/1.0 (civic reporting)' },
    timeout: 10_000,
  });

  const address = data?.address || {};
  const name =
    address.neighbourhood ||
    address.suburb ||
    address.city_district ||
    address.town ||
    address.village ||
    address.city ||
    address.county;

  const result = { name, geojson: data?.geojson || null, address };
  cache.set(key, { value: result, expires: Date.now() + CACHE_TTL_MS });
  logger.debug(`Nominatim resolved (${lat}, ${lng}) -> ${name}`);
  return result;
}
