// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'

/* ------------------------------------------------------------------ */
/*  NO-FORMULA SERVICES LANE (#1457 three-roster split face)          */
/*                                                                    */
/*  Identity: hub routing (executeSpellCast -> runNoDamagePath) for   */
/*  the swallow rows of the no-damage chain that route to a feature   */
/*  SERVICE, verbatim span per #1457: "see invisibility -> dominate   */
/*  person, triggerSpells services" (index.js:281-305). Modals are   */
/*  .noformula-modals (#1457); utility remainder is                  */
/*  .noformula-utility. This lane verifies ROUTING ONLY — which       */
/*  service fires with which exact bytes and whether the hub           */
/*  consumes or discards its return. Service internals are owned in   */
/*  features/ lanes (#1412 seeInvisibility, #1417 slow, #1374          */
/*  holdMonster, #1354-56 dominate x3, etc.) — not here.              */
/*                                                                    */
/*  Swallow semantics (#1404): passThrough forwards the service       */
/*  return as { automationPopup } (index.js:74); swallow DISCARDS it  */
/*  — handled:true drops the payload (index.js:75). Every row here   */
/*  is pinned with a sentinel popup from its mock so consume-vs-      */
/*  discard is observable per row, not assumed.                       */
/*                                                                    */
/*  Early-chain overlap (#1455/:710, #1457 :701-711):                */
/*  handleGenericAutomation (:710) hijacks any envelope still         */
/*  carrying automation.type unless effects.fail/success guard it or  */
/*  the name is in SERVICE_HANDLED_SPELLS (triggerSpells.js:42-57,   */
/*  imported REAL below — no fabricated list). Disk rows with         */
/*  unprotected automation (see invisibility temp_buff, flesh_to_     */
/*  stone, slow, beacon_of_hope, suggestion 5e; hold_monster/         */
/*  banishment/maze 2024) are stripped in fixtures so the span row   */
/*  is honestly reached; the audit test below pins every rule x name */
/*  classification from real disk bytes.                              */
/*                                                                    */
/*  Dead twins (never-executed guards, report-not-silently-kept):    */
/*  handleConfusion (:285), handleHypnoticPattern (:288) and          */
/*  handleMassSuggestionTrigger (:293) in the no-damage chain are    */
/*  structurally unreachable for disk spells: the early chain first  */
/*  intercepts those names (handleMassSuggestion gate modalSpells.js */
/*  :42 name+spellSaveDc; handleHypnoticPatternEarly :96 fullSpell. */
/*  dc; handleConfusionEarly :150 fullSpell.dc — all disk rows carry */
/*  dc). Pinned once below; no service call is claimed for them.     */
/*                                                                    */
/*  CLA-389 (#1455 delegate): handled swallow rows run post-cast     */
/*  riders via runPostCastTriggersMerged (index.js:720,597-601) —     */
/*  the :712 early-chain bypass does NOT apply to this segment.      */
/*                                                                    */
/*  Quirks pinned: case-gate trail — span gates lowercase the name   */
/*  (triggerSpells.js passim) while lookupFullSpell is exact-case    */
/*  (index.js:179): 'HOLD MONSTER' routes but console.errors a       */
/*  disk-miss; Crown of Madness is ABSENT from 5e disk yet still    */
/*  routes by name. Golden unguarded deref (#1360): logGenericSpell- */
/*  Cast's `await getTargetInfo()` (index.js:234) has no guard — a   */
/*  caller omitting getTargetInfo crashes with an untouched TypeError*/
/*  (never swallowed). Silent-null (#1441): swallow rows resolve     */
/*  exactly undefined — pinned per row.                              */
/*                                                                    */
/*  NO-CLOCK declaration: no game timers on this hop. Date.now()     */
/*  appears only inside mocked logService payloads (index.js:242);   */
/*  span handlers hold no expiry stamps; adjudication prompts wait   */
/*  indefinitely per repo mandate. HP-key flows: N/A (heal rows are   */
/*  .noformula-utility / .heal #1455 territory).                     */
/*                                                                    */
/*  Standards: exact-arg tuples vs real signatures, identity + fresh- */
/*  object pins, input purity, full-disk-byte fixtures (#1365), no   */
/*  fabricated Fireball-shaped envelopes, no expect.any/object-        */
/*  Containing (#1446-57 — purged from the old version of this        */
/*  file), campaign 'test-campaign' lockdown (#1456/57 — replaced     */
/*  'testCampaign'), URL-aware fetch stub (#1454-56) so jsdom noise   */
/*  is zero; logService mocked (unstubbed POST /api noise removed).   */
/*                                                                    */
/*  Cited-by: noformula-modals header :31-32 delegates the swallow   */
/*  face to THIS lane — honored above. Kill-matrix: each row kills    */
/*  {gate-drop, wrong-service, arg-drift, consume<->discard flip,    */
/*  cross-row bleed}; specials kill {disk-byte drift, early-chain     */
/*  reorder, CLA-389 bypass, case-gate split, falsy guard removal,    */
/*  caller-contract break}. Vacuous-test scan: zero (every it has     */
/*  exact positive+negative assertions).                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — live import graph only, real-Promise-shaped (#1440).      */
/*  triggerSpells.js and modalSpells.js run REAL (the routing unit).  */
/*  fearService/foresightService/heroismService/rangeValidation/       */
/*  diceRoller mocks from the previous version were dropped: off this */
/*  hop's live graph (dead-route class; heroism/longstrider/resist-  */
/*  ance routing is owned by .noformula-utility).                      */
/* ------------------------------------------------------------------ */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => []),
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => [])
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
  triggerFriends: vi.fn(async () => {}),
}))

