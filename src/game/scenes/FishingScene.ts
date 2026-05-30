import Phaser from 'phaser'
import { SCENE_LAYOUT } from '../config/layout'
import { LURE_PHYSICS } from '../config/physics'
import { BAIT_ATTRACTION, PREDATOR } from '../config/tuning'
import { createWorldCamera, type WorldCamera } from '../camera/WorldCamera'
import { DEFAULT_ROD_CONFIG, FishingRod } from '../entities/FishingRod'
import { ShoreAngler } from '../entities/ShoreAngler'
import { Lure } from '../entities/Lure'
import { Background } from '../world/Background'
import { AmbientBubbles } from '../world/AmbientBubbles'
import { FishController, type FishMotionDebugSample } from '../fish/FishController'
import type { FishActor } from '../fish/fishActor'
import { PlayerEconomy } from '../economy/PlayerEconomy'
import { CATCH_FOR_BAIT, type RodId, type UpgradeId } from '../economy/economy'
import { Hud, HUD_TOTAL_HEIGHT } from '../ui/Hud'
import { ShopUi } from '../ui/ShopUi'
import { DebugOverlay } from '../ui/DebugOverlay'
import { TIER_ORDER, type FishSpecies, type FishTier } from '../data/fishSpecies'

type HookMode = 'idle' | 'aiming' | 'airborne' | 'fishing' | 'reeling'

/**
 * Orchestrates the fishing loop. The scene owns the hook state machine and cast
 * flow, and delegates everything else to focused modules: camera, rod, angler,
 * lure visual, background, bubbles, fish AI, economy, and UI. It only ever
 * talks to those modules through their public API, so each can be tuned or
 * replaced without touching the others.
 */
export class FishingScene extends Phaser.Scene {
  private readonly layout = SCENE_LAYOUT
  private readonly camera: WorldCamera = createWorldCamera(SCENE_LAYOUT)
  private readonly economy = new PlayerEconomy()

  private angler!: ShoreAngler
  private rod!: FishingRod
  private lure!: Lure
  private background!: Background
  private bubbles!: AmbientBubbles
  private fish!: FishController
  private hud!: Hud
  private shop!: ShopUi
  private debug!: DebugOverlay

  // --- Hook kinematic state (world space, projected to screen for rendering) ---
  private hookX = 0
  private hookY = 0
  private hookDepth = 0
  private hookVelocity = 0
  private hookVelocityX = 0
  private hookVelocityY = 0
  private castDepthCap: number = LURE_PHYSICS.defaultDepthCap
  private castStartX = SCENE_LAYOUT.waterLeftX
  private maxDepthReached = 0

  private hookMode: HookMode = 'idle'
  private caughtTier: FishTier | null = null
  private caughtFishActor: FishActor | null = null
  private deployedBaitBaseTier: FishTier | null = null
  private deployedBaitCurrentTier: FishTier | null = null
  private queuedBaitSpecies: FishSpecies | null = null

  private totalCatches = 0
  private hasLeftSurface = false
  private pointerReelArmed = false
  private swingStartedAt = 0
  private castNeedsReset = false

  private shopOpen = false
  private debugCameraDepthDelta = 0
  private debugFishSample: FishMotionDebugSample | null = null

  private reelKey?: Phaser.Input.Keyboard.Key
  private baitKey?: Phaser.Input.Keyboard.Key
  private sellKey?: Phaser.Input.Keyboard.Key
  private reelUpgradeKey?: Phaser.Input.Keyboard.Key
  private depthUpgradeKey?: Phaser.Input.Keyboard.Key
  private castUpgradeKey?: Phaser.Input.Keyboard.Key
  private shopToggleKey?: Phaser.Input.Keyboard.Key
  private shopCloseKey?: Phaser.Input.Keyboard.Key
  private debugToggleKey?: Phaser.Input.Keyboard.Key

  constructor() {
    super('FishingScene')
  }

