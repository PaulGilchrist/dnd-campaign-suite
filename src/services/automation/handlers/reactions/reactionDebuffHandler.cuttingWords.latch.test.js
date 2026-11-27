// @maintained-by-ai 2026-11-27 — CLA-071: Cutting Words reaction-latch lane over
// reactionDebuffHandler.js (default/bardic route: handleBardicRoll → bardicRangeRefusal
// (:571-579) → gateBardicReaction (:606-622) / bardicAttackIdentity (:583-586) /
// buildBardicStampPatch (:429-438) → §39 bake-before-dispatch (:658, skipSync=true) +
// flush-after-dispatch (:671); automation/index.js `reaction_debuff` → handle →
// DEFAULT_EFFECT_ROUTE). This file owns: the once-per-round Reaction latch
// (_Cutting_Words_usedRound), the per-attack-instance marker
// (_Cutting_Words_appliedAttack, timestamp identity AND the no-timestamp fallback
// `d20:{d20}+{bonus}:{attacker}` — pinned NOWHERE else in the octet), the bardic
// out-of-range refusal (zero-log contract: bardicRangeRefusal emits NO
// cutting_words_refused row, unlike its bardicRefuse sibling :590 — reported), and
// the exact-arg rollback-heal complements to .cuttingWords.test.js's prose pins.
//
// Family seam map (nine lanes over reactionDebuffHandler.js; full map in
// .attacksVsAlly.test.js header). Not restated here:
//  - .defaultPath.test.js:289: the gate's no_defender leg (exact string, reason
//    token, zero heal/stamp) — NOT re-pinned;
//  - .uses.test.js: exact-array budget censuses around the stamp (uses keys,
//    zero double-spend); its stamp values ride a round-1 identity — the
//    later-round + stale-marker release semantics are owned HERE;
//  - .cuttingWords.test.js: popup prose composition + defenderHp surfacing +
//    the single generic ability_use tail row (this file pins only the tail ROW
//    COUNT); .earlyExits owns front-door exits; attacksVsAlly's header flags
//    SOURCE BUG #1 (handleAttacksVsAlly :455 calls resolveMapPositions with 2
//    args) — our 3-arg pins (:574 campaignName, mapName, playerName) are the
//    correct reference shape and stay strong.
//
// Arity census (family rec #1877): the SOURCE reads latch/marker with
// getRuntimeValue(playerName, key, campaignName) (:611/:615) while the uses
// reads (:416) pass 2 args — and the REAL signature
// (hooks/runtime/useRuntimeState.js:63) is (characterKey, propertyName), so the
// 3rd arg is silently ignored (reported). The (charKey, key)-keyed store router
// ignores arity, so every leg ALSO pins the ordered EXACT getRuntimeValue
// mock.calls arrays: the campaignName asymmetry and the gate-ORDER zero-read
// pins (reaction_spent short-circuits BEFORE the marker read; the range refusal
// short-circuits BEFORE findLastAttack and both latch reads) are locked bytes.
//
// Deterministic: FROZEN Date.now in beforeEach (bake/flush/marker/log rows and
// the full refusal-log envelope pinned exact); vi.resetAllMocks + ALL lane
// defaults re-installed every test (bare vi.fn factories, zero clearAllMocks
// residue); infoPopup is the REAL dependency-free builder (mirror mock purged
// family-wide); applyHealingToTarget is an ARG-DERIVED sync clamp
// (newHp = HEAL_BASE + amount, actualHeal = amount) so a wrong-amount call
// surfaces in defenderHp instead of hiding behind a hardcoded { newHp: 163 };
// BI face seed-pinned through the canonical diceRoller lane (fix#169, face 4);
// rejecting-addEntry survivor leg proves the refusal response outlives a dead
// log channel. No *Once chains, no mid-test re-harnesses (per-case rig
// installs only), no save-listener strays possible here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './reactionDebuffHandler.js';

// ── Mocks BEFORE imports (bare vi.fn factories — every default is re-installed
//    in beforeEach; infoPopup is NOT mocked: real pure builder) ───────────────
vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
  resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  findLastAttack: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

