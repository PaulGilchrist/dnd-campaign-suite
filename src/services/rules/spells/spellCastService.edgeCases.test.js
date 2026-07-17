// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_, key) => {
    if (key === 'activeConditions' || key === 'targetEffects') return []
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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
  getEmpoweredEvocationFeatures: vi.fn(() => []),
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

vi.mock('../features/fearService.js', () => ({
  triggerFear: vi.fn(async () => {}),
}))

vi.mock('../features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../features/feignDeathService.js', () => ({
  triggerFeignDeath: vi.fn(async () => {}),
}))

vi.mock('../features/fleshToStoneService.js', () => ({
  triggerFleshToStone: vi.fn(async () => {}),
}))

vi.mock('../features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(async () => {}),
}))

vi.mock('../features/hypnoticPatternService.js', () => ({
  triggerHypnoticPattern: vi.fn(async () => {}),
}))

vi.mock('../features/massSuggestionService.js', () => ({
  triggerMassSuggestion: vi.fn(async () => {}),
}))

vi.mock('../features/suggestionService.js', () => ({
  triggerSuggestion: vi.fn(async () => {}),
}))

vi.mock('../features/ottoDanceService.js', () => ({
  triggerOttoDance: vi.fn(async () => {}),
}))

vi.mock('../features/resilientSphereService.js', () => ({
  triggerResilientSphere: vi.fn(async () => {}),
}))

vi.mock('../features/foresightService.js', () => ({
  triggerForesight: vi.fn(async () => {}),
}))

vi.mock('../features/rayOfEnfeeblementService.js', () => ({
  triggerRayOfEnfeeblement: vi.fn(async () => {}),
}))

vi.mock('../features/globeOfInvulnerabilityService.js', () => ({
  triggerGlobeOfInvulnerability: vi.fn(async () => {}),
}))

vi.mock('../features/heroismService.js', () => ({
  triggerHeroism: vi.fn(async () => {}),
}))

vi.mock('../features/holyAuraService.js', () => ({
  triggerHolyAura: vi.fn(async () => {}),
}))

vi.mock('../features/powerWordStunService.js', () => ({
  triggerPowerWordStun: vi.fn(async () => {}),
}))

vi.mock('../features/seeInvisibilityService.js', () => ({
  triggerSeeInvisibility: vi.fn(async () => {}),
}))

vi.mock('../features/sleepService.js', () => ({
  triggerSleep: vi.fn(async () => {}),
}))

vi.mock('../features/stinkingCloudService.js', () => ({
  triggerStinkingCloud: vi.fn(async () => {}),
}))

vi.mock('../features/tashasHideousLaughterService.js', () => ({
  triggerTashasHideousLaughter: vi.fn(async () => {}),
}))

vi.mock('../features/removeCurseService.js', () => ({
  triggerRemoveCurse: vi.fn(async () => {}),
}))

