// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'

import * as applyDamage from '../../../services/rules/combat/applyDamage.js'
import * as combatData from '../../../services/encounters/combatData.js'
import * as dice from '../../dice/diceRoller.js'
import * as logService from '../../../services/ui/logService.js'
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js'

/* ------------------------------------------------------------------ */
/*  MISSILE LANE (#1454 split table face: "Magic Missile" hub)      */
/*                                                                    */
/*  Identity: the HUB face of the auto-hit dart lane. REAL internals */
/*  run: index.js chain (blockChecks, runTriggerChain, damage path,  */
/*  lookupFullSpell fetch-merge, computeSpellStats), damageCalculation */
/*  .computeRange (null positions -> {} via damageCalculation.js:4,  */
/*  rangeValidation mock REMOVED as over-mock), noSavePath.js:60-63  */
/*  missile gate, helpers.js executeMagicMissile/rollTargetMissiles/  */
/*  applyMissileDamage/logMagicMissileSpell. Mocked edges: dice, log, */
/*  runtime store, combatData state, applyDamage producer, feature     */
/*  services, riders. Fixtures are REAL disk rows — disk-faithful     */
/*  directive (#1455 dead-route discovery): both disk rows carry NO    */
/*  `dc`, so index.js:754 no-dc branch -> handleNoSavePath ->          */
/*  isMagicMissile(name) gate is reached verbatim. Disk shows          */
/*  damage_at_slot_level '1d4 + 1' at EVERY tier — scaling is by dart */
/*  COUNT (helpers.js:497-499), dice formula stays byte-constant.      */
/*                                                                    */
/*  Boundary vs siblings (covered there, cited only):                  */
/*   - getMagicMissileCount/isMagicMissile arithmetic + case gate ... */
/*     execution/helpers-magicMissile.test.js (module-direct)         */
/*   - slotLevel->dart/formula/log bytes, real rollDamage payload .... */
/*     execution/helpers.sp075-magicMissile-upcast.test.js (:61-101,  */
/*     module-direct with REAL rollDamage; on THIS hub lane noSavePath */
/*     .js:61 swaps rollDamage for a no-op — pinned below)            */
/*   - zero-count skip damage tuple (hub) ........ execution/          */
/*     spellCastService.healingEdgeCases.test.js:478-503               */
/*   - noSavePath delegation gate (mocked delegate) .. execution/     */
/*     noSavePath.test.js:111-115                                      */
/*   - save-DC/range/auto-miss/emp-bake/overchannel (master) +        */
/*     caller-boundary REAL-internals + cantrip-level-dual-impl .... */
/*     spellCastService.test.js + spellCastService.execute.test.js   */
/*   - hostile-cast endFriends/endInvisibility/lastActionSpellCast ...*/
/*     execution-early-resolutions lane (index.js:59-70)              */
/*   - picker allocation sums ....... hooks useSpellMetamagicFlow lanes */
/*   - #1454 cantrip-level 🔴 (index.js:53 vs noSavePath.js:13):     */
/*     the missile gate at noSavePath.js:60 returns BEFORE that        */
/*     formula-bake block, and MM is level 1 on both disks — this lane */
/*     pins auto-hit bypasses bake: every rollExpression call is the   */
/*     exact disk '1d4 + 1', totals carry no INT modifier, and         */
/*     rollExpressionMaximized/Doubled are landmined (auto-hit cannot  */
/*     crit — code stance at helpers.js:501-511, no crit branch).     */
/*                                                                    */
/*  Compute-vs-forward (#1335): the lane COMPUTES dart count          */
/*  (helpers.js:497) and per-target element-wise dart totals         */
/*  (helpers.js:501-511); it FORWARDS (summary by identity, name,     */
/*  total, [type], opts) to the applyDamageToTarget producer           */
/*  (helpers.js:528). Distribution is trusted as-supplied (order-     */
/*  stable Object.entries, helpers.js:580) — the hub never clamps     */
/*  Σdistribution vs numMissiles (upstream picker owns the sum).       */
/*                                                                    */
/*  Quirks pinned: helpers.js:542 fires a decorative summary roll      */
/*  `${numMissiles}× 1d4 + 1` whose REAL diceRoller return is null    */
/*  (diceRoller.js:109 parseExpression misses '×') — queue-mock        */
/*  consumes no naturals for it; generic cast log spells spellLevel    */
/*  from spell.level while the missile log spells slotLevel            */
/*  (index.js:239 vs helpers.js:548) — split pinned in the 2024 test.  */
/*                                                                    */
/*  Mock audit (#1440): loaded graph imports diceRoller only for      */
/*  rollExpression/rollExpressionMaximized/applyHealingRerollOnes      */
/*  (helpers.js:11, index.js:25, noSavePath.js:1, savePath.js:1);     */
/*  mock spreads the REAL module (full 13-export set incl.             */
/*  applyHealingRerollOnes — #1455 precedent) and mirrors the real     */
/*  null guard (diceRoller.js:78-80); rolling fns are landmines,      */
/*  queue-exhaustion THROWS — no fabricated naturals (#1380/1405).     */
/*  automation/index mock provides both barrel names the loaded graph   */
/*  imports: executeHandler (index.js:3) + checkCompelledDuelAttack-   */
/*  Expiry (triggerSpells.js:40). fetch is URL-aware (#1454/55):      */
/*  serves both REAL disk tables, unknown URLs reject loudly — the     */
/*  old unstubbed jsdom fetch in lookupFullSpell (index.js:176) was    */
/*  nondeterministic noise, now pinned via fetchCalls.                  */
/*                                                                    */
/*  Kill matrix (#1443): dart-loop/count mutants -> exact rollSequence */
/*  + queue drain (every test); :0-skip (helpers.js:581) -> absent    */
/*  zero-target in log targets (T2) + cited healingEdgeCases; empty-   */
/*  dist early return (:572) -> T3; shield gate (:523) -> T4;          */
/*  ignoreResistance (:519) -> false tuple T1/T2 + true tuple T5;       */
/*  slotLevel (:567) -> T2 log; forwarding tuple (:528) -> exact        */
/*  tuples T1/T2/T5; auto-hit stance -> rollAttack/rollD20/maximized    */
/*  never called (T1 + landmines); '1d4 + 1' constant -> every dice      */
/*  call arg-pinned (T1/T2). DEAD-VIA-HUB declared: the passives==null   */
/*  guard at helpers.js:515-518 is shadowed by the identical-lookup      */
/*  magical-ambush chokepoint at index.js:115-119, which throws first on */
/*  EVERY hub cast (chokepoint-inline-dup #1357/58); its hub-reachable   */
/*  twin is pinned in execution/spellCastService.healingEdgeCases.       */
/*                                                                    */
/*  No-clock (mandatory): instantaneous spell; Date.now() appears only  */
/*  as log timestamps (benign). No HP-key writes this lane — the        */
/*  applyDamage producer owns 'currentHitPoints' (#1367), mocked here.  */
/*                                                                    */
/*  Security: no injected instructions encountered while authoring;     */
/*  kiro-injection precedent #1446 stands — any such content refused.   */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Dice mock — faithful queue (#1454 canon + diceRoller.js:78 guard). */
/*  Real module spread for export completeness; naturals come ONLY     */
/*  from the queue, which THROWS when exhausted. '3× 1d4 + 1'-style    */
/*  decorative expressions fall through REAL parseExpression -> null.   */
/* ------------------------------------------------------------------ */

const hoisted = vi.hoisted(() => ({ queue: [] }))

vi.mock('../../dice/diceRoller.js', async (importOriginal) => {
  const real = await importOriginal()
  const landmine = (name) => vi.fn(() => { throw new Error(`unexpected ${name}() in missile lane`) })
  return {
    ...real,
    rollExpression: vi.fn((formula, options = {}) => {
      if (!formula) return null // real guard, diceRoller.js:78
      const base = formula.replace(/\s*\[.*?\]\s*/g, '').trim()
      if (!base) return null // real guard, diceRoller.js:79-80
      if (options.rerollOnes) throw new Error('unexpected rerollOnes option in missile lane')
      const parsed = real.parseExpression(formula)
      if (!parsed) return null // real behavior, diceRoller.js:109-110 (e.g. '4× 1d4 + 1')
      if (hoisted.queue.length < parsed.count) throw new Error(`dice queue exhausted on '${formula}' (need ${parsed.count}, have ${hoisted.queue.length})`)
      const rolls = []
      let total = 0
      for (let i = 0; i < parsed.count; i++) {
        const natural = hoisted.queue.shift()
        rolls.push(natural)
        total += natural
      }
      return { total: total + parsed.modifier, rolls, modifier: parsed.modifier, formula }
    }),
    rollExpressionMaximized: landmine('rollExpressionMaximized'), // auto-hit cannot crit — bake must not reach MM
    rollExpressionDoubled: landmine('rollExpressionDoubled'),
    rollD20: landmine('rollD20'), // no attack roll anywhere in this lane
    rollDie: landmine('rollDie'),
    rollDice: landmine('rollDice'),
    rollAdvantage: landmine('rollAdvantage'),
    rollDisadvantage: landmine('rollDisadvantage'),
    applyHealingRerollOnes: landmine('applyHealingRerollOnes'), // heal-lane surface (#1455), not missile
  }
})

/* ---------------- mocked edges (house form, .execute/#1449 canon) ---------------- */

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => []),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
  getLog: vi.fn(),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(() => null),
  checkCompelledDuelAttackExpiry: vi.fn(),
}))

