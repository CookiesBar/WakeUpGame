// build.mjs: builds assets/mascots/face-rig/{face-rig.svg, face-rig.json, preview.html} from the source poses.
// Run from anywhere: node assets/mascots/face-rig/tools/build.mjs  (defaults: sources in ../src, output in ..)
import fs from 'fs';
import path from 'path';
import * as G from './geo.mjs';

const HERE_ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const [, , SRC = path.join(HERE_, '../src'), OUT = path.join(HERE_, '..')] = process.argv;
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const pathsOf = (f) => [...read(f).matchAll(/<path\b([^>]*?)\/?>/g)].map((m) => {
  const a = m[1], get = (k) => (a.match(new RegExp('\\s' + k + '="([^"]*)"')) || [])[1];
  return { d: get('d'), fill: get('fill'), stroke: get('stroke'), sw: get('stroke-width') };
});
const SRCS = Object.fromEntries(['group', 'group1', 'pic1', 'pic4', 'pic5', 'group7524'].map((n) => [n, pathsOf(n + '.svg')]));
const byPrefix = (file, prefix) => {
  const p = SRCS[file].find((q) => q.d && q.d.startsWith(prefix));
  if (!p) throw new Error(`no path ${prefix} in ${file}`);
  return p;
};
const grp = (i) => SRCS.group[i];

// ---------- coordinate system: Group.svg (the upright pose), face centre moved to (150, 184) ----------
const VB = 326;
const F_SRC = [210.342, 176.01];
const F = [150, 184];
const T = G.move(F[0] - F_SRC[0], F[1] - F_SRC[1]);
const EYE = { left: [115, 158], right: [185, 158] };
const MOUTH = [150, 218];
const INK = '#020628';
const SKIN = '#E1F5FF';
const P2 = (p) => [+G.fmt(p[0]), +G.fmt(p[1])];

// Group.svg's dial is turned about 2 degrees; measure it from the four hour markers and square it up.
const markerIdx = [33, 31, 32, 30]; // 12, 3, 6, 9
const tilt =
  markerIdx
    .map((i, k) => {
      const c = G.center(G.tightBox(G.parse(grp(i).d)));
      const a = (Math.atan2(c[0] - F_SRC[0], -(c[1] - F_SRC[1])) * 180) / Math.PI;
      return ((a - k * 90 + 540) % 360) - 180;
    })
    .reduce((s, a) => s + a, 0) / 4;

const part = (i, extra = []) => {
  const p = grp(i);
  let segs = G.parse(p.d);
  for (const fn of extra) segs = G.mapPts(segs, fn);
  return { d: G.str(G.mapPts(segs, T)), fill: p.fill };
};

