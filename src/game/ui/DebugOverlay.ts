import Phaser from 'phaser'
import type { SceneLayout } from '../config/layout'
import type { FishMotionDebugSample } from '../fish/FishController'

export interface DebugRenderData {
  hookDepth: number
  cameraDepthOffset: number
  cameraDepthDelta: number
  followStartDepth: number
  sample: FishMotionDebugSample | null
}

/** Bottom-right diagnostics overlay (toggle with F8). */
export class DebugOverlay {
  private text!: Phaser.GameObjects.Text
  private enabledFlag = true
  private readonly scene: Phaser.Scene
  private readonly layout: SceneLayout

  constructor(scene: Phaser.Scene, layout: SceneLayout) {
    this.scene = scene
    this.layout = layout
  }

  create(): void {
    this.text = this.scene.add
      .text(this.layout.gameWidth - 10, this.layout.gameHeight - 10, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        color: '#fef08a',
        stroke: '#0f172a',
        strokeThickness: 3,
        align: 'right',
      })
      .setOrigin(1, 1)
      .setDepth(2020)
      .setVisible(this.enabledFlag)
  }

  get enabled(): boolean {
    return this.enabledFlag
  }

  toggle(): void {
    this.enabledFlag = !this.enabledFlag
    this.text.setVisible(this.enabledFlag)
    if (!this.enabledFlag) {
      this.text.setText('')
    }
  }

  render(data: DebugRenderData): void {
    if (!this.enabledFlag) {
      return
    }

    const { sample } = data
    if (sample === null) {
      this.text.setText(
        [
          'Debug [F8] ON',
          `hook=${data.hookDepth.toFixed(1)} cam=${data.cameraDepthOffset.toFixed(1)} dCam=${data.cameraDepthDelta.toFixed(2)} follow@${data.followStartDepth.toFixed(1)}`,
          'sample: none (no target-tier fish)',
          'Watch: big dCam with tiny fish dY => camera/projection source.',
        ].join('\n'),
      )
      return
    }

    this.text.setText(
      [
        `Debug [F8] ${sample.species}(${sample.tier}) score=${sample.score.toFixed(1)}`,
        `hook=${data.hookDepth.toFixed(1)} cam=${data.cameraDepthOffset.toFixed(1)} dCam=${data.cameraDepthDelta.toFixed(2)} follow@${data.followStartDepth.toFixed(1)} screenShift~${(-data.cameraDepthDelta).toFixed(2)}`,
        `fishDepth=${sample.worldDepth.toFixed(1)} screenY=${sample.screenY.toFixed(1)}`,
        `dY behavior=${sample.behaviorDy.toFixed(2)} school=${sample.schoolDy.toFixed(2)} attract=${sample.attractionDy.toFixed(2)} clamp=${sample.clampDy.toFixed(2)} total=${sample.totalDy.toFixed(2)}`,
      ].join('\n'),
    )
  }
}
