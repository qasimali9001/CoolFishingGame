import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { Projector } from '../camera/WorldCamera'
import type { FishBehavior, FishSpecies, FishTier } from '../data/fishSpecies'
import { buildFishArt } from './fishArt'

/** A live fish in the water: art plus the simulation state that drives it. */
export interface FishActor {
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

/** Builds a fish actor (art + randomized motion params) for a species. */
export function createFishActor(
  scene: Phaser.Scene,
  species: FishSpecies,
  layout: SceneLayout,
  projector: Projector,
): FishActor {
  const worldX = Phaser.Math.Between(layout.waterLeftX + 20, layout.worldMaxX - 20)
  const depth = Phaser.Math.Between(species.minDepth, species.maxDepth)
  const direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1

  const art = buildFishArt(scene, species)
  art.container.setPosition(projector.worldToScreenX(worldX), projector.depthToScreenY(depth))
  art.container.setScale(direction, 1)

  return {
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
  }
}
