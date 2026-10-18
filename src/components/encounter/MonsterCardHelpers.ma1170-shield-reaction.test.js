// @maintained-by-ai — trimmed to row-distinct legs: BY-name disk locks (#387),
// spell-origin identity table, press e2e + reason-coded refusals. Generic
// gate/latch/uses/fold/consume legs cite-skip owners (see header cites).
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
//
// Owner cite-skips (reaction-family canon — NOT re-pinned here):
// - isSpellOriginLastAttack seam + plain rows inert/plain-null once-only +
//   generic round-latch/uses-ceiling machinery: MonsterCardHelpers.gated-reaction.test.js
//   (:66 registry inert, :84 gate truth table, :185 spell-origin seam, :330 latch).
// - getShieldAcBonus +5 fold + own-stamp-only: useLoggedDiceRollUtils.core.test.js:148;
//   oneShot consume vs persistent PC Shield-spell buff: attackPostProcessing.ma1170-shield-consume.test.js.
// MA-1242 Noble Prodigy carries the Arcanist block VERBATIM — disk lock only
// (#387); its gate/press legs are byte-identical behavior, not re-run.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', async (importActual) => ({
  ...(await importActual()),
  getRuntimeValue: vi.fn(() => null),
}));

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

describe('MA-1170/MA-1242 Shield disk lock (#387 BY-name) + registry arming', () => {
  it('monsters.json mind-flayer-arcanist reactions[0] carries the automation + At Will sentinel and arms the Shield chip (MA-1140 shape, acBonus 5)', () => {
    expect(SHIELD_ACTION.name).toBe('Shield');
    expect(SHIELD_ACTION.automation).toEqual({ type: 'reaction', trigger: 'targeted_by_spell', effect: 'shield', acBonus: 5 });
    expect(SHIELD_ACTION.usage).toBe('At Will');
    expect(SHIELD_ACTION.uses).toBe(999);
    expect(SHIELD_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(SHIELD_ACTION)).toMatchObject({ effect: 'shield', trigger: 'targeted_by_spell', label: 'Shield', icon: 'fa-shield' });
  });

  it('monsters.json noble-prodigy reactions[0] keeps name/trigger/description + carries the Arcanist automation block verbatim (MA-1242)', () => {
    expect(NP_SHIELD_ACTION.name).toBe('Shield');
    expect(NP_SHIELD_ACTION.trigger).toBe('The noble is targeted by a spell');
    expect(NP_SHIELD_ACTION.description).toMatch(/The noble casts <strong>Shield<\/strong> in response/);
    expect(NP_SHIELD_ACTION.automation).toEqual({ type: 'reaction', trigger: 'targeted_by_spell', effect: 'shield', acBonus: 5 });
    expect(NP_SHIELD_ACTION.automation).toEqual(SHIELD_ACTION.automation);
    expect(NP_SHIELD_ACTION.usage).toBe('At Will');
    expect(NP_SHIELD_ACTION.uses).toBe(999);
    expect(NP_SHIELD_ACTION.maxUses).toBe(999);
    expect(getGatedMonsterReaction(NP_SHIELD_ACTION)?.effect).toBe('shield');
  });
});

