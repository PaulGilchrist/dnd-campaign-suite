// @maintained-by-ai 2026-11-27 — DEFAULT-ROUTE detail lane over
// reactionDebuffHandler.js (handle → DEFAULT_EFFECT_ROUTE → handleBardicRoll →
// handleAttackRollDebuff; automation/index.js `reaction_debuff` → handle,
// auto.effect '' → default route). This file owns, in two $-titled families:
//   APPLIED-CONTENT it.each (full-shape popup toEqual via the REAL infoPopup
//   builder, seed-pinned 1d8 face 4 through the canonical rollDie lane):
//   - 'still hits': the canonical 'Attack still hits.' prose + exact HIT
//     ladder (shed by cuttingWords.main, canonical repo-wide);
//   - d20 floor-at-1: max(1, d20 − die) exact reduced line;
//   - effectiveAc shadows a present targetAc (the AC-ladder precedence leg
//     cuttingWords.main does NOT cover — its event omits effectiveAc, pinning
//     the targetAc fallback instead);
//   - both ACs null: 'AC —' dash + N/A reduced outcome, no outcome prose.
//   REFUSAL it.each (full-shape popup WITHOUT a defenderHp key, ordered
//   exact-arity getRuntimeValue read censuses, full-array log/commit zero-
//   spend censuses, zero findLastAttack re-read, zero dice):
//   - CANONICAL home of the damage-lane no_defender gate refusal (exact
//     string + cutting_words_refused row full-shape under the frozen clock +
//     reason token). gateBardicReaction refuses BEFORE dispatch, so the
//     one-call findLastAttack census also proves handleDamageDebuff's own
//     :94 no-targetName guard is unreachable;
//   - the no-recent-roll/mismatch exits (exact full string, both trigger
//     shapes) — the :638 gate short-circuits before gateBardicReaction, so
//     the read census pins ZERO latch/marker reads (gate-ORDER pin).
//
// NOT this lane (nine-lane seam map in .attacksVsAlly.test.js header): damage
// lane prose/full-shape content + targetAc-fallback + already-missed/now-
// misses prose + the 1d6 die-size pin (.cuttingWords.test.js CONTENT_CASES —
// this file's former damage-routing pin with its expect.any(Number) heal arg
// was a strict-subset duplicate and is removed); exact-arg applyHealingToTarget
// pins, latch/marker/identity, resolveMapPositions 3-arg reference shape and
// rejecting-log survivor legs (.cuttingWords.latch.test.js, #1880 handoff:
// both sibling lanes use an ARG-DERIVED clamp + exact-arg censuses there — the
// old "cuttingWords pins exact floor args" note pointed at a moved pin);
// ordered stamp bake→flush commit censuses + budget arithmetic (.uses.test.js);
// front-door guards + no-combat-context (.earlyExits.test.js); second-d20
// rollD20 lane + reverseHitDamage 4-arg SOURCE BUG #2 (:132, reported) —
// .attacksVsAlly.test.js owns handleDisadvantageDebuff.
//
// Deterministic: FROZEN Date.now in beforeEach + vi.resetAllMocks with ALL
// lane defaults re-installed every test (bare vi.fn factories, no
// clearAllMocks residue, no factory-set impls); infoPopup is the REAL
// dependency-free builder (family-wide mirror-mock purge) so the envelope +
// automation echo stay honest; applyHealingToTarget is an ARG-DERIVED sync
// clamp even though every kept leg is zero-heal (the clamp makes any future
// wrong-amount leak surface instead of hiding behind undefined); the 3rd
// campaignName on gate reads is silently ignored by the 2-param
// getRuntimeValue (useRuntimeState.js:63, family arity truth) — read censuses
// pin the EXACT source arity. No *Once chains, no mid-test re-harnesses
// (per-case fixture installs only), no save-listener strays possible here.
// No churn expected.
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

// getDistanceFeet dropped: nothing in this handler's import graph consumes it.
vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
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

// Canonical dice lane mock (fix#169 recipe): the bardic d8 rolls through
// diceRoller.rollDie, never raw Math.random.
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
const playerName = 'Bard';
const attackerName = 'Goblin';
const FROZEN_NOW = 1735689600000;
const BI_FACE = 4;
const HEAL_BASE_HP = 157;

function makePlayerStats() {
  return {
    name: playerName,
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 8 },
      ],
    },
    abilities: [
      { name: 'Wisdom', bonus: 2 },
      { name: 'Charisma', bonus: 4 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
  };
}

