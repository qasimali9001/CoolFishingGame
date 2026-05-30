import type { FishTier } from '../data/fishSpecies'

/** Loose schooling forces applied between same-tier fish. */
export const SCHOOLING = {
  radius: 92,
  cohesion: 0.9,
  separationDistance: 26,
  separationForce: 1.6,
  /** How quickly a fish rotates to face its travel direction. */
  turnLerp: 0.08,
} as const

/** Bait attraction: target-tier fish chase the lure horizontally. */
export const BAIT_ATTRACTION = {
  /** Lure must be at least this deep before it attracts fish. */
  minDepth: 42,
  /** Fish ignore the lure if it is further than this in depth. */
  maxVerticalDelta: 120,
  /** Depths (m) at which deployed bait evolves up one tier. */
  evolutionDepths: [220, 370, 520],
  aggroRadius: {
    small: 95,
    medium: 170,
    large: 240,
    giant: 320,
  } as Record<FishTier, number>,
  aggroMultiplier: {
    small: 1.2,
    medium: 1.7,
    large: 2.15,
    giant: 2.7,
  } as Record<FishTier, number>,
} as const

/** Predator tension: predators steal the hooked fish during reel-in. */
export const PREDATOR = {
  aggroRadius: 260,
  chaseMultiplier: 1.85,
  biteDistance: 26,
  /** Predators only engage once the catch is below this depth. */
  minAggroDepth: 210,
  /** Predators give up if the catch climbs above this depth. */
  surfaceGiveUpDepth: 120,
} as const

/** Starting fish population per tier (biased toward common, shallow fish). */
export const STARTING_POPULATION: Array<[FishTier, number]> = [
  ['small', 14],
  ['medium', 9],
  ['large', 6],
  ['giant', 3],
]
