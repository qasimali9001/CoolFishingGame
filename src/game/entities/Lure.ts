import Phaser from 'phaser'
import { LURE_PHYSICS } from '../config/physics'
import { buildFishArt } from '../fish/fishArt'
import { getBaitSpeciesForTier, type FishTier } from '../data/fishSpecies'

interface BaitVisual {
  container: Phaser.GameObjects.Container
  tail: Phaser.GameObjects.Container
  tier: FishTier
}

/**
 * The visible lure: the hook itself plus the little fish that represents the
 * currently deployed bait. State/physics live in the scene; this class is only
 * responsible for drawing the hook and swapping the bait art when its tier
 * changes (e.g. as bait evolves with depth).
 */
export class Lure {
  private hook!: Phaser.GameObjects.Arc
  private baitVisual: BaitVisual | null = null
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  create(screenX: number, screenY: number): void {
    this.hook = this.scene.add
      .circle(screenX, screenY, LURE_PHYSICS.hookRadius, 0xf4f4f4, 1)
      .setStrokeStyle(2, 0x1f2937)
  }

  renderHook(screenX: number, screenY: number): void {
    this.hook.setPosition(screenX, screenY)
  }

  /** Shows/updates the deployed-bait fish, rebuilding art only on tier change. */
  syncBait(tier: FishTier | null, screenX: number, screenY: number): void {
    if (tier === null) {
      if (this.baitVisual !== null) {
        this.baitVisual.container.destroy()
        this.baitVisual = null
      }
      return
    }

    if (this.baitVisual === null || this.baitVisual.tier !== tier) {
      this.baitVisual?.container.destroy()
      const art = buildFishArt(this.scene, getBaitSpeciesForTier(tier), 0.6)
      this.baitVisual = { container: art.container, tail: art.tail, tier }
    }

    this.baitVisual.container.setPosition(screenX, screenY)
    this.baitVisual.container.setVisible(true)
  }
}
