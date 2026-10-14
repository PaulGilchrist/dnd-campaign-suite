import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'

/* ------------------------------------------------------------------ */
/*  Mocks — minimal surface area for no-formula spell routing         */
/* ------------------------------------------------------------------ */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

// Feature modules — all trigger functions default to no-op
vi.mock('../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))
vi.mock('../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => {}) }))
vi.mock('../features/fearService.js', () => ({ triggerFear: vi.fn(async () => {}) }))
vi.mock('../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/fleshToStoneService.js', () => ({ triggerFleshToStone: vi.fn(async () => {}) }))
vi.mock('../features/holdMonsterService.js', () => ({ triggerHoldMonster: vi.fn(async () => {}) }))
vi.mock('../features/hypnoticPatternService.js', () => ({ triggerHypnoticPattern: vi.fn(async () => {}) }))
vi.mock('../features/massSuggestionService.js', () => ({ triggerMassSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/suggestionService.js', () => ({ triggerSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/ottoDanceService.js', () => ({ triggerOttoDance: vi.fn(async () => {}) }))
vi.mock('../features/resilientSphereService.js', () => ({ triggerResilientSphere: vi.fn(async () => {}) }))
vi.mock('../features/foresightService.js', () => ({ triggerForesight: vi.fn(async () => {}) }))
vi.mock('../features/rayOfEnfeeblementService.js', () => ({ triggerRayOfEnfeeblement: vi.fn(async () => {}) }))
vi.mock('../features/compelledDuelService.js', () => ({ triggerCompelledDuel: vi.fn(async () => {}) }))
vi.mock('../features/globeOfInvulnerabilityService.js', () => ({ triggerGlobeOfInvulnerability: vi.fn(async () => {}) }))
vi.mock('../features/forcecageService.js', () => ({ triggerForcecage: vi.fn(async () => {}) }))
vi.mock('../features/banishmentService.js', () => ({ triggerBanishment: vi.fn(async () => {}) }))
vi.mock('../features/confusionService.js', () => ({ triggerConfusion: vi.fn(async () => {}) }))
vi.mock('../features/mazeService.js', () => ({ triggerMaze: vi.fn(async () => {}) }))
vi.mock('../features/blurService.js', () => ({ triggerBlur: vi.fn(async () => {}) }))
vi.mock('../features/expeditiousRetreatService.js', () => ({ triggerExpeditiousRetreat: vi.fn(async () => {}) }))
vi.mock('../features/crownOfMadnessService.js', () => ({ triggerCrownOfMadness: vi.fn(async () => {}) }))
vi.mock('../features/animalFriendshipService.js', () => ({ triggerAnimalFriendship: vi.fn(async () => {}) }))
vi.mock('../features/dominateBeastService.js', () => ({ triggerDominateBeast: vi.fn(async () => {}) }))
vi.mock('../features/dominateMonsterService.js', () => ({ triggerDominateMonster: vi.fn(async () => {}) }))
vi.mock('../features/dominatePersonService.js', () => ({ triggerDominatePerson: vi.fn(async () => {}) }))
vi.mock('../features/holyAuraService.js', () => ({ triggerHolyAura: vi.fn(async () => {}) }))
vi.mock('../features/powerWordStunService.js', () => ({ triggerPowerWordStun: vi.fn(async () => {}) }))
vi.mock('../features/seeInvisibilityService.js', () => ({ triggerSeeInvisibility: vi.fn(async () => {}) }))
vi.mock('../features/stinkingCloudService.js', () => ({ triggerStinkingCloud: vi.fn(async () => {}) }))
vi.mock('../features/sleetStormService.js', () => ({ triggerSleetStorm: vi.fn(async () => {}) }))
vi.mock('../features/faerieFireService.js', () => ({ triggerFaerieFire: vi.fn(async () => {}) }))
vi.mock('../features/tashasHideousLaughterService.js', () => ({ triggerTashasHideousLaughter: vi.fn(async () => {}) }))
vi.mock('../features/imprisonmentService.js', () => ({ triggerImprisonment: vi.fn(async () => {}) }))
vi.mock('../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => {}) }))
vi.mock('../features/slowService.js', () => ({ triggerSlow: vi.fn(async () => {}) }))
vi.mock('../features/baneService.js', () => ({ triggerBaneSpell: vi.fn(async () => {}) }))
vi.mock('../features/blessService.js', () => ({ triggerBlessSpell: vi.fn(async () => {}) }))
vi.mock('../features/beaconOfHopeService.js', () => ({ triggerBeaconOfHope: vi.fn(async () => {}) }))
vi.mock('../features/massCureWoundsService.js', () => ({ triggerMassCureWounds: vi.fn(async () => {}) }))
vi.mock('../features/massHealingWordService.js', () => ({ triggerMassHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/prayerOfHealingService.js', () => ({ triggerPrayerOfHealing: vi.fn(async () => {}) }))
vi.mock('../features/confusionService.js', () => ({ triggerConfusion: vi.fn(async () => {}) }))
vi.mock('../features/mazeService.js', () => ({ triggerMaze: vi.fn(async () => {}) }))
vi.mock('../features/heroismService.js', () => ({ handle: vi.fn(), applyHeroism: vi.fn(), isHeroismActive: vi.fn() }))

vi.mock('./postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(async () => null),
  triggerSpellThief: vi.fn(async () => null),
  triggerBewitchingMagic: vi.fn(async () => null),
  triggerSoulstitchSpells: vi.fn(async () => null),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => {}),
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
/*  Suite — no-formula spell routing (modals & popups)               */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - no-formula spell routing', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
    runtime.getRuntimeValue.mockImplementation((key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      return undefined
    })

    const postCastRider = await import('./postCastRiderService.js')
    postCastRider.getEmpoweredEvocationFeatures.mockReturnValue([])
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(0)
  })

  // ------------------------------------------------------------------
  // Fear — returns modal when no formula
  // ------------------------------------------------------------------
  describe('fear modal', () => {
    it('returns fear modal when spell has no formula', async () => {
      const services = makeServices()
      const spell = makeSpell({ name: 'Fear' })
      delete spell.damage

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup).toEqual({
        type: 'modal',
        modalName: 'fear',
        payload: expect.objectContaining({
          action: { name: 'Fear', automation: { type: 'fear' } },
          saveType: 'WIS',
          saveDc: 17,
          activeOverlay: null,
          metamagicCareful: false,
        }),
      })
    })
  })

  // ------------------------------------------------------------------
  // Conjure Volley — returns info popup
  // ------------------------------------------------------------------
  describe('conjure volley', () => {
    it('returns info popup for Conjure Volley', async () => {
      const services = makeServices()
      const spell = makeSpell({ name: 'Conjure Volley' })
      delete spell.damage
      delete spell.dc

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup).toEqual({
        type: 'popup',
        payload: expect.objectContaining({
          type: 'automation_info',
          name: 'Conjure Volley',
        }),
      })
    })
  })

  // ------------------------------------------------------------------
  // Silence — returns modal
  // ------------------------------------------------------------------
  describe('silence modal', () => {
    it('returns silence target selection modal', async () => {
      const services = makeServices()
      const spell = makeSpell({ name: 'Silence' })
      delete spell.damage
      delete spell.dc

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup).toEqual({
        type: 'modal',
        modalName: 'silenceTargetSelection',
        payload: expect.objectContaining({
          action: expect.objectContaining({ name: 'Silence' }),
          aoeRadius: expect.any(Number),
          slotLevel: expect.any(Number),
        }),
      })
    })
  })

  // ------------------------------------------------------------------
  // Silence — Verbal component gate (SP-106)
  // ------------------------------------------------------------------
  describe('silence verbal-component gate', () => {
    async function getSilenceMocks() {
      const silence = await import('../features/silenceService.js')
      const log = await import('../../ui/logService.js')
      return { silence, log }
    }

    it('blocks a Verbal spell cast by a silenced caster with refusal popup + log', async () => {
      const { silence, log } = await getSilenceMocks()
      silence.getSilenceSource.mockReturnValue('Divine_Cleric')
      silence.isCreatureInSilenceZone.mockReturnValue(true)

      const services = makeServices({ playerStats: makePlayerStats({ name: 'Divine_Cleric' }) })
      const spell = makeSpell({ name: 'Sacred Flame', level: 0, components: ['V', 'S'] })

      const result = await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)

      expect(result.automationPopup).toEqual({
        type: 'popup',
        payload: expect.objectContaining({
          type: 'automation_info',
          name: 'Silence',
        }),
      })
      expect(result.automationPopup.payload.description).toContain('Verbal')
      const blockLog = log.addEntry.mock.calls.find(
        (c) => c[1].type === 'automation' && c[1].name === 'Silence'
      )
      expect(blockLog).toBeDefined()
      expect(blockLog[1].description).toContain('blocked')
      expect(blockLog[1].description).toContain('Sacred Flame')
      expect(services.rollDamage).not.toHaveBeenCalled()
      silence.getSilenceSource.mockReturnValue(null)
      silence.isCreatureInSilenceZone.mockReturnValue(false)
    })

    it('does not block a non-Verbal spell while inside the Silence zone', async () => {
      const { silence } = await getSilenceMocks()
      silence.getSilenceSource.mockReturnValue('Divine_Cleric')
      silence.isCreatureInSilenceZone.mockReturnValue(true)

      const services = makeServices()
      const spell = makeSpell({ name: 'Conjure Volley', components: ['S'] })
      delete spell.damage
      delete spell.dc

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup.payload.type).toBe('automation_info')
      expect(result.automationPopup.payload.name).toBe('Conjure Volley')
    })

    it('does not block Verbal spells when no Silence zone applies', async () => {
      const { silence } = await getSilenceMocks()
      silence.getSilenceSource.mockReturnValue(null)

      const services = makeServices()
      const spell = makeSpell({ name: 'Conjure Volley', components: ['V', 'S'] })
      delete spell.damage
      delete spell.dc

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result.automationPopup.payload.name).toBe('Conjure Volley')
    })
  })
})
