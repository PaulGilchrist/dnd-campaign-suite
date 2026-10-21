// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast, refundSpellBreakerSlot } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'

import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as dice from '../../dice/diceRoller.js'
import * as logService from '../../../services/ui/logService.js'
import * as silence from '../features/silenceService.js'
import * as invis from '../features/invisibilityService.js'
import * as friends from '../features/friendsService.js'
import * as buffService from '../../combat/buffs/buffService.js'
import * as rider from './postCastRiderService.js'
import * as healRider from './postCastHealService.js'

/* ------------------------------------------------------------------ */
/*  MASTER LANE — barrel spellCastService.js, hub transport face.    */
/*                                                                     */
/*  Identity per #1454 split table: save-DC / range auto-miss /       */
/*  emp-evoc bake / overchannel / heal-throw slot-null /              */
/*  corrupt-conditions honest-abort, ALL through the barrel + the     */
/*  REAL hub chain (index.js gates/stamps, damageCalculation.js,       */
/*  savePath.js single-target branch, triggerSpells.js name gates,    */
/*  helpers.js, rangeValidation.js, castingTimeUtils.js, blockChecks.js */
/*  run real; damageUtils.js runs real — these rows never reach        */
/*  getCombatContext, and fetchCalls [] on abort rows proves it).     */
/*  Mocked edges mirror the .execute lane canon (#1454): runtime,      */
/*  dice (faithful null guard, diceRoller.js:78), log, feature         */
/*  services, riders. Refund keeps only the barrel-call + the 0→1     */
/*  boundary (#1461 face) — full gate table owned by                   */
/*  execution/helpers-spellBreaker.test.js:78-110.                     */
/*                                                                     */
/*  FOLDED OUT (owners cited, report-strengthened here):               */
/*   - old refund rows (2→3, null, -1) ..... execution/helpers-spellBreaker.test.js:78-110 */
/*   - SP-002 null-activeConditions CONTINUE execution-early-resolutions.test.js:331-350 */
/*   - computeSpellStats arithmetic ........ execution/spellStats.test.js */
/*   - savePath single-target full ctx key-set execution/savePath-single-target.test.js */
/*   - CLA-134 finalFormula/featsOfChaos transport ... .execute lane #1454 */
/*   - disk Fireball AoE popup / modal payloads ............ savePath-aoe-* lanes + .noformula-modals */
/*                                                                     */
/*  FIXTURE TRUTH (this sweep's dead-fixture fix): the old fake        */
/*  Fireball/BurningHands payloads only reached rollDamage because     */
/*  the real lookupFullSpell fetch (index.js:176) FAILED in jsdom —   */
/*  real disk Fireball carries area_of_effect sphere and would flip    */
/*  every row to the AoE modal. Rows now run REAL disk rows (Blight,  */
/*  Hellish Rebuke, Cure Wounds) served by a URL-aware fetch stub      */
/*  (#1454-60 pattern); Hellish Rebuke is the ONLY disk evocation      */
/*  single-target save spell (dc DEX, 2d10) so emp-evoc/overchannel   */
/*  reach the single-target rollDamage lane. Positions use the REAL    */
/*  producer shape {gridX, gridY} (useSpellPositionResolver.js:34) —   */
/*  the old {x, y} keys made getDistanceFeet return NaN and the        */
/*  auto-miss pass by coincidence (rangeValidation.js:16-19).           */
/*                                                                     */
/*  No-clock policy: NO game timers in this lane; addEntry/log         */
/*  timestamps live behind the log mock. Campaign is 'test-campaign'   */
/*  on every row (#1456-61 lockdown sweep applied here).               */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign'
const MAP = 'testMap'

/* ---------------- external-edge mocks (#1440 mock-complete) -------- */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => []),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => (formula ? { total: 10, rolls: [1, 2, 3, 4], modifier: 0 } : null)),
  rollExpressionMaximized: vi.fn((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null)),
  applyHealingRerollOnes: vi.fn(),
}))

