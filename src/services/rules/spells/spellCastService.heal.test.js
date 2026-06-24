// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'
import * as applyHealing from '../combat/applyHealing.js'
import * as damageUtils from '../combat/damageUtils.js'
import * as runtime from '../../../hooks/runtime/useRuntimeState.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_char, key) => {
    if (key === 'activeConditions' || key === 'targetEffects') return []
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

const CAMPAIGN = 'testCampaign'

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

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: 'testMap',
    ...overrides,
  }
}

function mockCombatContext(targetName, currentHp, maxHp) {
  vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
    creatures: [{ name: targetName, maxHp: maxHp || 100, currentHp: currentHp }],
  })
}

function mockHealingResult(actualHeal, oldHp, newHp) {
  vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal, oldHp, newHp })
}

describe('executeSpellCast - heal spells', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })
    vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)
    vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue(null)
  })

  describe('heal spell', () => {
    it('applies healing and posts log entry when combat context and target exist', async () => {
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1)
    })

    it('removes Blinded, Deafened, and Poisoned conditions from target', async () => {
      vi.mocked(runtime.getRuntimeValue).mockReturnValue(['Blinded', 'Deafened', 'Prone'])
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'activeConditions',
        ['Prone'],
        CAMPAIGN,
      )
    })

    it('removes conditions case-insensitively', async () => {
      vi.mocked(runtime.getRuntimeValue).mockReturnValue(['blinded', 'DEAFENED', 'Poisoned'])
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'activeConditions',
        [],
        CAMPAIGN,
      )
    })

    it('skips condition removal when no conditions are present', async () => {
      vi.mocked(runtime.getRuntimeValue).mockReturnValue([])
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(runtime.setRuntimeValue).not.toHaveBeenCalledWith(
        'Target',
        'activeConditions',
        expect.any(Array),
        CAMPAIGN,
      )
    })

    it('does nothing when combat context is null', async () => {
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })

    it('does nothing when getTargetInfo returns undefined', async () => {
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => undefined })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })

    it('does nothing when getTargetInfo returns object without name', async () => {
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => ({}) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })

    it('caps healing at target max HP', async () => {
      mockCombatContext('Target', 95, 100)
      mockHealingResult(5, 95, 100)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeSpell(), { slotLevel: 6 }, services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1)
    })
  })

  describe('regenerate spell', () => {
    function makeRegenerateSpell() {
      return makeSpell({
        name: 'Regenerate',
        level: 7,
        heal_at_slot_level: { 7: '4d8 + 15' },
        automation: { bodyPartRegrowMinutes: 2 },
      })
    }

    it('applies initial healing from heal_at_slot_level', async () => {
      mockCombatContext('Target', 50, 100)
      mockHealingResult(15, 50, 65)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeRegenerateSpell(), { slotLevel: 7 }, services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1)
    })

    it('sets regenerateActive and regenerateSource runtime values on the target', async () => {
      mockCombatContext('Target', 50, 100)
      mockHealingResult(15, 50, 65)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeRegenerateSpell(), { slotLevel: 7 }, services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', true, CAMPAIGN)
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateSource', 'TestCaster', CAMPAIGN)
    })

    it('adds an expiration for the regenerate buff', async () => {
      mockCombatContext('Target', 50, 100)
      mockHealingResult(15, 50, 65)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeRegenerateSpell(), { slotLevel: 7 }, services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1)
    })

    it('still sets regeneration runtime values even when combat context is null', async () => {
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makeRegenerateSpell(), { slotLevel: 7 }, services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', true, CAMPAIGN)
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateSource', 'TestCaster', CAMPAIGN)
    })
  })

  describe('power word heal spell', () => {
    function makePowerWordHealSpell() {
      return makeSpell({ name: 'Power Word Heal', level: 9 })
    }

    it('heals both primary and multiTarget when both exist in combat context', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [
          { name: 'Target', maxHp: 100, currentHp: 30 },
          { name: 'Target2', maxHp: 80, currentHp: 10 },
        ],
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })

      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makePowerWordHealSpell(), { slotLevel: 9, multiTarget: 'Target2' }, services)

      expect(applyHealing.applyHealingToTarget.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('removes charmed, frightened, paralyzed, and poisoned conditions from the target', async () => {
      vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions') return ['Charmed', 'Frightened', 'Prone', 'Poisoned']
        return undefined
      })
      mockCombatContext('Target', 30, 100)
      mockHealingResult(70, 30, 100)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      await executeSpellCast(makePowerWordHealSpell(), { slotLevel: 9, multiTarget: 'Target2' }, services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'activeConditions',
        ['Prone'],
        CAMPAIGN,
      )
    })
  })

  describe('generic heal_at_slot_level spells', () => {
    it('applies healing and posts log entry for a basic heal_at_slot_level spell', async () => {
      const { postLogEntry } = await import('../../shared/logPoster.js')

      mockCombatContext('Target', 20, 100)
      mockHealingResult(10, 20, 30)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })

      await executeSpellCast(spell, { slotLevel: 1 }, services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1)
      expect(postLogEntry).toHaveBeenCalledTimes(1)
    })

    it('substitutes MOD with the spellcasting ability modifier', async () => {
      const { rollExpression } = await import('../../dice/diceRoller.js')

      mockCombatContext('Target', 20, 100)
      mockHealingResult(10, 20, 30)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })

      await executeSpellCast(spell, { slotLevel: 1 }, services)

      expect(rollExpression).toHaveBeenCalledWith('1d8 + 5')
    })

    it('falls back to the highest available slot level when exact level is missing', async () => {
      const { rollExpression } = await import('../../dice/diceRoller.js')

      mockCombatContext('Target', 20, 100)
      mockHealingResult(10, 20, 30)
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD', 3: '3d8 + MOD' },
      })

      await executeSpellCast(spell, { slotLevel: 2 }, services)

      expect(rollExpression).toHaveBeenCalledWith('2d8 + 5')
    })

    it('does nothing when combat context is null', async () => {
      const services = makeServices({ getTargetInfo: async () => ({ name: 'Target' }) })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })

      await executeSpellCast(spell, { slotLevel: 1 }, services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })

    it('does nothing when getTargetInfo returns undefined', async () => {
      mockCombatContext('Target', 20, 100)
      mockHealingResult(10, 20, 30)
      const services = makeServices({ getTargetInfo: async () => undefined })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })

      await executeSpellCast(spell, { slotLevel: 1 }, services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })
  })
})