// Canonical dice lane mock (fix#169 recipe): the BI die arrives via diceRoller,
// never raw Math.random — latch/marker/stamp assertions are die-numeral-free.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'test-campaign';
const mapName = 'TestMap';
const playerName = 'CuttingWordsBard';
const attackerName = 'Bandit 1';
const defenderName = 'HeroesFeastBard';
const ATTACK_TS = 1234567890;
const FROZEN_NOW = 1735689600000;
const BI_FACE = 4;
const HEAL_BASE_HP = 157;

// Latch-store defaults: 5/5 BI uses, latch + marker clear. Tests merge seeds.
const LATCH_STORE_DEFAULTS = {
  [`${playerName}.bardicInspirationUses`]: 5,
};

function makeBardStats(overrides = {}) {
  return {
    name: playerName,
    proficiency: 2,
    level: 20,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 3, bardic_die: 6 },
        { level: 20, bardic_die: 12 },
      ],
    },
    abilities: [{ name: 'Charisma', bonus: 5 }],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 5, max: 5 },
    },
    ...overrides,
  };
}

function makeCuttingWordsAction() {
  return {
    name: 'Cutting Words',
    automation: {
      type: 'reaction_debuff',
      trigger: 'damage_ability_check_or_attack_roll_within_60ft',
      debuffExpression: 'bardic_inspiration_die',
      subtractive: true,
      range: '60 ft',
      casting_time: '1 reaction',
    },
  };
}

// (charKey, key)-keyed router (family idiom): never a positional chain, so
// added internal reads cannot shift these values — the exact mock.calls arrays
// in each leg carry the arity/order truth instead.
function seedRuntimeStore(seed = {}) {
  const store = { ...LATCH_STORE_DEFAULTS, ...seed };
  useRuntimeState.getRuntimeValue.mockImplementation(
    (charKey, key) => store[`${charKey}.${key}`]
  );
}

// Damage-lane trigger (damageTypes non-empty ⇒ gate.isDamageLane): d20 17+3 vs
// AC 13 hit, 6 slashing on HeroesFeastBard. timestamp null exercises the
// identity fallback (the key must be present-null, not dropped).
function damageLaneResult({ timestamp = ATTACK_TS } = {}) {
  return {
    attackEvent: { d20: 17, bonus: 3, targetName: defenderName, targetAc: 13, hit: true, timestamp },
    attackerName,
    targetName: defenderName,
    primaryDamage: 6,
    secondaryDamage: 0,
    totalDamage: 6,
    damageTypes: ['Slashing'],
  };
}

const popupFor = (description) => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Cutting Words',
    description,
    automation: makeCuttingWordsAction().automation,
  },
});

const ROUND_SPENT_MSG =
  'Cutting Words has already been used this round — a Reaction can only be taken once per round. It re-arms when the next round begins.';
const ROLL_APPLIED_MSG =
  'Cutting Words has already been applied to this roll — one trigger roll can only be subtracted once. Nothing spent.';