// Graph hygiene: the automation barrel pulls the full handler graph. No disk
// row run by this lane carries automation.type (disk Blight/HR/CW verified
// automation-free), so handleGenericAutomation (triggerSpells.js:455) never
// fires and executeHandler is pinned un-called on every damage row.
vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('./postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve(null)),
  triggerSpellThief: vi.fn(() => Promise.resolve(null)),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve(null)),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve([])),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve()),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve(null)),
}))

/* ------------------------------------------------------------------ */
/*  fetch stub — URL-aware, real-Promise-shaped (#1454-60 canon).    */
/*  Unknown URLs reject loudly; no silent network.                     */
/* ------------------------------------------------------------------ */

let fetchCalls

function jsonResponse(data) {
  return { ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) }
}

function installFetchStub() {
  fetchCalls = []
  vi.stubGlobal('fetch', vi.fn((url) => {
    fetchCalls.push(url)
    if (url === '/data/spells.json') return Promise.resolve(jsonResponse(spells5e))
    return Promise.reject(new Error(`unexpected fetch in master lane: ${url}`))
  }))
}

/* ---------------- fixtures — REAL disk rows ----------------------- */

function blightDisk() {
  return cloneDeep(spells5e.find((s) => s.name === 'Blight'))
}

function hellishRebukeDisk() {
  return cloneDeep(spells5e.find((s) => s.name === 'Hellish Rebuke'))
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    proficiency: 4,
    // Producer truth: spellAbilities rows carry cached builder values; no
    // spellCastingAbility key so computeSpellStats takes its cached-saveDc
    // branch (index.js:194-202 — arithmetic owned by spellStats.test.js).
    spellAbilities: { toHit: 9, saveDc: 13, modifier: 5 },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    hitPoints: 100,
    automation: { passives: [] },
    ...overrides,
  }
}

function makeCtx(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
    campaignName: CAMPAIGN,
    mapName: MAP,
    ...overrides,
  }
}

/* ------------------------------------------------------------------ */
/*  Suite                                                              */
/* ------------------------------------------------------------------ */

