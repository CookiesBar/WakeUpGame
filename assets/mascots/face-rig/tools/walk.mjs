// walk.mjs: Wakey's walk cycle, from the Good morning pose (pic5), in face-rig units.
// v4: walks to the LEFT, 6° lean, both arms swing, nothing in the hands, and a live face on its own clock
// (eyes: neutral with random glances and blinks, or happy closed; mouth: closed smile or open happy).
// Run: node assets/mascots/face-rig/tools/walk.mjs [sheetProjectDir]
// Reads ../face-rig.svg and ../face-rig.json; writes ../walk-cycle.svg (CSS + SMIL animated) and ../walk-cycle.json.
// With a sheet project folder it also writes the mascot sheet's Walk board files (img/walk-*.svg, Walk.dc.html from walk.tpl.html).
import fs from 'fs';
import path from 'path';
import { parse, str, mapPts } from './geo.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const RIG = path.join(HERE, '..'), SHEET = process.argv[2]; // the sheet folder is optional

// ---------- tokens ----------
const DIR = -1; // walking direction: -1 = left
const T = {
  period: 1000, // two steps
  samples: 40, // baked CSS keyframes per loop (every 25 ms)
  lean: 6, // lean into the walk, degrees
  pivot: [150, 184], // the body leans and rocks around the hub
  leg: { len: 50, foot: 22, width: 24, colour: '#54A8FF' }, // thigh = shin = len; the foot points the way it walks
  hipWorld: { left: [100, 285], right: [220, 285] }, // where the hips sit at the base lean; both hidden behind the body
  ground: 379, // ankle centre line when a foot is flat (world): low enough that the standing leg is nearly straight
  reach: 28, back: 54, // ankle x at contact = hip + DIR * reach; at toe-off = hip - DIR * back
  stance: 580, // ms each foot is on the ground; heel strike at 0 (left) and 500 (right)
  arm: { upper: 54, fore: 52, width: 20, colour: '#BCE5FE' },
  shoulder: { left: [38, 176], right: [283, 170] }, // body-local. Left (far) behind the ring; right (near) on the back plate, in front of the body
  shadow: { cx: 160, cy: 392, rx: 126, ry: 8, colour: '#020628', opacity: 0.08 },
  follow: { forearm: [100, 0.5], bells: [110, 1.4] }, // [delay ms, gain]
  landDip: { deg: 2, from: 20, len: 280 },
  hands: { long: 0, short: 240 }, // 8:00, the rig's rest: the short hand only clips the open mouth's corner
  face: { loop: 23400, morph: 380, glide: 450, blink: [110, 40, 190], seed: 7 }, // its own clock, separate from the walk
};
// periodic flow keys [ms, value]
const K = {
  lift: [[60, -2.5], [290, 3], [560, -2.2], [790, 2.6]],
  surge: [[60, -1.2], [290, 1.2], [560, -1.2], [790, 1.2]], // along the walk
  rock: [[60, -0.6], [290, 0.5], [560, -0.6], [790, 0.5]], // added to the base lean
  // per leg, in the leg's own time (0 = its heel strike)
  toe: [[0, -14], [90, 0], [400, 0], [580, 40], [630, 100], [810, 10], [920, -8]], // + = toes down
  swingX: (c, to) => [[580, to], [630, to - DIR * 19], [930, c + DIR * 2], [1000, c]], // kicks straight back first, like pic5
  swingY: (g, yto) => [[580, yto], [630, g - 22], [830, g - 20], [900, g - 6], [1000, g]],
  // arms swing against the legs: + = forward (the way it walks), degrees from hanging straight down
  armSwing: { left: [[40, -16], [540, 28]], right: [[40, 16], [540, -26]] }, // the near arm swings less forward, so it stays on the ring, off the face
  elbow: { left: [[40, 6], [540, 36]], right: [[40, 24], [540, 4]] }, // forearm bends forward on the forward swing
  armOut: { left: 6, right: -8 }, // degrees each arm hangs away from the body (asymmetric)
  land: [0, 500],
};
const PHASE = { left: 0, right: 500 };

// ---------- engine (same maths as utils/motion.ts) ----------
function flow(t, k) {
  const n = k.length;
  if (t <= k[0][0]) return k[0][1];
  if (t >= k[n - 1][0]) return k[n - 1][1];
  let i = 0;
  while (k[i + 1][0] < t) i++;
  const slope = (j) => (k[j + 1][1] - k[j][1]) / (k[j + 1][0] - k[j][0]);
  const tangent = (j) => {
    if (j === 0 || j === n - 1) return 0;
    const a = slope(j - 1), b = slope(j);
    if (a * b <= 0) return 0;
    const h0 = k[j][0] - k[j - 1][0], h1 = k[j + 1][0] - k[j][0];
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / a + w1 / b);
  };
  const h = k[i + 1][0] - k[i][0], s = (t - k[i][0]) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * k[i][1] + (s3 - 2 * s2 + s) * h * tangent(i) + (-2 * s3 + 3 * s2) * k[i + 1][1] + (s3 - s2) * h * tangent(i + 1);
}
const P = T.period;
const wrap = (t) => ((t % P) + P) % P;
const pflow = (t, keys) => flow(wrap(t), [...keys.map(([a, v]) => [a - P, v]), ...keys, ...keys.map(([a, v]) => [a + P, v])]);
const bell = (p) => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const rot = ([x, y], a, [ox, oy]) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]; };
const ang = ([x, y]) => deg(Math.atan2(-x, y)); // clockwise from pointing straight down
const r2 = (n) => Math.round(n * 100) / 100;

