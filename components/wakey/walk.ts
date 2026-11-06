// Wakey's body: the walk cycle and the standing poses, as worklets in face-rig units.
// The walk is a port of frame() in assets/mascots/face-rig/tools/walk.mjs (its numbers come from walk-cycle.json
// through rig.ts); keep the two in sync. A pose is a flat list of TARGETS (where the body, ankles and arms want to
// be); solve() turns it into joint rotations, solving both knees every frame so a planted foot never slides.
import { flow, type FlowKey } from '@/utils/motion';

import { PIVOT, WALK } from './rig';

const T = WALK.tokens;
const K = WALK.keys;
const P = T.period;
const DIR = T.direction; // -1: walks to the left
const FWD = -DIR;
const [PX, PY] = T.pivot;
const L = T.leg.len;
const F = T.leg.foot;
const G = T.ground;
const S = T.stance;
const RAD = Math.PI / 180;

/** Keys copied one period before and after, so flow() is periodic. */
const periodic = (k: readonly (readonly number[])[]): FlowKey[] => [-P, 0, P].flatMap(o => k.map(([a, v]) => [a + o, v] as const));
const LIFT = periodic(K.lift);
const SURGE = periodic(K.surge);
const ROCK = periodic(K.rock);
const TOE = periodic(K.toe);
const SWING = [periodic(K.armSwing.left), periodic(K.armSwing.right)];
const ELBOW = [periodic(K.elbow.left), periodic(K.elbow.right)];
const ARM_OUT = [K.armOut.left, K.armOut.right];
const HIP = [T.hipLocal.left, T.hipLocal.right];
const LAND = K.land;

function wrap(t: number): number {
  'worklet';
  return ((t % P) + P) % P;
}
function pflow(t: number, k: readonly FlowKey[]): number {
  'worklet';
  return flow(wrap(t), k);
}
/** Ankle of a foot whose flat position is x: the heel pivots while the toes are up (phi < 0), the toe tip once the heel lifts. */
function footAt(x: number, phi: number): [number, number] {
  'worklet';
  return phi <= 0 ? [x, G] : [x + DIR * (F - F * Math.cos(phi * RAD)), G - F * Math.sin(phi * RAD)];
}
/** Per leg: heel strike time, contact and toe-off x, and the swing path (walk.mjs K.swingX / K.swingY). */
const LEGS = ([T.hipWorld.left, T.hipWorld.right] as const).map(([hx], i) => {
  const cx = hx + DIR * T.reach;
  const tx = hx - DIR * T.back;
  const [xto, yto] = footAt(tx, pflow(S, TOE));
  const swingX: FlowKey[] = [[580, xto], [630, xto - DIR * 19], [930, cx + DIR * 2], [1000, cx]];
  const swingY: FlowKey[] = [[580, yto], [630, G - 22], [830, G - 20], [900, G - 6], [1000, G]];
  return { phase: LAND[i], cx, tx, swingX, swingY };
});

/**
 * Pose targets, a flat list: 0 lift, 1 shift (along the walk), 2 lean°, 3-5 left ankle x, y and toe°, 6-8 right ankle,
 * 9-10 left arm (upper arm° in the world, elbow°), 11-12 right arm, 13-14 bells°, 15 shadow x, 16 shadow width scale.
 * Arm angles are clockwise from hanging straight down, so + swings a limb toward the left (forward).
 */
export type Pose = number[];

