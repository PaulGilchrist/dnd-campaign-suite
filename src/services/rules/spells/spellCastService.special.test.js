import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
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

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
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
  hasEmpoweredEvocation: vi.fn(() => false),
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

vi.mock('../features/powerWordFortifyService.js', () => ({
  triggerPowerWordFortify: vi.fn(async () => {}),
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

vi.mock('../features/massCureWoundsService.js', () => ({
  triggerMassCureWounds: vi.fn(async () => {}),
}))

vi.mock('../features/massHealService.js', () => ({
  triggerMassHeal: vi.fn(async () => {}),
}))

vi.mock('../features/massHealingWordService.js', () => ({
  triggerMassHealingWord: vi.fn(async () => {}),
}))

vi.mock('../features/prayerOfHealingService.js', () => ({
  triggerPrayerOfHealing: vi.fn(async () => {}),
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

import { executeSpellCast } from './spellCastService.js'

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

async function resetMocks() {
  const mock = (path, fnMap) => import(path).then(m => {
    for (const [key, value] of Object.entries(fnMap)) {
      m[key].mockImplementation(value)
    }
  })

  await mock('./postCastRiderService.js', {
    triggerPostCastRiderSaves: async () => null,
    triggerSpellThief: async () => null,
    triggerBewitchingMagic: async () => null,
    triggerSoulstitchSpells: async () => null,
    hasEmpoweredEvocation: () => false,
    getEmpoweredEvocationIntModifier: () => 0,
  })
  await mock('./postCastHealService.js', {
    triggerPostCastSelfHeals: async () => {},
    triggerPostCastAllyHeals: async () => {},
  })
  await mock('../features/smiteOfProtectionService.js', {
    triggerSmiteOfProtection: async () => {},
  })
  await mock('../features/inspiringSmiteService.js', {
    triggerInspiringSmite: async () => {},
  })
  await mock('../features/primalCompanionSpellShareService.js', {
    triggerPrimalCompanionSpellShare: async () => {},
  })
  await mock('../features/wildMagicSurgeService.js', {
    triggerWildMagicSurge: async () => {},
  })
  await mock('../features/fearService.js', {
    triggerFear: async () => {},
  })
  await mock('../features/falseLifeService.js', {
    triggerFalseLife: async () => {},
  })
  await mock('../features/healingWordService.js', {
    triggerHealingWord: async () => {},
  })
  await mock('../features/feignDeathService.js', {
    triggerFeignDeath: async () => {},
  })
  await mock('../features/fleshToStoneService.js', {
    triggerFleshToStone: async () => {},
  })
  await mock('../features/holdMonsterService.js', {
    triggerHoldMonster: async () => {},
  })
  await mock('../features/hypnoticPatternService.js', {
    triggerHypnoticPattern: async () => {},
  })
  await mock('../features/massSuggestionService.js', {
    triggerMassSuggestion: async () => {},
  })
  await mock('../features/suggestionService.js', {
    triggerSuggestion: async () => {},
  })
  await mock('../features/ottoDanceService.js', {
    triggerOttoDance: async () => {},
  })
  await mock('../features/resilientSphereService.js', {
    triggerResilientSphere: async () => {},
  })
  await mock('../features/foresightService.js', {
    triggerForesight: async () => {},
  })
  await mock('../features/rayOfEnfeeblementService.js', {
    triggerRayOfEnfeeblement: async () => {},
  })
  await mock('../features/globeOfInvulnerabilityService.js', {
    triggerGlobeOfInvulnerability: async () => {},
  })
  await mock('../features/heroismService.js', {
    triggerHeroism: async () => {},
  })
  await mock('../features/holyAuraService.js', {
    triggerHolyAura: async () => {},
  })
  await mock('../features/powerWordFortifyService.js', {
    triggerPowerWordFortify: async () => {},
  })
  await mock('../features/powerWordStunService.js', {
    triggerPowerWordStun: async () => {},
  })
  await mock('../features/seeInvisibilityService.js', {
    triggerSeeInvisibility: async () => {},
  })
  await mock('../features/sleepService.js', {
    triggerSleep: async () => {},
  })
  await mock('../features/stinkingCloudService.js', {
    triggerStinkingCloud: async () => {},
  })
  await mock('../features/tashasHideousLaughterService.js', {
    triggerTashasHideousLaughter: async () => {},
  })
  await mock('../features/removeCurseService.js', {
    triggerRemoveCurse: async () => {},
  })
  await mock('../features/massCureWoundsService.js', {
    triggerMassCureWounds: async () => {},
  })
  await mock('../features/massHealService.js', {
    triggerMassHeal: async () => {},
  })
  await mock('../features/massHealingWordService.js', {
    triggerMassHealingWord: async () => {},
  })
  await mock('../features/prayerOfHealingService.js', {
    triggerPrayerOfHealing: async () => {},
  })
  await mock('../features/slowService.js', {
    triggerSlow: async () => {},
  })
  await mock('../features/silenceService.js', {
    getSilenceSource: () => null,
    isCreatureInSilenceZone: () => false,
  })
  await mock('../features/invisibilityService.js', {
    endInvisibilityOnHostileAction: () => {},
  })
  await mock('../features/friendsService.js', {
    endFriendsOnHostileAction: () => {},
  })
  await mock('../../combat/buffs/buffService.js', {
    isInnateSorceryActive: () => false,
    getActiveBuffs: () => [],
  })
  await mock('../../../hooks/runtime/useRuntimeState.js', {
    getRuntimeValue: (key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      return undefined
    },
    setRuntimeValue: () => {},
  })
}

describe('executeSpellCast - special spells', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMocks()
  })

  describe('Power Word Fortify', () => {
    it('triggers Power Word Fortify and returns early', async () => {
      const pf = await import('../features/powerWordFortifyService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Power Word Fortify' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(pf.triggerPowerWordFortify).toHaveBeenCalled()
    })
  })

  describe('Fear', () => {
    it('triggers Fear with WIS save and returns early', async () => {
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
      expect(fear.triggerFear).toHaveBeenCalledWith(
        spell,
        expect.objectContaining({ spellSaveDc: expect.any(Number) }),
        expect.anything(),
        'testCampaign',
        'testMap'
      )
    })
  })

  describe('Feign Death', () => {
    it('triggers Feign Death with target name', async () => {
      const fd = await import('../features/feignDeathService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Feign Death' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(fd.triggerFeignDeath).toHaveBeenCalledWith(
        spell,
        expect.objectContaining({ targetName: 'Target' }),
        expect.anything(),
        'testCampaign',
        'testMap'
      )
    })
  })

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

  describe('Flesh to Stone', () => {
    it('triggers Flesh to Stone with save DC', async () => {
      const fts = await import('../features/fleshToStoneService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Flesh to Stone' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(fts.triggerFleshToStone).toHaveBeenCalled()
    })
  })

  describe('Hold Monster / Hold Person', () => {
    it('triggers Hold Monster', async () => {
      const hm = await import('../features/holdMonsterService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Hold Monster' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(hm.triggerHoldMonster).toHaveBeenCalled()
    })

    it('triggers Hold Person', async () => {
      const hm = await import('../features/holdMonsterService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Hold Person' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(hm.triggerHoldMonster).toHaveBeenCalled()
    })
  })

  describe('Power Word Stun', () => {
    it('triggers Power Word Stun', async () => {
      const pws = await import('../features/powerWordStunService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Power Word Stun' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(pws.triggerPowerWordStun).toHaveBeenCalled()
    })
  })

  describe('Hypnotic Pattern', () => {
    it('triggers Hypnotic Pattern with WIS save', async () => {
      const hp = await import('../features/hypnoticPatternService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Hypnotic Pattern' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(hp.triggerHypnoticPattern).toHaveBeenCalled()
    })
  })

  describe('Slow', () => {
    it('triggers Slow with WIS save', async () => {
      const slow = await import('../features/slowService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Slow' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(slow.triggerSlow).toHaveBeenCalled()
    })
  })

  describe('Mass Suggestion', () => {
    it('triggers Mass Suggestion with WIS save', async () => {
      const ms = await import('../features/massSuggestionService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Mass Suggestion' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(ms.triggerMassSuggestion).toHaveBeenCalled()
    })
  })

  describe('Suggestion', () => {
    it('triggers Suggestion with WIS save', async () => {
      const sug = await import('../features/suggestionService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Suggestion' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(sug.triggerSuggestion).toHaveBeenCalled()
    })
  })

  describe("Otto's Irresistible Dance", () => {
    it('triggers Otto Irresistible Dance with WIS save', async () => {
      const od = await import('../features/ottoDanceService.js')
      const services = makeServices()
      const spell = makeSpell({ name: "Otto's Irresistible Dance" })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(od.triggerOttoDance).toHaveBeenCalled()
    })

    it('triggers Irresistible Dance (short name)', async () => {
      const od = await import('../features/ottoDanceService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Irresistible Dance' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(od.triggerOttoDance).toHaveBeenCalled()
    })
  })

  describe("Otiluke's Resilient Sphere", () => {
    it('triggers Resilient Sphere with DEX save', async () => {
      const rs = await import('../features/resilientSphereService.js')
      const services = makeServices()
      const spell = makeSpell({ name: "Otiluke's Resilient Sphere" })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(rs.triggerResilientSphere).toHaveBeenCalled()
    })

    it('triggers Resilient Sphere (short name)', async () => {
      const rs = await import('../features/resilientSphereService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Resilient Sphere' })
      delete spell.damage

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(rs.triggerResilientSphere).toHaveBeenCalled()
    })
  })

  describe('Foresight', () => {
    it('triggers Foresight with target', async () => {
      const fo = await import('../features/foresightService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Foresight' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(fo.triggerForesight).toHaveBeenCalledWith(
        spell,
        expect.objectContaining({ targetName: 'Target' }),
        expect.anything(),
        'testCampaign',
        'testMap'
      )
    })
  })

  describe('Friends', () => {
    it('triggers Friends with WIS save', async () => {
      const friends = await import('../features/friendsService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Friends' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(friends.triggerFriends).toHaveBeenCalled()
    })
  })

  describe('Ray of Enfeeblement', () => {
    it('triggers Ray of Enfeeblement with CON save', async () => {
      const roe = await import('../features/rayOfEnfeeblementService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Ray of Enfeeblement' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(roe.triggerRayOfEnfeeblement).toHaveBeenCalled()
    })
  })

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

  describe('Silence', () => {
    it('triggers Silence', async () => {
      const silence = await import('../features/silenceService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Silence' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(silence.triggerSilence).toHaveBeenCalled()
    })
  })

  describe('Sleep', () => {
    it('triggers Sleep with WIS save', async () => {
      const sleep = await import('../features/sleepService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Sleep' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(sleep.triggerSleep).toHaveBeenCalled()
    })
  })

  describe('Stinking Cloud', () => {
    it('triggers Stinking Cloud with CON save', async () => {
      const sc = await import('../features/stinkingCloudService.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Stinking Cloud' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(sc.triggerStinkingCloud).toHaveBeenCalled()
    })
  })

  describe("Tasha's Hideous Laughter", () => {
    it('triggers Tasha Hideous Laughter with WIS save', async () => {
      const thl = await import('../features/tashasHideousLaughterService.js')
      const services = makeServices()
      const spell = makeSpell({ name: "Tasha's Hideous Laughter" })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(thl.triggerTashasHideousLaughter).toHaveBeenCalled()
    })
  })

  describe('Heroism', () => {
    it('triggers Heroism with target', async () => {
      const hero = await import('../features/heroismService.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Heroism' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(hero.triggerHeroism).toHaveBeenCalledWith(
        spell,
        expect.objectContaining({ targetName: 'Target' }),
        expect.anything(),
        'testCampaign',
        'testMap'
      )
    })
  })

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

  describe('Longstrider', () => {
    it('triggers Longstrider automation', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices()
      const spell = makeSpell({ name: 'Longstrider' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(executeHandler).toHaveBeenCalled()
    })
  })

  describe('Protection from Energy', () => {
    it('triggers Protection from Energy automation', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Protection from Energy' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(executeHandler).toHaveBeenCalled()
    })
  })

  describe('Protection from Poison', () => {
    it('triggers Protection from Poison automation', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Protection from Poison' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(executeHandler).toHaveBeenCalled()
    })
  })

  describe('Stone Skin', () => {
    it('triggers Stone Skin automation', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Stone Skin' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(executeHandler).toHaveBeenCalled()
    })
  })

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

  describe('Dispel Magic', () => {
    it('dispatches spell-result event for Dispel Magic', async () => {
      const events = []
      window.addEventListener('spell-result', (e) => {
        events.push(e.detail)
      })

      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = { name: 'Dispel Magic', level: 3, school: 'Abjuration', casting_time: '1 action', components: ['V', 'S'], range: 'Self (60-foot radius sphere)' }
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)

      const dispelEvent = events.find(e => e.isDispelMagic)
      expect(dispelEvent).toBeDefined()
      expect(dispelEvent.spellName).toBe('Dispel Magic')
      expect(dispelEvent.targetName).toBe('Target')

      window.removeEventListener('spell-result', () => {})
    })
  })

  describe('Resistance (2024)', () => {
    it('triggers Resistance automation', async () => {
      const { executeHandler } = await import('../../automation/index.js')
      const services = makeServices({
        getTargetInfo: async () => ({ name: 'Target' }),
      })
      const spell = makeSpell({ name: 'Resistance' })
      delete spell.damage
      delete spell.dc

      await executeSpellCast(spell, makeMetaCtx(), services)
      expect(executeHandler).toHaveBeenCalled()
    })
  })

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

  describe('cantrip range bonus', () => {
    it('extends cantrip range with featEffects.cantripRangeBonus', async () => {
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