const FWD = -DIR; // walking left, a limb hanging down swings forward clockwise
const baseLean = DIR * T.lean; // negative = counterclockwise = leaning left
const HIP = Object.fromEntries(Object.entries(T.hipWorld).map(([s, p]) => [s, rot(p, -baseLean, T.pivot)])); // body-local hips

// ---------- one frame of the walk ----------
let clamps = 0;
function legTarget(side, t) {
  const tau = wrap(t - PHASE[side]), hx = T.hipWorld[side][0], G = T.ground, F = T.leg.foot, S = T.stance;
  const cx = hx + DIR * T.reach, tx = hx - DIR * T.back;
  const phi = pflow(tau, K.toe);
  // heel pivot while the toes are up, toe-tip pivot once the heel lifts
  const footAt = (flatX, phi) => (phi <= 0 ? [flatX, G] : [flatX + DIR * (F - F * Math.cos(rad(phi))), G - F * Math.sin(rad(phi))]);
  if (tau <= S) { const ankle = footAt(cx + ((tx - cx) * tau) / S, phi); return { ankle, phi, lifted: G - ankle[1] }; }
  const [xto, yto] = footAt(tx, pflow(S, K.toe));
  const ankle = [flow(tau, K.swingX(cx, xto)), flow(tau, K.swingY(G, yto))];
  return { ankle, phi, lifted: G - ankle[1] };
}
function frame(t) {
  const lift = pflow(t, K.lift), shift = DIR * pflow(t, K.surge), lean = baseLean + DIR * pflow(t, K.rock);
  const toWorld = (p) => { const q = rot(p, lean, T.pivot); return [q[0] + shift, q[1] - lift]; };
  const toLocal = (w) => rot([w[0] - shift, w[1] + lift], -lean, T.pivot);
  const out = { body: { t: [shift, -lift], r: lean, o: T.pivot }, joints: {}, target: {}, lifted: {}, lift, shift, lean };
  for (const side of ['left', 'right']) {
    const L = T.leg.len, H = HIP[side];
    const { ankle, phi, lifted } = legTarget(side, t);
    out.target[side] = ankle; out.lifted[side] = lifted;
    let A = toLocal(ankle);
    let v = [A[0] - H[0], A[1] - H[1]], d = Math.hypot(...v);
    if (d > 0.998 * 2 * L) { clamps++; const k = (0.998 * 2 * L) / d; v = [v[0] * k, v[1] * k]; d = 0.998 * 2 * L; A = [H[0] + v[0], H[1] + v[1]]; }
    const kh = Math.sqrt(L * L - (d / 2) ** 2), n = [(DIR * v[1]) / d, (DIR * -v[0]) / d]; // knees bend the way it walks
    const Kn = [H[0] + v[0] / 2 + n[0] * kh, H[1] + v[1] / 2 + n[1] * kh];
    const th1 = ang([Kn[0] - H[0], Kn[1] - H[1]]), th2 = ang([A[0] - Kn[0], A[1] - Kn[1]]);
    out[`thigh-${side}`] = { r: th1, o: H };
    out[`shin-${side}`] = { r: th2 - th1, o: [H[0], H[1] + L] };
    out[`foot-${side}`] = { r: DIR * phi - lean - th2, o: [H[0], H[1] + 2 * L] }; // toes down: counterclockwise for a foot pointing left
    out.joints[`hip-${side}`] = toWorld(H); out.joints[`knee-${side}`] = toWorld(Kn); out.joints[`ankle-${side}`] = toWorld(A);
    // arms hang from gravity (undo the lean), swing against the legs, and the forearm trails the swing
    const S = T.shoulder[side], [fd, fg] = T.follow.forearm;
    const swing = (tt) => pflow(tt, K.armSwing[side]);
    const up = FWD * swing(t) + K.armOut[side] - lean; // armOut: + hangs out to the left, - out to the right
    const el = FWD * (pflow(t, K.elbow[side]) + fg * (swing(t - fd) - swing(t)));
    out[`upper-arm-${side}`] = { r: up, o: S };
    out[`forearm-${side}`] = { r: el, o: [S[0], S[1] + T.arm.upper] };
    out.joints[`shoulder-${side}`] = toWorld(S); out.joints[`elbow-${side}`] = toWorld(rot([S[0], S[1] + T.arm.upper], up, S));
  }
  const [bd, bg] = T.follow.bells;
  const ft = bg * (DIR * pflow(t - bd, K.rock) - DIR * pflow(t, K.rock));
  let dip = 0;
  for (const l of K.land) { const q = wrap(t - l - T.landDip.from); if (q < T.landDip.len) dip += T.landDip.deg * bell(q / T.landDip.len); }
  out['bell-left'] = { r: ft - dip, o: [79.44, 84.4] };
  out['bell-right'] = { r: ft + dip, o: [248.59, 90.31] };
  out.joints['bell-left'] = toWorld([79.44, 84.4]); out.joints['bell-right'] = toWorld([248.59, 90.31]);
  out.shadow = { dx: 0.5 * shift, sx: 1 - 0.03 * ((out.lifted.left + out.lifted.right) / 26) - lift / 250 };
  out.joints.pivot = toWorld(T.pivot);
  return out;
}

