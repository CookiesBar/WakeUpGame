// geo.mjs: tiny path toolkit for the face rig (parse, transform, split, build ellipses / parabolas / stroke outlines).

/** Parse an absolute path (M L H V C Z, as Figma exports) into segments with absolute points. H/V become L. */
export function parse(d) {
  const toks = d.match(/[MLHVCZmlhvcz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const out = [];
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
  const num = () => +toks[i++];
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (cmd !== cmd.toUpperCase()) throw new Error('relative command in ' + d.slice(0, 40));
    if (cmd === 'M') { cx = num(); cy = num(); sx = cx; sy = cy; out.push(['M', [cx, cy]]); cmd = 'L'; }
    else if (cmd === 'L') { cx = num(); cy = num(); out.push(['L', [cx, cy]]); }
    else if (cmd === 'H') { cx = num(); out.push(['L', [cx, cy]]); }
    else if (cmd === 'V') { cy = num(); out.push(['L', [cx, cy]]); }
    else if (cmd === 'C') { const a = [num(), num()], b = [num(), num()], c = [num(), num()]; out.push(['C', a, b, c]); [cx, cy] = c; }
    else if (cmd === 'Z') { out.push(['Z']); cx = sx; cy = sy; }
  }
  return out;
}

const f = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
export const fmt = f;

export function str(segs) {
  return segs.map(([c, ...pts]) => c + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' ')).join('');
}

/** Apply a point function to every point. */
export const mapPts = (segs, fn) => segs.map(([c, ...pts]) => [c, ...pts.map(fn)]);

export const rot = (deg, [ox, oy]) => {
  const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  return ([x, y]) => [ox + (x - ox) * cs - (y - oy) * sn, oy + (x - ox) * sn + (y - oy) * cs];
};
export const move = (dx, dy) => ([x, y]) => [x + dx, y + dy];
export const scaleAt = (k, [ox, oy]) => ([x, y]) => [ox + (x - ox) * k, oy + (y - oy) * k];

