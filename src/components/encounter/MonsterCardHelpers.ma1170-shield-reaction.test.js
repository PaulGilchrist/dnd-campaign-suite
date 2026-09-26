// MA-1170: Mind Flayer Arcanist Shield — inert prose reaction fixed with the
// MA-1140 data shape + NEW shield consumer (registry effect + resolver branch).
// RAW (2024 Monster Core): reaction when targeted by a spell → casts Shield,
// +5 AC against the triggering attack roll (AC 16 → 21). Gate keys off the RAW
// campaign lastAttack spell-origin (isSpellOriginLastAttack MA-0013 seam), this
// monster as target, damage not yet committed (MA-0548 pending window); press
// stamps activeBuffs {effect:'shield',acBonus:5,oneShot:true} onto the existing
// generic +5 fold channel (getShieldAcBonus — zero new AC math), spends
// MONSTER_REACTION_USES[shield] (At Will 999 honest counter), 1/round latch
// (_shield_usedRound). Refusals log shield_refused, zero spend.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', async (importActual) => ({
  ...(await importActual()),
  getRuntimeValue: vi.fn(() => null),
}));

import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getShieldAcBonus } from '../../hooks/combat/loggedDiceRollUtils.js';
import {
  getGatedMonsterReaction,
  shieldIdentityRefusal,
  shieldGate,
  resolveMonsterGatedReaction,
  MONSTER_REACTION_USES_KEY,
} from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const SHIELD_ACTION = monsters.find(m => m.index === 'mind-flayer-arcanist').reactions[0];
// MA-1242: Noble Prodigy Shield — prose-only row fixed with the Arcanist block verbatim.
const NP_SHIELD_ACTION = monsters.find(m => m.index === 'noble-prodigy').reactions[0];
const NOBLE_PRODIGY = 'Noble Prodigy 1';
const ARCANIST = 'Mind Flayer Arcanist 1';
const CASTER = 'Bandit 1';
const CAMPAIGN = 'test-campaign';

function spellAttackOnArcanist(overrides = {}) {
  return { attackerName: CASTER, targetName: ARCANIST, attackName: 'Fire Bolt', rollType: 'spell-attack', attackType: 'spell', hit: true, d20: 13, bonus: 6, total: 19, targetAc: 16, effectiveAc: 16, damageApplied: undefined, ...overrides };
}

function makeShieldDeps({ lastAttack = spellAttackOnArcanist(), round = 1, store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  return {
    state,
    logs,
    campaignWrites,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round, creatures: [{ name: ARCANIST, type: 'npc' }, { name: CASTER, type: 'npc' }] })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
    },
  };
}

describe('MA-1170 Shield data-lock + registry shape', () => {
  it('monsters.json mind-flayer-arcanist reactions[0] carries the automation + At Will sentinel (MA-1140 shape, acBonus 5)', () => {
    expect(SHIELD_ACTION.name).toBe('Shield');
    expect(SHIELD_ACTION.automation).toEqual({ type: 'reaction', trigger: 'targeted_by_spell', effect: 'shield', acBonus: 5 });
    expect(SHIELD_ACTION.usage).toBe('At Will');
    expect(SHIELD_ACTION.uses).toBe(999);
    expect(SHIELD_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(SHIELD_ACTION)?.effect).toBe('shield');
  });

  it('GATED_MONSTER_REACTIONS.shield def carries label/icon and arms the chip; prose rows stay inert', () => {
    const def = getGatedMonsterReaction(SHIELD_ACTION);
    expect(def).toMatchObject({ effect: 'shield', trigger: 'targeted_by_spell', label: 'Shield', icon: 'fa-shield' });
    expect(getGatedMonsterReaction({ name: 'Tentacle Attack', description: 'Hit: 2d6+6 bludgeoning.' })).toBeNull();
    expect(getGatedMonsterReaction({ name: 'Shield', description: 'prose only' })).toBeNull();
  });
});

