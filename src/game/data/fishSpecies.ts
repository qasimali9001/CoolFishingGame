export type FishTier = 'small' | 'medium' | 'large' | 'giant'
export type FishRarity = 'common' | 'uncommon' | 'rare' | 'exotic'
export type FishBehavior = 'casual' | 'swooper' | 'circler' | 'darter' | 'lurker' | 'cruiser'
export type BodyShape = 'round' | 'torpedo' | 'long' | 'chunky' | 'flat'
export type PatternType = 'none' | 'stripes' | 'spots'

export interface FishSpecies {
  id: string
  name: string
  tier: FishTier
  rarity: FishRarity
  value: number
  minDepth: number
  maxDepth: number
  minSpeed: number
  maxSpeed: number
  behavior: FishBehavior
  shape: BodyShape
  length: number
  height: number
  bodyColor: number
  bellyColor: number
  finColor: number
  pattern: PatternType
  patternColor: number
  predator: boolean
}

export const TIER_ORDER: FishTier[] = ['small', 'medium', 'large', 'giant']

const RARITY_WEIGHT: Record<FishRarity, number> = {
  common: 1,
  uncommon: 0.5,
  rare: 0.22,
  exotic: 0.08,
}

// Bay-inspired roster (Cat Goes Fishing). Values are tuned to this game's economy,
// not the source game's prices. Depth ranges drive the deeper = rarer progression.
export const FISH_SPECIES: FishSpecies[] = [
  // ---- Small ----
  {
    id: 'cuddlefish',
    name: 'Cuddlefish',
    tier: 'small',
    rarity: 'common',
    value: 10,
    minDepth: 140,
    maxDepth: 300,
    minSpeed: 20,
    maxSpeed: 44,
    behavior: 'casual',
    shape: 'round',
    length: 13,
    height: 10,
    bodyColor: 0x6fd6c2,
    bellyColor: 0xd6fff5,
    finColor: 0x46b6a2,
    pattern: 'none',
    patternColor: 0x2f8576,
    predator: false,
  },
  {
    id: 'snobfish',
    name: 'Snobfish',
    tier: 'small',
    rarity: 'common',
    value: 13,
    minDepth: 150,
    maxDepth: 320,
    minSpeed: 22,
    maxSpeed: 46,
    behavior: 'casual',
    shape: 'torpedo',
    length: 14,
    height: 9,
    bodyColor: 0x8fb7ff,
    bellyColor: 0xe4eeff,
    finColor: 0x5f87df,
    pattern: 'none',
    patternColor: 0x3a5aa8,
    predator: false,
  },
  {
    id: 'swooper',
    name: 'Swooper',
    tier: 'small',
    rarity: 'uncommon',
    value: 20,
    minDepth: 170,
    maxDepth: 340,
    minSpeed: 30,
    maxSpeed: 58,
    behavior: 'swooper',
    shape: 'torpedo',
    length: 15,
    height: 9,
    bodyColor: 0xb18cff,
    bellyColor: 0xeadcff,
    finColor: 0x8455e0,
    pattern: 'stripes',
    patternColor: 0x6a39c4,
    predator: false,
  },
  {
    id: 'kingfish',
    name: 'Kingfish',
    tier: 'small',
    rarity: 'uncommon',
    value: 24,
    minDepth: 200,
    maxDepth: 360,
    minSpeed: 34,
    maxSpeed: 64,
    behavior: 'darter',
    shape: 'torpedo',
    length: 15,
    height: 9,
    bodyColor: 0xffd76a,
    bellyColor: 0xfff3c9,
    finColor: 0xe2a92f,
    pattern: 'stripes',
    patternColor: 0xc88a1c,
    predator: false,
  },
  {
    id: 'roundfin',
    name: 'Roundfin',
    tier: 'small',
    rarity: 'rare',
    value: 34,
    minDepth: 240,
    maxDepth: 380,
    minSpeed: 26,
    maxSpeed: 50,
    behavior: 'circler',
    shape: 'round',
    length: 12,
    height: 12,
    bodyColor: 0xff9ad1,
    bellyColor: 0xffe1f1,
    finColor: 0xe05fa6,
    pattern: 'spots',
    patternColor: 0xc83f86,
    predator: false,
  },
  {
    id: 'gallina',
    name: 'Gallina',
    tier: 'small',
    rarity: 'rare',
    value: 42,
    minDepth: 260,
    maxDepth: 400,
    minSpeed: 40,
    maxSpeed: 72,
    behavior: 'darter',
    shape: 'long',
    length: 16,
    height: 7,
    bodyColor: 0x9affc0,
    bellyColor: 0xe6fff0,
    finColor: 0x52d98b,
    pattern: 'none',
    patternColor: 0x2fae66,
    predator: false,
  },

  // ---- Medium ----
  {
    id: 'mustardfish',
    name: 'Mustardfish',
    tier: 'medium',
    rarity: 'common',
    value: 32,
    minDepth: 230,
    maxDepth: 430,
    minSpeed: 26,
    maxSpeed: 52,
    behavior: 'casual',
    shape: 'chunky',
    length: 21,
    height: 15,
    bodyColor: 0xf2c14e,
    bellyColor: 0xfae6ad,
    finColor: 0xcf9a2b,
    pattern: 'spots',
    patternColor: 0xb07d1e,
    predator: false,
  },
  {
    id: 'grumper',
    name: 'Grumper',
    tier: 'medium',
    rarity: 'common',
    value: 40,
    minDepth: 250,
    maxDepth: 450,
    minSpeed: 24,
    maxSpeed: 50,
    behavior: 'casual',
    shape: 'chunky',
    length: 22,
    height: 17,
    bodyColor: 0x7fa8c9,
    bellyColor: 0xdfeefb,
    finColor: 0x53789a,
    pattern: 'none',
    patternColor: 0x3a5b78,
    predator: false,
  },
  {
    id: 'beakfish',
    name: 'Beakfish',
    tier: 'medium',
    rarity: 'uncommon',
    value: 54,
    minDepth: 280,
    maxDepth: 470,
    minSpeed: 30,
    maxSpeed: 58,
    behavior: 'darter',
    shape: 'long',
    length: 24,
    height: 12,
    bodyColor: 0xa0e0a0,
    bellyColor: 0xe7fbe7,
    finColor: 0x5fb45f,
    pattern: 'stripes',
    patternColor: 0x3f8d3f,
    predator: false,
  },
  {
    id: 'queenfish',
    name: 'Queenfish',
    tier: 'medium',
    rarity: 'rare',
    value: 86,
    minDepth: 320,
    maxDepth: 500,
    minSpeed: 28,
    maxSpeed: 56,
    behavior: 'lurker',
    shape: 'round',
    length: 22,
    height: 18,
    bodyColor: 0xe89bff,
    bellyColor: 0xf7e1ff,
    finColor: 0xbf5ee0,
    pattern: 'spots',
    patternColor: 0x9a3fc0,
    predator: false,
  },

  // ---- Large ----
  {
    id: 'cowfish',
    name: 'Cowfish',
    tier: 'large',
    rarity: 'common',
    value: 110,
    minDepth: 330,
    maxDepth: 520,
    minSpeed: 22,
    maxSpeed: 46,
    behavior: 'casual',
    shape: 'chunky',
    length: 30,
    height: 22,
    bodyColor: 0xffb066,
    bellyColor: 0xfff0df,
    finColor: 0xdd8636,
    pattern: 'spots',
    patternColor: 0xbf6a22,
    predator: false,
  },
  {
    id: 'seraph',
    name: 'Seraph',
    tier: 'large',
    rarity: 'uncommon',
    value: 150,
    minDepth: 360,
    maxDepth: 540,
    minSpeed: 30,
    maxSpeed: 60,
    behavior: 'swooper',
    shape: 'flat',
    length: 30,
    height: 24,
    bodyColor: 0xfff2a8,
    bellyColor: 0xfffce0,
    finColor: 0xe6cf63,
    pattern: 'stripes',
    patternColor: 0xc9ac3f,
    predator: false,
  },
  {
    id: 'brimble',
    name: 'Brimble',
    tier: 'large',
    rarity: 'rare',
    value: 200,
    minDepth: 400,
    maxDepth: 560,
    minSpeed: 26,
    maxSpeed: 52,
    behavior: 'lurker',
    shape: 'chunky',
    length: 32,
    height: 24,
    bodyColor: 0x86c1b0,
    bellyColor: 0xdcf3ec,
    finColor: 0x4f8f7e,
    pattern: 'spots',
    patternColor: 0x356759,
    predator: false,
  },
  {
    id: 'turgeon',
    name: 'Turgeon',
    tier: 'large',
    rarity: 'rare',
    value: 240,
    minDepth: 380,
    maxDepth: 560,
    minSpeed: 44,
    maxSpeed: 78,
    behavior: 'cruiser',
    shape: 'torpedo',
    length: 34,
    height: 18,
    bodyColor: 0xc97f6a,
    bellyColor: 0xf0d8cf,
    finColor: 0x9a5340,
    pattern: 'stripes',
    patternColor: 0x77392b,
    predator: true,
  },

  // ---- Giant ----
  {
    id: 'anglerfish',
    name: 'Anglerfish',
    tier: 'giant',
    rarity: 'rare',
    value: 360,
    minDepth: 440,
    maxDepth: 600,
    minSpeed: 26,
    maxSpeed: 50,
    behavior: 'lurker',
    shape: 'chunky',
    length: 40,
    height: 30,
    bodyColor: 0x6b5aa6,
    bellyColor: 0x9b8fd0,
    finColor: 0x463a73,
    pattern: 'spots',
    patternColor: 0x2c2350,
    predator: false,
  },
  {
    id: 'shark',
    name: 'Shark',
    tier: 'giant',
    rarity: 'exotic',
    value: 480,
    minDepth: 420,
    maxDepth: 600,
    minSpeed: 52,
    maxSpeed: 92,
    behavior: 'cruiser',
    shape: 'torpedo',
    length: 48,
    height: 24,
    bodyColor: 0x9aa7b4,
    bellyColor: 0xeef2f6,
    finColor: 0x6c7884,
    pattern: 'none',
    patternColor: 0x515b66,
    predator: true,
  },
]

