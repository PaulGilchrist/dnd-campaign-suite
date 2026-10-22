// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  PWH HUB-EDGE LANE (#1481/#1487 family) — executeSpellCast hub    */
/*  (execution/index.js:669) routed LIVE past :702 into the CLA-392  */
/*  spread gate (modalSpells.js:9-:23) and the helpers chain          */
/*  (helpers.js:190-:275), which stay REAL here.                      */
/*                                                                    */
/*  DEDUPE ADJUDICATION VERDICT (this turn, #1487 verbatim):          */
/*  :17/:33 read REAL — `if (metaCtx?.multiTarget && metaCtx          */
/*  .multiTarget !== firstTargetName)` spreads the SECOND apply only  */
/*  when it differs from the resolved first target. Masking confirmed:*/
/*  a same-name cast with a MUTATING snapshot yields healAmount 0 on  */
/*  the second leg (helpers.js:192 silent return), conditions equal    */
/*  length (no :232 write), stand-permission already set (:249 skips) */
/*  -> a dedupe mutant is byte-identical through a stateful hub. So: */
/*  - branch bytes face: modalSpells.powerWordSpread #1487 Row E owns */
/*    multiTarget===first dedupe (injected fake apply, times(1),      */
/*    un-maskable there); useSpellMetamagicGates.powerWordKillSlots   */
/*    :8-9 delegation STANDS.                                          */
/*  - hub face (THIS file, #1481 verbatim 'owns hub edge cases incl.  */
/*    multiTarget-equals-first dedup + strip'): pinned NON-maskably   */
/*    via the lane-canonic PURE RECORDER applyHealing mock (#1481     */
/*    :167 form, byte-faithful from args, non-mutating) + gap>0       */
/*    fixture (Thug currentHp 12 < maxHp 32, delta-0 never reachable) */
/*    + FULL censuses: a dedupe mutant doubles applyHealing,           */
/*    addEntry and setRuntimeValue censuses exactly.                   */
/*                                                                    */
/*  FAMILY BOUNDARY TABLE (cited, never re-grown):                    */
/*   - index.js :702 early-arm + popup dispatch + PW-:10-unguarded-   */
/*     asymmetry -> earlyReturns-modal #1471.                         */
/*   - helpers chain apply/strip/census bytes + ghost-log quirk +     */
/*     full-HP delta-0 skip + abort guards + heal-before-write tap -> */
/*     helpers-powerWordHeal #1481.                                   */
/*   - spread gate CLA-392 shared-summary + injected fake + Row E     */
/*     dedupe -> modalSpells.powerWordSpread #1487.                   */
/*   - hub traversal first+distinct-multiTarget spread + runtime-HP-  */
/*     beats-snapshot + popup consume-trail #1392 + producer-null     */
/*     fold-back + post-cast-rider bypass -> spellCastService.heal.   */
/*     test.js #1454.                                                 */
/*   - THIS face: PW-heal-specific hub edge routing — same-name       */
/*     dedupe census + strip (cited), null-first-target edge +        */
/*     rules:'2024' transport bytes (disk-2024-only existence, the    */
/*     spell is ABSENT from the 5e disk #1450), and the 5e-transport  */
/*     asymmetry golden (name gate has NO rules guard — cast still     */
/*     consumed at :702, console tuple exact).                        */
/*                                                                    */
/*  LIVE-vs-HIJACKED CENSUS: all three rows cast the REAL 2024 disk   */
/*  name 'Power Word Heal' and are HIJACKED at :702 (first arm of     */
/*  runTriggerChain). LIVE past :702: nothing — :703 kill arm, :710   */
/*  handleGenericAutomation (executeHandler times(0) censused R1) and */
/*  the :715 no-damage path never run; riders bypass is #1454-owned. */
/*  getTargetInfo-declined path = R2 (undefined result survives ?.    */
/*  :12, falsy-triple collapse cited #1352/#1487 row C); modal-       */
/*  resolved first target = R1/R3.                                    */
/*                                                                    */
/*  QUIRK SCAN (byte evidence): golden unguarded-deref :10 -> cited   */
/*  #1360/#1487 row Q, skipped here. :0-swallow / delta-0 family ->  */
/*  DESIGN choice: gap-20 fixture dodges the mask (#1481 owns the     */
/*  skip-vs-log contrast :311). 'null + N' #1469: popup concat lives  */
/*  helpers :215 — popup BYTE owned #1454/#1392; counts pinned here. */
/*  Case trails #1457 -> cited #1487 row F (disk canonical case used  */
/*  here). Dead twins #1495 precedence form -> LIVE-vs-hijack table    */
/*  above. Chokepoint inline-dup #1357/58: the CLA-399                */
/*  lastActionSpellCast stamp (index.js:68) appears ONCE in every     */
/*  full setRuntimeValue census, FIRST in order. invocationCallOrder    */
/*  #1490/#1481: heal-before-write tap censused R1. Arity pins       */
/*  #1488: applyHealing tuples are length-4 exact; getTargetInfo is   */
/*  arity-0 times(3) (blockChecks :655 + log :234 + gate :11).        */
/*  NO-CLOCK: heal instantaneous; Date.now fixed only for census      */
/*  determinism, no timers, persistence seam-owned.                   */
/*                                                                    */
/*  MOCK ROSTER (#1440 line-by-line vs REAL index.js import list +   */
/*  graph-transitive of loaded REAL files helpers/modalSpells/         */
/*  triggerSpells/blockChecks/spellResolution): every *Service mock    */
/*  has a live consumer. DEAD-MODULE MOCKS REMOVED (#1484-97 hunt):   */
/*  fearService, foresightService, heroismService, sleepService —      */
/*  handleFear/handleSleep (modalSpells :122/:184) and handleHeroism   */
/*  (triggerSpells :471) are self-contained; grep of the whole loaded */
/*  graph: zero importers. Unit under test (index.js + helpers +      */
/*  modalSpells) never mocked.                                         */
/*                                                                    */
/*  FIXTURE PROVENANCE: spell rows are REAL cloneDeep bytes from     */
/*  public/data/2024/spells.json (existence census throws at load if   */
/*  the disks drift, #1494/#1497 form — incl. the #1450 ABSENCE       */
/*  census on the 5e disk). Thug hit_points 32 = monsters.json REAL;  */
/*  currentHp 12 = documented synthetic in-combat probe (non-           */
/*  impersonating, gap 20). 'Thug 1' instance + caster 'HeroesFeast-  */
/*  Bard' REAL test-campaign names per #1487 precedent. Campaign       */
/*  locked 'test-campaign'.                                            */
/*                                                                    */
/*  KILL MATRIX (live cp-backup mutants ONLY, never git checkout):    */
/*  M1 dedupe `!==` removed :17 -> R1 censuses double (apply/addEntry */
/*  /setRuntimeValue lengths). M2 first-target branch :14 removed ->   */
/*  R1 zero applies. M3 multiTarget branch :17 dropped -> R2 zero      */
/*  applies. M4 URL tier flip :175 -> R2 fetch byte. M5 rules guard    */
/*  added :10 -> R3 dies (console tuple + apply census). M6 stamp       */
/*  moved after gate :68 -> R1 census ORDER. M7 reroute via :710 ->    */
/*  executeHandler times(0). M8 producer-foldback :195 canned -> hp    */
/*  delta byte (recorder computes from args, never baked). M9 silent-   */
/*  return on null summary removed -> #1481 abort guards own.          */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import spells5e from '../../../../../../public/data/spells.json'
import spells2024 from '../../../../../../public/data/2024/spells.json'

