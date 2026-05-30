import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { Projector } from '../camera/WorldCamera'
import { BAIT_ATTRACTION, PREDATOR, SCHOOLING, STARTING_POPULATION } from '../config/tuning'
import { LURE_PHYSICS } from '../config/physics'
import { TIER_ORDER, pickSpeciesForTier, type FishTier } from '../data/fishSpecies'
import { createFishActor, type FishActor } from './fishActor'

/** Per-frame diagnostic snapshot for the closest target-tier fish. */
export interface FishMotionDebugSample {
  species: string
  tier: FishTier
  score: number
  worldDepth: number
  screenY: number
  behaviorDy: number
  schoolDy: number
  attractionDy: number
  clampDy: number
  totalDy: number
}

/** Everything the fish simulation needs to know about the lure this frame. */
export interface FishUpdateContext {
  time: number
  dt: number
  projector: Projector
  targetTier: FishTier
  baitActive: boolean
  hookWorldX: number
  hookDepth: number
  /** Tier of the fish currently hooked, or null if none. */
  caughtTier: FishTier | null
  /** True while a hooked fish is deep enough for predators to hunt it. */
  predatorTargetActive: boolean
}

export interface FishUpdateResult {
  debugSample: FishMotionDebugSample | null
  predatorStealVictim: FishActor | null
}

/**
 * Owns the live fish population and all of its movement: idle behaviors,
 * schooling, bait attraction, predator hunting, world clamping, and projection
 * to screen. The scene drives it once per frame and reacts to the returned
 * predator-steal event; it never reaches into individual fish state.
 */
export class FishController {
  private fish: FishActor[] = []
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout
  private readonly projector: Projector

  constructor(scene: Phaser.Scene, layout: SceneLayout, projector: Projector) {
    this.scene = scene
    this.layout = layout
    this.projector = projector
  }

  populate(): void {
    STARTING_POPULATION.forEach(([tier, count]) => {
      for (let i = 0; i < count; i += 1) {
        this.spawnOfTier(tier)
      }
    })
  }

  spawnOfTier(tier: FishTier): void {
    const depthBias = Phaser.Math.Between(0, 1) === 0 ? 0 : Phaser.Math.Between(200, 600)
    const species = pickSpeciesForTier(tier, depthBias)
    this.fish.push(createFishActor(this.scene, species, this.layout, this.projector))
  }

  /** Removes a fish from the live population (e.g. once it is hooked). */
  remove(target: FishActor): void {
    this.fish = this.fish.filter((fishActor) => fishActor !== target)
  }

  /** Finds a target-tier fish within catch range of the lure, if any. */
  findCatchable(targetTier: FishTier, hookWorldX: number, hookDepth: number): FishActor | null {
    return (
      this.fish.find((fishActor) => {
        if (fishActor.tier !== targetTier) {
          return false
        }
        const catchDistance = fishActor.species.length + LURE_PHYSICS.hookRadius + 3
        return (
          Phaser.Math.Distance.Between(hookWorldX, hookDepth, fishActor.worldX, fishActor.depth) <=
          catchDistance
        )
      }) ?? null
    )
  }

  update(context: FishUpdateContext): FishUpdateResult {
    const timeSeconds = context.time / 1000
    let predatorSteal: FishActor | null = null
    let bestSample: FishMotionDebugSample | null = null

    this.fish.forEach((fishActor) => {
      let chasing = false
      const depthStart = fishActor.depth
      let attractionDy = 0

      if (context.predatorTargetActive && this.isPredatorThreat(fishActor, context)) {
        const result = this.applyPredatorChase(fishActor, context)
        chasing = result.chasing
        if (result.steal) {
          predatorSteal = fishActor
        }
      } else {
        this.applyBehavior(fishActor, timeSeconds, context.dt)
        const depthAfterBehavior = fishActor.depth

        const school = this.computeSchooling(fishActor)
        fishActor.worldX += school.x * context.dt
        fishActor.depth += school.y * context.dt
        const depthAfterSchool = fishActor.depth

        chasing = this.applyBaitAttraction(fishActor, context)
        attractionDy = fishActor.depth - depthAfterSchool

        const behaviorDy = depthAfterBehavior - depthStart
        const schoolDy = depthAfterSchool - depthAfterBehavior
        const score =
          Math.abs(context.hookWorldX - fishActor.worldX) +
          Math.abs(context.hookDepth - fishActor.depth)
        if (fishActor.tier === context.targetTier && (bestSample === null || score < bestSample.score)) {
          bestSample = {
            species: fishActor.species.name,
            tier: fishActor.tier,
            score,
            worldDepth: fishActor.depth,
            screenY: 0,
            behaviorDy,
            schoolDy,
            attractionDy,
            clampDy: 0,
            totalDy: 0,
          }
        }
      }

      this.clampToWorld(fishActor)
      const depthBeforeClamp = fishActor.depth
      fishActor.depth = Phaser.Math.Clamp(
        fishActor.depth,
        fishActor.species.minDepth,
        fishActor.species.maxDepth,
      )
      const clampDy = fishActor.depth - depthBeforeClamp

      const screenY = this.projectAndAnimate(fishActor, timeSeconds, chasing)

      if (
        bestSample !== null &&
        bestSample.species === fishActor.species.name &&
        bestSample.tier === fishActor.tier
      ) {
        bestSample.clampDy = clampDy
        bestSample.totalDy = fishActor.depth - depthStart
        bestSample.worldDepth = fishActor.depth
        bestSample.screenY = screenY
        bestSample.attractionDy = attractionDy
      }
    })

    return { debugSample: bestSample, predatorStealVictim: predatorSteal }
  }

