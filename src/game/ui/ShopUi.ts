import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { PlayerEconomy } from '../economy/PlayerEconomy'
import {
  ROD_DEFINITIONS,
  ROD_ORDER,
  UPGRADE_DEFINITIONS,
  UPGRADE_ORDER,
  formatUpgradeValue,
  type RodId,
  type UpgradeId,
} from '../economy/economy'

export interface ShopCallbacks {
  onClose: () => void
  onBuyOrEquipRod: (id: RodId) => void
  onBuyUpgrade: (id: UpgradeId) => void
}

interface ShopUpgradeRow {
  labelText: Phaser.GameObjects.Text
  levelText: Phaser.GameObjects.Text
  valueText: Phaser.GameObjects.Text
  buyButton: Phaser.GameObjects.Rectangle
  buyButtonText: Phaser.GameObjects.Text
}

interface ShopRodRow {
  labelText: Phaser.GameObjects.Text
  bonusText: Phaser.GameObjects.Text
  descriptionText: Phaser.GameObjects.Text
  actionButton: Phaser.GameObjects.Rectangle
  actionButtonText: Phaser.GameObjects.Text
}

/** Modal upgrade shop: rods + attachments. Pure presentation; the scene owns
 * the rules (idle-only, affordability) via the supplied callbacks. */
export class ShopUi {
  private container!: Phaser.GameObjects.Container
  private moneyText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private rodRows!: Record<RodId, ShopRodRow>
  private upgradeRows!: Record<UpgradeId, ShopUpgradeRow>
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout

  constructor(scene: Phaser.Scene, layout: SceneLayout) {
    this.scene = scene
    this.layout = layout
  }

