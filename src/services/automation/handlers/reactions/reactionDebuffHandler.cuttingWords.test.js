// @maintained-by-ai 2026-11-27 — CLA-071: Cutting Words — debuff CONTENT &
// WORDING lane (non-latch sibling).
//
// reactionDebuffHandler octet — lane: CUTTING WORDS content (default route →
// handleBardicRoll → handleAttackRollDebuff / handleDamageDebuff /
// appendAttackOutcomeLines / attackRollHtml; automation/index.js
// `reaction_debuff` → handle → DEFAULT_EFFECT_ROUTE). This file owns the
// popup composition as FULL-SHAPE toEqual literals: d20-hit→MISS display,
// hit-outcome prose branches ("now misses!" + healed line, "No damage event
// found to reverse", "already missed — no effect"), the primaryDamage-fallback
// heal leg (total 0 + primary 10 routes to the ATTACK lane because
// gateBardicReaction's isDamageLane watches damageTypes/totalDamage, not
// primary — the both-legs census of reverseHitDamage's `healAmount > 0`),
// damage-reduction wording incl. the max(0) floor and the null-heal-result
// shape (no "HP:" suffix), the 1d6 die-size pin (level-3 class_levels lookup),
// the bardic-uses exhaustion early exit (the only no-uses_expression budget
// channel in the octet — the uses_expression-channel refusal copy is
// .earlyExits.test.js), and the generic ability_use tail row (DEFAULT_EFFECT_
// ROUTE, tail:null — the only file pinning that seam, both alive and
// rejecting-log-channel legs).
//
// Seam map: .attacksVsAlly.test.js header carries the full octet map. Not
// restated here: "Attack still hits." + d20-floor-at-1 + AC-dash and the
// no-recent-roll/mismatch exits → defaultPath.test.js; shield/target/null-
// combat-context exits → earlyExits.test.js; latch/marker/identity + exact-
// arg rollback-heal + refusal-log censuses → cuttingWords.latch.test.js
// (post #1880 it owns ALL exact-arg applyHealingToTarget pins, so this file's
// former expect.anything() heal pin is dropped — an ARG-DERIVED sync clamp
// here proves amount correctness behaviorally instead: a wrong amount shifts
// the pinned prose/defenderHp literals); budget-stamp censuses → uses.test.js.
//
// Arity census (family rec #1877/#1880 twist): currentUsesFor (:416) reads
// getRuntimeValue with 2 args while the gate reads (:611/:615) pass a silently
// ignored 3rd campaignName; the uses-exhaustion leg pins its ordered exact
// 2-arg read array so a stray read or arity drift at THIS seam fails here —
// the gate-read censuses are latch-owned and not re-pinned.
//
// Deterministic: FROZEN Date.now in beforeEach (fixture timestamps + the tail
// row's timestamp pinned literal); vi.resetAllMocks + ALL lane defaults
// re-installed every test (bare vi.fn factories, no clearAllMocks residue, no
// factory-set impls); infoPopup is the REAL dependency-free builder (family-
// wide mirror-mock purge) so the envelope + automation echo stay honest;
// rollDie census [[6]] + rollD20-never (the second-d20 lane is disadvantage-
// route owned); ordered findLastAttack double-read census on every applied
// leg; full-array addEntry tail census doubles as the times(1) detector.
// No *Once chains, no mid-test re-harnesses (per-case rig installs only).
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

// Canonical dice lane mock (fix#169 recipe): the bardic d6 rolls through
// diceRoller.rollDie, never raw Math.random — content literals are exact
// seed pins on face 4.
vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollDie: vi.fn(),
}));

import * as targetResolver from '../../common/targetResolver.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as applyHealing from '../../../rules/combat/applyHealing.js';
import * as logService from '../../../ui/logService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

const campaignName = 'test-campaign';
const mapName = 'TestMap';
const playerName = 'CuttingWordsBard';
const attackerName = 'Bandit';
const defenderName = 'Goblin';
const FROZEN_NOW = 1735689600000;
const BI_FACE = 4;
const HEAL_BASE_HP = 157;

function makeBardStats() {
  return {
    name: playerName,
    proficiency: 2,
    level: 3,
    class: {
      name: 'Bard',
      class_levels: [
        { level: 1, bardic_die: 6 },
        { level: 2, bardic_die: 6 },
        { level: 3, bardic_die: 6 },
      ],
    },
    abilities: [
      { name: 'Charisma', bonus: 4 },
      { name: 'Intelligence', bonus: 1 },
    ],
    characterAdvancement: [],
    _trackedResources: {
      bardicInspirationUses: { current: 4, max: 4 },
    },
  };
}

const AUTO = {
  type: 'reaction_debuff',
  trigger: 'damage_ability_check_or_attack_roll_within_60ft',
  debuffExpression: 'bardic_inspiration_die',
  subtractive: true,
  range: '60 ft',
  casting_time: '1 reaction',
};

