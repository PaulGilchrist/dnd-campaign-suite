// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  CAST-SEAM FEATURE SUBSCRIBER LANE — execution/index.js +          */
/*  execution/helpers.js + execution/triggerSpells.js run REAL.       */
/*  This file answers: WHICH feature subscribers fire at WHICH seam,  */
/*  with WHAT tuple, gated on WHAT collector-exact passive row.       */
/*                                                                      */
/*  Lane split (owners cited — not re-pinned here):                    */
/*   - runPostCastTriggers rider SET census + exact tuples +           */
/*     rejecting-rider self-catch (all helpers.js MOCKED there):       */
/*     execution-post-cast.test.js (:363/:594/:747/:797).              */
/*   - :597 merged early-return lanes + #1455 double-fire dedupe:      */
/*     execution-post-cast-lanes.cla389.test.js.                       */
/*   - triggerExpertDivination DIRECT internals (throw/refund/ladder): */
/*     helpers-expertDivination.test.js. THIS file is the seam-side   */
/*     consumer cited by automationCollector.expertDivination.test.js  */
/*     :5 ('gate predicate + trigger behavior covered in ...           */
/*     spellCastService.featureTriggers.test.js') — the real gate runs */
/*     BEHIND executeSpellCast, passives coming from REAL disk.        */
/*   - triggerResilientSphere caller dispatch cited by                 */
/*     resilientSphereService.test.js:41 — test 4 below (triggerSpells */
/*     REAL, leaf mocked: 'they mock triggerResilientSphere;           */
/*     complementary, not redundant').                                  */
/*   - dispel magic internals: helpers-dispelMagic.test.js; seam        */
/*     dispatch at index.js:357: execution-post-cast.test.js:747.     */
/*   - save/no-save/modal lane internals: savePath-*.test.js,          */
/*     noSavePath.test.js, execution-early-resolutions.test.js —      */
/*     savePath.js/noSavePath.js mocked here (they own RNG + overlay   */
/*     fetch); blockChecks/damageCalculation/modalSpells stay REAL     */
/*     (name-gated inert on the fixture casts, verified).              */
/*                                                                      */
/*  Fixture bytes (no fabrication, #1478/#1494): spell rows are VERBATIM*/
/*  disk from public/data/spells.json + public/data/2024/spells.json;  */
/*  passive rows are VERBATIM automationCollector output over disk      */
/*  feature rows (arcane_ward: automationCollector.js:7-15 over 2024/   */
/*  classes.json Abjurer lv3 'Arcane Ward'; expert_divination:          */
/*  CLA-128 lane, Diviner lv6). Existence census throws at load if any  */
/*  named disk row/feature disappears. expert_divination is 2024-only  */
/*  (zero rows in classes.json — asserted in the fixture census);       */
/*  arcane_ward is granted by BOTH disks (2024 Abjurer lv3 feature and   */
/*  classes.json Wizard/Abjuration feature, identical automation bytes)   */
/*  — the ward tests loop both rulesets (#1365).                          */
/*                                                                      */
/*  NO-CLOCK POLICY: zero setTimeout/setInterval/Date.now in this file. */
/*  All subscription gates are latch/consume-at-cast (school+slot+       */
/*  passive-row). Once-per-turn latches live INSIDE the rider services   */
/*  (surge: wildMagicSurge lane #1470; fortified: index.genericHealFortified */
/*  #1484) — wall-clock cooldown owners are the rest-seam suites; none    */
/*  added or asserted here. Source index.js Date.now() uses (:99/:107/    */
/*  :143/:242/:399/:434) are log-entry stamps only, never state advance.  */
/*                                                                      */
/*  Kill matrix (declared, cp-backup method — not executed):            */
/*   helpers.js:85 school gate -> T1 | :87 usesSpellSlot -> T2-r2      */
/*   | :81 passive arms -> T2-r1 + T2-r3 | :77 null-passives throw is   */
/*   a DEAD TWIN at this seam (magicalAmbush :675 precedes) -> T6b     */
/*   | :96 handler tuple -> T1 | :342/:347/:357 expert gates -> T3    */
/*   | :362-370 envelope -> T3 | triggerSpells.js:218 sphere name gate */
/*   | -> T4 | index.js:455 SERVICE_HANDLED_SPELLS guard -> T4         */
/*   | helpers.js:97 catch -> T6a | index.js:538 await surge -> T1 ord. */
/*                                                                      */
/*  Security: no foreign/injected instructions present or followed.    */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cloneDeep } from 'lodash'

