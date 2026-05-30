import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { Projector } from '../camera/WorldCamera'

const MINOR_DEPTH_SPACING = 50
const MAJOR_DEPTH_SPACING = 100
const LABEL_POOL_SIZE = 18
/** Depth (m) at which the deep-water darkening reaches full strength. */
const FULL_DARK_DEPTH = 1300
const MAX_DARK_ALPHA = 0.45

/**
 * Sky, water, shore, and -- crucially -- a depth reference layer that scrolls
 * with the camera.
 *
 * Previously the water was a single static screen-space rectangle, so when the
 * camera scrolled down with the lure only the fish and bubbles moved. That made
 * descending read as "the fish are rocketing upward". By projecting depth grid
 * lines, depth labels, and a darkening gradient through the same camera as the
 * fish/lure, vertical camera motion now has a visible frame of reference and
 * descent reads correctly.
 */
export class Background {
  private skyGraphics!: Phaser.GameObjects.Graphics
  private depthGraphics!: Phaser.GameObjects.Graphics
  private depthLabels: Phaser.GameObjects.Text[] = []
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout

  constructor(scene: Phaser.Scene, layout: SceneLayout) {
    this.scene = scene
    this.layout = layout
  }

  create(): void {
    const { gameWidth, gameHeight, surfaceY, bankWidth, waterLeftX } = this.layout

    // Base water fill behind everything (the camera reveals more water as the
    // lure descends, so this must cover the whole canvas).
    this.scene.add.rectangle(gameWidth * 0.5, gameHeight * 0.5, gameWidth, gameHeight, 0x3f9ecf)

    // Sky + waterline are redrawn each frame so the surface tracks the camera.
    this.skyGraphics = this.scene.add.graphics()
    this.depthGraphics = this.scene.add.graphics()

    for (let i = 0; i < LABEL_POOL_SIZE; i += 1) {
      const label = this.scene.add
        .text(0, 0, '', {
          fontFamily: 'Consolas, monospace',
          fontSize: '12px',
          color: '#0b3a52',
        })
        .setOrigin(1, 0.5)
        .setVisible(false)
      this.depthLabels.push(label)
    }

    // Shore: drawn after the depth layer so the bank always masks it on the left.
    this.scene.add.rectangle(bankWidth * 0.5, gameHeight * 0.5, bankWidth, gameHeight, 0x7c5a3a)
    this.scene.add.rectangle(bankWidth * 0.5, surfaceY - 10, bankWidth, 42, 0x5ca55c)
    this.scene.add
      .rectangle(waterLeftX, gameHeight * 0.5, 8, gameHeight, 0x4f3a27, 0.65)
      .setOrigin(0.5, 0.5)
    this.scene.add.text(16, surfaceY + 20, 'Shore start\nBoat unlock later', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#f1f5f9',
      stroke: '#1f2937',
      strokeThickness: 3,
    })
  }

  update(projector: Projector): void {
    const { surfaceY } = this.layout
    // Recover the camera's depth offset from the projector (1 world unit = 1px).
    const surfaceScreenY = projector.depthToScreenY(0)
    const cameraDepth = surfaceY - surfaceScreenY

    this.drawSky(surfaceScreenY)
    this.drawDepthReference(projector, cameraDepth, surfaceScreenY)
  }

  private drawSky(surfaceScreenY: number): void {
    const { gameWidth } = this.layout
    this.skyGraphics.clear()
    if (surfaceScreenY > 0) {
      this.skyGraphics.fillStyle(0xb8ecff, 1)
      this.skyGraphics.fillRect(0, 0, gameWidth, surfaceScreenY)
    }
  }

  private drawDepthReference(projector: Projector, cameraDepth: number, surfaceScreenY: number): void {
    const { gameWidth, gameHeight, surfaceY, waterLeftX } = this.layout
    const g = this.depthGraphics
    g.clear()

    const waterWidth = gameWidth - waterLeftX

    // Deep-water darkening: a translucent overlay over the water region whose
    // strength grows with depth. Another cue that the world is descending.
    const darkAlpha = Phaser.Math.Clamp(cameraDepth / FULL_DARK_DEPTH, 0, 1) * MAX_DARK_ALPHA
    if (darkAlpha > 0.002) {
      const top = Math.max(0, surfaceScreenY)
      g.fillStyle(0x06283d, darkAlpha)
      g.fillRect(waterLeftX, top, waterWidth, gameHeight - top)
    }

    // Bright waterline at the projected surface.
    if (surfaceScreenY >= -8 && surfaceScreenY <= gameHeight) {
      g.fillStyle(0x8bf2ff, 1)
      g.fillRect(0, surfaceScreenY - 4, gameWidth, 8)
    }

    // Horizontal depth grid lines + labels, anchored to world depth.
    const depthAtTop = -surfaceY + cameraDepth
    const depthAtBottom = gameHeight - surfaceY + cameraDepth
    const firstDepth = Math.max(0, Math.ceil(depthAtTop / MINOR_DEPTH_SPACING) * MINOR_DEPTH_SPACING)

    let labelIndex = 0
    for (let depth = firstDepth; depth <= depthAtBottom; depth += MINOR_DEPTH_SPACING) {
      const y = projector.depthToScreenY(depth)
      const isMajor = depth % MAJOR_DEPTH_SPACING === 0
      g.lineStyle(1, 0xffffff, isMajor ? 0.16 : 0.07)
      g.beginPath()
      g.moveTo(waterLeftX, y)
      g.lineTo(gameWidth, y)
      g.strokePath()

      if (isMajor && depth > 0 && labelIndex < this.depthLabels.length) {
        const label = this.depthLabels[labelIndex]
        label.setText(`${depth}m`)
        label.setPosition(gameWidth - 8, y - 1)
        label.setVisible(true)
        labelIndex += 1
      }
    }

    for (let i = labelIndex; i < this.depthLabels.length; i += 1) {
      this.depthLabels[i].setVisible(false)
    }
  }
}
