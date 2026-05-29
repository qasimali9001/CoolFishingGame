import Phaser from 'phaser'
import type { FishSpecies } from '../data/fishSpecies'

export interface FishArt {
  container: Phaser.GameObjects.Container
  tail: Phaser.GameObjects.Container
}

const OUTLINE = 0x10243a
const OUTLINE_W = 2

// Builds a stylized side-view fish from a species profile. Art faces right (+x);
// callers flip the container via scaleX to face travel direction.
export function buildFishArt(
  scene: Phaser.Scene,
  species: FishSpecies,
  scale = 1,
): FishArt {
  const L = species.length * scale
  const H = species.height * scale

  const parts: Phaser.GameObjects.GameObject[] = []

  // --- Tail (forked), parented to its own container so it can wiggle ---
  const tail = scene.add.container(-L * 0.92, 0)
  const tailSpan = H * 1.05
  const tailReach = L * 0.7
  const tailUpper = scene.add.triangle(0, 0, 0, 0, -tailReach, -tailSpan, -tailReach * 0.5, 0, species.finColor, 1)
  tailUpper.setStrokeStyle(OUTLINE_W, OUTLINE)
  const tailLower = scene.add.triangle(0, 0, 0, 0, -tailReach, tailSpan, -tailReach * 0.5, 0, species.finColor, 1)
  tailLower.setStrokeStyle(OUTLINE_W, OUTLINE)
  tail.add([tailUpper, tailLower])
  parts.push(tail)

  // --- Dorsal fin (top), behind body so only the crest shows ---
  const dorsal = scene.add.triangle(
    -L * 0.1,
    -H * 0.9,
    -L * 0.5,
    0,
    L * 0.4,
    0,
    -L * 0.05,
    -H * 0.9,
    species.finColor,
    1,
  )
  dorsal.setStrokeStyle(OUTLINE_W, OUTLINE)
  parts.push(dorsal)

  // --- Pectoral fin (lower side) ---
  const pectoral = scene.add.triangle(
    L * 0.05,
    H * 0.55,
    0,
    0,
    -L * 0.45,
    H * 0.55,
    L * 0.1,
    H * 0.5,
    species.finColor,
    0.95,
  )
  pectoral.setStrokeStyle(OUTLINE_W, OUTLINE)
  parts.push(pectoral)

  // --- Body ---
  const body = scene.add.ellipse(0, 0, L * 2, H * 2, species.bodyColor, 1)
  body.setStrokeStyle(OUTLINE_W, OUTLINE)
  parts.push(body)

  // --- Belly highlight ---
  const belly = scene.add.ellipse(L * 0.05, H * 0.5, L * 1.5, H * 1.0, species.bellyColor, 0.85)
  parts.push(belly)

  // --- Pattern ---
  if (species.pattern === 'stripes') {
    for (let i = -1; i <= 1; i += 1) {
      const stripe = scene.add.rectangle(i * L * 0.4 - L * 0.05, 0, Math.max(2, L * 0.16), H * 1.5, species.patternColor, 0.7)
      parts.push(stripe)
    }
  } else if (species.pattern === 'spots') {
    const spotR = Math.max(1.5, H * 0.16)
    const spots: Array<[number, number]> = [
      [-L * 0.35, -H * 0.2],
      [-L * 0.05, H * 0.1],
      [L * 0.3, -H * 0.15],
      [L * 0.1, H * 0.4],
    ]
    spots.forEach(([sx, sy]) => {
      parts.push(scene.add.circle(sx, sy, spotR, species.patternColor, 0.75))
    })
  }

  // --- Eye ---
  const eyeX = L * 0.55
  const eyeY = -H * 0.28
  const eyeR = Math.max(2.2, H * 0.22)
  const eyeWhite = scene.add.circle(eyeX, eyeY, eyeR, 0xffffff, 1)
  eyeWhite.setStrokeStyle(1, OUTLINE)
  const pupil = scene.add.circle(eyeX + eyeR * 0.3, eyeY, Math.max(1.2, eyeR * 0.5), OUTLINE, 1)
  parts.push(eyeWhite, pupil)

  // --- Mouth ---
  const mouth = scene.add.triangle(
    L * 0.92,
    H * 0.05,
    0,
    -H * 0.18,
    0,
    H * 0.18,
    -L * 0.2,
    0,
    species.predator ? 0x7a2230 : species.patternColor,
    0.9,
  )
  parts.push(mouth)

  // Predators get a meaner brow.
  if (species.predator) {
    const brow = scene.add.triangle(eyeX, eyeY - eyeR, -eyeR, 0, eyeR * 1.4, -eyeR * 0.4, eyeR * 1.2, eyeR * 0.4, OUTLINE, 0.9)
    parts.push(brow)
  }

  const container = scene.add.container(0, 0, parts)
  return { container, tail }
}