/* Existence-census drift-throw (#1494/#1497 form, preflight catch):
   Power Word Heal is 2024-only on disk (#1450); its automation byte
   block carries exactly the five lowercase strip candidates. */
const PWH_ROW = spells2024.find(s => s.name === 'Power Word Heal')
if (!PWH_ROW) throw new Error('Power Word Heal missing from 2024 disk — fixtures must be REAL rows')
if (spells5e.some(s => s.name === 'Power Word Heal')) throw new Error('Power Word Heal unexpectedly present on 5e disk — #1450 absence census drifted')
if (JSON.stringify(PWH_ROW.automation.conditions) !== JSON.stringify(['charmed', 'frightened', 'paralyzed', 'poisoned', 'stunned'])) throw new Error('PWH automation.conditions bytes drifted from the five strip candidates')

const CAMPAIGN = 'test-campaign'
const CASTER = 'HeroesFeastBard' /* REAL test-campaign character (#1487 precedent); Bard lv-caster — disk classes ['Bard','Cleric'] */
const THUG = 'Thug 1' /* instance name = test-campaign maps/test-map.json (#1487 precedent) */
const TS = 1700000000000
const GAP = 20 /* maxHp 32 (monsters.json Thug REAL) - currentHp 12 (documented synthetic in-combat probe) */

