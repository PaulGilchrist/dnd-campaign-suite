// @maintained-by-ai
// MA-0467 heal-lane owner: Celestial Spirit (Defender) Healing Touch — self-initiated
// touch heal reaction (2024 PHB: reaction, touch, target regains 2d8+spell level).
// Owns: healReactionDice branch table, healGate RAW truth table (round/uses/dice/
// target/range/full_hp), and resolveMonsterHealReaction integration via
// resolveMonsterGatedReaction (latch-before-heal write order, exact refuse log,
// spend arithmetic — owned ONCE here on the success leg). No attack-event gate
// (unlike parry/counterspell): GM-click fires the touch, gated by the 1/round
// latch (_heal_usedRound, initiative seam — never a wall-clock timer) + At Will
// sentinel (MA-0341 byte-shape) + touch reach (isWithinRange 5 ft., gridless
// lenient §42) + a live wound on the target.
// Cited, NOT duplicated: disk row shape + "2d8+spell level" fold + attack_bonus
// null (summonSpiritHandler.test.js:815-832, consumer lane owns the summon fold);
// getGatedMonsterReaction(plainRow)→null one leg file-wide (gated-reaction.test.js:66,
// #417/#500); chip press + card rendering are component lane #417.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
  healReactionDice,
  healGate,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const HEAL_ACTION = monsters.find(m => m.index === 'celestial-spirit-defender').reactions[0];
const SPIRIT = 'Celestial Spirit (Defender)';
const CAMPAIGN = 'test-campaign';
const ALLY = 'Divine_Cleric';

function foldedCombatant(dice = '2d8+5') {
  return { name: SPIRIT, type: 'npc', currentHp: 20, maxHp: 26, reactions: [{ ...HEAL_ACTION, damage_dice_primary: dice }] };
}

function csWith(round = 1, allyHp = 8, allyMax = 30) {
  return {
    round,
    creatures: [
      { name: ALLY, type: 'player', currentHp: allyHp, maxHp: allyMax },
      foldedCombatant(),
    ],
  };
}

function makeHealDeps({ round = 1, store = {}, target = { name: ALLY }, allyHp = 8, inRange = true, rollTotal = 13, rollImpl = null, healResult = { actualHeal: 13, oldHp: 8, newHp: 21, maxHp: 30 } } = {}) {
  const state = { ...store };
  const logs = [];
  const order = [];
  const cs = csWith(round, allyHp);
  const deps = {
    findLastAttack: vi.fn(async () => null),
    getCombatContext: vi.fn(async () => cs),
    getRuntimeValue: vi.fn((key, prop) => {
      if (key === ALLY && prop === 'currentHitPoints') return allyHp;
      return state[`${key}.${prop}`] ?? null;
    }),
    setRuntimeValue: vi.fn(async (key, prop, value) => { order.push(`${key}.${prop}`); state[`${key}.${prop}`] = value; }),
    addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    isWithinRange: vi.fn(async () => inRange),
    rollExpression: vi.fn(rollImpl || ((formula) => ({ formula, total: rollTotal, rolls: [rollTotal - 5] }))),
    applyHealingToTarget: vi.fn(() => { order.push('applyHeal'); return healResult; }),
    getTarget: () => target,
  };
  return { state, logs, order, deps };
}

describe('MA-0467 healReactionDice — dice branch table, folded summon row wins', () => {
  it('registry arms the disk row; folded combatant > numeric action row > honest null (no mod-0 silent roll)', () => {
    expect(getGatedMonsterReaction(HEAL_ACTION)?.effect).toBe('heal');
    // folded wins even when the action row is also numeric
    expect(healReactionDice({ action: { ...HEAL_ACTION, damage_dice_primary: '2d8+3' }, combatant: foldedCombatant('2d8+5') })).toBe('2d8+5');
    // unfolded combatant row falls back to a numeric action row
    expect(healReactionDice({ action: { ...HEAL_ACTION, damage_dice_primary: '2d8+3' }, combatant: foldedCombatant('2d8+spell level') })).toBe('2d8+3');
    // EB-direct join, off-RAW route: nothing rollable anywhere — refuse (fold itself owned by summonSpiritHandler.test.js:815)
    expect(healReactionDice({ action: HEAL_ACTION, combatant: foldedCombatant('2d8+spell level') })).toBeNull();
  });
});

