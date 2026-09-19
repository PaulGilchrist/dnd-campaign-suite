// @improved-by-ai
// MA-0467 regression: Celestial Spirit (Defender) Healing Touch — self-initiated
// touch heal reaction (2024 PHB: reaction, touch, target regains 2d8+spell level).
// No attack-event gate (unlike parry/counterspell): GM-click fires the touch,
// gated by 1/round latch (_heal_usedRound) + At Will sentinel (usage:'At Will'
// + uses:999, MA-0341 byte-shape) + touch reach (isWithinRange 5 ft., gridless
// lenient) + a live wound on the target. Dice ride the summon fold
// ("spell level"→slotLevel, MA-0465 lineage); heal rides applyHealingToTarget.
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

function makeHealDeps({ round = 1, store = {}, target = { name: ALLY }, allyHp = 8, inRange = true, rollTotal = 13, healResult = { actualHeal: 13, oldHp: 8, newHp: 21, maxHp: 30 } } = {}) {
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
    rollExpression: vi.fn((formula) => ({ formula, total: rollTotal, rolls: [rollTotal - 5] })),
    applyHealingToTarget: vi.fn(() => healResult),
    getTarget: () => target,
  };
  return { state, logs, order, deps };
}

describe('MA-0467 Healing Touch registry + disk row shape', () => {
  it('monsters.json celestial-spirit-defender reactions[0] carries automation + At Will sentinel (MA-0341 byte-shape)', () => {
    expect(HEAL_ACTION.name).toBe('Healing Touch');
    expect(HEAL_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'touch', effect: 'heal' });
    expect(HEAL_ACTION.usage).toBe('At Will');
    expect(HEAL_ACTION.uses).toBe(999);
    expect(HEAL_ACTION.maxUses).toBe(999);
    expect(HEAL_ACTION.damage_dice_primary).toBe('2d8+spell level');
    expect(HEAL_ACTION.attack_bonus).toBeNull();
  });

  it('registry recognises the heal effect and ignores plain rows', () => {
    expect(getGatedMonsterReaction(HEAL_ACTION)?.effect).toBe('heal');
    expect(getGatedMonsterReaction({ name: 'Radiant Mace', description: 'Hit: 1d10+3+spell level radiant.' })).toBeNull();
  });
});

describe('MA-0467 healReactionDice — folded summon dice only', () => {
  it('prefers the folded combatant reaction row ("2d8+5")', () => {
    expect(healReactionDice({ action: HEAL_ACTION, combatant: foldedCombatant() })).toBe('2d8+5');
  });

  it('falls back to a numeric action row when the combatant carries none', () => {
    expect(healReactionDice({ action: { ...HEAL_ACTION, damage_dice_primary: '2d8+3' }, combatant: null })).toBe('2d8+3');
  });

  it('refuses the unfolded "spell level" token (EB-direct join, off-RAW route) — no mod-0 silent roll', () => {
    expect(healReactionDice({ action: HEAL_ACTION, combatant: foldedCombatant('2d8+spell level') })).toBeNull();
    expect(healReactionDice({ action: HEAL_ACTION, combatant: null })).toBeNull();
  });
});

describe('MA-0467 healGate RAW refusals', () => {
  const okState = { hp: 8, maxHp: 30 };

  it('accepts a wounded in-range target with folded dice', () => {
    const g = healGate({ monsterName: SPIRIT, targetName: ALLY, state: okState, formula: '2d8+5', inRange: true, currentRound: 3, usedRound: 0, storedUses: {}, action: HEAL_ACTION });
    expect(g.ok).toBe(true);
    expect(g.formula).toBe('2d8+5');
    expect(g.limit).toBe(999);
  });

  it('1/round latch: refuses a second press in the same round, re-arms next round', () => {
    const same = healGate({ monsterName: SPIRIT, targetName: ALLY, state: okState, formula: '2d8+5', inRange: true, currentRound: 3, usedRound: 3, storedUses: {}, action: HEAL_ACTION });
    expect(same.ok).toBe(false);
    expect(same.reason).toBe('round');
    expect(same.message).toMatch(/1\/round/);
    const next = healGate({ monsterName: SPIRIT, targetName: ALLY, state: okState, formula: '2d8+5', inRange: true, currentRound: 4, usedRound: 3, storedUses: {}, action: HEAL_ACTION });
    expect(next.ok).toBe(true);
  });

  it('refuses unfolded dice (dice), missing combatant (target), out of touch (range), full HP (full_hp) — nothing spent', () => {
    expect(healGate({ monsterName: SPIRIT, targetName: ALLY, state: okState, formula: null, inRange: true, currentRound: 1, usedRound: 0, storedUses: {}, action: HEAL_ACTION }).reason).toBe('dice');
    expect(healGate({ monsterName: SPIRIT, targetName: ALLY, state: null, formula: '2d8+5', inRange: true, currentRound: 1, usedRound: 0, storedUses: {}, action: HEAL_ACTION }).reason).toBe('target');
    expect(healGate({ monsterName: SPIRIT, targetName: ALLY, state: okState, formula: '2d8+5', inRange: false, currentRound: 1, usedRound: 0, storedUses: {}, action: HEAL_ACTION }).reason).toBe('range');
    const full = healGate({ monsterName: SPIRIT, targetName: ALLY, state: { hp: 30, maxHp: 30 }, formula: '2d8+5', inRange: true, currentRound: 1, usedRound: 0, storedUses: {}, action: HEAL_ACTION });
    expect(full.ok).toBe(false);
    expect(full.reason).toBe('full_hp');
  });
});