// Feature services reachable through the REAL triggerSpells import graph —
// inert no-op isolation; this lane pins the call args, internals live in
// features/ lanes.
vi.mock('../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../features/seeInvisibilityService.js', () => ({ triggerSeeInvisibility: vi.fn(async () => {}) }))
vi.mock('../features/fleshToStoneService.js', () => ({ triggerFleshToStone: vi.fn(async () => {}) }))
vi.mock('../features/holdMonsterService.js', () => ({ triggerHoldMonster: vi.fn(async () => {}) }))
vi.mock('../features/banishmentService.js', () => ({ triggerBanishment: vi.fn(async () => {}) }))
vi.mock('../features/confusionService.js', () => ({ triggerConfusion: vi.fn(async () => {}) }))
vi.mock('../features/mazeService.js', () => ({ triggerMaze: vi.fn(async () => {}) }))
vi.mock('../features/powerWordStunService.js', () => ({ triggerPowerWordStun: vi.fn(async () => {}) }))
vi.mock('../features/hypnoticPatternService.js', () => ({ triggerHypnoticPattern: vi.fn(async () => {}) }))
vi.mock('../features/slowService.js', () => ({ triggerSlow: vi.fn(async () => {}) }))
vi.mock('../features/baneService.js', () => ({ triggerBaneSpell: vi.fn(async () => {}) }))
vi.mock('../features/blessService.js', () => ({ triggerBlessSpell: vi.fn(async () => {}) }))
vi.mock('../features/beaconOfHopeService.js', () => ({ triggerBeaconOfHope: vi.fn(async () => {}) }))
vi.mock('../features/massSuggestionService.js', () => ({ triggerMassSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/suggestionService.js', () => ({ triggerSuggestion: vi.fn(async () => {}) }))
vi.mock('../features/ottoDanceService.js', () => ({ triggerOttoDance: vi.fn(async () => {}) }))
vi.mock('../features/resilientSphereService.js', () => ({ triggerResilientSphere: vi.fn(async () => {}) }))
vi.mock('../features/blurService.js', () => ({ triggerBlur: vi.fn(async () => {}) }))
vi.mock('../features/expeditiousRetreatService.js', () => ({ triggerExpeditiousRetreat: vi.fn(async () => {}) }))
vi.mock('../features/crownOfMadnessService.js', () => ({ triggerCrownOfMadness: vi.fn(async () => {}) }))
vi.mock('../features/animalFriendshipService.js', () => ({ triggerAnimalFriendship: vi.fn(async () => {}) }))
vi.mock('../features/dominateBeastService.js', () => ({ triggerDominateBeast: vi.fn(async () => {}) }))
vi.mock('../features/dominateMonsterService.js', () => ({ triggerDominateMonster: vi.fn(async () => {}) }))
vi.mock('../features/dominatePersonService.js', () => ({ triggerDominatePerson: vi.fn(async () => {}) }))
vi.mock('../features/rayOfEnfeeblementService.js', () => ({ triggerRayOfEnfeeblement: vi.fn(async () => {}) }))
vi.mock('../features/compelledDuelService.js', () => ({ triggerCompelledDuel: vi.fn(async () => {}) }))
vi.mock('../features/globeOfInvulnerabilityService.js', () => ({ triggerGlobeOfInvulnerability: vi.fn(async () => {}) }))
vi.mock('../features/forcecageService.js', () => ({ triggerForcecage: vi.fn(async () => {}) }))
vi.mock('../features/stinkingCloudService.js', () => ({ triggerStinkingCloud: vi.fn(async () => {}) }))
vi.mock('../features/sleetStormService.js', () => ({ triggerSleetStorm: vi.fn(async () => {}) }))
vi.mock('../features/faerieFireService.js', () => ({ triggerFaerieFire: vi.fn(async () => {}) }))
vi.mock('../features/tashasHideousLaughterService.js', () => ({ triggerTashasHideousLaughter: vi.fn(async () => {}) }))
vi.mock('../features/imprisonmentService.js', () => ({ triggerImprisonment: vi.fn(async () => {}) }))
vi.mock('../features/holyAuraService.js', () => ({ triggerHolyAura: vi.fn(async () => {}) }))
vi.mock('../features/massCureWoundsService.js', () => ({ triggerMassCureWounds: vi.fn(async () => {}) }))
vi.mock('../features/massHealingWordService.js', () => ({ triggerMassHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/prayerOfHealingService.js', () => ({ triggerPrayerOfHealing: vi.fn(async () => {}) }))
vi.mock('../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => {}) }))

// Post-cast triggers (reach every handled row via runPostCastTriggersMerged)
vi.mock('../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => {}) }))
vi.mock('../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))
vi.mock('../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))

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
/*  Real module refs (mocked above by hoisting)                        */
/* ------------------------------------------------------------------ */

import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as automation from '../../automation/index.js'
import * as wms from '../features/wildMagicSurgeService.js'
import * as ts from './spellCastService/execution/triggerSpells.js' // REAL routing unit
import { SERVICE_HANDLED_SPELLS } from './spellCastService/execution/triggerSpells.js'
import {
  triggerSeeInvisibility,
} from '../features/seeInvisibilityService.js'
import { triggerFleshToStone } from '../features/fleshToStoneService.js'
import { triggerHoldMonster } from '../features/holdMonsterService.js'
import { triggerBanishment } from '../features/banishmentService.js'
import { triggerMaze } from '../features/mazeService.js'
import { triggerPowerWordStun } from '../features/powerWordStunService.js'
import { triggerSlow } from '../features/slowService.js'
import { triggerBaneSpell } from '../features/baneService.js'
import { triggerBlessSpell } from '../features/blessService.js'
import { triggerBeaconOfHope } from '../features/beaconOfHopeService.js'
import { triggerSuggestion } from '../features/suggestionService.js'
import { triggerOttoDance } from '../features/ottoDanceService.js'
import { triggerResilientSphere } from '../features/resilientSphereService.js'
import { triggerBlur } from '../features/blurService.js'
import { triggerExpeditiousRetreat } from '../features/expeditiousRetreatService.js'
import { triggerFriends } from '../features/friendsService.js'
import { triggerCrownOfMadness } from '../features/crownOfMadnessService.js'
import { triggerAnimalFriendship } from '../features/animalFriendshipService.js'
import { triggerDominateBeast } from '../features/dominateBeastService.js'
import { triggerDominateMonster } from '../features/dominateMonsterService.js'
import { triggerDominatePerson } from '../features/dominatePersonService.js'
import { triggerMassSuggestion } from '../features/massSuggestionService.js'
import { triggerHypnoticPattern } from '../features/hypnoticPatternService.js'
import { triggerConfusion } from '../features/confusionService.js'

/* ------------------------------------------------------------------ */
/*  Test-data factories — REAL disk bytes only (#1362 ban on           */
/*  fabricated spell shapes; the old Fireball-base-minus-damage         */
/*  factory is gone).                                                   */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign' // lockdown: never 'testCampaign'
const MAP = 'testMap'
const CASTER = 'TestWizard'
const SAVE_DC = 17 // 8 + intBonus 5 + prof 4 via computeSpellStats (index.js:191-221)

function diskRow(ruleset, name) {
  const all = ruleset === '2024' ? spells2024 : spells5e
  const row = all.find((s) => s.name === name)
  return row ? cloneDeep(row) : null
}

function makePlayerStats(ruleset) {
  return {
    name: CASTER,
    rules: ruleset,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: SAVE_DC, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
  }
}

// Exact hub-generic-automation hijack predicate, verbatim from
// triggerSpells.js:455 — used to strip unprotected automation so the span
// row is honestly reached, never to fabricate one.
function wouldGenericHijack(envelope) {
  return !!(envelope.automation?.type) &&
    !(envelope.automation?.effects?.fail) &&
    !(envelope.automation?.effects?.success) &&
    !SERVICE_HANDLED_SPELLS.has((envelope.name || '').toLowerCase())
}

function envelopeFor(ruleset, name) {
  const row = diskRow(ruleset, name)
  if (!row) throw new Error(`disk row missing: ${ruleset} ${name}`)
  if (wouldGenericHijack(row)) delete row.automation // discriminator pin, see audit test
  return row
}

/* ------------------------------------------------------------------ */
/*  Roster table — the service-routed rows of index.js:281-305,       */
/*  ordered exactly as the chain evaluates them. shape: 'raw' forwards */
/*  the CLA-219-stamped metaCtx untouched; 'saveDc' injects            */
/*  spellSaveDc; 'target' additionally injects targetName from         */
/*  getTargetInfo. consume: swallow = trigger return discarded         */
/*  (index.js:75); forward = wrapped as automationPopup (index.js:74, */
/*  triggerSpells.js wrappers). 'builtin' = triggerSpells builds the  */
/*  popup itself (command has no service). duel =                     */
/*  checkCompelledDuelAttackExpiry side-route.                        */
/* ------------------------------------------------------------------ */

const ROSTER = [
  { spell: 'See Invisibility', ruleset: '5e', trigger: triggerSeeInvisibility, shape: 'raw', consume: 'swallow', ts: 'handleSeeInvisibility' },
  { spell: 'Flesh to Stone', ruleset: '5e', trigger: triggerFleshToStone, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Hold Monster', ruleset: '5e', trigger: triggerHoldMonster, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Hold Person', ruleset: '5e', trigger: triggerHoldMonster, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Banishment', ruleset: '5e', trigger: triggerBanishment, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Maze', ruleset: '5e', trigger: triggerMaze, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Power Word Stun', ruleset: '5e', trigger: triggerPowerWordStun, shape: 'saveDc', consume: 'forward' },
  { spell: 'Slow', ruleset: '5e', trigger: triggerSlow, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Bane', ruleset: '5e', trigger: triggerBaneSpell, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Bless', ruleset: '5e', trigger: triggerBlessSpell, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Beacon of Hope', ruleset: '5e', trigger: triggerBeaconOfHope, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Suggestion', ruleset: '5e', trigger: triggerSuggestion, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Command', ruleset: '5e', trigger: null, shape: 'saveDc', consume: 'builtin' },
  { spell: "Otto's Irresistible Dance", ruleset: '2024', trigger: triggerOttoDance, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Resilient Sphere', ruleset: '5e', trigger: triggerResilientSphere, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Blur', ruleset: '5e', trigger: triggerBlur, shape: 'raw', consume: 'swallow' },
  { spell: 'Expeditious Retreat', ruleset: '5e', trigger: triggerExpeditiousRetreat, shape: 'raw', consume: 'swallow' },
  { spell: 'Friends', ruleset: '5e', trigger: triggerFriends, shape: 'target', consume: 'forward' },
  { spell: 'Crown of Madness', ruleset: '2024', trigger: triggerCrownOfMadness, shape: 'target', consume: 'forward' },
  { spell: 'Animal Friendship', ruleset: '5e', trigger: triggerAnimalFriendship, shape: 'saveDc', consume: 'forward' },
  { spell: 'Dominate Beast', ruleset: '5e', trigger: triggerDominateBeast, shape: 'target', consume: 'forward' },
  { spell: 'Dominate Monster', ruleset: '5e', trigger: triggerDominateMonster, shape: 'target', consume: 'forward', duel: true },
  { spell: 'Dominate Person', ruleset: '5e', trigger: triggerDominatePerson, shape: 'target', consume: 'forward', duel: true },
]

const SPAN_TRIGGERS = [...new Set(ROSTER.map((r) => r.trigger).filter(Boolean))]

function expectedMetaCtx(row, callerMetaCtx) {
  const stamped = { ...callerMetaCtx, metamagicHeighten: false } // CLA-219 stamp, index.js:680
  if (row.shape === 'raw') return stamped
  if (row.shape === 'saveDc') return { ...stamped, spellSaveDc: SAVE_DC }
  return { ...stamped, spellSaveDc: SAVE_DC, targetName: 'Target' }
}

async function castRow(row) {
  const envelope = envelopeFor(row.ruleset, row.spell)
  const playerStats = makePlayerStats(row.ruleset)
  const callerMetaCtx = { slotLevel: envelope.level }
  const services = {
    playerStats,
    getTargetInfo: async () => ({ name: 'Target' }),
    campaignName: CAMPAIGN,
    mapName: MAP,
    // rollAttack/rollDamage/attackerPos/targetPos/characters intentionally
    // omitted: every span row terminates in the no-damage chain. A
    // routing regression that spills onto the damage lane now fails LOUD
    // (TypeError) instead of silently consuming fabricated dice mocks.
  }
  return { envelope, playerStats, callerMetaCtx, services }
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - no-formula services lane (no-damage chain swallow/forward rows, see invisibility -> dominate person)', () => {
  let fetchStub

  beforeEach(() => {
    vi.clearAllMocks() // clears calls/results but NOT implementations — re-anchor
    // every sentinel-capable mock to real Promise undefined here so no
    // mockResolvedValue from a previous test can leak into this one.
    runtime.getRuntimeValue.mockImplementation(() => [])
    wms.triggerWildMagicSurge.mockResolvedValue(undefined)
    for (const t of SPAN_TRIGGERS) t.mockResolvedValue(undefined)
    // URL-aware fetch stub (#1454-56): lookupFullSpell (index.js:176) always
    // fetches the ruleset list for non-AoE envelopes; serve REAL disk bytes,
    // reject anything else so stray jsdom network noise is impossible.
    fetchStub = vi.fn(async (url) => {
      if (url === '/data/spells.json') return { ok: true, json: async () => spells5e }
      if (url === '/data/2024/spells.json') return { ok: true, json: async () => spells2024 }
      return Promise.reject(new Error(`unexpected fetch in noformula-services lane: ${url}`))
    })
    vi.stubGlobal('fetch', fetchStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // ------------------------------------------------------------------
  // Per-row routing: exact trigger args + consume/discard contract.
  // ------------------------------------------------------------------
  describe('span rows (index.js:281-305)', () => {
    for (const row of ROSTER) {
      it(`${row.spell} routes through span row and hub ${row.consume === 'swallow' ? 'swallows (handled:true discards)' : 'forwards'} the trigger return`, async () => {
        const { envelope, playerStats, callerMetaCtx, services } = await castRow(row)
        const before = cloneDeep(envelope)
        const metaCtx = expectedMetaCtx(row, callerMetaCtx)

        // Sentinel popup from the service makes consume-vs-discard observable
        // (#1404 swallow face): swallow rows must DROP it, forward rows wrap it.
        const sentinel = { type: 'popup', payload: { type: 'automation_info', name: row.spell, description: 'service-owned' } }
        if (row.trigger) row.trigger.mockResolvedValue(sentinel)

        const res = await executeSpellCast(envelope, callerMetaCtx, services)

        if (row.trigger) {
          expect(row.trigger).toHaveBeenCalledTimes(1)
          expect(row.trigger).toHaveBeenCalledWith(envelope, metaCtx, playerStats, CAMPAIGN, MAP)
          expect(row.trigger.mock.calls[0][2]).toBe(playerStats) // identity passthrough
          expect(row.trigger.mock.calls[0][1]).not.toBe(callerMetaCtx) // fresh stamped object
        } else {
          // Command: no service; triggerSpells.js:185-207 builds the modal.
          expect(res).toStrictEqual({
            automationPopup: {
              type: 'modal',
              modalName: 'commandChoice',
              payload: { spell: envelope, metaCtx, targetName: 'Target', playerStats, campaignName: CAMPAIGN, mapName: MAP },
            },
          })
        }

        // Consume/discard contract (#1404): swallow = undefined exactly
        // (handles silent-null #1441); forward = automationPopup wrapper.
        if (row.consume === 'swallow') {
          expect(res).toBeUndefined()
        } else if (row.consume === 'forward') {
          expect(res).toStrictEqual({ automationPopup: sentinel })
        }

        // Duel side-route ordering (triggerSpells.js:292/305): expiry fires
        // exactly once, before the trigger service.
        if (row.duel) {
          expect(automation.checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(1)
          expect(automation.checkCompelledDuelAttackExpiry).toHaveBeenCalledWith(CASTER, 'Target', CAMPAIGN)
          const expiryAt = automation.checkCompelledDuelAttackExpiry.mock.invocationCallOrder[0]
          const triggerAt = row.trigger.mock.invocationCallOrder[0]
          expect(expiryAt).toBeLessThan(triggerAt)
        } else {
          expect(automation.checkCompelledDuelAttackExpiry).not.toHaveBeenCalled()
        }

        // Cross-row bleed kill matrix: no other span service fires, and the
        // generic-automation hijack lane (:710) never runs for span names.
        expect(automation.executeHandler).not.toHaveBeenCalled()
        for (const other of SPAN_TRIGGERS) {
          if (other !== row.trigger) expect(other).not.toHaveBeenCalled()
        }

        // Input purity: envelope and caller metaCtx byte-identical after.
        expect(envelope).toStrictEqual(before)
        expect(callerMetaCtx).toStrictEqual({ slotLevel: envelope.level })
      })
    }
  })

  // ------------------------------------------------------------------
  // Disk-byte reachability audit — BOTH rulesets programmatically
  // (#1365). Classification computed from real disk automation bytes +
  // the real SERVICE_HANDLED_SPELLS set; drift in either flips this red.
  // ------------------------------------------------------------------
  it('disk bytes classify every span row: absent | clean | guarded | protected | strip-required', async () => {
    // names may differ per ruleset; expected class per row:
    //  absent     - no disk row in that ruleset
    //  clean      - no automation.type on disk: span row live with full bytes
    //  guarded    - automation carries effects.fail (generic gate exempt)
    //  protected  - name in SERVICE_HANDLED_SPELLS (generic gate exempt)
    //  strip      - unprotected automation on disk: raw disk envelope would be
    //               consumed EARLIER by handleGenericAutomation (:710) — this
    //               lane's envelope must strip it (report row, fixtures strip)
    const NAMES = [
      ['See Invisibility', 'See Invisibility'],
      ['Flesh to Stone', 'Flesh to Stone'],
      ['Hold Monster', 'Hold Monster'],
      ['Hold Person', 'Hold Person'],
      ['Banishment', 'Banishment'],
      ['Maze', 'Maze'],
      ['Power Word Stun', 'Power Word Stun'],
      ['Slow', 'Slow'],
      ['Bane', 'Bane'],
      ['Bless', 'Bless'],
      ['Beacon of Hope', 'Beacon of Hope'],
      ['Suggestion', 'Suggestion'],
      ['Command', 'Command'],
      ['Resilient Sphere', "Otiluke's Resilient Sphere"],
      ["Otto's Irresistible Dance", "Otto's Irresistible Dance"],
      ['Blur', 'Blur'],
      ['Expeditious Retreat', 'Expeditious Retreat'],
      ['Friends', 'Friends'],
      ['Crown of Madness', 'Crown of Madness'],
      ['Animal Friendship', 'Animal Friendship'],
      ['Dominate Beast', 'Dominate Beast'],
      ['Dominate Monster', 'Dominate Monster'],
      ['Dominate Person', 'Dominate Person'],
    ]
    const expected = {
      '5e': {
        'See Invisibility': 'strip', 'Flesh to Stone': 'strip', 'Hold Monster': 'clean',
        'Hold Person': 'clean', 'Banishment': 'clean', 'Maze': 'clean',
        'Power Word Stun': 'clean', 'Slow': 'strip', 'Bane': 'clean', 'Bless': 'clean',
        'Beacon of Hope': 'strip', 'Suggestion': 'strip', Command: 'clean',
        'Resilient Sphere': 'protected', "Otto's Irresistible Dance": 'absent', Blur: 'clean',
        'Expeditious Retreat': 'clean', Friends: 'clean', 'Crown of Madness': 'absent',
        'Animal Friendship': 'clean', 'Dominate Beast': 'clean', 'Dominate Monster': 'guarded',
        'Dominate Person': 'clean',
      },
      '2024': {
        'See Invisibility': 'strip', 'Flesh to Stone': 'strip', 'Hold Monster': 'strip',
        'Hold Person': 'strip', 'Banishment': 'strip', 'Maze': 'strip',
        'Power Word Stun': 'clean', 'Slow': 'strip', 'Bane': 'clean', 'Bless': 'clean',
        'Beacon of Hope': 'strip', 'Suggestion': 'strip', Command: 'clean',
        'Resilient Sphere': 'protected', "Otto's Irresistible Dance": 'protected', Blur: 'clean',
        'Expeditious Retreat': 'clean', Friends: 'clean', 'Crown of Madness': 'clean',
        'Animal Friendship': 'clean', 'Dominate Beast': 'clean', 'Dominate Monster': 'clean',
        'Dominate Person': 'clean',
      },
    }
    const actual = { '5e': {}, '2024': {} }
    for (const [ruleset] of [['5e'], ['2024']]) {
      for (const [name5e, name2024] of NAMES) {
        const name = ruleset === '2024' ? name2024 : name5e
        const row = diskRow(ruleset, name)
        const lower = name.toLowerCase()
        let cls = 'clean'
        if (!row) cls = 'absent'
        else if (row.automation?.type && (row.automation?.effects?.fail || row.automation?.effects?.success)) cls = 'guarded'
        else if (row.automation?.type && SERVICE_HANDLED_SPELLS.has(lower)) cls = 'protected'
        else if (row.automation?.type) cls = 'strip'
        actual[ruleset][name5e] = cls
      }
    }
    expect(actual).toStrictEqual(expected)
    // Span ownership proof: none of these live names is early-chain-owned.
    expect([...SERVICE_HANDLED_SPELLS]).not.toContain('fear')
    expect([...SERVICE_HANDLED_SPELLS]).not.toContain('silence')
  })

  // ------------------------------------------------------------------
  // Dead twins (never-executed guards): early chain (:704-707) always
  // intercepts these names before their no-damage twins (:285/:288/:293)
  // can fire — the triggerSpells services stay silent.
  // ------------------------------------------------------------------
  it('confusion / hypnotic pattern / mass suggestion are intercepted by the early chain — their no-damage twin services never fire', async () => {
    // Raw disk envelopes: name is caught at :704/:706/:707, before the
    // generic-automation gate (:710) even matters.
    const ms = await executeSpellCast(diskRow('5e', 'Mass Suggestion'), { slotLevel: 6 }, {
      playerStats: makePlayerStats('5e'), getTargetInfo: async () => ({ name: 'Target' }),
      campaignName: CAMPAIGN, mapName: MAP,
    })
    expect(ms.automationPopup.modalName).toBe('massSuggestion')
    expect(triggerMassSuggestion).not.toHaveBeenCalled()

    const hp = await executeSpellCast(diskRow('5e', 'Hypnotic Pattern'), { slotLevel: 3 }, {
      playerStats: makePlayerStats('5e'), getTargetInfo: async () => ({ name: 'Target' }),
      campaignName: CAMPAIGN, mapName: MAP,
    })
    expect(hp.automationPopup.modalName).toBe('hypnoticPattern')
    expect(triggerHypnoticPattern).not.toHaveBeenCalled()

    const cf = await executeSpellCast(diskRow('5e', 'Confusion'), { slotLevel: 4 }, {
      playerStats: makePlayerStats('5e'), getTargetInfo: async () => ({ name: 'Target' }),
      campaignName: CAMPAIGN, mapName: MAP,
    })
    // Early twin injects its own triggerConfusion wrapper (:707) — exactly
    // one call, from the early lane, with the early lane's stamped ctx.
    expect(cf).toBeUndefined()
    expect(triggerConfusion).toHaveBeenCalledTimes(1)
    expect(triggerConfusion).toHaveBeenCalledWith(
      diskRow('5e', 'Confusion'),
      { slotLevel: 4, metamagicHeighten: false, spellSaveDc: SAVE_DC },
      makePlayerStats('5e'), CAMPAIGN, MAP,
    )
  })

  // ------------------------------------------------------------------
  // CLA-389 (#1455 delegate / :712-bypass question answered): handled
  // no-damage rows run post-cast riders via runPostCastTriggersMerged
  // (:720); swallow rows expose the surge popup, forward-row popups win.
  // ------------------------------------------------------------------
  it('CLA-389 merge runs post-cast riders on span rows: swallowed slow surfaces the surge popup, forwarded command popup keeps precedence', async () => {
    // triggerWildMagicSurge returns a lane-shaped result ({ automationPopup })
    // (index.js:537-541) — merge surfaces it when the swallowed lane value
    // has no visible payload (:599).
    const surge = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Wild Magic Surge', description: 'surge' } } }
    wms.triggerWildMagicSurge.mockResolvedValue(surge)

    const slowRow = ROSTER.find((r) => r.spell === 'Slow')
    const { envelope, playerStats, callerMetaCtx } = await castRow(slowRow)
    triggerSlow.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info', name: 'Slow', description: 'discarded sentinel' } })
    const res = await executeSpellCast(envelope, callerMetaCtx, {
      playerStats, getTargetInfo: async () => ({ name: 'Target' }), campaignName: CAMPAIGN, mapName: MAP,
    })
    // lane value was swallowed (undefined) -> no visible payload -> surge wins
    expect(res).toStrictEqual(surge)
    expect(wms.triggerWildMagicSurge).toHaveBeenCalledTimes(1)
    expect(wms.triggerWildMagicSurge).toHaveBeenCalledWith(envelope, { slotLevel: 3, metamagicHeighten: false }, playerStats, CAMPAIGN, MAP)

    // Forward row: automationPopup payload carries precedence (:583-589).
    wms.triggerWildMagicSurge.mockResolvedValue(surge)
    const cmdRow = ROSTER.find((r) => r.spell === 'Command')
    const cmd = await castRow(cmdRow)
    const res2 = await executeSpellCast(cmd.envelope, cmd.callerMetaCtx, {
      playerStats: cmd.playerStats, getTargetInfo: async () => ({ name: 'Target' }), campaignName: CAMPAIGN, mapName: MAP,
    })
    expect(res2.automationPopup.modalName).toBe('commandChoice')
  })

  // ------------------------------------------------------------------
  // Case-gate trail (#1457 fresh family, same hop): span gates
  // toLowerCase(); lookupFullSpell (:179) is EXACT-case.
  // ------------------------------------------------------------------
  it("'HOLD MONSTER' routes through the lowercase gate while the exact-case disk lookup console.errors a miss", async () => {
    const errSpy = vi.spyOn(console, 'error')
    const envelope = envelopeFor('5e', 'Hold Monster')
    envelope.name = 'HOLD MONSTER'
    const playerStats = makePlayerStats('5e')
    const res = await executeSpellCast(envelope, { slotLevel: 5 }, {
      playerStats, getTargetInfo: async () => ({ name: 'Target' }), campaignName: CAMPAIGN, mapName: MAP,
    })
    expect(triggerHoldMonster).toHaveBeenCalledTimes(1)
    expect(triggerHoldMonster).toHaveBeenCalledWith(envelope, { slotLevel: 5, metamagicHeighten: false, spellSaveDc: SAVE_DC }, playerStats, CAMPAIGN, MAP)
    expect(res).toBeUndefined()
    // Same-hop byte evidence: routing succeeded although the disk lookup missed.
    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledWith('[spellCast] Spell not found in spells.json:', 'HOLD MONSTER')
  })

  it("'Crown of Madness' is ABSENT from 5e disk yet still routes by name, lookup console.errors the miss", async () => {
    const errSpy = vi.spyOn(console, 'error')
    const envelope = envelopeFor('2024', 'Crown of Madness')
    const playerStats = makePlayerStats('5e') // 5e rules -> fetches 5e disk where the name is absent
    const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Crown of Madness', description: 'charmed' } }
    triggerCrownOfMadness.mockResolvedValue(sentinel)
    const res = await executeSpellCast(envelope, { slotLevel: 2 }, {
      playerStats, getTargetInfo: async () => ({ name: 'Target' }), campaignName: CAMPAIGN, mapName: MAP,
    })
    expect(triggerCrownOfMadness).toHaveBeenCalledTimes(1)
    expect(res).toStrictEqual({ automationPopup: sentinel })
    expect(errSpy).toHaveBeenCalledWith('[spellCast] Spell not found in spells.json:', 'Crown of Madness')
  })

  // ------------------------------------------------------------------
  // Falsy-name triple on the REAL triggerSpells guards: every span
  // handler gates on `spell.name &&` — falsy names produce exactly
  // { handled: false } with zero service calls.
  // ------------------------------------------------------------------
  it('falsy spell.name triples leave every span guard unhandled with zero service calls', async () => {
    const positional = (spell, metaCtx) => [spell, metaCtx, makePlayerStats('5e'), CAMPAIGN, MAP]
    const obj = (spell, metaCtx) => [{ spell, metaCtx, spellSaveDc: SAVE_DC, playerStats: makePlayerStats('5e'), campaignName: CAMPAIGN, mapName: MAP }]
    const guards = [
      [ts.handleSeeInvisibility, positional], [ts.handleFleshToStone, obj],
      [ts.handleHoldMonster, obj], [ts.handleBanishment, obj], [ts.handleMaze, obj],
      [ts.handlePowerWordStun, obj], [ts.handleSlow, obj], [ts.handleBane, obj],
      [ts.handleBless, obj], [ts.handleBeaconOfHope, obj], [ts.handleSuggestion, obj],
      [ts.handleCommand, obj], [ts.handleOttoDance, obj], [ts.handleResilientSphere, obj],
      [ts.handleBlur, positional], [ts.handleExpeditiousRetreat, positional],
      [ts.handleFriends, obj], [ts.handleCrownOfMadness, obj],
      [ts.handleAnimalFriendship, obj], [ts.handleDominateBeast, obj],
      [ts.handleDominateMonster, obj], [ts.handleDominatePerson, obj],
    ]
    for (const [fn, shape] of guards) {
      for (const bad of [{}, { name: '' }, { name: null }]) {
        const out = await fn(...shape(bad, { slotLevel: 3, metamagicHeighten: false }))
        expect(out).toStrictEqual({ handled: false })
      }
    }
    for (const t of SPAN_TRIGGERS) expect(t).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Golden unguarded deref (#1360) at the caller boundary: logGeneric-
  // SpellCast awaits getTargetInfo WITHOUT a guard (index.js:234). The
  // TypeError must surface untouched — never swallowed, never routed.
  // ------------------------------------------------------------------
  it('omitting services.getTargetInfo crashes with an untouched TypeError before any span routing', async () => {
    const errSpy = vi.spyOn(console, 'error')
    const envelope = envelopeFor('5e', 'See Invisibility')
    const playerStats = makePlayerStats('5e')
    await expect(executeSpellCast(envelope, { slotLevel: 2 }, {
      playerStats, campaignName: CAMPAIGN, mapName: MAP, // no getTargetInfo
    })).rejects.toThrow(TypeError)
    expect(triggerSeeInvisibility).not.toHaveBeenCalled()
    expect(automation.executeHandler).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled() // golden deref: crash passes through, not logged/swallowed
  })
})
