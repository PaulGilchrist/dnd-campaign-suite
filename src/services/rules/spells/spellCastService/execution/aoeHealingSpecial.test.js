// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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
/*  Suite — Feature riders & special cases                            */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - Feature riders & special cases', () => {
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
  // Potent Spellcasting / Blessed Strikes
  // ------------------------------------------------------------------
  describe('Blessed Strikes / Potent Spellcasting', () => {
    it('adds Wisdom modifier to cantrip damage when Potent Spellcasting is active', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [],
            actions: [
              {
                type: 'damage_bonus',
                name: 'Blessed Strikes',
                options: ['Spellcasting'],
              },
            ],
          },
          abilities: [
            { name: 'Intelligence', bonus: 5 },
            { name: 'Wisdom', bonus: 3 },
          ],
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Fire Bolt',
        level: 0,
        baseLevel: 0,
        damage: { damage_type: 'Fire', damage_at_character_level: { 1: '1d10' } },
        dc: { dc_type: 'dex', dc_success: 'none' },
      })
      delete spell.damage.damage_at_slot_level

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)

      expect(services.playerStats.automation.actions).toHaveLength(1)
      expect(services.rollDamage).toHaveBeenCalled()
      const formula = services.rollDamage.mock.calls[0][1]
      expect(formula).toContain('Blessed Strikes')
    })
  })

  // ------------------------------------------------------------------
  // Radiant Soul
  // ------------------------------------------------------------------
  describe('Radiant Soul', () => {
    it('adds CHA modifier when dealing Radiant damage with Radiant Soul passive', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [
              { type: 'radiant_soul', hasAutomation: true, damageTypes: ['Radiant'] },
            ],
            actions: [],
          },
          abilities: [
            { name: 'Charisma', bonus: 4 },
            { name: 'Intelligence', bonus: 5 },
          ],
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Guiding Bolt',
        level: 1,
        damage: { damage_type: 'Radiant' },
        dc: { dc_type: 'dex', dc_success: 'none' },
      })

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 1 }), services)

      expect(services.rollDamage).toHaveBeenCalled()
      const formula = services.rollDamage.mock.calls[0][1]
      expect(formula).toContain('Radiant Soul')
    })
  })

  // ------------------------------------------------------------------
  // Overchannel
  // ------------------------------------------------------------------
  describe('Overchannel', () => {
    it('maximizes damage when overchannel is active for valid slot level', async () => {
      const dice = await import('../../../../dice/diceRoller.js')
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'overchannel' }],
          },
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell()
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 3, overchannel: true }), services)

      expect(dice.rollExpressionMaximized).toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
    })

    it('does not maximize when slot level is outside 1-5 range', async () => {
      const dice = await import('../../../../dice/diceRoller.js')
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'overchannel' }],
          },
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell()
      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 9, overchannel: true }), services)

      expect(dice.rollExpression).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Soulstitch Spells error handling
  // ------------------------------------------------------------------
  describe('Soulstitch Spells error handling', () => {
    it('catches and logs errors from soulstitch trigger', async () => {
      const postCastRider = await import('../../postCastRiderService.js')
      postCastRider.triggerSoulstitchSpells.mockRejectedValue(new Error('test error'))

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell()
      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[spellCast] Soulstitch Spells trigger failed:',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })

  // ------------------------------------------------------------------
  // Spell Breaker - Dispel Magic slot retention
  // ------------------------------------------------------------------
  describe('Spell Breaker - Dispel Magic slot retention', () => {
    it('sets up event listener for Dispel Magic', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'spell_breaker', slotRetentionSpells: ['Dispel Magic'] }],
          },
        }),
        getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
      })

      const spell = makeSpell({ name: 'Dispel Magic' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 2 }), services)

      expect(services.getTargetInfo).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Sanctuary ending on spell cast
  // ------------------------------------------------------------------
  describe('Sanctuary ending', () => {
    it('ends Sanctuary when warded creature casts a spell', async () => {
      const sanctuaryHandler = await import('../../../../automation/handlers/spells/sanctuaryHandler.js')
      vi.mocked(sanctuaryHandler.endSanctuary).mockResolvedValue(undefined)
      vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions' || key === 'targetEffects')
          return [{ effect: 'sanctuary', target: 'TestWizard', source: 'Ally1' }]
        return undefined
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
        characters: [{ name: 'Ally1', type: 'player' }],
      })

      const spell = makeSpell()
      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(sanctuaryHandler.endSanctuary).toHaveBeenCalled()
    })

    it('does not end Sanctuary when caster is not in characters list', async () => {
      const sanctuaryHandler = await import('../../../../automation/handlers/spells/sanctuaryHandler.js')
      vi.mocked(sanctuaryHandler.endSanctuary).mockResolvedValue(undefined)
      vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
        if (key === 'activeConditions' || key === 'targetEffects')
          return [{ effect: 'sanctuary', target: 'TestWizard', source: 'UnknownAlly' }]
        return undefined
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
        characters: [],
      })

      const spell = makeSpell()
      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(sanctuaryHandler.endSanctuary).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Post-cast triggers
  // ------------------------------------------------------------------
  describe('post-cast triggers', () => {
    it('calls all post-cast trigger services', async () => {
      const postCastRider = await import('../../postCastRiderService.js')
      const postCastHeal = await import('../../postCastHealService.js')
      const smite = await import('../../../features/smiteOfProtectionService.js')
      const inspiring = await import('../../../features/inspiringSmiteService.js')
      const primal = await import('../../../features/primalCompanionSpellShareService.js')
      const wildMagic = await import('../../../features/wildMagicSurgeService.js')

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell()
      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(postCastRider.triggerPostCastRiderSaves).toHaveBeenCalled()
      expect(postCastHeal.triggerPostCastSelfHeals).toHaveBeenCalled()
      expect(postCastHeal.triggerPostCastAllyHeals).toHaveBeenCalled()
      expect(smite.triggerSmiteOfProtection).toHaveBeenCalled()
      expect(inspiring.triggerInspiringSmite).toHaveBeenCalled()
      expect(primal.triggerPrimalCompanionSpellShare).toHaveBeenCalled()
      expect(wildMagic.triggerWildMagicSurge).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Cantrip range bonus
  // ------------------------------------------------------------------
  describe('cantrip range bonus', () => {
    it('adds cantripRangeBonus to effective range for cantrips', async () => {
      const range = await import('../../../combat/rangeValidation.js')
      vi.mocked(range.computeEffectiveSpellRange).mockReturnValue(120)
      vi.mocked(range.getDistanceFeet).mockReturnValue(100)
      vi.mocked(range.computeRangeEffect).mockReturnValue({ mode: 'normal' })

      const services = makeServices({
        attackerPos: { x: 0, y: 0 },
        targetPos: { x: 10, y: 0 },
        featEffects: { cantripRangeBonus: 30 },
        getTargetInfo: async () => ({ name: 'Target' }),
        playerStats: makePlayerStats(),
      })

      const spell = makeSpell({
        name: 'Fire Bolt',
        level: 0,
        range: '120 feet',
        damage: { damage_type: 'Fire', damage_at_character_level: { 1: '1d10' } },
      })
      delete spell.damage.damage_at_slot_level
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)

      expect(range.computeRangeEffect).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Vicious Mockery generic
  // ------------------------------------------------------------------
  describe('Vicious Mockery generic', () => {
    it('stamps the save context and does NOT trigger vicious mockery at cast time (CLA-377)', async () => {
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Vicious Mockery',
        level: 0,
        damage: { damage_type: 'Psychic', damage_at_character_level: { 1: '1d4' } },
        dc: { dc_type: 'wis', dc_success: 'none' },
      })

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)

      const vm = await import('../../../features/viciousMockeryService.js')
      expect(vm.triggerViciousMockeryForGeneric).not.toHaveBeenCalled()

      const rollDamage = services.rollDamage
      expect(rollDamage).toHaveBeenCalled()
      const context = rollDamage.mock.calls[rollDamage.mock.calls.length - 1][5]
      expect(context.viciousMockerySpell).toBe(spell)
    })
  })

  // ------------------------------------------------------------------
  // Hex spell (non-Hex) — applies hex effects
  // ------------------------------------------------------------------
  describe('Hex spell routing', () => {
    it('applies hex effects for the Hex spell', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
          },
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({ name: 'Hex' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ hexAbility: 'STR' }), services)

      expect(runtime.setRuntimeValue).toHaveBeenCalledWith(
        'campaign', 'targetEffects',
        expect.any(Array),
        'testCampaign'
      )
    })
  })

  // ------------------------------------------------------------------
  // Hunter's Mark — returns early without damage
  // ------------------------------------------------------------------
  describe("Hunter's Mark", () => {
    it('returns early without damage for Hunter\'s Mark', async () => {
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({ name: "Hunter's Mark" })
      delete spell.damage
      delete spell.dc

      const result = await executeSpellCast(spell, makeMetaCtx(), services)

      expect(result).toBeUndefined()
    })
  })

  // ------------------------------------------------------------------
  // Psychic Spells component reduction
  // ------------------------------------------------------------------
  describe('Psychic Spells component reduction', () => {
    it('removes verbal/somatic components for enchantment/illusion spells with Psychic Spells', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [
              {
                name: 'Psychic Spells',
                type: 'psychic_spells',
                spellSchools: ['enchantment', 'illusion'],
                componentReduction: ['V', 'S'],
              },
            ],
          },
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Charm Person',
        school: 'Enchantment',
        components: ['V'],
      })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(spell.components).toEqual([])
    })
  })

  // ------------------------------------------------------------------
  // Psychic Spells damage type override
  // ------------------------------------------------------------------
  describe('Psychic Spells damage type override', () => {
    const psychicPassives = [
      {
        name: 'Psychic Spells',
        type: 'psychic_spells',
        spellSchools: ['enchantment', 'illusion'],
        componentReduction: [],
        damageType: 'Psychic',
      },
    ]

    it('overrides damage type to Psychic only when the cast-time opt-in flag is set', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: psychicPassives },
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Charm Person',
        school: 'Enchantment',
        damage: { damage_type: 'Thunder', damage_at_slot_level: { 1: '1d6' } },
        dc: { dc_type: 'wis', dc_success: 'none' },
        _psychicSpellsOverride: true,
      })

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(services.rollDamage).toHaveBeenCalled()
      const ctx = services.rollDamage.mock.calls[0][5]
      expect(ctx.damageType).toBe('Psychic')
    })

    it('keeps RAW damage type when the opt-in flag is not set', async () => {
      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: psychicPassives },
        }),
        getTargetInfo: async () => ({ name: 'Target' }),
      })

      const spell = makeSpell({
        name: 'Charm Person',
        school: 'Enchantment',
        damage: { damage_type: 'Thunder', damage_at_slot_level: { 1: '1d6' } },
        dc: { dc_type: 'wis', dc_success: 'none' },
      })

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(services.rollDamage).toHaveBeenCalled()
      const ctx = services.rollDamage.mock.calls[0][5]
      expect(ctx.damageType).toBe('Thunder')
    })
  })

  // ------------------------------------------------------------------
  // Spell lookup fetch failure
  // ------------------------------------------------------------------
  describe('spell lookup fetch failure', () => {
    it('gracefully handles fetch failure during spell lookup', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
        playerStats: makePlayerStats({ rules: '2024' }),
      })

      const spell = {
        name: 'UnknownSpell',
        level: 1,
        school: 'Evocation',
      }

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[spellCast] Failed to look up full spell data for:',
        'UnknownSpell',
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })
})
