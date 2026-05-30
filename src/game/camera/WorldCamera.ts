import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'

/**
 * Anything that converts world coordinates (world X + depth) into on-screen
 * pixels. Every world-anchored visual (fish, lure, bubbles, depth markers)
 * projects through the same projector so they all move together when the
 * camera scrolls -- this is what stops camera motion from reading as fish
 * suddenly darting up or down.
 */
export interface Projector {
  worldToScreenX(worldX: number): number
  depthToScreenY(depth: number): number
}

export interface WorldCameraConfig {
  /** Screen Y of the waterline (top of the water area). */
  surfaceY: number
  gameWidth: number
  gameHeight: number
  /** Rightmost world X the horizontal camera may scroll to. */
  worldMaxX: number
  /**
   * Fraction (0..1) of the visible water below the surface that the lure can
   * sink through *before* the depth camera starts scrolling down. Derived from
   * the layout so moving the player/shoreline never breaks the feel.
   */
  followAnchorRatio: number
  /** Smoothing toward a deeper target (lure sinking). */
  depthFollowLerp: number
  /** Smoothing back toward the surface (lure reeling up). */
  depthReturnLerp: number
  /** Ignore target changes smaller than this to avoid sub-pixel jitter. */
  depthDeadzone: number
  /** Horizontal focus while the lure is underwater. */
  underwaterFocusRatio: number
  /** Horizontal focus while the lure is flying through the air. */
  airborneFocusRatio: number
  /** Extra focus shift based on lure velocity, capped to avoid over-panning. */
  maxVelocityFocusShift: number
  /** Velocity that produces the full focus shift. */
  velocityForMaxFocusShift: number
  horizontalLerp: number
  horizontalAirborneLerp: number
  /** Smoothing back to the resting X position while idle/aiming. */
  horizontalReturnLerp: number
}

export interface WorldCameraHorizontalFocus {
  worldX: number
  velocityX: number
  mode: 'inactive' | 'airborne' | 'underwater'
}

/**
 * Owns all camera state for the fishing scene. Depth is the vertical world
 * offset (how far the view has scrolled underwater); X is the horizontal world
 * offset. The scene only talks to this through projection + update methods so
 * the camera can be tuned/replaced without touching gameplay logic.
 */
export class WorldCamera implements Projector {
  private depth = 0
  private x = 0
  private readonly config: WorldCameraConfig
  private readonly followAnchorDepth: number

  constructor(config: WorldCameraConfig) {
    this.config = config
    const visibleWater = Math.max(1, config.gameHeight - config.surfaceY)
    // Pin the hook deep in the visible water so most of a shallow cast sinks
    // on-screen with NO camera motion; only deep casts scroll the world.
    this.followAnchorDepth = visibleWater * config.followAnchorRatio
  }

  get depthOffset(): number {
    return this.depth
  }

  get horizontalOffset(): number {
    return this.x
  }

  /** Depth at which the camera first begins to scroll down. */
  get followStartDepth(): number {
    return this.followAnchorDepth
  }

  reset(): void {
    this.depth = 0
    this.x = 0
  }

  resetDepth(): void {
    this.depth = 0
  }

  /**
   * Eases the camera toward the depth that keeps the hook at the anchor line.
   * Returns the per-frame depth change (useful for diagnostics).
   */
  updateDepth(hookDepth: number): number {
    const target = Math.max(0, hookDepth - this.followAnchorDepth)
    const gap = target - this.depth

    if (Math.abs(gap) <= this.config.depthDeadzone) {
      return 0
    }

    const before = this.depth
    const lerp = gap > 0 ? this.config.depthFollowLerp : this.config.depthReturnLerp
    this.depth = Phaser.Math.Linear(this.depth, target, lerp)

    if (Math.abs(target - this.depth) < 0.15) {
      this.depth = target
    }

    return this.depth - before
  }

  updateHorizontal(focus: WorldCameraHorizontalFocus): void {
    if (focus.mode === 'inactive') {
      this.x = Phaser.Math.Linear(this.x, 0, this.config.horizontalReturnLerp)
      return
    }

    const baseFocusRatio =
      focus.mode === 'airborne' ? this.config.airborneFocusRatio : this.config.underwaterFocusRatio
    const velocityShift =
      Phaser.Math.Clamp(
        focus.velocityX / this.config.velocityForMaxFocusShift,
        -1,
        1,
      ) * this.config.maxVelocityFocusShift
    const focusRatio = Phaser.Math.Clamp(baseFocusRatio + velocityShift, 0.5, 0.68)
    const maxX = Math.max(0, this.config.worldMaxX - this.config.gameWidth)
    const target = Phaser.Math.Clamp(focus.worldX - this.config.gameWidth * focusRatio, 0, maxX)
    const lerp = focus.mode === 'airborne' ? this.config.horizontalAirborneLerp : this.config.horizontalLerp
    this.x = Phaser.Math.Linear(this.x, target, lerp)
  }

  worldToScreenX(worldX: number): number {
    return worldX - this.x
  }

  depthToScreenY(depth: number): number {
    return this.config.surfaceY + (depth - this.depth)
  }
}

/**
 * Camera feel tuning. These are deliberately layout-independent ratios so the
 * camera behaves the same regardless of where the shoreline sits.
 * `followAnchorRatio` is a fraction of the visible water height, so the lure is
 * framed consistently no matter how the layout changes.
 */
export const CAMERA_TUNING = {
  followAnchorRatio: 0.55,
  depthFollowLerp: 0.09,
  depthReturnLerp: 0.1,
  depthDeadzone: 2,
  underwaterFocusRatio: 0.58,
  airborneFocusRatio: 0.56,
  maxVelocityFocusShift: 0.04,
  velocityForMaxFocusShift: 660,
  horizontalLerp: 0.12,
  horizontalAirborneLerp: 0.18,
  horizontalReturnLerp: 0.15,
} as const

/** Builds a camera whose framing is derived entirely from the scene layout. */
export function createWorldCamera(layout: SceneLayout): WorldCamera {
  return new WorldCamera({
    surfaceY: layout.surfaceY,
    gameWidth: layout.gameWidth,
    gameHeight: layout.gameHeight,
    worldMaxX: layout.worldMaxX,
    ...CAMERA_TUNING,
  })
}