// ---------- check: the legs reach their targets (planted feet only move with the ground) ----------
{
  let worst = 0;
  for (let t = 0; t < P; t += 5) {
    const f = frame(t);
    for (const s of ['left', 'right']) worst = Math.max(worst, Math.hypot(f.joints[`ankle-${s}`][0] - f.target[s][0], f.joints[`ankle-${s}`][1] - f.target[s][1]));
  }
  if (worst > 0.05) throw new Error(`ankle misses its target by ${worst.toFixed(3)} (clamped ${clamps})`);
  console.log('ankles on target, worst miss', worst.toFixed(4), 'clamped frames', clamps, 'hips local', JSON.stringify(Object.fromEntries(Object.entries(HIP).map(([k, p]) => [k, p.map(r2)]))));
}

// ---------- the live face: its own random (seeded) timeline, separate from the walk ----------
const rig = fs.readFileSync(path.join(RIG, 'face-rig.svg'), 'utf8');
const rigJson = JSON.parse(fs.readFileSync(path.join(RIG, 'face-rig.json'), 'utf8'));
const EXPR = (fam, name) => rigJson.expressions[fam].find((e) => e.name === name).targets;
const NEU = EXPR('eyes', 'neutral'), HAP = EXPR('eyes', 'happy-closed'), BLK = EXPR('eyes', 'blink-closed');
const MOUTH = { smile: EXPR('mouth', 'smile'), open: EXPR('mouth', 'open-shout') };
const shiftD = (d, dx, dy) => str(mapPts(parse(d), ([x, y]) => [x + dx, y + dy]));
function eyeTargets(s) {
  if (s.kind === 'happy') return HAP;
  const out = { ...NEU };
  if (s.kind === 'blink') for (const k of Object.keys(BLK)) if (/lid-skin|lash/.test(k)) out[k] = BLK[k];
  for (const side of ['left', 'right']) { const k = `eye-${side}-pupil-shape`; out[k] = { ...NEU[k], d: shiftD(NEU[k].d, s.gx, s.gy) }; }
  return out;
}
function mulberry(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FL = T.face.loop;
function gazeFrom(rand, prev) {
  if (prev.gx !== 0 || prev.gy !== 0) if (rand() < 0.2) return { kind: 'neutral', gx: 0, gy: 0 };
  for (;;) {
    const g = { kind: 'neutral', gx: Math.round((rand() * 14 - 8) * 10) / 10, gy: Math.round((rand() * 15 - 7) * 10) / 10 }; // a little more often ahead (left)
    if (Math.hypot(g.gx - (prev.gx || 0), g.gy - (prev.gy || 0)) >= 4.5) return g;
  }
}
function eyeTimeline(rand) {
  const start = { kind: 'neutral', gx: 0, gy: 0 };
  const pts = [{ t: 0, s: start, e: 'hold' }];
  let t = 0, cur = start, lastBlink = -1500;
  const push = (dt, s, e) => { t += dt; pts.push({ t, s, e }); };
  for (;;) {
    const hold = cur.kind === 'happy' ? 1300 + rand() * 900 : 1100 + rand() * 1300;
    if (t + hold + 900 > FL) break;
    if (cur.kind === 'neutral' && t - lastBlink > 2600 && hold > 900) {
      const [c, h, o] = T.face.blink, at = 300 + rand() * (hold - 700), shut = { ...cur, kind: 'blink' };
      push(at, cur, 'hold'); lastBlink = t; push(c, shut, 'io'); push(h, shut, 'hold'); push(o, cur, 'out'); push(hold - at - c - h - o, cur, 'hold');
    } else push(hold, cur, 'hold');
    const next = cur.kind === 'happy' ? gazeFrom(rand, { gx: 9, gy: 9 }) : rand() < 0.32 ? { kind: 'happy' } : gazeFrom(rand, cur);
    push(next.kind !== cur.kind ? T.face.morph : T.face.glide, next, 'io');
    cur = next;
  }
  const dur = cur.kind === 'happy' ? T.face.morph : T.face.glide;
  if (FL - dur > t) pts.push({ t: FL - dur, s: cur, e: 'hold' });
  pts.push({ t: FL, s: start, e: 'io' });
  return pts;
}
function mouthTimeline(rand) {
  const pts = [{ t: 0, s: 'smile', e: 'hold' }];
  let t = 0, cur = 'smile';
  for (;;) {
    const hold = cur === 'smile' ? 1700 + rand() * 2000 : 1100 + rand() * 1400;
    if (t + hold + 800 > FL) break;
    t += hold; pts.push({ t, s: cur, e: 'hold' });
    const next = cur === 'smile' ? 'open' : 'smile';
    t += T.face.morph; pts.push({ t, s: next, e: 'io' });
    cur = next;
  }
  if (cur === 'open') { if (FL - T.face.morph > t) pts.push({ t: FL - T.face.morph, s: cur, e: 'hold' }); pts.push({ t: FL, s: 'smile', e: 'io' }); }
  else pts.push({ t: FL, s: 'smile', e: 'hold' });
  return pts;
}
const rand = mulberry(T.face.seed);
const EYES = eyeTimeline(rand), MOUTHS = mouthTimeline(rand);
const SPL = { hold: '0 0 1 1', io: '0.77 0 0.175 1', out: '0.23 1 0.32 1' };
const kt = (ts) => ts.map((t) => (t / FL).toFixed(5)).join(';');
function smil(pts, targetsOf, tid) {
  const all = pts.map((p) => targetsOf(p.s)[tid]);
  let out = '';
  const ds = all.map((x) => x.d);
  if (new Set(ds).size > 1) out += `<animate attributeName="d" dur="${FL}ms" repeatCount="indefinite" calcMode="spline" keyTimes="${kt(pts.map((p) => p.t))}" keySplines="${pts.slice(1).map((p) => SPL[p.e]).join(';')}" values="${ds.join(';')}"/>`;
  const os = all.map((x) => x.opacity);
  if (new Set(os).size > 1) {
    // the rig's fade rule: opacity rises over the last 40% of a morph and falls over the first 40%
    const ts = [0], vs = [os[0]], sp = [];
    for (let i = 1; i < pts.length; i++) {
      const t0 = pts[i - 1].t, t1 = pts[i].t, o0 = os[i - 1], o1 = os[i];
      if (o0 === o1) { ts.push(t1); vs.push(o1); sp.push(SPL.hold); continue; }
      if (o1 > o0) { ts.push(t0 + 0.6 * (t1 - t0), t1); vs.push(o0, o1); sp.push(SPL.hold, SPL.io); }
      else { ts.push(t0 + 0.4 * (t1 - t0), t1); vs.push(o1, o1); sp.push(SPL.io, SPL.hold); }
    }
    out += `<animate attributeName="opacity" dur="${FL}ms" repeatCount="indefinite" calcMode="spline" keyTimes="${kt(ts)}" keySplines="${sp.join(';')}" values="${vs.join(';')}"/>`;
  }
  return out;
}
const EYE_IDS = Object.keys(NEU), MOUTH_IDS = Object.keys(MOUTH.smile);

// ---------- rig parts ----------
function poseRig(targets) {
  let s = rig;
  for (const [tid, { d, opacity }] of Object.entries(targets)) {
    const re = new RegExp(`(<path id="${tid}" d=")[^"]*(")([^>]*?)(/?>)`);
    if (!re.test(s)) throw new Error('no target ' + tid);
    s = s.replace(re, (mm, a, b, rest, end) => a + d + b + rest.replace(/\sopacity="[^"]*"/, '') + ` opacity="${opacity}"` + end);
  }
  s = s.replace('<g id="hand-short" data-pivot="150 184" transform="rotate(240 150 184)">', `<g id="hand-short" data-pivot="150 184" transform="rotate(${T.hands.short} 150 184)">`);
  if (!s.includes(`rotate(${T.hands.short} 150 184)`)) throw new Error('hand-short not set');
  return s;
}
function grab(src, id) {
  const start = src.indexOf(`<g id="${id}"`);
  if (start < 0) throw new Error('no part ' + id);
  const re = /<g[\s>]|<\/g>/g;
  re.lastIndex = start;
  let m, depth = 0;
  while ((m = re.exec(src)) !== null) { depth += m[0] === '</g>' ? -1 : 1; if (depth === 0) return src.slice(start, m.index + 4); }
  throw new Error('unclosed ' + id);
}
const preWith = (p) => (s) => s.replace(/id="/g, `id="${p}`).replace(/url\(#/g, `url(#${p}`).replace(/href="#/g, `href="#${p}`).replace(/\s?data-(pivot|anchor|part)="[^"]*"/g, '');
const pre = preWith('walk-');
const faceTargets = (eyes, mouth) => ({ ...eyeTargets(eyes), ...MOUTH[mouth] });
const START = { eyes: EYES[0].s, mouth: 'smile' };
const BASE = poseRig(faceTargets(START.eyes, START.mouth));
const part = (id) => pre(grab(BASE, id));
const defsOf = (src) => src.match(/<defs>[\s\S]*?<\/defs>/)[0].replace(/<\/?defs>/g, '');
const FACE_IDS = ['eye-left', 'eye-right', 'mouth'];
const injectSmil = (s, prefix) => {
  for (const tid of EYE_IDS) s = s.replace(new RegExp(`(<path id="${prefix}${tid}"[^>]*?)(\\/>|>\\s*<\\/path>)`), (m, a) => `${a}>${smil(EYES, eyeTargets, tid)}</path>`);
  for (const tid of MOUTH_IDS) s = s.replace(new RegExp(`(<path id="${prefix}${tid}"[^>]*?)(\\/>|>\\s*<\\/path>)`), (m, a) => `${a}>${smil(MOUTHS, (k) => MOUTH[k], tid)}</path>`);
  return s;
};
// static face for a given state, or the live face (SMIL) plus a still copy for Reduce Motion
function faceMarkup(state) {
  if (state) { const src = poseRig(faceTargets(state.eyes, state.mouth)); return { defs: pre(defsOf(src)), parts: FACE_IDS.map((id) => pre(grab(src, id))).join('') }; }
  const live = injectSmil(FACE_IDS.map((id) => pre(grab(BASE, id))).join(''), 'walk-');
  const liveDefs = injectSmil(pre(defsOf(BASE)), 'walk-');
  const still = preWith('walk-still-');
  return { defs: liveDefs + still(defsOf(BASE)), parts: `<g class="wk-face-live">${live}</g><g class="wk-face-still">${FACE_IDS.map((id) => still(grab(BASE, id))).join('')}</g>` };
}

const seg = (x, y, len, w, c) => `<path d="M${r2(x)} ${r2(y)}V${r2(y + len)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
function leg(side, at) {
  const [x, y] = HIP[side], L = T.leg.len, c = T.leg.colour, w = T.leg.width;
  return `<g id="walk-thigh-${side}"${at(`thigh-${side}`)}>${seg(x, y, L, w, c)}<g id="walk-shin-${side}"${at(`shin-${side}`)}>${seg(x, y + L, L, w, c)}<g id="walk-foot-${side}"${at(`foot-${side}`)}><path d="M${r2(x)} ${r2(y + 2 * L)}H${r2(x + DIR * T.leg.foot)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/></g></g></g>`;
}
function arm(side, at) {
  const [x, y] = T.shoulder[side], { upper, fore, width, colour } = T.arm;
  return `<g id="walk-upper-arm-${side}"${at(`upper-arm-${side}`)}>${seg(x, y, upper, width, colour)}<g id="walk-forearm-${side}"${at(`forearm-${side}`)}>${seg(x, y + upper, fore, width, colour)}</g></g>`;
}
const SH = T.shadow;
const VB = [-56, -6, 440, 414];
const ANIM = ['body', 'thigh-left', 'shin-left', 'foot-left', 'thigh-right', 'shin-right', 'foot-right', 'upper-arm-left', 'forearm-left', 'upper-arm-right', 'forearm-right', 'bell-left', 'bell-right', 'shadow'];

function tf(f, id, css) {
  const n = (v) => r2(v) + (css ? 'px' : '');
  const sep = css ? ', ' : ' ';
  if (id === 'shadow') {
    const { dx, sx } = f.shadow;
    return `translate(${n(SH.cx + dx)}${sep}${n(SH.cy)}) scale(${r2(sx * 1000) / 1000}${sep}1) translate(${n(-SH.cx)}${sep}${n(-SH.cy)})`;
  }
  const p = f[id], [ox, oy] = p.o, [tx, ty] = p.t || [0, 0];
  return `translate(${n(ox + tx)}${sep}${n(oy + ty)}) rotate(${r2(p.r)}${css ? 'deg' : ''}) translate(${n(-ox)}${sep}${n(-oy)})`;
}

// returns { defs, body } for a walk frame; face = null for the live face, or { eyes, mouth } for a still one
function figure(f, { animated = false, joints = false, face = START } = {}) {
  const at = (id) => (animated ? ` class="wk-${id}"` : ` transform="${tf(f, id, false)}"`);
  const withAt = (id, s) => s.replace(`<g id="walk-${id}"`, `<g id="walk-${id}"${at(id)}`);
  const fm = faceMarkup(face);
  let body = '';
  body += `<g id="walk-arm-left">${arm('left', at)}</g>`; // far arm, behind everything
  body += `<g id="walk-leg-left">${leg('left', at)}</g><g id="walk-leg-right">${leg('right', at)}</g>`;
  body += withAt('bell-left', part('bell-left')) + withAt('bell-right', part('bell-right'));
  body += ['body-back', 'ring', 'face', 'face-shadow', 'ticks', 'markers', 'cheeks'].map(part).join('');
  body += fm.parts;
  body += ['hand-short', 'hand-long', 'hub'].map(part).join('');
  body += `<g id="walk-arm-right">${arm('right', at)}</g>`; // near arm, in front of the body
  const shadow = `<ellipse id="walk-shadow"${at('shadow')} cx="${SH.cx}" cy="${SH.cy}" rx="${SH.rx}" ry="${SH.ry}" fill="${SH.colour}" fill-opacity="${SH.opacity}"/>`;
  let dots = '';
  if (joints) for (const [k, [x, y]] of Object.entries(f.joints)) dots += `<circle cx="${r2(x)}" cy="${r2(y)}" r="5.5" fill="${k === 'pivot' ? '#FFB020' : k.startsWith('bell') ? '#E0457B' : '#020628'}" stroke="#FFFFFF" stroke-width="2.5"/>`;
  return { defs: fm.defs, body: `${shadow}<g id="walk-body"${at('body')}>${body}</g>${dots}` };
}

const REST = 625; // reduced motion holds this frame: the Good morning stride
function css(keepReduced) {
  let s = `.wk *{transform-origin:0 0}\n.wk-face-still{display:none}\n`;
  s += ANIM.map((id) => `.wk-${id}{animation:wk-${id} ${P}ms linear infinite}`).join('\n') + '\n';
  for (const id of ANIM) {
    s += `@keyframes wk-${id}{`;
    for (let i = 0; i <= T.samples; i++) s += `${r2((i / T.samples) * 100)}%{transform:${tf(frame((i / T.samples) * P), id, true)}}`;
    s += '}\n';
  }
  if (keepReduced) s += `@media (prefers-reduced-motion: reduce){${ANIM.map((id) => `.wk-${id}`).join(',')}{animation:none}.wk-face-live{display:none}.wk-face-still{display:inline}}\n`;
  s += ANIM.map((id) => `.wk-${id}{transform:${tf(frame(REST), id, true)}}`).join('\n');
  return s;
}

const svgOpen = (w, title, desc, vb = VB) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${w}" height="${r2((w * vb[3]) / vb[2])}" fill="none">\n<title>${title}</title>\n<desc>${desc}</desc>\n`;
const DESC = 'Wakey walking to the left in place, from the Good morning pose (pic5), in face-rig units (head centre 150,184). Two steps per 1000 ms (CSS). The face runs on its own 23.4 s clock (SMIL): eyes neutral with random glances and blinks, or happy closed; mouth closed smile or open. Every limb is a chain of groups rotating around its pivot (walk-cycle.json). Generated by walk.mjs: change the tokens there, not this file.';
function svgFile(keepReduced) {
  const { defs, body } = figure(frame(REST), { animated: true, face: null });
  return `${svgOpen(440, 'Wakey walk cycle', DESC)}<defs>${defs}</defs>\n<style>\n${css(keepReduced)}\n</style>\n<g class="wk">${body}</g>\n</svg>\n`;
}
function stillFile(t, face, opts = {}, vb = VB, w = 440) {
  const { defs, body } = figure(frame(t), { face, ...opts });
  return `${svgOpen(w, `Walk frame at ${t} ms`, DESC, vb)}<defs>${defs}</defs>\n${body}\n</svg>\n`;
}
fs.writeFileSync(path.join(RIG, 'walk-cycle.svg'), svgFile(true));

// ---------- sheet frames (only with a sheet folder) ----------
if (SHEET) {
const IMG = path.join(SHEET, 'img');
fs.writeFileSync(path.join(IMG, 'walk-cycle.svg'), svgFile(false)); // the sheet's copy always plays
const KEYS = [0, 125, 250, 375, 500, 625, 750, 875];
KEYS.forEach((t, i) => fs.writeFileSync(path.join(IMG, `walk-key-${i}.svg`), stillFile(t, START)));
fs.writeFileSync(path.join(IMG, 'walk-joints.svg'), stillFile(REST, START, { joints: true }));
for (const f of fs.readdirSync(IMG)) if (f.startsWith('walk-item') || f.startsWith('walk-face-')) fs.unlinkSync(path.join(IMG, f));
// face states, cropped to the head
const hub = frame(REST).joints.pivot, FACE_VB = [r2(hub[0] - 150), r2(hub[1] - 168), 300, 290];
const FACES = [
  ['look-ahead', { kind: 'neutral', gx: -7, gy: -1 }, 'smile'],
  ['look-up', { kind: 'neutral', gx: 4, gy: -7 }, 'open'],
  ['blink', { kind: 'blink', gx: 0, gy: 0 }, 'smile'],
  ['happy', { kind: 'happy' }, 'smile'],
  ['happy-open', { kind: 'happy' }, 'open'],
  ['look-down', { kind: 'neutral', gx: -3, gy: 7 }, 'smile'],
];
for (const [name, eyes, mouth] of FACES) fs.writeFileSync(path.join(IMG, `walk-face-${name}.svg`), stillFile(REST, { eyes, mouth }, {}, FACE_VB, 300));

// ---------- timing chart (inline SVG for the board) ----------
const CW = 1000, CH = 300, pad = 16;
const lanes = [
  { name: 'Left foot height', c: '#2D6CE7', f: (t) => frame(t).lifted.left, lo: 0, hi: 28 },
  { name: 'Right foot height', c: '#54A8FF', f: (t) => frame(t).lifted.right, lo: 0, hi: 28 },
  { name: 'Body lift', c: '#020628', f: (t) => pflow(t, K.lift), lo: -3, hi: 3.5 },
  { name: 'Near arm', c: '#FFB020', f: (t) => pflow(t, K.armSwing.right), lo: -28, hi: 18 },
];
const laneH = (CH - pad * 2) / lanes.length;
let chart = `<svg viewBox="0 0 ${CW} ${CH}" width="100%" height="${CH}" preserveAspectRatio="none" style="display:block">`;
for (const x of [0, 250, 500, 750, 1000]) chart += `<line x1="${x}" x2="${x}" y1="0" y2="${CH}" stroke="#D6E9F8" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
for (const l of K.land) chart += `<line x1="${l + 2}" x2="${l + 2}" y1="0" y2="${CH}" stroke="#FFB020" stroke-width="2" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>`;
lanes.forEach((ln, i) => {
  const y0 = pad + i * laneH, pts = [];
  for (let t = 0; t <= P; t += 10) pts.push(`${t},${r2(y0 + laneH - 8 - ((ln.f(t) - ln.lo) / (ln.hi - ln.lo)) * (laneH - 16))}`);
  chart += `<polyline points="${pts.join(' ')}" stroke="${ln.c}" stroke-width="3" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
});
chart += '</svg>';
// face timeline strip: eyes (neutral / happy, blink ticks) and mouth (smile / open), first 12 s
const SW = 1000, span = 12000, x = (t) => r2((t / span) * SW);
let strip = `<svg viewBox="0 0 ${SW} 64" width="100%" height="64" preserveAspectRatio="none" style="display:block">`;
const bar = (pts, y, isOn, col) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (a.t >= span) break; if (isOn(a.s) && isOn(b.s)) strip += `<rect x="${x(a.t)}" y="${y}" width="${r2(x(Math.min(b.t, span)) - x(a.t))}" height="22" rx="4" fill="${col}"/>`; } };
strip += `<rect x="0" y="4" width="${SW}" height="22" rx="4" fill="#E1F5FF"/><rect x="0" y="38" width="${SW}" height="22" rx="4" fill="#E1F5FF"/>`;
bar(EYES, 4, (s) => s.kind === 'happy', '#2D6CE7');
for (const p of EYES) if (p.s.kind === 'blink' && p.e === 'io' && p.t < span) strip += `<rect x="${x(p.t) - 1.5}" y="4" width="3" height="22" fill="#020628"/>`;
bar(MOUTHS, 38, (s) => s === 'open', '#AA8ED6');
strip += '</svg>';
const tplPath = path.join(HERE, 'walk.tpl.html');
if (fs.existsSync(tplPath)) fs.writeFileSync(path.join(SHEET, 'Walk.dc.html'), fs.readFileSync(tplPath, 'utf8').replace('/*CHART*/', () => chart).replace('/*STRIP*/', () => strip).replace('/*LEGEND*/', () => lanes.map((l) => `<span style="display:inline-flex;align-items:center;gap:8px"><i style="width:18px;height:4px;border-radius:2px;background:${l.c};display:inline-block"></i>${l.name}</span>`).join('')));

}