// ---------- bells: pivot where the stem's axis enters the body (ring or body-back, whichever comes first) ----------
const CIRCLES = [
  { c: [211.552, 176.57], r: 123.22 }, // ring
  { c: [237.272, 182.1], r: 122.85 }, // body-back
];
function bellPivot(stemIdx) {
  const segs = G.parse(grp(stemIdx).d);
  const lines = [];
  let last;
  for (const [c, ...pts] of segs) {
    if (c === 'L' && last) lines.push([last, pts[0]]);
    last = pts[pts.length - 1];
  }
  lines.sort((a, b) => Math.hypot(...sub(b[1], b[0])) - Math.hypot(...sub(a[1], a[0])));
  const [s1, s2] = lines; // the two long sides run in opposite directions
  const top0 = mid(s1[0], s2[1]), bot0 = mid(s1[1], s2[0]);
  const [top, bot] = top0[1] < bot0[1] ? [top0, bot0] : [bot0, top0];
  const dir = norm(sub(bot, top));
  let best = Infinity;
  for (const { c, r } of CIRCLES) {
    const d = sub(top, c), b = d[0] * dir[0] + d[1] * dir[1], cc = d[0] ** 2 + d[1] ** 2 - r * r, disc = b * b - cc;
    if (disc > 0) best = Math.min(best, -b - Math.sqrt(disc));
  }
  return P2(T([top[0] + dir[0] * best, top[1] + dir[1] * best]));
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function norm(v) { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; }

// ---------- hands (pic4): turned to point straight up from the hub; the group's rotate() sets the time ----------
const H4 = [194.15, 255.04];
function hand(prefix) {
  const p = byPrefix('pic4', prefix);
  const segs = G.parse(p.d);
  const lines = [];
  let last;
  for (const [c, ...pts] of segs) {
    if (c === 'L' && last) lines.push([last, pts[0]]);
    last = pts[pts.length - 1];
  }
  lines.sort((a, b) => Math.hypot(...sub(b[1], b[0])) - Math.hypot(...sub(a[1], a[0])));
  const [s1, s2] = lines;
  const e1 = mid(s1[0], s2[1]), e2 = mid(s1[1], s2[0]);
  const [base, tip] = Math.hypot(...sub(e1, H4)) < Math.hypot(...sub(e2, H4)) ? [e1, e2] : [e2, e1];
  const ang = (Math.atan2(tip[0] - base[0], -(tip[1] - base[1])) * 180) / Math.PI;
  let out = G.mapPts(segs, G.rot(-ang, H4));
  out = G.mapPts(out, G.move(F[0] - H4[0], F[1] - H4[1]));
  const bx = G.rot(-ang, H4)(base)[0] + F[0] - H4[0];
  out = G.mapPts(out, G.move(F[0] - bx, 0)); // axis exactly on the hub
  const bb = G.tightBox(out);
  return { d: G.str(out), fill: p.fill, length: +G.fmt(F[1] - bb.y0), width: +G.fmt(bb.x1 - bb.x0), sourceAngle: +G.fmt(ang) };
}

// ---------- local eye geometry (left eye; the right eye mirrors it) ----------
const WHITE = { normal: [19, 25], round: [21, 25], wide: [26.35, 26.35] };
const W = 32, HT = 34; // lid sub-shapes reach past the largest clip
const LID = {
  open: (ry) => ({ up: { c: -(ry + 4), b: 0, a: 0 }, lo: { c: ry + 4, b: 0, a: 0 } }),
  closed: () => ({ up: { c: 14, b: 0, a: -0.01 }, lo: { c: 11, b: 0, a: -0.01 } }),
  sleepy: (ry) => ({ up: { c: 4, b: 0, a: -0.014 }, lo: LID.open(ry).lo }),
  angry: (ry) => ({ up: { c: -12, b: 0.368, a: -0.004 }, lo: LID.open(ry).lo }),
  squint: () => ({ up: { c: -7, b: 0, a: -0.008 }, lo: { c: 9, b: 0, a: 0.012 } }),
};
function lidSegs(l) {
  // Both sub-shapes wind clockwise: where the lids overlap they must add up, not cancel into a hole.
  const sideU = G.parabolaCub(l.up, W, -W), sideL = G.parabolaCub(l.lo, -W, W);
  return [
    ['M', [-W, -HT]], ['L', [W, -HT]], ['L', sideU[0]], ['C', sideU[1], sideU[2], sideU[3]], ['Z'],
    ['M', [W, HT]], ['L', [-W, HT]], ['L', sideL[0]], ['C', sideL[1], sideL[2], sideL[3]], ['Z'],
  ];
}
const edgeLash = (q, [rx, ry]) => {
  const [x0, x1] = G.chord(q, rx, ry);
  const n = 4, cubs = [];
  for (let i = 0; i < n; i++) cubs.push(G.parabolaCub(q, x0 + ((x1 - x0) * i) / n, x0 + ((x1 - x0) * (i + 1)) / n));
  return cubs;
};
/** One source cubic, run left to right, made level (or turned), scaled about its middle. */
function transformCub(cub, { level = true, scale = 1, turn = 0 }) {
  let c = cub[0][0] > cub[3][0] ? [cub[3], cub[2], cub[1], cub[0]] : cub;
  const m = mid(c[0], c[3]);
  const lv = level ? (-Math.atan2(c[3][1] - c[0][1], c[3][0] - c[0][0]) * 180) / Math.PI : 0;
  const fn = (p) => G.scaleAt(scale, m)(G.rot(lv + turn, m)(p));
  return c.map(fn);
}
/** The same, as 4 cubics with its bounding box centred on `at` (local coords). */
function placed(cub, opts) {
  const segs = G.chain(G.subdivide(transformCub(cub, opts), 4));
  const c = G.center(G.tightBox(segs));
  return G.cubsOf(G.mapPts(segs, G.move(opts.at[0] - c[0], opts.at[1] - c[1])));
}
const srcCub = (file, prefix) => G.cubsOf(G.parse(byPrefix(file, prefix).d))[0];

// pic5 and the dial in pic5 are about 7.5% smaller than Group's (ring r 115 vs 123).
const K5 = 1.075;
const LASH = {
  blink: edgeLash(LID.closed().up, WHITE.normal),
  // pic5 happy eye: its own height inside the eye is kept (it sits low, as drawn); centred left to right.
  happy: (() => {
    const c = placed(srcCub('pic5', 'M150.634 148.717'), { scale: K5, at: [0, 0] });
    const bb = G.tightBox(G.chain(c));
    // pic5: the arc's top is 2.15 above its eye's centre
    return G.cubsOf(G.mapPts(G.chain(c), G.move(0, -2.15 * K5 - bb.y0)));
  })(),
  // pic1 asleep eye: the closed line sits 13 below the eye's centre (measured on pic1 after squaring its 12-degree tilt)
  asleep: placed(srcCub('pic1', 'M329 245.161'), { at: [0, 13], level: false, turn: -12 }),
  chevron: G.cubsOf(G.parse(byPrefix('group7524', 'M151.732 195.039').d)),
};
{
  const c = LASH.chevron;
  const segs = G.chain(c);
  const cc = G.center(G.tightBox(segs));
  LASH.chevron = G.cubsOf(G.mapPts(segs, G.move(-cc[0], 2 - cc[1])));
}

// Brow: Group 7524's wavy angry brow (the bent minute hand), run outer to inner, chord 40 long.
const BROW_SRC = (() => {
  let cubs = G.cubsOf(G.parse(byPrefix('group7524', 'M208.372 207.35').d));
  cubs = G.reverseCubs(cubs); // outer (upper left) first
  const a = cubs[0][0], b = cubs[cubs.length - 1][3];
  const len = Math.hypot(...sub(b, a));
  let segs = G.chain(cubs);
  segs = G.mapPts(segs, G.rot((-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, a));
  segs = G.mapPts(segs, G.scaleAt(40 / len, a));
  segs = G.mapPts(segs, G.move(-a[0] - 20, -a[1]));
  return segs;
})();
const brow = (turn, at) => G.mapPts(G.mapPts(BROW_SRC, G.rot(turn, [0, 0])), G.move(...at));

const EYES = [
  { name: 'neutral', white: 'normal', pupil: [0, 0, 9, 12], lid: 'open', lash: 'blink' },
  { name: 'look-left', white: 'normal', pupil: [-8, 0, 9, 12], lid: 'open', lash: 'blink', note: "screen left (the character's right)" },
  { name: 'look-right', white: 'normal', pupil: [8, 0, 9, 12], lid: 'open', lash: 'blink' },
  { name: 'look-up', white: 'normal', pupil: [0, -11, 9, 12], lid: 'open', lash: 'blink' },
  { name: 'look-down', white: 'normal', pupil: [0, 11, 9, 12], lid: 'open', lash: 'blink' },
  { name: 'blink-closed', white: 'normal', pupil: [0, 0, 9, 12], lid: 'closed', lash: 'blink', lashOn: 1 },
  { name: 'happy-closed', white: 'round', pupil: [0, 4, 9, 12], pupilOff: 1, lid: 'open', lash: 'happy', lashOn: 1, src: 'pic5' },
  { name: 'sleepy-half-lid', white: 'normal', pupil: [0, 10, 9, 12], lid: 'sleepy', lash: 'edge', lashOn: 1 },
  { name: 'asleep', white: 'normal', pupil: [0, 4, 9, 12], lid: 'closed', lash: 'asleep', lashOn: 1, src: 'pic 1' },
  { name: 'angry', white: 'normal', pupil: [0, 3, 9, 12], lid: 'angry', lash: 'edge', lashOn: 1, brow: 'angry', src: 'Group 7524 (brows)' },
  { name: 'surprised-wide', white: 'wide', pupil: [0, 0, 8, 10.5], lid: 'open', lash: 'blink', src: 'pic 4' },
  { name: 'squint', white: 'normal', pupil: [0, 1, 9, 12], lid: 'squint', lash: 'edge', lashOn: 1 },
  { name: 'scrunched', white: 'normal', pupil: [0, 2, 9, 12], lid: 'closed', lash: 'chevron', lashOn: 1, brow: 'scrunched', src: 'Group 7524', extra: true },
];
const BROWS = { rest: [0, [0, -40]], angry: [18, [-1, -35]], scrunched: [22, [0, -33]] };

function eyeTargets(e) {
  const [rx, ry] = WHITE[e.white];
  const lid = LID[e.lid](ry);
  const lashCubs = e.lash === 'edge' ? edgeLash(lid.up, [rx, ry]) : LASH[e.lash];
  const [bt, bat] = BROWS[e.brow || 'rest'];
  const local = {
    white: [G.ellipse(0, 0, rx, ry), 1],
    'lid-clip': [G.ellipse(0, 0, rx + 2, ry + 2), 1],
    'lid-skin': [lidSegs(lid), 1],
    lash: [G.chain(lashCubs), e.lashOn ? 1 : 0],
    brow: [brow(bt, bat), e.brow ? 1 : 0],
  };
  const out = {};
  for (const side of ['left', 'right']) {
    const [ax, ay] = EYE[side], m = side === 'right' ? -1 : 1;
    for (const [k, [segs, op]] of Object.entries(local)) out[`eye-${side}-${k}`] = [G.mapPts(segs, ([x, y]) => [ax + m * x, ay + y]), op];
    const [px, py, prx, pry] = e.pupil; // pupils never mirror: both look the same way
    out[`eye-${side}-pupil`] = [G.ellipse(ax + px, ay + py, prx, pry), e.pupilOff ? 0 : 1];
  }
  return out;
}

// ---------- mouths: M + 6C + Z, clockwise from the upper-left point, bounding box centred on the mouth anchor ----------
function upperLeftFirst(segs) {
  let cubs = G.cubsOf(segs);
  const cc = G.center(G.tightBox(segs));
  let best = 0, bestD = Infinity;
  cubs.forEach((q, i) => {
    const a = Math.atan2(q[0][1] - cc[1], q[0][0] - cc[0]) - (210 * Math.PI) / 180;
    const d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (d < bestD) { bestD = d; best = i; }
  });
  cubs = [...cubs.slice(best), ...cubs.slice(0, best)];
  return G.chain(cubs).concat([['Z']]);
}
const centreOn = (segs, at) => { const c = G.center(G.tightBox(segs)); return G.mapPts(segs, G.move(at[0] - c[0], at[1] - c[1])); };
const SHOUT_SRC = byPrefix('group1', 'M324.979 297.87');
const shout = (() => {
  // Group-1 runs counter-clockwise from the right corner; reverse it so it starts at the left corner.
  const cubs = G.reverseCubs(G.cubsOf(G.parse(SHOUT_SRC.d)));
  return G.chain(cubs).concat([['Z']]);
})();
const shoutBox = G.tightBox(shout);
const shoutC = G.center(shoutBox);
const shoutAt = centreOn(shout, MOUTH);
const tongue = (() => {
  const t = G.parse(byPrefix('group1', 'M284.409 366.339').d);
  // ellipse in Group-1 starts at its bottom; rebuild from its box so it matches the eye-white topology
  const b = G.tightBox(t), c = G.center(b);
  return G.ellipse(MOUTH[0] + c[0] - shoutC[0], MOUTH[1] + c[1] - shoutC[1], (b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2);
})();
const smile = centreOn(G.strokeOutline(transformCub(srcCub('pic5', 'M172.934 223.847'), { scale: K5 }), 2.2), MOUTH);
const flat = centreOn(G.strokeOutline([[-16, 0], [-5.33, 0], [5.33, 0], [16, 0]], 2.2), MOUTH);
const oMouth = G.ellipse6(MOUTH[0], MOUTH[1], 10, 12);
const sleepyMouth = (() => {
  let cubs = G.cubsOf(G.parse(byPrefix('pic1', 'M323.12 282.152').d)).flatMap((q) => G.split(...q));
  const segs0 = G.chain(cubs);
  const c = G.center(G.tightBox(segs0));
  cubs = G.cubsOf(G.mapPts(segs0, G.rot(-12, c)));
  // start at the point closest to "upper left" (210 degrees), keep the clockwise direction
  const cc = G.center(G.tightBox(G.chain(cubs)));
  let best = 0, bestD = Infinity;
  cubs.forEach((q, i) => {
    const a = Math.atan2(q[0][1] - cc[1], q[0][0] - cc[0]);
    const d = Math.abs(Math.atan2(Math.sin(a - (210 * Math.PI) / 180), Math.cos(a - (210 * Math.PI) / 180)));
    if (d < bestD) { bestD = d; best = i; }
  });
  cubs = [...cubs.slice(best), ...cubs.slice(0, best)];
  cubs[cubs.length - 1][3] = cubs[0][0]; // close exactly (drops pic1's 0.01-long V)
  const segs = G.chain(cubs).concat([['Z']]);
  return centreOn(G.mapPts(segs, G.scaleAt(1.5, G.center(G.tightBox(segs)))), MOUTH);
})();
const MOUTHS = [
  { name: 'smile', segs: smile, src: 'pic5' },
  { name: 'open-shout', segs: shoutAt, tongue: 1, src: 'Group-1 / pic 4' },
  { name: 'flat', segs: flat },
  { name: 'small-o', segs: oMouth },
  { name: 'sleepy', segs: sleepyMouth, src: 'pic 1' },
].map((m) => ({ ...m, segs: upperLeftFirst(m.segs) }));

// ---------- checks: every family must morph point by point ----------
const famSig = {};
function check(fam, d) {
  const s = G.signature(d);
  if (famSig[fam] && famSig[fam] !== s) throw new Error(`family ${fam} breaks morphing: ${s} vs ${famSig[fam]}`);
  famSig[fam] = s;
}
const famOf = (target) => target.replace(/^eye-(left|right)-/, 'eye-').replace(/^mouth-/, 'mouth-');

// ---------- assemble ----------
const bellL = [2, 3, 4, 5, 6].map((i) => part(i));
const bellR = [7, 8, 9, 10, 11].map((i) => part(i));
const squareUp = G.rot(-tilt, F_SRC);
const ticks = [18, 19, 20, 25, 26, 27, 28, 29].map((i) => part(i, [squareUp]));
const markers = [30, 31, 32, 33].map((i) => part(i, [squareUp]));
const cheeks = [21, 22].map((i) => part(i));
const hubMove = G.move(F[0] - 207.552, F[1] - 176.011);
const hub = [52, 53].map((i) => ({ d: G.str(G.mapPts(G.parse(grp(i).d), hubMove)), fill: grp(i).fill }));
const handLong = hand('M181.696 177.294');
const handShort = hand('M194.526 246.453');
const PIV = { 'bell-left': bellPivot(3), 'bell-right': bellPivot(8), hub: F };
const REST = { 'hand-long': 0, 'hand-short': 240 };

const fill = (p) => `<path d="${p.d}" fill="${p.fill === 'white' ? '#FFFFFF' : p.fill}"/>`;
const eyeDefault = eyeTargets(EYES[0]);
const mouthDefault = { segs: smile };
const dOf = (segs) => G.str(segs);

const eyeGroup = (side) => {
  const t = (k) => eyeDefault[`eye-${side}-${k}`];
  return `<g id="eye-${side}" data-anchor="${EYE[side].join(' ')}">
    <g id="eye-${side}-white" data-part="eye-white"><path id="eye-${side}-white-shape" d="${dOf(t('white')[0])}" fill="#FFFFFF"/></g>
    <g id="eye-${side}-pupil" data-part="pupil" clip-path="url(#eye-${side}-white-clip)"><path id="eye-${side}-pupil-shape" d="${dOf(t('pupil')[0])}" fill="${INK}"/></g>
    <g id="eye-${side}-lid" data-part="lid">
      <path id="eye-${side}-lid-skin" d="${dOf(t('lid-skin')[0])}" fill="${SKIN}" clip-path="url(#eye-${side}-lid-clip)"/>
      <path id="eye-${side}-lash" d="${dOf(t('lash')[0])}" opacity="0" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g id="eye-${side}-brow" data-part="brow"><path id="eye-${side}-brow-shape" d="${dOf(t('brow')[0])}" opacity="0" stroke="${side === 'left' ? '#3787FF' : '#3069CE'}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></g>
  </g>`;
};

const exprGroups = [];
const json = {
  name: 'Wakey face rig',
  version: 1,
  sources: ['Group.svg (head, bells, dial)', 'pic 4.svg (hands)', 'Group-1.svg (open mouth, tongue)', 'pic5.svg (happy eyes, smile)', 'pic 1.svg (asleep eyes, sleepy mouth)', 'Group 7524.svg (angry brows, scrunched eyes)'],
  viewBox: [0, 0, VB, VB],
  units: 'SVG user units of the viewBox; angles in degrees, clockwise, 0 = 12 o\'clock',
  anchors: { 'face-centre': F, 'eye-left': EYE.left, 'eye-right': EYE.right, mouth: MOUTH },
  colours: {
    'body-back': '#2D6CE7', ring: '#54A8FF', face: SKIN, 'face-shadow': '#B6E2FC', ticks: '#8AD7FF', cheeks: '#8AD7FF', markers: INK,
    'hand-long': '#3787FF', 'hand-short': '#2667D4', 'hub-base': '#50A8FE', 'hub-cap': '#67CDFC',
    'bell-dome': '#51A7FF', 'bell-shine': '#8AD6FF', 'bell-band': '#2B6AE5', 'bell-knob': '#93D1FF', 'bell-mouth': '#0D246B',
    'eye-white': '#FFFFFF', ink: INK, lid: SKIN, tongue: '#AA8ED6', 'brow-left': '#3787FF', 'brow-right': '#3069CE',
  },
  layerOrder: ['bell-left', 'bell-right', 'body-back', 'ring', 'face', 'face-shadow', 'ticks', 'markers', 'cheeks', 'eye-left', 'eye-right', 'mouth', 'hand-short', 'hand-long', 'hub'],
  parts: [
    { id: 'bell-left', pivot: PIV['bell-left'], note: 'where the stem enters the ring; ring it about this point' },
    { id: 'bell-right', pivot: PIV['bell-right'], note: 'where the stem enters body-back' },
    { id: 'body-back', pivot: null },
    { id: 'ring', pivot: null },
    { id: 'face', pivot: null },
    { id: 'face-shadow', pivot: null },
    { id: 'ticks', pivot: null, note: 'squared to the dial (Group.svg is turned ' + G.fmt(tilt) + ' degrees)' },
    { id: 'markers', pivot: null },
    { id: 'cheeks', pivot: null, note: 'extra: the #8AD7FF cheeks from Group.svg' },
    { id: 'hand-long', pivot: F, drawnAngle: 0, restAngle: REST['hand-long'], length: handLong.length, width: handLong.width, note: 'path points straight up; the group rotate() is the time' },
    { id: 'hand-short', pivot: F, drawnAngle: 0, restAngle: REST['hand-short'], length: handShort.length, width: handShort.width },
    { id: 'hub', pivot: F },
    ...['left', 'right'].map((s) => ({
      id: `eye-${s}`, anchor: EYE[s],
      children: {
        'eye-white': `eye-${s}-white`, pupil: `eye-${s}-pupil`, lid: `eye-${s}-lid`, brow: `eye-${s}-brow`,
      },
      targets: [`eye-${s}-white-shape`, `eye-${s}-lid-clip-shape`, `eye-${s}-pupil-shape`, `eye-${s}-lid-skin`, `eye-${s}-lash`, `eye-${s}-brow-shape`],
      clips: { pupil: `eye-${s}-white-clip (the white itself)`, lid: `eye-${s}-lid-clip (the white grown by 2)` },
    })),
    { id: 'mouth', anchor: MOUTH, targets: ['mouth-shape', 'mouth-tongue'], clips: { tongue: 'mouth-clip (the mouth shape)' } },
  ],
  rules: [
    'All parts share one viewBox; nothing is nested in a transform except the hands\' rotate().',
    'Every eye white and lid clip is centred on its eye anchor; pupils, lashes and brows are offsets from it.',
    'Every mouth\'s bounding box is centred on the mouth anchor.',
    'Paths in one family have the same commands, so any two expressions morph point by point.',
    'Opacity is part of an expression. Fade in over the last 40% of a morph and fade out over the first 40% (preview.html does this), so a lash appears when the lid arrives and pupils are gone before the happy arcs show.',
  ],
  families: {},
  expressions: { eyes: [], mouth: [] },
};

for (const e of EYES) {
  const targets = eyeTargets(e);
  const gid = `eyes-${e.name}`;
  const kids = [], entry = { name: e.name, group: gid, ...(e.src && { source: e.src }), ...(e.note && { note: e.note }), ...(e.extra && { extra: true }), targets: {} };
  for (const [k, [segs, op]] of Object.entries(targets)) {
    const tid = /-(white|pupil|brow|lid-clip)$/.test(k) ? `${k}-shape` : k;
    const d = dOf(segs);
    check(famOf(k), d);
    const id = `${gid}--${k}`;
    kids.push(`<path id="${id}" data-target="${tid}" d="${d}" opacity="${op}"/>`);
    entry.targets[tid] = { id, d, opacity: op };
  }
  exprGroups.push(`<g id="${gid}" data-family="eyes">${kids.join('')}</g>`);
  json.expressions.eyes.push(entry);
}
for (const m of MOUTHS) {
  const gid = `mouth-${m.name}`;
  const d = dOf(m.segs), td = dOf(tongue);
  check('mouth', d);
  check('tongue', td);
  exprGroups.push(`<g id="${gid}" data-family="mouth"><path id="${gid}--mouth" data-target="mouth-shape" d="${d}" opacity="1"/><path id="${gid}--tongue" data-target="mouth-tongue" d="${td}" opacity="${m.tongue ? 1 : 0}"/></g>`);
  json.expressions.mouth.push({ name: m.name, group: gid, ...(m.src && { source: m.src }), targets: { 'mouth-shape': { id: `${gid}--mouth`, d, opacity: 1 }, 'mouth-tongue': { id: `${gid}--tongue`, d: td, opacity: m.tongue ? 1 : 0 } } });
}
json.families = Object.fromEntries(Object.entries(famSig).map(([k, s]) => [k, s]));
json.defaults = { eyes: 'neutral', mouth: 'smile' };

const cross = (p, c) => `<g stroke="${c}" stroke-width="1.5"><path d="M${p[0] - 6} ${p[1]}H${p[0] + 6}M${p[0]} ${p[1] - 6}V${p[1] + 6}"/><circle cx="${p[0]}" cy="${p[1]}" r="3" fill="none"/></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" width="${VB}" height="${VB}" fill="none">
<title>Wakey face rig</title>
<desc>Head-only rig of the Wakey alarm clock. One viewBox for every part and expression. Pivots and expression data: face-rig.json. Expressions live in #expressions (hidden): each path's data-target names the live shape it drives.</desc>
<defs>
  <clipPath id="eye-left-white-clip"><use href="#eye-left-white-shape"/></clipPath>
  <clipPath id="eye-right-white-clip"><use href="#eye-right-white-shape"/></clipPath>
  <clipPath id="eye-left-lid-clip"><path id="eye-left-lid-clip-shape" d="${dOf(eyeDefault['eye-left-lid-clip'][0])}"/></clipPath>
  <clipPath id="eye-right-lid-clip"><path id="eye-right-lid-clip-shape" d="${dOf(eyeDefault['eye-right-lid-clip'][0])}"/></clipPath>
  <clipPath id="mouth-clip"><use href="#mouth-shape"/></clipPath>
</defs>
<g id="bell-left" data-pivot="${PIV['bell-left'].join(' ')}">${bellL.map(fill).join('')}</g>
<g id="bell-right" data-pivot="${PIV['bell-right'].join(' ')}">${bellR.map(fill).join('')}</g>
<g id="body-back">${fill(part(12))}</g>
<g id="ring">${fill(part(14))}</g>
<g id="face">${fill(part(15))}</g>
<g id="face-shadow">${fill(part(16))}</g>
<g id="ticks">${ticks.map(fill).join('')}</g>
<g id="markers">${markers.map(fill).join('')}</g>
<g id="cheeks">${cheeks.map(fill).join('')}</g>
${eyeGroup('left')}
${eyeGroup('right')}
<g id="mouth" data-anchor="${MOUTH.join(' ')}"><path id="mouth-shape" d="${dOf(mouthDefault.segs)}" fill="${INK}"/><g clip-path="url(#mouth-clip)"><path id="mouth-tongue" d="${dOf(tongue)}" fill="#AA8ED6" opacity="0"/></g></g>
<g id="hand-short" data-pivot="${F.join(' ')}" transform="rotate(${REST['hand-short']} ${F.join(' ')})"><path d="${handShort.d}" fill="${handShort.fill}"/></g>
<g id="hand-long" data-pivot="${F.join(' ')}" transform="rotate(${REST['hand-long']} ${F.join(' ')})"><path d="${handLong.d}" fill="${handLong.fill}"/></g>
<g id="hub" data-pivot="${F.join(' ')}">${hub.map(fill).join('')}</g>
<g id="expressions" display="none">
${exprGroups.join('\n')}
</g>
</svg>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'face-rig.svg'), svg);
fs.writeFileSync(path.join(OUT, 'face-rig.json'), JSON.stringify(json, null, 2) + '\n');
const tpl = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'preview.tpl.html'), 'utf8');
fs.writeFileSync(path.join(OUT, 'preview.html'), tpl.replace('/*SVG*/', () => svg).replace('/*JSON*/', () => JSON.stringify({ pivots: PIV, anchors: json.anchors, rest: REST, eyes: EYES.map((e) => e.name), mouths: MOUTHS.map((m) => m.name) })));
console.log('tilt', G.fmt(tilt), 'pivots', JSON.stringify(PIV), 'hands', handLong.sourceAngle, handShort.sourceAngle, handLong.length, handShort.length);
console.log('families', JSON.stringify(famSig));
console.log('svg bytes', svg.length);