  create(): void {
    // Creation order defines render layering: world behind, then shore + rod +
    // lure, then fish in front of the lure, then HUD/shop on top.
    this.background = new Background(this, this.layout)
    this.background.create()

    this.bubbles = new AmbientBubbles(this, this.layout)
    this.bubbles.create()

    this.angler = new ShoreAngler(this, this.layout)
    this.angler.draw()

    this.rod = new FishingRod(this, { pivot: this.angler.handAnchor, ...DEFAULT_ROD_CONFIG })

    this.lure = new Lure(this)
    this.lure.create(this.getLineAnchorWorldX(), this.layout.surfaceY)

    this.fish = new FishController(this, this.layout, this.camera)
    this.fish.populate()

    this.hud = new Hud(this, this.layout)
    this.hud.create(() => this.toggleShop())

    this.shop = new ShopUi(this, this.layout)
    this.shop.create({
      onClose: () => this.closeShop(),
      onBuyOrEquipRod: (id) => this.handleBuyOrEquipRod(id),
      onBuyUpgrade: (id) => this.handleBuyUpgrade(id),
    })

    this.debug = new DebugOverlay(this, this.layout)
    this.debug.create()

    this.registerInput()
    this.refreshHud()
    this.setHookIdle()
    // Draw the dynamic sky/depth layer once so the first frame is complete.
    this.background.update(this.camera)
  }

