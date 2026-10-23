// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'

import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as dice from '../../dice/diceRoller.js'
import * as logService from '../../ui/logService.js'
import * as silence from '../features/silenceService.js'
import * as invis from '../features/invisibilityService.js'
import * as friends from '../features/friendsService.js'
import * as buffService from '../../combat/buffs/buffService.js'
import * as rider from './postCastRiderService.js'
import * as healRider from './postCastHealService.js'

/* ------------------------------------------------------------------ */
/*  EXECUTION LANE (#1449 split family)                              */
/*                                                                   */
/*  Identity: caller-boundary integration through the facade barrel  */
/*  (spellCastService.js, imported live by useSpellCastExecutor,     */
/*  useActionSpellMetamagic, useCharActionsAutomation) with the REAL  */
/*  execution chain — blockChecks.js, damageCalculation.js,           */
/*  savePath.js, noSavePath.js, triggerSpells.js, helpers.js,        */
/*  spellResolution.js, castingTimeUtils.js, spellDamageUtils.js and */
/*  encounters/combatData.js all run real. Only external-edge        */
/*  services (runtime store, dice, log, feature services, riders)    */
/*  are mocked. Sibling lanes that mock these internals or own the   */
/*  module-direct faces are cited per test — bytes covered there     */
/*  are NOT re-grown here.                                            */
/*                                                                    */
/*  Ownership map (covered elsewhere, cited only):                    */
/*   - computeSpellStats arithmetic ....... execution/spellStats.test.js (:190-221 of index.js) */
/*   - hostile side-effect positives (endFriends/endInvisibility/     */
/*     lastActionSpellCast casings) ....... execution/early-resolutions.test.js:432-521 */
/*   - block gates payload/log bytes ....... execution/blockChecks.test.js + execution-block-checks.test.js */
/*   - silence refuse popup/log ....... spellCastService.noformula-modals.test.js */
/*   - magical ambush -> savePath ctx ... execution/index.magicalAmbushTransport.test.js */
/*   - auto-miss + overchannel/emp-evoc via hub .. spellCastService.test.js (master) + savePath-aoe-* lanes + damageCalculation-cla120 */
/*   - riders self-catch console bytes ... execution/execution-post-cast.test.js + .cla389 (#1401/28, #1452:472-522) */
/*   - psychic opt-in / heal / missile ... psychic-optin / heal / missile lanes */
/*                                                                    */
/*  No-clock policy: this lane stores no expiry - the hub stamps    */
/*  Date.now() only as log timestamps (benign, never a game clock). */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Mocks — external edges only, REAL-Promise-shaped (#1449).        */
/*  diceRoller mirrors the real null guard (index-level:              */
/*  diceRoller.js:78-81 `if (!formula) return null`) so the           */
/*  savePath null-formula guard at savePath.js:260 is not masked.   */
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
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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
/*  Test-data factories (real disk spell tables imported verbatim)   */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'test-campaign'
const MAP = 'testMap'

function fireballDisk() {
  return spells5e.find((s) => s.name === 'Fireball')
}

// UI-producer cast payload: minimal fields, NO area_of_effect — full data
// arrives only via lookupFullSpell's fetch merge (index.js:170-189).
function makeFireballPayload(overrides = {}) {
  return {
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '150 feet',
    damage: { damage_type: 'Fire', damage_at_slot_level: { 3: '8d6' } },
    dc: { dc_type: 'dex', dc_success: 'half' },
    ...overrides,
  }
}

function makeFireBoltPayload() {
  return {
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '120 feet',
    attack_type: 'ranged',
    damage: {
      damage_type: 'Fire',
      damage_at_character_level: { 1: '1d10', 5: '2d10', 11: '3d10', 17: '4d10' },
    },
  }
}

function makeCharmMonsterPayload() {
  return {
    name: 'Charm Monster',
    level: 4,
    school: 'Enchantment',
    casting_time: 'Action',
    components: ['V', 'S'],
    dc: { dc_type: 'WIS', dc_success: 'none' },
    status_effects: ['Charmed'],
  }
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    // Sentinels: spellAbilities.toHit/saveDc are the STALE cached values;
    // computeSpellStats recomputes 5+4=9 / 8+5+4=17 (owned by
    // spellStats.test.js). Reaching the seams with 9/17 proves transport.
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 99, saveDc: 13, modifier: 5 },
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
    getTargetInfo: vi.fn(() => Promise.resolve({ name: 'Goblin1' })),
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
/*  fetch stub — URL-aware, real-Promise-shaped (#1449). Serves the  */
/*  REAL disk spell tables; unknown URLs reject loudly (no silent     */
/*  network). change-data satisfies damageUtils.getCombatContext.     */
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
    if (url === '/data/2024/spells.json') return Promise.resolve(jsonResponse(spells2024))
    if (url === `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/change-data`) {
      return Promise.resolve(jsonResponse({ combatSummary: null, activeCreatureName: null }))
    }
    return Promise.reject(new Error(`unexpected fetch in execute lane: ${url}`))
  }))
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - execution lane (real chain via facade)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    installFetchStub()

    runtime.getRuntimeValue.mockImplementation((_character, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })
    dice.rollExpression.mockImplementation((formula) => (formula ? { total: 10, rolls: [1, 2, 3, 4], modifier: 0 } : null))
    dice.rollExpressionMaximized.mockImplementation((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null))
    logService.addEntry.mockReturnValue(Promise.resolve())
    silence.getSilenceSource.mockReturnValue(null)
    silence.isCreatureInSilenceZone.mockReturnValue(false)
    buffService.getActiveBuffs.mockReturnValue([])
    buffService.isInnateSorceryActive.mockReturnValue(false)
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
    vi.unstubAllGlobals()
  })

  /* ---------------------------------------------------------------- */
  /*  Gate ORDER 1: buff-block refusal leaves zero downstream trace  */
  /*  Unique bytes: runCastBlockChecks ordering (index.js:651-667).  */
  /*  blockChecks.js popup/log payload bytes are owned by             */
  /*  blockChecks.test.js CLA-391; HERE we pin that the refusal      */
  /*  short-circuits BEFORE target resolution, the silence gate,      */
  /*  hostile side effects, dice, and the adjudication lanes.         */
  /*  Kills: buff gate moved after getTargetInfo/silence, or a        */
  /*  refusal that keeps executing the pipeline.                      */
  /* ---------------------------------------------------------------- */

  it('refuses at the buff gate (real blockChecks.js) with the exact popup and refusal log, and never touches target resolution, the silence gate, hostile side effects or dice', async () => {
    buffService.getActiveBuffs.mockReturnValue([
      { name: 'Wild Shape', effect: 'shape_shift', blocksSpellcasting: true },
    ])
    const services = makeServices()

    const result = await executeSpellCast(makeFireballPayload(), { slotLevel: 3 }, services)

    expect(result).toEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Wild Shape',
          description: 'Fireball cannot be cast while TestWizard is under Wild Shape — no Spellcasting is allowed.',
        },
      },
    })
    // Real gate consumes (playerStats.name, campaignName) via spellResolution re-export.
    expect(buffService.getActiveBuffs).toHaveBeenCalledTimes(1)
    expect(buffService.getActiveBuffs).toHaveBeenCalledWith('TestWizard', CAMPAIGN)
    // Refusal is logged exactly once (never silent, CLA-391) — full entry minus timestamp.
    expect(logService.addEntry).toHaveBeenCalledTimes(1)
    const [logCampaign, entry] = logService.addEntry.mock.calls[0]
    expect(logCampaign).toBe(CAMPAIGN)
    expect({ ...entry, timestamp: undefined }).toEqual({
      type: 'automation',
      automationType: 'shape_shift_refused',
      automationDetail: undefined,
      creatureName: 'TestWizard',
      characterName: 'TestWizard',
      name: 'Wild Shape',
      description: 'Fireball blocked — TestWizard cannot cast spells while under Wild Shape.',
      timestamp: undefined,
    })
    expect(typeof entry.timestamp).toBe('number')
    // Zero downstream trace: gates run in order buff -> getTargetInfo -> globe/
    // forcecage/antimagic -> silence -> hostile side effects; none was reached.
    expect(services.getTargetInfo).not.toHaveBeenCalled()
    expect(silence.getSilenceSource).not.toHaveBeenCalled()
    expect(friends.endFriendsOnHostileAction).not.toHaveBeenCalled()
    expect(invis.endInvisibilityOnHostileAction).not.toHaveBeenCalled()
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled()
    expect(services.rollAttack).not.toHaveBeenCalled()
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(dice.rollExpression).not.toHaveBeenCalled()
    expect(fetchCalls).toEqual([])
  })

  /* ---------------------------------------------------------------- */
  /*  Gate ORDER 2: silence refusal runs AFTER the earlier block      */
  /*  checks but BEFORE applyHostileCastSideEffects (index.js:682-    */
  /*  687) — a refused cast must not break Friends/Invisibility nor   */
  /*  arm lastActionSpellCast. Popup/log payload owned by             */
  /*  spellCastService.noformula-modals.test.js silence gate; the    */
  /*  ordering + exact collaborator tuples + zero-roll pin is unique. */
  /*  Kills: silence check relocated after line 687, or refusal       */
  /*  falling through to the damage path.                             */
  /* ---------------------------------------------------------------- */

  it('refuses a Verbal cast inside a Silence zone with the exact popup and log, after the globe/forcecage gates ran once, without ending Friends/Invisibility, arming lastActionSpellCast or rolling', async () => {
    silence.getSilenceSource.mockReturnValue('SilenceCaster')
    silence.isCreatureInSilenceZone.mockReturnValue(true)
    const services = makeServices()

    const result = await executeSpellCast(makeFireballPayload({ components: ['V'] }), { slotLevel: 3 }, services)

    expect(result).toEqual({
      automationPopup: {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Silence',
          description: 'Fireball cannot be cast — TestWizard is inside a Silence zone and Verbal spell components are impossible there.',
        },
      },
    })
    // Exact tuple: zone lookup by caster name (index.js:136-137).
    expect(silence.getSilenceSource).toHaveBeenCalledWith('TestWizard', CAMPAIGN)
    expect(silence.isCreatureInSilenceZone).toHaveBeenCalledWith('TestWizard', 'SilenceCaster', CAMPAIGN)
    expect(logService.addEntry).toHaveBeenCalledTimes(1)
    const [logCampaign, entry] = logService.addEntry.mock.calls[0]
    expect(logCampaign).toBe(CAMPAIGN)
    expect({ ...entry, timestamp: undefined }).toEqual({
      type: 'automation',
      creatureName: 'TestWizard',
      name: 'Silence',
      description: 'Fireball blocked — TestWizard is inside SilenceCaster\'s Silence zone; Verbal components are impossible there.',
      timestamp: undefined,
    })
    expect(typeof entry.timestamp).toBe('number')
    // Ordering: earlier block gates ran (target resolved once, real
    // checkGlobeOfInvulnerability/checkForcecageBlocked passed on empty
    // targetEffects) but hostile side effects (line 687) were NOT reached.
    expect(services.getTargetInfo).toHaveBeenCalledTimes(1)
    expect(friends.endFriendsOnHostileAction).not.toHaveBeenCalled()
    expect(invis.endInvisibilityOnHostileAction).not.toHaveBeenCalled()
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled()
    expect(services.rollAttack).not.toHaveBeenCalled()
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(dice.rollExpression).not.toHaveBeenCalled()
    expect(fetchCalls).toEqual([])
  })

  /* ---------------------------------------------------------------- */
  /*  lookupFullSpell MERGE -> AoE modal assembly (flagship)          */
  /*  The ONLY lane that runs index.js:170-189 fetch-merge with a     */
  /*  disk hit and carries the merged fullSpell through real           */
  /*  savePath.js into the saveAttackAoe popup (payload assembly      */
  /*  from REAL disk bytes, real rangeToFeet, full dc precedence       */
  /*  flip dex->DEX). execution/aoeSpells.test.js supplies             */
  /*  area_of_effect directly (lookup bypassed, payload asserted with  */
  /*  objectContaining); CLA-389 post-payment merge rides here too     */
  /*  with the hub-stamped metaCtx (CLA-134, index.js:741).           */
  /*  Kills: merge dropped, stale-fixture dc reaching the payload,    */
  /*  post-cast riders skipped on the modal lane, unstamped metaCtx.  */
  /* ---------------------------------------------------------------- */

  it('merges the fetched 5e Fireball into fullSpell and hands the modal lane the real disk adjudication data, then runs post-cast riders against the stamped metaCtx', async () => {
    const disk = fireballDisk()
    const spell = makeFireballPayload()
    const services = makeServices()

    const result = await executeSpellCast(spell, { slotLevel: 3 }, services)

    expect(fetchCalls).toEqual(['/data/spells.json', `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/change-data`])
    const expectedFullSpell = { ...spell, ...disk, index: undefined, name: 'Fireball' }
    const expectedMetaCtx = {
      slotLevel: 3,
      metamagicHeighten: false,
      finalFormula: '8d6',
      featsOfChaosArmedAtCast: false,
    }

    // Exact popup assembly from merged disk data (index.js:754-759 -> savePath.js).
    expect(result).toEqual({
      automationPopup: {
        type: 'modal',
        modalName: 'saveAttackAoe',
        payload: {
          action: { name: 'Fireball', automation: {}, spell: expectedFullSpell },
          playerStats: services.playerStats,
          campaignName: CAMPAIGN,
          shape: 'sphere',
          range: 150,
          damage: '8d6',
          damageType: 'Fire',
          radiantSoulChaMod: 0,
          empoweredEvocationIntMod: 0,
          saveType: 'DEX',
          saveDc: 17,
          dcSuccess: 'half',
          activeOverlay: null,
          metamagicCareful: false,
          metamagicHeighten: false,
          overchannelActive: false,
          overchannelUseCount: 0,
          overchannelSpellLevel: 3,
        },
      },
    })
    expect(result.automationPopup.payload.playerStats).toBe(services.playerStats)
    // The merged fullSpell (not the raw payload) reaches the deepest collaborator.
    expect(rider.triggerSoulstitchSpells).toHaveBeenCalledWith(expectedFullSpell, expectedMetaCtx, services.playerStats, CAMPAIGN, MAP)
    // CLA-389: the modal lane paid the slot and still ran the post-cast block;
    // CLA-134: the cast-time metaCtx stamp (finalFormula + featsOfChaosArmedAtCast)
    // is the transport riders receive.
    expect(rider.triggerPostCastRiderSaves).toHaveBeenCalledWith(spell, expectedMetaCtx, services.playerStats, CAMPAIGN, MAP)
    // Damage adjudication belongs to the picker modal — the hub must not roll.
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(dice.rollExpression).not.toHaveBeenCalled()
  })

  /* ---------------------------------------------------------------- */
  /*  NO-SAVE routing with hub-stamped formula (CLA-200/CLA-134)     */
  /*  Unique bytes: computeSpellStats transport (toHit sentinel 99     */
  /*  vs computed 9), the empowered-evocation bake arriving at        */
  /*  noSavePath.js via metaCtx.finalFormula (single bake, CLA-120),  */
  /*  and the CLA-134 featsOfChaosArmedAtCast stamp crossing the      */
  /*  rollAttack seam. noSavePath.test.js owns the module internals.  */
  /*  fix#121(e) (#1454/#1462 FIXED): the hub resolves the cantrip    */
  /*  formula at CHARACTER level (index.js:53 now mirrors               */
  /*  resolveSpellDamageAtLevel(spell, playerStats.level) — for CL10   */
  /*  both sides bake AND roll '2d10'; the retired spell.level || 1    */
  /*  baked the level-1 tier and stood in RED mismatch with the roll. */
  /*  Kills: stamp dropped, double-bake, toHit transport failure.     */
  /* ---------------------------------------------------------------- */

  it('routes a no-DC Fire Bolt through real handleNoSavePath: rollAttack receives computed toHit, the single-baked empowered formula stamp at the caster-level tier, and the raw character-level roll formula — bake and roll agree (fix#121(e))', async () => {
    rider.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation', type: 'empowered_evocation' }])
    rider.getEmpoweredEvocationIntModifier.mockReturnValue(5)
    const spell = makeFireBoltPayload()
    const services = makeServices()

    const result = await executeSpellCast(spell, { slotLevel: 0 }, services)

    expect(fetchCalls).toEqual(['/data/spells.json'])
    const [attackName, attackBonus, attackCtx] = services.rollAttack.mock.calls[0]
    expect(services.rollAttack).toHaveBeenCalledTimes(1)
    expect(attackName).toBe('Fire Bolt')
    expect(attackBonus).toBe(9) // Int 5 + proficiency 4 — computed, not the stale 99 sentinel
    expect(attackCtx.playerStats).toBe(services.playerStats)
    const ctxRest = { ...attackCtx }
    delete ctxRest.playerStats
    expect(ctxRest).toEqual({
      attackName: 'Fire Bolt',
      targetName: 'Goblin1',
      attackerName: 'TestWizard',
      damageType: 'Fire',
      autoDamageFormula: '2d10 + 5 [Empowered Evocation]',
      autoDamageName: 'Fire Bolt',
      spellName: 'Fire Bolt',
      autoDamageSchool: 'Evocation',
      overchannelActive: false,
      overchannelUseCount: 0,
      overchannelSpellLevel: 0,
      autoDamageRollResult: { total: 10, rolls: [1, 2, 3, 4], modifier: 0 },
      slotLevel: 0,
      metamagicHeighten: false,
      finalFormula: '2d10 + 5 [Empowered Evocation]',
      featsOfChaosArmedAtCast: false,
      isCantrip: true,
    })
    // The roll rides the caster-scaled raw formula and the bake now agrees with
    // its level source (fix#121(e)) — no double bake, no tier divergence.
    expect(dice.rollExpression).toHaveBeenCalledTimes(1)
    expect(dice.rollExpression).toHaveBeenCalledWith('2d10')
    expect(services.rollAttack.mock.calls[0][2].autoDamageFormula).toBe('2d10 + 5 [Empowered Evocation]') // bake == roll tier
    expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    // No-save spells never reach the save DC adjudication — no rollDamage.
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  /* ---------------------------------------------------------------- */
  /*  2024 ruleset lookup + runStatusEffectsFallback (index.js:246-    */
  /*  261) — the ONLY pin of the hub's zero-damage adjudication roll  */
  /*  in the whole spellCastService family. Charm Monster (real 2024   */
  /*  disk row: dc WIS/none, status_effects ['Charmed'], no AoE) is    */
  /*  unhandled by the 40-handler trigger chain, so the hub stamps    */
  /*  the rollDamage envelope exactly once — the faithful null dice    */
  /*  mock then blocks savePath's null-formula second roll (#1449).    */
  /*  Kills: URL selection regression (rules flag), fallback removal,   */
  /*  a phantom savePath roll, statusEffects dropped from the seam.     */
  /* ---------------------------------------------------------------- */

  it('resolves a 2024 Charm Monster cast against /data/2024/spells.json and adjudicates it with exactly one zero-damage rollDamage envelope carrying statusEffects', async () => {
    const spell = makeCharmMonsterPayload()
    const services = makeServices({ playerStats: makePlayerStats({ rules: '2024' }) })

    const result = await executeSpellCast(spell, { slotLevel: 4 }, services)

    expect(fetchCalls).toEqual(['/data/2024/spells.json'])
    // savePath receives a null formula and the faithful roller returns null —
    // rollDamage must have been called EXACTLY once (the fallback roll).
    expect(dice.rollExpression).toHaveBeenCalledTimes(1)
    expect(dice.rollExpression).toHaveBeenCalledWith(null)
    expect(services.rollDamage).toHaveBeenCalledTimes(1)
    expect(services.rollDamage.mock.calls[0][0]).toEqual({
      name: 'Charm Monster',
      formula: '0',
      total: 0,
      rolls: [],
      modifier: 0,
      context: {
        targetName: 'Goblin1',
        attackerName: 'TestWizard',
        slotLevel: 4,
        spellSchool: 'Enchantment',
        saveDc: 17,
        saveType: 'WIS',
        dcSuccess: 'none',
        metamagicHeighten: false,
        isCantrip: false,
        statusEffects: ['Charmed'],
      },
    })
    expect(services.rollAttack).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})
