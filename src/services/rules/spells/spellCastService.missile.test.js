// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_key1, key2) => {
    if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [4], modifier: 1 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 5, rolls: [4], modifier: 1, maximized: false })),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
  getLog: vi.fn(),
}))

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
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
  triggerPostCastRiderSaves: vi.fn(async () => {}),
  triggerSpellThief: vi.fn(async () => {}),
  triggerBewitchingMagic: vi.fn(async () => {}),
  triggerSoulstitchSpells: vi.fn(async () => {}),
  hasEmpoweredEvocation: vi.fn(() => false),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => {}),
}))

vi.mock('../features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(async () => {}),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(async () => {}),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(async () => {}),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(async () => {}),
}))

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, damageReduced: false })),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}))

vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

vi.mock('../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

import { executeSpellCast } from './spellCastService.js'
import * as applyDamage from '../../../services/rules/combat/applyDamage.js'
import * as combatData from '../../../services/encounters/combatData.js'
import * as dice from '../../dice/diceRoller.js'
import * as logService from '../../../services/ui/logService.js'
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js'
import * as invisService from '../features/invisibilityService.js'

function makeSpell(overrides = {}) {
  return {
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '120 feet',
    damage: {
      damage_type: 'Force',
      damage_at_slot_level: { 1: '1d4 + 1', 2: '2d4 + 2', 3: '3d4 + 3' },
    },
    ...overrides,
  }
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
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
    campaignName: 'testCampaign',
    mapName: 'testMap',
    ...overrides,
  }
}

/**
 * Returns a fresh magic missile spell without a `dc` property,
 * ensuring the magic missile code path is taken instead of the
 * generic spell-save-DC path.
 */
function makeMagicMissile(_slotLevel, _distribution) {
  const spell = makeSpell()
  delete spell.dc
  return { ...spell, level: 1, damage: { damage_type: 'Force', damage_at_slot_level: { 1: '1d4 + 1', 2: '2d4 + 2', 3: '3d4 + 3' } } }
}

