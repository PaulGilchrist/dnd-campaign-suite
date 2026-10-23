// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'
import { setCombatSummaryCache } from '../../../encounters/combatData.js'

import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as dice from '../../dice/diceRoller.js'
import * as automation from '../../automation/index.js'
import * as log from '../../ui/logService.js'
import * as silence from '../features/silenceService.js'
import * as buff from '../../combat/buffs/buffService.js'
import * as wms from '../features/wildMagicSurgeService.js'
import * as rider from './postCastRiderService.js'

/* ------------------------------------------------------------------ */
/*  NO-FORMULA MODALS LANE (#1454 split table face)                   */
/*                                                                    */
/*  Identity: hub routing (executeSpellCast → runTriggerChain /       */
/*  runNoDamagePath) for the popup-returning rows of the no-damage    */
/*  chain that have NO damage formula and adjudicate via MODAL:       */
/*   - fear modal ................. DELETED fix#296 (#1473) — see fear describe */
/*   - conjure volley popup ....... index.js:280 → modalSpells.js:211 */
/*   - silence target-selection ... index.js:310 → modalSpells.js:231 */
/*   - silence verbal gate (SP-106) popup + log .. index.js:682-687   */
/*                                                                    */
/*  Three-roster split of the same trigger-chain mechanism (do not    */
/*  cross): this lane owns the automationPopup-returning modal rows;  */
/*  .noformula-services owns the swallow rows (see invisibility →     */
/*  dominate person, triggerSpells services); .noformula-utility owns */
/*  the remaining rows (executeHandler-routed heroism/longstrider/    */
/*  resistance, healing riders, dispel/remove-curse fallbacks). The   */
/*  EARLY chain modals (massSuggestion, calmEmotions, hypnoticPattern */
/*  early, confusion early, shapechange, sleep, power word) are owned */
/*  by execution/earlyReturns-modal.test.js — absent here.            */
/*                                                                    */
/*  envelope honesty: handleGenericAutomation (index.js:710) hijacks  */
/*  any cast payload that still carries automation.type unless the    */
/*  name is in SERVICE_HANDLED_SPELLS (triggerSpells.js:42 — 'fear'  */
/*  'silence' 'conjure volley' are NOT). fix#296 (#1473): the fear    */
/*  modal branch was reachable ONLY with FABRICATED automation-free    */
/*  envelopes — the hub arm is DELETED double-dead, the stripping      */
/*  fixture retired with it, and fear pins now feed REAL disk bytes    */
/*  to the :710 DIRECT-fearHandler hijack (#1455 fabrication ban).     */
/*  Case-gate split (historical on the retired fear row): modalSpells  */
/*  lowercases (survivors modalSpells.js:212/232 volley/silence) while */
/*  the disk lookup stays EXACT-case (index.js:179) — the volley lane   */
/*  below keeps that split observable on REAL producers.                  */
/*  Quirk (non-defect): handleSilence reads spell.area_of_effect,     */
/*  never fullSpell (modalSpells.js:237) — the merged disk AoE never  */
/*  reaches the modal; the fallback constants (range 120 / radius 20) */
/*  coincide with the disk RAW values, so no observable divergence.    */
/*  No-clock policy: modals here are pure payload returns — nothing   */
/*  auto-dismisses; the prompt waits indefinitely per repo mandate.    */
/*                                                                    */
/*  Cited-by: spellCastService.execute.test.js:38/:335 delegates the  */
/*  silence-refuse popup/log payload bytes to THIS lane — the gate    */
/*  describe below keeps that ownership. Zone membership itself is    */
/*  owned by features/silenceService.test.js (#1413 zone lane);       */
/*  save-prompt modal consumption lives in the createRollCondition-    */
/*  SaveHandler lanes (#1389/#1400). CLA-219 metaCtx-heighten          */
/*  coercion (index.js:680) is pinned verbatim on the fear payload.   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — external edges only, real-Promise-shaped (#1440/1449).    */
/*  Feature-services run REAL (triggerSpells/modalSpells/blockChecks/ */
/*  helpers/savePath/noSavePath are never mocked in this lane); the   */
/*  services roster is inert-name-guard isolation matching the        */
/*  sibling rosters. Inert entries (fearService/foresightService/     */
/*  heroismService) and duplicate confusion/maze registrations from    */
/*  the previous version were removed — not in the live import graph. */
/* ------------------------------------------------------------------ */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => []),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => (formula ? { total: 10, rolls: [1, 2, 3, 4], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null)),
  applyHealingRerollOnes: vi.fn(),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