  // Predators hunt the hooked fish during reel-in (tension moments).
  private applyPredatorChase(
    fishActor: FishActor,
    context: FishUpdateContext,
  ): { chasing: boolean; steal: boolean } {
    const timeSeconds = context.time / 1000
    const dx = context.hookWorldX - fishActor.worldX
    const dy = context.hookDepth - fishActor.depth
    const distance = Math.hypot(dx, dy)

    if (distance >= PREDATOR.aggroRadius) {
      this.applyBehavior(fishActor, timeSeconds, context.dt)
      return { chasing: false, steal: false }
    }

    if (distance <= PREDATOR.biteDistance) {
      return { chasing: true, steal: true }
    }

    const chaseSpeed = fishActor.speed * PREDATOR.chaseMultiplier
    fishActor.worldX += (dx / distance) * chaseSpeed * context.dt
    fishActor.depth += (dy / distance) * chaseSpeed * context.dt
    fishActor.direction = dx >= 0 ? 1 : -1
    return { chasing: true, steal: false }
  }

  private isPredatorThreat(fishActor: FishActor, context: FishUpdateContext): boolean {
    if (!fishActor.species.predator || context.caughtTier === null) {
      return false
    }
    if (context.hookDepth < PREDATOR.minAggroDepth) {
      return false
    }
    // Only bigger fish than the catch bother hunting it.
    return TIER_ORDER.indexOf(fishActor.tier) > TIER_ORDER.indexOf(context.caughtTier)
  }

  // Target-tier fish chase the lure horizontally (never vertically -- see lessons
  // learnt). Returns whether this fish is actively chasing the lure.
  private applyBaitAttraction(fishActor: FishActor, context: FishUpdateContext): boolean {
    if (
      !context.baitActive ||
      context.caughtTier !== null ||
      fishActor.tier !== context.targetTier ||
      context.hookDepth < BAIT_ATTRACTION.minDepth
    ) {
      return false
    }

    const dx = context.hookWorldX - fishActor.worldX
    const dy = context.hookDepth - fishActor.depth
    if (Math.abs(dy) > BAIT_ATTRACTION.maxVerticalDelta) {
      return false
    }

    const horizontalDistance = Math.abs(dx)
    if (horizontalDistance <= 0.01 || horizontalDistance >= BAIT_ATTRACTION.aggroRadius[fishActor.tier]) {
      return false
    }

    const chaseSpeed = fishActor.speed * BAIT_ATTRACTION.aggroMultiplier[fishActor.tier]
    fishActor.worldX += Math.sign(dx) * chaseSpeed * context.dt
    fishActor.direction = dx >= 0 ? 1 : -1
    return true
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
      if (distance > SCHOOLING.radius || distance < 0.001) {
        return
      }

      centerX += other.worldX
      centerY += other.depth
      cohesionCount += 1

      if (distance < SCHOOLING.separationDistance) {
        const push = (SCHOOLING.separationDistance - distance) / SCHOOLING.separationDistance
        separationX -= (dx / distance) * push * SCHOOLING.separationForce * self.speed
        separationY -= (dy / distance) * push * SCHOOLING.separationForce * self.speed
      }
    })

    let cohesionX = 0
    let cohesionY = 0
    if (cohesionCount > 0) {
      cohesionX = (centerX / cohesionCount - self.worldX) * 0.01 * SCHOOLING.cohesion * self.speed
      cohesionY = (centerY / cohesionCount - self.depth) * 0.01 * SCHOOLING.cohesion * self.speed
    }

    return { x: cohesionX + separationX, y: cohesionY + separationY }
  }

  private clampToWorld(fishActor: FishActor): void {
    const { waterLeftX, worldMaxX } = this.layout
    if (fishActor.worldX > worldMaxX - 18) {
      fishActor.worldX = worldMaxX - 18
      fishActor.direction = -1
    } else if (fishActor.worldX < waterLeftX + 18) {
      fishActor.worldX = waterLeftX + 18
      fishActor.direction = 1
    }
  }

  private projectAndAnimate(fishActor: FishActor, timeSeconds: number, chasing: boolean): number {
    const { waterLeftX, gameWidth, surfaceY, gameHeight } = this.layout

    // Smoothly turn to face travel direction (animates a flip through zero scale).
    fishActor.facing = Phaser.Math.Linear(fishActor.facing, fishActor.direction, SCHOOLING.turnLerp)

    const bob = Math.sin(timeSeconds * fishActor.bobFreq + fishActor.driftSeed) * fishActor.bobAmp
    const screenX = this.projector.worldToScreenX(fishActor.worldX)
    const screenY = this.projector.depthToScreenY(fishActor.depth + bob)
    fishActor.sprite.setPosition(screenX, screenY)
    fishActor.sprite.scaleX = fishActor.facing

    // Tail swishes faster while actively chasing.
    const wiggleSpeed = fishActor.tailFreq * (chasing ? 1.8 : 1)
    fishActor.tail.rotation = Math.sin(timeSeconds * wiggleSpeed + fishActor.driftSeed) * 0.4
    // Slight nose pitch toward vertical motion / bob for a livelier feel.
    fishActor.sprite.rotation = Math.cos(timeSeconds * fishActor.bobFreq + fishActor.driftSeed) * 0.06

    fishActor.sprite.setVisible(
      screenX > waterLeftX - 40 &&
        screenX < gameWidth + 40 &&
        screenY > surfaceY + 4 &&
        screenY < gameHeight + 24,
    )

    return screenY
  }
}