/* ---------------- Mocks — live dependency roster of index.js ---------------- */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../../../rules/spells/postCastRiderService.js', () => ({
  // REAL-Promise-shape mocks (#1449 canon): fix#121(a) routes the early PWH/PWK
  // lane through runPostCastTriggers — the hub consumes .catch() on these.
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerSpellThief: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve(null)),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('../../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve(null)),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../../../rules/features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
  triggerSilence: vi.fn(),
}))

vi.mock('../../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../../../../rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

vi.mock('../../../../rules/features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../../../rules/features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../../../rules/features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../../../rules/features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../../../rules/features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/fleshToStoneService.js', () => ({
  triggerFleshToStone: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/hypnoticPatternService.js', () => ({
  triggerHypnoticPattern: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/massSuggestionService.js', () => ({
  triggerMassSuggestion: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/suggestionService.js', () => ({
  triggerSuggestion: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/ottoDanceService.js', () => ({
  triggerOttoDance: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/resilientSphereService.js', () => ({
  triggerResilientSphere: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/rayOfEnfeeblementService.js', () => ({
  triggerRayOfEnfeeblement: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/globeOfInvulnerabilityService.js', () => ({
  triggerGlobeOfInvulnerability: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/forcecageService.js', () => ({
  triggerForcecage: vi.fn(async () => {}),
}))

vi.mock('../../../../automation/handlers/spells/forcecageHandler.js', () => ({
  isForcecageBlocked: vi.fn(() => false),
}))

vi.mock('../../../../rules/features/holyAuraService.js', () => ({
  triggerHolyAura: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/powerWordStunService.js', () => ({
  triggerPowerWordStun: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/seeInvisibilityService.js', () => ({
  triggerSeeInvisibility: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/stinkingCloudService.js', () => ({
  triggerStinkingCloud: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/tashasHideousLaughterService.js', () => ({
  triggerTashasHideousLaughter: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/removeCurseService.js', () => ({
  triggerRemoveCurse: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/slowService.js', () => ({
  triggerSlow: vi.fn(async () => {}),
}))

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../../../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

vi.mock('../../../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../../../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

vi.mock('../../../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

import { executeSpellCast } from './index.js'
import * as runtimeState from '../../../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../../ui/logService.js'
import { executeHandler } from '../../../../automation/index.js'
import { applyHealingToTarget } from '../../../../rules/combat/applyHealing.js'
import { getCombatContext } from '../../../../rules/combat/damageUtils.js'

/* ---------------- Fixtures & helpers ---------------- */

/* Snapshot authority: monster row (type absent -> helpers.js:268-:271
   take maxHp/currentHp from the snapshot, no runtime HP override). */
const SUMMARY = { creatures: [{ name: THUG, maxHp: 32, currentHp: 12 }] }

const ALL_FIVE = PWH_ROW.automation.conditions /* REAL lowercase disk bytes */

function makeCaster(rules) {
  return {
    name: CASTER,
    rules,
    abilities: [{ name: 'Charisma', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Charisma', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
  }
}

function makeServices(playerStats, getTargetInfo) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats,
    getTargetInfo,
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: 'test-map',
    characters: [{ name: THUG }],
  }
}

const spellLogEntry = (targetName) => ({
  type: 'spell',
  characterName: CASTER,
  targetName,
  spellName: PWH_ROW.name,
  spellLevel: 9,
  castingTime: 'Action',
  damageType: null,
  damageFormula: null,
  saveDC: null,
  concentration: false, /* REAL disk byte: PWH is instantaneous, non-concentration */
  description: PWH_ROW.description.join(' '),
  timestamp: TS,
})

const hpEntry = {
  type: 'hp_change',
  targetName: THUG,
  delta: GAP,
  currentHp: 32,
  maxHp: 32,
  isHealing: true,
  sourceName: CASTER,
  note: 'Power Word Heal',
  timestamp: TS,
}

const condTuple = (Name) => [CAMPAIGN, {
  type: 'condition',
  action: 'removed',
  characterName: THUG,
  condition: Name,
  reason: 'Power Word Heal',
  timestamp: TS,
}]

const popupDetail = (name) => ({
  targetName: name,
  sourceName: CASTER,
  healingName: 'Power Word Heal',
  rollInfo: '',
  maximizeHealingDice: false,
  popupText: `Power Word Heal on ${name}: Regained ${GAP} HP`,
})

let consoleError
let consoleWarn
let popups
const onPopup = (e) => popups.push(e.detail)

describe('executeSpellCast — Power Word Heal hub edge routing (index.js:702 early arm)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    /* URL-aware fetch stub (#1454 canon): REAL disk bytes on BOTH tiers so
       lookupFullSpell (:170-:189) resolves on 2024 and honestly MISSES on
       5e — no unmocked-fetch noise, no canned outcome. */
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })))
    getCombatContext.mockResolvedValue(SUMMARY)
    /* PURE RECORDER boundary (#1481 :167 canon): return shape faithful to
       the REAL producer, computed FROM ARGS — never baked, never mutating
       the snapshot. This is what makes the :17 dedupe hub pin un-maskable:
       every apply leg leaves an exact census entry. */
    applyHealingToTarget.mockImplementation((summary, name, amount) =>
      ({ actualHeal: amount, oldHp: summary.creatures.find(c => c.name === name).currentHp, newHp: 32 }))
    vi.spyOn(Date, 'now').mockReturnValue(TS)
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    popups = []
    window.addEventListener('healing-popup', onPopup)
  })

  afterEach(() => {
    window.removeEventListener('healing-popup', onPopup)
    vi.unstubAllGlobals()
    consoleError.mockRestore()
    consoleWarn.mockRestore()
    vi.restoreAllMocks()
  })

  it('multiTarget EQUALS the resolved first target: the :17 !== gate dedupes to exactly ONE full-apply leg through the whole hub — heal forward, five-condition strip census, stand-permission, popup — censused against the delta-0 mask', async () => {
    runtimeState.getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return char === THUG ? [...ALL_FIVE, 'prone'] : []
      if (key === 'targetEffects') return []
      return undefined
    })
    const services = makeServices(makeCaster('2024'), vi.fn(async () => ({ name: THUG })))

    const result = await executeSpellCast(cloneDeep(PWH_ROW), { slotLevel: 9, multiTarget: THUG }, services)

    expect(result).toBeUndefined() /* { handled: true } envelope -> passThrough value undefined (:712) */
    /* Un-maskable dedupe census (M1/M2): EXACTLY one forward tuple, arity 4,
       shared snapshot BY IDENTITY (M4-CLA-392 via hub), gap-to-max computed. */
    expect(applyHealingToTarget.mock.calls).toEqual([[SUMMARY, THUG, GAP, CAMPAIGN]])
    expect(getCombatContext).toHaveBeenCalledTimes(1)
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN)
    expect(getTargetInfoCalls(services)).toBe(4) /* blockChecks :655 + log :234 + gate :11 + the fix#121(a) merged post-cast :510 hexTarget read — arity 0 */
    /* Full write census, exact order: CLA-399 stamp once FIRST (M6), then the
       survivor strip ['prone'], then stand-permission (M1 doubles all three). */
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [CASTER, 'lastActionSpellCast', 1, CAMPAIGN],
      [THUG, 'activeConditions', ['prone'], CAMPAIGN],
      [THUG, 'powerWordHealStandPermission', true, CAMPAIGN],
    ])
    /* Full log census: spell log -> hp_change -> five condition removals
       (REAL automation.conditions bytes, capitalized at helpers :239). */
    expect(addEntry.mock.calls).toEqual([
      [CAMPAIGN, spellLogEntry(THUG)],
      [CAMPAIGN, hpEntry],
      condTuple('Charmed'), condTuple('Frightened'), condTuple('Paralyzed'),
      condTuple('Poisoned'), condTuple('Stunned'),
    ])
    expect(popups).toEqual([popupDetail(THUG)])
    /* Hijack census: consumed at :702 — generic automation (:710) never runs (M7). */
    expect(executeHandler).toHaveBeenCalledTimes(0)
    /* Heal-before-write tap (#1490/#1481). */
    expect(applyHealingToTarget.mock.invocationCallOrder[0])
      .toBeLessThan(runtimeState.setRuntimeValue.mock.invocationCallOrder[1])
    expect(consoleError).toHaveBeenCalledTimes(0)
    expect(consoleWarn).toHaveBeenCalledTimes(0)
  })

  it('NULL-FIRST edge on rules 2024 transport: undefined getTargetInfo result survives ?.(:12), fetches the 2024 disk tier once, heals only the chooser multiTarget, spell-log targetName folds null', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'activeConditions') return []
      if (key === 'targetEffects') return []
      return undefined
    })
    const services = makeServices(makeCaster('2024'), vi.fn(async () => undefined))

    const result = await executeSpellCast(cloneDeep(PWH_ROW), { slotLevel: 9, multiTarget: THUG }, services)

    expect(result).toBeUndefined()
    /* Transport byte (M4): rules:'2024' routes lookupFullSpell to '/data/
       2024/spells.json' — the ONLY tier where this spell exists (#1450). */
    expect(globalThis.fetch.mock.calls).toEqual([['/data/2024/spells.json']])
    /* M3: the :17 multiTarget leg is the only apply when first folds null;
       falsy-triple collapse (undefined result) cited #1352/#1487 row C. */
    expect(applyHealingToTarget.mock.calls).toEqual([[SUMMARY, THUG, GAP, CAMPAIGN]])
    expect(getTargetInfoCalls(services)).toBe(4) /* + fix#121(a) merged post-cast :510 hexTarget read */
    /* No conditions stored -> zero strip writes/logs (strip bytes R1 + #1481). */
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [CASTER, 'lastActionSpellCast', 1, CAMPAIGN],
    ])
    expect(addEntry.mock.calls).toEqual([
      [CAMPAIGN, spellLogEntry(null)],
      [CAMPAIGN, hpEntry],
    ])
    expect(popups).toEqual([popupDetail(THUG)])
    expect(executeHandler).toHaveBeenCalledTimes(0)
    expect(consoleError).toHaveBeenCalledTimes(0)
    expect(consoleWarn).toHaveBeenCalledTimes(0)
  })

  it('5e-transport asymmetry golden: the :10/:702 gate is NAME-based with NO rules guard — a cast whose transport points at the 5e disk (where Power Word Heal is absent) logs the exact not-found console tuple once and still heals via the hub', async () => {
    runtimeState.getRuntimeValue.mockImplementation((char, key) => {
      if (key === 'activeConditions') return char === THUG ? ['prone'] : []
      if (key === 'targetEffects') return []
      return undefined
    })
    const services = makeServices(makeCaster('5e'), vi.fn(async () => ({ name: THUG })))

    const result = await executeSpellCast(cloneDeep(PWH_ROW), { slotLevel: 9 }, services)

    expect(result).toBeUndefined()
    expect(globalThis.fetch.mock.calls).toEqual([['/data/spells.json']])
    /* Exact-console-tuple (#1494-97 form): index.js:183 fires ONCE; the
       lookup miss does NOT abort the already-routed cast (M5: adding any
       rules guard at the gate kills this row AND the apply census). */
    expect(consoleError.mock.calls).toEqual([['[spellCast] Spell not found in spells.json:', PWH_ROW.name]])
    expect(consoleWarn).toHaveBeenCalledTimes(0)
    expect(applyHealingToTarget.mock.calls).toEqual([[SUMMARY, THUG, GAP, CAMPAIGN]])
    expect(getTargetInfoCalls(services)).toBe(4) /* + fix#121(a) merged post-cast :510 hexTarget read */
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [CASTER, 'lastActionSpellCast', 1, CAMPAIGN],
      [THUG, 'powerWordHealStandPermission', true, CAMPAIGN],
    ])
    /* Prone survives the empty-strip-candidate set -> no conditions write
       (:231 equal length) and no condition removals logged; the complete
       addEntry census is spell log + hp_change only. */
    expect(addEntry.mock.calls).toEqual([
      [CAMPAIGN, spellLogEntry(THUG)],
      [CAMPAIGN, hpEntry],
    ])
    expect(popups).toEqual([popupDetail(THUG)])
    expect(executeHandler).toHaveBeenCalledTimes(0)
  })
})

function getTargetInfoCalls(services) {
  return services.getTargetInfo.mock.calls.length
}
