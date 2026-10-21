// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  HUB AoE-modal routing + generic-heal branch lane (#1464)          */
/*                                                                    */
/*  Domain: this lane owns TWO hub faces of executeSpellCast:         */
/*   1) AoE picker PAYLOAD assembly routed through the hub when the   */
/*      spell row SUPPLIES area_of_effect directly (lookupFullSpell   */
/*      :172 bypassed — the disk-MERGE face is spellCastService.      */
/*      execute.test.js:391's flagship, cited, never re-owned).       */
/*      Selection MECHANICS live in the SaveAttackAoeModal /          */
/*      SaveAttackAoeModal picker lanes (#1345-era, cited);           */
/*      module-direct handleAoE payload math lives in                   */
/*      savePath-aoe-damage/-condition/-meta.test.js (cited).          */
/*   2) the generic-heal branches the siblings do NOT pin at hub:    */
/*      applyMaxHeal ('max' expression, index.js:391) and the          */
/*      resolveHealExpression highestBelow ladder fallback (:368).     */
/*                                                                    */
/*  REC DISPOSITIONS (#1454 verbatim recs #1/#2/#3 targeting this     */
/*  file):                                                              */
/*   - rec #1: saveAttackAoe objectContaining shells PURGED — both     */
/*     modal rows are full-set toStrictEqual payloads + identity       */
/*     (#1446 bar).                                                     */
/*   - rec #2: generic-heal block (5 bare-toHaveBeenCalled rows)      */
/*     FOLDED/rewritten. Folded (stronger coverage exists):             */
/*       old:297 dice-branch -> heal.test.js:336 +                     */
/*             execution/aoeHealingSpecial.test.js:533 (#1455 hub       */
/*             compute-vs-forward boundary);                            */
/*       old:343 combat-context-null -> heal.test.js:309;              */
/*       old:360 target-undefined -> heal.test.js:324.                 */
/*     Kept+strengthened (no stronger pin existed anywhere):           */
/*       old:274 max-branch -> disk 2024 Resurrection {7:'max'}       */
/*       real producer, full envelope + exact forward tuple;           */
/*       old:320 highestBelow fallback -> disk 2024 Goodberry          */
/*       {1:'1'} cast at slot 2 (RAW-upcast real-producer             */
/*       justification #1455 dead-fixture ban).                        */
/*   - rec #3: no mocked-delegate handled:true twins here — every     */
/*     row drives the REAL hub chain; all four fixtures are REAL      */
/*     disk rows (reachability verified: Grease 2024 automation       */
/*     carries effects.fail so :455 generic-automation does NOT       */
/*     consume it; Resurrection/Goodberry carry no automation key and */
/*     no name guard).                                                  */
/*                                                                    */
/*  Fixture honesty: old fabricated fixtures retired — 5e disk Grease */
/*  automation is an ARRAY (:172-shape) and never produces the        */
/*  aoeCondition popup (its :187 condition-only test reads false),    */
/*  and 5e disk has NO 'max' heal expression — the real 'max'         */
/*  producers are 2024 Resurrection/True Resurrection. Both rulesets */
/*  ride programmatically (#1365): 5e Fireball + 2024 trio, URL       */
/*  chosen by playerStats.rules (:175, URL-aware fetch #1454);       */
/*  area_of_effect size is numeric on 5e disk, string on 2024 disk   */
/*  (#1421/13 split) — this lane reads shape via String().toLowerCase */
/*  only (:31), size bytes pass through untouched: no .match/.replace */
/*  crash surface. dc byte flips dex->DEX observed at payload        */
/*  saveType. Casting-time stamp parity CLA-399: 'Action' (2024)     */
/*  normalizes to '1 action' and stamps; '1 hour' never does.         */
/*  Forward-vs-compute (#1335/#1455 verdict form): the hub COMPUTES   */
/*  the clamped heal (:391/:420) and FORWARDS (summary,name,amount,   */
/*  campaign) to the applyHealingToTarget producer — pinned below;     */
/*  HP-key census #1367: currentHitPoints read ONLY on these generic  */
/*  hub-producer rows. NO-CLOCK: heals/awards instantaneous; Grease   */
/*  duration rides the payload (SP-024) for the modal-side lifecycle  */
/*  — no timer stored here. Riders double-fire quirk (#1357/58) and   */
/*  post-cast lanes owned by heal.test.js / execution-post-cast —      */
/*  cited, not re-owned.                                                */
/*                                                                    */
/*  PRESERVED-CITED-BY (mock-line citations, old->new exact):          */
/*   - imprisonmentService.test.js:9 cited :117 -> now :215            */
/*   - globeOfInvulnerabilityService.test.js:30 cited :99 -> now :197 */
/*   - powerWordStunService.test.js:8 cited :109 -> now :207           */
/*  heal.test.js:48 and execute.test.js:391 cite scenario blocks       */
/*  (old :273-379 / :243) — dispositions in the REC block above.       */
/*  Mock block order preserved verbatim from the pre-#1464 file         */
/*  (phantom rules/ui/logService.js mock deleted — module does not      */
/*  exist; no importer resolves it).                                    */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast } from '../../spellCastService.js'
import spells5e from '../../../../../../public/data/spells.json'
import spells2024 from '../../../../../../public/data/2024/spells.json'

