// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'

/* ------------------------------------------------------------------ */
/*  NO-FORMULA UTILITY LANE (#1457 three-roster split face, #1458    */
/*  boundary confirms)                                                  */
/*                                                                    */
/*  Identity, verbatim #1457: "the remainder roster (executeHandler-  */
/*  routed heroism/longstrider/resistance/spare-the-dying, healing     */
/*  riders, dispel/remove-curse fallbacks)". Concretely this lane      */
/*  owns the remainder spans of the no-damage chain index.js:306-360: */
/*  ray :306 (#1458: "ray-of-enfeeblement :183 yours inside            */
/*  triggerSpells span-adjacency :306 — left intact"), compelled duel */
/*  :307, globe :308, forcecage :309, stinking cloud :311, sleet       */
/*  storm :312, faerie fire :313, tasha's :314, imprisonment :315,     */
/*  heroism :316, holy aura :317, longstrider :318, spare the dying    */
/*  :319, enhance ability :320, protection energy/poison :346/:347,     */
/*  remove-curse :351 + its inline dispel-fallback :353, dispel magic  */
/*  fallback :266-272/:357, resistance :359. Spans :281-305 are         */
/*  .noformula-services (#1457, cited-by :17/:67/:91-92 — honored:     */
/*  heroism/longstrider/resistance routing stays HERE); fear/volley/    */
/*  silence modals are .noformula-modals (#1457 :32-34).               */
/*                                                                    */
/*  HEAL FOLD (#1458 table boundary: "heals were .heal #1455"): the    */
/*  mass-heal trigger rows (:329-332 massCW/massHW/prayer/false-life) */
/*  and Healing Word (:337/.heal generic-heal span) are folded OUT of */
/*  this file, citing .heal owner ranges (#1455; producers massCW      */
/*  #1384, massHW #1385, prayer #1393/94, healingWord #1371). The      */
/*  roster's "healing riders" face stays here as the CONSUMED pin:     */
/*  every handled utility row runs triggerPostCastSelfHeals/            */
/*  triggerPostCastAllyHeals exactly once via runPostCastTriggersMerged */
/*  (:720, :597-601), and the fire-and-forget :341 triggerHealingWord */
/*  rider is pinned on the unhandled fallthrough (dispel lane). The    */
/*  :712 early-chain bypass is verdict-pinned: rows consumed EARLIER   */
/*  by handleGenericAutomation (:710) NEVER reach the riders (S2).     */
/*                                                                    */
/*  DISK HONESTY (#1365, fabricated-shape ban #1455/57/58): every      */
/*  fixture is a REAL disk clone. The old fabricated Fireball-minus-    */
/*  damage base is GONE. Rows whose disk bytes carry unprotected         */
/*  automation.type would be consumed EARLIER by handleGenericAutomation*/
/*  (:710, gate verbatim triggerSpells.js:455) — those fixtures strip   */
/*  the automation key (the documented discriminator; live UI caster      */
/*  payloads legitimately arrive automation-free, cf. .noformula-modals  */
/*  :189 minimal-envelope pattern) and the RAW-disk hijack census (S2) */
/*  pins the interception verdict programmatically for EVERY such name,   */
/*  both rulesets — the strip is honest, never silent. PROTECTED names   */
/*  (SERVICE_HANDLED_SPELLS: tasha, ray) import REAL and never strip.   */
/*                                                                    */
/*  CONSUME-VS-DISCARD per row (#1458 sentinel-popup canon): swallow    */
/*  rows (:75) resolve EXACTLY undefined (silent-null #1441 pinned per  */
/*  row); forward rows (:74) wrap { automationPopup }. Two quirks the  */
/*  OLD header pinned are RETIRED by fix#358 (#1459): Tasha's RAW-      */
/*  forward quirk row (triggerSpells.js :397-era unwrapped return) now */
/*  wraps { automationPopup } per the faerie-sibling guard (:385-389),  */
/*  and Remove Curse's #1404 :447 DOUBLE-DISCARD face is closed — the   */
/*  host captured+wrapped at fix#353 (triggerSpells.js:463-467), the    */
/*  hub now FORWARDS value (index.js fix#358), so both rows consume     */
/*  'forward'. The CONSUMING counterpart pinned here stays the dispel   */
/*  fallback via the window 'spell-result' side-channel (helpers.js:137 */
/*  — hub-level gate-backstop cited #1404 :244-251, pinned at           */
/*  index.js:269-270 null-target → zero events).                         */
/*                                                                    */
/*  Dead twins found in THIS lane (report + pin, never silently kept):   */
/*  RAW disk heroism/longstrider-check: longstrider is CLEAN (no         */
/*  automation) both rulesets — live at :318. RAW disk RESISTANCE is     */
/*  intercepted at :710 by automation.type 'damage_reduction' BOTH       */
/*  rulesets — handleResistance :359 is a disk-dead twin unless          */
/*  automation-free payloads arrive. Same for heroism (:710), globe,      */
/*  forcecage, holy aura, spare-the-dying 2024, enhance 2024,(pfpoison,  */
/*  remove-curse, imprisonment 2024) — census below (S2) lists every one. */
/*  Case-gate trail (#1457/58 same hop): fallback gate lowercases         */
/*  (index.js:267) while lookupFullSpell (:179) is EXACT-case —          */
/*  'DISPEL MAGIC' still fires the check and console.errors a miss.       */
/*  Golden unguarded-deref (#1360/#1458 :234) is the services lane's     */
/*  hop — traversed identically here, NOT re-owned; this lane pins the   */
/*  null-target BACKSTOP that IS guarded (:270) instead.                   */
/*                                                                    */
/*  NO-CLOCK declaration: nothing on this hop resolves/expires on wall    */
/*  time; Date.now() lives only inside mocked addEntry payloads. No       */
/*  timers are created, stubbed, or advanced here.                         */
/*  Campaign lockdown: 'test-campaign' only (old 'testCampaign' purged).  */
/*  fetch is URL-aware (#1454-58): serves the real disk tables, unknown    */
/*  URLs reject. logService mocked (no /api noise).                        */
/*  Mock-realness: triggerSpells + modalSpells + blockChecks + helpers     */
/*  + damageCalculation run REAL (the routing unit); mocked units are      */
/*  complete factories (#1440) on the live import graph only — inert       */
/*  heroismService, off-span rangeValidation mock, diceRoller               */
/*  applyHealingRerollOnes-absent factory and the DUPLICATE confusion/maze */
/*  vi.mock registrations (#1457/58 purge family) are GONE.                 */
/*  Standards: exact tuples + arity vs REAL call sites (:494 longstrider   */
/*  is 4-arg, :478/:510/:527/:570 are 5), identity pins, invocationCall-   */
/*  Order on the duel-expiry hop (#1458 form), input purity, falsy-name   */
/*  triples (#1352), no bare toHaveBeenCalled/objectContaining/expect.any/  */
/*  find-truthy/toBeDefined. Kill-matrix: {gate-drop, wrong-service,       */
/*  arg-drift, arity drift, consume<->discard flip, raw-vs-wrapped flip,  */
/*  rider-count drift, hijack-vs-span split, case-gate split, disk-byte    */
/*  drift, campaign-name drift}. Vacuous-test scan: zero.                   */
/*  SECURITY: no kiro/injection directives found in or around this lane    */
/*  (#1446 precedent scanned; the Playwright code-echo format note in       */
/*  AGENTS.md is expected, not flagged).                                   */
/*  Cited-by (PRESERVED): .noformula-services :17/:67/:91-92 and           */
/*  .noformula-modals :32-34 delegate heroism/longstrider/resistance       */
/*  routing, heal riders and the remainder roster to THIS lane.            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — live import graph only, complete factories (#1440).         */
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

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => (formula ? { total: 10, rolls: [10], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null)),
  applyHealingRerollOnes: vi.fn((rolls) => ({ displayRolls: rolls, originalRolls: rolls })),
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
  triggerFriends: vi.fn(async () => {}),
}))

