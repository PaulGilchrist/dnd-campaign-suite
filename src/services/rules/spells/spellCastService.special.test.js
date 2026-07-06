// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'

// ---------------------------------------------------------------------------
// Static mocks for modules that are imported at the top of the production file
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Static mocks for feature modules — all trigger functions default to no-op
// ---------------------------------------------------------------------------
vi.mock('../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))
vi.mock('../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => {}) }))
vi.mock('../features/fearService.js', () => ({ triggerFear: vi.fn(async () => {}) }))
vi.mock('../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/feignDeathService.js', () => ({ triggerFeignDeath: vi.fn(async () => {}) }))
vi.mock('../features/fleshToStoneService.js', () => ({ triggerFleshToStone: vi.fn(async () => {}) }))
vi.mock('../features/holdMonsterService.js', () => ({ triggerHoldMonster: vi.fn(async () => {}) }))
vi.mock('../features/hypnoticPatternService.js', () => ({ triggerHypnoticPattern: vi.fn(async () => {}) }))
vi.mock('../features/massSuggestionService.js', () => ({ triggerMassSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/suggestionService.js', () => ({ triggerSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/ottoDanceService.js', () => ({ triggerOttoDance: vi.fn(async () => {}) }))
vi.mock('../features/resilientSphereService.js', () => ({ triggerResilientSphere: vi.fn(async () => {}) }))
vi.mock('../features/foresightService.js', () => ({ triggerForesight: vi.fn(async () => {}) }))
vi.mock('../features/rayOfEnfeeblementService.js', () => ({ triggerRayOfEnfeeblement: vi.fn(async () => {}) }))
vi.mock('../features/globeOfInvulnerabilityService.js', () => ({ triggerGlobeOfInvulnerability: vi.fn(async () => {}) }))
vi.mock('../features/heroismService.js', () => ({ triggerHeroism: vi.fn(async () => {}) }))
vi.mock('../features/holyAuraService.js', () => ({ triggerHolyAura: vi.fn(async () => {}) }))
vi.mock('../features/powerWordFortifyService.js', () => ({ triggerPowerWordFortify: vi.fn(async () => {}) }))
vi.mock('../features/powerWordStunService.js', () => ({ triggerPowerWordStun: vi.fn(async () => {}) }))
vi.mock('../features/seeInvisibilityService.js', () => ({ triggerSeeInvisibility: vi.fn(async () => {}) }))
vi.mock('../features/sleepService.js', () => ({ triggerSleep: vi.fn(async () => {}) }))
vi.mock('../features/stinkingCloudService.js', () => ({ triggerStinkingCloud: vi.fn(async () => {}) }))
vi.mock('../features/tashasHideousLaughterService.js', () => ({ triggerTashasHideousLaughter: vi.fn(async () => {}) }))
vi.mock('../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => {}) }))
vi.mock('../features/massCureWoundsService.js', () => ({ triggerMassCureWounds: vi.fn(async () => {}) }))
vi.mock('../features/massHealService.js', () => ({ triggerMassHeal: vi.fn(async () => {}) }))
vi.mock('../features/massHealingWordService.js', () => ({ triggerMassHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/prayerOfHealingService.js', () => ({ triggerPrayerOfHealing: vi.fn(async () => {}) }))
vi.mock('../features/slowService.js', () => ({ triggerSlow: vi.fn(async () => {}) }))

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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('executeSpellCast - special spells', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    // Ensure runtime state defaults are correct
    const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
    runtime.getRuntimeValue.mockImplementation((key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      return undefined
    })

    // Ensure post-cast rider defaults
    const postCastRider = await import('./postCastRiderService.js')
    postCastRider.getEmpoweredEvocationFeatures.mockReturnValue([])
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(0)
  })

  // ------------------------------------------------------------------
  // Power Word Fortify — returns early without damage roll
  // ------------------------------------------------------------------
  describe('Power Word Fortify', () => {
    it('triggers Power Word Fortify and returns early without damage roll', async () => {
      const pf = await import('../features/powerWordFortifyService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Power Word Fortify' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(pf.triggerPowerWordFortify).toHaveBeenCalledWith(
        spell,
        expect.any(Object),
        expect.any(Object),
        'testCampaign',
        'testMap'
      )
      expect(services.rollDamage).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Fear — triggers Fear and False Life
  // ------------------------------------------------------------------
  describe('Fear', () => {
    it('triggers Fear with WIS save and False Life', async () => {
      const fear = await import('../features/fearService.js')
      const falseLife = await import('../features/falseLifeService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Fear', dc: { dc_type: 'wis', dc_success: 'half' } })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(fear.triggerFear).toHaveBeenCalled()
      expect(falseLife.triggerFalseLife).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Feign Death — passes target name
  // ------------------------------------------------------------------
  describe('Feign Death', () => {
    it('passes target name to Feign Death handler', async () => {
      const fd = await import('../features/feignDeathService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Feign Death' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(fd.triggerFeignDeath).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
    })
  })

  // ------------------------------------------------------------------
  // See Invisibility — simple trigger
  // ------------------------------------------------------------------
  describe('See Invisibility', () => {
    it('triggers See Invisibility', async () => {
      const si = await import('../features/seeInvisibilityService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'See Invisibility' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(si.triggerSeeInvisibility).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Hold Monster / Hold Person — both spell names
  // ------------------------------------------------------------------
  describe('Hold Monster / Hold Person', () => {
    it('triggers Hold Monster for both spell names', async () => {
      const hm = await import('../features/holdMonsterService.js')
      const services = makeServices()

      for (const name of ['Hold Monster', 'Hold Person']) {
        vi.clearAllMocks()
        const spell = makeSpell({ name })
        delete spell.damage

        await executeSpellCast(spell, makeMetaCtx(), services)
        expect(hm.triggerHoldMonster).toHaveBeenCalled()
      }
    })
  })

  // ------------------------------------------------------------------
  // Otto's Irresistible Dance — both full and short names
  // ------------------------------------------------------------------
  describe("Otto's Irresistible Dance", () => {
    it('passes spell save DC for both full and short spell names', async () => {
      const od = await import('../features/ottoDanceService.js')
      const services = makeServices()

      for (const name of ["Otto's Irresistible Dance", 'Irresistible Dance']) {
        vi.clearAllMocks()
        const spell = makeSpell({ name })
        delete spell.damage

        await executeSpellCast(spell, makeMetaCtx(), services)
        const callArg = vi.mocked(od.triggerOttoDance).mock.calls[0][1]
        expect(callArg.spellSaveDc).toBe(17)
      }
    })
  })

  // ------------------------------------------------------------------
  // Otiluke's Resilient Sphere — both full and short names
  // ------------------------------------------------------------------
  describe("Otiluke's Resilient Sphere", () => {
    it('passes spell save DC for both full and short spell names', async () => {
      const rs = await import('../features/resilientSphereService.js')
      const services = makeServices()

      for (const name of ["Otiluke's Resilient Sphere", 'Resilient Sphere']) {
        vi.clearAllMocks()
        const spell = makeSpell({ name })
        delete spell.damage

        await executeSpellCast(spell, makeMetaCtx(), services)
        const callArg = vi.mocked(rs.triggerResilientSphere).mock.calls[0][1]
        expect(callArg.spellSaveDc).toBe(17)
      }
    })
  })

  // ------------------------------------------------------------------
  // Foresight — passes target name
  // ------------------------------------------------------------------
  describe('Foresight', () => {
    it('passes target name to Foresight handler', async () => {
      const fo = await import('../features/foresightService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Foresight' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(fo.triggerForesight).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
    })
  })

  // ------------------------------------------------------------------
  // Friends — passes target name and spell save DC
  // ------------------------------------------------------------------
  describe('Friends', () => {
    it('passes target name and spell save DC to Friends handler', async () => {
      const friends = await import('../features/friendsService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Friends' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(friends.triggerFriends).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Ray of Enfeeblement — passes target name and spell save DC
  // ------------------------------------------------------------------
  describe('Ray of Enfeeblement', () => {
    it('passes target name and spell save DC to Ray of Enfeeblement handler', async () => {
      const roe = await import('../features/rayOfEnfeeblementService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Ray of Enfeeblement' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(roe.triggerRayOfEnfeeblement).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Globe of Invulnerability — simple trigger
  // ------------------------------------------------------------------
  describe('Globe of Invulnerability', () => {
    it('triggers Globe of Invulnerability', async () => {
      const goi = await import('../features/globeOfInvulnerabilityService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Globe of Invulnerability' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(goi.triggerGlobeOfInvulnerability).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Silence — simple trigger
  // ------------------------------------------------------------------
  describe('Silence', () => {
    it('triggers Silence handler', async () => {
      const silence = await import('../features/silenceService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Silence' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(silence.triggerSilence).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Heroism — passes target name
  // ------------------------------------------------------------------
  describe('Heroism', () => {
    it('passes target name to Heroism handler', async () => {
      const hero = await import('../features/heroismService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Heroism' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(hero.triggerHeroism).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
    })
  })

  // ------------------------------------------------------------------
  // Holy Aura — simple trigger
  // ------------------------------------------------------------------
  describe('Holy Aura', () => {
    it('triggers Holy Aura', async () => {
      const ha = await import('../features/holyAuraService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Holy Aura' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(ha.triggerHolyAura).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Remove Curse — simple trigger
  // ------------------------------------------------------------------
  describe('Remove Curse', () => {
    it('triggers Remove Curse', async () => {
      const rc = await import('../features/removeCurseService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Remove Curse' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(rc.triggerRemoveCurse).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Automation-routing spells — specific spell names
  // ------------------------------------------------------------------
  describe('automation-routing spells', () => {
    const automationSpells = [
      'Longstrider',
      'Protection from Energy',
      'Protection from Poison',
      'Stone Skin',
      'Resistance',
    ]

    it.each(automationSpells)('routes %s through executeHandler', async (spellName) => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: spellName })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(executeHandler).toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Generic automation routing — arbitrary automation.type spell
  // ------------------------------------------------------------------
  describe('generic automation routing', () => {
    it('routes spells with automation.type through executeHandler', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = {
        name: 'CustomSpell',
        level: 1,
        school: 'Evocation',
        casting_time: '1 action',
        automation: { type: 'custom_action' },
      }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      expect(executeHandler).toHaveBeenCalled()
    })
  })
})