function makeCuttingWordsAction() {
  return { name: 'Cutting Words', automation: AUTO };
}

// REAL infoPopup envelope builder (mirror mock purged family-wide): refusal
// envelopes have NO defenderHp key; applied lanes add it via extraProps.
const popupFor = (description, defenderHp) =>
  defenderHp === undefined
    ? { type: 'popup', payload: { type: 'automation_info', name: 'Cutting Words', description, automation: AUTO } }
    : { ...popupFor(description), defenderHp };

// Generic DEFAULT_EFFECT_ROUTE tail row (handle()'s addEntry, :783) under the
// frozen clock — description mirrors the popup literal, targetName is the
// applied() attacker.
const tailRow = (description) => ({
  type: 'ability_use',
  characterName: playerName,
  abilityName: 'Cutting Words',
  description,
  targetName: attackerName,
  timestamp: FROZEN_NOW,
});

const BI_HEADER =
  `<b>Cutting Words</b><br/>Attacker: ${attackerName}<br/>` +
  `Bardic Inspiration die: 1d6 = <b>${BI_FACE}</b><br/>`;

// handleDamageDebuff inserts a Defender line between Attacker and the die line.
const DAMAGE_HEADER =
  `<b>Cutting Words</b><br/>Attacker: ${attackerName}<br/>Defender: ${defenderName}<br/>` +
  `Bardic Inspiration die: 1d6 = <b>${BI_FACE}</b><br/>`;

function attackLaneResult(attackEvent, damage) {
  return {
    attackEvent: { targetName: defenderName, timestamp: FROZEN_NOW, ...attackEvent },
    attackerName,
    targetName: defenderName,
    primaryDamage: 0,
    secondaryDamage: 0,
    totalDamage: 0,
    damageTypes: [],
    ...damage,
  };
}

function damageLaneResult(rawDamage) {
  return {
    attackEvent: { rawDamage, targetName: defenderName, timestamp: FROZEN_NOW },
    attackerName,
    targetName: defenderName,
    primaryDamage: rawDamage,
    secondaryDamage: 0,
    totalDamage: rawDamage,
    damageTypes: ['Fire'],
  };
}