import * as applyHealing from '../../../combat/applyHealing.js'
import * as damageUtils from '../../../combat/damageUtils.js'
import * as dice from '../../../../dice/diceRoller.js'
import * as logService from '../../../../ui/logService.js'
import * as runtime from '../../../../../hooks/runtime/useRuntimeState.js'
import * as wildMagic from '../../../features/wildMagicSurgeService.js'

const CAMPAIGN = 'test-campaign'

const disk = (name, rules) => cloneDeep((rules === '2024' ? spells2024 : spells5e).find(s => s.name === name))

/* ------------------------------------------------------------------ */
/*  Mocks — block order preserved verbatim (#1464 recs cite lines)    */
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
  // Faithful stub (#1449/1456): null/empty guard mirrors diceRoller.js:78;
  // bare numeric formulas resolve to their literal total (Goodberry '1' pin).
  rollExpression: vi.fn((formula) => {
    if (!formula) return null
    if (/^\d+$/.test(formula.trim())) return { total: Number(formula.trim()), rolls: [], modifier: 0 }
    return { total: 15, rolls: [6, 5, 4], modifier: 0 }
  }),
  rollExpressionMaximized: vi.fn((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null)),
  // Export completeness: consumed by index.js:25; never fires (real
  // hasRerollHealingOnes is false on zero passives).
  applyHealingRerollOnes: vi.fn((rolls) => ({ displayRolls: rolls, originalRolls: null })),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
  getLog: vi.fn(),
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
  // Faithful regex mirrors real rangeToFeet (savePath-aoe-damage pattern):
  // '150 feet' -> 150, '60 feet' -> 60, junk/absent -> null.
  rangeToFeet: vi.fn((r) => {
    if (!r || typeof r !== 'string') return null
    const match = String(r).match(/^(-?\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$/i)
    return match ? parseFloat(match[1]) : null
  }),
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

/* ------------------------------------------------------------------ */
/*  Test-data factories — REAL disk rows only (#1455 fixture ban)    */
/* ------------------------------------------------------------------ */

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
    getTargetInfo: async () => ({ name: 'Target' }),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: 'testMap',
    ...overrides,
  }
}

/** CAMPAIGN addEntry calls of one type, volatile timestamp stripped. */
function entriesOfType(type) {
  return vi.mocked(logService.addEntry).mock.calls
    .filter(([campaign]) => campaign === CAMPAIGN)
    .map(([, entry]) => entry)
    .filter(e => e.type === type)
    .map((entry) => {
      const rest = { ...entry }
      delete rest.timestamp
      return rest
    })
}

