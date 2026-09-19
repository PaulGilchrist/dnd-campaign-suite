// @improved-by-ai
// MA-0516 regression: Construct Spirit (Clay) Berserk Lashing — reactive
// attack reaction (2024 PHB: takes damage from a creature → Slam attack vs
// THAT creature, half-speed move alternative GM-advisory). Gate is the
// campaign lastAttack identity (MA-0329 hellish_rebuke probe lineage — any
// weapon OR spell damage arms). Response routes the folded Slam row from the
// summoned combatant's actions (MA-0465 caster-fold lineage) through the
// modal's existing attack-roll seam (deps.handleAttack). At Will sentinel
// (usage:'At Will'+uses:999, MA-0341 byte-shape) + 1/round latch
// (_attack_usedRound) + lastAttack.berserkLashingResolved event stamp.
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
  attackReactionIdentityRefusal,
  attackReactionGate,
  attackReactionSlamRow,
  attackReactionFoldCheck,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const LASH_ACTION = monsters.find(m => m.index === 'construct-spirit-clay').reactions[0];
const SPIRIT = 'Construct Spirit (Clay)';
const CAMPAIGN = 'test-campaign';
const BANDIT = 'Bandit';

function lastAttack(overrides = {}) {
  return {
    attackerName: BANDIT,
    targetName: SPIRIT,
    attackName: 'Scimitar',
    rollType: 'attack',
    weaponType: 'melee',
    hit: true,
    actualDamage: 7,
    ...overrides,
  };
}

function foldedCombatant() {
  return {
    name: SPIRIT,
    type: 'npc',
    currentHp: 38,
    maxHp: 45,
    actions: [
      { name: 'Slam', attack_bonus: 11, damage_dice_primary: '1d8+4+5', damage_type_primary: 'Bludgeoning', reach: '5 ft.' },
    ],
    reactions: [{ ...LASH_ACTION, damage_dice_primary: null }],
  };
}

function csWith(round = 1, extra = []) {
  return { round, creatures: [{ name: BANDIT, type: 'npc', currentHp: 11, maxHp: 11, ac: 12 }, foldedCombatant(), ...extra] };
}

function makeDeps({ round = 1, store = {}, last = lastAttack(), cs = csWith(round), armed = { name: BANDIT }, handleAttack = vi.fn() } = {}) {
  const state = { ...store };
  const logs = [];
  const order = [];
  const deps = {
    findLastAttack: vi.fn(async () => last),
    getCombatContext: vi.fn(async () => cs),
    getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? (key === 'campaign' && prop === 'lastAttack' ? last : null)),
    setRuntimeValue: vi.fn(async (key, prop, value) => { order.push(`${key}.${prop}`); state[`${key}.${prop}`] = value; }),
    addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    getTarget: () => armed,
    handleAttack,
  };
  return { state, logs, order, deps };
}

describe('MA-0516 Berserk Lashing registry + disk row shape', () => {
  it('monsters.json construct-spirit-clay reactions[0] carries automation + At Will sentinel (MA-0341 byte-shape)', () => {
    expect(LASH_ACTION.name).toBe('Berserk Lashing');
    expect(LASH_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'damage_taken', effect: 'attack', attack: 'Slam' });
    expect(LASH_ACTION.usage).toBe('At Will');
    expect(LASH_ACTION.uses).toBe(999);
    expect(LASH_ACTION.maxUses).toBe(999);
    expect(LASH_ACTION.reach).toBe('5 ft.');
    expect(LASH_ACTION.attack_bonus).toBeNull();
  });

  it('registry recognises the attack effect and ignores plain rows', () => {
    expect(getGatedMonsterReaction(LASH_ACTION)?.effect).toBe('attack');
    expect(getGatedMonsterReaction({ name: 'Slam', description: 'Melee Spell Attack.' })).toBeNull();
  });
});

describe('MA-0516 attackReactionIdentityRefusal — damaged-target identity gate', () => {
  it('arms on weapon damage dealt to the spirit by another creature', () => {
    expect(attackReactionIdentityRefusal(lastAttack(), SPIRIT)).toBeNull();
  });
  it('arms on spell-leg damage (primaryDamage, no actualDamage)', () => {
    expect(attackReactionIdentityRefusal(lastAttack({ actualDamage: undefined, primaryDamage: 9, rollType: 'spell-attack' }), SPIRIT)).toBeNull();
  });
  it('refuses: not the target / zero damage / already reacted / self-damage / no attacker', () => {
    expect(attackReactionIdentityRefusal(lastAttack({ targetName: 'ElderPaladin' }), SPIRIT)).toBe('trigger');
    expect(attackReactionIdentityRefusal(null, SPIRIT)).toBe('trigger');
    expect(attackReactionIdentityRefusal(lastAttack({ actualDamage: 0, primaryDamage: 0 }), SPIRIT)).toBe('damage');
    expect(attackReactionIdentityRefusal(lastAttack({ berserkLashingResolved: true }), SPIRIT)).toBe('reacted');
    expect(attackReactionIdentityRefusal(lastAttack({ attackerName: SPIRIT }), SPIRIT)).toBe('attacker');
    expect(attackReactionIdentityRefusal(lastAttack({ attackerName: null }), SPIRIT)).toBe('attacker');
  });
});

