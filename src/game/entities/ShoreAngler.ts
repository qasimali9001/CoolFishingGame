import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'

export interface Anchor {
  x: number
  y: number
}

/**
 * The angler standing on the shore. Its only structural responsibility is to
 * expose the hand anchor (where the rod butt sits) so the rod stays attached
 * no matter how the angler art is redrawn or repositioned. All offsets derive
 * from the layout's seat line rather than absolute screen coordinates.
 */
export class ShoreAngler {
  private readonly handAnchorPoint: Anchor
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout

  constructor(scene: Phaser.Scene, layout: SceneLayout) {
    this.scene = scene
    this.layout = layout
    const { bankWidth, seatY } = layout
    this.handAnchorPoint = {
      x: Math.round(bankWidth * 0.48),
      y: seatY - 10,
    }
  }

  /** Where the rod is gripped. The rod anchors here so it tracks the angler. */
  get handAnchor(): Anchor {
    return { ...this.handAnchorPoint }
  }

  draw(): void {
    const { bankWidth, seatY } = this.layout
    const headX = Math.round(bankWidth * 0.41)

    // Body sits on the seat line; head rests above it.
    this.scene.add.circle(headX, seatY - 18, 10, 0xf6d365).setStrokeStyle(2, 0x2f1f12)
    this.scene.add.rectangle(headX, seatY + 4, 16, 30, 0x2d3748).setStrokeStyle(2, 0x111827)
  }
}