/** One frame of the walk at t ms (two steps per period). */
export function walkPose(t: number): Pose {
  'worklet';
  const lift = pflow(t, LIFT);
  const shift = DIR * pflow(t, SURGE);
  const lean = DIR * T.lean + DIR * pflow(t, ROCK);
  const out: number[] = [lift, shift, lean];
  for (let i = 0; i < 2; i++) {
    const g = LEGS[i];
    const tau = wrap(t - g.phase);
    const phi = pflow(tau, TOE);
    if (tau <= S) {
      const a = footAt(g.cx + ((g.tx - g.cx) * tau) / S, phi);
      out.push(a[0], a[1], phi);
    } else out.push(flow(tau, g.swingX), flow(tau, g.swingY), phi);
  }
  const [fd, fg] = T.follow.forearm;
  for (let i = 0; i < 2; i++) {
    const swing = pflow(t, SWING[i]);
    out.push(FWD * swing + ARM_OUT[i], FWD * (pflow(t, ELBOW[i]) + fg * (pflow(t - fd, SWING[i]) - swing)));
  }
  const [bd, bg] = T.follow.bells;
  const ft = bg * DIR * (pflow(t - bd, ROCK) - pflow(t, ROCK));
  let dip = 0;
  for (let i = 0; i < LAND.length; i++) {
    const q = wrap(t - LAND[i] - T.landDip.from);
    if (q < T.landDip.len) dip += T.landDip.deg * Math.sin((Math.PI * q) / T.landDip.len);
  }
  out.push(ft - dip, ft + dip);
  const lifted = G - out[4] + (G - out[7]);
  out.push(0.5 * shift, 1 - (0.03 * lifted) / 26 - lift / 250);
  return out;
}

/** Where the ankles stand (face-rig units). The near (right) foot sits lower: the body is seen a little from the side. */
export const STAND = { left: [84, 377], right: [212, 389] } as const;

/** Standing upright, feet flat under the hips, with the given arms [left upper°, left elbow°, right upper°, right elbow°]. */
export function standPose(arms: readonly number[]): Pose {
  'worklet';
  return [0, 0, 0, STAND.left[0], STAND.left[1], 0, STAND.right[0], STAND.right[1], 0, arms[0], arms[1], arms[2], arms[3], 0, 0, 0, 1];
}

export function mixPose(a: Pose, b: Pose, w: number): Pose {
  'worklet';
  return a.map((v, i) => v + (b[i] - v) * w);
}

/** Clockwise degrees of a vector from pointing straight down. */
function ang(x: number, y: number): number {
  'worklet';
  return Math.atan2(-x, y) / RAD;
}

/**
 * Joint rotations for a pose: 0-1 body translate, 2 body rotate (around the hub), then per leg thigh, shin, foot
 * (3-5 left, 6-8 right; each relative to its parent), per arm upper and forearm (9-10 left, 11-12 right), 13-14 bells,
 * 15 shadow x, 16 shadow width. Two-bone IK in body space, knees bending the way it walks.
 */
export function solve(p: Pose): number[] {
  'worklet';
  const [lift, shift, lean] = p;
  const c = Math.cos(-lean * RAD);
  const s = Math.sin(-lean * RAD);
  const out = [shift, -lift, lean];
  for (let i = 0; i < 2; i++) {
    // the ankle target, in body space
    const wx = p[3 + 3 * i] - shift - PX;
    const wy = p[4 + 3 * i] + lift - PY;
    const ax = PX + wx * c - wy * s;
    const ay = PY + wx * s + wy * c;
    const [hx, hy] = HIP[i];
    let vx = ax - hx;
    let vy = ay - hy;
    let d = Math.hypot(vx, vy);
    const max = 0.998 * 2 * L;
    if (d > max) {
      vx *= max / d;
      vy *= max / d;
      d = max;
    }
    const kh = Math.sqrt(L * L - (d / 2) * (d / 2));
    const kx = hx + vx / 2 + ((DIR * vy) / d) * kh;
    const ky = hy + vy / 2 + ((DIR * -vx) / d) * kh;
    const th1 = ang(kx - hx, ky - hy);
    const th2 = ang(hx + vx - kx, hy + vy - ky);
    out.push(th1, th2 - th1, DIR * p[5 + 3 * i] - lean - th2);
  }
  out.push(p[9] - lean, p[10], p[11] - lean, p[12], p[13], p[14], p[15], p[16]);
  return out;
}

/** Joint pivots in body space (face-rig units), for laying out the limb views. */
export const JOINT = {
  hip: HIP,
  shoulder: [T.shoulder.left, T.shoulder.right],
  bell: [PIVOT.bellLeft, PIVOT.bellRight],
  leg: T.leg,
  arm: T.arm,
  shadow: T.shadow,
} as const;