// Feature modules reachable via the trigger chain — inert no-op isolation.
vi.mock('../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))
vi.mock('../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => {}) }))
vi.mock('../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../features/fleshToStoneService.js', () => ({ triggerFleshToStone: vi.fn(async () => {}) }))
vi.mock('../features/holdMonsterService.js', () => ({ triggerHoldMonster: vi.fn(async () => {}) }))
vi.mock('../features/hypnoticPatternService.js', () => ({ triggerHypnoticPattern: vi.fn(async () => {}) }))
vi.mock('../features/massSuggestionService.js', () => ({ triggerMassSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/suggestionService.js', () => ({ triggerSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/ottoDanceService.js', () => ({ triggerOttoDance: vi.fn(async () => {}) }))
vi.mock('../features/resilientSphereService.js', () => ({ triggerResilientSphere: vi.fn(async () => {}) }))
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
  triggerPostCastAllyHeals: vi.fn(async () => null),
}))

/* ------------------------------------------------------------------ */
/*  Test-data factories — REAL disk rows (fabricated shapes banned)   */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign'
const MAP = 'testMap'

function diskRow(name, ruleset = '5e') {
  const table = ruleset === '2024' ? spells2024 : spells5e
  const row = table.find((s) => s.name === name)
  if (!row) throw new Error(`disk fixture missing: ${ruleset} ${name}`)
  return row
}

// Live UI minimal envelope: identity fields only, NO automation, NO
// description, NO area_of_effect — anything else arrives via
// lookupFullSpell's URL-aware fetch merge (index.js:170-189).
function minimalPayload(name, ruleset = '5e') {
  const row = diskRow(name, ruleset)
  return {
    name: row.name,
    level: row.level,
    school: row.school,
    casting_time: row.casting_time,
    components: row.components,
    range: row.range,
    concentration: row.concentration,
  }
}

// fix#296 (#1473): fixture retired. The disk Fear row minus its `automation`
// key was a FABRICATED shape (real disk bytes ship automation.type 'fear' on
// BOTH rulesets) whose only purpose was dodging the :710 hijack to reach the
// :279-era hub modal arm — that arm is now deleted double-dead, so the
// envelope is banned evidence (#1455 precedent). Real-bytes fear lanes
// replace it in the describe below.

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
    level: 10,
    ...overrides,
  }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin1' })),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: MAP,
    characters: [],
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  fetch stub — URL-aware; serves the REAL disk tables, unknown      */
/*  URLs reject loudly (no silent network).                           */
/* ------------------------------------------------------------------ */