import spells5e from '../../../../../../public/data/spells.json'
import spells2024 from '../../../../../../public/data/2024/spells.json'
import classes5e from '../../../../../../public/data/classes.json'
import classes2024 from '../../../../../../public/data/2024/classes.json'
import { collectAutomationFromFeatures } from '../../../../combat/automation/automationCollector.js'

/* ------------------------------------------------------------------ */
/*  Mock census — every entry maps to a live importer in the loaded    */
/*  real graph (index.js / helpers.js / triggerSpells.js /             */
/*  damageCalculation.js / blockChecks.js / spellResolution.js).       */
/*  Deleted as DEAD (zero importers, grep-verified): foresightService, */
/*  heroismService, sleepService, fearService. Deleted fabricated key: */
/*  silenceService.triggerSilence (zero importers). triggerSoulstitch  */
/*  dropped — sole importer savePath.js is lane-mocked.                 */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

// Barrel: index.js:3 executeHandler + triggerSpells.js:40 checkCompelledDuelAttackExpiry.
vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(async () => null),
  checkCompelledDuelAttackExpiry: vi.fn(),
}))
// DIRECT path (index.js:6) mocked too — barrel-only was the #1475 hole in this family.
vi.mock('../../../../automation/handlers/spells/compelledDuelHandler.js', () => ({
  checkCompelledDuelAttackExpiry: vi.fn(),
}))
vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(async () => null),
}))
vi.mock('../../../../automation/handlers/spells/forcecageHandler.js', () => ({
  isForcecageBlocked: vi.fn(() => false),
}))

// runPostCastTriggers fire-and-forget riders (index.js:8-13).
vi.mock('../../postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(),
  triggerPostCastAllyHeals: vi.fn(),
}))
vi.mock('../../postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(),
  triggerSpellThief: vi.fn(),
  triggerBewitchingMagic: vi.fn(),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))
vi.mock('../../../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(),
}))
vi.mock('../../../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(),
}))
vi.mock('../../../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(),
}))
vi.mock('../../../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(),
}))
vi.mock('../../../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(),
}))

