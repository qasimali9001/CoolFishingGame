# Cursor Master Prompt — 2D Incremental Fishing Game

You are an expert indie game developer helping build a lightweight browser-based 2D fishing game inspired by Cat Goes Fishing.

The game must be:

* playable entirely in browser
* deployable to GitHub Pages
* lightweight and performant
* easy to expand with content later
* written cleanly and modularly
* designed for solo development
* built with Phaser 3 + TypeScript + Vite

The overall tone:

* starts cozy, cute, colorful, and goofy
* slowly becomes stranger and eerier as the player reaches deeper waters
* environmental storytelling only
* no exposition dumps
* no dialogue explaining the world
* mystery should emerge naturally through visuals, fish design, ruins, strange structures, and increasingly bizarre creatures

Core gameplay loop:

1. Cast line into water
2. Fish swim around underwater in side view
3. Hook catches fish instantly on contact
4. Reel fish upward
5. Larger predator fish may attack hooked fish before reaching the surface
6. Successfully landed fish are sold automatically for money
7. Money buys upgrades
8. Upgrades allow deeper fishing and access to rarer fish
9. Repeat

Game perspective:

* side-view vertical fishing gameplay
* player boat sits at top of screen
* line drops downward into water
* fish swim horizontally
* deeper regions become darker and stranger

Important design philosophy:

* simple controls
* strong progression dopamine
* frequent upgrades
* satisfying incremental growth
* highly replayable
* simple mechanics with emergent interactions
* avoid overcomplication

DO NOT implement:

* multiplayer
* crafting systems
* procedural worlds
* heavy physics rope simulation
* complicated combat systems
* dialogue-heavy storytelling
* survival mechanics
* stamina systems
* inventory management complexity

========================
TECH STACK
==========

Use:

* Phaser 3
* TypeScript
* Vite
* localStorage save system
* JSON-based data definitions
* modular architecture

Structure code for maintainability and future expansion.

========================
INITIAL GAME SYSTEMS
====================

Implement these systems first:

1. Fishing System

* cast line downward
* player controls reel timing
* hooked fish follow hook
* reel upward movement
* fish can escape if predator eats them

2. Fish AI

* small fish swim casually
* fish have:

  * speed
  * depth range
  * rarity
  * value
  * behavior type
* predators only become aggressive when a fish is hooked
* predators attempt to eat hooked fish during reel-in
* predators should create tension moments

3. Upgrade Shop
   Initial upgrade categories:

* reel speed
* max depth
* cast distance
* hook count (later upgrade)
* lantern/light radius
* rare fish chance
* passive income fishing rods

4. Depth Biomes
   Create depth zones:

* Sunny Shores
* Kelp Forest
* Twilight Waters
* Midnight Trench
* Industrial Graveyard
* The Maw

Each biome should have:

* unique fish
* different background colors
* unique ambience
* slightly different audio feel
* increasing visual weirdness

5. Achievement System
   Achievements should grant gameplay bonuses.

Examples:

* catch 50 fish
* discover deep biome
* survive predator attacks
* catch rare fish

Rewards:

* passive bonuses
* money bonuses
* rare spawn increases
* reel efficiency

6. Quest System
   Simple lightweight quests:

* catch species
* reach depth
* earn money
* survive predator attacks

Quests reward:

* money
* consumables
* temporary buffs

7. Environmental Storytelling
   No text exposition.

Use:

* ruins
* giant skeletons
* strange machinery
* warning buoys
* glowing eyes
* impossible fish anatomy
* increasingly unnatural environments

The player should slowly realize:
something enormous exists far below.

========================
VISUAL STYLE
============

Art direction:

* cute simple cartoon visuals initially
* colorful and approachable
* gradually transitions into weird goofy horror
* think “3-eyed Simpsons fish” energy
* avoid realistic horror
* strange rather than terrifying

UI should be:

* clean
* minimal
* highly readable
* cozy arcade style

========================
AUDIO DIRECTION
===============

Audio progression:

* cozy/chill near surface
* funky and strange deeper down
* increasingly ambient and unsettling in late-game
* avoid full horror soundtrack

========================
SAVE SYSTEM
===========

Use localStorage.

Save:

* money
* upgrades
* discovered fish
* achievements
* quests
* unlocked regions
* settings

========================
GAME DESIGN GOALS
=================

The game should:

* feel satisfying within first 30 seconds
* provide upgrades frequently
* encourage “one more cast”
* constantly tease deeper mysteries
* avoid frustration
* remain lightweight and performant

========================
IMPORTANT IMPLEMENTATION NOTES
==============================

Prioritize:

1. core gameplay feel
2. progression loop
3. polish
4. content expansion

Keep systems data-driven.

Fish, upgrades, achievements, and quests should all be defined through JSON or config objects for easy future expansion.

Build the project incrementally:

* first playable prototype
* then progression
* then content
* then polish

========================
FIRST DEVELOPMENT TASK
======================

Create the initial project scaffold with:

* Phaser + TypeScript + Vite setup
* basic game scene
* water background
* boat at surface
* castable fishing line
* several basic fish
* simple fish movement AI
* hook collision
* reel mechanic
* money counter
* simple sell loop
* placeholder art using simple colored shapes

Focus on making the core fishing loop fun before adding complexity.
