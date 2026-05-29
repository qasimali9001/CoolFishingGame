import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../constants'
import {
  TIER_ORDER,
  getBaitSpeciesForTier,
  pickSpeciesForTier,
  type FishBehavior,
  type FishSpecies,
  type FishTier,
} from '../data/fishSpecies'
import { buildFishArt } from '../fish/fishArt'

type HookMode = 'idle' | 'aiming' | 'airborne' | 'fishing' | 'reeling'
type UpgradeId = 'reelSpeed' | 'maxDepth' | 'castDistance'

interface FishActor {
  sprite: Phaser.GameObjects.Container
  tail: Phaser.GameObjects.Container
  species: FishSpecies
  tier: FishTier
  behavior: FishBehavior
  speed: number
  direction: number
  facing: number
  driftSeed: number
  worldX: number
  depth: number
  homeDepth: number
  bobAmp: number
  bobFreq: number
  tailFreq: number
  behaviorPhase: number
  behaviorTimer: number
}

interface UpgradeDefinition {
  label: string
  costs: number[]
  values: number[]
}

interface BaitVisual {
  container: Phaser.GameObjects.Container
  tail: Phaser.GameObjects.Container
  tier: FishTier
}

const SURFACE_Y = 118
const BANK_WIDTH = 170
const WATER_LEFT_X = BANK_WIDTH + 10
const ROD_PIVOT_X = 82
const ROD_PIVOT_Y = SURFACE_Y - 40
const ROD_LENGTH = 86
const ROD_IDLE_ANGLE = -0.5
const ROD_BACKSWING_ANGLE = -2.75
const ROD_CAST_ANGULAR_SPEED = 3.7
const ROD_MAX_CAST_ANGLE = 0.2
const ROD_SEGMENTS = 14
const ROD_BEND_IDLE = 5
const ROD_BEND_SINK = 11
const ROD_BEND_REEL = 22
const ROD_BEND_FISH_ON = 40
const ROD_BEND_CAST_WHIP = -30
const ROD_BEND_LERP = 0.18
const MIN_HOOK_Y = SURFACE_Y + 8
const HOOK_RADIUS = 8
const SWING_LENGTH = 74
const SWING_ORBIT_OFFSET = -0.35
const AIR_GRAVITY = 980
const RELEASE_SPEED_MIN = 240
const RELEASE_SPEED_MAX = 660
const WATER_SINK_ACCEL = 430
const WATER_REEL_PULL_ACCEL = 1180
const WATER_REEL_PULL_MAX = 1420
const WATER_DEPTH_DRAG = 1.55
const WATER_X_DRAG = 2.7
const CAMERA_FOLLOW_SCREEN_Y = GAME_HEIGHT * 0.62
const WORLD_MAX_X = 2200

const CATCH_FOR_BAIT: Record<FishTier, FishTier> = {
  small: 'medium',
  medium: 'large',
  large: 'giant',
  giant: 'giant',
}

const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  reelSpeed: {
    label: 'Reel speed',
    costs: [0, 60, 170, 360],
    values: [1, 1.18, 1.38, 1.62],
  },
  maxDepth: {
    label: 'Max depth',
    costs: [0, 55, 150, 330],
    values: [0, 260, 620, 1050],
  },
  castDistance: {
    label: 'Cast distance',
    costs: [0, 70, 190, 395],
    values: [1, 1.15, 1.3, 1.5],
  },
}

const SCHOOL_RADIUS = 92
const SCHOOL_COHESION = 0.9
const SCHOOL_SEPARATION_DIST = 26
const SCHOOL_SEPARATION_FORCE = 1.6
const FISH_TURN_LERP = 0.08

const BAIT_EVOLUTION_DEPTHS = [220, 370, 520]
const FISH_AGGRO_RADIUS: Record<FishTier, number> = {
  small: 95,
  medium: 170,
  large: 240,
  giant: 320,
}
const FISH_AGGRO_MULTIPLIER: Record<FishTier, number> = {
  small: 1.2,
  medium: 1.7,
  large: 2.15,
  giant: 2.7,
}

// Predator tension (predators steal the fish on your hook during reel-in).
const PREDATOR_AGGRO_RADIUS = 260
const PREDATOR_CHASE_MULTIPLIER = 1.85
const PREDATOR_BITE_DISTANCE = 26
const PREDATOR_MIN_AGGRO_DEPTH = 210
const PREDATOR_SURFACE_GIVEUP_DEPTH = 120

export class FishingScene extends Phaser.Scene {
  private lineGraphics!: Phaser.GameObjects.Graphics
  private rodGraphics!: Phaser.GameObjects.Graphics
  private hook!: Phaser.GameObjects.Arc
  private baitVisual: BaitVisual | null = null

  private hudText!: Phaser.GameObjects.Text
  private infoText!: Phaser.GameObjects.Text

  private fish: FishActor[] = []
  private hookMode: HookMode = 'idle'

  private lineAnchorX = ROD_PIVOT_X + Math.cos(ROD_IDLE_ANGLE) * ROD_LENGTH
  private lineAnchorY = ROD_PIVOT_Y + Math.sin(ROD_IDLE_ANGLE) * ROD_LENGTH
  private rodAngle = ROD_IDLE_ANGLE
  private rodBend = ROD_BEND_IDLE

  private hookX = this.lineAnchorX
  private hookY = MIN_HOOK_Y
  private hookVelocity = 0
  private hookVelocityX = 0
  private hookVelocityY = 0
  private castDepthCap = 260
  private castStartX = WATER_LEFT_X
  private maxDepthReached = 0
  private hookDepth = 0
  private cameraDepth = 0
  private cameraX = 0

  private caughtTier: FishTier | null = null
  private caughtFishActor: FishActor | null = null
  private heldCatches: FishSpecies[] = []
  private money = 0
  private upgrades: Record<UpgradeId, number> = {
    reelSpeed: 0,
    maxDepth: 0,
    castDistance: 0,
  }
  private deployedBaitBaseTier: FishTier | null = null
  private deployedBaitCurrentTier: FishTier | null = null
  private queuedBaitSpecies: FishSpecies | null = null

