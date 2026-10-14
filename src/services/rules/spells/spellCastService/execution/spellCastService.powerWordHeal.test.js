import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Mocks — all dependencies of execution/index.js                     */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_, key) => {
    if (key === 'activeConditions' || key === 'targetEffects') return []
    if (key === 'hitPoints') return 100
    if (key === 'currentHitPoints') return 30
    return undefined
  }),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../../../rules/spells/postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(),
  triggerSpellThief: vi.fn(),
  triggerBewitchingMagic: vi.fn(),
  triggerSoulstitchSpells: vi.fn(),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('../../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(),
  triggerPostCastAllyHeals: vi.fn(),
}))

vi.mock('../../../../rules/features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
  triggerSilence: vi.fn(),
}))

vi.mock('../../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../../../../rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

vi.mock('../../../../rules/features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(),
}))

vi.mock('../../../../rules/features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(),
}))

vi.mock('../../../../rules/features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(),
}))

vi.mock('../../../../rules/features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(),
}))

vi.mock('../../../../rules/features/fearService.js', () => ({
  triggerFear: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/fleshToStoneService.js', () => ({
  triggerFleshToStone: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/hypnoticPatternService.js', () => ({
  triggerHypnoticPattern: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/massSuggestionService.js', () => ({
  triggerMassSuggestion: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/suggestionService.js', () => ({
  triggerSuggestion: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/ottoDanceService.js', () => ({
  triggerOttoDance: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/resilientSphereService.js', () => ({
  triggerResilientSphere: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/rayOfEnfeeblementService.js', () => ({
  triggerRayOfEnfeeblement: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/globeOfInvulnerabilityService.js', () => ({
  triggerGlobeOfInvulnerability: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/forcecageService.js', () => ({
  triggerForcecage: vi.fn(async () => {}),
}))

vi.mock('../../../../automation/handlers/spells/forcecageHandler.js', () => ({
  isForcecageBlocked: vi.fn(() => false),
}))

vi.mock('../../../../rules/features/heroismService.js', () => ({
  handle: vi.fn(),
  applyHeroism: vi.fn(),
  isHeroismActive: vi.fn(),
}))

vi.mock('../../../../rules/features/holyAuraService.js', () => ({
  triggerHolyAura: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/powerWordStunService.js', () => ({
  triggerPowerWordStun: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/seeInvisibilityService.js', () => ({
  triggerSeeInvisibility: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/sleepService.js', () => ({
  triggerSleep: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/stinkingCloudService.js', () => ({
  triggerStinkingCloud: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/tashasHideousLaughterService.js', () => ({
  triggerTashasHideousLaughter: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/removeCurseService.js', () => ({
  triggerRemoveCurse: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/slowService.js', () => ({
  triggerSlow: vi.fn(async () => {}),
}))

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../../../../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

