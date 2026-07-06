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
  getEmpoweredEvocationFeatures: vi.fn(() => []),
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

function makeMagicMissile(slotLevel, _distribution) {
  const spell = makeSpell()
  delete spell.dc
  return { ...spell, level: slotLevel || 1, damage: { damage_type: 'Force', damage_at_slot_level: { 1: '1d4 + 1', 2: '2d4 + 2', 3: '3d4 + 3' } } }
}

describe('executeSpellCast - Magic Missile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runtimeState.getRuntimeValue).mockImplementation((_key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      if (key2 === 'activeBuffs') return []
      return undefined
    })
  })

  describe('early exit behavior', () => {
    it('returns without logging or applying damage for empty, null, or undefined distribution', async () => {
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
  })

  describe('missile count calculation', () => {
    it.each([
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 6],
      [5, 7],
    ])('fires %i missiles at slot level %i (3 + (level - 1))', async (slotLevel, expectedMissiles) => {
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const dist = { Goblin: expectedMissiles }
      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await executeSpellCast(
        makeMagicMissile(slotLevel, dist),
        { slotLevel, magicMissileDistribution: dist },
        services
      )

      // missile rolls + 1 summary roll
      expect(dice.rollExpression).toHaveBeenCalledTimes(expectedMissiles + 1)
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
    })
  })

  describe('shield buff interaction', () => {
    it('blocks damage when target has active shield buff but still rolls missiles', async () => {
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

      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
      expect(invisService.endInvisibilityOnHostileAction).toHaveBeenCalled()
      expect(dice.rollExpression).toHaveBeenCalledTimes(4)
    })

    it('applies damage when target has no shield buff', async () => {
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
    it('passes ignoreResistance flag based on player passives', async () => {
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
  })

  describe('log entries', () => {
    it('logs a spell entry with per-target details for single and multiple targets', async () => {
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

    it('logs per-target damage for multiple targets', async () => {
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

    it('does not log when all missile counts are zero', async () => {
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
  })

  describe('post-cast triggers', () => {
    it('calls post-cast rider saves, self-heals, and ally-heals after missile execution', async () => {
      const rider = await import('./postCastRiderService.js')
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

      expect(rider.triggerPostCastRiderSaves).toHaveBeenCalled()
      expect(heal.triggerPostCastSelfHeals).toHaveBeenCalled()
      expect(heal.triggerPostCastAllyHeals).toHaveBeenCalled()
    })
  })
})