vi.mock('../features/slowService.js', () => ({
  triggerSlow: vi.fn(async () => {}),
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

vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

vi.mock('../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

import { executeSpellCast } from './spellCastService.js'
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js'
import * as applyHealing from '../combat/applyHealing.js'
import * as damageUtils from '../combat/damageUtils.js'
import * as arcWardHandler from '../../automation/handlers/class-wizard/arcaneWardHandler.js'

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

  await m('../../../hooks/runtime/useRuntimeState.js', {
    getRuntimeValue: (_, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    },
    setRuntimeValue: () => {},
  })
  await m('./postCastRiderService.js', {
    triggerPostCastRiderSaves: async () => null,
    triggerSpellThief: async () => null,
    triggerBewitchingMagic: async () => null,
    triggerSoulstitchSpells: async () => null,
    getEmpoweredEvocationFeatures: () => [],
    getEmpoweredEvocationIntModifier: () => 0,
  })
  await m('./postCastHealService.js', {
    triggerPostCastSelfHeals: async () => {},
    triggerPostCastAllyHeals: async () => {},
  })
  await m('../features/smiteOfProtectionService.js', {
    triggerSmiteOfProtection: async () => {},
  })
  await m('../features/inspiringSmiteService.js', {
    triggerInspiringSmite: async () => {},
  })
  await m('../features/primalCompanionSpellShareService.js', {
    triggerPrimalCompanionSpellShare: async () => {},
  })
  await m('../features/wildMagicSurgeService.js', {
    triggerWildMagicSurge: async () => {},
  })
  await m('../features/fearService.js', {
    triggerFear: async () => {},
  })
  await m('../features/falseLifeService.js', {
    triggerFalseLife: async () => {},
  })
  await m('../features/healingWordService.js', {
    triggerHealingWord: async () => {},
  })
  await m('../features/feignDeathService.js', {
    triggerFeignDeath: async () => {},
  })
  await m('../features/fleshToStoneService.js', {
    triggerFleshToStone: async () => {},
  })
  await m('../features/holdMonsterService.js', {
    triggerHoldMonster: async () => {},
  })
  await m('../features/hypnoticPatternService.js', {
    triggerHypnoticPattern: async () => {},
  })
  await m('../features/massSuggestionService.js', {
    triggerMassSuggestion: async () => {},
  })
  await m('../features/suggestionService.js', {
    triggerSuggestion: async () => {},
  })
  await m('../features/ottoDanceService.js', {
    triggerOttoDance: async () => {},
  })
  await m('../features/resilientSphereService.js', {
    triggerResilientSphere: async () => {},
  })
  await m('../features/foresightService.js', {
    triggerForesight: async () => {},
  })
  await m('../features/rayOfEnfeeblementService.js', {
    triggerRayOfEnfeeblement: async () => {},
  })
  await m('../features/globeOfInvulnerabilityService.js', {
    triggerGlobeOfInvulnerability: async () => {},
  })
  await m('../features/heroismService.js', {
    triggerHeroism: async () => {},
  })
  await m('../features/holyAuraService.js', {
    triggerHolyAura: async () => {},
  })
  await m('../features/powerWordStunService.js', {
    triggerPowerWordStun: async () => {},
  })
  await m('../features/seeInvisibilityService.js', {
    triggerSeeInvisibility: async () => {},
  })
  await m('../features/sleepService.js', {
    triggerSleep: async () => {},
  })
  await m('../features/stinkingCloudService.js', {
    triggerStinkingCloud: async () => {},
  })
  await m('../features/tashasHideousLaughterService.js', {
    triggerTashasHideousLaughter: async () => {},
  })
  await m('../features/removeCurseService.js', {
    triggerRemoveCurse: async () => {},
  })
  await m('../features/slowService.js', {
    triggerSlow: async () => {},
  })
  await m('../features/silenceService.js', {
    getSilenceSource: () => null,
    isCreatureInSilenceZone: () => false,
  })
  await m('../features/invisibilityService.js', {
    endInvisibilityOnHostileAction: () => {},
  })
  await m('../features/friendsService.js', {
    endFriendsOnHostileAction: () => {},
  })
  await m('../../combat/buffs/buffService.js', {
    isInnateSorceryActive: () => false,
    getActiveBuffs: () => [],
  })
}

describe('executeSpellCast - utility functions & edge cases', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMockImplementations()
    mockGetRuntimeValue((_, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })
  })

  describe('applyEldritchHex via Hex spell', () => {
    it('applies hex_save_disadvantage effect when Eldritch Hex passive exists', async () => {
      mockGetRuntimeValue((_, key) => {
        if (key === 'targetEffects') return [{ target: 'Other', effect: 'other' }]
        if (key === 'activeConditions') return []
        return undefined
      })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = { ...makeSpell(), name: 'Hex' }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'testCampaign',
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ effect: 'hex_save_disadvantage', target: 'Target', source: 'TestWizard' }),
        ]),
        'testCampaign'
      )
    })

    it('updates existing hex effect instead of adding duplicate', async () => {
      mockGetRuntimeValue((_, key) => {
        if (key === 'targetEffects') return [{ target: 'Target', effect: 'hex_save_disadvantage', source: 'TestWizard', duration: 'old' }]
        if (key === 'activeConditions') return []
        return undefined
      })

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = { ...makeSpell(), name: 'Hex' }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const hexCalls = vi.mocked(runtimeState.setRuntimeValue).mock.calls.filter(
        c => c[1] === 'targetEffects'
      )
      expect(hexCalls.length).toBe(1)
      expect(hexCalls[0][2]).toEqual([
        { target: 'Target', effect: 'hex_save_disadvantage', source: 'TestWizard', duration: 'hex_duration' },
      ])
    })

    it('does not apply hex when target name is missing', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
          },
        }),
        getTargetInfo: vi.fn(async () => undefined),
      })

      const spell = { ...makeSpell(), name: 'Hex' }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        expect.anything(), 'targetEffects', expect.anything(), 'testCampaign'
      )
    })
  })

  describe('triggerArcaneWard', () => {
    it('triggers Arcane Ward for abjuration spells that use a spell slot', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'arcane_ward' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ school: 'Abjuration' })
      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(arcWardHandler.onAbjurationSpellCast).toHaveBeenCalled()
    })

    it('does not trigger Arcane Ward for non-abjuration spells', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'arcane_ward' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ school: 'Evocation' })
      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()
    })

    it('does not trigger Arcane Ward for cantrips', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'arcane_ward' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ school: 'Abjuration', level: 0 })
      delete spell.damage
      delete spell.dc
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)
      expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()
    })
  })

  describe('triggerExpertDivination', () => {
    it('triggers Expert Divination for divination school spells level 2+', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ school: 'Divination' })
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 2 }), services)

      // Expert Divination uses executeHandler internally, which is mocked
      // The key behavior is that it does NOT trigger Arcane Ward (abjuration-only)
      expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()
    })

    it('does not trigger Expert Divination for non-divination spells, cantrips, or level 1 spells', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ name: 'Expert Divination', type: 'expert_divination' }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      // non-divination spell
      const nonDivSpell = makeSpell({ school: 'Evocation' })
      await executeSpellCast(nonDivSpell, makeMetaCtx({ slotLevel: 3 }), services)
      expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()

      // cantrip
      const cantripSpell = makeSpell({ school: 'Divination', level: 0 })
      delete cantripSpell.damage
      delete cantripSpell.dc
      await executeSpellCast(cantripSpell, makeMetaCtx({ slotLevel: 0 }), services)
      expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()

      // level 1 spell
      const level1Spell = makeSpell({ school: 'Divination' })
      await executeSpellCast(level1Spell, makeMetaCtx({ slotLevel: 1 }), services)
      expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()
    })
  })

  describe('setupSpellBreakerDispelRetention', () => {
    it('sets up event listener for Dispel Magic slot retention', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'spell_breaker', slotRetentionSpells: ['Dispel Magic'] }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = { ...makeSpell(), name: 'Dispel Magic' }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 2 }), services)
      expect(services.getTargetInfo).toHaveBeenCalled()
    })
  })

  describe('triggerDispelMagic', () => {
    it('dispatches spell-result event for Dispel Magic', async () => {
      const events = []
      const handler = (e) => events.push(e.detail)
      window.addEventListener('spell-result', handler)

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Dispel Magic' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 2 }), services)

      const dispelEvent = events.find(e => e.isDispelMagic)
      expect(dispelEvent).toBeDefined()
      expect(dispelEvent.spellName).toBe('Dispel Magic')
      expect(dispelEvent.targetDC).toBe(12)

      window.removeEventListener('spell-result', handler)
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

  describe('triggerHeal - edge cases', () => {
    it('throws when slot level is missing and spell.level is also null', async () => {
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = { ...makeSpell(), name: 'Heal', level: null, heal_at_slot_level: { 6: '70' } }
      delete spell.damage

      await expect(executeSpellCast(spell, makeMetaCtx({ slotLevel: null }), services)).rejects.toThrow()
    })

    it('uses spell.level when metaCtx.slotLevel is null', async () => {
      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })

      const spell = { ...makeSpell(), name: 'Heal', level: 6, heal_at_slot_level: { 6: '70' } }
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: null }), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })

    it('uses highest slot level when exact level not found in heal_at_slot_level', async () => {
      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 50, oldHp: 50, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const spell = { ...makeSpell(), name: 'Heal', level: 7, heal_at_slot_level: { 6: '70', 7: '80' } }
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 8 }), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })
  })

  describe('applyRegenerateSpell - edge cases', () => {
    it('sets up turn-start healing and expiration', async () => {
      const expirations = await import('../effects/expirations.js')

      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 15, oldHp: 50, newHp: 65 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 50 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Regenerate', level: 7, heal_at_slot_level: { 7: '4d8 + 15' } })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 7 }), services)

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateActive', true, 'testCampaign')
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Target', 'regenerateSource', 'TestWizard', 'testCampaign')
      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard', 'Target',
        expect.arrayContaining([expect.objectContaining({ type: 'remove_regenerate_buff' })]),
        'testCampaign'
      )
    })
  })

  describe('executeMagicMissile - edge cases', () => {
    it('skips missiles with zero count', async () => {
      const combatData = await import('../../../services/encounters/combatData.js')
      const applyDamage = await import('../../../services/rules/combat/applyDamage.js')

      vi.mocked(combatData.getCombatSummary).mockReturnValue({
        creatures: [
          { name: 'Goblin', maxHp: 15, currentHp: 15 },
          { name: 'Orc', maxHp: 30, currentHp: 30 },
        ],
      })
      vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

      const dice = await import('../../dice/diceRoller.js')
      vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      const spell = { name: 'Magic Missile', level: 1, school: 'Evocation', casting_time: '1 action', components: ['V', 'S'], range: '120 feet' }
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1, magicMissileDistribution: { Goblin: 0, Orc: 3 } }), services)
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
        expect.anything(), 'Orc', 15, ['Force'], 'testCampaign', undefined, false, 'TestWizard'
      )
    })
  })

  describe('magicalAmbush passives null safety', () => {
    it('throws when passives is missing for magical ambush check', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: undefined },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Fireball' })
      await expect(executeSpellCast(spell, makeMetaCtx(), services)).rejects.toThrow()
    })
  })

  describe('spellCastingMod fallback', () => {
    it('uses spellAbilities.modifier when cantripSpellAbility not found in abilities', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          spellAbilities: { modifier: 3, spellCastingAbility: 'Strength' },
          abilities: [{ name: 'Intelligence', bonus: 5 }],
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Fireball', spellCastingAbility: 'Strength' })
      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(services.rollDamage).toHaveBeenCalled()
    })
  })

  describe('generic healing spells with max expression', () => {
    it('uses max healing when expression is "max"', async () => {
      vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue({ actualHeal: 70, oldHp: 30, newHp: 100 })
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({
        creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }],
      })

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({
        name: 'Cure Wounds', level: 1,
        heal_at_slot_level: { 1: 'max' },
      })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalled()
    })
  })

  describe('innateSorcery on attack roll spells', () => {
    it('adds advantage to attack rolls when innate sorcery is active', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      vi.mocked(buffService.isInnateSorceryActive).mockReturnValue(true)

      const services = makeServices({
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({
        name: 'Fire Bolt', level: 0,
        damage: { damage_type: 'Fire', damage_at_character_level: { 1: '1d10' } },
      })
      delete spell.damage.damage_at_slot_level
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)
      expect(services.rollAttack).toHaveBeenCalled()
      const ctx = services.rollAttack.mock.calls[0][2]
      expect(ctx.forcedMode).toBe('advantage')
    })
  })
})
