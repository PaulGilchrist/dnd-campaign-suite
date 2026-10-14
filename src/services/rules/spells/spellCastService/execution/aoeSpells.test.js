import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from '../../spellCastService.js'
import * as applyHealing from '../../../combat/applyHealing.js'
import * as damageUtils from '../../../combat/damageUtils.js'
import * as runtime from '../../../../../hooks/runtime/useRuntimeState.js'

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_char, key) => {
    if (key === 'activeConditions' || key === 'targetEffects') return []
    if (key === 'hitPoints') return 100
    if (key === 'currentHitPoints') return 30
    return undefined
  }),
}))

vi.mock('../../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
  getLog: vi.fn(),
}))

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../../../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

vi.mock('../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
  triggerSilence: vi.fn(),
}))

vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

vi.mock('../../postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(async () => null),
  triggerSpellThief: vi.fn(async () => null),
  triggerBewitchingMagic: vi.fn(async () => null),
  triggerSoulstitchSpells: vi.fn(async () => null),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('../../postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => {}),
}))

vi.mock('../../../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../../../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../../../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))
vi.mock('../../../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => {}) }))
vi.mock('../../../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))
vi.mock('../../../features/fleshToStoneService.js', () => ({ triggerFleshToStone: vi.fn(async () => {}) }))
vi.mock('../../../features/holdMonsterService.js', () => ({ triggerHoldMonster: vi.fn(async () => {}) }))
vi.mock('../../../features/hypnoticPatternService.js', () => ({ triggerHypnoticPattern: vi.fn(async () => {}) }))
vi.mock('../../../features/massSuggestionService.js', () => ({ triggerMassSuggestion: vi.fn(async () => {}) }))
vi.mock('../../../features/suggestionService.js', () => ({ triggerSuggestion: vi.fn(async () => {}) }))
vi.mock('../../../features/ottoDanceService.js', () => ({ triggerOttoDance: vi.fn(async () => {}) }))
vi.mock('../../../features/resilientSphereService.js', () => ({ triggerResilientSphere: vi.fn(async () => {}) }))
vi.mock('../../../features/rayOfEnfeeblementService.js', () => ({ triggerRayOfEnfeeblement: vi.fn(async () => {}) }))
vi.mock('../../../features/compelledDuelService.js', () => ({ triggerCompelledDuel: vi.fn(async () => {}) }))
vi.mock('../../../features/globeOfInvulnerabilityService.js', () => ({ triggerGlobeOfInvulnerability: vi.fn(async () => {}) }))
vi.mock('../../../features/forcecageService.js', () => ({ triggerForcecage: vi.fn(async () => {}) }))
vi.mock('../../../features/blurService.js', () => ({ triggerBlur: vi.fn(async () => {}) }))
vi.mock('../../../features/expeditiousRetreatService.js', () => ({ triggerExpeditiousRetreat: vi.fn(async () => {}) }))
vi.mock('../../../features/crownOfMadnessService.js', () => ({ triggerCrownOfMadness: vi.fn(async () => {}) }))
vi.mock('../../../features/animalFriendshipService.js', () => ({ triggerAnimalFriendship: vi.fn(async () => {}) }))
vi.mock('../../../features/dominateBeastService.js', () => ({ triggerDominateBeast: vi.fn(async () => {}) }))
vi.mock('../../../features/dominateMonsterService.js', () => ({ triggerDominateMonster: vi.fn(async () => {}) }))
vi.mock('../../../features/dominatePersonService.js', () => ({ triggerDominatePerson: vi.fn(async () => {}) }))
vi.mock('../../../features/holyAuraService.js', () => ({ triggerHolyAura: vi.fn(async () => {}) }))
vi.mock('../../../features/powerWordStunService.js', () => ({ triggerPowerWordStun: vi.fn(async () => {}) }))
vi.mock('../../../features/seeInvisibilityService.js', () => ({ triggerSeeInvisibility: vi.fn(async () => {}) }))
vi.mock('../../../features/stinkingCloudService.js', () => ({ triggerStinkingCloud: vi.fn(async () => {}) }))
vi.mock('../../../features/sleetStormService.js', () => ({ triggerSleetStorm: vi.fn(async () => {}) }))
vi.mock('../../../features/faerieFireService.js', () => ({ triggerFaerieFire: vi.fn(async () => {}) }))
vi.mock('../../../features/viciousMockeryService.js', () => ({
  triggerViciousMockeryForGeneric: vi.fn(async () => {}),
}))
vi.mock('../../../features/imprisonmentService.js', () => ({ triggerImprisonment: vi.fn(async () => {}) }))
vi.mock('../../../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => {}) }))
vi.mock('../../../features/slowService.js', () => ({ triggerSlow: vi.fn(async () => {}) }))
vi.mock('../../../features/baneService.js', () => ({ triggerBaneSpell: vi.fn(async () => {}) }))
vi.mock('../../../features/blessService.js', () => ({ triggerBlessSpell: vi.fn(async () => {}) }))
vi.mock('../../../features/beaconOfHopeService.js', () => ({ triggerBeaconOfHope: vi.fn(async () => {}) }))
vi.mock('../../../features/massCureWoundsService.js', () => ({ triggerMassCureWounds: vi.fn(async () => {}) }))
vi.mock('../../../features/massHealingWordService.js', () => ({ triggerMassHealingWord: vi.fn(async () => {}) }))
vi.mock('../../../features/prayerOfHealingService.js', () => ({ triggerPrayerOfHealing: vi.fn(async () => {}) }))
vi.mock('../../../features/confusionService.js', () => ({ triggerConfusion: vi.fn(async () => {}) }))
vi.mock('../../../features/mazeService.js', () => ({ triggerMaze: vi.fn(async () => {}) }))
vi.mock('../../../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../../../features/heroismService.js', () => ({ handle: vi.fn(), applyHeroism: vi.fn(), isHeroismActive: vi.fn() }))

vi.mock('../../../../automation/handlers/spells/sanctuaryHandler.js', () => ({
  endSanctuary: vi.fn(async () => {}),
}))

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

/* ------------------------------------------------------------------ */
/*  Test-data factories                                                */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Suite — AoE modal routing & generic healing                       */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - AoE modal routing & generic healing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)
    vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue(null)
    vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      if (key === 'hitPoints') return 100
      if (key === 'currentHitPoints') return 30
      return undefined
    })
  })

  // ------------------------------------------------------------------
  // AoE spells — condition-only (no damage)
  // ------------------------------------------------------------------
  describe('AoE condition-only spells', () => {
    it('returns aoeCondition modal for condition-only AoE spells', async () => {
      const services = makeServices()
      const spell = makeSpell({
        name: 'Grease',
        dc: { dc_type: 'dex', dc_success: 'none' },
        area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
        automation: { effects: { fail: [{ condition: 'prone' }] } },
      })
      delete spell.damage

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup).toEqual({
        type: 'modal',
        modalName: 'aoeCondition',
        payload: expect.objectContaining({
          action: expect.objectContaining({ name: 'Grease' }),
          shape: 'sphere',
          conditionLabel: 'prone',
          includeCaster: true,
        }),
      })
    })
  })

  // ------------------------------------------------------------------
  // AoE spells — save/damage
  // ------------------------------------------------------------------
  describe('AoE save/damage spells', () => {
    it('returns saveAttackAoe modal for AoE spells with damage', async () => {
      const services = makeServices()
      const spell = makeSpell({
        name: 'Fireball',
        dc: { dc_type: 'dex', dc_success: 'half' },
        area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
      })

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup).toEqual({
        type: 'modal',
        modalName: 'saveAttackAoe',
        payload: expect.objectContaining({
          action: expect.objectContaining({ name: 'Fireball' }),
          shape: 'sphere',
          range: expect.any(Number),
          damage: '8d6',
          damageType: 'Fire',
          saveType: 'dex',
          saveDc: 17,
          dcSuccess: 'half',
        }),
      })
    })
  })

  // ------------------------------------------------------------------
  // Generic healing with max expression
  // ------------------------------------------------------------------
  describe('generic healing - max expression', () => {
    it('applies max healing when expression is "max"', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
        characters: [{ name: 'Target', type: 'player' }],
      })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: 'max' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })

    it('uses rollExpression for non-max healing expressions', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 15, oldHp: 30, newHp: 45 })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
        characters: [{ name: 'Target', type: 'player' }],
      })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })

    it('uses highest slot level when exact level not found', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 50, oldHp: 30, newHp: 80 })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
        characters: [{ name: 'Target', type: 'player' }],
      })

      const spell = makeSpell({
        name: 'Heal',
        level: 7,
        heal_at_slot_level: { 6: '70', 7: '80' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 8 }), services)

      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })

    it('does nothing when combat context is null', async () => {
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })

    it('does nothing when target is undefined', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })

      const services = makeServices({
        getTargetInfo: async () => undefined,
      })

      const spell = makeSpell({
        name: 'Cure Wounds',
        level: 1,
        heal_at_slot_level: { 1: '1d8 + MOD' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)

      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })
  })
})