describe('MA-0516 attackReactionGate — round latch + At Will uses', () => {
  it('passes a fresh armed event', () => {
    const gate = attackReactionGate({ lastAttack: lastAttack(), monsterName: SPIRIT, currentRound: 2, storedUses: {}, usedRound: 0, action: LASH_ACTION });
    expect(gate.ok).toBe(true);
    expect(gate.attackerName).toBe(BANDIT);
  });
  it('1/round latch refuses a second click in the same round', () => {
    const gate = attackReactionGate({ lastAttack: lastAttack(), monsterName: SPIRIT, currentRound: 2, storedUses: {}, usedRound: 2, action: LASH_ACTION });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe('round');
  });
  it('At Will sentinel never exhausts (MA-0006/0341 honest unlimited)', () => {
    const gate = attackReactionGate({ lastAttack: lastAttack(), monsterName: SPIRIT, currentRound: 3, storedUses: { attack: 998 }, usedRound: 0, action: LASH_ACTION });
    expect(gate.ok).toBe(true);
  });
});

describe('MA-0516 attackReactionFoldCheck — folded summon rows only', () => {
  it('accepts the caster-folded Slam row (+11 / 1d8+4+5)', () => {
    const fold = attackReactionFoldCheck(attackReactionSlamRow({ action: LASH_ACTION, combatant: foldedCombatant() }));
    expect(fold).toEqual({ attackBonus: 11, formula: '1d8+4+5', damageType: 'Bludgeoning' });
  });
  it('refuses unfolded EB-direct rows (null bonus / token dice) — never a false +0 auto-hit (MA-0286 adjudication)', () => {
    expect(attackReactionFoldCheck(null).reason).toBe('fold');
    expect(attackReactionFoldCheck({ name: 'Slam', attack_bonus: null, damage_dice_primary: '1d8+4+spell level' }).reason).toBe('fold');
    expect(attackReactionFoldCheck({ name: 'Slam', attack_bonus: 11, damage_dice_primary: '1d8+4+spell level' }).reason).toBe('fold');
  });
});

describe('MA-0516 resolveMonsterGatedReaction — attack branch', () => {
  it('fires the folded Slam at the triggering attacker: latch+spend+stamp awaited BEFORE handleAttack, ability_use logged', async () => {
    const handleAttack = vi.fn();
    const { state, logs, order, deps } = makeDeps({ handleAttack });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(handleAttack).toHaveBeenCalledWith('Berserk Lashing (Slam)', 11, expect.objectContaining({ damage_dice_primary: '1d8+4+5', damage_type_primary: 'Bludgeoning' }));
    expect(order).toEqual([
      `${SPIRIT}._attack_usedRound`,
      `${SPIRIT}.${MONSTER_REACTION_USES_KEY}`,
      'campaign.lastAttack',
    ]);
    expect(state[`${SPIRIT}._attack_usedRound`]).toBe(1);
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ attack: 1 });
    expect(state['campaign.lastAttack'].berserkLashingResolved).toBe(true);
    expect(state['campaign.lastAttack'].lashedTarget).toBe(BANDIT);
    const spend = logs.find(e => e.type === 'ability_use');
    expect(spend.abilityName).toBe('Berserk Lashing');
    expect(spend.description).toContain(BANDIT);
    expect(spend.description).toContain('+11');
    expect(spend.description).toContain('1d8+4+5');
  });

  it('refuses with zero spend when no damage event arms (trigger) — berserk_lashing_refused logged', async () => {
    const handleAttack = vi.fn();
    const { state, logs, deps } = makeDeps({ handleAttack, last: lastAttack({ targetName: 'ElderPaladin' }) });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(handleAttack).not.toHaveBeenCalled();
    expect(logs[0].automationType).toBe('berserk_lashing_refused');
    expect(state[`campaign.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refuses honestly on the unfolded EB-direct row (no folded bonus) — nothing spent', async () => {
    const unfoldedCs = { round: 1, creatures: [{ name: BANDIT, type: 'npc', currentHp: 11, maxHp: 11, ac: 12 }, { ...foldedCombatant(), actions: [{ name: 'Slam', attack_bonus: null, damage_dice_primary: '1d8+4+spell level' }] }] };
    const handleAttack = vi.fn();
    const { state, logs, deps } = makeDeps({ handleAttack, cs: unfoldedCs });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/refused/i);
    expect(handleAttack).not.toHaveBeenCalled();
    expect(logs[0].automationType).toBe('berserk_lashing_refused');
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refuses when the armed target is not the triggering attacker — RAW targets THAT creature', async () => {
    const handleAttack = vi.fn();
    const { state, logs, deps } = makeDeps({ handleAttack, armed: { name: 'Knight' } });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(handleAttack).not.toHaveBeenCalled();
    expect(logs[0].description).toContain(BANDIT);
    expect(state[`${SPIRIT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('round latch refuses the second click in the same round (raw-unlimited next round)', async () => {
    const { deps } = makeDeps({ store: { [`${SPIRIT}._attack_usedRound`]: 1 } });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/round/i);
  });

  it('berserkLashingResolved event stamp refuses refire on the same damage event', async () => {
    const { deps } = makeDeps({ last: lastAttack({ berserkLashingResolved: true }) });
    const result = await resolveMonsterGatedReaction({ action: LASH_ACTION, monsterName: SPIRIT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/one lashing/i);
  });
});