describe('CLA-071: Cutting Words — reaction latch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // All lane defaults re-installed EVERY test (no impl residue).
    seedRuntimeStore();
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue({ round: 1 });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: attackerName } });
    targetResolver.resolveMapPositions.mockResolvedValue(null); // range-skip default
    rangeCheck.isWithinRange.mockResolvedValue(true);
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    // ARG-DERIVED sync clamp (source seam is unawaited — mockReturnValue shape):
    // a wrong heal amount now shifts defenderHp instead of hiding behind a
    // hardcoded return that happens to match the fixture.
    applyHealing.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      newHp: HEAL_BASE_HP + amount,
      actualHeal: amount,
    }));
    // Seed pin (fix#169): BI face 4; rollD20 belongs to other routes' lanes.
    diceRoller.rollDie.mockReturnValue(BI_FACE);
    diceRoller.rollD20.mockReturnValue(10);
  });

  const REFUSAL_CASES = [
    {
      title: 'round latch equal: refuses, marker never read, reason reaction_spent',
      seed: { [`${playerName}._Cutting_Words_usedRound`]: 1 },
      round: 1,
      attack: damageLaneResult(),
      description: ROUND_SPENT_MSG,
      reason: 'reaction_spent',
      // gate-ORDER zero-read pin: latch hit short-circuits BEFORE the marker read.
      expectedReads: [
        [playerName, 'bardicInspirationUses'],
        [playerName, '_Cutting_Words_usedRound', campaignName],
      ],
      findLastAttackCalls: 1,
    },
    {
      title: 'marker equals the timestamp identity: refuses, reason attack_already_debuffed',
      seed: { [`${playerName}._Cutting_Words_appliedAttack`]: String(ATTACK_TS) },
      round: 2,
      attack: damageLaneResult({ timestamp: ATTACK_TS }),
      description: ROLL_APPLIED_MSG,
      reason: 'attack_already_debuffed',
      expectedReads: [
        [playerName, 'bardicInspirationUses'],
        [playerName, '_Cutting_Words_usedRound', campaignName],
        [playerName, '_Cutting_Words_appliedAttack', campaignName],
      ],
      findLastAttackCalls: 1,
    },
    {
      title: 'marker equals the no-timestamp fallback identity d20:17+3:Bandit 1: refuses',
      seed: { [`${playerName}._Cutting_Words_appliedAttack`]: 'd20:17+3:Bandit 1' },
      round: 2,
      attack: damageLaneResult({ timestamp: null }),
      description: ROLL_APPLIED_MSG,
      reason: 'attack_already_debuffed',
      expectedReads: [
        [playerName, 'bardicInspirationUses'],
        [playerName, '_Cutting_Words_usedRound', campaignName],
        [playerName, '_Cutting_Words_appliedAttack', campaignName],
      ],
      findLastAttackCalls: 1,
    },
    {
      title: 'out of range: refuses before findLastAttack and both latch reads, and logs NOTHING',
      seed: {},
      round: 1,
      attack: null, // never reached — zero-read pin below proves it
      positions: { attackerPos: { gridX: 1, gridY: 1 }, targetPos: { gridX: 9, gridY: 9 } },
      inRange: false,
      description: 'Bandit 1 is out of range.',
      reason: null, // bardicRangeRefusal (:571-579) has no bardicRefuse log channel
      expectedReads: [[playerName, 'bardicInspirationUses']],
      rangeCalls: [[playerName, attackerName, 60]], // '60 ft' parseInt + range checked vs attacker
      findLastAttackCalls: 0,
    },
    {
      title: 'refusal response survives a rejected refusal-log write',
      seed: { [`${playerName}._Cutting_Words_usedRound`]: 1 },
      round: 1,
      attack: damageLaneResult(),
      description: ROUND_SPENT_MSG,
      reason: 'reaction_spent',
      rejectLog: true,
      expectedReads: [
        [playerName, 'bardicInspirationUses'],
        [playerName, '_Cutting_Words_usedRound', campaignName],
      ],
      findLastAttackCalls: 1,
    },
  ];

  it.each(REFUSAL_CASES)('$title', async (c) => {
    seedRuntimeStore(c.seed);
    damageUtils.getCombatContext.mockResolvedValue({ round: c.round });
    if (c.attack) damageRollback.findLastAttack.mockResolvedValue(c.attack);
    if (c.positions) targetResolver.resolveMapPositions.mockResolvedValue(c.positions);
    if (c.inRange !== undefined) rangeCheck.isWithinRange.mockResolvedValue(c.inRange);
    if (c.rejectLog) {
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log offline')));
    }

    const action = makeCuttingWordsAction();
    const result = await handle(action, makeBardStats(), campaignName, mapName);

    // REAL infoPopup envelope: exact-shape also proves no defenderHp leak.
    expect(result).toEqual(popupFor(c.description));
    // Full-array refusal-log census under the frozen clock (empty = the silent
    // range-gate contract reported in the header).
    expect(logService.addEntry.mock.calls).toEqual(c.reason ? [[campaignName, {
      type: 'automation',
      characterName: playerName,
      automationType: 'cutting_words_refused',
      name: 'Cutting Words',
      description: c.description,
      reason: c.reason,
      timestamp: FROZEN_NOW,
    }]] : []);
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(c.expectedReads);
    // Every leg carries an active map ⇒ the one 3-arg lookup runs.
    expect(targetResolver.resolveMapPositions.mock.calls).toEqual([[campaignName, mapName, playerName]]);
    expect(rangeCheck.isWithinRange.mock.calls).toEqual(c.rangeCalls ?? []);
    expect(damageRollback.findLastAttack.mock.calls).toEqual(
      Array.from({ length: c.findLastAttackCalls }, () => [campaignName])
    );
    // Zero spend, zero stamp, zero heal, zero dice — nothing bought the refusal.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(diceRoller.rollDie).not.toHaveBeenCalled();
  });

  it('releases on a fresh attack in a later round past a stale mismatched marker: range-gate reads, ordered bake→flush commit census, exact heal args', async () => {
    const staleIdentity = '9999999999'; // marker present but ≠ current identity ⇒ must NOT refuse
    seedRuntimeStore({
      [`${playerName}._Cutting_Words_usedRound`]: 1,
      [`${playerName}._Cutting_Words_appliedAttack`]: staleIdentity,
    });
    const combatSummary = { round: 3 };
    damageUtils.getCombatContext.mockResolvedValue(combatSummary);
    const newTs = ATTACK_TS + 60000;
    damageRollback.findLastAttack.mockResolvedValue(damageLaneResult({ timestamp: newTs }));
    targetResolver.resolveMapPositions.mockResolvedValue({
      attackerPos: { gridX: 1, gridY: 1 },
      targetPos: { gridX: 2, gridY: 2 },
    });

    const action = makeCuttingWordsAction();
    const result = await handle(action, makeBardStats(), campaignName, mapName);

    // 3-arg map lookup (campaignName, mapName, playerName) — the correct shape
    // the attacksVsAlly lane's SOURCE BUG #1 lacks — then range vs the attacker.
    expect(targetResolver.resolveMapPositions.mock.calls).toEqual([[campaignName, mapName, playerName]]);
    expect(rangeCheck.isWithinRange.mock.calls).toEqual([[playerName, attackerName, 60]]);
    // Ordered read census: budget probe (2-arg) → latch (3-arg) → mismatched
    // marker (3-arg) → buildBardicStampPatch's budget re-read (2-arg).
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
      [playerName, 'bardicInspirationUses'],
      [playerName, '_Cutting_Words_usedRound', campaignName],
      [playerName, '_Cutting_Words_appliedAttack', campaignName],
      [playerName, 'bardicInspirationUses'],
    ]);
    // §39 ordered exact-array two-write census: store-only bake BEFORE dispatch
    // carrying the NEW round + identity + spend, then awaited flush with
    // byte-identical economy keys + frozen flushTs.
    const stamp = {
      _Cutting_Words_usedRound: 3,
      _Cutting_Words_appliedAttack: String(newTs),
      bardicInspirationUses: 4,
    };
    expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([
      [playerName, stamp, campaignName, true],
      [playerName, { ...stamp, _Cutting_Words_flushTs: FROZEN_NOW }, campaignName],
    ]);
    // preSpent route: post-route spendUse never fires (no double-spend).
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    // Damage lane: 6 − max(0, 6−4) = 4 healed, campaignName threaded (:104).
    expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([
      [combatSummary, defenderName, 6 - Math.max(0, 6 - BI_FACE), campaignName],
    ]);
    expect(diceRoller.rollDie).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollD20).not.toHaveBeenCalled(); // the second-d20 sim is other routes
    // Envelope + clamp round-trip: newHp surfaced is HEAL_BASE + the REAL amount
    // (prose + defenderHp wording owned by .cuttingWords.test.js).
    expect(result).toEqual({
      ...popupFor(expect.any(String)),
      defenderHp: HEAL_BASE_HP + 4,
    });
    // Exactly ONE log row — the generic ability_use tail (shape owned by
    // .cuttingWords.test.js); no refusal row leaked onto the success path.
    expect(logService.addEntry.mock.calls).toHaveLength(1);
  });

  it('threads the combat summary, defender, full damage and campaignName through the hit-to-miss rollback heal', async () => {
    // Attack-roll lane (no damageTypes, totalDamage 0): 14+3=17 vs AC 17 hit;
    // BI 4 ⇒ 10+3=13 < 17 turns it to a MISS ⇒ heal reversal fires.
    const combatSummary = { round: 1 };
    damageUtils.getCombatContext.mockResolvedValue(combatSummary);
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: { d20: 14, bonus: 3, targetName: defenderName, targetAc: 17, hit: true, timestamp: ATTACK_TS },
      attackerName,
      targetName: defenderName,
      primaryDamage: 10,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });

    await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

    // Exact-arg complement to .cuttingWords.test.js's prose-only hit→miss test:
    // (combatSummary, defender, 10, campaignName) via reverseHitDamage (:27).
    expect(applyHealing.applyHealingToTarget.mock.calls).toEqual([
      [combatSummary, defenderName, 10, campaignName],
    ]);
  });
});