// Every triggerSpells.js leaf (triggerSpells.js:1-40) — gated by spell name at
// chain thunks index.js:277-321/:328-333/:345-348; T4 counts the post-sphere
// short-circuit, so all leaves must be mock-observable.
vi.mock('../../../features/falseLifeService.js', () => ({ triggerFalseLife: vi.fn(async () => null) }))
vi.mock('../../../features/seeInvisibilityService.js', () => ({ triggerSeeInvisibility: vi.fn(async () => null) }))
vi.mock('../../../features/fleshToStoneService.js', () => ({ triggerFleshToStone: vi.fn(async () => null) }))
vi.mock('../../../features/holdMonsterService.js', () => ({ triggerHoldMonster: vi.fn(async () => null) }))
vi.mock('../../../features/banishmentService.js', () => ({ triggerBanishment: vi.fn(async () => null) }))
vi.mock('../../../features/confusionService.js', () => ({ triggerConfusion: vi.fn(async () => null) }))
vi.mock('../../../features/mazeService.js', () => ({ triggerMaze: vi.fn(async () => null) }))
vi.mock('../../../features/powerWordStunService.js', () => ({ triggerPowerWordStun: vi.fn(async () => null) }))
vi.mock('../../../features/hypnoticPatternService.js', () => ({ triggerHypnoticPattern: vi.fn(async () => null) }))
vi.mock('../../../features/slowService.js', () => ({ triggerSlow: vi.fn(async () => null) }))
vi.mock('../../../features/baneService.js', () => ({ triggerBaneSpell: vi.fn(async () => null) }))
vi.mock('../../../features/blessService.js', () => ({ triggerBlessSpell: vi.fn(async () => null) }))
vi.mock('../../../features/beaconOfHopeService.js', () => ({ triggerBeaconOfHope: vi.fn(async () => null) }))
vi.mock('../../../features/massSuggestionService.js', () => ({ triggerMassSuggestion: vi.fn(async () => null) }))
vi.mock('../../../features/suggestionService.js', () => ({ triggerSuggestion: vi.fn(async () => null) }))
vi.mock('../../../features/ottoDanceService.js', () => ({ triggerOttoDance: vi.fn(async () => null) }))
vi.mock('../../../features/resilientSphereService.js', () => ({ triggerResilientSphere: vi.fn(async () => null) }))
vi.mock('../../../features/blurService.js', () => ({ triggerBlur: vi.fn(async () => null) }))
vi.mock('../../../features/expeditiousRetreatService.js', () => ({ triggerExpeditiousRetreat: vi.fn(async () => null) }))
vi.mock('../../../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(async () => null),
}))
vi.mock('../../../features/crownOfMadnessService.js', () => ({ triggerCrownOfMadness: vi.fn(async () => null) }))
vi.mock('../../../features/animalFriendshipService.js', () => ({ triggerAnimalFriendship: vi.fn(async () => null) }))
vi.mock('../../../features/dominateBeastService.js', () => ({ triggerDominateBeast: vi.fn(async () => null) }))
vi.mock('../../../features/dominateMonsterService.js', () => ({ triggerDominateMonster: vi.fn(async () => null) }))
vi.mock('../../../features/dominatePersonService.js', () => ({ triggerDominatePerson: vi.fn(async () => null) }))
vi.mock('../../../features/rayOfEnfeeblementService.js', () => ({ triggerRayOfEnfeeblement: vi.fn(async () => null) }))
vi.mock('../../../features/compelledDuelService.js', () => ({ triggerCompelledDuel: vi.fn(async () => null) }))
vi.mock('../../../features/globeOfInvulnerabilityService.js', () => ({ triggerGlobeOfInvulnerability: vi.fn(async () => null) }))
vi.mock('../../../features/forcecageService.js', () => ({ triggerForcecage: vi.fn(async () => null) }))
vi.mock('../../../features/stinkingCloudService.js', () => ({ triggerStinkingCloud: vi.fn(async () => null) }))
vi.mock('../../../features/sleetStormService.js', () => ({ triggerSleetStorm: vi.fn(async () => null) }))
vi.mock('../../../features/faerieFireService.js', () => ({ triggerFaerieFire: vi.fn(async () => null) }))
vi.mock('../../../features/tashasHideousLaughterService.js', () => ({ triggerTashasHideousLaughter: vi.fn(async () => null) }))
vi.mock('../../../features/imprisonmentService.js', () => ({ triggerImprisonment: vi.fn(async () => null) }))
vi.mock('../../../features/holyAuraService.js', () => ({ triggerHolyAura: vi.fn(async () => null) }))
vi.mock('../../../features/massCureWoundsService.js', () => ({ triggerMassCureWounds: vi.fn(async () => null) }))
vi.mock('../../../features/massHealingWordService.js', () => ({ triggerMassHealingWord: vi.fn(async () => null) }))
vi.mock('../../../features/prayerOfHealingService.js', () => ({ triggerPrayerOfHealing: vi.fn(async () => null) }))
vi.mock('../../../features/removeCurseService.js', () => ({ triggerRemoveCurse: vi.fn(async () => null) }))