const AUTO = {
  type: 'reaction_debuff',
  range: '60_ft',
  effect: '',
  uses_expression: null,
  recharge: 'long_rest',
};

function makeAction() {
  return { name: 'Cutting Words', automation: AUTO };
}

// REAL infoPopup envelope (mirror mock purged family-wide): refusal envelopes
// have NO defenderHp key; handleAttackRollDebuff adds it via extraProps.
const popupFor = (description, defenderHp) =>
  defenderHp === undefined
    ? { type: 'popup', payload: { type: 'automation_info', name: 'Cutting Words', description, automation: AUTO } }
    : { ...popupFor(description), defenderHp };

// handleAttackRollDebuff header block: Attacker then the die line (no Defender
// line — that is the damage lane's shape, owned by .cuttingWords.test.js).
const ATTACK_HEADER =
  `<b>Cutting Words</b><br/>Attacker: ${attackerName}<br/>` +
  `Bardic Inspiration die: 1d8 = <b>${BI_FACE}</b><br/>`;

const NO_RECENT_ROLL =
  `No recent roll found for ${attackerName} (attack, damage, or ability check). ` +
  'Cutting Words must be used shortly after the roll.';
const NO_DEFENDER = `Could not determine who ${attackerName} damaged. Cannot apply Cutting Words.`;

// Attack-lane lastAttack result (isDamageLane false ⇒ totalDamage 0 +
// damageTypes []; MERGES the event/damage overrides).
function attackLaneResult(attackEvent, damage = {}) {
  return {
    attackEvent: { targetName: attackerName, timestamp: FROZEN_NOW, ...attackEvent },
    attackerName,
    targetName: attackerName,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
    ...damage,
  };
}

const EMPTY_RESULT = {
  attackEvent: null,
  attackerName: null,
  targetName: null,
  primaryDamage: 0,
  secondaryDamage: 0,
  totalDamage: 0,
  damageTypes: [],
};