describe('MA-1170 shieldIdentityRefusal/shieldGate — spell-origin trigger (distinct effect)', () => {
  it('refusal truth table + accepts spell-attack and spell-save faces against the arcanist', () => {
    const refusals = [
      ['no lastAttack → trigger', null, 'trigger'],
      ['wrong target → trigger', spellAttackOnArcanist({ targetName: 'Bandit Captain 1' }), 'trigger'],
      ['plain weapon attack → spell', spellAttackOnArcanist({ rollType: 'attack', attackType: undefined, weaponType: 'melee' }), 'spell'],
      ['damage committed → resolved', spellAttackOnArcanist({ damageApplied: true }), 'resolved'],
      ['already reacted → reacted', spellAttackOnArcanist({ shieldResolved: true }), 'reacted'],
      ['self-origin → attacker', spellAttackOnArcanist({ attackerName: ARCANIST }), 'attacker'],
      ['null attacker → attacker', spellAttackOnArcanist({ attackerName: null }), 'attacker'],
    ];
    for (const [label, lastAttack, reason] of refusals) {
      expect(shieldIdentityRefusal(lastAttack, ARCANIST), label).toBe(reason);
    }
    const g = shieldGate({ lastAttack: spellAttackOnArcanist({ rollType: 'attack', attackType: undefined, weaponType: 'melee' }), monsterName: ARCANIST, currentRound: 1, storedUses: {}, usedRound: 0, action: SHIELD_ACTION });
    expect(g.ok, 'weapon-origin gate refusal').toBe(false);
    expect(g.reason).toBe('spell');
    const ok = shieldGate({ lastAttack: spellAttackOnArcanist(), monsterName: ARCANIST, currentRound: 2, storedUses: {}, usedRound: 0, action: SHIELD_ACTION });
    expect(ok.ok).toBe(true);
    expect(ok.limit).toBe(999);
    expect(ok.attackerName).toBe(CASTER);
    const saveLeg = shieldGate({ lastAttack: spellAttackOnArcanist({ rollType: 'spell-save', attackType: undefined, saveType: 'DEX', saveDc: 15 }), monsterName: ARCANIST, currentRound: 2, storedUses: {}, usedRound: 0, action: SHIELD_ACTION });
    expect(saveLeg.ok, 'spell-save twin accepts').toBe(true);
  });
});

describe('MA-1170 resolveMonsterGatedReaction — Shield', () => {
  it('press e2e: merges one-shot shield buff acBonus 5 onto pending activeBuffs, spends MONSTER_REACTION_USES 999→998, latches round, stamps lastAttack, AC 16 → 21 logged', async () => {
    const { state, logs, campaignWrites, deps } = makeShieldDeps({
      round: 3,
      store: { [`${ARCANIST}.activeBuffs`]: [{ effect: 'haste', source: 'Other' }] },
    });
    const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(5);
    expect(result.newAc).toBe(21);
    expect(result.remaining).toBe(998);
    const buffs = state[`${ARCANIST}.activeBuffs`];
    expect(buffs).toHaveLength(2);
    expect(buffs[0].effect).toBe('haste');
    expect(buffs.some(b => b.effect === 'shield' && b.acBonus === 5 && b.oneShot === true)).toBe(true);
    expect(state[`${ARCANIST}._shield_usedRound`]).toBe(3);
    expect(state[`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ shield: 1 });
    expect(campaignWrites[0]).toMatchObject({ shieldResolved: true, shieldedBy: ARCANIST, shieldAcBonus: 5 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Shield');
    expect(spend.description).toMatch(/AC 16 → 21/);
    expect(spend.description).toMatch(/At Will/);
  });

  it('refusals log shield_refused with the gate reason, zero writes (trigger / spell / round / reacted)', async () => {
    const scenarios = [
      ['trigger', { lastAttack: null }, /trigger/],
      ['spell', { lastAttack: spellAttackOnArcanist({ rollType: 'attack', attackType: undefined, weaponType: 'ranged' }) }, /spell/],
      ['round', { lastAttack: spellAttackOnArcanist(), store: { [`${ARCANIST}._shield_usedRound`]: 3, [`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]: { shield: 1 } }, round: 3 }, /round/],
      ['reacted', { lastAttack: spellAttackOnArcanist({ shieldResolved: true, shieldedBy: ARCANIST }), store: { [`${ARCANIST}._shield_usedRound`]: 3, [`${ARCANIST}.${MONSTER_REACTION_USES_KEY}`]: { shield: 1 } }, round: 4 }, /reacted/],
    ];
    for (const [reason, opts, descRe] of scenarios) {
      const { logs, deps } = makeShieldDeps(opts);
      const result = await resolveMonsterGatedReaction({ action: SHIELD_ACTION, monsterName: ARCANIST, campaignName: CAMPAIGN, deps });
      expect(result.ok, reason).toBe(false);
      expect(logs, reason).toHaveLength(1);
      expect(logs[0].automationType, reason).toBe('shield_refused');
      expect(logs[0].description, reason).toMatch(descRe);
      expect(deps.setRuntimeValue, reason).not.toHaveBeenCalled();
    }
  });
});
