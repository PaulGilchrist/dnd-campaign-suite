import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../../dice/diceRoller.js', async () => {
  const actual = await vi.importActual('../../dice/diceRoller.js')
  return {
    ...actual,
    rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
    rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
  }
})

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
  getLog: vi.fn(),
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
  triggerPostCastRiderSaves: vi.fn(),
  triggerSpellThief: vi.fn(),
  triggerBewitchingMagic: vi.fn(),
  triggerSoulstitchSpells: vi.fn(),
  hasEmpoweredEvocation: vi.fn(() => false),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(),
  triggerPostCastAllyHeals: vi.fn(),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

import { executeSpellCast } from './spellCastService.js'

function makeSpell(overrides = {}) {
  return {
    name: 'Fireball', level: 3, school: 'Evocation',
    casting_time: '1 action', components: ['V', 'S'], range: '150 feet',
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
      spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5,
    },
    automation: { passives: [] },
    hitPoints: 100,
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
    attackerPos: null, targetPos: null,
    featEffects: {},
    campaignName: 'testCampaign',
    mapName: 'testMap',
    ...overrides,
  }
}

async function resetMocks() {
  const mock = (path, fnMap) => import(path).then(m => {
    for (const [key, value] of Object.entries(fnMap)) {
      m[key].mockImplementation(value)
    }
  })

  await mock('./postCastRiderService.js', {
    triggerPostCastRiderSaves: async () => null,
    triggerSpellThief: async () => null,
    triggerBewitchingMagic: async () => null,
    triggerSoulstitchSpells: async () => null,
    hasEmpoweredEvocation: () => false,
    getEmpoweredEvocationIntModifier: () => 0,
  })
  await mock('./postCastHealService.js', {
    triggerPostCastSelfHeals: async () => {},
    triggerPostCastAllyHeals: async () => {},
  })
  await mock('../features/smiteOfProtectionService.js', {
    triggerSmiteOfProtection: async () => {},
  })
  await mock('../features/inspiringSmiteService.js', {
    triggerInspiringSmite: async () => {},
  })
  await mock('../features/primalCompanionSpellShareService.js', {
    triggerPrimalCompanionSpellShare: async () => {},
  })
  await mock('../features/wildMagicSurgeService.js', {
    triggerWildMagicSurge: async () => {},
  })
  await mock('../features/silenceService.js', {
    getSilenceSource: () => null,
    isCreatureInSilenceZone: () => false,
  })
  await mock('../features/invisibilityService.js', {
    endInvisibilityOnHostileAction: () => {},
  })
  await mock('../features/friendsService.js', {
    endFriendsOnHostileAction: () => {},
  })
  await mock('../../combat/buffs/buffService.js', {
    isInnateSorceryActive: () => false,
    getActiveBuffs: () => [],
  })
  await mock('../../../hooks/runtime/useRuntimeState.js', {
    getRuntimeValue: (key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      return undefined
    },
    setRuntimeValue: () => {},
  })
}

