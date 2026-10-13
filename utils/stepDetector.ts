// Accelerometer step detection, the fallback when the OS pedometer is unavailable
// or Motion permission was denied. Calibration knobs, tune on real devices:
/** Spike above the running gravity baseline (in g) that counts as a step. */
const STEP_G = 0.2;
/** Fastest plausible cadence (~3.5 steps/s). */
const MIN_STEP_MS = 280;

/**
 * Returns a sample handler: feed it accelerometer readings (g) and it returns
 * true on each detected step. One spike = one step: it re-arms only after the
 * signal drops back below baseline.
 * ponytail: naive peak detector, so shaking the phone counts too. Fine for a fallback.
 */
export function createStepDetector() {
  let baseline = 1;
  let armed = true;
  let lastStepAt = -Infinity;
  return (x: number, y: number, z: number, now: number): boolean => {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    baseline = baseline * 0.9 + magnitude * 0.1;
    const spike = magnitude - baseline;
    if (armed && spike > STEP_G && now - lastStepAt > MIN_STEP_MS) {
      armed = false;
      lastStepAt = now;
      return true;
    }
    if (spike < 0) armed = true;
    return false;
  };
}