  update(time: number, delta: number): void {
    if (this.shopOpen) {
      this.refreshHud()
      this.renderDebug()
      return
    }

    const dt = Math.min(delta / 1000, 0.033)
    this.updateRodPose(time)
    this.updateHook(dt)
    this.camera.updateHorizontal({
      worldX: this.hookX,
      velocityX: this.hookVelocityX,
      mode: this.getCameraFocusMode(),
    })
    this.background.update(this.camera)
    this.bubbles.update(time, dt, this.camera)
    this.updateFish(time, dt)
    this.refreshHud()
    this.renderDebug()
    this.syncHookVisuals()
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private registerInput(): void {
    const keyboard = this.input.keyboard
    this.reelKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.baitKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.B)
    this.sellKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.reelUpgradeKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ONE)
    this.depthUpgradeKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.TWO)
    this.castUpgradeKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)
    this.shopToggleKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.U)
    this.shopCloseKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    this.debugToggleKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F8)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.shopOpen || pointer.y <= HUD_TOTAL_HEIGHT + 2 || this.hookMode !== 'idle') {
        return
      }
      if (pointer.x < this.layout.waterLeftX) {
        return
      }
      this.startCastFromIdle()
    })

    this.input.on('pointerup', () => {
      if (this.shopOpen || this.hookMode !== 'aiming') {
        return
      }
      if (this.castNeedsReset) {
        this.cancelAimingCast('Cast reset. Click and hold to start a new cast.')
        return
      }
      this.releaseSwingCast()
    })

    this.reelKey?.on('down', () => {
      if (!this.shopOpen && this.hookMode === 'idle') {
        this.startCastFromIdle()
      }
    })
    this.baitKey?.on('down', () => {
      if (!this.shopOpen && this.hookMode === 'idle') {
        this.startCastFromIdle()
      }
    })
    this.sellKey?.on('down', () => {
      if (!this.shopOpen && this.hookMode === 'idle') {
        this.sellHeldCatch()
      }
    })

    this.reelUpgradeKey?.on('down', () => this.handleBuyUpgrade('reelSpeed'))
    this.depthUpgradeKey?.on('down', () => this.handleBuyUpgrade('maxDepth'))
    this.castUpgradeKey?.on('down', () => this.handleBuyUpgrade('castDistance'))
    this.shopToggleKey?.on('down', () => this.toggleShop())
    this.shopCloseKey?.on('down', () => this.closeShop())
    this.debugToggleKey?.on('down', () => this.debug.toggle())
  }

  // ---------------------------------------------------------------------------
  // Hook state machine
  // ---------------------------------------------------------------------------

  private updateHook(dt: number): void {
    if (this.hookMode === 'idle') {
      return
    }
    if (this.hookMode === 'aiming') {
      this.updateSwingAim()
      return
    }
    if (this.hookMode === 'airborne') {
      this.updateAirborneHook(dt)
      return
    }

    this.updateSubmergedHook(dt)
  }

  private updateSubmergedHook(dt: number): void {
    if (!this.input.activePointer.isDown) {
      this.pointerReelArmed = true
    }
    const mouseReeling = this.pointerReelArmed && this.input.activePointer.isDown
    const isReeling = Boolean(mouseReeling || this.reelKey?.isDown)

    const anchorWorldX = this.getLineAnchorWorldX()
    const toAnchorX = anchorWorldX - this.hookX
    const toAnchorDepth = -this.hookDepth
    const distanceToAnchor = Math.max(0.001, Math.hypot(toAnchorX, toAnchorDepth))

    let accelX = 0
    let accelDepth = LURE_PHYSICS.sinkAccel
    if (isReeling) {
      const pullDirX = toAnchorX / distanceToAnchor
      const pullDirDepth = toAnchorDepth / distanceToAnchor
      const depthRatio = Phaser.Math.Clamp(this.hookDepth / Math.max(1, this.maxDepthReached), 0, 1)
      const reelSpeedMultiplier = this.economy.getTotalReelMultiplier()
      const pullStrength = Phaser.Math.Clamp(
        LURE_PHYSICS.reelPullAccel *
          reelSpeedMultiplier *
          (0.72 + distanceToAnchor / 360 + (1 - depthRatio) * 0.38),
        LURE_PHYSICS.reelPullAccel * 0.65,
        LURE_PHYSICS.reelPullMax * reelSpeedMultiplier,
      )
      accelX += pullDirX * pullStrength
      accelDepth += pullDirDepth * pullStrength
    }

    this.hookVelocityX += accelX * dt
    this.hookVelocity += accelDepth * dt
    this.hookVelocity *= Math.exp(-LURE_PHYSICS.depthDrag * dt)
    this.hookVelocityX *= Math.exp(-LURE_PHYSICS.horizontalDrag * dt)

    this.hookX += this.hookVelocityX * dt
    this.hookDepth = Math.max(0, this.hookDepth + this.hookVelocity * dt)
    if (this.hookDepth >= this.castDepthCap) {
      this.hookDepth = this.castDepthCap
      if (this.hookVelocity > 0) {
        this.hookVelocity = 0
      }
    }
    if (isReeling && this.hookDepth <= 0.5 && this.hookVelocity > 0) {
      this.hookVelocity = 0
    }

    this.maxDepthReached = Math.max(this.maxDepthReached, this.hookDepth)
    const minHookX = this.hookDepth > 1 ? this.layout.waterLeftX + 12 : 12
    this.hookX = Phaser.Math.Clamp(this.hookX, minHookX, this.layout.worldMaxX - 12)

    if (this.hookDepth > 24) {
      this.hasLeftSurface = true
    }

    this.debugCameraDepthDelta = this.camera.updateDepth(this.hookDepth)
    this.hookY = this.camera.depthToScreenY(this.hookDepth)

    if (this.deployedBaitBaseTier !== null) {
      this.deployedBaitCurrentTier = this.computeEvolvedBaitTier(this.deployedBaitBaseTier, this.hookDepth)
    }

    if (this.caughtTier === null) {
      this.tryCatchFish()
    }

    const closeEnoughToLand = Math.abs(this.hookX - anchorWorldX) <= 26
    if (this.hookDepth <= 0.5 && isReeling && this.hasLeftSurface && closeEnoughToLand) {
      this.landCast()
    }
  }

  private landCast(): void {
    if (this.caughtTier !== null && this.caughtFishActor !== null) {
      const landedSpecies = this.caughtFishActor.species
      this.economy.addHeldCatch(landedSpecies)
      this.totalCatches += 1
      this.hud.setInfo(
        `Landed a ${landedSpecies.name} ($${landedSpecies.value}). Next cast auto-uses held fish, or press S to sell.`,
      )
    } else {
      this.hud.setInfo('No catch this cast. Try deeper or use stronger bait.')
    }

    this.destroyCaughtFish()
    this.caughtTier = null
    this.deployedBaitBaseTier = null
    this.deployedBaitCurrentTier = null
    this.setHookIdle()
    this.refreshHud()
  }

  private updateSwingAim(): void {
    this.hookX = this.getLineAnchorWorldX() + Math.cos(this.rod.swingAngle) * LURE_PHYSICS.swingLength
    this.hookY = this.rod.lineAnchorScreenY + Math.sin(this.rod.swingAngle) * LURE_PHYSICS.swingLength
  }

  private updateAirborneHook(dt: number): void {
    this.hookVelocityY += LURE_PHYSICS.airGravity * dt
    this.hookX += this.hookVelocityX * dt
    this.hookY += this.hookVelocityY * dt
    this.hookX = Phaser.Math.Clamp(this.hookX, 12, this.layout.worldMaxX - 12)

    const { waterLeftX, surfaceY } = this.layout
    if (this.hookX < waterLeftX - 2 && this.hookY >= surfaceY - 14 && this.hookVelocityY > 0) {
      this.cancelAimingCast('Lure landed on shore. Recast to fish.')
      return
    }

    if (this.hookX >= waterLeftX - 2 && this.hookY >= surfaceY + 8 && this.hookVelocityY > 0) {
      this.splashIntoWater()
    }
  }

  private splashIntoWater(): void {
    this.hookMode = 'fishing'
    this.hookDepth = 1
    this.camera.resetDepth()
    this.hookY = this.camera.depthToScreenY(this.hookDepth)
    this.hookVelocity = Math.max(120, this.hookVelocityY * 0.5)
    this.hookVelocityX = 0
    this.hookVelocityY = 0
    this.maxDepthReached = this.hookDepth
    this.castDepthCap = this.computeCastDepthCap(this.hookX)

    const queuedTier = this.queuedBaitSpecies?.tier ?? null
    this.deployedBaitBaseTier = queuedTier
    this.deployedBaitCurrentTier = queuedTier
    this.queuedBaitSpecies = null
    this.hud.setInfo(
      `Lure hit water. Depth cap: ${Math.round(this.castDepthCap)}m. Hold mouse or Space to reel.`,
    )
    this.refreshHud()
  }

  private startCastFromIdle(): void {
    this.startAim(this.economy.consumeBestAvailableBait())
  }

  private startAim(baitSpecies: FishSpecies | null): void {
    this.hookMode = 'aiming'
    this.destroyCaughtFish()
    this.caughtTier = null
    this.queuedBaitSpecies = baitSpecies
    this.deployedBaitBaseTier = null
    this.deployedBaitCurrentTier = null
    this.hookVelocity = 0
    this.hookVelocityX = 0
    this.hookVelocityY = 0
    this.castDepthCap = LURE_PHYSICS.defaultDepthCap
    this.maxDepthReached = 0
    this.hasLeftSurface = false
    this.pointerReelArmed = false
    this.swingStartedAt = this.time.now
    this.castNeedsReset = false
    this.rod.snapToBackswing()
    this.updateSwingAim()

    if (baitSpecies === null) {
      this.hud.setInfo('Casting empty hook. Catch small fish first, or recast with held fish to chain tiers.')
    } else {
      const targetTier = CATCH_FOR_BAIT[baitSpecies.tier]
      this.hud.setInfo(
        `Baiting with a held ${baitSpecies.name}. Release to throw; ${targetTier} fish can now bite.`,
      )
    }
    this.refreshHud()
  }

  private releaseSwingCast(): void {
    this.updateSwingAim()

    const tangentX = -Math.sin(this.rod.swingAngle)
    const tangentY = Math.cos(this.rod.swingAngle)
    const castDistanceMultiplier = this.economy.getTotalCastMultiplier()
    const releaseSpeed =
      Phaser.Math.Linear(LURE_PHYSICS.releaseSpeedMin, LURE_PHYSICS.releaseSpeedMax, this.rod.castProgress) *
      castDistanceMultiplier

    this.hookMode = 'airborne'
    this.hookVelocityX = tangentX * releaseSpeed
    this.hookVelocityY = tangentY * releaseSpeed
    this.castStartX = this.hookX
    this.hud.setInfo('Lure in air... steer timing, then reel once it splashes.')
  }

  private cancelAimingCast(message: string): void {
    if (this.queuedBaitSpecies !== null) {
      this.economy.addHeldCatch(this.queuedBaitSpecies)
      this.queuedBaitSpecies = null
    }
    this.setHookIdle()
    this.hud.setInfo(message)
    this.refreshHud()
  }

  private setHookIdle(): void {
    this.hookMode = 'idle'
    this.hookVelocity = 0
    this.hookVelocityX = 0
    this.hookVelocityY = 0
    this.castDepthCap = LURE_PHYSICS.defaultDepthCap
    this.maxDepthReached = 0
    this.hookDepth = 0
    this.camera.reset()
    this.castNeedsReset = false
    this.hookX = this.getLineAnchorWorldX()
    this.hookY = this.camera.depthToScreenY(this.hookDepth)
    this.syncHookVisuals()
  }

  // ---------------------------------------------------------------------------
  // Catch / bait
  // ---------------------------------------------------------------------------

  private tryCatchFish(): void {
    const fishToCatch = this.fish.findCatchable(this.getTargetCatchTier(), this.hookX, this.hookDepth)
    if (fishToCatch === null) {
      return
    }

    this.caughtTier = fishToCatch.tier
    this.caughtFishActor = fishToCatch
    this.hookMode = 'reeling'
    this.deployedBaitBaseTier = null
    this.deployedBaitCurrentTier = null

    this.fish.remove(fishToCatch)
    this.time.delayedCall(1000, () => this.fish.spawnOfTier(fishToCatch.tier))
  }

  private getTargetCatchTier(): FishTier {
    if (this.deployedBaitCurrentTier === null) {
      return 'small'
    }
    return CATCH_FOR_BAIT[this.deployedBaitCurrentTier]
  }

  private computeEvolvedBaitTier(baseTier: FishTier, hookDepth: number): FishTier {
    let tierIndex = TIER_ORDER.indexOf(baseTier)
    BAIT_ATTRACTION.evolutionDepths.forEach((depthTrigger) => {
      if (hookDepth >= depthTrigger && tierIndex < TIER_ORDER.length - 1) {
        tierIndex += 1
      }
    })
    return TIER_ORDER[tierIndex]
  }

  private destroyCaughtFish(): void {
    if (this.caughtFishActor !== null) {
      this.caughtFishActor.sprite.destroy()
      this.caughtFishActor = null
    }
  }

  private computeCastDepthCap(splashWorldX: number): number {
    const horizontalTravel = Math.max(0, splashWorldX - this.castStartX)
    const depthFromTravel = horizontalTravel * LURE_PHYSICS.depthPerHorizontalTravel
    return Phaser.Math.Clamp(
      depthFromTravel,
      LURE_PHYSICS.depthCapMin,
      LURE_PHYSICS.depthCapBase + this.economy.getTotalMaxDepthBonus(),
    )
  }

  // ---------------------------------------------------------------------------
  // Fish
  // ---------------------------------------------------------------------------

  private updateFish(time: number, dt: number): void {
    const result = this.fish.update({
      time,
      dt,
      projector: this.camera,
      targetTier: this.getTargetCatchTier(),
      baitActive: this.hookMode === 'fishing' || this.hookMode === 'reeling',
      hookWorldX: this.hookX,
      hookDepth: this.hookDepth,
      caughtTier: this.caughtTier,
      predatorTargetActive: this.isPredatorTargetActive(),
    })

    this.debugFishSample = result.debugSample
    if (result.predatorStealVictim !== null) {
      this.resolvePredatorSteal(result.predatorStealVictim)
    }
  }

  private isPredatorTargetActive(): boolean {
    return (
      this.hookMode === 'reeling' &&
      this.caughtFishActor !== null &&
      this.hookDepth >= PREDATOR.surfaceGiveUpDepth
    )
  }

  private resolvePredatorSteal(predator: FishActor): void {
    this.destroyCaughtFish()
    const stolenTier = this.caughtTier
    this.caughtTier = null
    this.cameras.main.shake(220, 0.012)
    this.hud.setInfo(
      `A ${predator.species.name} snatched your ${stolenTier ?? 'catch'}! Reel faster near predators.`,
    )
    this.refreshHud()
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  private updateRodPose(time: number): void {
    const reeling = Boolean(
      (this.pointerReelArmed && this.input.activePointer.isDown) || this.reelKey?.isDown,
    )
    const castLimitReached = this.rod.update({
      mode: this.hookMode,
      now: time,
      swingStartedAt: this.swingStartedAt,
      hookScreenX: this.camera.worldToScreenX(this.hookX),
      hookScreenY: this.hookY,
      reeling,
      fishOn: this.caughtTier !== null,
    })

    if (castLimitReached) {
      this.castNeedsReset = true
      this.hud.setInfo('Rod reached cast limit. Release to reset and recast.')
    }
  }

  private syncHookVisuals(): void {
    const hookScreenX = this.camera.worldToScreenX(this.hookX)
    this.lure.renderHook(hookScreenX, this.hookY)
    this.rod.render(hookScreenX, this.hookY)
    this.lure.syncBait(this.deployedBaitCurrentTier, hookScreenX, this.hookY + 12)

    if (this.caughtFishActor !== null) {
      this.caughtFishActor.worldX = this.hookX
      this.caughtFishActor.depth = this.hookDepth
      this.caughtFishActor.sprite.setPosition(hookScreenX, this.hookY + 14)
      this.caughtFishActor.sprite.setVisible(true)
    }
  }

  private getLineAnchorWorldX(): number {
    return this.rod.lineAnchorScreenX + this.camera.horizontalOffset
  }

  private getCameraFocusMode(): 'inactive' | 'airborne' | 'underwater' {
    if (this.hookMode === 'airborne') {
      return 'airborne'
    }
    if (this.hookMode === 'fishing' || this.hookMode === 'reeling') {
      return 'underwater'
    }
    return 'inactive'
  }

  // ---------------------------------------------------------------------------
  // HUD / shop / debug
  // ---------------------------------------------------------------------------

  private refreshHud(): void {
    this.hud.refresh(this.economy, {
      depthText: this.hookMode === 'idle' ? '0' : this.hookDepth.toFixed(0),
      capText:
        this.hookMode === 'idle' || this.hookMode === 'aiming' ? '-' : this.castDepthCap.toFixed(0),
      totalCatches: this.totalCatches,
      deployedTier: this.deployedBaitCurrentTier ?? 'none',
      targetCatch: this.getTargetCatchTier(),
      nextAutoBaitTier: this.economy.peekBestAvailableBaitTier() ?? 'none',
      shopOpen: this.shopOpen,
    })
  }

  private renderDebug(): void {
    this.debug.render({
      hookDepth: this.hookDepth,
      cameraDepthOffset: this.camera.depthOffset,
      cameraDepthDelta: this.debugCameraDepthDelta,
      followStartDepth: this.camera.followStartDepth,
      sample: this.debugFishSample,
    })
  }

  private sellHeldCatch(): void {
    if (this.economy.heldCount === 0) {
      this.hud.setInfo('Nothing to sell. Land fish first.')
      return
    }
    const { soldCount, totalValue } = this.economy.sellHeldCatch()
    this.hud.setInfo(`Sold ${soldCount} fish for $${totalValue}. Money now $${this.economy.money}.`)
    this.refreshHud()
  }

  private handleBuyUpgrade(id: UpgradeId): void {
    if (this.hookMode !== 'idle') {
      this.hud.setInfo('Upgrades can only be purchased while idle on shore.')
    } else {
      this.hud.setInfo(this.economy.tryPurchaseUpgrade(id).message)
      this.refreshHud()
    }
    this.syncShopStatusFromInfo()
  }

  private handleBuyOrEquipRod(id: RodId): void {
    if (this.hookMode !== 'idle') {
      this.hud.setInfo('Rods can only be changed while idle on shore.')
    } else {
      this.hud.setInfo(this.economy.tryBuyOrEquipRod(id).message)
      this.refreshHud()
    }
    this.syncShopStatusFromInfo()
  }

  private toggleShop(): void {
    if (this.shopOpen) {
      this.closeShop()
      return
    }
    if (this.hookMode !== 'idle') {
      this.hud.setInfo('Open the shop only while idle on shore.')
      return
    }
    this.shopOpen = true
    this.shop.refresh(this.economy)
    this.shop.setStatus('Choose a rod or attachment to buy/equip.')
    this.shop.setVisible(true)
  }

  private closeShop(): void {
    if (!this.shopOpen) {
      return
    }
    this.shopOpen = false
    this.shop.setVisible(false)
  }

  private syncShopStatusFromInfo(): void {
    if (!this.shopOpen) {
      return
    }
    this.shop.setStatus(this.hud.getInfo())
    this.shop.refresh(this.economy)
  }
}
