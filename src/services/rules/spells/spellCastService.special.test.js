// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'

// ---------------------------------------------------------------------------
// Static mocks — minimal surface area for the no-damage spell path
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

// Feature modules — all trigger functions default to no-op
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
vi.mock('../features/powerWordStunService.js', () => ({ triggerPowerWordStun: vi.fn(async () => {}) }))
vi.mock('../features/seeInvisibilityService.js', () => ({ triggerSeeInvisibility: vi.fn(async () => {}) }))
vi.mock('../features/sleepService.js', () => ({ triggerSleep: vi.fn(async () => {}) }))
vi.mock('../features/stinkingCloudService.js', () => ({ triggerStinkingCloud: vi.fn(async () => {}) }))
vi.mock('../features/tashasHideousLaughterService.js', () => ({ triggerTashasHideousLaughter: vi.fn(async () => {}) }))
vi.mock('../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => {}) }))
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

// ---------------------------------------------------------------------------
// Test-data factories
// ---------------------------------------------------------------------------

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
// Test suite — behavioral coverage for no-damage spell routing
// ---------------------------------------------------------------------------
describe('executeSpellCast - no-damage spell routing', () => {
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
  // Dual-name routing — spells that accept both full and short names
  // ------------------------------------------------------------------
  describe('dual-name spell routing', () => {
    it.each([
      { service: '../features/holdMonsterService.js', name: 'triggerHoldMonster', spells: ['Hold Monster', 'Hold Person'] },
      { service: '../features/ottoDanceService.js', name: 'triggerOttoDance', spells: ["Otto's Irresistible Dance", 'Irresistible Dance'] },
      { service: '../features/resilientSphereService.js', name: 'triggerResilientSphere', spells: ["Otiluke's Resilient Sphere", 'Resilient Sphere'] },
    ])('routes both spell names through $name', async ({ service, name, spells }) => {
      const mod = await import(service)
      const services = makeServices()

      for (const spellName of spells) {
        vi.clearAllMocks()
        const spell = makeSpell({ name: spellName })
        delete spell.damage

        await executeSpellCast(spell, makeMetaCtx(), services)
        expect(mod[name]).toHaveBeenCalled()
      }
    })
  })

  // ------------------------------------------------------------------
  // Spells that pass target name to their handler
  // ------------------------------------------------------------------
  describe('target-name passing spells', () => {
    it.each([
      { service: '../features/feignDeathService.js', name: 'triggerFeignDeath', spellName: 'Feign Death' },
      { service: '../features/foresightService.js', name: 'triggerForesight', spellName: 'Foresight' },
      { service: '../features/heroismService.js', name: 'triggerHeroism', spellName: 'Heroism' },
    ])('passes target name to $name', async ({ service, name, spellName }) => {
      const mod = await import(service)
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: spellName })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(mod[name]).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
    })
  })

  // ------------------------------------------------------------------
  // Spells that pass target name + spell save DC to their handler
  // ------------------------------------------------------------------
  describe('target-name + save DC passing spells', () => {
    it.each([
      { service: '../features/friendsService.js', name: 'triggerFriends', spellName: 'Friends' },
      { service: '../features/rayOfEnfeeblementService.js', name: 'triggerRayOfEnfeeblement', spellName: 'Ray of Enfeeblement' },
    ])('passes target name and spell save DC to $name', async ({ service, name, spellName }) => {
      const mod = await import(service)
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: spellName })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const callArg = vi.mocked(mod[name]).mock.calls[0][1]
      expect(callArg.targetName).toBe('Target')
      expect(callArg.spellSaveDc).toBe(17)
    })
  })

  // ------------------------------------------------------------------
  // Fear — triggers two services (Fear + False Life)
  // ------------------------------------------------------------------
  describe('fear dual-trigger', () => {
    it('triggers both Fear and False Life', async () => {
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
  // Automation routing — specific spell names
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
  // Generic automation routing — any spell with automation.type
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