describe('MA-0467 resolveMonsterGatedReaction — Healing Touch', () => {
  it('success: rolls the folded 2d8+5, heals the target, logs ability_use + hp_change, stamps round latch BEFORE the heal write, spends the At Will heal counter', async () => {
    const { state, logs, order, deps } = makeHealDeps({ round: 2 });
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(deps.rollExpression).toHaveBeenCalledWith('2d8+5');
    expect(deps.applyHealingToTarget).toHaveBeenCalled();
    expect(result.healAmount).toBe(13);
    expect(result.targetName).toBe(ALLY);
    expect(state[`${SPIRIT}._heal_usedRound`]).toBe(2);
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ heal: 1 });
    expect(order.indexOf(`${SPIRIT}._heal_usedRound`)).toBeLessThan(order.length);
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Healing Touch');
    expect(spend.characterName).toBe(SPIRIT);
    expect(spend.description).toMatch(/2d8\+5 rolled 13/);
    expect(spend.description).toMatch(/8\/30 → 21\/30/);
    expect(spend.description).toMatch(/At Will/);
    const hp = logs.find(l => l.type === 'hp_change');
    expect(hp.targetName).toBe(ALLY);
    expect(hp.sourceName).toBe(SPIRIT);
    expect(hp.delta).toBe(13);
    expect(hp.isHealing).toBe(true);
    expect(result.popupHtml).toMatch(/regains <strong>13<\/strong> HP/);
  });

  it('self fallback: unarmed getTarget heals the spirit itself', async () => {
    const { deps, logs } = makeHealDeps({ target: null });
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

  it('same-round second press: heal_refused (round), zero heal, zero writes', async () => {
    const { state, logs, deps } = makeHealDeps({ round: 2, store: { [`${SPIRIT}._heal_usedRound`]: 2, [`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]: { heal: 1 } } });
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already used this round/);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('heal_refused');
    expect(deps.applyHealingToTarget).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ heal: 1 });
  });

  it('unfolded token refusal (dice): heal_refused, zero spend, honest message', async () => {
    const { logs, deps } = makeHealDeps();
    deps.getCombatContext = vi.fn(async () => csWith(1));
    const result = await resolveMonsterGatedReaction({
      action: HEAL_ACTION,
      monsterName: 'Celestial Spirit (Defender) 1',
      campaignName: CAMPAIGN,
      deps: { ...deps, getCombatContext: vi.fn(async () => ({ round: 1, creatures: [{ name: ALLY, type: 'player', currentHp: 8, maxHp: 30 }, { name: 'Celestial Spirit (Defender) 1', type: 'npc', currentHp: 20, maxHp: 26, reactions: [{ ...HEAL_ACTION }] }] })) },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/spell level/);
    expect(logs[0].automationType).toBe('heal_refused');
    expect(deps.applyHealingToTarget).not.toHaveBeenCalled();
  });

  it('full-HP refusal: nothing spent, heal_refused (full_hp)', async () => {
    const { state, logs, deps } = makeHealDeps({ allyHp: 30 });
    const result = await resolveMonsterGatedReaction({ action: HEAL_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('heal_refused');
    expect(logs[0].description).toMatch(/full hit points/);
    expect(state[`${SPIRIT}._heal_usedRound`]).toBeUndefined();
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });
});
