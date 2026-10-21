// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'

/* ------------------------------------------------------------------ */
/*  SPECIAL LANE (#1454 split-table face: "dual-name routing,          */
/*  fear/hypnotic modals, forcecage routing") — trimmed to the faces   */
/*  no sibling lane pins, per LIVE REC #1/#2 (#1457).                  */
/*                                                                     */
/*  LIVE REC #1 EXECUTED: the old :209 fear-modal describe is GONE — */
/*  weaker duplicate of .noformula-modals (owner :290, hub :279 →     */
/*  modalSpells.js:184 full-byte pins). No fear row remains here.    */
/*  LIVE REC #2 EXECUTED as STRENGTHEN: the hypnoticPattern modal row */
/*  is the ONLY lane running the REAL producer handleHypnoticPattern- */
/*  Early (execution/earlyReturns-modal.test.js:386 MOCKS it and only */
/*  pins modalName; .noformula-modals :35-37 disclaims early-chain    */
/*  modals; .noformula-services :521 pins modalName + dead twin only) */
/*  — so this file uniquely pins the exact payload bytes, the CLA-219 */
/*  false-stamp, the innate-sorcery +1, and the early-chain :709      */
/*  post-cast-rider BYPASS.                                            */
/*                                                                     */
/*  FOLDED OUT (covered stronger by maintained owners — report only):  */
/*   - Hold Monster/Hold Person both-names → .noformula-services span */
/*     rows :288-289 roster (live exact tuples).                       */
/*   - Longstrider/Resistance/Protection rows → .noformula-utility    */
/*     spans :318/:346/:347/:359 + hijack census (heroism/resistance */
/*     confirmed :710-hijacked there; forcecage strip census :511/:520*/
/*     owned there too — coordinate: utility pins the strip-required   */
/*     span FORWARD with sentinel; THIS lane keeps the complementary   */
/*     pair nobody else pins live: the RAW-disk :710 hijack of the   */
/*     automation-carrying Forcecage row (real-producer gate via hub) */
/*     and the automation-free span's NULL-discard consume + riders.  */
/*   - Friends/Ray/Compelled Duel target+saveDC rows → services       */
/*     roster (Friends forward, exact tuples) and utility :306/:307    */
/*     (ray duel side-route with invocationCallOrder).                 */
/*   - checkForcecageBlocked unit rows → blockChecks.test.js:208-255  */
/*     owner; hub block integration → execution-block-checks :372.     */
/*   - generic-automation gate internals → triggerSpells.test.js:27;  */
/*     hub consumption → earlyReturns-generic :273 (mocked producer).  */
/*                                                                     */
/*  DUAL-NAME face that stays HERE (unique, live disk bytes): the     */
/*  edition-rename alias gates — 5e disk 'Irresistible Dance' vs 2024 */
/*  "Otto's Irresistible Dance" (triggerSpells.js:210 dual literals,  */
/*  #1389 no-trim gate) and 5e 'Resilient Sphere' vs 2024              */
/*  "Otiluke's Resilient Sphere" (triggerSpells.js:218). Both names    */
/*  must dispatch to the SAME service with the SAME stamped tuple, and */
/*  despite their raw disk automation.type they must NEVER be hijacked */
/*  by :710 (SERVICE_HANDLED_SPELLS shield, triggerSpells.js:42-57).  */
/*  #1423 gate-mismatch family discriminator: 5e disk name is 'Hideous */
/*  Laughter' but the Tasha span gate (:387) is the SINGLE literal     */
/*  "tasha's hideous laughter" — the 5e row slips past its own span    */
/*  (pinned negative below; 2024 full-name positive in same test).     */
/*                                                                     */
/*  Consume/discard per routed row HERE: Otto/sphere span = swallow   */
/*  (index.js:75 → res exactly undefined, #1441 silent-null); Tasha   */
/*  span = RAW forward (triggerSpells.js:389, identity === sentinel);  */
/*  Forcecage span = forward, null trigger → handled-discard           */
/*  (res undefined, slot paid, riders run once via :720 CLA-389);     */
/*  hypnotic EARLY modal + generic hijack = direct :709 return, riders*/
/*  NEVER run (:712 early-chain bypass).                              */
/*  Case-gate trail (#1457/59): span gates lowercase while lookupFull- */
/*  Spell (:179) is exact-case — every envelope below is a REAL disk   */
/*  row, so console.error must stay silent (anti-fabrication proof).   */
/*  No-clock: nothing here resolves on wall time. No game-state timers. */
/*  Security (#1446): fixtures come solely from repo disk JSON; no      */
/*  untrusted/foreign content is embedded or echoed.                    */
/*                                                                     */
/*  Cited-by: ottoDanceService.test.js:12 → the dual-name span below   */
/*  (range preserved, old :165 → new OTTO alias loop).                  */
/*  compelledDuelService.test.js:9 cited old :186-204 (target+saveDC); */
/*  that face FOLDED to .noformula-utility :307 duel row — redirect    */
/*  cite there (cross-file edit not permitted here).                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — external edges only, real-Promise-shaped (#1440/1449).    */
/*  logService added (#1455 canon): the real addEntry POSTs /api/log  */
/*  — every lane pins a stub, this file was silently network-hopping. */
/*  fearService/foresightService/heroismService mocks REMOVED: inert   */
/*  entries not in the live import graph (.noformula-modals :71-73    */
/*  precedent). fetch is URL-aware serving the REAL disk tables;       */
/*  unknown URLs reject loudly.                                         */
/* ------------------------------------------------------------------ */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => undefined),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => (formula ? { total: 10, rolls: [1, 2, 3, 4], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null)),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
  checkCompelledDuelAttackExpiry: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

