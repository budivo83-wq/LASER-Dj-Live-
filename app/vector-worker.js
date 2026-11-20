'use strict';

// The virtual vectorizer runs off the renderer thread. No IO or hardware output.
function blurGray(values, w, h, radius) {
  let src = values;
  for (let pass = 0; pass < radius; pass++) {
    const dst = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        sum += src[yy * w + xx]; count++;
      }
      dst[y * w + x] = sum / count;
    }
    src = dst;
  }
  return src;
}

function simplifyLine(points, epsilon) {
  if (points.length <= 2 || epsilon <= 0) return points.slice();
  const a = points[0], b = points[points.length - 1];
  const dx = b[0] - a[0], dy = b[1] - a[1], dist2 = dx * dx + dy * dy;
  let largest = -1, index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const f = dist2 > 1e-8 ? Math.max(0, Math.min(1,
      ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / dist2)) : 0;
    const distance = (p[0] - a[0] - dx * f) ** 2 + (p[1] - a[1] - dy * f) ** 2;
    if (distance > largest) { largest = distance; index = i; }
  }
  if (largest <= epsilon * epsilon) return [a, b];
  return [...simplifyLine(points.slice(0, index + 1), epsilon).slice(0, -1),
    ...simplifyLine(points.slice(index), epsilon)];
}

function simplifyContour(points, epsilon) {
  const first = points[0], last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return simplifyLine(points, epsilon);
  const ring = points.slice(0, -1);
  if (ring.length < 4) return points;
  let far = 1, max = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > max) { max = d; far = i; }
  }
  const a = simplifyLine(ring.slice(0, far + 1), epsilon);
  const b = simplifyLine([...ring.slice(far), ring[0]], epsilon);
  return [...a.slice(0, -1), ...b];
}

function traceContours(binary, w, h, minPerimeter, maxPaths, epsilon) {
  const segments = [], connected = new Map();
  function key(p) { return p[0] + ',' + p[1]; }
  function edge(a, b) {
    const id = segments.length;
    segments.push([a, b]);
    for (const p of [a, b]) {
      const k = key(p);
      if (!connected.has(k)) connected.set(k, []);
      connected.get(k).push(id);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const index = y * w + x;
    if (!binary[index]) continue;
    if (x === 0 || !binary[index - 1]) edge([x, y], [x, y + 1]);
    if (x === w - 1 || !binary[index + 1]) edge([x + 1, y], [x + 1, y + 1]);
    if (y === 0 || !binary[index - w]) edge([x, y], [x + 1, y]);
    if (y === h - 1 || !binary[index + w]) edge([x, y + 1], [x + 1, y + 1]);
  }
  const used = new Uint8Array(segments.length), candidates = [];
  for (let id = 0; id < segments.length; id++) {
    if (used[id]) continue;
    used[id] = 1;
    const points = [segments[id][0], segments[id][1]];
    const firstKey = key(points[0]);
    let current = points[1], guard = 0;
    while (guard++ < segments.length) {
      const next = (connected.get(key(current)) || []).find(i => !used[i]);
      if (next === undefined) break;
      used[next] = 1;
      const seg = segments[next];
      const other = key(seg[0]) === key(current) ? seg[1] : seg[0];
      points.push(other); current = other;
      if (key(current) === firstKey) break;
    }
    if (points.length - 1 < minPerimeter) continue;
    const simple = simplifyContour(points, epsilon);
    if (simple.length < 3) continue;
    const mapped = simple.map(([x, y]) => [(x - w / 2) * 1.8 / w, (y - h / 2) * 1.8 / w]);
    candidates.push({ perimeter: points.length - 1, points: mapped });
  }
  candidates.sort((a, b) => b.perimeter - a.perimeter);
  return candidates.slice(0, maxPaths).map(c => c.points);
}

let previousBinary = null, previousGeneration = null;
self.onmessage = event => {
  const { generation, pixels, w, h, blur, threshold, hysteresis, minContour, maxContours, simplify } = event.data;
  try {
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w * h > 160000 ||
        !(pixels instanceof ArrayBuffer) || pixels.byteLength !== w * h * 4) {
      throw new Error('Invalid video dimensions or pixel buffer');
    }
    const rgba = new Uint8ClampedArray(pixels), gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; i++) {
      const j = i * 4;
      gray[i] = rgba[j] * .2126 + rgba[j + 1] * .7152 + rgba[j + 2] * .0722;
    }
    const smooth = blurGray(gray, w, h, Math.max(0, Math.min(3, blur | 0)));
    const binary = new Uint8Array(w * h);
    if (generation !== previousGeneration || previousBinary?.length !== binary.length) previousBinary = null;
    const cutoff = Math.max(0, Math.min(255, Number(threshold)));
    const stableBand = Math.max(0, Math.min(40, Number(hysteresis) || 0));
    for (let i = 0; i < binary.length; i++) {
      const priorOn = previousBinary?.[i] === 1;
      binary[i] = smooth[i] >= cutoff + (priorOn ? -stableBand : stableBand) ? 1 : 0;
    }
    previousBinary = binary.slice();
    previousGeneration = generation;
    const paths = traceContours(binary, w, h, Math.max(4, Number(minContour)),
      Math.min(100, Math.max(1, Number(maxContours))), Math.max(0, Number(simplify)));
    self.postMessage({ generation, paths, binary, w, h }, [binary.buffer]);
  } catch (error) {
    self.postMessage({ generation, error: String(error?.message || error) });
  }
};