  create(callbacks: ShopCallbacks): void {
    const centerX = this.layout.gameWidth * 0.5
    const centerY = this.layout.gameHeight * 0.5

    const overlay = this.scene.add
      .rectangle(centerX, centerY, this.layout.gameWidth, this.layout.gameHeight, 0x020617, 0.72)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', callbacks.onClose)
    const panel = this.scene.add.rectangle(centerX, centerY, 760, 520, 0x0f172a, 0.97).setStrokeStyle(3, 0x334155)

    const title = this.scene.add
      .text(centerX, centerY - 232, 'Upgrade Shop', { fontFamily: 'Consolas, monospace', fontSize: '34px', color: '#f8fafc' })
      .setOrigin(0.5, 0.5)
    const subtitle = this.scene.add
      .text(centerX, centerY - 202, 'Buy rods and rod attachments while idle on shore.', {
        fontFamily: 'Consolas, monospace',
        fontSize: '16px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0.5)

    this.moneyText = this.scene.add
      .text(centerX, centerY - 164, '', { fontFamily: 'Consolas, monospace', fontSize: '22px', color: '#86efac' })
      .setOrigin(0.5, 0.5)
    this.statusText = this.scene.add
      .text(centerX, centerY + 218, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '15px',
        color: '#e2e8f0',
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5, 0.5)

    const closeHint = this.scene.add
      .text(centerX + 332, centerY - 238, 'Close [Esc/U]', { fontFamily: 'Consolas, monospace', fontSize: '14px', color: '#94a3b8' })
      .setOrigin(1, 0.5)
    const rodHeader = this.scene.add.text(centerX - 334, centerY - 130, 'Rods', {
      fontFamily: 'Consolas, monospace',
      fontSize: '24px',
      color: '#fef3c7',
    })
    const attachmentHeader = this.scene.add.text(centerX - 334, centerY + 88, 'Attachments', {
      fontFamily: 'Consolas, monospace',
      fontSize: '24px',
      color: '#bfdbfe',
    })

    this.rodRows = {
      driftwood: this.createRodRow('driftwood', centerX, centerY - 82, callbacks),
      angler: this.createRodRow('angler', centerX, centerY - 26, callbacks),
      deepwater: this.createRodRow('deepwater', centerX, centerY + 30, callbacks),
    }
    this.upgradeRows = {
      reelSpeed: this.createUpgradeRow('reelSpeed', centerX, centerY + 142, callbacks),
      maxDepth: this.createUpgradeRow('maxDepth', centerX, centerY + 196, callbacks),
      castDistance: this.createUpgradeRow('castDistance', centerX, centerY + 250, callbacks),
    }

    this.container = this.scene.add.container(0, 0, [
      overlay,
      panel,
      title,
      subtitle,
      this.moneyText,
      closeHint,
      rodHeader,
      attachmentHeader,
      ...Object.values(this.rodRows).flatMap((row) => [
        row.labelText,
        row.bonusText,
        row.descriptionText,
        row.actionButton,
        row.actionButtonText,
      ]),
      ...Object.values(this.upgradeRows).flatMap((row) => [
        row.labelText,
        row.levelText,
        row.valueText,
        row.buyButton,
        row.buyButtonText,
      ]),
      this.statusText,
    ])
    this.container.setDepth(3000)
    this.container.setVisible(false)
  }

  get isVisible(): boolean {
    return this.container.visible
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  setStatus(text: string): void {
    this.statusText.setText(text)
  }

  refresh(economy: PlayerEconomy): void {
    this.moneyText.setText(`Money: $${economy.money}`)
    this.refreshRodRows(economy)
    this.refreshUpgradeRows(economy)
  }

  private createRodRow(id: RodId, centerX: number, y: number, callbacks: ShopCallbacks): ShopRodRow {
    const def = ROD_DEFINITIONS[id]
    const labelText = this.scene.add.text(centerX - 334, y - 16, def.label, {
      fontFamily: 'Consolas, monospace',
      fontSize: '19px',
      color: '#f8fafc',
    })
    const bonusText = this.scene.add.text(centerX - 40, y - 16, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#e2e8f0',
    })
    const descriptionText = this.scene.add.text(centerX - 334, y + 10, def.description, {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#94a3b8',
    })
    const actionButton = this.scene.add
      .rectangle(centerX + 260, y, 166, 42, 0x15803d, 1)
      .setStrokeStyle(2, 0x22c55e)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => callbacks.onBuyOrEquipRod(id))
    const actionButtonText = this.scene.add
      .text(centerX + 260, y, '', { fontFamily: 'Consolas, monospace', fontSize: '16px', color: '#f8fafc' })
      .setOrigin(0.5, 0.5)

    return { labelText, bonusText, descriptionText, actionButton, actionButtonText }
  }

  private createUpgradeRow(id: UpgradeId, centerX: number, y: number, callbacks: ShopCallbacks): ShopUpgradeRow {
    const labelText = this.scene.add.text(centerX - 334, y - 18, UPGRADE_DEFINITIONS[id].label, {
      fontFamily: 'Consolas, monospace',
      fontSize: '18px',
      color: '#f8fafc',
    })
    const levelText = this.scene.add.text(centerX - 120, y - 18, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#bfdbfe',
    })
    const valueText = this.scene.add.text(centerX - 334, y + 5, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#cbd5e1',
    })
    const buyButton = this.scene.add
      .rectangle(centerX + 260, y, 166, 38, 0x15803d, 1)
      .setStrokeStyle(2, 0x22c55e)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => callbacks.onBuyUpgrade(id))
    const buyButtonText = this.scene.add
      .text(centerX + 260, y, '', { fontFamily: 'Consolas, monospace', fontSize: '15px', color: '#f8fafc' })
      .setOrigin(0.5, 0.5)

    return { labelText, levelText, valueText, buyButton, buyButtonText }
  }

  private refreshRodRows(economy: PlayerEconomy): void {
    ROD_ORDER.forEach((id) => {
      const row = this.rodRows[id]
      const def = ROD_DEFINITIONS[id]
      row.bonusText.setText(
        `Reel x${def.reelMultiplier.toFixed(2)}  |  Cast x${def.castMultiplier.toFixed(2)}  |  Depth +${def.depthBonus}m`,
      )

      if (economy.equipped === id) {
        row.actionButtonText.setText('Equipped')
        row.actionButton.setFillStyle(0x1d4ed8, 1)
        row.actionButton.setStrokeStyle(2, 0x60a5fa)
        return
      }
      if (economy.isRodOwned(id)) {
        row.actionButtonText.setText('Equip')
        row.actionButton.setFillStyle(0x0f766e, 1)
        row.actionButton.setStrokeStyle(2, 0x2dd4bf)
        return
      }

      row.actionButtonText.setText(`Buy $${def.cost}`)
      this.styleAffordButton(row.actionButton, economy.money >= def.cost)
    })
  }

  private refreshUpgradeRows(economy: PlayerEconomy): void {
    UPGRADE_ORDER.forEach((id) => {
      const row = this.upgradeRows[id]
      const def = UPGRADE_DEFINITIONS[id]
      const level = economy.getUpgradeLevel(id)
      const nextCost = economy.getNextUpgradeCost(id)

      row.levelText.setText(`Level ${level} / ${def.values.length - 1}`)
      row.valueText.setText(`Attachment bonus: ${formatUpgradeValue(id, economy.getAttachmentValue(id))}`)

      if (nextCost === null) {
        row.buyButtonText.setText('MAX')
        row.buyButton.setFillStyle(0x334155, 1)
        row.buyButton.setStrokeStyle(2, 0x64748b)
        return
      }

      row.buyButtonText.setText(`Buy $${nextCost}`)
      this.styleAffordButton(row.buyButton, economy.money >= nextCost)
    })
  }

  private styleAffordButton(button: Phaser.GameObjects.Rectangle, affordable: boolean): void {
    if (affordable) {
      button.setFillStyle(0x15803d, 1)
      button.setStrokeStyle(2, 0x22c55e)
    } else {
      button.setFillStyle(0x78350f, 1)
      button.setStrokeStyle(2, 0xb45309)
    }
  }
}