const SPECIES_BY_ID: Record<string, FishSpecies> = FISH_SPECIES.reduce(
  (acc, species) => {
    acc[species.id] = species
    return acc
  },
  {} as Record<string, FishSpecies>,
)

export function getSpeciesById(id: string): FishSpecies | undefined {
  return SPECIES_BY_ID[id]
}

export function getSpeciesForTier(tier: FishTier): FishSpecies[] {
  return FISH_SPECIES.filter((species) => species.tier === tier)
}

// Weighted pick: rarer species are less likely. Optional depth biases the pick so
// rarer fish surface more often in deeper water (deeper = rarer progression).
export function pickSpeciesForTier(tier: FishTier, depthBias = 0): FishSpecies {
  const pool = getSpeciesForTier(tier)
  let totalWeight = 0
  const weights = pool.map((species) => {
    const rarityWeight = RARITY_WEIGHT[species.rarity]
    const depthFavor =
      depthBias > 0 && depthBias >= species.minDepth
        ? 1 + Math.max(0, (depthBias - 300) / 300) * (1 - rarityWeight)
        : 1
    const weight = rarityWeight * depthFavor
    totalWeight += weight
    return weight
  })

  let roll = Math.random() * totalWeight
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) {
      return pool[i]
    }
  }

  return pool[pool.length - 1]
}

// Default representative species per tier, used for deployed-bait visuals.
export function getBaitSpeciesForTier(tier: FishTier): FishSpecies {
  return getSpeciesForTier(tier)[0]
}