vi.mock('../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
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

vi.mock('./postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(async () => {}),
  triggerSpellThief: vi.fn(async () => {}),
  triggerBewitchingMagic: vi.fn(async () => {}),
  triggerSoulstitchSpells: vi.fn(async () => {}),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => {}),
}))

vi.mock('../features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(async () => {}),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(async () => {}),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(async () => {}),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(async () => {}),
}))

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  // identity producer: finalDamage equals forwarded raw total unless a test overrides
  applyDamageToTarget: vi.fn((_summary, _targetName, damage) => ({ finalDamage: damage, damageReduced: false })),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}))

vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => null),
}))

vi.mock('../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

/* ---------------- fixtures: REAL disk rows ---------------- */

const CAMPAIGN = 'test-campaign'
const MAP = 'testMap'

function diskMagicMissile5e() {
  return cloneDeep(spells5e.find((s) => s.name === 'Magic Missile'))
}
function diskMagicMissile2024() {
  return cloneDeep(spells2024.find((s) => s.name === 'Magic Missile'))
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    ...overrides,
  }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: MAP,
    characters: [],
    ...overrides,
  }
}

/* ---------------- fetch stub — URL-aware (#1454/55) ---------------- */

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
    return Promise.reject(new Error(`unexpected fetch in missile lane: ${url}`))
  }))
}

