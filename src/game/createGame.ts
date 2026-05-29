import Phaser from 'phaser'
import { FishingScene } from './scenes/FishingScene'
import { GAME_HEIGHT, GAME_WIDTH } from './constants'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#73d8ff',
    parent,
    scene: [FishingScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}