  private reelKey?: Phaser.Input.Keyboard.Key
  private baitKey?: Phaser.Input.Keyboard.Key
  private sellKey?: Phaser.Input.Keyboard.Key
  private reelUpgradeKey?: Phaser.Input.Keyboard.Key
  private depthUpgradeKey?: Phaser.Input.Keyboard.Key
  private castUpgradeKey?: Phaser.Input.Keyboard.Key

  private totalCatches = 0
  private hasLeftSurface = false
  private pointerReelArmed = false
  private swingStartedAt = 0
  private swingAngle = ROD_BACKSWING_ANGLE + SWING_ORBIT_OFFSET
  private castNeedsReset = false

  constructor() {
    super('FishingScene')
  }

  create(): void {
    this.drawBackground()
    this.createWorldObjects()
    this.createFishPopulation()
    this.createHud()
    this.registerInput()
    this.refreshHud()
    this.setHookIdle()
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.033)
    this.updateRodPose(time)
    this.updateHorizontalCamera()
    this.updateFishMovement(time, dt)
    this.updateHook(dt)
    this.refreshHud()
    this.syncHookVisuals()
  }

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH * 0.5, SURFACE_Y * 0.5, GAME_WIDTH, SURFACE_Y, 0xb8ecff)
    this.add.rectangle(GAME_WIDTH * 0.5, (SURFACE_Y + GAME_HEIGHT) * 0.5, GAME_WIDTH, GAME_HEIGHT - SURFACE_Y, 0x3f9ecf)
    this.add.rectangle(GAME_WIDTH * 0.5, SURFACE_Y + 4, GAME_WIDTH, 8, 0x8bf2ff)
    this.add.rectangle(BANK_WIDTH * 0.5, GAME_HEIGHT * 0.5, BANK_WIDTH, GAME_HEIGHT, 0x7c5a3a)
    this.add.rectangle(BANK_WIDTH * 0.5, SURFACE_Y - 10, BANK_WIDTH, 42, 0x5ca55c)
    this.add.rectangle(WATER_LEFT_X, GAME_HEIGHT * 0.5, 8, GAME_HEIGHT, 0x4f3a27, 0.65).setOrigin(0.5, 0.5)
    this.add.text(16, GAME_HEIGHT - 42, 'Shore start\nBoat unlock later', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#f1f5f9',
      stroke: '#1f2937',
      strokeThickness: 3,
    })

    for (let i = 0; i < 12; i += 1) {
      const x = Phaser.Math.Between(WATER_LEFT_X + 20, GAME_WIDTH - 24)
      const y = Phaser.Math.Between(SURFACE_Y + 25, GAME_HEIGHT - 30)
      const bubble = this.add.circle(x, y, Phaser.Math.Between(2, 5), 0xffffff, 0.2)
      this.tweens.add({
        targets: bubble,
        y: y - Phaser.Math.Between(30, 80),
        alpha: 0.05,
        duration: Phaser.Math.Between(2400, 4400),
        repeat: -1,
        yoyo: true,
      })
    }
  }

  private createWorldObjects(): void {
    this.add.circle(70, SURFACE_Y - 48, 10, 0xf6d365).setStrokeStyle(2, 0x2f1f12)
    this.add.rectangle(70, SURFACE_Y - 26, 16, 30, 0x2d3748).setStrokeStyle(2, 0x111827)
    this.rodGraphics = this.add.graphics()
    this.lineGraphics = this.add.graphics()
    this.hook = this.add.circle(this.hookX, this.hookY, HOOK_RADIUS, 0xf4f4f4, 1).setStrokeStyle(2, 0x1f2937)
  }

  private createHud(): void {
    this.hudText = this.add.text(12, 10, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '16px',
      color: '#0b1220',
      stroke: '#d1f6ff',
      strokeThickness: 3,
    })

    this.infoText = this.add.text(12, 38, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#0f172a',
      stroke: '#d1f6ff',
      strokeThickness: 2,
    })
  }

  private registerInput(): void {
    this.reelKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.baitKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B)
    this.sellKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.reelUpgradeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    this.depthUpgradeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    this.castUpgradeKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.hookMode !== 'idle') {
        return
      }

      if (pointer.x < WATER_LEFT_X) {
        return
      }

      this.startCastFromIdle()
    })

    this.input.on('pointerup', () => {
      if (this.hookMode !== 'aiming') {
        return
      }

      if (this.castNeedsReset) {
        this.cancelAimingCast('Cast reset. Click and hold to start a new cast.')
        return
      }

      this.releaseSwingCast()
    })

    this.reelKey?.on('down', () => {
      if (this.hookMode === 'idle') {
        this.startCastFromIdle()
      }
    })

    this.baitKey?.on('down', () => {
      if (this.hookMode !== 'idle') {
        return
      }

      this.startCastFromIdle()
    })

    this.sellKey?.on('down', () => {
      if (this.hookMode !== 'idle') {
        return
      }

      this.sellHeldCatch()
    })

    this.reelUpgradeKey?.on('down', () => {
      this.tryPurchaseUpgrade('reelSpeed')
    })
    this.depthUpgradeKey?.on('down', () => {
      this.tryPurchaseUpgrade('maxDepth')
    })
    this.castUpgradeKey?.on('down', () => {
      this.tryPurchaseUpgrade('castDistance')
    })
  }

  private updateFishMovement(time: number, dt: number): void {
    const timeSeconds = time / 1000
    const targetTier = this.getTargetCatchTier()
    const baitActive = this.hookMode === 'fishing' || this.hookMode === 'reeling'
    const predatorTarget = this.getPredatorTarget()
    let predatorSteal: FishActor | null = null

    this.fish.forEach((fishActor) => {
      let chasing = false

      // Predators hunt the fish on the hook during reel-in (tension moments).
      if (predatorTarget !== null && this.isPredatorThreat(fishActor)) {
        const dx = this.hookX - fishActor.worldX
        const dy = this.hookDepth - fishActor.depth
        const distance = Math.hypot(dx, dy)
        if (distance < PREDATOR_AGGRO_RADIUS) {
          chasing = true
          if (distance <= PREDATOR_BITE_DISTANCE) {
            predatorSteal = fishActor
          } else {
            const chaseSpeed = fishActor.speed * PREDATOR_CHASE_MULTIPLIER
            fishActor.worldX += (dx / distance) * chaseSpeed * dt
            fishActor.depth += (dy / distance) * chaseSpeed * dt
            fishActor.direction = dx >= 0 ? 1 : -1
          }
        } else {
          this.applyBehavior(fishActor, timeSeconds, dt)
        }
      } else {
        this.applyBehavior(fishActor, timeSeconds, dt)

        // Loose schooling: drift toward same-tier neighbours, but never overlap them.
        const school = this.computeSchooling(fishActor)
        fishActor.worldX += school.x * dt
        fishActor.depth += school.y * dt

        // Bait attraction: target-tier fish chase the lure.
        if (baitActive && this.caughtFishActor === null && fishActor.tier === targetTier) {
          const dx = this.hookX - fishActor.worldX
          const dy = this.hookDepth - fishActor.depth
          const distance = Math.hypot(dx, dy)
          if (distance > 0.01 && distance < FISH_AGGRO_RADIUS[fishActor.tier]) {
            chasing = true
            const chaseSpeed = fishActor.speed * FISH_AGGRO_MULTIPLIER[fishActor.tier]
            fishActor.worldX += (dx / distance) * chaseSpeed * dt
            fishActor.depth += (dy / distance) * chaseSpeed * dt
            fishActor.direction = dx >= 0 ? 1 : -1
          }
        }
      }

      if (fishActor.worldX > WORLD_MAX_X - 18) {
        fishActor.worldX = WORLD_MAX_X - 18
        fishActor.direction = -1
      } else if (fishActor.worldX < WATER_LEFT_X + 18) {
        fishActor.worldX = WATER_LEFT_X + 18
        fishActor.direction = 1
      }

      fishActor.depth = Phaser.Math.Clamp(fishActor.depth, fishActor.species.minDepth, fishActor.species.maxDepth)

      // Smoothly turn to face travel direction (animates a flip through zero scale).
      fishActor.facing = Phaser.Math.Linear(fishActor.facing, fishActor.direction, FISH_TURN_LERP)

      const bob = Math.sin(timeSeconds * fishActor.bobFreq + fishActor.driftSeed) * fishActor.bobAmp
      const screenX = this.worldToScreenX(fishActor.worldX)
      const screenY = this.depthToScreenY(fishActor.depth + bob)
      fishActor.sprite.setPosition(screenX, screenY)
      fishActor.sprite.scaleX = fishActor.facing

      // Tail swishes faster while actively chasing.
      const wiggleSpeed = fishActor.tailFreq * (chasing ? 1.8 : 1)
      fishActor.tail.rotation = Math.sin(timeSeconds * wiggleSpeed + fishActor.driftSeed) * 0.4
      // Slight nose pitch toward vertical motion / bob for a livelier feel.
      fishActor.sprite.rotation = Math.cos(timeSeconds * fishActor.bobFreq + fishActor.driftSeed) * 0.06

      fishActor.sprite.setVisible(
        screenX > WATER_LEFT_X - 40 &&
          screenX < GAME_WIDTH + 40 &&
          screenY > SURFACE_Y + 4 &&
          screenY < GAME_HEIGHT + 24,
      )
    })

    if (predatorSteal !== null) {
      this.resolvePredatorSteal(predatorSteal)
    }
  }

  // Returns the hooked fish predators may try to steal, or null if none is at risk.
  private getPredatorTarget(): FishActor | null {
    if (this.hookMode !== 'reeling' || this.caughtFishActor === null) {
      return null
    }

    if (this.hookDepth < PREDATOR_SURFACE_GIVEUP_DEPTH) {
      return null
    }

    return this.caughtFishActor
  }

  private isPredatorThreat(fishActor: FishActor): boolean {
    if (!fishActor.species.predator || this.caughtTier === null) {
      return false
    }

    if (this.hookDepth < PREDATOR_MIN_AGGRO_DEPTH) {
      return false
    }

    // Only bigger fish than the catch bother hunting it.
    return TIER_ORDER.indexOf(fishActor.tier) > TIER_ORDER.indexOf(this.caughtTier)
  }

  private resolvePredatorSteal(predator: FishActor): void {
    if (this.caughtFishActor !== null) {
      this.caughtFishActor.sprite.destroy()
      this.caughtFishActor = null
    }

    const stolenTier = this.caughtTier
    this.caughtTier = null
    this.cameras.main.shake(220, 0.012)
    this.infoText.setText(`A ${predator.species.name} snatched your ${stolenTier ?? 'catch'}! Reel faster near predators.`)
    this.refreshHud()
  }

  // Per-species idle movement. Mutates worldX/depth in place.
  private applyBehavior(fishActor: FishActor, timeSeconds: number, dt: number): void {
    switch (fishActor.behavior) {
      case 'swooper': {
        fishActor.worldX += fishActor.speed * fishActor.direction * dt
        fishActor.depth = fishActor.homeDepth + Math.sin(timeSeconds * 1.3 + fishActor.behaviorPhase) * 46
        break
      }
      case 'circler': {
        fishActor.behaviorPhase += dt * 1.6
        fishActor.worldX += Math.cos(fishActor.behaviorPhase) * fishActor.speed * dt * 1.4
        fishActor.depth = fishActor.homeDepth + Math.sin(fishActor.behaviorPhase) * 38
        fishActor.direction = Math.cos(fishActor.behaviorPhase) >= 0 ? 1 : -1
        break
      }
      case 'darter': {
        fishActor.behaviorTimer -= dt
        if (fishActor.behaviorTimer <= 0) {
          fishActor.behaviorTimer = Phaser.Math.FloatBetween(0.6, 1.6)
          if (Math.random() < 0.4) {
            fishActor.direction *= -1
          }
        }
        // Bursty: fast when timer is fresh, coasting as it expires.
        const burst = Phaser.Math.Clamp(fishActor.behaviorTimer * 1.4, 0.35, 1.6)
        fishActor.worldX += fishActor.speed * fishActor.direction * burst * dt
        break
      }
      case 'lurker': {
        fishActor.worldX += fishActor.speed * fishActor.direction * 0.35 * dt
        fishActor.depth = fishActor.homeDepth + Math.sin(timeSeconds * 0.6 + fishActor.behaviorPhase) * 10
        break
      }
      case 'cruiser': {
        fishActor.worldX += fishActor.speed * fishActor.direction * 1.15 * dt
        break
      }
      case 'casual':
      default: {
        fishActor.worldX += fishActor.speed * fishActor.direction * dt
        break
      }
    }
  }

  private computeSchooling(self: FishActor): { x: number; y: number } {
    let centerX = 0
    let centerY = 0
    let cohesionCount = 0
    let separationX = 0
    let separationY = 0

    this.fish.forEach((other) => {
      if (other === self || other.tier !== self.tier) {
        return
      }

      const dx = other.worldX - self.worldX
      const dy = other.depth - self.depth
      const distance = Math.hypot(dx, dy)
      if (distance > SCHOOL_RADIUS || distance < 0.001) {
        return
      }

      centerX += other.worldX
      centerY += other.depth
      cohesionCount += 1

      if (distance < SCHOOL_SEPARATION_DIST) {
        const push = (SCHOOL_SEPARATION_DIST - distance) / SCHOOL_SEPARATION_DIST
        separationX -= (dx / distance) * push * SCHOOL_SEPARATION_FORCE * self.speed
        separationY -= (dy / distance) * push * SCHOOL_SEPARATION_FORCE * self.speed
      }
    })

    let cohesionX = 0
    let cohesionY = 0
    if (cohesionCount > 0) {
      cohesionX = (centerX / cohesionCount - self.worldX) * 0.01 * SCHOOL_COHESION * self.speed
      cohesionY = (centerY / cohesionCount - self.depth) * 0.01 * SCHOOL_COHESION * self.speed
    }

    return { x: cohesionX + separationX, y: cohesionY + separationY }
  }

  private updateHook(dt: number): void {
    if (this.hookMode === 'idle') {
      return
    }

    if (this.hookMode === 'aiming') {
      this.updateSwingAim()
      return
    }

    if (this.hookMode === 'airborne') {
      this.updateAirborneHook(dt)
      return
    }

    if (!this.input.activePointer.isDown) {
      this.pointerReelArmed = true
    }

    const mouseReeling = this.pointerReelArmed && this.input.activePointer.isDown
    const isReeling = Boolean(mouseReeling || this.reelKey?.isDown)
    const anchorWorldX = this.getLineAnchorWorldX()
    const toAnchorX = anchorWorldX - this.hookX
    const toAnchorDepth = -this.hookDepth
    const distanceToAnchor = Math.max(0.001, Math.hypot(toAnchorX, toAnchorDepth))

    let accelX = 0
    let accelDepth = WATER_SINK_ACCEL
    if (isReeling) {
      const pullDirX = toAnchorX / distanceToAnchor
      const pullDirDepth = toAnchorDepth / distanceToAnchor
      const depthRatio = Phaser.Math.Clamp(this.hookDepth / Math.max(1, this.maxDepthReached), 0, 1)
      const reelSpeedMultiplier = this.getUpgradeValue('reelSpeed')
      const pullStrength = Phaser.Math.Clamp(
        WATER_REEL_PULL_ACCEL * reelSpeedMultiplier * (0.72 + distanceToAnchor / 360 + (1 - depthRatio) * 0.38),
        WATER_REEL_PULL_ACCEL * 0.65,
        WATER_REEL_PULL_MAX * reelSpeedMultiplier,
      )
      accelX += pullDirX * pullStrength
      accelDepth += pullDirDepth * pullStrength
    }

    this.hookVelocityX += accelX * dt
    this.hookVelocity += accelDepth * dt
    this.hookVelocity *= Math.exp(-WATER_DEPTH_DRAG * dt)
    this.hookVelocityX *= Math.exp(-WATER_X_DRAG * dt)

    this.hookX += this.hookVelocityX * dt
    this.hookDepth = Math.max(0, this.hookDepth + this.hookVelocity * dt)
    if (this.hookDepth >= this.castDepthCap) {
      this.hookDepth = this.castDepthCap
      if (this.hookVelocity > 0) {
        this.hookVelocity = 0
      }
    }
    if (isReeling && this.hookDepth <= 0.5 && this.hookVelocity > 0) {
      this.hookVelocity = 0
    }

    this.maxDepthReached = Math.max(this.maxDepthReached, this.hookDepth)
    const minHookX = this.hookDepth > 1 ? WATER_LEFT_X + 12 : 12
    this.hookX = Phaser.Math.Clamp(this.hookX, minHookX, WORLD_MAX_X - 12)

    if (this.hookDepth > 24) {
      this.hasLeftSurface = true
    }

    this.updateDepthCamera()
    this.hookY = this.depthToScreenY(this.hookDepth)

    if (this.deployedBaitBaseTier !== null) {
      this.deployedBaitCurrentTier = this.computeEvolvedBaitTier(this.deployedBaitBaseTier, this.hookDepth)
    }

    if (this.caughtTier === null) {
      this.tryCatchFish()
    }

    const closeEnoughToLand = Math.abs(this.hookX - anchorWorldX) <= 26
    if (this.hookDepth <= 0.5 && isReeling && this.hasLeftSurface && closeEnoughToLand) {
      if (this.caughtTier !== null && this.caughtFishActor !== null) {
        const landedSpecies = this.caughtFishActor.species
        this.heldCatches.push(landedSpecies)
        this.totalCatches += 1
        this.infoText.setText(
          `Landed a ${landedSpecies.name} ($${landedSpecies.value}). Next cast auto-uses held fish, or press S to sell.`,
        )
      } else {
        this.infoText.setText('No catch this cast. Try deeper or use stronger bait.')
      }

      if (this.caughtFishActor !== null) {
        this.caughtFishActor.sprite.destroy()
        this.caughtFishActor = null
      }
      this.caughtTier = null
      this.deployedBaitBaseTier = null
      this.deployedBaitCurrentTier = null
      this.setHookIdle()
      this.refreshHud()
    }
  }

  private updateSwingAim(): void {
    this.swingAngle = this.rodAngle + SWING_ORBIT_OFFSET

    this.hookX = this.getLineAnchorWorldX() + Math.cos(this.swingAngle) * SWING_LENGTH
    this.hookY = this.lineAnchorY + Math.sin(this.swingAngle) * SWING_LENGTH
  }

  private updateAirborneHook(dt: number): void {
    this.hookVelocityY += AIR_GRAVITY * dt
    this.hookX += this.hookVelocityX * dt
    this.hookY += this.hookVelocityY * dt

    this.hookX = Phaser.Math.Clamp(this.hookX, 12, WORLD_MAX_X - 12)

    if (this.hookX < WATER_LEFT_X - 2 && this.hookY >= SURFACE_Y - 14 && this.hookVelocityY > 0) {
      this.cancelAimingCast('Lure landed on shore. Recast to fish.')
      return
    }

    if (this.hookX >= WATER_LEFT_X - 2 && this.hookY >= MIN_HOOK_Y && this.hookVelocityY > 0) {
      this.hookMode = 'fishing'
      this.hookDepth = 1
      this.cameraDepth = 0
      this.hookY = this.depthToScreenY(this.hookDepth)
      this.hookVelocity = Math.max(120, this.hookVelocityY * 0.5)
      this.hookVelocityX = 0
      this.hookVelocityY = 0
      this.maxDepthReached = this.hookDepth
      this.castDepthCap = this.computeCastDepthCap(this.hookX)
      const queuedTier = this.queuedBaitSpecies?.tier ?? null
      this.deployedBaitBaseTier = queuedTier
      this.deployedBaitCurrentTier = queuedTier
      this.queuedBaitSpecies = null
      this.infoText.setText(`Lure hit water. Depth cap: ${Math.round(this.castDepthCap)}m. Hold mouse or Space to reel.`)
      this.refreshHud()
    }
  }

  private tryCatchFish(): void {
    const targetTier = this.getTargetCatchTier()

    const fishToCatch = this.fish.find((fishActor) => {
      if (fishActor.tier !== targetTier) {
        return false
      }

      const catchDistance = fishActor.species.length + HOOK_RADIUS + 3
      return Phaser.Math.Distance.Between(this.hookX, this.hookDepth, fishActor.worldX, fishActor.depth) <= catchDistance
    })

    if (!fishToCatch) {
      return
    }

    this.caughtTier = fishToCatch.tier
    this.caughtFishActor = fishToCatch
    this.hookMode = 'reeling'
    this.deployedBaitBaseTier = null
    this.deployedBaitCurrentTier = null

    this.fish = this.fish.filter((fishActor) => fishActor !== fishToCatch)

    this.time.delayedCall(1000, () => {
      this.spawnFishOfTier(fishToCatch.tier)
    })
  }

  private getTargetCatchTier(): FishTier {
    if (this.deployedBaitCurrentTier === null) {
      return 'small'
    }

    return CATCH_FOR_BAIT[this.deployedBaitCurrentTier]
  }

  private computeEvolvedBaitTier(baseTier: FishTier, hookDepth: number): FishTier {
    let tierIndex = TIER_ORDER.indexOf(baseTier)

    BAIT_EVOLUTION_DEPTHS.forEach((depthTrigger) => {
      if (hookDepth >= depthTrigger && tierIndex < TIER_ORDER.length - 1) {
        tierIndex += 1
      }
    })

    return TIER_ORDER[tierIndex]
  }

  private startAim(baitSpecies: FishSpecies | null): void {
    this.hookMode = 'aiming'
    if (this.caughtFishActor !== null) {
      this.caughtFishActor.sprite.destroy()
      this.caughtFishActor = null
    }
    this.caughtTier = null
    this.queuedBaitSpecies = baitSpecies
    this.deployedBaitBaseTier = null
    this.deployedBaitCurrentTier = null
    this.hookVelocity = 0
    this.hookVelocityX = 0
    this.hookVelocityY = 0
    this.castDepthCap = 260
    this.maxDepthReached = 0
    this.hasLeftSurface = false
    this.pointerReelArmed = false
    this.swingStartedAt = this.time.now
    this.castNeedsReset = false
    this.rodAngle = ROD_BACKSWING_ANGLE
    this.lineAnchorX = ROD_PIVOT_X + Math.cos(this.rodAngle) * ROD_LENGTH
    this.lineAnchorY = ROD_PIVOT_Y + Math.sin(this.rodAngle) * ROD_LENGTH
    this.swingAngle = this.rodAngle + SWING_ORBIT_OFFSET
    this.hookX = this.getLineAnchorWorldX() + Math.cos(this.swingAngle) * SWING_LENGTH
    this.hookY = this.lineAnchorY + Math.sin(this.swingAngle) * SWING_LENGTH
    if (baitSpecies === null) {
      this.infoText.setText('Casting empty hook. Catch small fish first, or recast with held fish to chain tiers.')
    } else {
      const targetTier = CATCH_FOR_BAIT[baitSpecies.tier]
      this.infoText.setText(`Baiting with a held ${baitSpecies.name}. Release to throw; ${targetTier} fish can now bite.`)
    }
    this.refreshHud()
  }

  private startCastFromIdle(): void {
    const selectedBait = this.consumeBestAvailableBait()
    this.startAim(selectedBait)
  }

  private releaseSwingCast(): void {
    this.hookX = this.getLineAnchorWorldX() + Math.cos(this.swingAngle) * SWING_LENGTH
    this.hookY = this.lineAnchorY + Math.sin(this.swingAngle) * SWING_LENGTH

    const tangentX = -Math.sin(this.swingAngle)
    const tangentY = Math.cos(this.swingAngle)
    const castProgress = Phaser.Math.Clamp(
      (this.rodAngle - ROD_BACKSWING_ANGLE) / (ROD_MAX_CAST_ANGLE - ROD_BACKSWING_ANGLE),
      0,
      1,
    )
    const castDistanceMultiplier = this.getUpgradeValue('castDistance')
    const releaseSpeed = Phaser.Math.Linear(RELEASE_SPEED_MIN, RELEASE_SPEED_MAX, castProgress) * castDistanceMultiplier

    this.hookMode = 'airborne'
    this.hookVelocityX = tangentX * releaseSpeed
    this.hookVelocityY = tangentY * releaseSpeed
    this.castStartX = this.hookX
    this.infoText.setText('Lure in air... steer timing, then reel once it splashes.')
  }

  private setHookIdle(): void {
    this.hookMode = 'idle'
    this.hookVelocity = 0
    this.hookVelocityX = 0
    this.hookVelocityY = 0
    this.castDepthCap = 260
    this.maxDepthReached = 0
    this.hookDepth = 0
    this.cameraDepth = 0
    this.cameraX = 0
    this.castNeedsReset = false
    this.hookX = this.getLineAnchorWorldX()
    this.hookY = this.depthToScreenY(this.hookDepth)
    this.syncHookVisuals()
  }

  private syncHookVisuals(): void {
    const hookScreenX = this.worldToScreenX(this.hookX)
    this.hook.setPosition(hookScreenX, this.hookY)

    const { points: rodPoints, tipX, tipY } = this.getRodCurvePoints()

    this.rodGraphics.clear()
    // Taper the rod: thicker at the handle, thinner toward the flexible tip.
    for (let i = 0; i < rodPoints.length - 1; i += 1) {
      const taper = 1 - i / rodPoints.length
      this.rodGraphics.lineStyle(2 + 5 * taper, 0x8b5e34, 1)
      this.rodGraphics.beginPath()
      this.rodGraphics.moveTo(rodPoints[i].x, rodPoints[i].y)
      this.rodGraphics.lineTo(rodPoints[i + 1].x, rodPoints[i + 1].y)
      this.rodGraphics.strokePath()
    }
    this.rodGraphics.fillStyle(0x5b3a21, 1)
    this.rodGraphics.fillCircle(ROD_PIVOT_X, ROD_PIVOT_Y, 4)
    this.rodGraphics.fillStyle(0xdbeafe, 1)
    this.rodGraphics.fillCircle(tipX, tipY, 3)

    this.lineGraphics.clear()
    this.lineGraphics.lineStyle(2, 0x1f2937, 0.95)
    this.lineGraphics.beginPath()
    this.lineGraphics.moveTo(tipX, tipY)
    this.lineGraphics.lineTo(hookScreenX, this.hookY)
    this.lineGraphics.strokePath()

    this.syncBaitVisual(hookScreenX, this.hookY + 12)

    if (this.caughtFishActor !== null) {
      this.caughtFishActor.worldX = this.hookX
      this.caughtFishActor.depth = this.hookDepth
      this.caughtFishActor.sprite.setPosition(hookScreenX, this.hookY + 14)
      this.caughtFishActor.sprite.setVisible(true)
    }
  }

  // Renders the deployed bait as an actual little fish of the current bait tier.
  private syncBaitVisual(screenX: number, screenY: number): void {
    const tier = this.deployedBaitCurrentTier
    if (tier === null) {
      if (this.baitVisual !== null) {
        this.baitVisual.container.destroy()
        this.baitVisual = null
      }
      return
    }

    if (this.baitVisual === null || this.baitVisual.tier !== tier) {
      this.baitVisual?.container.destroy()
      const species = getBaitSpeciesForTier(tier)
      const art = buildFishArt(this, species, 0.6)
      this.baitVisual = { container: art.container, tail: art.tail, tier }
    }

    this.baitVisual.container.setPosition(screenX, screenY)
    this.baitVisual.container.setVisible(true)
  }

  private refreshHud(): void {
    const counts = this.countHeldByTier()
    const heldBait = `S${counts.small} M${counts.medium} L${counts.large} G${counts.giant}`
    const heldSellValue = this.computeHeldInventorySellValue()
    const nextAutoBait = this.peekBestAvailableBaitTier() ?? 'none'
    const deployed = this.deployedBaitCurrentTier ?? 'none'
    const baseBait = this.deployedBaitBaseTier ?? 'none'
    const targetCatch = this.getTargetCatchTier()
    const targetValue = getBaitSpeciesForTier(targetCatch).value
    const depthText = this.hookMode === 'idle' ? '0' : this.hookDepth.toFixed(0)
    const capText = this.hookMode === 'idle' || this.hookMode === 'aiming' ? '-' : this.castDepthCap.toFixed(0)
    const reelCost = this.getNextUpgradeCost('reelSpeed')
    const depthCost = this.getNextUpgradeCost('maxDepth')
    const castCost = this.getNextUpgradeCost('castDistance')
    const reelLevel = this.upgrades.reelSpeed
    const depthLevel = this.upgrades.maxDepth
    const castLevel = this.upgrades.castDistance
    const riskRewardText =
      this.deployedBaitCurrentTier === null
        ? 'Risk/Reward: no bait deployed (safe, but only small-target catches).'
        : `Risk/Reward: spent ${baseBait} bait; now targeting ${targetCatch} worth $${targetValue}.`

    this.hudText.setText(
      [
        `Money: $${this.money}  |  Depth: ${depthText}m / Cap: ${capText}m  |  Catches: ${this.totalCatches}`,
        `Held unsold fish: ${heldBait} (sell value $${heldSellValue})  |  Next auto-bait: ${nextAutoBait}  |  Deployed bait: ${deployed}  |  Target catch: ${targetCatch} ($${targetValue})`,
        riskRewardText,
        `[1] Reel L${reelLevel} (${reelCost === null ? 'MAX' : `$${reelCost}`})  [2] Depth L${depthLevel} (${depthCost === null ? 'MAX' : `$${depthCost}`})  [3] Cast L${castLevel} (${castCost === null ? 'MAX' : `$${castCost}`})  [S] Sell held fish`,
      ].join('\n'),
    )
  }

  private sellHeldCatch(): void {
    const soldCount = this.heldCatches.length
    if (soldCount === 0) {
      this.infoText.setText('Nothing to sell. Land fish first.')
      return
    }

    const totalValue = this.computeHeldInventorySellValue()
    this.heldCatches = []
    this.money += totalValue
    this.infoText.setText(`Sold ${soldCount} fish for $${totalValue}. Money now $${this.money}.`)
    this.refreshHud()
  }

  private countHeldByTier(): Record<FishTier, number> {
    const counts: Record<FishTier, number> = { small: 0, medium: 0, large: 0, giant: 0 }
    this.heldCatches.forEach((species) => {
      counts[species.tier] += 1
    })
    return counts
  }

  private tryPurchaseUpgrade(id: UpgradeId): void {
    if (this.hookMode !== 'idle') {
      this.infoText.setText('Upgrades can only be purchased while idle on shore.')
      return
    }

    const nextCost = this.getNextUpgradeCost(id)
    if (nextCost === null) {
      this.infoText.setText(`${UPGRADE_DEFINITIONS[id].label} is already maxed out.`)
      return
    }

    if (this.money < nextCost) {
      this.infoText.setText(
        `Need $${nextCost} for ${UPGRADE_DEFINITIONS[id].label}. Current money: $${this.money}.`,
      )
      return
    }

    this.money -= nextCost
    this.upgrades[id] += 1
    this.infoText.setText(
      `${UPGRADE_DEFINITIONS[id].label} upgraded to L${this.upgrades[id]}. Money left: $${this.money}.`,
    )
    this.refreshHud()
  }

  private getUpgradeValue(id: UpgradeId): number {
    const level = this.upgrades[id]
    return UPGRADE_DEFINITIONS[id].values[level]
  }

  private computeHeldInventorySellValue(): number {
    return this.heldCatches.reduce((total, species) => total + species.value, 0)
  }

  private getNextUpgradeCost(id: UpgradeId): number | null {
    const nextLevel = this.upgrades[id] + 1
    const costs = UPGRADE_DEFINITIONS[id].costs
    if (nextLevel >= costs.length) {
      return null
    }

    return costs[nextLevel]
  }

  private createFishPopulation(): void {
    // Spawn the whole Bay roster, biased toward common fish, deeper fish rarer.
    const startingPopulation: Array<[FishTier, number]> = [
      ['small', 14],
      ['medium', 9],
      ['large', 6],
      ['giant', 3],
    ]

    startingPopulation.forEach(([tier, count]) => {
      for (let i = 0; i < count; i += 1) {
        this.spawnFishOfTier(tier)
      }
    })
  }

  private spawnFishOfTier(tier: FishTier): void {
    const depthBias = Phaser.Math.Between(0, 1) === 0 ? 0 : Phaser.Math.Between(200, 600)
    const species = pickSpeciesForTier(tier, depthBias)
    this.spawnFishSpecies(species)
  }

  private spawnFishSpecies(species: FishSpecies): void {
    const worldX = Phaser.Math.Between(WATER_LEFT_X + 20, WORLD_MAX_X - 20)
    const depth = Phaser.Math.Between(species.minDepth, species.maxDepth)
    const x = this.worldToScreenX(worldX)
    const y = this.depthToScreenY(depth)
    const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1

    const art = buildFishArt(this, species)
    art.container.setPosition(x, y)
    art.container.setScale(direction, 1)

    this.fish.push({
      sprite: art.container,
      tail: art.tail,
      species,
      tier: species.tier,
      behavior: species.behavior,
      speed: Phaser.Math.FloatBetween(species.minSpeed, species.maxSpeed),
      direction,
      facing: direction,
      driftSeed: Phaser.Math.FloatBetween(0, Math.PI * 2),
      worldX,
      depth,
      homeDepth: depth,
      bobAmp: Phaser.Math.FloatBetween(3, 7) + species.height * 0.15,
      bobFreq: Phaser.Math.FloatBetween(1.4, 2.4),
      tailFreq: Phaser.Math.FloatBetween(8, 12),
      behaviorPhase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      behaviorTimer: Phaser.Math.FloatBetween(0.4, 1.6),
    })
  }

  private updateRodPose(time: number): void {
    if (this.hookMode === 'aiming') {
      const elapsed = (time - this.swingStartedAt) / 1000
      const targetAngle = ROD_BACKSWING_ANGLE + elapsed * ROD_CAST_ANGULAR_SPEED

      if (targetAngle >= ROD_MAX_CAST_ANGLE) {
        this.rodAngle = ROD_MAX_CAST_ANGLE
        this.castNeedsReset = true
        this.infoText.setText('Rod reached cast limit. Release to reset and recast.')
      } else {
        this.rodAngle = targetAngle
      }
    } else if (this.hookMode === 'idle') {
      this.rodAngle = Phaser.Math.Angle.RotateTo(this.rodAngle, ROD_IDLE_ANGLE, 0.08)
    } else {
      const hookScreenX = this.worldToScreenX(this.hookX)
      const targetAngle = Phaser.Math.Angle.Between(ROD_PIVOT_X, ROD_PIVOT_Y, hookScreenX, this.hookY)
      const clampedAngle = Phaser.Math.Clamp(targetAngle, -2.75, 0.35)
      this.rodAngle = Phaser.Math.Angle.RotateTo(this.rodAngle, clampedAngle, 0.18)
    }

    this.lineAnchorX = ROD_PIVOT_X + Math.cos(this.rodAngle) * ROD_LENGTH
    this.lineAnchorY = ROD_PIVOT_Y + Math.sin(this.rodAngle) * ROD_LENGTH

    this.rodBend = Phaser.Math.Linear(this.rodBend, this.computeRodBendTarget(), ROD_BEND_LERP)
  }

  private computeRodBendTarget(): number {
    switch (this.hookMode) {
      case 'aiming':
        // Wind-up loads the rod backward like a real backswing.
        return ROD_BEND_CAST_WHIP
      case 'airborne':
        return ROD_BEND_IDLE
      case 'reeling':
        return this.caughtTier !== null ? ROD_BEND_FISH_ON : ROD_BEND_REEL
      case 'fishing': {
        const reeling = Boolean(
          (this.pointerReelArmed && this.input.activePointer.isDown) || this.reelKey?.isDown,
        )
        return reeling ? ROD_BEND_REEL : ROD_BEND_SINK
      }
      default:
        return ROD_BEND_IDLE
    }
  }

  // Quadratic curve: stiff at the handle, deflecting toward the line load at the tip.
  private getRodCurvePoints(): { points: Phaser.Math.Vector2[]; tipX: number; tipY: number } {
    const dirX = Math.cos(this.rodAngle)
    const dirY = Math.sin(this.rodAngle)
    const straightTipX = ROD_PIVOT_X + dirX * ROD_LENGTH
    const straightTipY = ROD_PIVOT_Y + dirY * ROD_LENGTH

    const hookScreenX = this.worldToScreenX(this.hookX)
    const towardX = hookScreenX - straightTipX
    const towardY = this.hookY - straightTipY
    const towardLen = Math.hypot(towardX, towardY) || 1
    const bendX = (towardX / towardLen) * this.rodBend
    const bendY = (towardY / towardLen) * this.rodBend

    const tipX = straightTipX + bendX
    const tipY = straightTipY + bendY
    const ctrlX = ROD_PIVOT_X + dirX * ROD_LENGTH * 0.5 + bendX * 0.25
    const ctrlY = ROD_PIVOT_Y + dirY * ROD_LENGTH * 0.5 + bendY * 0.25

    const points: Phaser.Math.Vector2[] = []
    for (let i = 0; i <= ROD_SEGMENTS; i += 1) {
      const t = i / ROD_SEGMENTS
      const inv = 1 - t
      const x = inv * inv * ROD_PIVOT_X + 2 * inv * t * ctrlX + t * t * tipX
      const y = inv * inv * ROD_PIVOT_Y + 2 * inv * t * ctrlY + t * t * tipY
      points.push(new Phaser.Math.Vector2(x, y))
    }

    return { points, tipX, tipY }
  }

  private cancelAimingCast(message: string): void {
    if (this.queuedBaitSpecies !== null) {
      this.heldCatches.push(this.queuedBaitSpecies)
      this.queuedBaitSpecies = null
    }

    this.setHookIdle()
    this.infoText.setText(message)
    this.refreshHud()
  }

  private updateDepthCamera(): void {
    const followDepth = this.hookDepth - (CAMERA_FOLLOW_SCREEN_Y - SURFACE_Y)
    this.cameraDepth = Math.max(0, followDepth)
  }

  private updateHorizontalCamera(): void {
    if (this.hookMode === 'idle' || this.hookMode === 'aiming') {
      this.cameraX = Phaser.Math.Linear(this.cameraX, 0, 0.15)
      return
    }

    const maxCameraX = WORLD_MAX_X - GAME_WIDTH
    const targetCameraX = Phaser.Math.Clamp(this.hookX - GAME_WIDTH * 0.58, 0, maxCameraX)
    this.cameraX = Phaser.Math.Linear(this.cameraX, targetCameraX, 0.12)
  }

  private computeCastDepthCap(splashWorldX: number): number {
    const horizontalTravel = Math.max(0, splashWorldX - this.castStartX)
    const depthFromTravelRatio = horizontalTravel * (2 / 3)
    const maxDepthBonus = this.getUpgradeValue('maxDepth')
    return Phaser.Math.Clamp(depthFromTravelRatio, 30, 1200 + maxDepthBonus)
  }

  private worldToScreenX(worldX: number): number {
    return worldX - this.cameraX
  }

  private getLineAnchorWorldX(): number {
    return this.lineAnchorX + this.cameraX
  }

  private consumeBestAvailableBait(): FishSpecies | null {
    const index = this.findBestHeldIndex()
    if (index < 0) {
      return null
    }

    const [species] = this.heldCatches.splice(index, 1)
    return species
  }

  private peekBestAvailableBaitTier(): FishTier | null {
    const index = this.findBestHeldIndex()
    return index < 0 ? null : this.heldCatches[index].tier
  }

  // Highest-tier held fish wins; ties resolve to the most valuable.
  private findBestHeldIndex(): number {
    let bestIndex = -1
    let bestTierRank = -1
    let bestValue = -1
    this.heldCatches.forEach((species, index) => {
      const tierRank = TIER_ORDER.indexOf(species.tier)
      if (tierRank > bestTierRank || (tierRank === bestTierRank && species.value > bestValue)) {
        bestTierRank = tierRank
        bestValue = species.value
        bestIndex = index
      }
    })

    return bestIndex
  }

  private depthToScreenY(depth: number): number {
    return SURFACE_Y + (depth - this.cameraDepth)
  }
}
