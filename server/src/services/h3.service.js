import { latLngToCell, gridDisk } from 'h3-js';
import { env } from '../config/env.js';

/**
 * H3 hexagonal spatial indexing.
 * Resolution 10 → ~15,000 m² cells, comfortably absorbing 5–20 m GPS drift.
 */
export const getH3Index = (lat, lng) =>
  latLngToCell(parseFloat(lat), parseFloat(lng), env.h3Resolution);

/** k-ring of a cell (k=1 → the cell plus its 6 immediate neighbours). */
export const getNeighborCells = (h3Index, k = 1) => gridDisk(h3Index, k);