describe('spellCastService.js barrel — hub transport lane', () => {
  let consoleErrorSpy

  beforeEach(() => {
    vi.resetAllMocks()
    installFetchStub()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    runtime.getRuntimeValue.mockImplementation((_character, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })
    dice.rollExpression.mockImplementation((formula) => (formula ? { total: 10, rolls: [1, 2, 3, 4], modifier: 0 } : null))
    dice.rollExpressionMaximized.mockImplementation((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null))
    logService.addEntry.mockReturnValue(Promise.resolve())
    silence.getSilenceSource.mockReturnValue(null)
    silence.isCreatureInSilenceZone.mockReturnValue(false)
    buffService.isInnateSorceryActive.mockReturnValue(false)
    buffService.getActiveBuffs.mockReturnValue([])
    rider.getEmpoweredEvocationFeatures.mockReturnValue([])
    rider.getEmpoweredEvocationIntModifier.mockReturnValue(0)
    rider.triggerPostCastRiderSaves.mockReturnValue(Promise.resolve(null))
    rider.triggerSoulstitchSpells.mockReturnValue(Promise.resolve([]))
    rider.triggerSpellThief.mockReturnValue(Promise.resolve(null))
    rider.triggerBewitchingMagic.mockReturnValue(Promise.resolve(null))
    healRider.triggerPostCastSelfHeals.mockReturnValue(Promise.resolve())
    healRider.triggerPostCastAllyHeals.mockReturnValue(Promise.resolve(null))
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  describe('refundSpellBreakerSlot (barrel surface + zero boundary)', () => {
    // Full gate table (2→3 tuple, arity, null, negative) owned module-direct
    // by execution/helpers-spellBreaker.test.js:78-110. This row is the
    // only pin that calls the barrel re-export and the only 0→1 boundary
    // (gate is `currentSlots == null || currentSlots < 0`, helpers.js:105).
    it('refunds the stored 0 slots to exactly 1 through the barrel export', () => {
      runtime.getRuntimeValue.mockReturnValue(0)

      refundSpellBreakerSlot('TestWizard', 3, CAMPAIGN)

      expect(runtime.getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_3')
      expect(runtime.setRuntimeValue.mock.calls).toEqual([
        ['TestWizard', 'spell_slots_level_3', 1, CAMPAIGN],
      ])
      expect(fetchCalls).toEqual([])
    })
  })

  describe('save-DC transport through the hub', () => {
    it('forwards the cached spellAbilities.saveDc verbatim to rollDamage and the cast log, and returns null', async () => {
      const spell = blightDisk()

      const ctx = makeCtx()
      const result = await executeSpellCast(spell, { slotLevel: 4, targetName: 'Goblin1' }, ctx)

      expect(result).toBeNull()
      expect(ctx.rollDamage).toHaveBeenCalledTimes(1)
      const { name, formula, total, rolls, modifier } = ctx.rollDamage.mock.calls[0][0]
      expect({ name, formula, total, rolls, modifier }).toEqual({
        name: 'Blight', formula: '8d8', total: 10, rolls: [1, 2, 3, 4], modifier: 0,
      })
      const { context } = ctx.rollDamage.mock.calls[0][0]
      expect(context.saveDc).toBe(13)
      expect(context.saveType).toBe('CON')
      expect(context.dcSuccess).toBe('half')
      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpression).toHaveBeenCalledWith('8d8')
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
      expect(logService.addEntry).toHaveBeenCalledTimes(1)
      const [logCampaign, logEntry] = logService.addEntry.mock.calls[0]
      expect(logCampaign).toBe(CAMPAIGN)
      expect({ spellName: logEntry.spellName, saveDC: logEntry.saveDC }).toEqual({
        spellName: 'Blight', saveDC: 13,
      })
      expect(fetchCalls).toEqual(['/data/spells.json'])
      // applyHostileCastSideEffects transport (index.js:59-69): a hostile
      // non-friends cast ends Friends/Invisibility and arms Battle Magic.
      expect(friends.endFriendsOnHostileAction).toHaveBeenCalledWith('TestWizard', CAMPAIGN)
      expect(invis.endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', CAMPAIGN)
      expect(runtime.setRuntimeValue.mock.calls).toEqual([
        ['TestWizard', 'lastActionSpellCast', 1, CAMPAIGN],
      ])
    })

    it('computes the fallback DC as 8 + proficiency when spellAbilities.saveDc is absent', async () => {
      const spell = blightDisk()
      const ctx = makeCtx({
        playerStats: makePlayerStats({ spellAbilities: { toHit: 9 } }),
      })

      await executeSpellCast(spell, { slotLevel: 4, targetName: 'Goblin1' }, ctx)

      expect(ctx.rollDamage).toHaveBeenCalledTimes(1)
      expect(ctx.rollDamage.mock.calls[0][0].context.saveDc).toBe(12)
    })

    it('aborts before any roll or log when proficiency and saveDc are both missing', async () => {
      const spell = blightDisk()
      const ctx = makeCtx({
        playerStats: makePlayerStats({ proficiency: null, spellAbilities: {} }),
      })

      await expect(
        executeSpellCast(spell, { slotLevel: 4, targetName: 'Goblin1' }, ctx),
      ).rejects.toThrow('playerStats.proficiency is required for spell save DC calculation')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[spellCast] executeSpellCast: playerStats.proficiency is missing',
      )
      expect(ctx.rollDamage).not.toHaveBeenCalled()
      expect(ctx.rollAttack).not.toHaveBeenCalled()
      // The lookup (index.js:689) is paid before stats resolve (index.js:696).
      expect(fetchCalls).toEqual(['/data/spells.json'])
      // The only write is the pre-stat Battle Magic stamp; no slot spend.
      expect(runtime.setRuntimeValue.mock.calls).toEqual([
        ['TestWizard', 'lastActionSpellCast', 1, CAMPAIGN],
      ])
    })
  })

  describe('range validation — auto-miss lane (master-owned, #1454 split)', () => {
    it('stamps isAutoMiss with the exact range-reason bytes on real gridX/gridY positions and returns null', async () => {
      const spell = blightDisk()
      const ctx = makeCtx({
        attackerPos: { gridX: 0, gridY: 0 },
        targetPos: { gridX: 40, gridY: 0 }, // 40 cells × 5 ft = 200 ft (useSpellPositionResolver.js:34)
      })

      const result = await executeSpellCast(spell, { slotLevel: 4, targetName: 'Goblin1' }, ctx)

      expect(result).toBeNull()
      // Hub quirk pinned: the auto-miss lane fires its zero-damage transport
      // roll AND still runs the save adjudication roll (index.js:619-623).
      expect(ctx.rollDamage).toHaveBeenCalledTimes(2)
      const miss = ctx.rollDamage.mock.calls[0][0]
      const { name, formula, total, rolls, modifier } = miss
      expect({ name, formula, total, rolls, modifier }).toEqual({
        name: 'Blight', formula: '8d8', total: 0, rolls: [], modifier: 0,
      })
      expect(miss.context.isAutoMiss).toBe(true)
      // rangeValidation.js:90-93 — 30 ft range, long-range 60 ft.
      expect(miss.context.rangeReason).toBe('Out of range (200 ft > 60 ft)')
      expect(miss.context.saveDc).toBe(13)
      expect(ctx.rollDamage.mock.calls[1][0].total).toBe(10)
      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    })
  })

  describe('empowered evocation bake (via hub, evocation school gate)', () => {
    it('bakes "+ 3 [Empowered Evocation]" into the rollDamage formula without mutating the spell and writes nothing on a reaction cast', async () => {
      const spell = hellishRebukeDisk()
      const snapshot = cloneDeep(spell)
      rider.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation' }])
      rider.getEmpoweredEvocationIntModifier.mockReturnValue(3)
      const ctx = makeCtx({
        playerStats: makePlayerStats({ spellAbilities: { toHit: 9, saveDc: 13, modifier: 3 } }),
      })

      const result = await executeSpellCast(spell, { slotLevel: 1, targetName: 'Goblin1' }, ctx)

      expect(result).toBeNull()
      expect(dice.rollExpression).toHaveBeenCalledTimes(1)
      expect(dice.rollExpression).toHaveBeenCalledWith('2d10 + 3 [Empowered Evocation]')
      expect(ctx.rollDamage).toHaveBeenCalledTimes(1)
      const { name, formula, total, rolls, modifier } = ctx.rollDamage.mock.calls[0][0]
      expect({ name, formula, total, rolls, modifier }).toEqual({
        name: 'Hellish Rebuke', formula: '2d10 + 3 [Empowered Evocation]', total: 10, rolls: [1, 2, 3, 4], modifier: 0,
      })
      const { context } = ctx.rollDamage.mock.calls[0][0]
      expect(context.saveDc).toBe(13)
      expect(context.damageType).toBe('Fire')
      expect(context.saveType).toBe('DEX')
      // Purity: the bake builds new strings; the spell payload is untouched.
      expect(spell).toEqual(snapshot)
      // Hellish Rebuke is '1 reaction' on disk — CLA-399 never arms Battle Magic.
      expect(runtime.setRuntimeValue).not.toHaveBeenCalled()
    })
  })

  describe('overchannel (via hub)', () => {
    it('maximizes exactly once, increments the use count 2→3 before the damage roll, and writes only the use-count key', async () => {
      const spell = hellishRebukeDisk()
      const ctx = makeCtx({
        playerStats: makePlayerStats({
          automation: { passives: [{ name: 'Overchannel', type: 'overchannel' }] },
        }),
      })
      runtime.getRuntimeValue.mockImplementation((_character, key) => {
        if (key === 'activeConditions' || key === 'targetEffects') return []
        if (key === 'Overchannel_useCount') return 2
        return undefined
      })

      await executeSpellCast(spell, { overchannel: true, slotLevel: 1, targetName: 'Goblin1' }, ctx)

      expect(dice.rollExpressionMaximized).toHaveBeenCalledTimes(1)
      expect(dice.rollExpressionMaximized).toHaveBeenCalledWith('2d10 [Overchannel Maximize]')
      expect(dice.rollExpression).not.toHaveBeenCalled()
      expect(ctx.rollDamage).toHaveBeenCalledTimes(1)
      const { name, formula, total, rolls, modifier } = ctx.rollDamage.mock.calls[0][0]
      expect({ name, formula, total, rolls, modifier }).toEqual({
        name: 'Hellish Rebuke', formula: '2d10 [Overchannel Maximize]', total: 24, rolls: [6, 6, 6, 6], modifier: 0,
      })
      const { context } = ctx.rollDamage.mock.calls[0][0]
      expect(context.overchannelActive).toBe(true)
      expect(context.overchannelUseCount).toBe(3)
      expect(context.overchannelSpellLevel).toBe(1)
      // Exact arithmetic 2→3, single write (damageCalculation.js:118-124).
      expect(runtime.setRuntimeValue.mock.calls).toEqual([
        ['TestWizard', 'Overchannel_useCount', 3, CAMPAIGN],
      ])
      // The count is consumed at compute time, BEFORE damage lands.
      expect(runtime.setRuntimeValue.mock.invocationCallOrder[0])
        .toBeLessThan(ctx.rollDamage.mock.invocationCallOrder[0])
    })
  })

  describe('healing spells — slot-null defensive throw (master face, #1454)', () => {
    it('throws before any heal lands when both metaCtx.slotLevel and spell.level are null, logging zero hp_change', async () => {
      // Defensive shape: real disk Cure Wounds is level 1; custom/homebrew
      // producers (npcs.json custom rows) can pass level:null. The throw
      // bytes at index.js:440-442 are owned by this lane per #1454.
      const spell = { ...cloneDeep(spells5e.find((s) => s.name === 'Cure Wounds')), level: null }
      const ctx = makeCtx({ getTargetInfo: vi.fn(() => ({ name: 'Ally1' })) })

      await expect(
        executeSpellCast(spell, { slotLevel: null, targetName: 'Ally1' }, ctx),
      ).rejects.toThrow('slot level is required for healing spell')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[spellCast] executeSpellCast: slot level is missing (metaCtx.slotLevel and spell.level) for healing spell',
      )
      expect(ctx.rollDamage).not.toHaveBeenCalled()
      expect(ctx.rollAttack).not.toHaveBeenCalled()
      // The generic cast log is paid pre-throw (spellLevel null spells 0 —
      // index.js:241); NO hp_change log and no HP writes follow.
      expect(logService.addEntry).toHaveBeenCalledTimes(1)
      const [, logEntry] = logService.addEntry.mock.calls[0]
      expect({ type: logEntry.type, spellName: logEntry.spellName, spellLevel: logEntry.spellLevel, saveDC: logEntry.saveDC }).toEqual({
        type: 'spell', spellName: 'Cure Wounds', spellLevel: 0, saveDC: null,
      })
      expect(runtime.setRuntimeValue.mock.calls).toEqual([
        ['TestWizard', 'lastActionSpellCast', 1, CAMPAIGN],
      ])
      expect(fetchCalls).toEqual(['/data/spells.json'])
    })
  })

  describe('corrupt caster state — honest abort (SP-002 family)', () => {
    // null-continue branch owned by execution-early-resolutions.test.js:331-350;
    // this row owns the corrupt NON-null abort bytes with zero side effects.
    it('aborts a corrupt non-null activeConditions BEFORE any write, fetch, roll, or log', async () => {
      const spell = blightDisk()
      const ctx = makeCtx()
      runtime.getRuntimeValue.mockImplementation((_character, key) => {
        if (key === 'activeConditions') return 'not-an-array'
        return undefined
      })

      await expect(
        executeSpellCast(spell, { slotLevel: 4, targetName: 'Goblin1' }, ctx),
      ).rejects.toThrow('activeConditions must be an array for caster')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[spellCast] casterConditions: activeConditions is not an array',
      )
      expect(runtime.setRuntimeValue).not.toHaveBeenCalled()
      expect(fetchCalls).toEqual([])
      expect(ctx.rollDamage).not.toHaveBeenCalled()
      expect(ctx.rollAttack).not.toHaveBeenCalled()
      expect(logService.addEntry).not.toHaveBeenCalled()
      expect(runtime.getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'activeConditions', CAMPAIGN)
    })
  })
})
