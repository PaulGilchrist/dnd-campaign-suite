// @maintained-by-ai
// AoE-heal special lane: hub (execution/index.js) routing of the SPECIAL healing
// spells through the mass-healing trigger chain at :328-332, adopted per #1459
// (orphan pins created by the mandated heal-fold; #1462 master keeps the
// assignments WITHOUT these spans). Span owners adopted here with disk-faithful
// 5e rows (public/data/spells.json):
//   :329 handleMassCureWoundsTrigger -> triggerSpells.js:413 forwarder  (#1384 producer)
//   :330 handleMassHealingWordTrigger -> triggerSpells.js:421            (#1385 producer)
//   :331 handlePrayerOfHealingTrigger -> triggerSpells.js:429           (#1393/#1394 producer)
//   :332 handleFalseLifeTrigger -> triggerSpells.js:437                   (#1361 forwarder, marker incident canonical)
// Special-vs-hub boundary: the four name guards (:413-443) are LOWERCASE-GATED
// name checks that FORWARD (producer-vs-forwarder #1335) — the hub never rolls a
// single die for these spells even though Mass Cure Wounds / False Life carry
// heal_at_slot_level ladders on disk (#1384 diverge-ladder 3d8-vs-5d8 warning);
// adjudication lives in the feature services. A generic heal row (Cure Wounds)
// misses every guard and falls through to runGenericHealPath (:337) where the
// hub IS the producer — pinned as the boundary contrast.
// #710 hijack census (this lane's four names): Mass Healing Word and Prayer of
// Healing disk rows carry automation.type without effects, so handleGenericAutomation
// (:710) consumes them via executeHandler BEFORE :330/:331 can ever run — those two
// chain spans are UNREACHABLE for disk-clean rows (structural dead code, reported).
// Mass Cure Wounds and False Life carry no automation key — clean, pinned live.
// CLA-389 (:718-720): a handled swallow-lane still runs post-cast triggers —
// forward-before-merge order pinned once, here, for the heal chain.
// Swallow contract (:334 + :75): hub returns undefined (bare `return;` era parity).
// NO-CLOCK: heals are instantaneous; no timers here (duration clocks live inside
// the producer services). HP-key census: currentHitPoints #1367 read ONLY on the
// generic hub-producer boundary, never by the forwarders.
// Fetch is URL-aware (#1454-62): lookupFullSpell (:170) skips lookup for rows
// carrying area_of_effect; URL chosen by playerStats.rules (:175).
// Caller-lane citations from sibling service tests (old->new mock-line map,
// shifted +37 by this header): globeOfInvulnerabilityService.test.js:31 cited
// :99 -> now :136; powerWordStunService.test.js:9 cited :109 -> now :146;
// imprisonmentService.test.js:9 cited :117 -> now :154; massCureWoundsService
// .test.js:12 cited :123 -> now :160. Mock block order preserved unchanged.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { executeSpellCast } from '../../spellCastService.js'
import * as applyHealing from '../../../combat/applyHealing.js'
import * as damageUtils from '../../../combat/damageUtils.js'
import * as runtime from '../../../../../hooks/runtime/useRuntimeState.js'

/* ------------------------------------------------------------------ */
/*  Mocks — internal collaborators; triggerSpells.js name guards and  */
/*  damageCalculation.js riders stay REAL (they are the pinned bytes) */
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
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })), applyHealingRerollOnes: vi.fn((rolls) => ({ displayRolls: rolls, originalRolls: rolls })),
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

vi.mock('../../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(async () => null),
  loadCombatSummary: vi.fn(),
}))

/* ------------------------------------------------------------------ */
/*  Fixtures — disk-faithful 5e rows from public/data/spells.json    */
/* ------------------------------------------------------------------ */

