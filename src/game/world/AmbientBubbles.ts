import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { Projector } from '../camera/WorldCamera'

interface AmbientBubble {
  sprite: Phaser.GameObjects.Arc
  worldX: number
  depth: number
  riseSpeed: number
  bobAmp: number
  bobFreq: number
  phase: number
}

const BUBBLE_COUNT = 36
const WRAP_DEPTH = 1120

/**
 * Decorative rising bubbles. They live in world depth and project through the
 * shared camera projector, so they scroll with the fish and lure rather than
 * staying pinned to the screen (a static decoration would make camera motion
 * read as fish-only movement -- see lessons learnt).
 */
export class AmbientBubbles {
  private bubbles: AmbientBubble[] = []
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout

  constructor(scene: Phaser.Scene, layout: SceneLayout) {
    this.scene = scene
    this.layout = layout
  }

  create(): void {
    const { waterLeftX, worldMaxX } = this.layout
    for (let i = 0; i < BUBBLE_COUNT; i += 1) {
      const sprite = this.scene.add
        .circle(0, 0, Phaser.Math.Between(2, 5), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.22))
        .setVisible(false)
      this.bubbles.push({
        sprite,
        worldX: Phaser.Math.Between(waterLeftX + 24, worldMaxX - 24),
        depth: Phaser.Math.Between(20, 1050),
        riseSpeed: Phaser.Math.FloatBetween(3, 9),
        bobAmp: Phaser.Math.FloatBetween(1.5, 4),
        bobFreq: Phaser.Math.FloatBetween(0.7, 1.8),
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      })
    }
  }

  update(time: number, dt: number, projector: Projector): void {
    const { surfaceY, gameWidth, gameHeight, waterLeftX } = this.layout
    const waterTop = surfaceY + 6
    const waterBottom = gameHeight + 20

    this.bubbles.forEach((bubble) => {
      bubble.depth -= bubble.riseSpeed * dt
      if (bubble.depth < 8) {
        bubble.depth = WRAP_DEPTH
      }

      const x = projector.worldToScreenX(bubble.worldX)
      if (x < waterLeftX - 28 || x > gameWidth + 28) {
        bubble.sprite.setVisible(false)
        return
      }

      const bob = Math.sin(time * 0.001 * bubble.bobFreq + bubble.phase) * bubble.bobAmp
      const y = projector.depthToScreenY(bubble.depth) + bob
      const visible = y >= waterTop && y <= waterBottom
      bubble.sprite.setVisible(visible)
      if (visible) {
        bubble.sprite.setPosition(x, y)
      }
    })
  }
}
