import Phaser from 'phaser'
import type { Anchor } from './ShoreAngler'

export type RodPoseMode = 'idle' | 'aiming' | 'airborne' | 'fishing' | 'reeling'

/** Geometry + feel of the rod. Pivot comes from the angler, never hard-coded. */
export interface RodConfig {
  pivot: Anchor
  length: number
  idleAngle: number
  backswingAngle: number
  /** Radians/sec the rod sweeps forward while charging a cast. */
  castAngularSpeed: number
  /** Forward angle at which a charge is over-held and must reset. */
  maxCastAngle: number
  /** Upper bound while tracking the lure underwater. */
  trackAngleMax: number
  segments: number
  bendIdle: number
  bendSink: number
  bendReel: number
  bendFishOn: number
  bendCastWhip: number
  bendLerp: number
  idleReturnLerp: number
  trackLerp: number
  /** Lure hangs at this angular offset from the rod while aiming. */
  swingOrbitOffset: number
}

export interface RodPoseInput {
  mode: RodPoseMode
  now: number
  swingStartedAt: number
  /** Screen-space lure position, used for tracking + bend direction. */
  hookScreenX: number
  hookScreenY: number
  reeling: boolean
  fishOn: boolean
}

export const DEFAULT_ROD_CONFIG: Omit<RodConfig, 'pivot'> = {
  length: 86,
  idleAngle: -0.5,
  backswingAngle: -2.75,
  castAngularSpeed: 3.7,
  maxCastAngle: 0.2,
  trackAngleMax: 0.35,
  segments: 14,
  bendIdle: 5,
  bendSink: 11,
  bendReel: 22,
  bendFishOn: 40,
  bendCastWhip: -30,
  bendLerp: 0.18,
  idleReturnLerp: 0.08,
  trackLerp: 0.18,
  swingOrbitOffset: -0.35,
}

export interface RodCurve {
  points: Phaser.Math.Vector2[]
  tipX: number
  tipY: number
}

/**
 * The fishing rod: owns its angle, bend, the screen-space anchor where the line
 * leaves the rod tip, and its own rendering. Because every offset is derived
 * from the configured pivot + length, swapping in new rod/angler art only means
 * updating the pivot anchor -- nothing here assumes fixed screen coordinates.
 */
export class FishingRod {
  private angle: number
  private bend: number
  private anchorX: number
  private anchorY: number
  private readonly rodGraphics: Phaser.GameObjects.Graphics
  private readonly lineGraphics: Phaser.GameObjects.Graphics
  private readonly config: RodConfig

  constructor(scene: Phaser.Scene, config: RodConfig) {
    this.config = config
    this.angle = config.idleAngle
    this.bend = config.bendIdle
    this.anchorX = config.pivot.x + Math.cos(this.angle) * config.length
    this.anchorY = config.pivot.y + Math.sin(this.angle) * config.length
    this.rodGraphics = scene.add.graphics()
    this.lineGraphics = scene.add.graphics()
  }

  get currentAngle(): number {
    return this.angle
  }

  /** Angle the lure swings at while aiming (rod angle + orbit offset). */
  get swingAngle(): number {
    return this.angle + this.config.swingOrbitOffset
  }

  /** 0..1 progress of the current charge from full backswing to cast limit. */
  get castProgress(): number {
    return Phaser.Math.Clamp(
      (this.angle - this.config.backswingAngle) /
        (this.config.maxCastAngle - this.config.backswingAngle),
      0,
      1,
    )
  }

  /** Screen-space point where the line leaves the rod (before camera X offset). */
  get lineAnchorScreenX(): number {
    return this.anchorX
  }

  get lineAnchorScreenY(): number {
    return this.anchorY
  }

  /** Snaps the rod fully back to start a fresh cast charge. */
  snapToBackswing(): void {
    this.angle = this.config.backswingAngle
    this.recomputeAnchor()
  }