const MASS_CURE_WOUNDS = {
  index: 'mass-cure-wounds',
  name: 'Mass Cure Wounds',
  description: [
    'A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point. Each target regains hit points equal to 3d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  ],
  higher_level: [
    'When you cast this spell using a spell slot of 6th level or higher, the healing increases by 1d8 for each slot level above 5th.',
  ],
  range: '60 feet',
  components: ['V', 'S'],
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  level: 5,
  attack_type: 'ranged',
  heal_at_slot_level: { 5: '3d8 + MOD', 6: '4d8 + MOD', 7: '5d8 + MOD', 8: '6d8 + MOD', 9: '7d8 + MOD' },
  area_of_effect: { type: 'sphere', size: 30 },
  school: 'Conjuration',
  classes: ['Bard', 'Cleric', 'Druid'],
  subclasses: ['Life'],
}

const MASS_HEALING_WORD = {
  index: 'mass-healing-word',
  name: 'Mass Healing Word',
  description: [
    'As you call out words of restoration, up to six creatures of your choice that you can see within range regain hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  ],
  higher_level: [
    'When you cast this spell using a spell slot of 4th level or higher, the healing increases by 1d4 for each slot level above 3rd.',
  ],
  range: '60 feet',
  components: ['V'],
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 bonus action',
  level: 3,
  heal_at_slot_level: { 3: '1d4 + MOD', 4: '2d4 + MOD', 5: '3d4 + MOD', 6: '4d4 + MOD', 7: '5d4 + MOD', 8: '6d4 + MOD', 9: '7d4 + MOD' },
  school: 'Evocation',
  classes: ['Cleric'],
  subclasses: ['Lore'],
  automation: { type: 'mass_healing_word', action: 'bonus_action', casting_time: '1 bonus action', maxTargets: 6 },
}

const PRAYER_OF_HEALING = {
  index: 'prayer-of-healing',
  name: 'Prayer of Healing',
  description: [
    'Up to six creatures of your choice that you can see within range each regain hit points equal to 2d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  ],
  higher_level: [
    'When you cast this spell using a spell slot of 3rd level or higher, the healing increases by 1d8 for each slot level above 2nd.',
  ],
  range: '30 feet',
  components: ['V'],
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '10 minutes',
  level: 2,
  heal_at_slot_level: { 2: '2d8 + MOD', 3: '3d8 + MOD', 4: '4d8 + MOD', 5: '5d8 + MOD', 6: '6d8 + MOD', 7: '7d8 + MOD', 8: '8d8 + MOD', 9: '9d8 + MOD' },
  school: 'Evocation',
  classes: ['Cleric'],
  subclasses: ['Lore'],
  automation: { type: 'prayer_of_healing' },
}

const FALSE_LIFE = {
  index: 'false-life',
  name: 'False Life',
  description: [
    'Bolstering yourself with a necromantic facsimile of life, you gain 1d4 + 4 temporary hit points for the duration.',
  ],
  higher_level: [
    'When you cast this spell using a spell slot of 2nd level or higher, you gain 5 additional temporary hit points for each slot level above 1st.',
  ],
  range: 'Self',
  components: ['V', 'S', 'M'],
  material: 'A small amount of alcohol or distilled spirits.',
  ritual: false,
  duration: '1 hour',
  concentration: false,
  casting_time: '1 action',
  level: 1,
  heal_at_slot_level: { 1: '1d4 + 4', 2: '1d4 + 9', 3: '1d4 + 14', 4: '1d4 + 19', 5: '1d4 + 24', 6: '1d4 + 29', 7: '1d4 + 34', 8: '1d4 + 39', 9: '1d4 + 44' },
  school: 'Necromancy',
  classes: ['Sorcerer', 'Wizard'],
  subclasses: ['Lore'],
}

const CURE_WOUNDS = {
  index: 'cure-wounds',
  name: 'Cure Wounds',
  description: [
    'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
  ],
  higher_level: [
    'When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.',
  ],
  range: 'Touch',
  components: ['V', 'S'],
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  level: 1,
  heal_at_slot_level: { 1: '1d8 + MOD', 2: '2d8 + MOD', 3: '3d8 + MOD', 4: '4d8 + MOD', 5: '5d8 + MOD', 6: '6d8 + MOD', 7: '6d8 + MOD', 8: '8d8 + MOD', 9: '9d8 + MOD' },
  school: 'Evocation',
  classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger'],
  subclasses: ['Lore', 'Life'],
}

const SACRED_FLAME = {
  index: 'sacred-flame',
  name: 'Sacred Flame',
  description: [
    "Flame-like radiance descends on a creature that you can see within range. The target must succeed on a dexterity saving throw or take 1d8 radiant damage. The target gains no benefit from cover for this saving throw.",
  ],
  higher_level: [
    "The spell's damage increases by 1d8 when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).",
  ],
  range: '60 feet',
  components: ['V', 'S'],
  ritual: false,
  duration: 'Instantaneous',
  concentration: false,
  casting_time: '1 action',
  level: 0,
  attack_type: 'ranged',
  damage: { damage_type: 'Radiant', damage_at_character_level: { 1: '1d8', 5: '2d8', 11: '3d8', 17: '4d8' } },
  dc: { dc_type: 'DEX', dc_success: 'none' },
  school: 'Evocation',
  classes: ['Cleric'],
  subclasses: ['Lore'],
}

const HEAT_METAL = {
  index: 'heat-metal',
  name: 'Heat Metal',
  description: [
    'Choose a manufactured metal object, such as a metal weapon or a suit of heavy or medium metal armor, that you can see within range. You cause the object to glow red-hot. Any creature in physical contact with the object takes 2d8 fire damage when you cast the spell. Until the spell ends, you can use a bonus action on each of your subsequent turns to cause this damage again.<br/><br/>If a creature is holding or wearing the object and takes the damage from it, the creature must succeed on a constitution saving throw or drop the object if it can. If it does not drop the object, it has disadvantage on attack rolls and ability checks until the start of your next turn.',
  ],
  higher_level: [
    'When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.',
  ],
  range: '60 feet',
  components: ['V', 'S', 'M'],
  material: 'A piece of iron and a flame.',
  ritual: false,
  duration: 'Up to 1 minute',
  concentration: true,
  casting_time: '1 action',
  level: 2,
  damage: { damage_type: 'Fire', damage_at_slot_level: { 2: '2d8', 3: '3d8', 4: '4d8', 5: '5d8', 6: '6d8', 7: '7d8', 8: '8d8', 9: '9d8' } },
  dc: { dc_type: 'CON', dc_success: 'other', description: 'Can choose to not drop the object' },
  school: 'Transmutation',
  classes: ['Bard', 'Druid'],
  subclasses: ['Lore'],
}

const DISK_5E_SPELLS = [MASS_CURE_WOUNDS, MASS_HEALING_WORD, PRAYER_OF_HEALING, FALSE_LIFE, CURE_WOUNDS, SACRED_FLAME, HEAT_METAL]

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

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
    attackerPos: null, targetPos: null,
    featEffects: {},
    campaignName: 'test-campaign',
    mapName: 'test-map',
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Suite — AoE-heal special chain + carried riders                    */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — AoE-heal special chain (index.js :328-332, #1459) and riders', () => {
  let fetchStub

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
    // URL-aware fetch (#1454-62): serve the 5e disk rows, empty 2024 list.
    fetchStub = vi.fn(async (url) => {
      if (url === '/data/spells.json') return { ok: true, status: 200, json: async () => DISK_5E_SPELLS }
      if (url === '/data/2024/spells.json') return { ok: true, status: 200, json: async () => [] }
      throw new Error(`unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const hpReads = () => runtime.getRuntimeValue.mock.calls.filter(c => c[1] === 'hitPoints' || c[1] === 'currentHitPoints')

  // ------------------------------------------------------------------
  // :328-332 forwarder contract — disk-clean rows, hub rolls nothing
  // ------------------------------------------------------------------
  describe('mass-healing trigger chain — forwarders never produce', () => {
    it('routes disk Mass Cure Wounds (:329) to triggerMassCureWounds with the exact tuple, swallows the return, and rolls nothing at the hub (#1384 producer owns the dice)', async () => {
      const massCW = await import('../../../features/massCureWoundsService.js')
      const massHW = await import('../../../features/massHealingWordService.js')
      const poh = await import('../../../features/prayerOfHealingService.js')
      const falseLife = await import('../../../features/falseLifeService.js')
      const dice = await import('../../../../dice/diceRoller.js')
      const wildMagic = await import('../../../features/wildMagicSurgeService.js')
      const rider = await import('../../postCastRiderService.js')

      const services = makeServices()
      const metaCtx = { slotLevel: 5 }

      const result = await executeSpellCast({ ...MASS_CURE_WOUNDS }, metaCtx, services)

      expect(massCW.triggerMassCureWounds).toHaveBeenCalledTimes(1)
      const [spellArg, ctxArg, statsArg, campaignArg, mapArg] = massCW.triggerMassCureWounds.mock.calls[0]
      expect(spellArg.name).toBe('Mass Cure Wounds')
      expect(ctxArg).toEqual({ slotLevel: 5, metamagicHeighten: false })
      expect(statsArg).toBe(services.playerStats)
      expect(campaignArg).toBe('test-campaign')
      expect(mapArg).toBe('test-map')
      // Chain short-circuits: later members stay untouched on a name match.
      expect(massHW.triggerMassHealingWord).not.toHaveBeenCalled()
      expect(poh.triggerPrayerOfHealing).not.toHaveBeenCalled()
      expect(falseLife.triggerFalseLife).not.toHaveBeenCalled()
      // Forwarder-vs-producer (#1335): the hub never rolls, never heals directly,
      // and never reads HP keys even though the disk row carries heal_at_slot_level.
      expect(dice.rollExpression).not.toHaveBeenCalled()
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()
      expect(hpReads()).toEqual([])
      // Swallow contract (:334 + :75): handled early return carries undefined.
      expect(result).toBeUndefined()
      // CLA-389 (:718-720): the swallowed lane still pays post-cast triggers, after the forward.
      expect(rider.triggerPostCastRiderSaves).toHaveBeenCalledTimes(1)
      expect(wildMagic.triggerWildMagicSurge).toHaveBeenCalledTimes(1)
      expect(massCW.triggerMassCureWounds.mock.invocationCallOrder[0])
        .toBeLessThan(wildMagic.triggerWildMagicSurge.mock.invocationCallOrder[0])
    })

    it('routes disk False Life (:332) to triggerFalseLife only — the temp-HP ladder is never rolled at the hub (#1361 forwarder)', async () => {
      const falseLife = await import('../../../features/falseLifeService.js')
      const massCW = await import('../../../features/massCureWoundsService.js')
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices()

      const result = await executeSpellCast({ ...FALSE_LIFE }, { slotLevel: 1 }, services)

      expect(falseLife.triggerFalseLife).toHaveBeenCalledTimes(1)
      const [spellArg, ctxArg, statsArg, campaignArg, mapArg] = falseLife.triggerFalseLife.mock.calls[0]
      expect(spellArg.name).toBe('False Life')
      expect(ctxArg).toEqual({ slotLevel: 1, metamagicHeighten: false })
      expect(statsArg).toBe(services.playerStats)
      expect(campaignArg).toBe('test-campaign')
      expect(mapArg).toBe('test-map')
      expect(massCW.triggerMassCureWounds).not.toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
      expect(hpReads()).toEqual([])
      expect(result).toBeUndefined()
    })

    it('lowercases the name guard (:414) — "MASS CURE WOUNDS" in any case still routes through :329', async () => {
      const massCW = await import('../../../features/massCureWoundsService.js')

      const services = makeServices()
      const upper = { ...MASS_CURE_WOUNDS, name: 'MASS CURE WOUNDS' }

      const result = await executeSpellCast(upper, { slotLevel: 5 }, services)

      expect(massCW.triggerMassCureWounds).toHaveBeenCalledTimes(1)
      expect(massCW.triggerMassCureWounds.mock.calls[0][0]).toBe(upper)
      expect(result).toBeUndefined()
    })

    it('#710 hijack census: disk Mass Healing Word and Prayer of Healing rows carry automation.type and are consumed by handleGenericAutomation BEFORE :330/:331 — the feature triggers never run and the hub rolls no dice', async () => {
      const { executeHandler } = await import('../../../../automation/index.js')
      const massHW = await import('../../../features/massHealingWordService.js')
      const poh = await import('../../../features/prayerOfHealingService.js')
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices()

      const mHW = { ...MASS_HEALING_WORD }
      const r1 = await executeSpellCast(mHW, { slotLevel: 3 }, services)

      expect(executeHandler).toHaveBeenCalledTimes(1)
      expect(executeHandler.mock.calls[0][0].automation).toBe(mHW.automation)
      expect(executeHandler.mock.calls[0][0].spell).toBe(mHW)
      expect(massHW.triggerMassHealingWord).not.toHaveBeenCalled()

      vi.clearAllMocks()
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)

      const pOH = { ...PRAYER_OF_HEALING }
      const r2 = await executeSpellCast(pOH, { slotLevel: 2 }, services)

      expect(executeHandler).toHaveBeenCalledTimes(1)
      expect(executeHandler.mock.calls[0][0].automation).toBe(pOH.automation)
      expect(poh.triggerPrayerOfHealing).not.toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
      expect(r1).toBeUndefined()
      expect(r2).toBeUndefined()
    })
  })

  // ------------------------------------------------------------------
  // Special-vs-hub boundary: a generic heal row misses every guard
  // ------------------------------------------------------------------
  describe('boundary — generic heal rows reach runGenericHealPath (:337)', () => {
    it('Cure Wounds misses all four name guards and the hub PRODUCES the heal: rolls the MOD-folded expression once and returns the full generic result (#1455 compute-vs-forward)', async () => {
      const massCW = await import('../../../features/massCureWoundsService.js')
      const massHW = await import('../../../features/massHealingWordService.js')
      const poh = await import('../../../features/prayerOfHealingService.js')
      const falseLife = await import('../../../features/falseLifeService.js')
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices()

      const result = await executeSpellCast({ ...CURE_WOUNDS }, { slotLevel: 1 }, services)

      expect(massCW.triggerMassCureWounds).not.toHaveBeenCalled()
      expect(massHW.triggerMassHealingWord).not.toHaveBeenCalled()
      expect(poh.triggerPrayerOfHealing).not.toHaveBeenCalled()
      expect(falseLife.triggerFalseLife).not.toHaveBeenCalled()

      // '1d8 + MOD' folds the caster's +5 INT modifier at :406.
      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpression.mock.calls[0][0]).toBe('1d8 + 5')

      // HP census #1367: currentHitPoints is read on this generic lane (maxHp 100,
      // currentHp 30 -> actualHeal = min(10, 70) = 10).
      expect(hpReads().map(c => c[1])).toEqual(['hitPoints', 'currentHitPoints'])

      // Combat-summary forwarding lives downstream of the hub roll.
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled()

      expect(result).toEqual({
        targetName: 'Goblin',
        healAmount: 10,
        formula: '1d8 + 5',
        rolls: [1, 2, 3, 4],
        rawTotal: 10,
        bonusHeal: 0,
        bonusDetails: [],
        healingRerollOriginalRolls: null,
        healingRerollDisplayRolls: [1, 2, 3, 4],
      })
    })
  })

  // ------------------------------------------------------------------
  // lookupFullSpell (:170) — URL-aware, skip-on-AoE, graceful on reject
  // ------------------------------------------------------------------
  describe('spell lookup (:170)', () => {
    it('skips lookup for rows carrying area_of_effect and picks the URL by ruleset (:175)', async () => {
      // Mass Cure Wounds disk row has area_of_effect -> no fetch at all.
      await executeSpellCast({ ...MASS_CURE_WOUNDS }, { slotLevel: 5 }, makeServices())
      expect(fetchStub).not.toHaveBeenCalled()

      // False Life has no area_of_effect -> 5e URL exactly once.
      await executeSpellCast({ ...FALSE_LIFE }, { slotLevel: 1 }, makeServices())
      expect(fetchStub.mock.calls.map(c => c[0])).toEqual(['/data/spells.json'])

      // Same spell, 2024 caster -> 2024 URL.
      const caster2024 = makeServices({ playerStats: makePlayerStats({ rules: '2024' }) })
      await executeSpellCast({ ...FALSE_LIFE }, { slotLevel: 1 }, caster2024)
      expect(fetchStub.mock.calls.map(c => c[0])).toEqual(['/data/spells.json', '/data/2024/spells.json'])
    })

    it('logs the exact lookup-failure line and still forwards the cast when fetch rejects', async () => {
      const falseLife = await import('../../../features/falseLifeService.js')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const boom = new Error('network down')
      fetchStub.mockRejectedValue(boom)

      const services = makeServices()
      await executeSpellCast({ ...FALSE_LIFE }, { slotLevel: 1 }, services)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[spellCast] Failed to look up full spell data for:',
        'False Life',
        boom,
      )
      expect(falseLife.triggerFalseLife).toHaveBeenCalledTimes(1)
      expect(falseLife.triggerFalseLife.mock.calls[0][0].name).toBe('False Life')
    })
  })

  // ------------------------------------------------------------------
  // Damage-formula riders wired at the hub (:735-742) — lane-residual
  // unique coverage (no damageCalculation module lane exists for these)
  // ------------------------------------------------------------------
  describe('damage-formula rider wiring (:735-742)', () => {
    it('Blessed Strikes folds the WIS modifier onto the save cantrip formula exactly once', async () => {
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [],
            actions: [{ type: 'damage_bonus', name: 'Blessed Strikes', options: ['Spellcasting'] }],
          },
          abilities: [{ name: 'Intelligence', bonus: 5 }, { name: 'Wisdom', bonus: 3 }],
        }),
      })

      await executeSpellCast({ ...SACRED_FLAME }, { slotLevel: 0 }, services)

      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpression.mock.calls[0][0]).toBe('1d8 + 3 [Blessed Strikes]')
      expect(services.rollDamage.mock.calls[0][0].formula).toBe('1d8 + 3 [Blessed Strikes]')
    })

    it('Radiant Soul folds the CHA modifier onto a Radiant save spell exactly once', async () => {
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: {
            passives: [{ type: 'radiant_soul', hasAutomation: true, damageTypes: ['Radiant'] }],
          },
          abilities: [{ name: 'Intelligence', bonus: 5 }, { name: 'Charisma', bonus: 4 }],
        }),
      })

      await executeSpellCast({ ...SACRED_FLAME }, { slotLevel: 0 }, services)

      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpression.mock.calls[0][0]).toBe('1d8 + 4 [Radiant Soul]')
      expect(services.rollDamage.mock.calls[0][0].formula).toBe('1d8 + 4 [Radiant Soul]')
    })

    it('Overchannel at slot 2 maximizes the formula and stamps the use-count once (:742, damageCalculation.js:116-124)', async () => {
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: [{ type: 'overchannel' }] },
        }),
      })

      await executeSpellCast({ ...HEAT_METAL }, { slotLevel: 2, overchannel: true }, services)

      expect(dice.rollExpressionMaximized).toHaveBeenCalledTimes(1)
      expect(dice.rollExpressionMaximized.mock.calls[0][0]).toBe('2d8 [Overchannel Maximize]')
      expect(dice.rollExpression).not.toHaveBeenCalled()
      expect(runtime.setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'Overchannel_useCount', 1, 'test-campaign')
      expect(services.rollDamage.mock.calls[0][0].formula).toBe('2d8 [Overchannel Maximize]')
      expect(services.rollDamage.mock.calls[0][0].total).toBe(24)
    })

    it('Overchannel above slot 5 stays inactive — plain roll, no use-count write', async () => {
      const dice = await import('../../../../dice/diceRoller.js')

      const services = makeServices({
        playerStats: makePlayerStats({
          automation: { passives: [{ type: 'overchannel' }] },
        }),
      })

      await executeSpellCast({ ...HEAT_METAL }, { slotLevel: 7, overchannel: true }, services)

      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpression.mock.calls[0][0]).toBe('2d8')
      expect(runtime.setRuntimeValue.mock.calls.filter(c => c[1] === 'Overchannel_useCount')).toEqual([])
    })
  })

  // ------------------------------------------------------------------
  // Psychic Spells component reduction (:159-167, applied :686)
  // ------------------------------------------------------------------
  describe('Psychic Spells component reduction (:159-167)', () => {
    it('strips reduced components from matching schools only — Enchantment emptied, Evocation control untouched', async () => {
      const psychicPassive = {
        name: 'Psychic Spells',
        type: 'psychic_spells',
        spellSchools: ['enchantment', 'illusion'],
        componentReduction: ['V', 'S'],
      }
      const services = makeServices({
        playerStats: makePlayerStats({ automation: { passives: [psychicPassive] } }),
      })

      const enchant = { ...SACRED_FLAME, name: 'Charm Person', index: 'charm-person', school: 'Enchantment', components: ['V', 'S'], damage: undefined, dc: undefined, level: 1 }
      await executeSpellCast(enchant, { slotLevel: 1 }, services)
      expect(enchant.components).toEqual([])

      const control = { ...CURE_WOUNDS, components: ['V', 'S'] }
      await executeSpellCast(control, { slotLevel: 1 }, services)
      expect(control.components).toEqual(['V', 'S'])
    })
  })
})