describe('CLA-071: Cutting Words — content & wording (non-latch lane)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);

    // All lane defaults re-installed EVERY test (no impl residue).
    useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    useRuntimeState.setRuntimeObject.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    damageUtils.getCombatContext.mockResolvedValue({ round: 1, creatures: [{ name: defenderName, hp: 15 }] });
    targetResolver.resolveTarget.mockResolvedValue({ target: { name: attackerName } });
    targetResolver.resolveMapPositions.mockResolvedValue(null); // range-skip default
    // NOTE: isWithinRange is never reached on this lane — positions-null
    // short-circuits bardicRangeRefusal before it (latch owns that gate leg).
    damageRollback.findLastAttack.mockResolvedValue({
      attackEvent: null,
      attackerName: null,
      targetName: null,
      primaryDamage: 0,
      secondaryDamage: 0,
      totalDamage: 0,
      damageTypes: [],
    });
    // ARG-DERIVED sync clamp (source seam is unawaited): a wrong heal amount
    // surfaces in the pinned prose/defenderHp literals instead of hiding
    // behind a hardcoded return that happens to match the fixture. Exact-arg
    // pins live in the latch lane (#1880 handoff).
    applyHealing.applyHealingToTarget.mockImplementation((cs, name, amount) => ({
      newHp: HEAL_BASE_HP + amount,
      actualHeal: amount,
    }));
    // Seed pin (fix#169): BI face 4; rollD20 belongs to other routes' lanes.
    diceRoller.rollDie.mockReturnValue(BI_FACE);
    diceRoller.rollD20.mockReturnValue(10);
  });

  const CONTENT_CASES = [
    {
      title: 'hit→MISS with zero damage: reversal-failure prose, no heal call, defenderHp null',
      attack: attackLaneResult(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, primaryDamage: 0 }
      ),
      description:
        BI_HEADER +
        'Attack roll: d20(14) + 3 = 17 vs AC 17 → <b>HIT</b><br/>' +
        'Reduced: d20(10) + 3 = 13 vs AC 17 → <b>MISS</b><br/>' +
        '<br/><i>The attack now misses!</i><br/><i>No damage event found to reverse for Goblin.</i>',
      defenderHp: null,
      heals: 0,
    },
    {
      title: 'hit→MISS with primaryDamage-only event: heals via the fallback leg and surfaces newHp',
      attack: attackLaneResult(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, primaryDamage: 10 }
      ),
      description:
        BI_HEADER +
        'Attack roll: d20(14) + 3 = 17 vs AC 17 → <b>HIT</b><br/>' +
        'Reduced: d20(10) + 3 = 13 vs AC 17 → <b>MISS</b><br/>' +
        '<br/><i>The attack now misses!</i><br/>Goblin healed for 10 HP.',
      defenderHp: HEAL_BASE_HP + 10,
      heals: 1,
    },
    {
      title: 'already-missed attack: MISS ladder + no-effect prose, no heal, no reversal line',
      attack: attackLaneResult(
        { d20: 8, bonus: 2, targetAc: 15, hit: false },
        { totalDamage: 0, primaryDamage: 0 }
      ),
      description:
        BI_HEADER +
        'Attack roll: d20(8) + 2 = 10 vs AC 15 → <b>MISS</b><br/>' +
        'Reduced: d20(4) + 2 = 6 vs AC 15 → <b>MISS</b><br/>' +
        '<br/><i>The attack already missed — no effect.</i>',
      defenderHp: null,
      heals: 0,
    },
    {
      title: 'damage lane 15−4: reduction wording, clamp-healed 4 HP, HP-suffix + defenderHp surfaced',
      attack: damageLaneResult(15),
      description:
        DAMAGE_HEADER +
        'Original damage: 15<br/>Reduced damage: <b>11</b><br/>Healed Goblin for 4 HP.<br/>Goblin HP: ' +
        (HEAL_BASE_HP + 4),
      defenderHp: HEAL_BASE_HP + 4,
      heals: 1,
    },
    {
      title: 'damage lane 1−4: max(0) floor, heal returns null → no HP-suffix line, defenderHp null',
      attack: damageLaneResult(1),
      nullHeal: true,
      description:
        DAMAGE_HEADER +
        'Original damage: 1<br/>Reduced damage: <b>0</b><br/>Healed Goblin for 1 HP.',
      defenderHp: null,
      heals: 1,
    },
    {
      title: 'applied response survives a rejected generic-tail log write',
      attack: attackLaneResult(
        { d20: 14, bonus: 3, targetAc: 17, hit: true },
        { totalDamage: 0, primaryDamage: 0 }
      ),
      rejectLog: true,
      description:
        BI_HEADER +
        'Attack roll: d20(14) + 3 = 17 vs AC 17 → <b>HIT</b><br/>' +
        'Reduced: d20(10) + 3 = 13 vs AC 17 → <b>MISS</b><br/>' +
        '<br/><i>The attack now misses!</i><br/><i>No damage event found to reverse for Goblin.</i>',
      defenderHp: null,
      heals: 0,
    },
  ];

  it.each(CONTENT_CASES)('$title', async (c) => {
    damageRollback.findLastAttack.mockResolvedValue(c.attack);
    if (c.nullHeal) applyHealing.applyHealingToTarget.mockReturnValue(null);
    if (c.rejectLog) {
      logService.addEntry.mockImplementation(() => Promise.reject(new Error('log offline')));
    }

    const result = await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

    // Full-shape popup via the REAL builder: envelope, automation echo, exact
    // description literal, and the presence/value of the defenderHp key.
    expect(result).toEqual(popupFor(c.description, c.defenderHp));

    // Canonical dice lane: exactly one d6 roll for the level-3 die size,
    // never the second-d20 lane.
    expect(diceRoller.rollDie.mock.calls).toEqual([[6]]);
    expect(diceRoller.rollD20).not.toHaveBeenCalled();

    // Gate + dispatch each read the last attack once (two-call census).
    expect(damageRollback.findLastAttack.mock.calls).toEqual([[campaignName], [campaignName]]);

    // Heal census: clamp makes the pinned prose/defenderHp literals prove the
    // amount; this proves the count (zero-heal legs never touch the seam).
    expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(c.heals);

    // Generic ability_use tail: full-array census = times(1) detector; the
    // description mirrors the popup literal; survives the rejecting leg.
    expect(logService.addEntry.mock.calls).toEqual([[campaignName, tailRow(c.description)]]);
  });

  it('bardic budget exhausted: front-door refusal with Long-Rest copy, one 2-arg read, zero dispatch', async () => {
    // Only octet path exercising the no-uses_expression bardicUsesMax budget
    // (uses.test.js covers the stamp-side channels on a fresh budget). Stored
    // current 0 ⇒ handle() returns BEFORE getCombatContext/dispatch.
    useRuntimeState.getRuntimeValue.mockReturnValue(0);

    const result = await handle(makeCuttingWordsAction(), makeBardStats(), campaignName, mapName);

    expect(result).toEqual(popupFor('Cutting Words has no uses remaining. Recharges on a Long Rest.'));
    // Ordered EXACT-arity read census (:416 passes 2 args): the single budget
    // read is all that ran — no gate reads, no re-reads.
    expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([[playerName, 'bardicInspirationUses']]);
    // Guard-ORDER zero-run pins: nothing downstream of the front door fired.
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(targetResolver.resolveTarget).not.toHaveBeenCalled();
    expect(damageRollback.findLastAttack).not.toHaveBeenCalled();
    expect(diceRoller.rollDie).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([]);
    expect(useRuntimeState.setRuntimeObject.mock.calls).toEqual([]);
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