// ---------- json ----------
const P2 = (p) => p.map(r2);
const json = {
  name: 'wakey-walk-cycle', version: 4,
  basedOn: 'pic5.svg (Good morning): lean, 7:00, the stride. Walks to the left, nothing in the hands, both arms swing, live face.',
  generatedBy: 'tools/walk.mjs', units: 'face-rig units: same space as face-rig.svg, head centre and hub at (150, 184)', viewBox: VB, periodMs: P,
  direction: 'left (-x)',
  engine: 'Read every walk channel with flow() from utils/motion.ts, made periodic: evaluate at t mod period with the keys copied one period before and after.',
  restFrameMs: REST,
  drawOrder: ['walk-shadow', 'walk-body > walk-arm-left (far), walk-leg-left, walk-leg-right, walk-bell-left, walk-bell-right, walk-body-back, walk-ring … walk-cheeks, the face (walk-eye-left, walk-eye-right, walk-mouth), walk-hand-short, walk-hand-long, walk-hub, walk-arm-right (near, in front)'],
  parts: {
    'walk-body': { pivot: T.pivot, moves: `translate(surge, -lift), then rotate(${baseLean}° + rock) around the pivot (negative = leaning left); carries everything except the shadow` },
    'walk-thigh-left': { pivot: P2(HIP.left), length: T.leg.len, width: T.leg.width, colour: T.leg.colour, drawn: 'straight down from the pivot' },
    'walk-shin-left': { parent: 'walk-thigh-left', pivot: P2([HIP.left[0], HIP.left[1] + T.leg.len]), length: T.leg.len },
    'walk-foot-left': { parent: 'walk-shin-left', pivot: P2([HIP.left[0], HIP.left[1] + 2 * T.leg.len]), length: T.leg.foot, drawn: 'horizontal, pointing left' },
    'walk-thigh-right': { pivot: P2(HIP.right), length: T.leg.len, width: T.leg.width, colour: T.leg.colour, drawn: 'straight down from the pivot' },
    'walk-shin-right': { parent: 'walk-thigh-right', pivot: P2([HIP.right[0], HIP.right[1] + T.leg.len]), length: T.leg.len },
    'walk-foot-right': { parent: 'walk-shin-right', pivot: P2([HIP.right[0], HIP.right[1] + 2 * T.leg.len]), length: T.leg.foot, drawn: 'horizontal, pointing left' },
    'walk-upper-arm-left': { pivot: T.shoulder.left, length: T.arm.upper, width: T.arm.width, colour: T.arm.colour, drawn: 'straight down; far arm, behind the body' },
    'walk-forearm-left': { parent: 'walk-upper-arm-left', pivot: [T.shoulder.left[0], T.shoulder.left[1] + T.arm.upper], length: T.arm.fore },
    'walk-upper-arm-right': { pivot: T.shoulder.right, length: T.arm.upper, width: T.arm.width, colour: T.arm.colour, drawn: 'straight down; near arm, in front of the body' },
    'walk-forearm-right': { parent: 'walk-upper-arm-right', pivot: [T.shoulder.right[0], T.shoulder.right[1] + T.arm.upper], length: T.arm.fore },
    'walk-bell-left': { pivot: [79.44, 84.4] }, 'walk-bell-right': { pivot: [248.59, 90.31] },
    'walk-shadow': { centre: [SH.cx, SH.cy], radii: [SH.rx, SH.ry], colour: SH.colour, opacity: SH.opacity },
  },
  keys: { ...K, swingX: '[[580, toeOffX], [630, toeOffX + 19], [930, contactX - 2], [1000, contactX]] (walking left)', swingY: '[[580, toeOffY], [630, ground - 22], [830, ground - 20], [900, ground - 6], [1000, ground]]' },
  derived: {
    feet: `Each foot runs on its own clock (left heel strike at 0, right at 500). Stance (0–580 ms): the flat foot slides right from hip x - ${T.reach} to hip x + ${T.back}, like a treadmill; toe angle < 0 pivots on the heel, > 0 on the toe tip. Swing (580–1000 ms): the ankle follows swingX / swingY.`,
    legs: 'Two-bone IK in body space, knees bending left (the way it walks). Thigh rotates around the hip, shin around the rest knee, foot around the rest ankle (foot rotation = -toe angle - body lean - shin angle).',
    arms: 'Each arm hangs straight down in the world (its rotation cancels the lean). Upper arm = armSwing + armOut - lean (clockwise degrees); forearm = elbow + 0.5 * (armSwing(t - 100) - armSwing(t)). Positive = forward (left). The arms swing against the legs.',
    bells: '1.4 * (lean(t - 110) - lean(t)), plus one 2° dip outward after each heel strike (bell curve over 280 ms, starting 20 ms after).',
    shadow: 'x follows half the surge; width scale = 1 - 0.03 * (left lift + right lift) / 26 - body lift / 250.',
  },
  face: {
    clockMs: FL, separateFromWalk: true,
    rules: 'Eyes: neutral or happy-closed (32% chance at each change). Neutral holds 1.1–2.4 s and glances to a random pupil offset (x -8..6, y -7..8, at least 4.5 away; 20% back to centre), gliding in 450 ms; a blink (close 110, hold 40, reopen 190 ms ease-out) at most every 2.6 s. Happy holds 1.3–2.2 s. Expression changes morph in 380 ms (EASE_IN_OUT, the rig\'s fade rule). Mouth, on its own: closed smile 1.7–3.7 s, open happy mouth (open-shout) 1.1–2.5 s, 380 ms morphs. Seeded (mulberry32, seed 7) so the file is the same every build; the app can draw fresh random numbers instead.',
    eyes: EYES.map((p) => ({ t: Math.round(p.t), ...(p.s.kind === 'happy' ? { eyes: 'happy-closed' } : { eyes: p.s.kind === 'blink' ? 'blink-closed' : 'neutral', gaze: [p.s.gx, p.s.gy] }), ease: p.e })),
    mouth: MOUTHS.map((p) => ({ t: Math.round(p.t), mouth: p.s === 'open' ? 'open-shout' : 'smile', ease: p.e })),
    reducedMotion: 'neutral eyes looking ahead, closed smile',
  },
  playback: `Play only while steps are being counted. When they stop, finish the step and rest. Reduced motion: hold the frame at ${REST} ms (the Good morning stride) and a still face.`,
  tokens: { ...T, direction: DIR, hipLocal: Object.fromEntries(Object.entries(HIP).map(([k, p]) => [k, P2(p)])) },
};
fs.writeFileSync(path.join(RIG, 'walk-cycle.json'), JSON.stringify(json, null, 2) + '\n');
const blinks = EYES.filter((p) => p.s.kind === 'blink' && p.e === 'io').length, happies = EYES.filter((p) => p.s.kind === 'happy' && p.e === 'io').length, opens = MOUTHS.filter((p) => p.s === 'open' && p.e === 'io').length;
console.log(`face: ${EYES.length} eye keys (${happies} happy, ${blinks} blinks), ${MOUTHS.length} mouth keys (${opens} open) over ${FL} ms`);
console.log('written', fs.readdirSync(RIG).filter((f) => f.startsWith('walk')).map((f) => `${f} ${fs.statSync(path.join(RIG, f)).size}`).join(', '));
