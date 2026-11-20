'use strict';

// Geometric helpers for simulated blackout regions. They do not implement
// certified audience-scan protection, scan-fail detection, or hardware shutter.
(function initMaskZones(host) {
  const clamp = x => Math.max(-1, Math.min(1, x));
  const finite = x => typeof x === 'number' && Number.isFinite(x);

  function normalizedRect(a, b) {
    if (!a || !b || !finite(a.x) || !finite(a.y) || !finite(b.x) || !finite(b.y)) return null;
    const x1 = clamp(Math.min(a.x, b.x)), x2 = clamp(Math.max(a.x, b.x));
    const y1 = clamp(Math.min(a.y, b.y)), y2 = clamp(Math.max(a.y, b.y));
    return x2 - x1 >= .03 && y2 - y1 >= .03 ? { x1, y1, x2, y2 } : null;
  }

  function sanitizeZones(value) {
    if (!Array.isArray(value)) return [];
    const zones = [];
    for (const z of value.slice(0, 16)) {
      if (!z) continue;
      const rect = normalizedRect({ x: z.x1, y: z.y1 }, { x: z.x2, y: z.y2 });
      if (rect) zones.push(rect);
    }
    return zones;
  }

  function contains(zone, x, y) {
    return x >= zone.x1 && x <= zone.x2 && y >= zone.y1 && y <= zone.y2;
  }

  // Liang-Barsky slab clipping. True even for a very narrow zone crossed
  // between two sampled scanner points, so a straight line is never drawn
  // across the forbidden virtual rectangle merely due to sparse sampling.
  function crosses(zone, ax, ay, bx, by) {
    if (contains(zone, ax, ay) || contains(zone, bx, by)) return true;
    let lo = 0, hi = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [
      [-dx, ax - zone.x1], [dx, zone.x2 - ax],
      [-dy, ay - zone.y1], [dy, zone.y2 - ay],
    ]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return false; }
      else {
        const t = q / p;
        if (p < 0) lo = Math.max(lo, t);
        else hi = Math.min(hi, t);
        if (lo > hi) return false;
      }
    }
    return lo <= hi;
  }

  const api = Object.freeze({ normalizedRect, sanitizeZones, contains, crosses });
  if (host) host.LaserMaskZones = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