describe('reactionDebuffHandler — default path: attack-roll content + gate refusals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // All lane defaults re-installed EVERY test (no impl residue).
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    rangeCheck.isWithinRange.mockResolvedValue(true);
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [] });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: attackerName } });
    targetResolver.resolveMapPositions.mockResolvedValue(null); // range-skip default
    damageRollback.findLastAttack.mockResolvedValue(EMPTY_RESULT);
    // ARG-DERIVED sync clamp (source seam is unawaited). Every kept leg here is
    // zero-heal; the clamp keeps that honest if a fixture ever drifts.
    applyHealing.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      newHp: HEAL_BASE_HP + amount,
      actualHeal: amount,
    }));
    // Seed pin (fix#169): BI face 4; rollD20 belongs to the disadvantage route.
    diceRoller.rollDie.mockReturnValue(BI_FACE);
    diceRoller.rollD20.mockReturnValue(10);
  });

  const CONTENT_CASES = [
    {
      title: 'still hits: canonical HIT ladder + "Attack still hits." prose, zero heal, null defenderHp',
      event: { d20: 20, bonus: 5, targetAc: 14, hit: true },
      description:
        ATTACK_HEADER +
        'Attack roll: d20(20) + 5 = 25 vs AC 14 → <b>HIT</b><br/>' +
        'Reduced: d20(16) + 5 = 21 vs AC 14 → <b>HIT</b><br/>' +
        '<br/><i>Attack still hits.</i>',
    },
    {
      title: 'caps reduced d20 at minimum of 1: max(1, 1−4) exact reduced line on an already-missed attack',
      event: { d20: 1, bonus: 5, targetAc: 20, hit: false },
      description:
        ATTACK_HEADER +
        'Attack roll: d20(1) + 5 = 6 vs AC 20 → <b>MISS</b><br/>' +
        'Reduced: d20(1) + 5 = 6 vs AC 20 → <b>MISS</b><br/>' +
        '<br/><i>The attack already missed — no effect.</i>',
    },
    {
      title: 'effectiveAc shadows a present targetAc: AC 20 ladder, zero-damage reversal-failure prose',
      // A targetAc fallback would print "vs AC 14" — the exact literal below
      // subsumes the old not.toContain('vs AC 14') negative.
      event: { d20: 14, bonus: 3, targetAc: 14, effectiveAc: 20, hit: true },
      description:
        ATTACK_HEADER +
        'Attack roll: d20(14) + 3 = 17 vs AC 20 → <b>HIT</b><br/>' +
        'Reduced: d20(10) + 3 = 13 vs AC 20 → <b>MISS</b><br/>' +
        '<br/><i>The attack now misses!</i><br/><i>No damage event found to reverse for Goblin.</i>',
    },
    {
      title: 'both ACs null: "AC —" dash on both lines, N/A reduced outcome, no outcome prose',
      event: { d20: 14, bonus: 3, targetAc: null, effectiveAc: null, hit: true },
      description:
        ATTACK_HEADER +
        'Attack roll: d20(14) + 3 = 17 vs AC \u2014 → <b>HIT</b><br/>' +
        'Reduced: d20(10) + 3 = 13 vs AC \u2014 → <b>N/A</b><br/>',
    },
  ];

  it.each(CONTENT_CASES)('$title', async (c) => {
    damageRollback.findLastAttack.mockResolvedValue(attackLaneResult(c.event));

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    // Full-shape popup via the REAL builder: envelope, automation echo, exact
    // description literal, defenderHp present-and-null on every applied leg.
    expect(result).toEqual(popupFor(c.description, null));

    // Canonical dice lane: exactly one d8 roll (level-3 class lookup), never
    // the second-d20 lane.
    expect(diceRoller.rollDie.mock.calls).toEqual([[8]]);
    expect(diceRoller.rollD20).not.toHaveBeenCalled();

    // Gate read + handleAttackRollDebuff dispatch read: exactly two, and the
    // zero-heal clamp seam is never touched on these fixtures.
    expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName], [campaignName]]);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
  });

  const BUDGET_READ = [playerName, 'bardicInspirationUses'];
  const REFUSAL_CASES = [
    {
      title: 'no_defender (CANONICAL): damage lane without event targetName refuses at the gate — exact string, reason token, dispatch never ran',
      result: {
        ...EMPTY_RESULT,
        attackEvent: { rawDamage: 5, timestamp: FROZEN_NOW },
        attackerName,
        targetName: null,
        primaryDamage: 5,
        totalDamage: 5,
        damageTypes: ['Fire'],
      },
      description: NO_DEFENDER,
      // Latch + marker reads happened (no_defender is gate #3) but the stamp
      // budget re-read did NOT — dispatch never began. 3rd campaignName is the
      // source's (ignored) arity at :611/:615.
      expectedReads: [
        BUDGET_READ,
        [playerName, '_Cutting_Words_usedRound', campaignName],
        [playerName, '_Cutting_Words_appliedAttack', campaignName],
      ],
      logRows: [[campaignName, {
        type: 'automation',
        characterName: playerName,
        automationType: 'cutting_words_refused',
        name: 'Cutting Words',
        description: NO_DEFENDER,
        reason: 'no_defender',
        timestamp: FROZEN_NOW,
      }]],
    },
    {
      title: 'attacker-name mismatch: :638 gate exits before the reaction gate — zero latch/marker reads, zero log',
      result: attackLaneResult(
        { d20: 15, bonus: 5, targetAc: 14, hit: true },
        { attackerName: 'Orc', totalDamage: 10, damageTypes: ['Piercing'] }
      ),
      description: NO_RECENT_ROLL,
      expectedReads: [BUDGET_READ],
      logRows: [],
    },
    {
      title: 'no last attack event at all: same exit, same exact string, zero log',
      result: EMPTY_RESULT,
      description: NO_RECENT_ROLL,
      expectedReads: [BUDGET_READ],
      logRows: [],
    },
  ];

  it.each(REFUSAL_CASES)('$title', async (c) => {
    damageRollback.findLastAttack.mockResolvedValue(c.result);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

    // Refusal envelope via the REAL builder: NO defenderHp key.
    expect(result).toEqual(popupFor(c.description));

    // Ordered EXACT-arity read census proves the gate ORDER: what the refusing
    // branch short-circuited before never got read.
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual(c.expectedReads);

    // Full-array log census (times(1) detector + zero-log contract for :638).
    expect(logService.addEntry.mock.calls).toEqual(c.logRows);

    // One findLastAttack read: the route never re-reads lastAttack, so the
    // executor (handleDamageDebuff/handleAttackRollDebuff) never ran.
    expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName]]);

    // Zero spend, zero stamp, zero heal, zero dice — nothing bought the refusal.
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(diceRoller.rollDie).not.toHaveBeenCalled();
  });
});
