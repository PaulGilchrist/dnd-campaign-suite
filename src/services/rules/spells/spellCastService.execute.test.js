// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'

/* ------------------------------------------------------------------ */
/*  Mocks — minimal surface area, getRuntimeValue returns [] for      */
/*  keys the source code guards against null/undefined                */
/* ------------------------------------------------------------------ */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_key1, key2) => {
    if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  loadCombatSummary: vi.fn(),
}))

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}))

vi.mock('../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
  triggerSilence: vi.fn(),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

vi.mock('./postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve()),
  triggerSpellThief: vi.fn(() => Promise.resolve()),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve()),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve()),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
}))

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  }
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  }
}

function makeMetaCtx(overrides = {}) {
  return { slotLevel: 3, ...overrides }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: 'testCampaign',
    mapName: 'testMap',
    ...overrides,
  }
}

function getRollDamageContext(services) {
  return services.rollDamage.mock.calls[0][5]
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ---------------------------------------------------------------- */
  /*  Early-exit: spellcasting blocked by buffs                       */
  /* ---------------------------------------------------------------- */

  describe('spellcasting-blocked by buffs', () => {
    it('returns early when a buff blocks spellcasting', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.getActiveBuffs).mockReturnValue([
        { name: 'Silence', blocksSpellcasting: true },
      ])

      const services = makeServices()
      const result = await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      expect(result).toBeUndefined()
      expect(services.rollAttack).not.toHaveBeenCalled()
      expect(services.rollDamage).not.toHaveBeenCalled()
    })

    it('allows casting when no buff blocks', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.getActiveBuffs).mockReturnValue([])

      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      expect(services.rollDamage).toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Early-exit: Silence blocks Verbal components                    */
  /* ---------------------------------------------------------------- */

  describe('silence blocks verbal components', () => {
    it('returns early when caster is in silence zone and spell has Verbal', async () => {
      const silence = await import('../features/silenceService.js')
      vi.mocked(silence.getSilenceSource).mockReturnValue('SilenceCaster')
      vi.mocked(silence.isCreatureInSilenceZone).mockReturnValue(true)

      const services = makeServices()
      const result = await executeSpellCast(
        makeSpell({ components: ['V'] }),
        makeMetaCtx(),
        services,
      )

      expect(result).toBeUndefined()
      expect(services.rollDamage).not.toHaveBeenCalled()
    })

    it('allows casting when spell has no Verbal component despite silence', async () => {
      const silence = await import('../features/silenceService.js')
      vi.mocked(silence.getSilenceSource).mockReturnValue('SilenceCaster')
      vi.mocked(silence.isCreatureInSilenceZone).mockReturnValue(true)

      const services = makeServices()
      await executeSpellCast(makeSpell({ components: ['S', 'M'] }), makeMetaCtx(), services)

      expect(services.rollDamage).toHaveBeenCalled()
    })

    it('allows casting when no silence source is active', async () => {
      const silence = await import('../features/silenceService.js')
      vi.mocked(silence.getSilenceSource).mockReturnValue(null)
      vi.mocked(silence.isCreatureInSilenceZone).mockReturnValue(false)

      const services = makeServices()
      await executeSpellCast(makeSpell({ components: ['V'] }), makeMetaCtx(), services)

      expect(services.rollDamage).toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Hostile-action triggers: Friends & Invisibility end early       */
  /* ---------------------------------------------------------------- */

  describe('hostile-action triggers', () => {
    it('ends Friends when casting a non-Friends spell', async () => {
      const friends = await import('../features/friendsService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      expect(friends.endFriendsOnHostileAction).toHaveBeenCalledWith(
        'TestWizard',
        'testCampaign',
      )
    })

    it('does NOT end Friends when casting the Friends spell itself', async () => {
      const friends = await import('../features/friendsService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell({ name: 'Friends' }), makeMetaCtx(), services)

      expect(friends.endFriendsOnHostileAction).not.toHaveBeenCalled()
    })

    it('ends Invisibility on any non-self spell cast', async () => {
      const invis = await import('../features/invisibilityService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      expect(invis.endInvisibilityOnHostileAction).toHaveBeenCalledWith(
        'TestWizard',
        'testCampaign',
      )
    })

    it('sets lastActionSpellCast when casting time is 1 action', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      const services = makeServices()
      await executeSpellCast(makeSpell({ casting_time: '1 action' }), makeMetaCtx(), services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        'lastActionSpellCast',
        1,
        'testCampaign',
      )
    })

    it('does NOT set lastActionSpellCast for non-action casting times', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      const services = makeServices()
      await executeSpellCast(
        makeSpell({ casting_time: '1 bonus action' }),
        makeMetaCtx(),
        services,
      )

      expect(runtime.setRuntimeValue).not.toHaveBeenCalledWith(
        'TestWizard',
        'lastActionSpellCast',
        1,
        'testCampaign',
      )
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Formula resolution                                              */
  /* ---------------------------------------------------------------- */

  describe('damage formula resolution', () => {
    it('uses damage_at_slot_level for normal spell levels', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx({ slotLevel: 3 }), services)

      expect(services.rollDamage).toHaveBeenCalled()
      expect(services.rollDamage.mock.calls[0][1]).toBe('8d6')
    })

    it('uses damage_at_character_level for cantrips', async () => {
      const services = makeServices()
      const spell = makeSpell({
        level: 0,
        damage: {
          damage_type: 'Fire',
          damage_at_character_level: { 1: '1d10' },
        },
      })
      delete spell.damage.damage_at_slot_level

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)

      expect(services.rollDamage).toHaveBeenCalled()
      expect(services.rollDamage.mock.calls[0][1]).toBe('1d10')
    })

    it('falls back to first available slot level when exact match missing', async () => {
      const services = makeServices()
      const spell = makeSpell({
        damage: {
          damage_type: 'Fire',
          damage_at_slot_level: { 3: '8d6', 4: '10d6', 5: '12d6' },
        },
      })
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 3 }), services)

      expect(services.rollDamage.mock.calls[0][1]).toBe('8d6')
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Save DC calculation                                             */
  /* ---------------------------------------------------------------- */

  describe('save DC calculation', () => {
    it('calculates DC from spellCastingAbility when present', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      // 8 + Int bonus(5) + proficiency(4) = 17
      expect(ctx.saveDc).toBe(17)
    })

    it('falls back to playerStats.spellAbilities.saveDc when no ability match', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          spellAbilities: { toHit: 9, saveDc: 17, modifier: 5 },
          abilities: [],
        }),
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.saveDc).toBe(17)
    })

    it('adds Innate Sorcery +1 to save DC', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.isInnateSorceryActive).mockReturnValue(true)

      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.saveDc).toBe(18)
    })

    it('does not add Innate Sorcery when inactive', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.isInnateSorceryActive).mockReturnValue(false)

      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.saveDc).toBe(17)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Saving-throw spells (dc present)                                */
  /* ---------------------------------------------------------------- */

  describe('saving-throw spells', () => {
    it('passes save type and success condition to rollDamage context', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.saveType).toBe('dex')
      expect(ctx.dcSuccess).toBe('half')
    })

    it('includes status_effects as statusEffects in context', async () => {
      const services = makeServices()
      await executeSpellCast(
        makeSpell({ status_effects: ['poisoned', 'paralyzed'] }),
        makeMetaCtx(),
        services,
      )

      const ctx = getRollDamageContext(services)
      expect(ctx.statusEffects).toEqual(['poisoned', 'paralyzed'])
    })

    it('omits statusEffects when spell has none', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell({ status_effects: [] }), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.statusEffects).toBeUndefined()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Attack-roll spells (no dc)                                      */
  /* ---------------------------------------------------------------- */

  describe('attack-roll spells', () => {
    function makeAttackSpell() {
      return makeSpell({
        dc: undefined,
        name: 'Fire Bolt',
        level: 0,
        damage: {
          damage_type: 'Fire',
          damage_at_character_level: { 1: '1d10' },
        },
      })
    }

    it('calls rollAttack for spells without a DC', async () => {
      const services = makeServices()
      await executeSpellCast(makeAttackSpell(), makeMetaCtx({ slotLevel: 0 }), services)

      expect(services.rollAttack).toHaveBeenCalled()
      expect(services.rollAttack.mock.calls[0][0]).toBe('Fire Bolt')
    })

    it('passes toHit bonus to rollAttack context', async () => {
      const services = makeServices()
      await executeSpellCast(makeAttackSpell(), makeMetaCtx({ slotLevel: 0 }), services)

      // toHit = Int bonus(5) + proficiency(4) = 9
      expect(services.rollAttack.mock.calls[0][1]).toBe(9)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Empowered Evocation                                             */
  /* ---------------------------------------------------------------- */

  describe('Empowered Evocation', () => {
    it('appends Int modifier to damage formula for evocation spells', async () => {
      const rider = await import('./postCastRiderService.js')
      vi.mocked(rider.getEmpoweredEvocationFeatures).mockReturnValue([{ type: 'empowered_evocation' }])
      vi.mocked(rider.getEmpoweredEvocationIntModifier).mockReturnValue(5)

      const services = makeServices()
      await executeSpellCast(makeSpell({ school: 'Evocation' }), makeMetaCtx(), services)

      expect(services.rollDamage.mock.calls[0][1]).toContain('+ 5')
    })

    it('does not apply Empowered Evocation to non-evocation spells', async () => {
      const rider = await import('./postCastRiderService.js')
      vi.mocked(rider.getEmpoweredEvocationFeatures).mockReturnValue([{ type: 'empowered_evocation' }])
      vi.mocked(rider.getEmpoweredEvocationIntModifier).mockReturnValue(5)

      const services = makeServices()
      await executeSpellCast(makeSpell({ school: 'Necromancy' }), makeMetaCtx(), services)

      expect(services.rollDamage.mock.calls[0][1]).not.toContain('+ 5')
    })

    it('does not apply when Int modifier is 0', async () => {
      const rider = await import('./postCastRiderService.js')
      vi.mocked(rider.getEmpoweredEvocationFeatures).mockReturnValue([{ type: 'empowered_evocation' }])
      vi.mocked(rider.getEmpoweredEvocationIntModifier).mockReturnValue(0)

      const services = makeServices()
      await executeSpellCast(makeSpell({ school: 'Evocation' }), makeMetaCtx(), services)

      // Formula should not contain "+ 0" since empEvocIntMod > 0 guard prevents it
      expect(services.rollDamage.mock.calls[0][1]).not.toContain('+ 0')
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Overchannel                                                     */
  /* ---------------------------------------------------------------- */

  describe('Overchannel', () => {
    function makeOverchannelPlayerStats() {
      return makePlayerStats({
        automation: { passives: [{ type: 'overchannel' }] },
      })
    }

    it('uses maximized roll when overchannel is enabled for valid slot level', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices({ playerStats: makeOverchannelPlayerStats() })
      await executeSpellCast(
        makeSpell(),
        makeMetaCtx({ slotLevel: 3, overchannel: true }),
        services,
      )

      expect(dice.rollExpressionMaximized).toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
    })

    it('uses normal roll when overchannel is not enabled', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices({ playerStats: makeOverchannelPlayerStats() })
      await executeSpellCast(makeSpell(), makeMetaCtx({ slotLevel: 3 }), services)

      expect(dice.rollExpression).toHaveBeenCalled()
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    })

    it('uses normal roll for slot level 6+ even with overchannel enabled', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices({ playerStats: makeOverchannelPlayerStats() })
      await executeSpellCast(
        makeSpell(),
        makeMetaCtx({ slotLevel: 6, overchannel: true }),
        services,
      )

      expect(dice.rollExpression).toHaveBeenCalled()
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    })

    it('uses normal roll for cantrips (level 0) even with overchannel enabled', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices({ playerStats: makeOverchannelPlayerStats() })
      await executeSpellCast(
        makeSpell({ level: 0, damage: undefined }),
        makeMetaCtx({ slotLevel: 0, overchannel: true }),
        services,
      )

      // rollExpressionMaximized is NOT called (overchannel blocked for level 0)
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
      // rollExpression IS called for the attack-roll path (no damage formula)
      expect(dice.rollExpression).toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Range checking                                                  */
  /* ---------------------------------------------------------------- */

  describe('range checking', () => {
    it('marks auto-miss when target exceeds spell range', async () => {
      const range = await import('../combat/rangeValidation.js')
      vi.mocked(range.computeEffectiveSpellRange).mockReturnValue(150)
      vi.mocked(range.getDistanceFeet).mockReturnValue(200)
      vi.mocked(range.computeRangeEffect).mockReturnValue({ mode: 'miss', reason: 'Out of range' })

      const services = makeServices({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 40, gridY: 0 },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.isAutoMiss).toBe(true)
      expect(ctx.rangeReason).toBe('Out of range')
    })

    it('allows roll when target is within range', async () => {
      const range = await import('../combat/rangeValidation.js')
      vi.mocked(range.computeEffectiveSpellRange).mockReturnValue(150)
      vi.mocked(range.getDistanceFeet).mockReturnValue(30)
      vi.mocked(range.computeRangeEffect).mockReturnValue({ mode: 'normal' })

      const services = makeServices({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 5, gridY: 0 },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.isAutoMiss).toBeUndefined()
      expect(ctx.rangeReason).toBeUndefined()
    })

    it('skips range check when positions are not provided', async () => {
      const range = await import('../combat/rangeValidation.js')
      const services = makeServices({ attackerPos: null, targetPos: null })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      expect(range.computeRangeEffect).not.toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Magical Ambush (heighten while invisible)                       */
  /* ---------------------------------------------------------------- */

  describe('Magical Ambush', () => {
    it('sets metamagicHeighten when caster is invisible and has the passive', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions') return ['Invisible']
        return undefined
      })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: [{ type: 'passive_rule', effect: 'magical_ambush' }] },
        }),
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.metamagicHeighten).toBe(true)
    })

    it('does not set metamagicHeighten without the passive feature', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions') return ['Invisible']
        return undefined
      })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: [] },
        }),
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.metamagicHeighten).toBe(false)
    })

    it('does not set metamagicHeighten when not invisible', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions') return ['Bleeding']
        return undefined
      })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: [{ type: 'passive_rule', effect: 'magical_ambush' }] },
        }),
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const ctx = getRollDamageContext(services)
      expect(ctx.metamagicHeighten).toBe(false)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Post-cast triggers (aggregated)                                 */
  /* ---------------------------------------------------------------- */

  describe('post-cast triggers', () => {
    it('invokes all post-cast trigger services', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)

      const rider = await import('./postCastRiderService.js')
      expect(rider.triggerPostCastRiderSaves).toHaveBeenCalled()
      expect(rider.triggerSpellThief).toHaveBeenCalled()
      expect(rider.triggerBewitchingMagic).toHaveBeenCalled()
      expect(rider.triggerSoulstitchSpells).toHaveBeenCalled()

      const heal = await import('./postCastHealService.js')
      expect(heal.triggerPostCastSelfHeals).toHaveBeenCalled()
      expect(heal.triggerPostCastAllyHeals).toHaveBeenCalled()

      const smite = await import('../features/smiteOfProtectionService.js')
      expect(smite.triggerSmiteOfProtection).toHaveBeenCalled()

      const inspiring = await import('../features/inspiringSmiteService.js')
      expect(inspiring.triggerInspiringSmite).toHaveBeenCalled()

      const primal = await import('../features/primalCompanionSpellShareService.js')
      expect(primal.triggerPrimalCompanionSpellShare).toHaveBeenCalled()

      const wild = await import('../features/wildMagicSurgeService.js')
      expect(wild.triggerWildMagicSurge).toHaveBeenCalled()
    })
  })
})