/* ------------------------------------------------------------------ */
/*  Suite — hub AoE modal routing & generic-heal branches             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast — hub AoE modal routing & generic-heal branches (disk rows)', () => {
  let consoleError

  beforeEach(() => {
    vi.clearAllMocks()
    // URL-aware fetch stub (#1454): lookupFullSpell (:175) resolves both
    // catalog tiers; no unmocked-fetch noise, no live-server risk.
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })))
    vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)
    vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue(null)
    vi.mocked(runtime.getRuntimeValue).mockImplementation((_char, key) => {
      if (key === 'activeConditions' || key === 'targetEffects') return []
      if (key === 'hitPoints') return 100
      if (key === 'currentHitPoints') return 30
      return undefined
    })
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    consoleError.mockRestore()
  })

  // ------------------------------------------------------------------
  // saveAttackAoe — hub picker payload, area_of_effect supplied
  // directly (lookup bypassed; disk-MERGE face owned by
  // spellCastService.execute.test.js:391, cited).
  // ------------------------------------------------------------------
  it('routes the REAL 5e disk Fireball into the saveAttackAoe modal with the complete payload envelope, identity refs, stamped metaCtx riders, and zero hub dice (rec #1, #1446 bar)', async () => {
    const spell = disk('Fireball') // dc byte: dc_type 'DEX' (uppercase — old fabricated lowercase 'dex' retired)
    const services = makeServices()

    const result = await executeSpellCast(spell, { slotLevel: 3 }, services)

    // Lookup bypassed for rows carrying area_of_effect (:172):
    expect(fetch).not.toHaveBeenCalled()

    const payload = result.automationPopup.payload
    expect(result.automationPopup).toStrictEqual({
      type: 'modal',
      modalName: 'saveAttackAoe',
      payload: {
        action: { name: 'Fireball', automation: {}, spell },
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
    })
    // Identity: merged-spell ref IS the caller's row (bypass lane, fullSpell === spell).
    expect(payload.action.spell).toBe(spell)
    expect(payload.playerStats).toBe(services.playerStats)

    // The picker defers adjudication: the hub rolls NO damage here
    // (per-target dice live in the modal lane, #1345-era picker, cited).
    expect(services.rollAttack.mock.calls).toEqual([])
    expect(services.rollDamage.mock.calls).toEqual([])

    // CLA-389 post-payment merge (:754-759) rode the hub-stamped metaCtx
    // (CLA-134) — bypass-lane face of the execute.test.js:391 merge pin.
    expect(vi.mocked(damageUtils.getCombatContext).mock.calls).toEqual([[CAMPAIGN]])
    expect(wildMagic.triggerWildMagicSurge).toHaveBeenCalledWith(
      spell,
      { slotLevel: 3, metamagicHeighten: false, finalFormula: '8d6', featsOfChaosArmedAtCast: false },
      services.playerStats,
      CAMPAIGN,
      'testMap',
    )
    // CLA-399: '1 action' stamp — the ONLY runtime write on this lane.
    expect(runtime.setRuntimeValue.mock.calls).toEqual([['TestWizard', 'lastActionSpellCast', 1, CAMPAIGN]])
  })

  // ------------------------------------------------------------------
  // aoeCondition — hub picker payload, 2024 disk Grease. REAL
  // producer census: 5e disk Grease automation is an ARRAY and
  // reads NON-condition-only at :187 (routes to saveAttackAoe);
  // the condition-only branch is fed by 2024 disk rows
  // (Grease/Color Spray/Entangle). Module-direct condition bytes:
  // savePath-aoe-condition.test.js:120/:144 (cited).
  // ------------------------------------------------------------------
  it('routes the REAL 2024 disk Grease (no damage, automation.effects.fail) into the aoeCondition modal with the complete payload envelope and zero hub dice (#1365 both-rulesets face)', async () => {
    const spell = disk('Grease', '2024')
    const services = makeServices()

    const result = await executeSpellCast(spell, { slotLevel: 1 }, services)

    expect(fetch).not.toHaveBeenCalled() // area_of_effect supplied -> bypass

    const payload = result.automationPopup.payload
    expect(result.automationPopup).toStrictEqual({
      type: 'modal',
      modalName: 'aoeCondition',
      payload: {
        action: { name: 'Grease', automation: spell.automation },
        playerStats: services.playerStats,
        campaignName: CAMPAIGN,
        shape: 'square',
        range: 60,
        duration: '1 minute', // SP-024: duration rides the payload for the MODAL-side lifecycle — no clock stored here
        saveType: 'DEX',
        saveDc: 17,
        effects: [{ type: 'prone', condition: 'prone' }],
        conditionLabel: 'prone',
        activeOverlay: null,
        metamagicCareful: false,
        metamagicHeighten: false,
        includeCaster: true,
      },
    })
    expect(payload.effects).toBe(spell.automation.effects.fail)
    expect(payload.metamagicHeighten).toBe(false) // metaCtx pre-stamped at :680
    expect(services.rollDamage.mock.calls).toEqual([])
    expect(services.rollAttack.mock.calls).toEqual([])
    // 2024 'Action' normalizes to '1 action' (CLA-399) -> stamped exactly once.
    expect(runtime.setRuntimeValue.mock.calls).toEqual([['TestWizard', 'lastActionSpellCast', 1, CAMPAIGN]])
    expect(consoleError).not.toHaveBeenCalled()
  })

  // ------------------------------------------------------------------
  // Generic heal at the hub (:337) — branches the siblings do NOT
  // pin: applyMaxHeal envelope and the highestBelow ladder fallback.
  // Dice-branch, combat-context-null, target-undefined faces FOLDED
  // per rec #2 -> heal.test.js:336/:309/:324; compute-vs-forward
  // boundary -> aoeHealingSpecial.test.js:533 (#1455).
  // ------------------------------------------------------------------
  it('computes the max-heal branch from the REAL 2024 disk Resurrection ({7:"max"}), forwards the exact clamped tuple, returns the applyMaxHeal envelope (no rolls keys), and logs hp_change without a forward-side formula (#1335 hub computes)', async () => {
    const spell = disk('Resurrection', '2024')
    const summary = { creatures: [{ name: 'Target', maxHp: 100, currentHp: 30 }] }
    vi.mocked(damageUtils.getCombatContext).mockResolvedValue(summary)
    const services = makeServices({
      playerStats: makePlayerStats({ rules: '2024' }),
      characters: [{ name: 'Target', type: 'player' }],
    })

    const result = await executeSpellCast(spell, { slotLevel: 7 }, services)

    // Ruleset-split URL (#175): the 2024 catalog was fetched, exactly once.
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/data/2024/spells.json')

    // Max branch rolls NOTHING — full-HP clamp is arithmetic, not dice.
    expect(dice.rollExpression.mock.calls).toEqual([])
    expect(dice.rollExpressionMaximized.mock.calls).toEqual([])

    // Forward tuple: producer receives the hub-computed clamp (100-30),
    // its return value is ignored on this path (#1335/#1455).
    expect(vi.mocked(applyHealing.applyHealingToTarget).mock.calls).toEqual([[summary, 'Target', 70, CAMPAIGN]])

    // applyMaxHeal envelope: 7 keys — the rolled branch adds the two
    // healingReroll keys (:394 vs :422) — shape IS the branch proof.
    expect(result).toStrictEqual({
      targetName: 'Target', healAmount: 70, formula: 'max', rolls: [], rawTotal: 70,
      bonusHeal: 0, bonusDetails: [],
    })

    expect(entriesOfType('hp_change')).toEqual([{
      type: 'hp_change', targetName: 'Target', delta: 70, currentHp: 100, maxHp: 100,
      isHealing: true, sourceName: 'TestWizard', note: 'Resurrection',
    }])
    expect(entriesOfType('spell')).toEqual([{
      type: 'spell', characterName: 'TestWizard', targetName: 'Target', spellName: 'Resurrection',
      spellLevel: 7, castingTime: '1 hour', damageType: null, damageFormula: null,
      saveDC: null, concentration: false, description: spell.description.join(' '),
    }])
    // '1 hour' casting time never arms the Battle Magic flag.
    expect(runtime.setRuntimeValue.mock.calls).toEqual([])
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('resolves the highestBelow heal-ladder fallback casting the REAL 2024 disk Goodberry ({1:"1"}) at slot 2, rolls the literal once, and returns the rolled-branch envelope with reroll keys', async () => {
    const spell = disk('Goodberry', '2024') // ladder {1:'1'} — cast at slot 2 misses the key, falls back to level 1 ('1')
    const summary = { creatures: [{ name: 'TestWizard', maxHp: 100, currentHp: 30 }] }
    vi.mocked(damageUtils.getCombatContext).mockResolvedValue(summary)
    const services = makeServices({
      playerStats: makePlayerStats({ rules: '2024' }),
      getTargetInfo: async () => ({ name: 'TestWizard' }), // range 'Self' — RAW self-cast
      characters: [{ name: 'TestWizard', type: 'player' }],
    })

    const result = await executeSpellCast(spell, { slotLevel: 2 }, services)

    expect(fetch).toHaveBeenCalledWith('/data/2024/spells.json')
    // MOD-fold of the fallback expression ('1' carries no MOD) — rolled once, exact arg.
    expect(dice.rollExpression.mock.calls).toEqual([['1']])
    expect(dice.rollExpressionMaximized.mock.calls).toEqual([])
    // Clamp min(1, 100-30) = 1 — the fallback HEALED the ladder level it resolved.
    expect(vi.mocked(applyHealing.applyHealingToTarget).mock.calls).toEqual([[summary, 'TestWizard', 1, CAMPAIGN]])

    // Rolled-branch envelope (index.js:422): exactly the two reroll keys
    // beyond the max-branch shape — proves branch AND resolved formula.
    expect(result).toStrictEqual({
      targetName: 'TestWizard', healAmount: 1, formula: '1', rolls: [], rawTotal: 1,
      bonusHeal: 0, bonusDetails: [], healingRerollOriginalRolls: null, healingRerollDisplayRolls: [],
    })

    expect(entriesOfType('hp_change')).toEqual([{
      type: 'hp_change', targetName: 'TestWizard', delta: 1, currentHp: 31, maxHp: 100,
      isHealing: true, sourceName: 'TestWizard', note: 'Goodberry',
      formula: '1', bonusDetails: undefined,
    }])
    expect(consoleError).not.toHaveBeenCalled()
  })
})