describe('executeSpellCast - Magic Missile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: activeConditions/targetEffects return [] (null-safety),
    // activeBuffs returns [] (no shields by default).
    vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      if (key2 === 'activeBuffs') return []
      return undefined
    })
  })

  describe('early exit behavior', () => {
    it('returns without logging when distribution is an empty object', async () => {
      vi.mocked(combatData.getCombatSummary).mockReturnValue({ creatures: [] })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, {}),
        { slotLevel: 1, magicMissileDistribution: {} },
        services
      )

      expect(logService.addEntry).not.toHaveBeenCalled()
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
    })

    it('returns without logging when distribution is null', async () => {
      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, null),
        { slotLevel: 1, magicMissileDistribution: null },
        services
      )

      expect(logService.addEntry).not.toHaveBeenCalled()
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
    })

    it('returns without logging when distribution is undefined', async () => {
      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, undefined),
        { slotLevel: 1 },
        services
      )

      expect(logService.addEntry).not.toHaveBeenCalled()
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
    })
  })

  describe('missile count calculation', () => {
    it('fires 3 missiles at slot level 1 (base count)', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      // 3 missile rolls + 1 summary roll = 4 total calls
      expect(dice.rollExpression).toHaveBeenCalledTimes(4)
      expect(dice.rollExpression).toHaveBeenCalledWith('1d4 + 1')
    })

    it('fires 4 missiles at slot level 2 (3 + (2 - 1))', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(2, { Goblin: 4 }),
        { slotLevel: 2, magicMissileDistribution: { Goblin: 4 } },
        services
      )

      // 4 missile rolls + 1 summary roll = 5 total calls
      expect(dice.rollExpression).toHaveBeenCalledTimes(5)
    })

    it('fires 5 missiles at slot level 3 (3 + (3 - 1))', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 30, currentHp: 30 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(3, { Goblin: 5 }),
        { slotLevel: 3, magicMissileDistribution: { Goblin: 5 } },
        services
      )

      // 5 missile rolls + 1 summary roll = 6 total calls
      expect(dice.rollExpression).toHaveBeenCalledTimes(6)
    })
  })

  describe('damage application', () => {
    it('applies damage to a single target from distribution', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1)
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'Goblin',
        15,
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
    })

    it('applies damage to multiple targets from distribution', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Goblin', maxHp: 15, currentHp: 15 },
          { name: 'Orc', maxHp: 30, currentHp: 30 },
        ],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(2, { Goblin: 2, Orc: 2 }),
        { slotLevel: 2, magicMissileDistribution: { Goblin: 2, Orc: 2 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(2)
      expect(applyDamage.applyDamageToTarget).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        'Goblin',
        10,
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
      expect(applyDamage.applyDamageToTarget).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        'Orc',
        10,
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
    })

    it('skips targets with zero missile count', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Goblin', maxHp: 15, currentHp: 15 },
          { name: 'Orc', maxHp: 30, currentHp: 30 },
        ],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 0, Orc: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 0, Orc: 3 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1)
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'Orc',
        15,
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
    })

    it('uses Force damage type by default', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      const spell = makeSpell({ damage: { damage_type: 'Force', damage_at_slot_level: { 1: '1d4 + 1' } } })
      delete spell.dc

      await executeSpellCast(
        spell,
        { slotLevel: 1, magicMissileDistribution: { Goblin: 1 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.objectContaining({ creatures: expect.any(Array) }),
        'Goblin',
        expect.any(Number),
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
    })
  })

  describe('shield buff interaction', () => {
    it('blocks damage when target has active shield buff', async () => {
      vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions' || key === 'targetEffects') return []
        if (key === 'activeBuffs') return [{ effect: 'shield' }]
        return undefined
      })
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      // Shield blocks damage application entirely
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
      // Invisibility still ends because the spell cast itself triggers it
      expect(invisService.endInvisibilityOnHostileAction).toHaveBeenCalled()
    })

    it('does not block damage when target has no shield buff', async () => {
      vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions' || key === 'targetEffects') return []
        if (key === 'activeBuffs') return [{ effect: 'other' }]
        return undefined
      })
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1)
    })
  })

  describe('ignore_resistance passive', () => {
    it('passes ignoreResistance=true when player has auto_effect ignore_resistance passive', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'auto_effect', effect: 'ignore_resistance' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'Goblin',
        15,
        ['Force'],
        'testCampaign',
        undefined,
        true,
        'TestWizard'
      )
    })

    it('passes ignoreResistance=false when player lacks ignore_resistance passive', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'auto_effect', effect: 'other_effect' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'Goblin',
        15,
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
    })
  })

  describe('log entries', () => {
    it('logs a spell entry with per-target details', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(logService.addEntry).toHaveBeenCalledWith(
        'testCampaign',
        expect.objectContaining({
          type: 'spell',
          characterName: 'TestWizard',
          spellName: 'Magic Missile',
          missileCount: 3,
          missileDamage: '1d4 + 1',
          damageType: 'Force',
          targets: expect.arrayContaining([
            expect.objectContaining({ name: 'Goblin', missiles: 3, rawDamage: 15 }),
          ]),
          totalRawDamage: 15,
        })
      )
    })

    it('logs per-target damage and shield immunity for each target', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Goblin', maxHp: 15, currentHp: 15 },
          { name: 'Orc', maxHp: 30, currentHp: 30 },
        ],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(2, { Goblin: 2, Orc: 2 }),
        { slotLevel: 2, magicMissileDistribution: { Goblin: 2, Orc: 2 } },
        services
      )

      expect(logService.addEntry).toHaveBeenCalledWith(
        'testCampaign',
        expect.objectContaining({
          type: 'spell',
          missileCount: 4,
          totalRawDamage: 20,
          targets: expect.arrayContaining([
            expect.objectContaining({ name: 'Goblin', missiles: 2, rawDamage: 10 }),
            expect.objectContaining({ name: 'Orc', missiles: 2, rawDamage: 10 }),
          ]),
        })
      )
    })

    it('does not log when no missiles were fired (all zero counts)', async () => {
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 0 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 0 } },
        services
      )

      expect(logService.addEntry).not.toHaveBeenCalled()
    })
  })

  describe('invisibility end trigger', () => {
    it('ends invisibility when damage is successfully applied', async () => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(invisService.endInvisibilityOnHostileAction).toHaveBeenCalledWith(
        'TestWizard',
        'testCampaign'
      )
    })

    it('still fires correct missile count when shield blocks damage', async () => {
      vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions' || key === 'targetEffects') return []
        if (key === 'activeBuffs') return [{ effect: 'shield' }]
        return undefined
      })
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      // Shield blocks damage but missiles still roll (they just don't apply damage)
      expect(dice.rollExpression).toHaveBeenCalledTimes(4)
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
    })
  })

  describe('post-cast triggers', () => {
    it('calls post-cast rider saves after missile execution', async () => {
      const rider = await import('./postCastRiderService.js')
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(rider.triggerPostCastRiderSaves).toHaveBeenCalled()
    })

    it('calls post-cast self-heals after missile execution', async () => {
      const heal = await import('./postCastHealService.js')
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(heal.triggerPostCastSelfHeals).toHaveBeenCalled()
    })

    it('calls post-cast ally-heals after missile execution', async () => {
      const heal = await import('./postCastHealService.js')
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      expect(heal.triggerPostCastAllyHeals).toHaveBeenCalled()
    })
  })

  describe('null damage roll handling', () => {
    it('skips a missile when rollExpression returns null', async () => {
      vi.mocked(dice.rollExpression)
        .mockReturnValueOnce({ total: 5, rolls: [4], modifier: 1 })
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({ total: 5, rolls: [4], modifier: 1 })
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 10, damageReduced: false })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(1, { Goblin: 3 }),
        { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } },
        services
      )

      // Only 2 missiles succeed (the null one is skipped), so total damage = 10
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(),
        'Goblin',
        10,
        ['Force'],
        'testCampaign',
        undefined,
        false,
        'TestWizard'
      )
    })
  })
})