function castLogEntries() {
  return logService.addEntry.mock.calls.map((c) => {
    expect(c[0]).toBe(CAMPAIGN)
    return c[1]
  })
}

// Splits the wall-clock timestamp (benign log stamp, never a game clock) so
// every remaining byte is pinned exactly — no expect.any / objectContaining.
function withoutTimestamp(entry) {
  const { timestamp, ...rest } = entry
  expect(Number.isFinite(timestamp)).toBe(true)
  return rest
}

/* ------------------------------------------------------------------ */
/*  Suite                                                             */
/* ------------------------------------------------------------------ */

describe('executeSpellCast - Magic Missile hub lane (no-save routing, REAL disk rows)', () => {
  beforeEach(() => {
    vi.clearAllMocks() // keeps factory impls; clears call records
    installFetchStub()
    hoisted.queue = []
    runtimeState.getRuntimeValue.mockImplementation((_character, key) => {
      if (key === 'activeConditions' || key === 'targetEffects' || key === 'activeBuffs') return []
      return undefined
    })
    combatData.getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('routes the disk row to the missile branch and auto-hits: 3 darts rolled at the byte-constant disk formula, one exact forwarding tuple, no attack roll, no crit bake, no rollDamage (swallowed by noSavePath.js:61), both logs shaped', async () => {
    const spell = diskMagicMissile5e()
    const summary = { creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }] }
    combatData.getCombatSummary.mockReturnValue(summary)
    hoisted.queue = [3, 4, 5]

    const services = makeServices()
    await executeSpellCast(spell, { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } }, services)

    // exact dart sequence incl. the discarded decorative summary roll (helpers.js:542):
    // REAL rollExpression returns null for 'N× ...' (diceRoller.js:109) — queue drained by darts only
    expect(dice.rollExpression.mock.calls).toEqual([
      ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['3× 1d4 + 1'],
    ])
    expect(hoisted.queue).toEqual([])

    // auto-hit stance: no attack roll, no crit/maximized bake, no save adjudication
    expect(services.rollAttack).not.toHaveBeenCalled()
    expect(dice.rollExpressionMaximized).not.toHaveBeenCalled()
    expect(dice.rollExpressionDoubled).not.toHaveBeenCalled()
    expect(dice.rollD20).not.toHaveBeenCalled()

    // hub-edge stance: noSavePath.js:61 replaces services.rollDamage with () => {} —
    // the per-target roll payload (helpers.js:590) never reaches the roll pipeline
    expect(services.rollDamage).not.toHaveBeenCalled()

    // exact forwarding tuple (#1335): totals 4+5+6=15 — no INT +5 baked into dart math
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1)
    expect(applyDamage.applyDamageToTarget.mock.calls[0][0]).toBe(summary)
    expect(applyDamage.applyDamageToTarget.mock.calls[0].slice(1)).toEqual([
      'Goblin', 15, ['Force'],
      { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' },
    ])

    // both logs, exact key sets + values
    const entries = castLogEntries()
    expect(entries).toHaveLength(2)
    const generic = withoutTimestamp(entries[0])
    expect(Object.keys(entries[0])).toEqual(['type', 'characterName', 'targetName', 'spellName', 'spellLevel', 'castingTime', 'damageType', 'damageFormula', 'saveDC', 'concentration', 'description', 'timestamp'])
    expect(generic).toEqual({
      type: 'spell', characterName: 'TestWizard', targetName: 'Goblin', spellName: 'Magic Missile',
      spellLevel: 1, castingTime: '1 action', damageType: 'Force', damageFormula: '1d4 + 1',
      saveDC: null, concentration: false, description: spells5e.find((s) => s.name === 'Magic Missile').description.join(' '),
    })
    const missile = withoutTimestamp(entries[1])
    expect(Object.keys(entries[1])).toEqual(['type', 'characterName', 'spellName', 'spellLevel', 'castingTime', 'missileCount', 'missileDamage', 'damageType', 'targets', 'totalRawDamage', 'totalFinalDamage', 'timestamp'])
    expect(missile).toEqual({
      type: 'spell', characterName: 'TestWizard', spellName: 'Magic Missile', spellLevel: 1,
      castingTime: '1 action', missileCount: 3, missileDamage: '1d4 + 1', damageType: 'Force',
      targets: [{ name: 'Goblin', missiles: 3, rawDamage: 15, finalDamage: 15, shieldImmune: false }],
      totalRawDamage: 15, totalFinalDamage: 15,
    })

    // lookupFullSpell traversed once against the 5e disk, input pure
    expect(fetchCalls).toEqual(['/data/spells.json'])
    expect(spell).toEqual(diskMagicMissile5e())
  })

  it('2024 disk row upcast in the hub: darts scale with the paid slot (dice bytes constant), allocation is order-stable, the zero-count target is absent from the log, and the generic log keeps spell.level while the missile log keeps slotLevel', async () => {
    const spell = diskMagicMissile2024()
    const summary = { creatures: [] }
    combatData.getCombatSummary.mockReturnValue(summary)
    hoisted.queue = [1, 2, 3, 2]

    const services = makeServices({ playerStats: makePlayerStats({ rules: '2024' }) })
    await executeSpellCast(spell, { slotLevel: 2, magicMissileDistribution: { Goblin: 3, Orc: 1, Troll: 0 } }, services)

    // disk byte evidence: damage_at_slot_level is '1d4 + 1' at EVERY tier (both disks) —
    // lv2 scales the COUNT (missileCount 4), never the dice; Troll:0 target rolled nothing
    expect(dice.rollExpression.mock.calls).toEqual([
      ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['4× 1d4 + 1'],
    ])
    expect(hoisted.queue).toEqual([])

    // order-stable allocation-by-index (helpers.js:580): Goblin (2+3+4=9) then Orc (2+1=3)
    expect(applyDamage.applyDamageToTarget.mock.calls.map((c) => c.slice(1))).toEqual([
      ['Goblin', 9, ['Force'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }],
      ['Orc', 3, ['Force'], { campaignName: CAMPAIGN, characters: [], ignoreResistance: false, attackerName: 'TestWizard' }],
    ])
    expect(applyDamage.applyDamageToTarget.mock.calls[0][0]).toBe(summary)
    expect(applyDamage.applyDamageToTarget.mock.calls[1][0]).toBe(summary)

    const entries = castLogEntries()
    expect(entries).toHaveLength(2)
    // quirk pin (helpers.js vs index.js:239): generic log under-reports the upcast level
    const generic = withoutTimestamp(entries[0])
    expect(generic).toEqual({
      type: 'spell', characterName: 'TestWizard', targetName: 'Goblin', spellName: 'Magic Missile',
      spellLevel: 1, castingTime: 'Action', damageType: 'Force', damageFormula: '1d4 + 1',
      saveDC: null, concentration: false, description: spells2024.find((s) => s.name === 'Magic Missile').description.join(' '),
    })
    const missile = withoutTimestamp(entries[1])
    expect(missile).toEqual({
      type: 'spell', characterName: 'TestWizard', spellName: 'Magic Missile', spellLevel: 2,
      castingTime: 'Action', missileCount: 4, missileDamage: '1d4 + 1', damageType: 'Force',
      targets: [
        { name: 'Goblin', missiles: 3, rawDamage: 9, finalDamage: 9, shieldImmune: false },
        { name: 'Orc', missiles: 1, rawDamage: 3, finalDamage: 3, shieldImmune: false },
      ],
      totalRawDamage: 12, totalFinalDamage: 12,
    })

    // ruleset-aware disk lookup (index.js:175) + input purity
    expect(fetchCalls).toEqual(['/data/2024/spells.json'])
    expect(spell).toEqual(diskMagicMissile2024())
  })

  it('returns before any dart work on an empty distribution: only the generic cast log is written, no rolls, no damage', async () => {
    const spell = diskMagicMissile5e()
    const services = makeServices()

    await executeSpellCast(spell, { slotLevel: 1, magicMissileDistribution: {} }, services)

    // helpers.js:572-574 early return
    expect(dice.rollExpression).not.toHaveBeenCalled()
    expect(hoisted.queue).toEqual([])
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
    expect(services.rollDamage).not.toHaveBeenCalled()
    expect(services.rollAttack).not.toHaveBeenCalled()

    // exactly one log — the generic cast entry; no missile entry
    const entries = castLogEntries()
    expect(entries).toHaveLength(1)
    expect(withoutTimestamp(entries[0])).toEqual({
      type: 'spell', characterName: 'TestWizard', targetName: 'Goblin', spellName: 'Magic Missile',
      spellLevel: 1, castingTime: '1 action', damageType: 'Force', damageFormula: '1d4 + 1',
      saveDC: null, concentration: false, description: spells5e.find((s) => s.name === 'Magic Missile').description.join(' '),
    })
  })

  it('#1456 disk law at the hub: the Shield SPELL buff (toggleBuff bytes — name "Shield", effect "shield", no oneShot) nulls missile damage ("you take no damage from magic missile", spells.json:8779), while a monster one-shot shield stamp flows full dart damage through the producer — no blanket missile immunity', async () => {
    // Stance was pinned as "RAW divergence" pre-fix because ANY effect:'shield' buff —
    // including MA-1170 monster reaction stamps (oneShot:true, +5 AC vs ONE triggering
    // attack, MonsterCardHelpers.js:1888-1899) — zeroed whole volleys. helpers.js now
    // gates immunity to non-oneShot Shield-spell buffs; the false divergence claim is
    // retired, both arms re-pinned to the quoted disk law.
    const spell = diskMagicMissile5e()
    hoisted.queue = [2, 2, 2]
    runtimeState.getRuntimeValue.mockImplementation((_character, key) => {
      if (key === 'activeBuffs') return [{ name: 'Shield', effect: 'shield', sourceCharacter: 'Goblin' }]
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })

    const services = makeServices()
    await executeSpellCast(spell, { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } }, services)

    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()

    // 3 darts still rolled + the discarded summary roll
    expect(dice.rollExpression.mock.calls).toEqual([
      ['1d4 + 1'], ['1d4 + 1'], ['1d4 + 1'], ['3× 1d4 + 1'],
    ])
    expect(hoisted.queue).toEqual([])

    const entries = castLogEntries()
    expect(entries).toHaveLength(2)
    expect(withoutTimestamp(entries[1])).toEqual({
      type: 'spell', characterName: 'TestWizard', spellName: 'Magic Missile', spellLevel: 1,
      castingTime: '1 action', missileCount: 3, missileDamage: '1d4 + 1', damageType: 'Force',
      targets: [{ name: 'Goblin', missiles: 3, rawDamage: 9, finalDamage: 0, shieldImmune: true }],
      totalRawDamage: 9, totalFinalDamage: 0,
    })
  })

  it('#1456 hub: MONSTER shield-reaction stamp bytes (oneShot:true) never grant volley immunity — every dart reaches the producer at full raw total, shieldImmune:false', async () => {
    const spell = diskMagicMissile5e()
    hoisted.queue = [2, 2, 2]
    runtimeState.getRuntimeValue.mockImplementation((_character, key) => {
      if (key === 'activeBuffs') return [{ effect: 'shield', acBonus: 5, oneShot: true, source: 'Shield', vsAttack: 'TestWizard:Magic Missile', timestamp: 1 }]
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })

    const services = makeServices()
    await executeSpellCast(spell, { slotLevel: 1, magicMissileDistribution: { Goblin: 3 } }, services)

    // full volley forwarded: 2+2+2=6 natural+1 totals rolled per dart -> raw 9
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1)
    expect(applyDamage.applyDamageToTarget.mock.calls[0].slice(1, 3)).toEqual(['Goblin', 9])

    const entries = castLogEntries()
    expect(withoutTimestamp(entries[1])).toEqual({
      type: 'spell', characterName: 'TestWizard', spellName: 'Magic Missile', spellLevel: 1,
      castingTime: '1 action', missileCount: 3, missileDamage: '1d4 + 1', damageType: 'Force',
      targets: [{ name: 'Goblin', missiles: 3, rawDamage: 9, finalDamage: 9, shieldImmune: false }],
      totalRawDamage: 9, totalFinalDamage: 9,
    })
  })

  it('ignore_resistance passive flips only the forwarded opts flag — full tuple otherwise identical', async () => {
    const spell = diskMagicMissile5e()
    hoisted.queue = [4]
    combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }] })

    const services = makeServices({
      playerStats: makePlayerStats({
        automation: { passives: [{ type: 'auto_effect', effect: 'ignore_resistance' }] },
      }),
    })
    await executeSpellCast(spell, { slotLevel: 1, magicMissileDistribution: { Goblin: 1 } }, services)

    // single dart: natural 4 + 1 = 5; negative byte (ignoreResistance false) is pinned in lane test 1
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1)
    expect(applyDamage.applyDamageToTarget.mock.calls[0].slice(1)).toEqual([
      'Goblin', 5, ['Force'],
      { campaignName: CAMPAIGN, characters: [], ignoreResistance: true, attackerName: 'TestWizard' },
    ])
  })
})
