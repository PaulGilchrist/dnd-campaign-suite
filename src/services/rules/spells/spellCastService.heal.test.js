import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_key1, key2) => {
    if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 15, rolls: [6, 5, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
  getLog: vi.fn(),
}))

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
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

vi.mock('../features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

import { executeSpellCast } from './spellCastService.js'
import * as applyHealing from '../combat/applyHealing.js'
import * as damageUtils from '../combat/damageUtils.js'
import * as effectExpirations from '../effects/expirations.js'

function makeSpell(overrides = {}) {
  return {
    name: 'Heal',
    level: 6,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '60 feet',
    heal_at_slot_level: { 6: '70' },
    ...overrides,
  }
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Wisdom', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
    ...overrides,
  }
}

function makeMetaCtx(overrides = {}) {
  return { slotLevel: 6, ...overrides }
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
  const mock = async (path, fnMap) => {
    const m = await import(path)
    for (const [key, value] of Object.entries(fnMap)) {
      m[key].mockImplementation(value)
    }
  }

  await mock('../../../hooks/runtime/useRuntimeState.js', {
    getRuntimeValue: (key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      return undefined
    },
    setRuntimeValue: () => {},
  })
  await mock('./postCastRiderService.js', {
    triggerPostCastRiderSaves: async () => null,
    triggerSpellThief: async () => null,
    triggerBewitchingMagic: async () => null,
    triggerSoulstitchSpells: async () => null,
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
  await mock('../features/falseLifeService.js', {
    triggerFalseLife: async () => {},
  })
  await mock('../features/healingWordService.js', {
    triggerHealingWord: async () => {},
  })
  await mock('../../combat/buffs/buffService.js', {
    isInnateSorceryActive: () => false,
    getActiveBuffs: () => [],
  })
}

describe('executeSpellCast - heal spells', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMocks()
  })

  describe('triggerHeal (via executeSpellCast)', () => {
    it('heals target for 70 HP by default when combat data available', async () => {
      const logPoster = await import('../../shared/logPoster.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
      expect(logPoster.postLogEntry).toHaveBeenCalled()
    })

    it('removes Blinded, Deafened, Poisoned conditions from target', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')

      vi.mocked(runtime.getRuntimeValue).mockImplementation((char, key) => {
        if (key === 'activeConditions') return ['Blinded', 'Deafened', 'Prone']
        return undefined
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith(
        'Target', 'activeConditions', ['Prone'], 'testCampaign'
      )
    })

    it('does nothing when getCombatContext returns null', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })

    it('does nothing when getTargetInfo returns no target', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })

      const services = makeServices({
        getTargetInfo: async () => undefined,
      })

      await executeSpellCast(makeSpell(), makeMetaCtx(), services)
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })
  })

  describe('Regenerate spell', () => {
    it('applies initial healing from heal_at_slot_level', async () => {
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 15, oldHp: 50, newHp: 65 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Regenerate', level: 7,
        heal_at_slot_level: { 7: '4d8 + 15' },
        automation: { bodyPartRegrowMinutes: 2 },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 7 }), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })

    it('sets regenerateActive and regeneration runtime values', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 15, oldHp: 50, newHp: 65 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Regenerate', level: 7,
        heal_at_slot_level: { 7: '4d8 + 15' },
        automation: { bodyPartRegrowMinutes: 2 },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 7 }), services)
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', true, 'testCampaign')
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateSource', 'TestCaster', 'testCampaign')
    })

    it('adds expiration for regenerate buff', async () => {

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 15, oldHp: 50, newHp: 65 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Regenerate', level: 7,
        heal_at_slot_level: { 7: '4d8 + 15' },
        automation: { bodyPartRegrowMinutes: 2 },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 7 }), services)
      expect(effectExpirations.addExpiration).toHaveBeenCalled()
    })
  })

  describe('Power Word Heal spell', () => {
    it('heals target to max HP and removes conditions', async () => {
      const runtime = await import('../../../hooks/runtime/useRuntimeState.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })
      vi.mocked(runtime.getRuntimeValue).mockImplementation((char, key) => {
        if (key === 'activeConditions') return ['Charmed', 'Frightened', 'Prone']
        if (key === 'currentHitPoints') return 30
        return undefined
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Power Word Heal', level: 9,
      })
      delete spell.damage
      delete spell.heal_at_slot_level

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 9, multiTarget: 'Target2' }), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })
  })

  describe('generic heal_at_slot_level spells', () => {
    it('heals target with formula from heal_at_slot_level', async () => {
      const logPoster = await import('../../shared/logPoster.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 10, oldHp: 20, newHp: 30 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 20 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Cure Wounds', level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
      expect(logPoster.postLogEntry).toHaveBeenCalled()
    })

    it('substitutes MOD in healing formula', async () => {
      const dice = await import('../../dice/diceRoller.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 10, oldHp: 20, newHp: 30 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 20 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Cure Wounds', level: 1,
        components: ['V', 'S'],
        heal_at_slot_level: { 1: '1d8 + MOD' },
        spellCastingAbility: 'Wisdom',
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)
      expect(dice.rollExpression).toHaveBeenCalledWith('1d8 + 5')
    })

    it('uses highest available slot level when exact level not found', async () => {
      const dice = await import('../../dice/diceRoller.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 10, oldHp: 20, newHp: 30 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 20 }],
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Cure Wounds', level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD', 3: '3d8 + MOD' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 2 }), services)
      expect(dice.rollExpression).toHaveBeenCalledWith('2d8 + 5')
    })
  })
})
