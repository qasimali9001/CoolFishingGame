import { TIER_ORDER, type FishSpecies, type FishTier } from '../data/fishSpecies'
import {
  ROD_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  type RodDefinition,
  type RodId,
  type UpgradeId,
} from './economy'

export interface ActionResult {
  ok: boolean
  message: string
}

/**
 * All persistent player progression: money, attachment upgrade levels, owned
 * and equipped rods, and the held-fish inventory used as bait. Rod stats and
 * attachment levels stay in separate stores and are only combined at read-time
 * through explicit total getters (see lessons learnt), so it is always clear
 * what was bought vs. equipped.
 */
export class PlayerEconomy {
  private moneyAmount = 0
  private readonly upgrades: Record<UpgradeId, number> = {
    reelSpeed: 0,
    maxDepth: 0,
    castDistance: 0,
  }
  private readonly ownedRods: Record<RodId, boolean> = {
    driftwood: true,
    angler: false,
    deepwater: false,
  }
  private equippedRod: RodId = 'driftwood'
  private heldCatches: FishSpecies[] = []

  get money(): number {
    return this.moneyAmount
  }

  get equipped(): RodId {
    return this.equippedRod
  }

  getUpgradeLevel(id: UpgradeId): number {
    return this.upgrades[id]
  }

  isRodOwned(id: RodId): boolean {
    return this.ownedRods[id]
  }

  getAttachmentValue(id: UpgradeId): number {
    return UPGRADE_DEFINITIONS[id].values[this.upgrades[id]]
  }

  getEquippedRodDefinition(): RodDefinition {
    return ROD_DEFINITIONS[this.equippedRod]
  }

  getTotalReelMultiplier(): number {
    return this.getAttachmentValue('reelSpeed') * this.getEquippedRodDefinition().reelMultiplier
  }

  getTotalCastMultiplier(): number {
    return this.getAttachmentValue('castDistance') * this.getEquippedRodDefinition().castMultiplier
  }

  getTotalMaxDepthBonus(): number {
    return this.getAttachmentValue('maxDepth') + this.getEquippedRodDefinition().depthBonus
  }

  getNextUpgradeCost(id: UpgradeId): number | null {
    const nextLevel = this.upgrades[id] + 1
    const costs = UPGRADE_DEFINITIONS[id].costs
    return nextLevel >= costs.length ? null : costs[nextLevel]
  }

  tryPurchaseUpgrade(id: UpgradeId): ActionResult {
    const nextCost = this.getNextUpgradeCost(id)
    const def = UPGRADE_DEFINITIONS[id]
    if (nextCost === null) {
      return { ok: false, message: `${def.label} is already maxed out.` }
    }
    if (this.moneyAmount < nextCost) {
      return {
        ok: false,
        message: `Need $${nextCost} for ${def.label}. Current money: $${this.moneyAmount}.`,
      }
    }
    this.moneyAmount -= nextCost
    this.upgrades[id] += 1
    return {
      ok: true,
      message: `${def.label} upgraded to L${this.upgrades[id]}. Money left: $${this.moneyAmount}.`,
    }
  }

  tryBuyOrEquipRod(id: RodId): ActionResult {
    const def = ROD_DEFINITIONS[id]
    if (this.ownedRods[id]) {
      this.equippedRod = id
      return { ok: true, message: `${def.label} equipped.` }
    }
    if (this.moneyAmount < def.cost) {
      return {
        ok: false,
        message: `Need $${def.cost} to buy ${def.label}. Current money: $${this.moneyAmount}.`,
      }
    }
    this.moneyAmount -= def.cost
    this.ownedRods[id] = true
    this.equippedRod = id
    return {
      ok: true,
      message: `Bought and equipped ${def.label}. Money left: $${this.moneyAmount}.`,
    }
  }

  // --- Inventory / bait ---

  addHeldCatch(species: FishSpecies): void {
    this.heldCatches.push(species)
  }

  countHeldByTier(): Record<FishTier, number> {
    const counts: Record<FishTier, number> = { small: 0, medium: 0, large: 0, giant: 0 }
    this.heldCatches.forEach((species) => {
      counts[species.tier] += 1
    })
    return counts
  }

  get heldCount(): number {
    return this.heldCatches.length
  }

  computeHeldInventorySellValue(): number {
    return this.heldCatches.reduce((total, species) => total + species.value, 0)
  }

  sellHeldCatch(): { soldCount: number; totalValue: number } {
    const soldCount = this.heldCatches.length
    const totalValue = this.computeHeldInventorySellValue()
    this.heldCatches = []
    this.moneyAmount += totalValue
    return { soldCount, totalValue }
  }

  /** Removes and returns the best held fish to use as bait, or null if empty. */
  consumeBestAvailableBait(): FishSpecies | null {
    const index = this.findBestHeldIndex()
    if (index < 0) {
      return null
    }
    const [species] = this.heldCatches.splice(index, 1)
    return species
  }

  peekBestAvailableBaitTier(): FishTier | null {
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
}
