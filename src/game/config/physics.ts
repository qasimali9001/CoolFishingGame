/**
 * Tuning for the lure: how it flies through the air and how it sinks / reels
 * back through the water. Kept separate from scene geometry so feel can be
 * tuned without touching layout or anchoring.
 */
export const LURE_PHYSICS = {
  /** Hook collision radius and rendered size. */
  hookRadius: 8,

  // --- Aiming ---
  /** Radius the lure hangs at from the rod tip while aiming the swing. */
  swingLength: 74,

  // --- Airborne (post-release) ---
  airGravity: 980,
  /** Cast power range mapped from how far the rod swung before release. */
  releaseSpeedMin: 240,
  releaseSpeedMax: 660,

  // --- Underwater ---
  sinkAccel: 430,
  reelPullAccel: 1180,
  reelPullMax: 1420,
  depthDrag: 1.55,
  horizontalDrag: 2.7,

  // --- Cast depth cap ---
  /** Default depth cap before a cast resolves its splash position. */
  defaultDepthCap: 260,
  depthCapMin: 30,
  depthCapBase: 1200,
  /** Fraction of horizontal travel that converts into reachable depth. */
  depthPerHorizontalTravel: 2 / 3,
} as const
