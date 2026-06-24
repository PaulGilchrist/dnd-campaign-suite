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
  hasEmpoweredEvocation: vi.fn(() => false),
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
    postCastRider.hasEmpoweredEvocation.mockReturnValue(false)
    postCastRider.getEmpoweredEvocationIntModifier.mockReturnValue(0)
  })

  // ------------------------------------------------------------------
  // Power Word Fortify
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
  // Fear
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

    it('adds Innate Sorcery bonus to Fear save DC', async () => {
      const buffService = await import('../../combat/buffs/buffService.js')
      const fear = await import('../features/fearService.js')
      vi.mocked(buffService.isInnateSorceryActive).mockReturnValue(true)
      const services = makeServices()
      const spell = makeSpell({ name: 'Fear', dc: { dc_type: 'wis', dc_success: 'half' } })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(fear.triggerFear).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(18) // 17 base + 1 Innate Sorcery
    })
  })

  // ------------------------------------------------------------------
  // Feign Death
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
  // See Invisibility
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
  // Flesh to Stone
  // ------------------------------------------------------------------
  describe('Flesh to Stone', () => {
    it('passes spell save DC to Flesh to Stone handler', async () => {
      const fts = await import('../features/fleshToStoneService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Flesh to Stone' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(fts.triggerFleshToStone).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Hold Monster / Hold Person
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
  // Power Word Stun
  // ------------------------------------------------------------------
  describe('Power Word Stun', () => {
    it('passes spell save DC to Power Word Stun handler', async () => {
      const pws = await import('../features/powerWordStunService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Power Word Stun' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(pws.triggerPowerWordStun).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Hypnotic Pattern
  // ------------------------------------------------------------------
  describe('Hypnotic Pattern', () => {
    it('passes spell save DC to Hypnotic Pattern handler', async () => {
      const hp = await import('../features/hypnoticPatternService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Hypnotic Pattern' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(hp.triggerHypnoticPattern).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Slow
  // ------------------------------------------------------------------
  describe('Slow', () => {
    it('passes spell save DC to Slow handler', async () => {
      const slow = await import('../features/slowService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Slow' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(slow.triggerSlow).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Mass Suggestion
  // ------------------------------------------------------------------
  describe('Mass Suggestion', () => {
    it('passes spell save DC to Mass Suggestion handler', async () => {
      const ms = await import('../features/massSuggestionService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Mass Suggestion' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(ms.triggerMassSuggestion).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Suggestion
  // ------------------------------------------------------------------
  describe('Suggestion', () => {
    it('passes spell save DC to Suggestion handler', async () => {
      const sug = await import('../features/suggestionService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Suggestion' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(sug.triggerSuggestion).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Otto's Irresistible Dance
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
  // Otiluke's Resilient Sphere
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
  // Foresight
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
  // Friends
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
  // Ray of Enfeeblement
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
  // Globe of Invulnerability
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
  // Silence
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
  // Sleep
  // ------------------------------------------------------------------
  describe('Sleep', () => {
    it('passes spell save DC to Sleep handler', async () => {
      const sleep = await import('../features/sleepService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Sleep' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(sleep.triggerSleep).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Stinking Cloud
  // ------------------------------------------------------------------
  describe('Stinking Cloud', () => {
    it('passes spell save DC to Stinking Cloud handler', async () => {
      const sc = await import('../features/stinkingCloudService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Stinking Cloud' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(sc.triggerStinkingCloud).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Tasha's Hideous Laughter
  // ------------------------------------------------------------------
  describe("Tasha's Hideous Laughter", () => {
    it('passes spell save DC to Tasha Hideous Laughter handler', async () => {
      const thl = await import('../features/tashasHideousLaughterService.js')
      const services = makeServices()
      const spell = makeSpell({ name: "Tasha's Hideous Laughter" })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(thl.triggerTashasHideousLaughter).mock.calls[0][1]
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Heroism
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
  // Holy Aura
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
  // Automation-routing spells
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
  // Remove Curse
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
  // Dispel Magic — verifies that triggerDispelMagic dispatches a
  // CustomEvent with the expected detail shape.
  // ------------------------------------------------------------------
  describe('Dispel Magic', () => {
    it('dispatches spell-result event with isDispelMagic detail', async () => {
      const events = []
      const handler = (e) => events.push(e.detail)
      window.addEventListener('spell-result', handler)

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = { name: 'Dispel Magic', level: 3, school: 'Abjuration', casting_time: '1 action', components: ['V', 'S'], range: 'Self (60-foot radius sphere)' }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const dispelEvent = events.find((e) => e.isDispelMagic)
      expect(dispelEvent).toBeDefined()
      expect(dispelEvent.spellName).toBe('Dispel Magic')
      expect(dispelEvent.targetName).toBe('Target')

      window.removeEventListener('spell-result', handler)
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

  // ------------------------------------------------------------------
  // Cantrip range bonus
  // ------------------------------------------------------------------
  describe('cantrip range bonus', () => {
    it('extends cantrip range when cantripRangeBonus feat is active', async () => {
      const range = await import('../combat/rangeValidation.js')
      const services = makeServices({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 30, gridY: 0 },
        featEffects: { cantripRangeBonus: 30 },
      })
      const spell = makeSpell({
        name: 'Fire Bolt', level: 0,
        damage: { damage_type: 'Fire', damage_at_character_level: { 1: '1d10' } },
        range: '120 feet',
      })
      delete spell.damage.damage_at_slot_level
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx({ slotLevel: 0 }), services)

      expect(range.computeRangeEffect).toHaveBeenCalled()
    })
  })
})
