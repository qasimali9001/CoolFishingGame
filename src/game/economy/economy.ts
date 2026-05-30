import type { FishTier } from '../data/fishSpecies'

export type UpgradeId = 'reelSpeed' | 'maxDepth' | 'castDistance'
export type RodId = 'driftwood' | 'angler' | 'deepwater'

export interface UpgradeDefinition {
  label: string
  costs: number[]
  values: number[]
}

export interface RodDefinition {
  label: string
  cost: number
  reelMultiplier: number
  castMultiplier: number
  depthBonus: number
  description: string
}

/** Which catch tier a deployed bait tier attracts. */
export const CATCH_FOR_BAIT: Record<FishTier, FishTier> = {
  small: 'medium',
  medium: 'large',
  large: 'giant',
  giant: 'giant',
}

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
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

export const ROD_DEFINITIONS: Record<RodId, RodDefinition> = {
  driftwood: {
    label: 'Driftwood Rod',
    cost: 0,
    reelMultiplier: 1,
    castMultiplier: 1,
    depthBonus: 0,
    description: 'Starter rod. Reliable but weak.',
  },
  angler: {
    label: 'Angler Rod',
    cost: 420,
    reelMultiplier: 1.12,
    castMultiplier: 1.12,
    depthBonus: 180,
    description: 'Improves reel pull and cast power.',
  },
  deepwater: {
    label: 'Deepwater Rod',
    cost: 980,
    reelMultiplier: 1.26,
    castMultiplier: 1.24,
    depthBonus: 420,
    description: 'Heavy setup for deep, risky runs.',
  },
}

export const UPGRADE_ORDER: UpgradeId[] = ['reelSpeed', 'maxDepth', 'castDistance']
export const ROD_ORDER: RodId[] = ['driftwood', 'angler', 'deepwater']

/** Presentational formatting for an attachment's current value. */
export function formatUpgradeValue(id: UpgradeId, value: number): string {
  if (id === 'maxDepth') {
    return `+${Math.round(value)}m depth cap`
  }
  return `${Math.round(value * 100)}% multiplier`
}