// Cast-side services invoked on every cast (index.js:17-19) or via REAL helpers.
vi.mock('../../../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}))
vi.mock('../../../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
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
vi.mock('../../../combat/applyHealing.js', () => ({ applyHealingToTarget: vi.fn() }))
vi.mock('../../../combat/damageUtils.js', () => ({ getCombatContext: vi.fn(() => null) }))
vi.mock('../../../effects/expirations.js', () => ({ addExpiration: vi.fn() }))

// RNG + overlay-fetch lanes: owner savePath-*.test.js / noSavePath.test.js.
vi.mock('./savePath.js', () => ({ handleSavePath: vi.fn(async () => null) }))
vi.mock('./noSavePath.js', () => ({ handleNoSavePath: vi.fn(async () => null) }))

import { executeSpellCast } from './index.js'
import * as runtimeState from '../../../../../hooks/runtime/useRuntimeState.js'
import * as arcWardHandler from '../../../../automation/handlers/class-wizard/arcaneWardHandler.js'
import * as postCastRider from '../../postCastRiderService.js'
import * as postCastHeal from '../../postCastHealService.js'
import * as healingWord from '../../../features/healingWordService.js'
import * as smiteProt from '../../../features/smiteOfProtectionService.js'
import * as inspiringSmite from '../../../features/inspiringSmiteService.js'
import * as primalShare from '../../../features/primalCompanionSpellShareService.js'
import * as wildSurge from '../../../features/wildMagicSurgeService.js'
import * as triggerSpellsLeaves from '../../../features/resilientSphereService.js'
import * as blurLeaf from '../../../features/blurService.js'
import * as expRetreatLeaf from '../../../features/expeditiousRetreatService.js'
import * as stinkingLeaf from '../../../features/stinkingCloudService.js'
import * as tashaLeaf from '../../../features/tashasHideousLaughterService.js'
import * as holyAuraLeaf from '../../../features/holyAuraService.js'
import * as falseLifeLeaf from '../../../features/falseLifeService.js'
import * as massCureLeaf from '../../../features/massCureWoundsService.js'
import * as automationBarrel from '../../../../automation/index.js'
import { addEntry } from '../../../../ui/logService.js'

/* ------------------------------------------------------------------ */
/*  Fixtures — REAL disk bytes, existence-censused at load (#1494)   */
/* ------------------------------------------------------------------ */

function diskRow(db, name) {
  const row = db.find(s => s.name === name)
  if (!row) throw new Error('disk fixture missing: ' + name)
  return row
}

function diskFeature(majorName, featureName) {
  const wizard = classes2024.find(c => c.name === 'Wizard')
  const major = (wizard?.majors || []).find(m => m.name === majorName)
  const feature = (major?.features || []).find(f => f.name === featureName)
  if (!feature) throw new Error('disk feature missing: 2024 ' + majorName + '/' + featureName)
  return feature
}

function diskFeature5e(featureName) {
  const wizard = classes5e.find(c => c.name === 'Wizard')
  const feature = (wizard?.subclasses || []).flatMap(sc => (sc.class_levels || []).flatMap(cl => cl.features || []))
    .find(f => f.name === featureName)
  if (!feature) throw new Error('disk feature missing: 5e Wizard/' + featureName)
  return feature
}

// Collector-normalized passive rows, produced LIVE from disk (collector runs REAL).
const arcaneWardPassive = collectAutomationFromFeatures([diskFeature('Abjurer', 'Arcane Ward')], {}).passives
const arcaneWardPassive5e = collectAutomationFromFeatures([diskFeature5e('Arcane Ward')], {}).passives
const expertDivPassive = collectAutomationFromFeatures([diskFeature('Diviner', 'Expert Divination')], {}).passives
const savantPassive = collectAutomationFromFeatures([diskFeature('Abjurer', 'Abjuration Savant')], {}).passives

// spell.js:76 fetch stub — byte-faithful disk server so REAL lookupFullSpell runs.
global.fetch = vi.fn(async (url) => {
  const db = url === '/data/2024/spells.json' ? spells2024
    : url === '/data/spells.json' ? spells5e
      : null
  if (!db) return { ok: false, status: 404, json: async () => null }
  return { ok: true, status: 200, json: async () => db }
})

function makePlayerStats(passives, rules = '2024') {
  return {
    name: 'Seher',
    rules,
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives },
    hitPoints: 100,
  }
}

function makeServices(playerStats) {
  return {
    rollAttack: vi.fn(async () => ({ hit: true })),
    rollDamage: vi.fn(async () => ({ total: 0 })),
    playerStats,
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: 'test-campaign',
    mapName: 'testMap',
    characters: [],
  }
}

const CAMPAIGN = 'test-campaign'
const DEFAULT_STORE = (entity, key) => {
  if (key === 'activeConditions' || key === 'targetEffects') return []
  return undefined
}

let consoleError

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(runtimeState.getRuntimeValue).mockImplementation(DEFAULT_STORE)
  // Fire-and-forget riders MUST return Promises — index.js chains .catch on them.
  for (const fn of [
    postCastRider.triggerPostCastRiderSaves, postCastRider.triggerSpellThief,
    postCastRider.triggerBewitchingMagic, postCastHeal.triggerPostCastSelfHeals,
    postCastHeal.triggerPostCastAllyHeals, healingWord.triggerHealingWord,
    smiteProt.triggerSmiteOfProtection, inspiringSmite.triggerInspiringSmite,
    primalShare.triggerPrimalCompanionSpellShare, wildSurge.triggerWildMagicSurge,
  ]) fn.mockImplementation(async () => {})
  consoleError = vi.spyOn(console, 'error')
})

