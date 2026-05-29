# Cool Fishing Game - Development Phases

This phase list is the working development order for the project.

Scope rule: all game code, assets, configs, and docs for this game stay inside `Meta/CoolFishingGame/`.

Bait tier shorthand used in these phases: `small -> medium -> large -> giant`.

## Phase 1 - Project Foundation
- Initialize Phaser 3 + TypeScript + Vite project structure.
- Set up scenes, config, and base folder layout for modular growth.
- Add basic run/build scripts and confirm local dev startup works.

## Phase 2 - First Playable Core Loop
- Implement boat, water view, cast, hook, and reel mechanics.
- Add basic fish spawn/movement and instant hook-on-contact behavior.
- Add fish retention flow so caught small fish can be held as active bait.
- Add re-deploy flow: send held fish back into water as bait to attract larger fish.
- Implement bait evolution using `small -> medium -> large -> giant` as deployed bait descends.
- Ensure first 30-second gameplay feels responsive and fun.

## Phase 3 - Economy and Upgrade Backbone
- Add money tracking and explicit sell flow (player chooses when to sell catch).
- Add bait-state UI so player can see held bait, deployed bait tier, and risk/reward.
- Implement first upgrade set: reel speed, max depth, cast distance.
- Wire upgrades directly into gameplay values.
- Keep upgrade definitions data-driven for easy tuning.

## Phase 4 - Fish System Expansion
- Define fish via structured data (depth range, rarity, value, behavior).
- Add multiple fish tiers and deeper-water rarity progression.
- Add attraction rules mapping bait tiers to catch tiers (`small` bait for `medium` catch, `medium` for `large`, `large` for `giant`).
- Introduce predator behavior that targets hooked fish during reel-in.
- Tune tension so predator interactions are threatening but fair.

## Phase 5 - Depth, Biomes, and Atmosphere
- Implement depth zoning and biome transitions.
- Add per-biome visuals (color/background mood shifts).
- Add per-biome ambience/audio progression from cozy to strange.
- Gate biome access through progression and depth upgrades.

## Phase 6 - Progression Systems Layer
- Add achievement system with gameplay-relevant rewards.
- Add lightweight quest system (species, depth, money, bait-chain/survival goals).
- Ensure both systems reinforce the "one more cast" loop.
- Keep all definitions data/config-driven.

## Phase 7 - Environmental Storytelling Pass
- Add visual world clues (ruins, machinery, skeletons, anomalies).
- Escalate weirdness gradually with depth and late-game content.
- Preserve no-dialogue, no-exposition storytelling approach.
- Validate that mystery is readable through play, not text dumps.

## Phase 8 - Save, Settings, and Persistence
- Implement localStorage save/load pipeline.
- Persist money, upgrades, discovered fish, achievements, quests, regions, settings, and bait-chain state.
- Add safe initialization/default handling for new saves.
- Test save consistency across reloads and gameplay milestones.

## Phase 9 - UX and Performance Polish
- Improve feedback: reel feel, catch clarity, hit responses, UI readability.
- Balance progression pacing, reward cadence, and frustration points.
- Optimize update loops/spawn counts/render cost for lightweight browser play.
- Ensure stable gameplay on target desktop browser setup.

## Phase 10 - Content Completion and Release Prep
- Fill remaining fish/upgrades/biome content needed for v1 experience.
- Do full progression pass validating small-fish -> larger-bait -> larger-catch loops from new save to deepest content.
- Final bug sweep, tuning pass, and deployment-readiness checks.
- Prepare for GitHub Pages deployment and post-launch content iteration.
