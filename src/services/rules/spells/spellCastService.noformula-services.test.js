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
/*  Suite — no-formula spell routing (feature triggers)                */
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
  // See Invisibility — triggers service
  // ------------------------------------------------------------------
  describe('see invisibility', () => {
    it('triggers see invisibility service', async () => {
      const { triggerSeeInvisibility } = await import('../features/seeInvisibilityService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'See Invisibility' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerSeeInvisibility).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Flesh to Stone — triggers service
  // ------------------------------------------------------------------
  describe('flesh to stone', () => {
    it('triggers flesh to stone service', async () => {
      const { triggerFleshToStone } = await import('../features/fleshToStoneService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Flesh to Stone' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerFleshToStone).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Hold Monster / Hold Person — triggers service
  // ------------------------------------------------------------------
  describe('hold monster / hold person', () => {
    it('triggers hold monster service', async () => {
      const { triggerHoldMonster } = await import('../features/holdMonsterService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Hold Monster' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerHoldMonster).toHaveBeenCalled()
    })

    it('triggers hold monster service for Hold Person too', async () => {
      const { triggerHoldMonster } = await import('../features/holdMonsterService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Hold Person' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerHoldMonster).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Banishment — triggers service
  // ------------------------------------------------------------------
  describe('banishment', () => {
    it('triggers banishment service', async () => {
      const { triggerBanishment } = await import('../features/banishmentService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Banishment' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerBanishment).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Maze — triggers service
  // ------------------------------------------------------------------
  describe('maze', () => {
    it('triggers maze service', async () => {
      const { triggerMaze } = await import('../features/mazeService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Maze' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerMaze).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Power Word Stun — triggers service
  // ------------------------------------------------------------------
  describe('power word stun', () => {
    it('triggers power word stun service', async () => {
      const { triggerPowerWordStun } = await import('../features/powerWordStunService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Power Word Stun' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerPowerWordStun).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Slow — triggers service
  // ------------------------------------------------------------------
  describe('slow', () => {
    it('triggers slow service', async () => {
      const { triggerSlow } = await import('../features/slowService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Slow' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerSlow).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Bane — triggers service
  // ------------------------------------------------------------------
  describe('bane', () => {
    it('triggers bane service', async () => {
      const { triggerBaneSpell } = await import('../features/baneService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Bane' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerBaneSpell).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Bless — triggers service
  // ------------------------------------------------------------------
  describe('bless', () => {
    it('triggers bless service', async () => {
      const { triggerBlessSpell } = await import('../features/blessService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Bless' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerBlessSpell).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Beacon of Hope — triggers service
  // ------------------------------------------------------------------
  describe('beacon of hope', () => {
    it('triggers beacon of hope service', async () => {
      const { triggerBeaconOfHope } = await import('../features/beaconOfHopeService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Beacon of Hope' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerBeaconOfHope).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Blur — triggers service
  // ------------------------------------------------------------------
  describe('blur', () => {
    it('triggers blur service', async () => {
      const { triggerBlur } = await import('../features/blurService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Blur' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerBlur).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Expeditious Retreat — triggers service
  // ------------------------------------------------------------------
  describe('expeditious retreat', () => {
    it('triggers expeditious retreat service', async () => {
      const { triggerExpeditiousRetreat } = await import('../features/expeditiousRetreatService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Expeditious Retreat' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerExpeditiousRetreat).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Crown of Madness — triggers service
  // ------------------------------------------------------------------
  describe('crown of madness', () => {
    it('triggers crown of madness service', async () => {
      const { triggerCrownOfMadness } = await import('../features/crownOfMadnessService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Crown of Madness' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerCrownOfMadness).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Animal Friendship — triggers service
  // ------------------------------------------------------------------
  describe('animal friendship', () => {
    it('triggers animal friendship service', async () => {
      const { triggerAnimalFriendship } = await import('../features/animalFriendshipService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Animal Friendship' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerAnimalFriendship).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Dominate Beast — triggers service
  // ------------------------------------------------------------------
  describe('dominate beast', () => {
    it('triggers dominate beast service', async () => {
      const { triggerDominateBeast } = await import('../features/dominateBeastService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Dominate Beast' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerDominateBeast).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Dominate Monster — triggers service
  // ------------------------------------------------------------------
  describe('dominate monster', () => {
    it('triggers dominate monster service', async () => {
      const { triggerDominateMonster } = await import('../features/dominateMonsterService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Dominate Monster' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerDominateMonster).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Dominate Person — triggers service
  // ------------------------------------------------------------------
  describe('dominate person', () => {
    it('triggers dominate person service', async () => {
      const { triggerDominatePerson } = await import('../features/dominatePersonService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Dominate Person' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(triggerDominatePerson).toHaveBeenCalled()
    })
  })
})