describe('executeSpellCast feature subscribers — REAL helpers.js/triggerSpells.js at the cast seam', () => {
  it('fixture census: disk rows verbatim + collector emits the gate-matching passive rows', () => {
    expect(diskRow(spells2024, 'Armor of Agathys')).toMatchObject({ school: 'Abjuration', level: 1 })
    expect(diskRow(spells5e, 'Resistance')).toMatchObject({ school: 'Abjuration', level: 0 })
    expect(diskRow(spells2024, 'Clairvoyance')).toMatchObject({ school: 'Divination', level: 3 })
    expect(diskRow(spells5e, 'Resilient Sphere')).toMatchObject({
      automation: { type: 'resilient_sphere', saveDc: 'ability', saveType: 'DEX', duration: 'Up to 1 minute' },
    })
    // Arcane ward collector form (automationCollector.js:9-15) over disk lv3 row bytes:
    expect(arcaneWardPassive).toHaveLength(1)
    expect(expertDivPassive).toHaveLength(1)
    // Abjuration Savant is a passive_rule NEAR-MISS (effect is not arcane_ward):
    expect(savantPassive).toHaveLength(1)
    expect(savantPassive[0]).toMatchObject({ effect: 'abjuration_savant' })
    expect(savantPassive[0].type === 'arcane_ward' || savantPassive[0].effect === 'arcane_ward').toBe(false)
    // arcane_ward is disk-granted on BOTH rulesets; expert_divination is 2024-only
    // (zero expert_divination rows in classes.json — the remaining N/A declaration):
    expect(diskFeature5e('Arcane Ward').automation).toEqual(diskFeature('Abjurer', 'Arcane Ward').automation)
    expect(arcaneWardPassive5e).toEqual(arcaneWardPassive)
    expect(JSON.stringify(classes5e).includes('expert_divination')).toBe(false)
  })

  it('Arcane Ward subscriber: gate helpers.js:81-96 fires onAbjurationSpellCast once with exact 5-tuple after the awaited surge, on collector arcane_ward passive + Abjuration slot cast — both rulesets', async () => {
    const rows = [
      { rules: '2024', spell: diskRow(spells2024, 'Armor of Agathys'), passives: arcaneWardPassive },
      { rules: '5e', spell: diskRow(spells5e, 'Alarm'), passives: arcaneWardPassive5e },
    ]
    for (const { rules, spell, passives } of rows) {
      vi.clearAllMocks()
      const playerStats = makePlayerStats(passives, rules)
      const metaCtx = { slotLevel: 1 }
      const services = makeServices(playerStats)
      const snap = cloneDeep({ spell, metaCtx, playerStats })

      const res = await executeSpellCast(spell, metaCtx, services)

      expect(res, spell.name).toBeNull()
      expect(arcWardHandler.onAbjurationSpellCast, spell.name).toHaveBeenCalledTimes(1)
      expect(arcWardHandler.onAbjurationSpellCast.mock.calls[0], spell.name).toHaveLength(5)
      const [action, ps, spellName, slotLevel, campaign] = arcWardHandler.onAbjurationSpellCast.mock.calls[0]
      expect(action).toEqual({ name: 'Arcane Ward', automation: { type: 'arcane_ward' } })
      expect(ps).toBe(playerStats)
      expect(spellName).toBe(spell.name)
      expect(slotLevel).toBe(1)
      expect(campaign).toBe(CAMPAIGN)
      // Fan-out order (#1490): awaited surge :538 resolves before the last subscriber :550;
      // the observed subscriber sequence matches the source order :506-:550 exactly.
      const seq = [postCastRider.triggerPostCastRiderSaves, postCastHeal.triggerPostCastSelfHeals,
        postCastHeal.triggerPostCastAllyHeals, smiteProt.triggerSmiteOfProtection,
        inspiringSmite.triggerInspiringSmite, primalShare.triggerPrimalCompanionSpellShare,
        postCastRider.triggerSpellThief, wildSurge.triggerWildMagicSurge,
        postCastRider.triggerBewitchingMagic, arcWardHandler.onAbjurationSpellCast].map(f => f.mock.invocationCallOrder[0])
      expect(seq).toHaveLength(10)
      seq.forEach((n, i) => { if (i > 0) expect(n, spell.name).toBeGreaterThan(seq[i - 1]) })
      expect(consoleError, spell.name).not.toHaveBeenCalled()
      expect(cloneDeep({ spell, metaCtx, playerStats })).toEqual(snap)
    }
  })

  it('Arcane Ward gate near-misses fire zero: wrong school, slot-less cantrip (5e disk), passive_rule effect mismatch', async () => {
    // r1 - school gate helpers.js:85 (2024 disk Evocation, ward granted):
    const fireball = diskRow(spells2024, 'Fireball')
    await executeSpellCast(fireball, { slotLevel: 3 }, makeServices(makePlayerStats(arcaneWardPassive)))
    expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()

    // r2 - usesSpellSlot gate helpers.js:87 (5e disk Abjuration cantrip, slotLevel 0):
    vi.clearAllMocks()
    const cantrip = diskRow(spells5e, 'Resistance')
    await executeSpellCast(cantrip, { slotLevel: 0 }, makeServices(makePlayerStats(arcaneWardPassive5e, '5e')))
    expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()

    // r3 - passive arm mismatch helpers.js:81 (Abjuration Savant passive_rule row is not arcane_ward):
    vi.clearAllMocks()
    await executeSpellCast(fireball, { slotLevel: 3 }, makeServices(makePlayerStats(savantPassive)))
    expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()

    // r4 - not granted: empty passives (2024 wizard without the Abjurer major):
    vi.clearAllMocks()
    await executeSpellCast(diskRow(spells2024, 'Armor of Agathys'), { slotLevel: 1 }, makeServices(makePlayerStats([])))
    expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('Expert Divination subscriber (automationCollector.expertDivination.test.js:5 consumer): divination lv3 slot fires executeHandler once with exact envelope+4-tuple; school/depth/name gates fire zero', async () => {
    const playerStats = makePlayerStats(expertDivPassive)
    const spell = diskRow(spells2024, 'Clairvoyance')
    const metaCtx = { slotLevel: 3 }
    const services = makeServices(playerStats)
    const snap = cloneDeep({ spell, metaCtx, playerStats })

    const res = await executeSpellCast(spell, metaCtx, services)

    expect(res).toBeNull()
    expect(automationBarrel.executeHandler).toHaveBeenCalledTimes(1)
    expect(automationBarrel.executeHandler.mock.calls[0]).toHaveLength(4)
    const [action, ps, campaign, map] = automationBarrel.executeHandler.mock.calls[0]
    expect(action).toEqual({
      name: 'Expert Divination',
      automation: { type: 'expert_divination', casting_time: 'passive' },
      spell,
      spellSlotLevel: 3,
    })
    expect(action.spell).toBe(spell)
    expect(ps).toBe(playerStats)
    expect(campaign).toBe(CAMPAIGN)
    expect(map).toBe('testMap')

    // Gate table: school :342 / depth :347 / name+type :357 all fire zero dispatches.
    vi.clearAllMocks()
    await executeSpellCast(diskRow(spells2024, 'Fireball'), { slotLevel: 3 }, makeServices(makePlayerStats(expertDivPassive)))
    expect(automationBarrel.executeHandler).not.toHaveBeenCalled()
    await executeSpellCast(diskRow(spells2024, 'Detect Magic'), { slotLevel: 1 }, makeServices(makePlayerStats(expertDivPassive)))
    expect(automationBarrel.executeHandler).not.toHaveBeenCalled()
    // Cross-feature bytes: the ABJURER collector passive row must not satisfy the diviner name+type gate:
    await executeSpellCast(spell, { slotLevel: 3 }, makeServices(makePlayerStats(arcaneWardPassive)))
    expect(automationBarrel.executeHandler).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(cloneDeep({ spell, metaCtx, playerStats })).toEqual(snap)
  })

  it('triggerResilientSphere caller dispatch (cited by resilientSphereService.test.js:41) — both rulesets disk rows fire once with exact tuple, short-circuit the chain behind them, and the 5e automation row rides the SERVICE_HANDLED_SPELLS guard instead of executeHandler', async () => {
    // 5e disk row carries automation.type resilient_sphere: without the
    // SERVICE_HANDLED_SPELLS guard (triggerSpells.js:44/:455) handleGenericAutomation
    // would consume the cast via executeHandler instead of the chain handler.
    const sphere5e = diskRow(spells5e, 'Resilient Sphere')
    const metaCtx5e = { slotLevel: 4 }
    const services5e = makeServices(makePlayerStats([], '5e'))

    const res5e = await executeSpellCast(sphere5e, metaCtx5e, services5e)

    expect(res5e).toBeUndefined()
    expect(triggerSpellsLeaves.triggerResilientSphere).toHaveBeenCalledTimes(1)
    expect(triggerSpellsLeaves.triggerResilientSphere.mock.calls[0]).toHaveLength(5)
    expect(triggerSpellsLeaves.triggerResilientSphere).toHaveBeenCalledWith(
      sphere5e,
      { slotLevel: 4, metamagicHeighten: false, spellSaveDc: 17 },
      services5e.playerStats, CAMPAIGN, 'testMap')
    expect(automationBarrel.executeHandler).not.toHaveBeenCalled()
    // Short-circuit census: every chain member AFTER :297 never runs...
    expect(blurLeaf.triggerBlur).not.toHaveBeenCalled()
    expect(expRetreatLeaf.triggerExpeditiousRetreat).not.toHaveBeenCalled()
    expect(stinkingLeaf.triggerStinkingCloud).not.toHaveBeenCalled()
    expect(tashaLeaf.triggerTashasHideousLaughter).not.toHaveBeenCalled()
    expect(holyAuraLeaf.triggerHolyAura).not.toHaveBeenCalled()
    expect(falseLifeLeaf.triggerFalseLife).not.toHaveBeenCalled()
    expect(massCureLeaf.triggerMassCureWounds).not.toHaveBeenCalled()
    // ...and every member BEFORE :297 is name-gated off.
    expect(healingWord.triggerHealingWord).not.toHaveBeenCalled()

    // 2024 disk row ('Otiluke\'s Resilient Sphere', automation absent): same dispatch.
    vi.clearAllMocks()
    const sphere24 = diskRow(spells2024, "Otiluke's Resilient Sphere")
    const services24 = makeServices(makePlayerStats([]))
    const res24 = await executeSpellCast(sphere24, { slotLevel: 4 }, services24)
    expect(res24).toBeUndefined()
    expect(triggerSpellsLeaves.triggerResilientSphere).toHaveBeenCalledTimes(1)
    expect(triggerSpellsLeaves.triggerResilientSphere).toHaveBeenCalledWith(
      sphere24,
      { slotLevel: 4, metamagicHeighten: false, spellSaveDc: 17 },
      services24.playerStats, CAMPAIGN, 'testMap')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('Arcane Ward rejection self-catches inside the REAL helper (helpers.js:95-99): a rejecting onAbjurationSpellCast yields the exact seam console tuple, subscriber still attempted once, paid cast resolves null', async () => {
    const playerStats = makePlayerStats(arcaneWardPassive)
    const spell = diskRow(spells2024, 'Armor of Agathys')
    const boom = new Error('ward lane down')
    arcWardHandler.onAbjurationSpellCast.mockRejectedValue(boom)

    const res = await executeSpellCast(spell, { slotLevel: 1 }, makeServices(playerStats))

    expect(res).toBeNull()
    expect(arcWardHandler.onAbjurationSpellCast).toHaveBeenCalledTimes(1)
    // Exact console tuple census — only the helper catch fires:
    expect(consoleError.mock.calls).toEqual([['[spellCast] Arcane Ward trigger failed:', boom]])
  })

  it('fix#126 (#1495) flip of the retired dead-twin pin: corrupt caster state NO LONGER rejects at the ambush read — the hub self-catches (:157-:164/:774), degrades metamagicHeighten:false, and the FULL post-cast rider block runs', async () => {
    // Pre-fix capture (green pre-fix, #1495): executeSpellCast rejected WHOLE with
    // 'activeConditions must be an array for caster' — surge / rider-saves / cast
    // log all times(0): the paid cast and EVERY rider dead. Law now (fix#119 :817
    // confusion-await catch mirrored at the hub): a failing NON-CRITICAL resolution
    // costs its own bonus, never the cast. passives stay a lawful [] so the resolver
    // dies at its OWN :139 corrupt-row guard — ambush bonus lost, spell lands.
    const playerStats = makePlayerStats(arcaneWardPassive)
    playerStats.automation = { passives: [] }
    runtimeState.getRuntimeValue.mockImplementation((entity, key) => {
      if (key === 'activeConditions') return 'not-an-array'
      if (key === 'targetEffects') return []
      return undefined
    })
    const spell = diskRow(spells2024, 'Armor of Agathys')

    const res = await executeSpellCast(spell, { slotLevel: 1 }, makeServices(playerStats))

    // Lane completes with its golden payload (mirrors the golden ward row: null).
    expect(res).toBeNull()
    // Resolver's LOUD guard byte (:139) then the hub catch byte (:161) — exact order.
    expect(consoleError.mock.calls.map(c => c[0])).toEqual([
      '[spellCast] casterConditions: activeConditions is not an array',
      '[spellCast] Magical Ambush resolution failed:',
    ])
    // Riders alive: the post-cast block ran — surge + rider saves once each.
    expect(wildSurge.triggerWildMagicSurge).toHaveBeenCalledTimes(1)
    expect(postCastRider.triggerPostCastRiderSaves).toHaveBeenCalledTimes(1)
    // The cast is real: hostile side-effects paid, cast log written. Zero writes:
    // Armor of Agathys is a BONUS ACTION disk row (CLA-399 stamp gate stays shut)
    // and the ambush fold is metaCtx-threading only (index.genericHealFortified
    // / magicalAmbushTransport write-census law) — the degrade adds none.
    expect(arcWardHandler.onAbjurationSpellCast).not.toHaveBeenCalled()
    expect(addEntry).toHaveBeenCalledTimes(1)
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([])
  })

  it('fix#126 boundary (REPORT, owner lane): automation-ABSENT casts survive the ambush hub-catch but still die at the sibling damageCalculation.js:140-142 overchannel THROW — same #1495 class, forbidden edit here (#121-stable file)', async () => {
    // Honest current-bytes map: the hub :157-:164 catch fires FIRST (its two console
    // bytes prove ambush degraded, not murdered), then the damage-lane calc pays the
    // SAME caster-substitution-free loud-throw at damageCalculation.js:142 — that
    // guard's owner lane is damageCalculation.test.js (#1468-69/#121 family). Reported,
    // not fixed: damageCalculation.js is out of this lane's edit boundary.
    const playerStats = makePlayerStats(arcaneWardPassive)
    delete playerStats.automation
    const spell = diskRow(spells2024, 'Armor of Agathys')

    await expect(executeSpellCast(spell, { slotLevel: 1 }, makeServices(playerStats)))
      .rejects.toThrow('playerStats.automation.passives is required for overchannel check')

    expect(consoleError.mock.calls.map(c => c[0])).toEqual([
      '[spellCast] magicalAmbush check: playerStats.automation.passives is missing',
      '[spellCast] Magical Ambush resolution failed:',
      '[spellCast] overchannelPassives: playerStats.automation.passives is missing',
    ])
    // Ambush already degraded before the sibling guard's death: no rider reached
    // the tail (the reject happens mid-damage-lane).
    expect(wildSurge.triggerWildMagicSurge).not.toHaveBeenCalled()
  })
})
