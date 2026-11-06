// rn-check.mjs: checks the app's walk (components/wakey/walk.ts) against walk-cycle.svg, which walk.mjs bakes.
// Run from the repo root: node assets/mascots/face-rig/tools/rn-check.mjs  (Node 22.18+, which runs .ts directly)
// 1. Every joint rotation matches the SVG's CSS keyframes at all 40 samples of the loop.
// 2. The legs reach their targets: forward kinematics of the solved joints puts each ankle where the walk wants it,
//    so a planted foot never slides off its track.
import fs from 'fs';
import path from 'path';
import { register } from 'module';
import { pathToFileURL } from 'url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../../../..');
// '@/x' → the repo's x.ts; Reanimated (only motion.ts's hooks need it) → a stub of what motion.ts imports.
const stub = 'data:text/javascript,' + encodeURIComponent('export const Easing = { bezierFn: () => (x) => x, linear: (x) => x }; export const ReduceMotion = {}; export const cancelAnimation = () => {}; export const useSharedValue = () => {}; export const withRepeat = () => {}; export const withTiming = () => {};');
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(spec, ctx, next) {
    if (spec === 'react-native-reanimated') return { url: ${JSON.stringify(stub)}, shortCircuit: true };
    if (spec.startsWith('@/')) spec = ${JSON.stringify(pathToFileURL(ROOT).href)} + '/' + spec.slice(2);
    if (/^(\\.|file:)/.test(spec) && !/\\.\\w+$/.test(spec)) spec += '.ts';
    return next(spec, ctx);
  }`));
const W = await import(pathToFileURL(path.join(ROOT, 'components/wakey/walk.ts')).href);

const svg = fs.readFileSync(path.join(ROOT, 'assets/mascots/face-rig/walk-cycle.svg'), 'utf8');
const IDS = { 'thigh-left': 3, 'shin-left': 4, 'foot-left': 5, 'thigh-right': 6, 'shin-right': 7, 'foot-right': 8, 'upper-arm-left': 9, 'forearm-left': 10, 'upper-arm-right': 11, 'forearm-right': 12, 'bell-left': 13, 'bell-right': 14, body: 2 };
let worst = 0;
for (const [id, j] of Object.entries(IDS)) {
  const kf = svg.match(new RegExp(`@keyframes wk-${id}\\{(.*?)\\}\\n`))[1];
  for (const [, pct, deg] of kf.matchAll(/([\d.]+)%\{transform:[^}]*?rotate\((-?[\d.]+)deg\)/g)) {
    const t = (+pct / 100) * 1000;
    const got = W.solve(W.walkPose(t))[j];
    const diff = Math.abs(((got - +deg + 540) % 360) - 180);
    worst = Math.max(worst, diff);
    if (diff > 0.05) throw new Error(`${id} at ${t} ms: app ${got.toFixed(2)}°, svg ${deg}°`);
  }
}
console.log(`joints match walk-cycle.svg at 40 samples (worst ${worst.toFixed(3)}°)`);

// forward kinematics: body-space hip → knee → ankle, then into the world, vs the pose's ankle target
const rot = (x, y, deg, ox, oy) => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]; };
const L = W.JOINT.leg.len, [PX, PY] = [150, 184];
let miss = 0;
for (let t = 0; t < 1000; t += 5) {
  const p = W.walkPose(t), q = W.solve(p);
  for (let i = 0; i < 2; i++) {
    const [hx, hy] = W.JOINT.hip[i];
    const th = q[3 + 3 * i], sh = q[4 + 3 * i];
    const ankle = rot(...rot(hx, hy + 2 * L, sh, hx, hy + L), th, hx, hy);
    const [wx, wy] = rot(ankle[0], ankle[1], q[2], PX, PY);
    miss = Math.max(miss, Math.hypot(wx + q[0] - p[3 + 3 * i], wy + q[1] - p[4 + 3 * i]));
  }
}
if (miss > 0.05) throw new Error(`an ankle misses its target by ${miss.toFixed(3)}`);
console.log(`ankles on target every 5 ms (worst miss ${miss.toFixed(4)} units)`);