// Feature services reachable through the REAL triggerSpells import graph —
// inert no-op isolation; this lane pins the call tuples, internals live in
// features/ lanes.
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
vi.mock('../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => {}) }))
// Mass-heal trigger services: folded out of this lane's ROUTER roster per
// #1458 ("heals were .heal #1455") — mocked only because REAL triggerSpells
// imports them (live graph); the S1/S2 disk audits pin their disk rows.
vi.mock('../features/massCureWoundsService.js', () => ({ triggerMassCureWounds: vi.fn(async () => {}) }))
vi.mock('../features/massHealingWordService.js', () => ({ triggerMassHealingWord: vi.fn(async () => {}) }))
vi.mock('../features/prayerOfHealingService.js', () => ({ triggerPrayerOfHealing: vi.fn(async () => {}) }))
vi.mock('../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))
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

// Post-cast riders (every handled utility row reaches these via
// runPostCastTriggersMerged index.js:720/:771 — the "healing riders" face).
vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => null),
}))

vi.mock('./postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(async () => null),
  triggerSpellThief: vi.fn(async () => null),
  triggerBewitchingMagic: vi.fn(async () => null),
  triggerSoulstitchSpells: vi.fn(async () => null),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => undefined) }))
vi.mock('../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))

/* ------------------------------------------------------------------ */
/*  Real module refs                                                   */
/* ------------------------------------------------------------------ */

import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as automation from '../../automation/index.js'
import * as dice from '../../dice/diceRoller.js'
import * as log from '../../ui/logService.js'
import * as wms from '../features/wildMagicSurgeService.js'
import * as healRider from './postCastHealService.js'
import * as ts from './spellCastService/execution/triggerSpells.js' // REAL routing unit
import { SERVICE_HANDLED_SPELLS } from './spellCastService/execution/triggerSpells.js'
import {
  triggerRayOfEnfeeblement,
} from '../features/rayOfEnfeeblementService.js'
import { triggerCompelledDuel } from '../features/compelledDuelService.js'
import { triggerGlobeOfInvulnerability } from '../features/globeOfInvulnerabilityService.js'
import { triggerForcecage } from '../features/forcecageService.js'
import { triggerStinkingCloud } from '../features/stinkingCloudService.js'
import { triggerSleetStorm } from '../features/sleetStormService.js'
import { triggerFaerieFire } from '../features/faerieFireService.js'
import { triggerTashasHideousLaughter } from '../features/tashasHideousLaughterService.js'
import { triggerImprisonment } from '../features/imprisonmentService.js'
import { triggerHolyAura } from '../features/holyAuraService.js'
import { triggerRemoveCurse } from '../features/removeCurseService.js'

/* ------------------------------------------------------------------ */
/*  Constants + disk-faithful factories                                */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign' // lockdown #1456/57/58 — never 'testCampaign'
const MAP = 'testMap'
const CASTER = 'TestWizard'
const SAVE_DC = 17 // computeSpellStats reads spellAbilities.saveDc (index.js:199)

function diskRow(ruleset, name) {
  const all = ruleset === '2024' ? spells2024 : spells5e
  const row = all.find((s) => s.name === name)
  return row ? cloneDeep(row) : null
}

function makePlayerStats(ruleset) {
  return {
    name: CASTER,
    rules: ruleset,
    level: 5,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: SAVE_DC, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
  }
}

// Hub hijack predicate, verbatim mirror of triggerSpells.js:455 — used ONLY
// to decide honest stripping and the census, never to fabricate envelopes.
function wouldGenericHijack(envelope) {
  return !!(envelope.automation?.type) &&
    !(envelope.automation?.effects?.fail) &&
    !(envelope.automation?.effects?.success) &&
    !SERVICE_HANDLED_SPELLS.has((envelope.name || '').toLowerCase())
}

// Disk-byte classification shared by fixtures, audit and census (no dup).
function classify(ruleset, name) {
  const row = diskRow(ruleset, name)
  if (!row) return 'absent'
  if (row.automation?.type && (row.automation?.effects?.fail || row.automation?.effects?.success)) return 'guarded'
  if (wouldGenericHijack(row)) return SERVICE_HANDLED_SPELLS.has(name.toLowerCase()) ? 'protected' : 'strip'
  return 'clean'
}

function envelopeFor(ruleset, name) {
  const row = diskRow(ruleset, name)
  if (!row) throw new Error(`disk row missing: ${ruleset} ${name}`)
  if (wouldGenericHijack(row)) delete row.automation // documented discriminator — RAW counterpart pinned in S2 census
  return row
}

// lookupFullSpell needsLookup mirror, verbatim index.js:172.
function expectedFetchFor(ruleset, envelope) {
  const needsLookup = !envelope.area_of_effect || (envelope.automation?.type && !envelope.automation?.effects)
  return needsLookup ? [ruleset === '2024' ? '/data/2024/spells.json' : '/data/spells.json'] : []
}

function stamped(callerMetaCtx) {
  return { ...callerMetaCtx, metamagicHeighten: false } // CLA-219, index.js:680
}

/* ------------------------------------------------------------------ */
/*  Roster — the remainder spans of the no-damage chain (:306-360),   */
/*  chain order. shape: raw | saveDc | target (per triggerSpells.js   */
/*  wrappers). consume: swallow (discard, :75) | forward               */
/*  ({ automationPopup }, :74) | raw (Tasha's unwrapped, :389).       */
/*  route: service (feature trigger) | execute (executeHandler).      */
/*  arity: REAL executeHandler call-site arity (triggerSpells.js).   */
/* ------------------------------------------------------------------ */

const ROWS = [
  { spell: 'Ray of Enfeeblement', span: ':306', rulesets: ['5e', '2024'], route: 'service', trigger: triggerRayOfEnfeeblement, shape: 'target', consume: 'swallow', duel: true },
  { spell: 'Compelled Duel', span: ':307', rulesets: ['5e', '2024'], route: 'service', trigger: triggerCompelledDuel, shape: 'target', consume: 'forward' },
  { spell: 'Globe of Invulnerability', span: ':308', rulesets: ['5e', '2024'], route: 'service', trigger: triggerGlobeOfInvulnerability, shape: 'raw', consume: 'forward' },
  { spell: 'Forcecage', span: ':309', rulesets: ['5e', '2024'], route: 'service', trigger: triggerForcecage, shape: 'raw', consume: 'forward' },
  { spell: 'Stinking Cloud', span: ':311', rulesets: ['5e', '2024'], route: 'service', trigger: triggerStinkingCloud, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Sleet Storm', span: ':312', rulesets: ['5e', '2024'], route: 'service', trigger: triggerSleetStorm, shape: 'saveDc', consume: 'swallow' },
  { spell: 'Faerie Fire', span: ':313', rulesets: ['5e', '2024'], route: 'service', trigger: triggerFaerieFire, shape: 'saveDc', consume: 'forward' },
  { spell: "Tasha's Hideous Laughter", span: ':314', rulesets: ['2024'], route: 'service', trigger: triggerTashasHideousLaughter, shape: 'saveDc', consume: 'forward' }, // fix#358: raw-forward quirk retired — host wraps { automationPopup } per faerie template
  { spell: 'Imprisonment', span: ':315', rulesets: ['5e', '2024'], route: 'service', trigger: triggerImprisonment, shape: 'saveDc', consume: 'forward' },
  { spell: 'Heroism', span: ':316', rulesets: ['5e', '2024'], route: 'execute', arity: 5, action: (e) => ({ name: 'Heroism', spell: e, automation: { type: 'heroism' } }), consume: 'forward' },
  { spell: 'Holy Aura', span: ':317', rulesets: ['5e', '2024'], route: 'service', trigger: triggerHolyAura, shape: 'raw', consume: 'swallow' },
  { spell: 'Longstrider', span: ':318', rulesets: ['5e', '2024'], route: 'execute', arity: 4, action: (e) => ({ name: 'Longstrider', spell: e, automation: { type: 'longstrider' } }), consume: 'forward' },
  { spell: 'Spare the Dying', span: ':319', rulesets: ['5e', '2024'], route: 'execute', arity: 5, action: (e) => ({ name: 'Spare the Dying', spell: e, automation: { type: 'spare_the_dying' } }), consume: 'forward' },
  { spell: 'Enhance Ability', span: ':320', rulesets: ['5e', '2024'], route: 'execute', arity: 5, action: (e, m) => ({ name: e.name, spell: e, automation: { type: 'enhance_ability', range: 'Touch' }, metaCtx: m }), consume: 'forward' },
  { spell: 'Protection from Energy', span: ':346', rulesets: ['2024'], route: 'execute', arity: 4, action: (e) => ({ name: 'Protection from Energy', spell: e, automation: e.automation ?? {} }), consume: 'swallow' },
  { spell: 'Protection from Poison', span: ':347', rulesets: ['5e', '2024'], route: 'execute', arity: 4, action: (e) => ({ name: 'Protection from Poison', spell: e, automation: e.automation ?? {} }), consume: 'swallow' },
  { spell: 'Remove Curse', span: ':351', rulesets: ['5e', '2024'], route: 'service', trigger: triggerRemoveCurse, shape: 'raw', consume: 'forward', dispelGate: true }, // fix#358: #1404 :447 DOUBLE-DISCARD completed — host wraps (fix#353), hub now forwards value
  { spell: 'Resistance', span: ':359', rulesets: ['5e', '2024'], route: 'execute', arity: 5, action: (e, m) => ({ name: 'Resistance', spell: e, automation: e.automation ?? {}, metaCtx: m }), consume: 'swallow' },
]

const SPAN_TRIGGERS = [...new Set(ROWS.filter((r) => r.route === 'service').map((r) => r.trigger))]

// Every name owned or folded by this lane, for the disk audits (#1365 both
// rulesets, programmatic).
const AUDIT_NAMES = [
  ...ROWS.map((r) => r.spell),
  // folded heal names (#1458 → .heal #1455 / producers #1384/#1385/#1393/
  // #1371/#1452): audited here so their disk fate stays visible even
  // though their routing rows are folded out:
  'Mass Cure Wounds', 'Mass Healing Word', 'Prayer of Healing', 'False Life', 'Healing Word',
  // disk-honesty extras consumed by the S2 census:
  'Dispel Magic',
]

let dispelEvents
let dispelListener
let fetchCalls

function makeServices(overrides = {}) {
  return {
    playerStats: makePlayerStats('5e'),
    getTargetInfo: async () => ({ name: 'Target' }),
    campaignName: CAMPAIGN,
    mapName: MAP,
    characters: [],
    ...overrides,
    // rollAttack/rollDamage/attackerPos/targetPos intentionally absent:
    // every utility row must terminate in the no-damage chain or the
    // dispel fallback; a regression onto the damage lane fails LOUD.
  }
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - noformula utility lane: no-damage-chain remainder spans index.js:306-360 (executeHandler-routed heroism/longstrider/spare-the-dying/enhance-ability/protections/resistance; ray/globe/forcecage/stinking/sleet/faerie/tasha/imprisonment/holy-aura spans; remove-curse + dispel-magic fallbacks)', () => {
  let errSpy

  beforeEach(() => {
    vi.clearAllMocks() // calls/results only — implementations persist
    runtime.getRuntimeValue.mockImplementation(() => [])
    for (const t of SPAN_TRIGGERS) t.mockResolvedValue(undefined)
    wms.triggerWildMagicSurge.mockResolvedValue(undefined)
    automation.executeHandler.mockResolvedValue(undefined)
    errSpy = vi.spyOn(console, 'error')
    dispelEvents = []
    dispelListener = (e) => dispelEvents.push(e.detail)
    window.addEventListener('spell-result', dispelListener)
    fetchCalls = []
    // URL-aware fetch stub (#1454-58): real disk bytes only, noise rejects.
    vi.stubGlobal('fetch', vi.fn((url) => {
      fetchCalls.push(url)
      if (url === '/data/spells.json') return Promise.resolve({ ok: true, json: async () => spells5e })
      if (url === '/data/2024/spells.json') return Promise.resolve({ ok: true, json: async () => spells2024 })
      return Promise.reject(new Error(`unexpected fetch in noformula-utility lane: ${url}`))
    }))
  })

  afterEach(() => {
    window.removeEventListener('spell-result', dispelListener)
    vi.unstubAllGlobals()
    errSpy.mockRestore()
  })

  // ------------------------------------------------------------------
  // Per-row routing table — exact tuple, arity, consume-vs-discard
  // sentinel, riders-once (:720 merge), fetch-bytes, purity, bleed.
  // ------------------------------------------------------------------
  describe('remainder span rows (index.js:306-320, :346-359)', () => {
    for (const row of ROWS) {
      const verb = row.consume === 'swallow'
        ? 'swallows the payload (handled:true discards, index.js:75/#1441 silent-null)'
        : 'forwards { automationPopup } (index.js:74)'
      it(`${row.spell} routes ${row.span} via ${row.route === 'execute' ? 'executeHandler' : 'feature service'} and ${verb} [${row.rulesets.join('+')}]`, async () => {
        for (const ruleset of row.rulesets) {
          vi.clearAllMocks()
          dispelEvents = []
          fetchCalls = []
          runtime.getRuntimeValue.mockImplementation(() => [])

          const envelope = envelopeFor(ruleset, row.spell)
          const before = cloneDeep(envelope)
          const playerStats = makePlayerStats(ruleset)
          const services = makeServices({ playerStats })
          const callerMetaCtx = { slotLevel: envelope.level || 0 }
          const stamp = stamped(callerMetaCtx)
          const metaCtx = row.shape === 'raw' ? stamp : row.shape === 'saveDc' ? { ...stamp, spellSaveDc: SAVE_DC } : { ...stamp, spellSaveDc: SAVE_DC, targetName: 'Target' }

          // Sentinel makes consume-vs-discard observable per row (#1458).
          const sentinel = { type: 'popup', payload: { type: 'automation_info', name: row.spell, description: 'utility-row-owned' } }
          if (row.route === 'service') row.trigger.mockResolvedValue(sentinel)
          else automation.executeHandler.mockResolvedValue(sentinel)

          const res = await executeSpellCast(envelope, callerMetaCtx, services)

          if (row.route === 'service') {
            expect(row.trigger).toHaveBeenCalledTimes(1)
            expect(row.trigger).toHaveBeenCalledWith(envelope, metaCtx, playerStats, CAMPAIGN, MAP)
            expect(row.trigger.mock.calls[0][0]).toBe(envelope) // envelope identity
            expect(row.trigger.mock.calls[0][1]).not.toBe(callerMetaCtx) // fresh CLA-219-stamped ctx
          } else {
            const args = row.arity === 4
              ? [row.action(envelope, stamp), playerStats, CAMPAIGN, MAP]
              : [row.action(envelope, stamp), playerStats, CAMPAIGN, MAP, services.characters]
            expect(automation.executeHandler).toHaveBeenCalledTimes(1)
            expect(automation.executeHandler).toHaveBeenCalledWith(...args)
            expect(automation.executeHandler.mock.calls[0][0].spell).toBe(envelope) // identity
            expect(automation.executeHandler.mock.calls[0][1]).toBe(playerStats)
            expect(automation.executeHandler.mock.calls[0].length).toBe(row.arity) // arity vs REAL
            expect(errSpy).not.toHaveBeenCalled()
          }

          // Consume contract (#1404/#1441): swallow -> exactly undefined;
          // forward -> wrapped. The retired 'raw' (unwrapped identity) branch
          // died with fix#358 (tasha host guard + hub remove-curse forward).
          if (row.consume === 'swallow') expect(res).toBeUndefined()
          else expect(res).toStrictEqual({ automationPopup: sentinel })

          // Duel side-route (triggerSpells.js:318) only on ray; silent on
          // every other row (duel-expiry census, invocationCallOrder form).
          if (row.duel) {
            expect(automation.checkCompelledDuelAttackExpiry).toHaveBeenCalledTimes(1)
            expect(automation.checkCompelledDuelAttackExpiry).toHaveBeenCalledWith(CASTER, 'Target', CAMPAIGN)
            expect(automation.checkCompelledDuelAttackExpiry.mock.invocationCallOrder[0]).toBeLessThan(row.trigger.mock.invocationCallOrder[0])
          } else {
            expect(automation.checkCompelledDuelAttackExpiry).not.toHaveBeenCalled()
          }

          // Cross-route bleed: services never call executeHandler here
          // (auto is stripped/clean — the RAW hijack census is S2);
          // execute rows fire zero span services; no cross-row bleed.
          if (row.route === 'service') expect(automation.executeHandler).not.toHaveBeenCalled()
          for (const other of SPAN_TRIGGERS) {
            if (other !== row.trigger) expect(other).not.toHaveBeenCalled()
          }

          // Healing riders CONSUMED once on every handled utility row
          // (#1457 "healing riders", CLA-389 :720 merge):
          expect(healRider.triggerPostCastSelfHeals).toHaveBeenCalledTimes(1)
          expect(healRider.triggerPostCastSelfHeals).toHaveBeenCalledWith(envelope, { ...stamp, targetNames: ['Target'] }, playerStats, CAMPAIGN, MAP)
          expect(healRider.triggerPostCastAllyHeals).toHaveBeenCalledTimes(1)
          expect(healRider.triggerPostCastAllyHeals).toHaveBeenCalledWith(envelope, stamp, playerStats, CAMPAIGN, MAP)
          expect(wms.triggerWildMagicSurge).toHaveBeenCalledTimes(1)

          // Remove Curse additionally runs the dispel fallback (:353) but
          // the name gate (:267) keeps it silent — zero events (:351 lane).
          if (row.dispelGate) expect(dispelEvents).toStrictEqual([])

          // Fetch honesty: needsLookup computed from the cast bytes (:172).
          expect(fetchCalls).toStrictEqual(expectedFetchFor(ruleset, envelope))

          // Purity: cast inputs byte-identical after.
          expect(envelope).toStrictEqual(before)
          expect(callerMetaCtx).toStrictEqual({ slotLevel: envelope.level || 0 })
        }
      })
    }
  })

  // ------------------------------------------------------------------
  // S1 — disk-byte audit, BOTH rulesets programmatically (#1365).
  // Classification drives fixtures + census; drift flips red.
  // ------------------------------------------------------------------
  it('disk bytes classify every utility + folded-heal name: absent | clean | guarded | protected | strip-required [both rulesets]', () => {
    const expected = {
      '5e': {
        'Ray of Enfeeblement': 'clean', 'Compelled Duel': 'clean', 'Globe of Invulnerability': 'strip',
        Forcecage: 'strip', 'Stinking Cloud': 'clean', 'Sleet Storm': 'clean', 'Faerie Fire': 'clean',
        "Tasha's Hideous Laughter": 'absent', Imprisonment: 'clean', Heroism: 'strip', 'Holy Aura': 'strip',
        Longstrider: 'clean', 'Spare the Dying': 'clean', 'Enhance Ability': 'clean',
        'Protection from Energy': 'absent', 'Protection from Poison': 'strip', 'Remove Curse': 'strip',
        Resistance: 'strip', 'Mass Cure Wounds': 'clean', 'Mass Healing Word': 'strip',
        'Prayer of Healing': 'strip', 'False Life': 'clean', 'Healing Word': 'clean', 'Dispel Magic': 'clean',
      },
      '2024': {
        'Ray of Enfeeblement': 'clean', 'Compelled Duel': 'clean', 'Globe of Invulnerability': 'strip',
        Forcecage: 'strip', 'Stinking Cloud': 'clean', 'Sleet Storm': 'clean', 'Faerie Fire': 'clean',
        "Tasha's Hideous Laughter": 'clean', Imprisonment: 'strip', Heroism: 'strip', 'Holy Aura': 'strip',
        Longstrider: 'clean', 'Spare the Dying': 'strip', 'Enhance Ability': 'strip',
        'Protection from Energy': 'strip', 'Protection from Poison': 'strip', 'Remove Curse': 'strip',
        Resistance: 'strip', 'Mass Cure Wounds': 'strip', 'Mass Healing Word': 'strip',
        'Prayer of Healing': 'strip', 'False Life': 'clean', 'Healing Word': 'clean', 'Dispel Magic': 'clean',
      },
    }
    const actual = { '5e': {}, '2024': {} }
    for (const ruleset of ['5e', '2024']) {
      for (const name of AUDIT_NAMES) actual[ruleset][name] = classify(ruleset, name)
    }
    expect(actual).toStrictEqual(expected)
    // PROTECTED-name guards imported REAL (triggerSpells.js:42-57):
    expect(SERVICE_HANDLED_SPELLS.has('ray of enfeeblement')).toBe(true) // own-row adjacency proof
    expect(SERVICE_HANDLED_SPELLS.has("tasha's hideous laughter")).toBe(true) // never-strip pin
    expect(SERVICE_HANDLED_SPELLS.has('fear')).toBe(false) // modals lane boundary
    expect(SERVICE_HANDLED_SPELLS.has('silence')).toBe(false) // modals lane boundary
    // Sleet storm 2024 quirk: automation key PRESENT but .type absent ->
    // generic gate (:455) skips it; live span row without any strip:
    expect(diskRow('2024', 'Sleet Storm').automation).toBeTruthy()
    expect(diskRow('2024', 'Sleet Storm').automation.type).toBeUndefined()
  })

  // ------------------------------------------------------------------
  // S2 — RAW-disk hijack census (dead-twin scan, programmatic). Every
  // 'strip' name is intercepted EARLIER (:710) on raw disk bytes:
  // generic action carries metaCtx (triggerSpells.js:460). fix#121(a):
  // the :712 return now MERGES the post-cast block — surge + riders
  // run exactly once on consumed casts (fix#121(b): the mass-heal
  // automation types defer the SELF rider to their confirmFn). Span
  // services stay silent — the span rows are disk-dead twins unless an
  // automation-free payload legitimately arrives.
  // ------------------------------------------------------------------
  it('RAW disk rows for every strip-class name are hijacked EARLIER by handleGenericAutomation (:710) with the generic metaCtx-bearing action, span services stay silent, and the :712 merge runs post-cast riders exactly once (fix#121(a)/(b))', async () => {
    const hijacked = []
    for (const ruleset of ['5e', '2024']) {
      for (const name of AUDIT_NAMES) {
        if (classify(ruleset, name) !== 'strip') continue
        hijacked.push(`${ruleset}:${name}`)
        vi.clearAllMocks()
        runtime.getRuntimeValue.mockImplementation(() => [])
        const envelope = diskRow(ruleset, name) // RAW bytes — unstripped
        const before = cloneDeep(envelope)
        const playerStats = makePlayerStats(ruleset)
        const services = makeServices({ playerStats })
        const callerMetaCtx = { slotLevel: envelope.level || 0 }
        const sentinel = { type: 'popup', payload: { type: 'automation_info', name: `${name}-generic`, description: 'generic lane' } }
        automation.executeHandler.mockResolvedValue(sentinel)

        const res = await executeSpellCast(envelope, callerMetaCtx, services)

        expect(automation.executeHandler).toHaveBeenCalledTimes(1)
        // Discriminator vs the dedicated span handlers: the GENERIC action
        // carries metaCtx (triggerSpells.js:456-461) and the disk automation
        // untouched; dedicated heroism/longstrider actions never do.
        expect(automation.executeHandler).toHaveBeenCalledWith(
          { name: envelope.name, spell: envelope, automation: envelope.automation, metaCtx: stamped(callerMetaCtx) },
          playerStats, CAMPAIGN, MAP, services.characters,
        )
        expect(res).toStrictEqual({ automationPopup: sentinel }) // :712 passThrough forward
        // Span service + duel stay unreachable on this lane; fix#121(a):
        // the merged post-cast block DOES run — surge once, ally rider
        // once; the SELF rider is deferred exactly for the massHealUtils
        // automation types whose confirmFn owns it (fix#121(b)).
        for (const t of SPAN_TRIGGERS) expect(t).not.toHaveBeenCalled()
        expect(automation.checkCompelledDuelAttackExpiry).not.toHaveBeenCalled()
        const isMassHealType = ['mass_healing_word', 'prayer_of_healing', 'mass_cure_wounds'].includes(String(envelope.automation?.type || '').toLowerCase())
        expect(healRider.triggerPostCastSelfHeals).toHaveBeenCalledTimes(isMassHealType ? 0 : 1) // 'self' defer on massHealUtils routes
        expect(healRider.triggerPostCastAllyHeals).toHaveBeenCalledTimes(1)
        expect(wms.triggerWildMagicSurge).toHaveBeenCalledTimes(1)
        expect(envelope).toStrictEqual(before)
      }
    }
    // Census must actually cover the dead-twin roster (non-vacuous):
    for (const key of ['5e:Heroism', '2024:Heroism', '5e:Resistance', '2024:Resistance', '5e:Remove Curse', '2024:Mass Healing Word', '2024:Prayer of Healing']) {
      expect(hijacked).toContain(key) // dead twins declared in header; folded-heal disk fate stays visible
    }
    expect(hijacked).toHaveLength(23) // exact census size — matches the S1 expected table
  })

  // ------------------------------------------------------------------
  // S3 — Dispel Magic fallback (:266-272/:357): the CONSUMING face —
  // consumed through the real helpers.js ability check via the window
  // 'spell-result' side-channel (vs #1404 triggerSpells.js:447's
  // popup-discard remove-curse face pinned per-row above). Also pins
  // the fire-and-forget :341 healing rider (utility-roster heal face)
  // and the case-gate trail (#1457/58 same hop: :267 lowercases, :179
  // exact-case lookup console.errors).
  // ------------------------------------------------------------------
  it('Dispel Magic routes through the runDispelMagicFallback consuming lane: one exact spell-result check event after the fire-and-forget :341 healing-word rider, unhandled fallthrough resolves null, and UPPERCASE still routes while the exact-case lookup console.errors', async () => {
    const envelope = envelopeFor('5e', 'Dispel Magic') // disk-clean, no strip needed
    const playerStats = makePlayerStats('5e')
    const services = makeServices({ playerStats })
    const callerMetaCtx = { slotLevel: 3 }

    const res = await executeSpellCast(envelope, callerMetaCtx, services)

    // :341 healing rider fires fire-and-forget BEFORE the fallback :357.
    const { triggerHealingWord } = await import('../features/healingWordService.js')
    expect(triggerHealingWord).toHaveBeenCalledTimes(1)
    expect(triggerHealingWord).toHaveBeenCalledWith(envelope, stamped(callerMetaCtx), playerStats, CAMPAIGN, MAP)
    // Consuming fallback: exactly one check event, exact detail bytes
    // (d20 fixed by the dice factory; DC = 10 + slot).
    expect(dispelEvents).toHaveLength(1)
    expect(dispelEvents[0]).toStrictEqual({
      spellName: 'Dispel Magic', casterName: CASTER, targetName: 'Target',
      checkBonus: 5, targetDC: 13, d20: 10, total: 15, checkFailed: false, isDispelMagic: true,
    })
    expect(dice.rollExpression).toHaveBeenCalledTimes(1)
    expect(dice.rollExpression).toHaveBeenCalledWith('1d20')
    // Two logs, ordered: cast log first, ability_use check log second.
    expect(log.addEntry).toHaveBeenCalledTimes(2)
    expect(log.addEntry.mock.invocationCallOrder[1]).toBeGreaterThan(log.addEntry.mock.invocationCallOrder[0])
    const castLog = { ...log.addEntry.mock.calls[0][1], timestamp: undefined }
    expect(castLog).toStrictEqual({
      type: 'spell', characterName: CASTER, targetName: 'Target', spellName: 'Dispel Magic',
      spellLevel: 3, castingTime: '1 action', damageType: null, damageFormula: null,
      saveDC: null, concentration: false, description: diskRow('5e', 'Dispel Magic').description.join(' '), timestamp: undefined,
    })
    const checkLog = { ...log.addEntry.mock.calls[1][1], timestamp: undefined }
    expect(checkLog).toStrictEqual({
      type: 'ability_use', characterName: CASTER, abilityName: 'Dispel Magic',
      description: 'Dispel Magic ability check on Target: d20 (10) + 5 = 15 vs DC 13 — succeeded.', timestamp: undefined,
    })
    expect(typeof log.addEntry.mock.calls[1][1].timestamp).toBe('number')
    // The fallback never handles the cast (:360-362): unhandled -> no
    // damage lane (positions null, no dc/attack/damage) -> post-cast
    // triggers only -> null. executeHandler untouched (disk is clean).
    expect(automation.executeHandler).not.toHaveBeenCalled()
    expect(res).toBeNull()
    expect(errSpy).not.toHaveBeenCalled()

    // Case-gate trail: :267 lowercases the gate, :179 lookup is EXACT-case.
    vi.clearAllMocks()
    dispelEvents = []
    const upper = envelopeFor('5e', 'Dispel Magic')
    upper.name = 'DISPEL MAGIC'
    const res2 = await executeSpellCast(upper, callerMetaCtx, makeServices())
    expect(dispelEvents).toHaveLength(1) // name gate lowercased -> routes
    expect(dispelEvents[0].spellName).toBe('Dispel Magic') // helper stamp is literal
    expect(res2).toBeNull()
    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledWith('[spellCast] Spell not found in spells.json:', 'DISPEL MAGIC')
  })

  // ------------------------------------------------------------------
  // S4 — getTargetInfo null BACKSTOP (:269-270): the guarded counterpart
  // of the services lane's golden unguarded deref (:234, re-owned there,
  // #1360/#1458). Null target -> ZERO dispel events/checks; the cast
  // still pays post-cast triggers and falls through to null.
  // ------------------------------------------------------------------
  it('a null getTargetInfo trips the runDispelMagicFallback backstop (:270): zero check events, zero dispel log, but the :341 rider still fires and the cast resolves null', async () => {
    const envelope = envelopeFor('5e', 'Dispel Magic')
    const services = makeServices({ getTargetInfo: async () => null })

    const res = await executeSpellCast(envelope, { slotLevel: 3 }, services)

    expect(dispelEvents).toStrictEqual([])
    expect(dice.rollExpression).not.toHaveBeenCalled()
    expect(log.addEntry).toHaveBeenCalledTimes(1) // cast log only, no check log
    expect(log.addEntry.mock.calls[0][1].type).toBe('spell')
    expect(log.addEntry.mock.calls[0][1].targetName).toBeNull()
    const { triggerHealingWord } = await import('../features/healingWordService.js')
    expect(triggerHealingWord).toHaveBeenCalledTimes(1) // rider sits BEFORE the backstop (:341 vs :357)
    expect(automation.executeHandler).not.toHaveBeenCalled()
    expect(res).toBeNull()
    expect(errSpy).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // S5 — CLA-389 rider merge precedence (:597-601) on utility rows:
  // swallowed span rows surface the surge popup; forwarded rows keep
  // their own visible payload precedence (same-hop re-pin of the
  // services lane's :558 form, on THIS lane's rows).
  // ------------------------------------------------------------------
  it('CLA-389 merge: a swallowed stinking-cloud row surfaces the Wild Magic Surge popup, while a forwarded heroism executeHandler popup keeps precedence', async () => {
    const surge = { automationPopup: { type: 'popup', payload: { type: 'automation_info', name: 'Wild Magic Surge', description: 'surge' } } }

    // Swallow row (:311): lane value undefined -> surge wins (:599).
    const stinking = envelopeFor('5e', 'Stinking Cloud')
    const swStat = makePlayerStats('5e')
    wms.triggerWildMagicSurge.mockResolvedValue(surge)
    const res1 = await executeSpellCast(stinking, { slotLevel: 3 }, makeServices({ playerStats: swStat }))
    expect(res1).toStrictEqual(surge)
    expect(wms.triggerWildMagicSurge).toHaveBeenCalledWith(stinking, stamped({ slotLevel: 3 }), swStat, CAMPAIGN, MAP)

    // Forward row (:316): executeHandler popup is visible -> keeps precedence.
    vi.clearAllMocks()
    runtime.getRuntimeValue.mockImplementation(() => [])
    const heroism = envelopeFor('5e', 'Heroism') // stripped fixture — raw hijack is S2
    const hStat = makePlayerStats('5e')
    const popup = { type: 'popup', payload: { type: 'automation_info', name: 'Heroism', description: 'temp hp' } }
    automation.executeHandler.mockResolvedValue(popup)
    wms.triggerWildMagicSurge.mockResolvedValue(surge)
    const res2 = await executeSpellCast(heroism, { slotLevel: 1 }, makeServices({ playerStats: hStat }))
    expect(res2).toStrictEqual({ automationPopup: popup })
    expect(wms.triggerWildMagicSurge).toHaveBeenCalledTimes(1) // riders ran anyway
  })

  // ------------------------------------------------------------------
  // S6 — falsy-name triples (#1352) on THIS lane's REAL triggerSpells
  // guards: every span gate returns { handled:false } untouched and no
  // downstream service/executeHandler fires.
  // ------------------------------------------------------------------
  it('falsy spell.name triples leave every utility guard unhandled with zero service and executeHandler calls', async () => {
    const obj = (spell) => [{ spell, metaCtx: stamped({ slotLevel: 3 }), spellSaveDc: SAVE_DC, playerStats: makePlayerStats('5e'), campaignName: CAMPAIGN, mapName: MAP, characters: [], getTargetInfo: async () => ({ name: 'Target' }) }]
    const objEx = (spell) => [{ spell, metaCtx: stamped({ slotLevel: 3 }), playerStats: makePlayerStats('5e'), campaignName: CAMPAIGN, mapName: MAP, characters: [], executeHandler: automation.executeHandler }]
    const pos3 = (spell) => [spell, stamped({ slotLevel: 3 }), makePlayerStats('5e'), CAMPAIGN, MAP]
    const posExec = (spell) => [spell, makePlayerStats('5e'), CAMPAIGN, MAP, automation.executeHandler]
    const guards = [
      [ts.handleRayOfEnfeeblement, obj], [ts.handleCompelledDuel, obj],
      [ts.handleGlobeOfInvulnerability, pos3], [ts.handleForcecage, pos3],
      [ts.handleStinkingCloud, obj], [ts.handleSleetStorm, obj],
      [ts.handleFaerieFire, obj], [ts.handleTashasHideousLaughter, obj],
      [ts.handleImprisonment, obj], [ts.handleHeroism, objEx],
      [ts.handleHolyAura, pos3], [ts.handleLongstrider, posExec],
      [ts.handleSpareTheDying, objEx], [ts.handleEnhanceAbility, objEx],
      [ts.handleProtectionFromEnergy, posExec], [ts.handleProtectionFromPoison, posExec],
      [ts.handleRemoveCurse, pos3], [ts.handleResistance, objEx],
    ]
    for (const [fn, shape] of guards) {
      for (const bad of [{}, { name: '' }, { name: null }]) {
        const out = await fn(...shape(bad))
        expect(out).toStrictEqual({ handled: false })
      }
    }
    for (const t of SPAN_TRIGGERS) expect(t).not.toHaveBeenCalled()
    expect(automation.executeHandler).not.toHaveBeenCalled()
    expect(automation.checkCompelledDuelAttackExpiry).not.toHaveBeenCalled()
  })
})