vi.mock('../../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

vi.mock('../../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

import { executeSpellCast } from './index.js'
import * as runtimeState from '../../../../../hooks/runtime/useRuntimeState.js'
import * as applyHealing from '../../../../rules/combat/applyHealing.js'
import * as damageUtils from '../../../../rules/combat/damageUtils.js'

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

function mockGetRuntimeValue(fn) {
  vi.mocked(runtimeState.getRuntimeValue).mockImplementation(fn)
}

async function resetMockImplementations() {
  const m = async (path, fnMap) => {
    const mod = await import(path)
    for (const [key, value] of Object.entries(fnMap)) {
      mod[key].mockImplementation(value)
    }
  }

  await m('../../../../../hooks/runtime/useRuntimeState.js', {
    getRuntimeValue: (_, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    },
    setRuntimeValue: () => {},
  })
  await m('../../../../rules/spells/postCastRiderService.js', {
    triggerPostCastRiderSaves: async () => null,
    triggerSpellThief: async () => null,
    triggerBewitchingMagic: async () => null,
    triggerSoulstitchSpells: async () => null,
    getEmpoweredEvocationFeatures: () => [],
    getEmpoweredEvocationIntModifier: () => 0,
  })
  await m('../../../../rules/spells/postCastHealService.js', {
    triggerPostCastSelfHeals: async () => {},
    triggerPostCastAllyHeals: async () => {},
  })
  await m('../../../../rules/features/smiteOfProtectionService.js', {
    triggerSmiteOfProtection: async () => {},
  })
  await m('../../../../rules/features/inspiringSmiteService.js', {
    triggerInspiringSmite: async () => {},
  })
  await m('../../../../rules/features/primalCompanionSpellShareService.js', {
    triggerPrimalCompanionSpellShare: async () => {},
  })
  await m('../../../../rules/features/wildMagicSurgeService.js', {
    triggerWildMagicSurge: async () => {},
  })
  await m('../../../../rules/features/fearService.js', {
    triggerFear: async () => {},
  })
  await m('../../../../rules/features/falseLifeService.js', {
    triggerFalseLife: async () => {},
  })
  await m('../../../../rules/features/healingWordService.js', {
    triggerHealingWord: async () => {},
  })
  await m('../../../../rules/features/fleshToStoneService.js', {
    triggerFleshToStone: async () => {},
  })
  await m('../../../../rules/features/holdMonsterService.js', {
    triggerHoldMonster: async () => {},
  })
  await m('../../../../rules/features/hypnoticPatternService.js', {
    triggerHypnoticPattern: async () => {},
  })
  await m('../../../../rules/features/massSuggestionService.js', {
    triggerMassSuggestion: async () => {},
  })
  await m('../../../../rules/features/suggestionService.js', {
    triggerSuggestion: async () => {},
  })
  await m('../../../../rules/features/ottoDanceService.js', {
    triggerOttoDance: async () => {},
  })
  await m('../../../../rules/features/resilientSphereService.js', {
    triggerResilientSphere: async () => {},
  })
  await m('../../../../rules/features/foresightService.js', {
    triggerForesight: async () => {},
  })
  await m('../../../../rules/features/rayOfEnfeeblementService.js', {
    triggerRayOfEnfeeblement: async () => {},
  })
  await m('../../../../rules/features/globeOfInvulnerabilityService.js', {
    triggerGlobeOfInvulnerability: async () => {},
  })
  await m('../../../../rules/features/forcecageService.js', {
    triggerForcecage: async () => {},
  })
  await m('../../../../automation/handlers/spells/forcecageHandler.js', {
    isForcecageBlocked: () => false,
  })
  await m('../../../../rules/features/heroismService.js', {
    handle: async () => {},
    applyHeroism: async () => {},
  })
  await m('../../../../rules/features/holyAuraService.js', {
    triggerHolyAura: async () => {},
  })
  await m('../../../../rules/features/powerWordStunService.js', {
    triggerPowerWordStun: async () => {},
  })
  await m('../../../../rules/features/seeInvisibilityService.js', {
    triggerSeeInvisibility: async () => {},
  })
  await m('../../../../rules/features/sleepService.js', {
    triggerSleep: async () => {},
  })
  await m('../../../../rules/features/stinkingCloudService.js', {
    triggerStinkingCloud: async () => {},
  })
  await m('../../../../rules/features/tashasHideousLaughterService.js', {
    triggerTashasHideousLaughter: async () => {},
  })
  await m('../../../../rules/features/removeCurseService.js', {
    triggerRemoveCurse: async () => {},
  })
  await m('../../../../rules/features/slowService.js', {
    triggerSlow: async () => {},
  })
  await m('../../../../rules/features/silenceService.js', {
    getSilenceSource: () => null,
    isCreatureInSilenceZone: () => false,
  })
  await m('../../../../rules/features/invisibilityService.js', {
    endInvisibilityOnHostileAction: () => {},
  })
  await m('../../../../rules/features/friendsService.js', {
    endFriendsOnHostileAction: () => {},
  })
  await m('../../../../combat/buffs/buffService.js', {
    isInnateSorceryActive: () => false,
    getActiveBuffs: () => [],
  })
}

describe('executeSpellCast - Power Word Heal edge cases', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMockImplementations()
    mockGetRuntimeValue((_, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      if (key === 'hitPoints') return 100
      if (key === 'currentHitPoints') return 30
      return undefined
    })
  })

  describe('applyPowerWordHealToTarget', () => {
    it('removes specified conditions and logs removal', async () => {
      mockGetRuntimeValue((char, key) => {
        if (key === 'activeConditions') return ['Charmed', 'Frightened', 'Paralyzed', 'Poisoned', 'Stunned', 'Prone']
        if (key === 'currentHitPoints') return 50
        return undefined
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 50, oldHp: 50, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Power Word Heal' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 9, multiTarget: 'Target' }), services)

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Target', 'activeConditions', ['Prone'], 'testCampaign'
      )
    })

    it('sets powerWordHealStandPermission when target is Prone', async () => {
      mockGetRuntimeValue((char, key) => {
        if (key === 'activeConditions') return ['Prone']
        if (key === 'currentHitPoints') return 50
        return undefined
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 50, oldHp: 50, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Power Word Heal' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 9, multiTarget: 'Target' }), services)

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Target', 'powerWordHealStandPermission', true, 'testCampaign'
      )
    })

    it('does not set powerWordHealStandPermission when already set', async () => {
      mockGetRuntimeValue((char, key) => {
        if (key === 'activeConditions') return ['Prone']
        if (key === 'powerWordHealStandPermission') return true
        if (key === 'currentHitPoints') return 50
        return undefined
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 50, oldHp: 50, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Power Word Heal' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 9, multiTarget: 'Target' }), services)

      const permCalls = vi.mocked(runtimeState.setRuntimeValue).mock.calls.filter(
        c => c[1] === 'powerWordHealStandPermission'
      )
      expect(permCalls.length).toBe(0)
    })

    it('does nothing when combat context is null', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Power Word Heal' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 9, multiTarget: 'Target' }), services)
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
    })
  })
})