let fetchCalls
function jsonResponse(data) {
  return { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) }
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - no-formula modal routing (fear / volley / silence)', () => {
  let consoleError

  beforeEach(() => {
    vi.clearAllMocks()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    runtime.getRuntimeValue.mockImplementation((_key1, key2) =>
      key2 === 'activeConditions' || key2 === 'targetEffects' ? [] : undefined)
    silence.getSilenceSource.mockReturnValue(null)
    silence.isCreatureInSilenceZone.mockReturnValue(false)
    buff.isInnateSorceryActive.mockReturnValue(false)
    fetchCalls = []
    vi.stubGlobal('fetch', vi.fn((url) => {
      fetchCalls.push(url)
      if (url === '/data/spells.json') return Promise.resolve(jsonResponse(spells5e))
      if (url === '/data/2024/spells.json') return Promise.resolve(jsonResponse(spells2024))
      // fix#296 (#1473): the lightweight-fear fall-through now rides the
      // REAL save lane (handleAoE reads the combat-context change-data
      // feed). Serve an EMPTY summary (no combat) honestly instead of
      // tripping the strict-stub noise; the save adjudication itself is
      // savePath-lane-owned and not re-pinned here.
      if (url === '/api/campaigns/test-campaign/change-data') return Promise.resolve(jsonResponse({}))
      return Promise.reject(new Error(`unexpected fetch in noformula-modals lane: ${url}`))
    }))
  })

  afterEach(() => {
    setCombatSummaryCache(null, CAMPAIGN)
    vi.unstubAllGlobals()
    consoleError.mockRestore()
  })

  // ------------------------------------------------------------------
  // Fear — fix#296 (#1473): the :279-era hub arm is DELETED, double-dead
  // vs REAL bytes (leg 1: disk Fear carries automation.type 'fear' BOTH
  // rulesets -> consumed at :710 handleGenericAutomation -> DIRECT
  // fearHandler route, automation/index.js:530; fearService deleted
  // fix#294. leg 2: the only shape surviving :710 — the lightweight :163
  // envelope — carries NO spell.dc, which is exactly what modalSpells
  // .handleFear's gate requires -> declined). The two its that previously
  // lived here fed an automation-STRIPPED / dc-INJECTED disk envelope —
  // a fabricated shape (real disk Fear ships automation) existing only to
  // reach the dead arm; retired per the #1455 fabrication ban, pins
  // FLIPPED to real production bytes below. REPORTED orphan: after this
  // deletion no hub producer emits modalName 'fear' — the route home
  // modalSpells.handleFear and the FearModal consumer key
  // (useSpellCastExecutor.js:125 fear:'fearModal') stay byte-stable per
  // owner constraint, flagged for component-owner retirement.
  // ------------------------------------------------------------------
  describe('fear — direct generic route (hub arm deleted fix#296, #1473 flip)', () => {
    for (const rules of ['5e', '2024']) {
      it(`${rules} disk bytes Fear is consumed at :710 and dispatched DIRECT to fearHandler via executeHandler — the hub emits NO fear modal ever`, async () => {
        const services = makeServices({ playerStats: makePlayerStats({ rules }) })
        const disk = { ...diskRow('Fear', rules) }

        const result = await executeSpellCast(disk, { slotLevel: 3 }, services)

        // :710 hijack census — the live fear route (fix#294 direct law).
        expect(automation.executeHandler).toHaveBeenCalledTimes(1)
        const [action, statsArg, campArg, mapArg] = automation.executeHandler.mock.calls[0]
        expect(action.name).toBe('Fear')
        expect(action.automation).toStrictEqual(diskRow('Fear', rules).automation)
        expect(action.spell).toBe(disk)
        expect(statsArg).toBe(services.playerStats)
        expect(campArg).toBe(CAMPAIGN)
        expect(mapArg).toBe(MAP)
        // Consumed-and-merged: executeHandler mocked inert => lane value
        // undefined; surge mocked inert => merged result undefined. The
        // deleted arm's 'fear' modal NEVER appears.
        expect(result).toBeUndefined()
        expect(result?.automationPopup?.modalName).not.toBe('fear')
        // Cast log ran once BEFORE the hijack, carrying the disk bytes.
        expect(log.addEntry).toHaveBeenCalledTimes(1)
        const entry = { ...log.addEntry.mock.calls[0][1], timestamp: undefined }
        expect(entry.type).toBe('spell')
        expect(entry.characterName).toBe('TestWizard')
        expect(entry.targetName).toBe('Goblin1')
        expect(entry.spellName).toBe('Fear')
        expect(entry.saveDC).toBe(17)
        // CLA-389 merge: post-payment riders run exactly once on the
        // generic-consumed cast (the rider-save seam the old lane pinned
        // on the dead modal — ownership survives on the live route).
        expect(rider.triggerPostCastRiderSaves).toHaveBeenCalledTimes(1)
        // automation.type set + effects absent -> lookup ran (needsLookup).
        expect(fetchCalls).toStrictEqual([rules === '2024' ? '/data/2024/spells.json' : '/data/spells.json'])
        expect(services.rollDamage).not.toHaveBeenCalled()
        expect(services.rollAttack).not.toHaveBeenCalled()
        expect(consoleError).toHaveBeenCalledTimes(0)
      })
    }

    it('a Wild Magic Surge popup SURFACES on the generic-consumed Fear cast — with the fear arm gone there is no lane popup competing (CLA-389 precedence on the :710 route)', async () => {
      const SURGE = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Wild Magic Surge', description: 'surge' } } }
      wms.triggerWildMagicSurge.mockResolvedValueOnce(SURGE)
      const services = makeServices()

      const result = await executeSpellCast({ ...diskRow('Fear') }, { slotLevel: 3 }, services)

      expect(automation.executeHandler).toHaveBeenCalledTimes(1)
      expect(result).toStrictEqual(SURGE)
    })

    it('lightweight :163 Fear ({name, level, baseLevel}) — no spell.dc, no automation: :710 declines, the deleted arm never dispatches, adjudication rides the merged-dc lane, never a fear modal', async () => {
      const services = makeServices()

      const result = await executeSpellCast({ name: 'Fear', level: 3, baseLevel: 0 }, {}, services)

      expect(automation.executeHandler).not.toHaveBeenCalled() // envelope carries no automation
      const popup = result?.automationPopup || result
      expect(popup?.modalName).not.toBe('fear') // the deleted arm is the ONLY former 'fear'-modal producer
      expect(consoleError).toHaveBeenCalledTimes(0) // exact-case disk hit; merged bytes stay silent
    })
  })

  // ------------------------------------------------------------------
  // Conjure Volley — 2024-only disk spell (ABSENT from 5e spells.json);
  // minimal envelope forces the URL-aware fetch merge so the popup
  // description is REAL disk bytes, not '' from a silently-failed fetch.
  // ------------------------------------------------------------------
  describe('conjure volley info popup', () => {
    it('transports the merged 2024 disk description bytes into the exact automation_info popup and casts with zero rolls', async () => {
      const diskVolley = diskRow('Conjure Volley', '2024')
      const services = makeServices({ playerStats: makePlayerStats({ rules: '2024' }) })

      const result = await executeSpellCast(minimalPayload('Conjure Volley', '2024'), { slotLevel: 5 }, services)

      expect(result).toStrictEqual({
        automationPopup: {
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Conjure Volley',
            description: diskVolley.description.join(' '),
          },
        },
      })
      // rules==='2024' selects the 2024 data path exactly once (index.js:175).
      expect(fetchCalls).toStrictEqual(['/data/2024/spells.json'])
      expect(log.addEntry).toHaveBeenCalledTimes(1)
      const entry = { ...log.addEntry.mock.calls[0][1], timestamp: undefined }
      expect(entry).toStrictEqual({
        type: 'spell',
        characterName: 'TestWizard',
        targetName: 'Goblin1',
        spellName: 'Conjure Volley',
        spellLevel: 5,
        castingTime: 'Action',
        damageType: null,
        damageFormula: null,
        saveDC: null,
        concentration: false,
        description: diskVolley.description.join(' '),
        timestamp: undefined,
      })
      expect(automation.executeHandler).not.toHaveBeenCalled()
      expect(services.rollDamage).not.toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Silence — target-selection modal (zone membership itself lives in
  // features/silenceService.test.js, #1413 zone lane).
  // ------------------------------------------------------------------
  describe('silence target-selection modal', () => {
    it('assembles the exact silenceTargetSelection payload: snapshot creatureTargets players-first, metaCtx.slotLevel beats the disk level 2, and parsed range/aoe fall back to the disk-coincident constants', async () => {
      setCombatSummaryCache({ players: [{ name: 'TestWizard' }], creatures: [{ name: 'Goblin1' }, { name: 'Ogre' }] }, CAMPAIGN)
      const services = makeServices()

      const result = await executeSpellCast(minimalPayload('Silence'), { slotLevel: 3 }, services)

      expect(result).toStrictEqual({
        automationPopup: {
          type: 'modal',
          modalName: 'silenceTargetSelection',
          payload: {
            action: { name: 'Silence', automation: { type: 'silence', aoeRadius: 20, range: 120 } },
            playerStats: services.playerStats,
            campaignName: CAMPAIGN,
            aoeRadius: 20,
            slotLevel: 3,
            activeOverlay: null,
            creatureTargets: [
              { name: 'TestWizard', type: 'player' },
              { name: 'Goblin1', type: 'creature' },
              { name: 'Ogre', type: 'creature' },
            ],
          },
        },
      })
      // The disk row (5e level 2) merged for the cast log; payload uses
      // the paid slot. fullSpell AoE is deliberately unused (quirk noted
      // in the header — fallback radius constant coincides with disk 20).
      expect(fetchCalls).toStrictEqual(['/data/spells.json'])
      const entry = { ...log.addEntry.mock.calls[0][1], timestamp: undefined }
      expect(entry).toStrictEqual({
        type: 'spell',
        characterName: 'TestWizard',
        targetName: 'Goblin1',
        spellName: 'Silence',
        spellLevel: 2,
        castingTime: '1 action',
        damageType: null,
        damageFormula: null,
        saveDC: null,
        concentration: true,
        description: diskRow('Silence').description.join(' '),
        timestamp: undefined,
      })
      expect(log.addEntry).toHaveBeenCalledTimes(1)
      expect(automation.executeHandler).not.toHaveBeenCalled()
    })
  })

  // ------------------------------------------------------------------
  // Silence verbal-component gate (SP-106) — popup + log payload bytes
  // owned by THIS lane per spellCastService.execute.test.js:38/:335;
  // that lane keeps the gate-ORDER pin. Cantrip-level refusal here:
  // slotLevel 0 with the REAL disk damage bytes still present proves
  // the gate (index.js:682) fires before lookup, logging and dice.
  // ------------------------------------------------------------------
  describe('silence verbal-component gate (SP-106)', () => {
    it('refuses a Verbal cantrip cast by a silenced caster with the exact refusal popup and refusal log, before any lookup or dice', async () => {
      silence.getSilenceSource.mockReturnValue('SilenceCaster')
      silence.isCreatureInSilenceZone.mockReturnValue(true)
      const services = makeServices()
      const sacredFlame = { ...minimalPayload('Sacred Flame'), damage: diskRow('Sacred Flame').damage, dc: diskRow('Sacred Flame').dc }

      const result = await executeSpellCast(sacredFlame, { slotLevel: 0 }, services)

      expect(result).toStrictEqual({
        automationPopup: {
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Silence',
            description: 'Sacred Flame cannot be cast — TestWizard is inside a Silence zone and Verbal spell components are impossible there.',
          },
        },
      })
      expect(silence.getSilenceSource).toHaveBeenCalledTimes(1)
      expect(silence.getSilenceSource).toHaveBeenCalledWith('TestWizard', CAMPAIGN)
      expect(silence.isCreatureInSilenceZone).toHaveBeenCalledWith('TestWizard', 'SilenceCaster', CAMPAIGN)
      expect(log.addEntry).toHaveBeenCalledTimes(1)
      const [logCampaign, entry] = log.addEntry.mock.calls[0]
      expect(logCampaign).toBe(CAMPAIGN)
      expect({ ...entry, timestamp: undefined }).toStrictEqual({
        type: 'automation',
        creatureName: 'TestWizard',
        name: 'Silence',
        description: 'Sacred Flame blocked — TestWizard is inside SilenceCaster\'s Silence zone; Verbal components are impossible there.',
        timestamp: undefined,
      })
      expect(typeof entry.timestamp).toBe('number')
      expect(services.rollDamage).not.toHaveBeenCalled()
      expect(services.rollAttack).not.toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
      expect(fetchCalls).toStrictEqual([])
    })

    it('never consults the silence zone for a Non-Verbal disk cantrip inside the zone and completes the cast as a plain zero-roll spell log', async () => {
      silence.getSilenceSource.mockReturnValue('SilenceCaster')
      silence.isCreatureInSilenceZone.mockReturnValue(true)
      const services = makeServices()

      const result = await executeSpellCast(minimalPayload('Minor Illusion'), { slotLevel: 0 }, services)

      // components guard (index.js:135) runs BEFORE the zone lookup.
      expect(silence.getSilenceSource).not.toHaveBeenCalled()
      expect(silence.isCreatureInSilenceZone).not.toHaveBeenCalled()
      expect(result).toBeNull()
      expect(log.addEntry).toHaveBeenCalledTimes(1)
      const entry = { ...log.addEntry.mock.calls[0][1], timestamp: undefined }
      expect(entry).toStrictEqual({
        type: 'spell',
        characterName: 'TestWizard',
        targetName: 'Goblin1',
        spellName: 'Minor Illusion',
        spellLevel: 0,
        castingTime: '1 action',
        damageType: null,
        damageFormula: null,
        saveDC: null,
        concentration: false,
        description: diskRow('Minor Illusion').description.join(' '),
        timestamp: undefined,
      })
      expect(services.rollDamage).not.toHaveBeenCalled()
      expect(services.rollAttack).not.toHaveBeenCalled()
      expect(dice.rollExpression).not.toHaveBeenCalled()
    })
  })
})
