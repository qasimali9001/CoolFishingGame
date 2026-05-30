import { GAME_HEIGHT, GAME_WIDTH } from '../constants'

/**
 * Every piece of scene geometry derives from this layout. Moving the shoreline,
 * resizing the canvas, or repositioning the angler should only ever require
 * editing values here -- gameplay, anchoring, and camera math read from it so
 * nothing downstream carries its own hard-coded screen offsets.
 */
export interface SceneLayout {
  /** Logical canvas size. */
  gameWidth: number
  gameHeight: number
  /** Screen Y of the waterline while the camera rests at the surface. */
  surfaceY: number
  /** Width of the left shore band (the bank the angler stands on). */
  bankWidth: number
  /** World X where fishable water begins (just right of the bank edge). */
  waterLeftX: number
  /** Rightmost fishable world X. */
  worldMaxX: number
  /** Screen Y the on-shore angler is seated at (grass cap, not the waterline). */
  seatY: number
  /** Visible water height below the surface at rest. */
  visibleWaterHeight: number
}

function deriveLayout(): SceneLayout {
  const surfaceY = GAME_HEIGHT - 220
  const bankWidth = 170
  return {
    gameWidth: GAME_WIDTH,
    gameHeight: GAME_HEIGHT,
    surfaceY,
    bankWidth,
    // Small inset keeps the lure off the literal bank edge.
    waterLeftX: bankWidth + 10,
    worldMaxX: 2200,
    // Anchor shore actors to the grass cap, not the waterline (see lessons learnt).
    seatY: surfaceY - 30,
    visibleWaterHeight: GAME_HEIGHT - surfaceY,
  }
}

export const SCENE_LAYOUT: SceneLayout = deriveLayout()