  /**
   * Advances pose for the frame. Returns true when a charging cast has reached
   * its forward limit and should be reset by the caller.
   */
  update(input: RodPoseInput): boolean {
    let castLimitReached = false

    if (input.mode === 'aiming') {
      const elapsed = (input.now - input.swingStartedAt) / 1000
      const target = this.config.backswingAngle + elapsed * this.config.castAngularSpeed
      if (target >= this.config.maxCastAngle) {
        this.angle = this.config.maxCastAngle
        castLimitReached = true
      } else {
        this.angle = target
      }
    } else if (input.mode === 'idle') {
      this.angle = Phaser.Math.Angle.RotateTo(this.angle, this.config.idleAngle, this.config.idleReturnLerp)
    } else {
      const target = Phaser.Math.Angle.Between(
        this.config.pivot.x,
        this.config.pivot.y,
        input.hookScreenX,
        input.hookScreenY,
      )
      const clamped = Phaser.Math.Clamp(target, this.config.backswingAngle, this.config.trackAngleMax)
      this.angle = Phaser.Math.Angle.RotateTo(this.angle, clamped, this.config.trackLerp)
    }

    this.recomputeAnchor()
    this.bend = Phaser.Math.Linear(this.bend, this.computeBendTarget(input), this.config.bendLerp)

    return castLimitReached
  }

  /** Draws the rod curve, tip, and line to the lure. */
  render(hookScreenX: number, hookScreenY: number): void {
    const { points, tipX, tipY } = this.computeCurve(hookScreenX, hookScreenY)
    const { pivot } = this.config

    this.rodGraphics.clear()
    // Taper: thicker at the handle, thinner toward the flexible tip.
    for (let i = 0; i < points.length - 1; i += 1) {
      const taper = 1 - i / points.length
      this.rodGraphics.lineStyle(2 + 5 * taper, 0x8b5e34, 1)
      this.rodGraphics.beginPath()
      this.rodGraphics.moveTo(points[i].x, points[i].y)
      this.rodGraphics.lineTo(points[i + 1].x, points[i + 1].y)
      this.rodGraphics.strokePath()
    }
    this.rodGraphics.fillStyle(0x5b3a21, 1)
    this.rodGraphics.fillCircle(pivot.x, pivot.y, 4)
    this.rodGraphics.fillStyle(0xdbeafe, 1)
    this.rodGraphics.fillCircle(tipX, tipY, 3)

    this.lineGraphics.clear()
    this.lineGraphics.lineStyle(2, 0x1f2937, 0.95)
    this.lineGraphics.beginPath()
    this.lineGraphics.moveTo(tipX, tipY)
    this.lineGraphics.lineTo(hookScreenX, hookScreenY)
    this.lineGraphics.strokePath()
  }

  private recomputeAnchor(): void {
    this.anchorX = this.config.pivot.x + Math.cos(this.angle) * this.config.length
    this.anchorY = this.config.pivot.y + Math.sin(this.angle) * this.config.length
  }

  private computeBendTarget(input: RodPoseInput): number {
    switch (input.mode) {
      case 'aiming':
        // Wind-up loads the rod backward like a real backswing.
        return this.config.bendCastWhip
      case 'airborne':
        return this.config.bendIdle
      case 'reeling':
        return input.fishOn ? this.config.bendFishOn : this.config.bendReel
      case 'fishing':
        return input.reeling ? this.config.bendReel : this.config.bendSink
      default:
        return this.config.bendIdle
    }
  }

  // Quadratic curve: stiff at the handle, deflecting toward the line load at the tip.
  private computeCurve(hookScreenX: number, hookScreenY: number): RodCurve {
    const { pivot, length, segments } = this.config
    const dirX = Math.cos(this.angle)
    const dirY = Math.sin(this.angle)
    const straightTipX = pivot.x + dirX * length
    const straightTipY = pivot.y + dirY * length

    const towardX = hookScreenX - straightTipX
    const towardY = hookScreenY - straightTipY
    const towardLen = Math.hypot(towardX, towardY) || 1
    const bendX = (towardX / towardLen) * this.bend
    const bendY = (towardY / towardLen) * this.bend

    const tipX = straightTipX + bendX
    const tipY = straightTipY + bendY
    const ctrlX = pivot.x + dirX * length * 0.5 + bendX * 0.25
    const ctrlY = pivot.y + dirY * length * 0.5 + bendY * 0.25

    const points: Phaser.Math.Vector2[] = []
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments
      const inv = 1 - t
      const x = inv * inv * pivot.x + 2 * inv * t * ctrlX + t * t * tipX
      const y = inv * inv * pivot.y + 2 * inv * t * ctrlY + t * t * tipY
      points.push(new Phaser.Math.Vector2(x, y))
    }

    return { points, tipX, tipY }
  }
}