export function bbox(segs) {
  const p = segs.flatMap(([, ...pts]) => pts);
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
/** Tight bbox of a cubic chain by sampling (control points overshoot). */
export function tightBox(segs) {
  let last = [0, 0], xs = [], ys = [];
  for (const [c, ...pts] of segs) {
    if (c === 'M' || c === 'L') { last = pts[0]; xs.push(last[0]); ys.push(last[1]); }
    if (c === 'C') {
      for (let t = 0; t <= 1.0001; t += 0.02) { const q = bez(last, pts[0], pts[1], pts[2], t); xs.push(q[0]); ys.push(q[1]); }
      last = pts[2];
    }
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
export const center = (b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];

export function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** de Casteljau split of one cubic at t. */
export function split(p0, p1, p2, p3, t = 0.5) {
  const a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
  const d = lerp(a, b, t), e = lerp(b, c, t), m = lerp(d, e, t);
  return [[p0, a, d, m], [m, e, c, p3]];
}
/** A cubic as a list of n cubics (n = power of 2). */
export function subdivide(cub, n) {
  let list = [cub];
  while (list.length < n) list = list.flatMap((q) => split(...q));
  return list;
}
export const chain = (cubs) => [['M', cubs[0][0]], ...cubs.map((q) => ['C', q[1], q[2], q[3]])];
/** Reverse an open chain of cubics. */
export const reverseCubs = (cubs) => cubs.slice().reverse().map(([a, b, c, d]) => [d, c, b, a]);
export function cubsOf(segs) {
  const out = [];
  let last;
  for (const [c, ...pts] of segs) {
    if (c === 'M' || c === 'L') last = pts[0];
    if (c === 'C') { out.push([last, pts[0], pts[1], pts[2]]); last = pts[2]; }
  }
  return out;
}

/** Ellipse as M + 4C + Z, starting at the top and going clockwise (on screen). */
export function ellipse(cx, cy, rx, ry) {
  const k = 0.5523;
  return [
    ['M', [cx, cy - ry]],
    ['C', [cx + rx * k, cy - ry], [cx + rx, cy - ry * k], [cx + rx, cy]],
    ['C', [cx + rx, cy + ry * k], [cx + rx * k, cy + ry], [cx, cy + ry]],
    ['C', [cx - rx * k, cy + ry], [cx - rx, cy + ry * k], [cx - rx, cy]],
    ['C', [cx - rx, cy - ry * k], [cx - rx * k, cy - ry], [cx, cy - ry]],
    ['Z'],
  ];
}

/** Six-point ellipse (M + 6C + Z), clockwise from the upper-left point: the mouth topology. */
export function ellipse6(cx, cy, rx, ry, tilt = 0) {
  const k = (4 / 3) * Math.tan(Math.PI / 12);
  const P = (a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  const D = (a) => [-rx * Math.sin(a), ry * Math.cos(a)];
  const step = Math.PI / 3, a0 = (210 * Math.PI) / 180;
  const cubs = [];
  for (let i = 0; i < 6; i++) {
    const a = a0 + i * step, b = a + step, pa = P(a), pb = P(b), da = D(a), db = D(b);
    cubs.push([pa, [pa[0] + da[0] * k, pa[1] + da[1] * k], [pb[0] - db[0] * k, pb[1] - db[1] * k], pb]);
  }
  const segs = [...chain(cubs), ['Z']];
  return tilt ? mapPts(segs, rot(tilt, [cx, cy])) : segs;
}

/** y = c + b x + a x^2 between xa and xb as one cubic (exact). */
export function parabolaCub(q, xa, xb) {
  const y = (x) => q.c + q.b * x + q.a * x * x, dy = (x) => q.b + 2 * q.a * x;
  const P0 = [xa, y(xa)], P3 = [xb, y(xb)], Q = [(xa + xb) / 2, y(xa) + dy(xa) * (xb - xa) / 2];
  return [P0, lerp(P0, Q, 2 / 3), lerp(P3, Q, 2 / 3), P3];
}

/** Where a lid edge leaves an ellipse (rx, ry) centred on 0: bisection outward from x0 = 0. */
export function chord(q, rx, ry) {
  const g = (x) => (x / rx) ** 2 + ((q.c + q.b * x + q.a * x * x) / ry) ** 2 - 1;
  const side = (s) => { let lo = 0, hi = s * rx; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (g(m) < 0 ? (lo = m) : (hi = m)); } return lo; };
  if (g(0) >= 0) throw new Error('lid edge misses the eye');
  return [side(-1), side(1)];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
const tanStart = ([p0, p1, p2]) => norm(Math.hypot(...sub(p1, p0)) > 1e-6 ? sub(p1, p0) : sub(p2, p0));
const tanEnd = ([, p1, p2, p3]) => norm(Math.hypot(...sub(p3, p2)) > 1e-6 ? sub(p3, p2) : sub(p3, p1));
const left = (t) => [t[1], -t[0]]; // normal to the left of travel (screen coords, y down)
// ponytail: control-point offset, fine for a 2-unit stroke on gentle curves; use a real offsetter for thick strokes.
function offsetCub(q, d) {
  const n0 = left(tanStart(q)), n1 = left(tanEnd(q));
  const o = (p, n) => [p[0] + n[0] * d, p[1] + n[1] * d];
  return [o(q[0], n0), o(q[1], n0), o(q[2], n1), o(q[3], n1)];
}
/**
 * A round-capped stroke as a filled outline with the mouth topology (M + 6C + Z):
 * upper edge (2C), right cap, lower edge (2C), left cap. `cub` runs left to right.
 */
export function strokeOutline(cub, hw) {
  const [h1, h2] = split(...cub);
  const up1 = offsetCub(h1, hw), up2 = offsetCub(h2, hw); // left of left-to-right travel = up
  const lo2 = reverseCubs([offsetCub(h2, -hw)])[0], lo1 = reverseCubs([offsetCub(h1, -hw)])[0];
  const k = (4 / 3) * hw;
  const tE = tanEnd(cub), tS = tanStart(cub);
  const capR = [up2[3], [up2[3][0] + tE[0] * k, up2[3][1] + tE[1] * k], [lo2[0][0] + tE[0] * k, lo2[0][1] + tE[1] * k], lo2[0]];
  const capL = [lo1[3], [lo1[3][0] - tS[0] * k, lo1[3][1] - tS[1] * k], [up1[0][0] - tS[0] * k, up1[0][1] - tS[1] * k], up1[0]];
  return [...chain([up1, up2, capR, lo2, lo1, capL]), ['Z']];
}

/** Command letters only: two paths morph point by point when these match. */
export const signature = (d) => d.replace(/[^A-Za-z]/g, '');