describe('executeSpellCast', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMocks()
  })

  describe('early exits', () => {
    it('returns early when spellcasting is blocked by active buffs', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.getActiveBuffs).mockReturnValue([{ name: 'Blocking Buff', blocksSpellcasting: true }])

      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(services.rollAttack).not.toHaveBeenCalled()
      expect(services.rollDamage).not.toHaveBeenCalled()
    })

    it('returns early when Verbal component blocked by Silence', async () => {
      const silence = await import('../features/silenceService.js')
      vi.mocked(silence.getSilenceSource).mockReturnValue('SilenceCaster')
      vi.mocked(silence.isCreatureInSilenceZone).mockReturnValue(true)

      const services = makeServices()
      await executeSpellCast(makeSpell({ components: ['V'] }), makeMetaCtx(), services)
      expect(services.rollAttack).not.toHaveBeenCalled()
      expect(services.rollDamage).not.toHaveBeenCalled()
    })

    it('passes through when no Verbal component even with Silence active', async () => {
      const silence = await import('../features/silenceService.js')
      vi.mocked(silence.getSilenceSource).mockReturnValue('SilenceCaster')
      vi.mocked(silence.isCreatureInSilenceZone).mockReturnValue(true)

      const services = makeServices()
      await executeSpellCast(makeSpell({ components: ['S'] }), makeMetaCtx(), services)
      expect(services.rollDamage).toHaveBeenCalled()
    })
  })

  describe('hostile action triggers', () => {
    it('ends Friends early when casting non-Friends spells', async () => {
      const friends = await import('../features/friendsService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(friends.endFriendsOnHostileAction).toHaveBeenCalledWith('TestWizard', 'testCampaign')
    })

    it('does NOT end Friends when casting Friends spell', async () => {
      const friends = await import('../features/friendsService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell({ name: 'Friends' }), makeMetaCtx(), services)
      expect(friends.endFriendsOnHostileAction).not.toHaveBeenCalled()
    })

    it('ends Invisibility on hostile action', async () => {
      const invis = await import('../features/invisibilityService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(invis.endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'testCampaign')
    })

    it('sets lastActionSpellCast for action spells', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'lastActionSpellCast', 1, 'testCampaign')
    })
  })

  describe('formula resolution', () => {
    it('uses damage_at_slot_level when available', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx({ slotLevel: 3 }), services)
      expect(services.rollDamage).toHaveBeenCalled()
      expect(services.rollDamage.mock.calls[0][1]).toBe('8d6')
    })

    it('uses damage_at_character_level for cantrips', async () => {
      const services = makeServices()
      const spell = makeSpell({
        level: 0, damage: { damage_type: 'Fire', damage_at_character_level: { 1: '1d10' } },
      })
      delete spell.damage.damage_at_slot_level
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)
      expect(services.rollDamage).toHaveBeenCalled()
    })
  })

  describe('save DC', () => {
    it('calculates from spellCastingAbility', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell({ spellCastingAbility: 'Intelligence' }), makeMetaCtx(), services)
      const ctx = services.rollDamage.mock.calls[0][5]
      expect(ctx.saveDc).toBe(8 + 5 + 4)
    })

    it('falls back to playerStats.spellAbilities', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell({ spellCastingAbility: undefined }), makeMetaCtx(), services)
      const ctx = services.rollDamage.mock.calls[0][5]
      expect(ctx.saveDc).toBe(17)
    })

    it('adds Innate Sorcery bonus', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.isInnateSorceryActive).mockReturnValue(true)
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(services.rollDamage.mock.calls[0][5].saveDc).toBe(18)
    })
  })

  describe('spells with DC (saving throw)', () => {
    it('calls rollDamage with save context', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(services.rollDamage).toHaveBeenCalled()
      expect(services.rollDamage.mock.calls[0][5].saveType).toBe('dex')
      expect(services.rollDamage.mock.calls[0][5].dcSuccess).toBe('half')
    })

    it('includes status_effects in context', async () => {
      const services = makeServices()
      await executeSpellCast(makeSpell({ status_effects: ['poisoned'] }), makeMetaCtx(), services)
      expect(services.rollDamage.mock.calls[0][5].statusEffects).toEqual(['poisoned'])
    })
  })

  describe('spells without DC (attack roll)', () => {
    it('calls rollAttack for non-Magic Missile', async () => {
      const services = makeServices()
      const spell = makeSpell({ dc: undefined, name: 'Fire Bolt', level: 0 })
      spell.damage = { damage_type: 'Fire', damage_at_character_level: { 1: '1d10' } }
      delete spell.damage.damage_at_slot_level
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)
      expect(services.rollAttack).toHaveBeenCalled()
      expect(services.rollAttack.mock.calls[0][0]).toBe('Fire Bolt')
    })
  })

  describe('Empowered Evocation', () => {
    it('adds Int mod to formula for evocation damage spells', async () => {
      const rider = await import('./postCastRiderService.js')
      vi.mocked(rider.hasEmpoweredEvocation).mockReturnValue(true)
      vi.mocked(rider.getEmpoweredEvocationIntModifier).mockReturnValue(5)

      const services = makeServices()
      await executeSpellCast(makeSpell({ school: 'Evocation' }), makeMetaCtx(), services)
      expect(services.rollDamage.mock.calls[0][1]).toContain('+ 5')
    })

    it('does not apply to non-evocation spells', async () => {
      const rider = await import('./postCastRiderService.js')
      vi.mocked(rider.hasEmpoweredEvocation).mockReturnValue(true)
      vi.mocked(rider.getEmpoweredEvocationIntModifier).mockReturnValue(5)

      const services = makeServices()
      await executeSpellCast(makeSpell({ school: 'Necromancy' }), makeMetaCtx(), services)
      expect(services.rollDamage.mock.calls[0][1]).not.toContain('+ 5')
    })
  })

  describe('Overchannel', () => {
    it('calls rollExpressionMaximized when overchannel is enabled', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices()
      const stats = makePlayerStats({
        automation: { passives: [{ type: 'overchannel' }] },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx({ slotLevel: 3, overchannel: true }), { ...services, playerStats: stats })
      expect(dice.rollExpressionMaximized).toHaveBeenCalled()
    })

    it('calls normal rollExpression when overchannel is not enabled', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices()
      const stats = makePlayerStats({
        automation: { passives: [{ type: 'overchannel' }] },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx({ slotLevel: 3 }), { ...services, playerStats: stats })
      expect(dice.rollExpression).toHaveBeenCalled()
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    })

    it('calls normal rollExpression for level 6+ spells even with overchannel', async () => {
      const dice = await import('../../dice/diceRoller.js')
      const services = makeServices()
      const stats = makePlayerStats({
        automation: { passives: [{ type: 'overchannel' }] },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx({ slotLevel: 6, overchannel: true }), { ...services, playerStats: stats })
      expect(dice.rollExpression).toHaveBeenCalled()
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    })
  })

  describe('range checking', () => {
    it('marks auto-miss when target is out of range', async () => {
      const range = await import('../combat/rangeValidation.js')
      vi.mocked(range.computeEffectiveSpellRange).mockReturnValue(150)
      vi.mocked(range.getDistanceFeet).mockReturnValue(200)
      vi.mocked(range.computeRangeEffect).mockReturnValue({ mode: 'miss', reason: 'Out of range' })

      const services = makeServices({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 40, gridY: 0 },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(services.rollDamage.mock.calls[0][5].isAutoMiss).toBe(true)
      expect(services.rollDamage.mock.calls[0][5].rangeReason).toBe('Out of range')
    })
  })

  describe('Magical Ambush', () => {
    it('enables metamagicHeighten when Invisible', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
      vi.mocked(runtime.getRuntimeValue).mockImplementation((char, key) => {
        if (key === 'activeConditions') return ['Invisible']
        return undefined
      })
      const services = makeServices()
      const stats = makePlayerStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'magical_ambush' }] },
      })
      await executeSpellCast(makeSpell(), makeMetaCtx(), { ...services, playerStats: stats })
      expect(services.rollDamage.mock.calls[0][5].metamagicHeighten).toBe(true)
    })
  })

  describe('post-cast triggers', () => {
    it('calls rider saves', async () => {
      const rider = await import('./postCastRiderService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(rider.triggerPostCastRiderSaves).toHaveBeenCalled()
    })

    it('calls self-heals', async () => {
      const heal = await import('./postCastHealService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(heal.triggerPostCastSelfHeals).toHaveBeenCalled()
    })

    it('calls ally heals', async () => {
      const heal = await import('./postCastHealService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(heal.triggerPostCastAllyHeals).toHaveBeenCalled()
    })

    it('calls Smite of Protection', async () => {
      const mod = await import('../features/smiteOfProtectionService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(mod.triggerSmiteOfProtection).toHaveBeenCalled()
    })

    it('calls Inspiring Smite', async () => {
      const mod = await import('../features/inspiringSmiteService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(mod.triggerInspiringSmite).toHaveBeenCalled()
    })

    it('calls Primal Companion Spell Share', async () => {
      const mod = await import('../features/primalCompanionSpellShareService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(mod.triggerPrimalCompanionSpellShare).toHaveBeenCalled()
    })

    it('calls Wild Magic Surge', async () => {
      const mod = await import('../features/wildMagicSurgeService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(mod.triggerWildMagicSurge).toHaveBeenCalled()
    })

    it('calls Spell Thief', async () => {
      const rider = await import('./postCastRiderService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(rider.triggerSpellThief).toHaveBeenCalled()
    })

    it('calls Bewitching Magic', async () => {
      const rider = await import('./postCastRiderService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(rider.triggerBewitchingMagic).toHaveBeenCalled()
    })

    it('calls Soulstitch Spells', async () => {
      const rider = await import('./postCastRiderService.js')
      const services = makeServices()
      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(rider.triggerSoulstitchSpells).toHaveBeenCalled()
    })
  })
})
