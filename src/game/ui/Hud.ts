import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { PlayerEconomy } from '../economy/PlayerEconomy'
import { getBaitSpeciesForTier, type FishTier } from '../data/fishSpecies'

export const HUD_TOP_HEIGHT = 42
export const HUD_STATUS_HEIGHT = 28
export const HUD_TOTAL_HEIGHT = HUD_TOP_HEIGHT + HUD_STATUS_HEIGHT

/** Gameplay-derived status the HUD cannot read straight from the economy. */
export interface HudStatus {
  depthText: string
  capText: string
  totalCatches: number
  deployedTier: FishTier | 'none'
  targetCatch: FishTier
  nextAutoBaitTier: FishTier | 'none'
  shopOpen: boolean
}

/** Top status bars + bottom info line + shop toggle button. */
export class Hud {
  private moneyText!: Phaser.GameObjects.Text
  private depthText!: Phaser.GameObjects.Text
  private rodText!: Phaser.GameObjects.Text
  private baitText!: Phaser.GameObjects.Text
  private upgradesText!: Phaser.GameObjects.Text
  private infoText!: Phaser.GameObjects.Text
  private shopButton!: Phaser.GameObjects.Rectangle
  private shopButtonText!: Phaser.GameObjects.Text
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout

  constructor(scene: Phaser.Scene, layout: SceneLayout) {
    this.scene = scene
    this.layout = layout
  }

  create(onToggleShop: () => void): void {
    const { gameWidth, gameHeight } = this.layout

    this.scene.add.rectangle(0, 0, gameWidth, HUD_TOP_HEIGHT, 0xe2e8f0, 0.9).setOrigin(0, 0).setDepth(2000)
    this.scene.add
      .rectangle(0, HUD_TOP_HEIGHT, gameWidth, HUD_STATUS_HEIGHT, 0xf8fafc, 0.84)
      .setOrigin(0, 0)
      .setDepth(2000)

    this.scene.add.rectangle(92, HUD_TOP_HEIGHT * 0.5, 164, 28, 0xf8fafc, 0.95).setStrokeStyle(2, 0xcbd5e1).setDepth(2005)
    this.scene.add.rectangle(276, HUD_TOP_HEIGHT * 0.5, 188, 28, 0xf8fafc, 0.95).setStrokeStyle(2, 0xcbd5e1).setDepth(2005)
    this.scene.add.rectangle(590, HUD_TOP_HEIGHT * 0.5, 424, 28, 0xf8fafc, 0.95).setStrokeStyle(2, 0xcbd5e1).setDepth(2005)
    this.scene.add
      .rectangle(238, HUD_TOP_HEIGHT + HUD_STATUS_HEIGHT * 0.5, 456, 20, 0xffffff, 0.9)
      .setStrokeStyle(1, 0xcbd5e1)
      .setDepth(2005)
    this.scene.add
      .rectangle(694, HUD_TOP_HEIGHT + HUD_STATUS_HEIGHT * 0.5, 456, 20, 0xffffff, 0.9)
      .setStrokeStyle(1, 0xcbd5e1)
      .setDepth(2005)

    this.moneyText = this.scene.add
      .text(20, 11, '', { fontFamily: 'Consolas, monospace', fontSize: '16px', color: '#0b1220' })
      .setDepth(2010)
    this.depthText = this.scene.add
      .text(186, 11, '', { fontFamily: 'Consolas, monospace', fontSize: '16px', color: '#0f172a' })
      .setDepth(2010)
    this.rodText = this.scene.add
      .text(386, 11, '', { fontFamily: 'Consolas, monospace', fontSize: '15px', color: '#0f172a' })
      .setDepth(2010)
    this.baitText = this.scene.add
      .text(14, HUD_TOP_HEIGHT + 7, '', { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#0f172a' })
      .setDepth(2010)
    this.upgradesText = this.scene.add
      .text(474, HUD_TOP_HEIGHT + 7, '', { fontFamily: 'Consolas, monospace', fontSize: '13px', color: '#0f172a' })
      .setDepth(2010)

    this.infoText = this.scene.add
      .text(12, gameHeight - 34, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '16px',
        color: '#f8fafc',
        stroke: '#0f172a',
        strokeThickness: 3,
        wordWrap: { width: gameWidth - 24 },
      })
      .setDepth(2010)

    this.shopButton = this.scene.add
      .rectangle(gameWidth - 84, HUD_TOP_HEIGHT * 0.5, 132, 28, 0x1d4ed8, 1)
      .setStrokeStyle(2, 0x60a5fa)
      .setDepth(2010)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onToggleShop)
    this.shopButtonText = this.scene.add
      .text(gameWidth - 84, HUD_TOP_HEIGHT * 0.5, 'Shop [U]', {
        fontFamily: 'Consolas, monospace',
        fontSize: '15px',
        color: '#f8fafc',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2020)
  }

  setInfo(message: string): void {
    this.infoText.setText(message)
  }

  getInfo(): string {
    return this.infoText.text
  }

  refresh(economy: PlayerEconomy, status: HudStatus): void {
    const counts = economy.countHeldByTier()
    const heldBait = `S${counts.small} M${counts.medium} L${counts.large} G${counts.giant}`
    const heldSellValue = economy.computeHeldInventorySellValue()
    const targetValue = getBaitSpeciesForTier(status.targetCatch).value
    const rod = economy.getEquippedRodDefinition()

    const reelCost = economy.getNextUpgradeCost('reelSpeed')
    const depthCost = economy.getNextUpgradeCost('maxDepth')
    const castCost = economy.getNextUpgradeCost('castDistance')

    this.moneyText.setText(`$${economy.money}`)
    this.depthText.setText(`Depth ${status.depthText}m | Cap ${status.capText}m`)
    this.rodText.setText(
      `${rod.label}  Reel x${rod.reelMultiplier.toFixed(2)}  Cast x${rod.castMultiplier.toFixed(2)}  Depth +${rod.depthBonus}m  Catches ${status.totalCatches}`,
    )
    this.baitText.setText(
      `Held ${heldBait} ($${heldSellValue}) | Auto ${status.nextAutoBaitTier} | Deployed ${status.deployedTier} -> ${status.targetCatch} ($${targetValue})`,
    )
    this.upgradesText.setText(
      `[1] Reel L${economy.getUpgradeLevel('reelSpeed')} ${reelCost === null ? 'MAX' : `$${reelCost}`}  [2] Depth L${economy.getUpgradeLevel('maxDepth')} ${depthCost === null ? 'MAX' : `$${depthCost}`}  [3] Cast L${economy.getUpgradeLevel('castDistance')} ${castCost === null ? 'MAX' : `$${castCost}`}  [S] Sell`,
    )

    if (status.shopOpen) {
      this.shopButtonText.setText('Close [Esc/U]')
      this.shopButton.setFillStyle(0x0f766e, 1)
      this.shopButton.setStrokeStyle(2, 0x2dd4bf)
    } else {
      this.shopButtonText.setText('Shop [U]')
      this.shopButton.setFillStyle(0x1d4ed8, 1)
      this.shopButton.setStrokeStyle(2, 0x60a5fa)
    }
  }
}