describe('MA-1242 Noble Prodigy Shield — data-lock + arms (Arcanist block verbatim)', () => {
  it('monsters.json noble-prodigy reactions[0] keeps name/trigger/description + carries the Arcanist automation block verbatim', () => {
    expect(NP_SHIELD_ACTION.name).toBe('Shield');
    expect(NP_SHIELD_ACTION.trigger).toBe('The noble is targeted by a spell');
    expect(NP_SHIELD_ACTION.description).toMatch(/The noble casts <strong>Shield<\/strong> in response/);
    expect(NP_SHIELD_ACTION.automation).toEqual({ type: 'reaction', trigger: 'targeted_by_spell', effect: 'shield', acBonus: 5 });
    expect(NP_SHIELD_ACTION.automation).toEqual(SHIELD_ACTION.automation);
    expect(NP_SHIELD_ACTION.usage).toBe('At Will');
    expect(NP_SHIELD_ACTION.uses).toBe(999);
    expect(NP_SHIELD_ACTION.maxUses).toBe(999);
  });

  it('arms the same Shield chip def + gate accepts a pending spell-origin attack on the noble (NP AC 16 → 21)', () => {
    const def = getGatedMonsterReaction(NP_SHIELD_ACTION);
    expect(def).toMatchObject({ effect: 'shield', trigger: 'targeted_by_spell', label: 'Shield', icon: 'fa-shield' });
    const g = shieldGate({
      lastAttack: { attackerName: CASTER, targetName: NOBLE_PRODIGY, attackName: 'Fire Bolt', rollType: 'spell-attack', attackType: 'spell', hit: true, d20: 13, bonus: 6, total: 19, targetAc: 16, effectiveAc: 16 },
      monsterName: NOBLE_PRODIGY, currentRound: 1, storedUses: {}, usedRound: 0, action: NP_SHIELD_ACTION,
    });
    expect(g.ok).toBe(true);
    expect(g.limit).toBe(999);
  });

  it('resolves: one-shot shield buff acBonus 5 on the noble, spends MONSTER_REACTION_USES 999→998', async () => {
    const lastAttack = { attackerName: CASTER, targetName: NOBLE_PRODIGY, attackName: 'Fire Bolt', rollType: 'spell-attack', attackType: 'spell', hit: true, d20: 13, bonus: 6, total: 19, targetAc: 16, effectiveAc: 16 };
    const { state, campaignWrites, deps } = makeShieldDeps({ round: 2, lastAttack });
    const result = await resolveMonsterGatedReaction({ action: NP_SHIELD_ACTION, monsterName: NOBLE_PRODIGY, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(5);
    expect(result.newAc).toBe(21);
    expect(result.remaining).toBe(998);
    const buffs = state[`${NOBLE_PRODIGY}.activeBuffs`];
    expect(buffs.some(b => b.effect === 'shield' && b.acBonus === 5 && b.oneShot === true)).toBe(true);
    expect(state[`${NOBLE_PRODIGY}._shield_usedRound`]).toBe(2);
    expect(state[`${NOBLE_PRODIGY}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ shield: 1 });
    expect(campaignWrites[0]).toMatchObject({ shieldResolved: true, shieldedBy: NOBLE_PRODIGY, shieldAcBonus: 5 });
  });
});

describe('MA-1170 shieldGate spell-origin identity refusals', () => {
  it('refuses no lastAttack (trigger) and plain weapon attacks (spell)', () => {
    expect(shieldIdentityRefusal(null, ARCANIST)).toBe('trigger');
    expect(shieldIdentityRefusal(spellAttackOnArcanist({ rollType: 'attack', attackType: undefined, weaponType: 'melee' }), ARCANIST)).toBe('spell');
    const g = shieldGate({ lastAttack: spellAttackOnArcanist({ rollType: 'attack', attackType: undefined }), monsterName: ARCANIST, currentRound: 1, storedUses: {}, usedRound: 0, action: SHIELD_ACTION });
    expect(g.ok).toBe(false);
    expect(g.reason).toBe('spell');
  });

  it('refuses wrong target, committed damage, already-reacted, and self-origin', () => {
    expect(shieldIdentityRefusal(spellAttackOnArcanist({ targetName: 'Bandit Captain 1' }), ARCANIST)).toBe('trigger');
    expect(shieldIdentityRefusal(spellAttackOnArcanist({ damageApplied: true }), ARCANIST)).toBe('resolved');
    expect(shieldIdentityRefusal(spellAttackOnArcanist({ shieldResolved: true }), ARCANIST)).toBe('reacted');
    expect(shieldIdentityRefusal(spellAttackOnArcanist({ attackerName: ARCANIST }), ARCANIST)).toBe('attacker');
    expect(shieldIdentityRefusal(spellAttackOnArcanist({ attackerName: null }), ARCANIST)).toBe('attacker');
  });

  it('accepts a pending spell-origin attack against the arcanist (save-save and spell-attack twins)', () => {
    const g = shieldGate({ lastAttack: spellAttackOnArcanist(), monsterName: ARCANIST, currentRound: 2, storedUses: {}, usedRound: 0, action: SHIELD_ACTION });
    expect(g.ok).toBe(true);
    expect(g.limit).toBe(999);
    expect(g.attackerName).toBe(CASTER);
    const saveLeg = shieldGate({ lastAttack: spellAttackOnArcanist({ rollType: 'spell-save', attackType: undefined, saveType: 'DEX', saveDc: 15 }), monsterName: ARCANIST, currentRound: 2, storedUses: {}, usedRound: 0, action: SHIELD_ACTION });
    expect(saveLeg.ok).toBe(true);
  });

  it('1/round latch + uses ceiling', () => {
    const same = shieldGate({ lastAttack: spellAttackOnArcanist(), monsterName: ARCANIST, currentRound: 4, storedUses: {}, usedRound: 4, action: SHIELD_ACTION });
    expect(same.ok).toBe(false);
    expect(same.reason).toBe('round');
    const next = shieldGate({ lastAttack: spellAttackOnArcanist(), monsterName: ARCANIST, currentRound: 5, storedUses: {}, usedRound: 4, action: SHIELD_ACTION });
    expect(next.ok).toBe(true);
    const spent = shieldGate({ lastAttack: spellAttackOnArcanist(), monsterName: ARCANIST, currentRound: 5, storedUses: { shield: 999 }, usedRound: 4, action: SHIELD_ACTION });
    expect(spent.ok).toBe(false);
    expect(spent.reason).toBe('uses');
  });
});

describe('MA-1170 resolveMonsterGatedReaction — Shield', () => {
  it('refusal (no pending lastAttack): shield_refused logged, zero writes', async () => {
    const { state, logs, deps } = makeShieldDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('shield_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${ARCANIST}.activeBuffs`]).toBeUndefined();
    expect(state[`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('refusal (weapon-origin lastAttack): shield_refused (spell), zero writes', async () => {
    const { logs, deps } = makeShieldDeps({ lastAttack: spellAttackOnArcanist({ rollType: 'attack', attackType: undefined, weaponType: 'ranged' }) });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('shield_refused');
    expect(logs[0].description).toMatch(/spell/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('success: stamps activeBuffs {effect:shield,acBonus:5,oneShot:true}, spends MONSTER_REACTION_USES, latches round, stamps lastAttack, AC 16 → 21 logged', async () => {
    const { state, logs, campaignWrites, deps } = makeShieldDeps({ round: 3 });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(5);
    expect(result.newAc).toBe(21);
    expect(result.remaining).toBe(998);
    const buffs = state[`${ARCANIST}.activeBuffs`];
    expect(Array.isArray(buffs)).toBe(true);
    expect(buffs.some(b => b.effect === 'shield' && b.acBonus === 5 && b.oneShot === true)).toBe(true);
    expect(state[`${ARCANIST}._shield_usedRound`]).toBe(3);
    expect(state[`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ shield: 1 });
    expect(campaignWrites[0]).toMatchObject({ shieldResolved: true, shieldedBy: ARCANIST, shieldAcBonus: 5 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Shield');
    expect(spend.description).toMatch(/AC 16 → 21/);
    expect(spend.description).toMatch(/At Will/);
  });

  it('preserves pre-existing activeBuffs (merged read-modify-write, one key)', async () => {
    const { state, deps } = makeShieldDeps({ round: 2, store: { [`${ARCANIST}.activeBuffs`]: [{ effect: 'haste', source: 'Other' }] } });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    const buffs = state[`${ARCANIST}.activeBuffs`];
    expect(buffs).toHaveLength(2);
    expect(buffs[0].effect).toBe('haste');
    expect(buffs[1].effect).toBe('shield');
  });

  it('same-round second press on the same spell: shield_refused (round), zero additional writes', async () => {
    const { logs, deps } = makeShieldDeps({
      round: 3,
      lastAttack: spellAttackOnArcanist({ shieldResolved: true, shieldedBy: ARCANIST }),
      store: { [`${ARCANIST}._shield_usedRound`]: 3, [`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]: { shield: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('shield_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('fresh round, already-reacted spell: shield_refused (reacted) — one shield per triggering spell', async () => {
    const { logs, deps } = makeShieldDeps({
      round: 4,
      lastAttack: spellAttackOnArcanist({ shieldResolved: true, shieldedBy: ARCANIST }),
      store: { [`${ARCANIST}._shield_usedRound`]: 3, [`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]: { shield: 1 } },
    });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('shield_refused');
    expect(logs[0].description).toMatch(/reacted/);
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('MA-1170 existing +5 AC fold channel (zero new AC math)', () => {
  it('getShieldAcBonus folds +5 for the armed monster stamp and 0 without it', () => {
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === ARCANIST && prop === 'activeBuffs') return [{ effect: 'shield', acBonus: 5, oneShot: true, source: 'Shield' }];
      return null;
    });
    expect(getShieldAcBonus(ARCANIST, CAMPAIGN)).toBe(5);
    getRuntimeValue.mockImplementation(() => null);
    expect(getShieldAcBonus(ARCANIST, CAMPAIGN)).toBe(0);
  });
});