// Feature modules reachable via the trigger chain / early chain — inert
// no-op isolation; the four asserted spans (otto/sphere/tasha/forcecage +
// hypnotic twin) are imported REAL-below for tuple assertions.
vi.mock('../features/smiteOfProtectionService.js', () => ({ triggerSmiteOfProtection: vi.fn(async () => {}) }))
vi.mock('../features/inspiringSmiteService.js', () => ({ triggerInspiringSmite: vi.fn(async () => {}) }))
vi.mock('../features/primalCompanionSpellShareService.js', () => ({ triggerPrimalCompanionSpellShare: vi.fn(async () => {}) }))
vi.mock('../features/wildMagicSurgeService.js', () => ({ triggerWildMagicSurge: vi.fn(async () => {}) }))
vi.mock('../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => {}) }))
vi.mock('../features/healingWordService.js', () => ({ triggerHealingWord: vi.fn(async () => {}) }))
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
vi.mock('../../automation/handlers/spells/forcecageHandler.js', () => ({ isForcecageBlocked: vi.fn(() => false) }))
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
  triggerPostCastAllyHeals: vi.fn(async () => null),
}))

import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as automation from '../../automation/index.js'
import * as buff from '../../combat/buffs/buffService.js'
import * as rider from './postCastRiderService.js'
import { triggerOttoDance } from '../features/ottoDanceService.js'
import { triggerResilientSphere } from '../features/resilientSphereService.js'
import { triggerTashasHideousLaughter } from '../features/tashasHideousLaughterService.js'
import { triggerForcecage } from '../features/forcecageService.js'
import { triggerHypnoticPattern } from '../features/hypnoticPatternService.js'

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk rows only (fabricated envelopes banned,      */
/*  #1455/57/58 canon). The one documented strip below (Forcecage)    */
/*  mirrors the live automation-free caster envelope; it is honest,    */
/*  never silent — the RAW half of the same test pins the hijack.     */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign'
const MAP = 'testMap'
const CASTER = 'TestWizard'
const SAVE_DC = 17 // 8 + Int 5 + prof 4 — matches makePlayerStats below

function diskRow(name, ruleset = '5e') {
  const table = ruleset === '2024' ? spells2024 : spells5e
  const row = table.find((s) => s.name === name)
  if (!row) throw new Error(`disk fixture missing: ${ruleset} ${name}`)
  return cloneDeep(row)
}

function makePlayerStats(overrides = {}) {
  return {
    name: CASTER,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: SAVE_DC, modifier: 5 },
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

const stamped = (callerMetaCtx) => ({ ...callerMetaCtx, metamagicHeighten: false }) // CLA-219, index.js:680

let fetchCalls
let errSpy
function jsonResponse(data) {
  return { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) }
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - special lane (edition-rename alias gates, tasha gate-mismatch, hypnotic early modal bytes, forcecage hijack-vs-span)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    runtime.getRuntimeValue.mockImplementation((_k, key2) =>
      key2 === 'activeConditions' || key2 === 'targetEffects' ? [] : undefined)
    buff.isInnateSorceryActive.mockReturnValue(false)
    rider.triggerPostCastRiderSaves.mockResolvedValue(null)
    automation.executeHandler.mockResolvedValue(undefined)
    for (const t of [triggerOttoDance, triggerResilientSphere, triggerTashasHideousLaughter, triggerForcecage, triggerHypnoticPattern]) {
      t.mockResolvedValue(undefined)
    }
    fetchCalls = []
    vi.stubGlobal('fetch', vi.fn((url) => {
      fetchCalls.push(url)
      if (url === '/data/spells.json') return Promise.resolve(jsonResponse(spells5e))
      if (url === '/data/2024/spells.json') return Promise.resolve(jsonResponse(spells2024))
      return Promise.reject(new Error(`unexpected fetch in special lane: ${url}`))
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    errSpy.mockRestore()
  })

  // ------------------------------------------------------------------
  // Dual-name routing — edition-rename alias gates (#1389 dual literals).
  // Cited-by ottoDanceService.test.js:12 (span preserved here).
  // Both disk names per service dispatch to the SAME trigger with the
  // SAME stamped tuple; swallow consume => exactly undefined (#1441);
  // raw disk automation must be :710-shielded (SERVICE_HANDLED, #1459
  // hijack census position: otto/sphere PROTECTED — never stripped,
  // never hijacked — unlike heroism/resistance which the census marks
  // strip-or-hijacked and .noformula-utility pins).
  // ------------------------------------------------------------------
  describe('edition-rename dual-name gates', () => {
    it.each([
      {
        label: "Otto's Irresistible Dance",
        trigger: triggerOttoDance,
        other: triggerResilientSphere,
        names: [['Irresistible Dance', '5e'], ["Otto's Irresistible Dance", '2024']],
      },
      {
        label: 'Resilient Sphere',
        trigger: triggerResilientSphere,
        other: triggerOttoDance,
        names: [['Resilient Sphere', '5e'], ["Otiluke's Resilient Sphere", '2024']],
      },
    ])('$label: both disk names route to the same trigger with an identical stamped tuple, swallow, and never hit the generic hijack', async ({ trigger, other, names }) => {
      for (const [name, ruleset] of names) {
        vi.clearAllMocks()
        fetchCalls = []
        const envelope = diskRow(name, ruleset)
        const services = makeServices({ playerStats: makePlayerStats({ rules: ruleset }) })
        const callerMetaCtx = { slotLevel: envelope.level }

        const res = await executeSpellCast(envelope, callerMetaCtx, services)

        expect(trigger).toHaveBeenCalledTimes(1)
        expect(trigger).toHaveBeenCalledWith(
          envelope,
          { ...stamped(callerMetaCtx), spellSaveDc: SAVE_DC },
          services.playerStats, CAMPAIGN, MAP,
        )
        expect(trigger.mock.calls[0][0]).toBe(envelope) // envelope identity
        expect(trigger.mock.calls[0][1]).not.toBe(callerMetaCtx) // fresh CLA-219-stamped ctx
        expect(other).not.toHaveBeenCalled() // per-name discrimination
        expect(automation.executeHandler).not.toHaveBeenCalled() // SERVICE_HANDLED shield vs raw disk automation.type
        expect(rider.triggerPostCastRiderSaves).toHaveBeenCalledTimes(1) // CLA-389 span merge
        expect(res).toBeUndefined() // swallow => exactly undefined
        expect(errSpy).not.toHaveBeenCalled() // real disk names: zero lookup misses
      }
    })
  })

  // ------------------------------------------------------------------
  // #1423 gate-mismatch discriminator — unique to this lane:
  // 5e disk row is named 'Hideous Laughter'; the span gate
  // (triggerSpells.js:387) matches only "tasha's hideous laughter",
  // so the 5e disk-named cast slips past its OWN span. The name is
  // still SERVICE_HANDLED (:54) so the :710 hijack spares it too —
  // the row reaches neither lane. The 2024 full-name row routes
  // (positive control; RAW-forward quirk, triggerSpells.js:389).
  // ------------------------------------------------------------------
  it(`'Hideous Laughter' (real 5e disk name) slips past the single-literal Tasha span and the generic hijack, while "Tasha's Hideous Laughter" (real 2024 disk name) routes and raw-forwards its payload`, async () => {
    // Negative half — the live gate-mismatch.
    const negative = diskRow('Hideous Laughter', '5e')
    const services = makeServices()
    const negRes = await executeSpellCast(negative, { slotLevel: 1 }, services)

    expect(triggerTashasHideousLaughter).not.toHaveBeenCalled()
    expect(automation.executeHandler).not.toHaveBeenCalled()
    expect(negRes?.automationPopup).toBeUndefined()
    expect(errSpy).not.toHaveBeenCalled() // exact-case lookup finds the 5e disk row

    // Positive control — same gate, matching name.
    vi.clearAllMocks()
    fetchCalls = []
    const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Tasha', description: 'down you go' } }
    triggerTashasHideousLaughter.mockResolvedValue(sentinel)
    const positive = diskRow("Tasha's Hideous Laughter", '2024')
    const services2024 = makeServices({ playerStats: makePlayerStats({ rules: '2024' }) })
    const posRes = await executeSpellCast(positive, { slotLevel: 1 }, services2024)

    expect(triggerTashasHideousLaughter).toHaveBeenCalledTimes(1)
    expect(triggerTashasHideousLaughter).toHaveBeenCalledWith(
      positive,
      { ...stamped({ slotLevel: 1 }), spellSaveDc: SAVE_DC },
      services2024.playerStats, CAMPAIGN, MAP,
    )
    expect(posRes).toBe(sentinel) // RAW-forward quirk identity (index.js :314 lane)
    expect(automation.executeHandler).not.toHaveBeenCalled() // protected name
    expect(errSpy).not.toHaveBeenCalled()
    expect(fetchCalls).toStrictEqual(['/data/2024/spells.json'])
  })

  // ------------------------------------------------------------------
  // Hypnotic Pattern — the ONLY lane running the REAL producer
  // handleHypnoticPatternEarly (modalSpells.js:95): exact payload
  // bytes, CLA-219 false-stamp, innate-sorcery +1, and the early
  // chain's post-cast-rider BYPASS (index.js:709 direct return —
  // riders NEVER run, unlike the no-damage spans above).
  // Folded owners: earlyReturns-modal :386 (modalName only, mocked
  // producer); .noformula-services :521 (modalName + dead twin).
  // ------------------------------------------------------------------
  it('hypnotic pattern opens the exact early-modal from the real disk row with saveDc 17, +1 under innate sorcery, zero rolls, zero hijack, zero post-cast riders, and its dead span twin silent', async () => {
    const envelope = diskRow('Hypnotic Pattern', '5e')
    const services = makeServices()

    const res = await executeSpellCast(envelope, { slotLevel: 3 }, services)

    expect(res).toStrictEqual({
      automationPopup: {
        type: 'modal',
        modalName: 'hypnoticPattern',
        payload: {
          action: { name: 'Hypnotic Pattern', automation: { type: 'hypnotic_pattern' } },
          playerStats: services.playerStats,
          campaignName: CAMPAIGN,
          saveType: 'WIS',
          saveDc: SAVE_DC,
          activeOverlay: null,
          metamagicCareful: false,
          metamagicHeighten: false, // CLA-219 coercion at the choke point
        },
      },
    })
    expect(res.automationPopup.payload.playerStats).toBe(services.playerStats)
    expect(triggerHypnoticPattern).not.toHaveBeenCalled() // dead span twin (#1457)
    expect(automation.executeHandler).not.toHaveBeenCalled() // early :706 precedes :710 despite raw automation.type
    expect(rider.triggerPostCastRiderSaves).not.toHaveBeenCalled() // :712 early-chain bypass
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(services.rollAttack).not.toHaveBeenCalled()
    expect(fetchCalls).toStrictEqual(['/data/spells.json']) // automation+no-effects envelope forces the merge lookup
    expect(errSpy).not.toHaveBeenCalled()

    // Innate sorcery discriminator: +1 on the modal DC only.
    vi.clearAllMocks()
    fetchCalls = []
    buff.isInnateSorceryActive.mockReturnValue(true)

    const innate = await executeSpellCast(envelope, { slotLevel: 3 }, services)

    expect(innate.automationPopup.payload.saveDc).toBe(18)
    expect(buff.isInnateSorceryActive).toHaveBeenCalledWith(CASTER, CAMPAIGN)
    expect(errSpy).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Forcecage — routing pair nobody else pins live:
  // (a) RAW disk row (automation.forcecage, NOT in SERVICE_HANDLED)
  //     is hijacked EARLIER at :710 by the real generic gate — the
  //     span never fires; the span is disk-dead-twin territory while
  //     automation rides the envelope (#1365 ruleset twin family).
  // (b) the automation-free caster envelope (the documented live
  //     discriminator — caller strips) reaches span :309; triggerForce-
  //     cage returning NULL is CONSUMED-and-discarded: slot paid,
  //     riders run once via :720, res exactly undefined (#1441).
  // Forward-with-sentinel span row, strip census, and exact execute-
  // Handler tuples are owned by .noformula-utility :324/:511/:520 —
  // this row complements, not duplicates. checkForcecageBlocked lives
  // in blockChecks.test.js:208; hub block integration in execution-
  // block-checks.test.js:372.
  // ------------------------------------------------------------------
  it('Forcecage: the RAW automation-carrying disk row is hijacked at :710 with the service span silent, and the automation-free envelope reaches span :309 where a null popup is consumed-and-discarded with riders run once', async () => {
    const services = makeServices()
    const raw = diskRow('Forcecage', '5e')
    const hijackPopup = { type: 'popup', payload: { type: 'automation_info', name: 'generic hijack', description: 'hijacked' } }
    automation.executeHandler.mockResolvedValue(hijackPopup)

    const rawRes = await executeSpellCast(raw, { slotLevel: 7 }, services)

    expect(automation.executeHandler).toHaveBeenCalledTimes(1)
    expect(automation.executeHandler).toHaveBeenCalledWith(
      { name: 'Forcecage', spell: raw, automation: raw.automation, metaCtx: stamped({ slotLevel: 7 }) },
      services.playerStats, CAMPAIGN, MAP, services.characters,
    )
    expect(automation.executeHandler.mock.calls[0][0].spell).toBe(raw)
    expect(automation.executeHandler.mock.calls[0].length).toBe(5) // arity vs REAL (:462)
    expect(triggerForcecage).not.toHaveBeenCalled() // span :309 unreachable while automation rides
    expect(rawRes).toStrictEqual({ automationPopup: hijackPopup })
    expect(rider.triggerPostCastRiderSaves).not.toHaveBeenCalled() // :712 bypass

    // (b) automation-free span — the documented caller strip.
    vi.clearAllMocks()
    fetchCalls = []
    const stripped = diskRow('Forcecage', '5e')
    delete stripped.automation // discriminator: keeps the cast out of :710 and into span :309

    const spanRes = await executeSpellCast(stripped, { slotLevel: 7 }, services)

    expect(automation.executeHandler).not.toHaveBeenCalled()
    expect(triggerForcecage).toHaveBeenCalledTimes(1)
    expect(triggerForcecage).toHaveBeenCalledWith(stripped, stamped({ slotLevel: 7 }), services.playerStats, CAMPAIGN, MAP)
    expect(triggerForcecage.mock.calls[0][0]).toBe(stripped)
    expect(spanRes).toBeUndefined() // null popup consumed-and-discarded; handled stands
    expect(rider.triggerPostCastRiderSaves).toHaveBeenCalledTimes(1) // slot paid -> CLA-389 merge
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(services.rollAttack).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })
})