describe('MA-0467 healGate RAW truth table', () => {
  const base = { monsterName: SPIRIT, targetName: ALLY, formula: '2d8+5', inRange: true, action: HEAL_ACTION };
  const okState = { hp: 8, maxHp: 30 };

  it('ok legs: wounded At Will (limit 999), dying target healable (hp 0), latch re-arms next round', () => {
    const ok = healGate({ ...base, state: okState, currentRound: 3, usedRound: 0, storedUses: {} });
    expect(ok.ok).toBe(true);
    expect(ok.formula).toBe('2d8+5');
    expect(ok.limit).toBe(999);
    expect(healGate({ ...base, state: { hp: 0, maxHp: 30 }, currentRound: 3, usedRound: 0, storedUses: {} }).ok).toBe(true);
    expect(healGate({ ...base, state: okState, currentRound: 4, usedRound: 3, storedUses: { heal: 1 } }).ok).toBe(true);
  });

  it('refusal legs: round latch / uses exhausted / dice / target / range / full_hp', () => {
    const rows = [
      ['round: second press same round', { state: okState, currentRound: 3, usedRound: 3, storedUses: {} }, 'round'],
      ['uses: At Will cap exhausted on a fresh round', { state: okState, currentRound: 5, usedRound: 0, storedUses: { heal: 999 } }, 'uses'],
      ['dice: unfolded token, nothing rollable', { state: okState, formula: null, currentRound: 1, usedRound: 0, storedUses: {} }, 'dice'],
      ['target: not an active combatant', { state: null, currentRound: 1, usedRound: 0, storedUses: {} }, 'target'],
      ['range: out of touch (5 ft.)', { state: okState, inRange: false, currentRound: 1, usedRound: 0, storedUses: {} }, 'range'],
      ['full_hp: nothing to heal', { state: { hp: 30, maxHp: 30 }, currentRound: 1, usedRound: 0, storedUses: {} }, 'full_hp'],
    ];
    for (const [label, over, reason] of rows) {
      const g = healGate({ ...base, ...over });
      expect(g.ok, label).toBe(false);
      expect(g.reason, label).toBe(reason);
    }
    expect(healGate({ ...base, state: okState, currentRound: 3, usedRound: 3, storedUses: {} }).message)
      .toBe('Healing Touch: Reaction already used this round (1/round) — refused.');
  });
});

describe('MA-0467 resolveMonsterGatedReaction — Healing Touch', () => {
  it('success: rolls folded 2d8+5, stamps round latch BEFORE the heal write, spends the At Will counter, logs ability_use + hp_change', async () => {
    const { state, logs, order, deps } = makeHealDeps({ round: 2 });
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(deps.rollExpression).toHaveBeenCalledWith('2d8+5');
    expect(result.healAmount).toBe(13);
    expect(result.targetName).toBe(ALLY);
    expect(order.indexOf(`${SPIRIT}._heal_usedRound`)).toBeLessThan(order.indexOf('applyHeal'));
    expect(order.indexOf(`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`)).toBeLessThan(order.indexOf('applyHeal'));
    expect(state[`${SPIRIT}._heal_usedRound`]).toBe(2);
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ heal: 1 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.characterName).toBe(SPIRIT);
    expect(spend.description).toBe(`${SPIRIT} uses Healing Touch on ${ALLY} — 2d8+5 rolled 13. ${ALLY} 8/30 → 21/30. At Will — unlimited, 1 Reaction per round.`);
    const hp = logs.find(l => l.type === 'hp_change');
    expect(hp.targetName).toBe(ALLY);
    expect(hp.sourceName).toBe(SPIRIT);
    expect(hp.delta).toBe(13);
    expect(hp.isHealing).toBe(true);
    expect(result.popupHtml).toMatch(/regains <strong>13<\/strong> HP/);
  });

  it('self fallback: unarmed getTarget heals the spirit itself', async () => {
    const { logs, deps } = makeHealDeps({ target: null });
    deps.getCombatContext = vi.fn(async () => {
      const cs = csWith(1);
      cs.creatures[1].currentHp = 10;
      return cs;
    });
    deps.applyHealingToTarget = vi.fn(() => ({ actualHeal: 13, oldHp: 10, newHp: 23, maxHp: 26 }));
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.targetName).toBe(SPIRIT);
    expect(logs.find(l => l.type === 'hp_change').targetName).toBe(SPIRIT);
  });

  it('round-latch refusal: ONE exact heal_refused log, zero heal, zero writes', async () => {
    const { state, logs, deps } = makeHealDeps({ round: 2, store: { [`${SPIRIT}._heal_usedRound`]: 2, [`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]: { heal: 1 } } });
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('heal_refused');
    expect(logs[0].description).toBe(`Healing Touch refused (round): ${result.message}`);
    expect(deps.applyHealingToTarget).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ heal: 1 });
  });

  it('unresolved roll after gate ok (dice): heal_refused, nothing spent, latch never stamped', async () => {
    const { state, logs, deps } = makeHealDeps({ rollImpl: () => null });
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/did not resolve — nothing spent/);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('heal_refused');
    expect(logs[0].description).toMatch(/refused \(dice\)/);
    expect(deps.applyHealingToTarget).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${SPIRIT}._heal_usedRound`]).toBeUndefined();
  });
});
