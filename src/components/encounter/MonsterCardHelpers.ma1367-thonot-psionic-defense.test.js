// MA-1367: Quaggoth Thonot Psionic Defense — FAIL(b) zero affordance fixed with
// the MA-1170 Shield byte-shape (mind-flayer-arcanist / noble-prodigy verbatim).
// RAW: reaction to a spell trigger → casts Feather Fall OR Shield; the Shield leg
// rides the LIVE gated shield channel (registry effect 'shield' arms the chip,
// shieldGate requires a pending spell-origin lastAttack targeting the Thonot);
// press stamps activeBuffs {effect:'shield',acBonus:5,oneShot:true} — +5 folds
// generically via getShieldAcBonus, consumed after one defended attack. The
// Feather Fall leg stays GM-adjudicated advisory (row description carries the
// OR clause; githzerai "Psionic Defense" precedent). At Will sentinel
// (usage:'At Will'+uses/maxUses:999, MA-1140 shape). Refusals log
// shield_refused, zero spend.
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

const THONOT_ACTION = monsters.find(m => m.index === 'quaggoth-thonot').reactions[0];
const ARC_SHIELD_ACTION = monsters.find(m => m.index === 'mind-flayer-arcanist').reactions[0];
const NP_SHIELD_ACTION = monsters.find(m => m.index === 'noble-prodigy').reactions[0];
const THONOT = 'Quaggoth Thonot 1';
const CASTER = 'Aberrant Sorcerer 1';
const CAMPAIGN = 'test-campaign';

function spellAttackOnThonot(overrides = {}) {
  return { attackerName: CASTER, targetName: THONOT, attackName: 'Fire Bolt', rollType: 'spell-attack', attackType: 'spell', hit: true, d20: 13, bonus: 6, total: 19, targetAc: 15, effectiveAc: 15, damageApplied: undefined, ...overrides };
}

function makeShieldDeps({ lastAttack = spellAttackOnThonot(), round = 1, store = {} } = {}) {
  const state = { ...store };
  const logs = [];
  const campaignWrites = [];
  return {
    state,
    logs,
    campaignWrites,
    deps: {
      findLastAttack: vi.fn(async () => lastAttack),
      getCombatContext: vi.fn(async () => ({ round, creatures: [{ name: THONOT, type: 'npc' }, { name: CASTER, type: 'npc' }] })),
      getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
      setRuntimeValue: vi.fn(async (key, prop, value) => {
        if (key === 'campaign' && prop === 'lastAttack') campaignWrites.push(value);
        state[`${key}.${prop}`] = value;
      }),
      addEntry: vi.fn(async (c, e) => { logs.push(e); }),
    },
  };
}

describe('MA-1367 Thonot Psionic Defense data-lock — MA-1170 shield byte-shape', () => {
  it('monsters.json quaggoth-thonot reactions[0] keeps name/trigger/description and carries the Arcanist automation block verbatim', () => {
    expect(THONOT_ACTION.name).toBe('Psionic Defense');
    expect(THONOT_ACTION.trigger).toBe('Trigger of a spell');
    expect(THONOT_ACTION.description).toMatch(/casts <strong>Feather Fall<\/strong> or <strong>Shield<\/strong> in response/);
    expect(THONOT_ACTION.automation).toEqual({ type: 'reaction', trigger: 'targeted_by_spell', effect: 'shield', acBonus: 5 });
    expect(THONOT_ACTION.automation).toEqual(ARC_SHIELD_ACTION.automation);
    expect(THONOT_ACTION.automation).toEqual(NP_SHIELD_ACTION.automation);
    expect(THONOT_ACTION.usage).toBe('At Will');
    expect(THONOT_ACTION.uses).toBe(999);
    expect(THONOT_ACTION.maxUses).toBe(999);
  });

  it('arms the same Shield chip def (zero affordance before the fix is gone)', () => {
    const def = getGatedMonsterReaction(THONOT_ACTION);
    expect(def).toMatchObject({ effect: 'shield', trigger: 'targeted_by_spell', label: 'Shield', icon: 'fa-shield' });
    expect(getGatedMonsterReaction({ name: 'Psionic Defense', description: 'prose only' })).toBeNull();
  });
});

describe('MA-1367 shieldGate — spell-origin lastAttack against the Thonot (AC 15 → 20)', () => {
  it('accepts a pending spell-origin attack targeting the Thonot', () => {
    const g = shieldGate({ lastAttack: spellAttackOnThonot(), monsterName: THONOT, currentRound: 1, storedUses: {}, usedRound: 0, action: THONOT_ACTION });
    expect(g.ok).toBe(true);
    expect(g.limit).toBe(999);
    expect(g.attackerName).toBe(CASTER);
    const saveLeg = shieldGate({ lastAttack: spellAttackOnThonot({ rollType: 'spell-save', attackType: undefined, saveType: 'WIS', saveDc: 12 }), monsterName: THONOT, currentRound: 1, storedUses: {}, usedRound: 0, action: THONOT_ACTION });
    expect(saveLeg.ok).toBe(true);
  });

  it('refuses trigger-unmet faces: no lastAttack, weapon-origin, wrong target, committed damage', () => {
    expect(shieldIdentityRefusal(null, THONOT)).toBe('trigger');
    expect(shieldIdentityRefusal(spellAttackOnThonot({ rollType: 'attack', attackType: undefined, weaponType: 'melee' }), THONOT)).toBe('spell');
    expect(shieldIdentityRefusal(spellAttackOnThonot({ targetName: 'Bandit 1' }), THONOT)).toBe('trigger');
    expect(shieldIdentityRefusal(spellAttackOnThonot({ damageApplied: true }), THONOT)).toBe('resolved');
    expect(shieldIdentityRefusal(spellAttackOnThonot({ shieldResolved: true }), THONOT)).toBe('reacted');
    expect(shieldIdentityRefusal(spellAttackOnThonot({ attackerName: THONOT }), THONOT)).toBe('attacker');
  });
});

describe('MA-1367 resolveMonsterGatedReaction — Thonot Psionic Defense (Shield leg)', () => {
  it('refusal w/o trigger: shield_refused logged, zero spend, zero writes', async () => {
    const { state, logs, deps } = makeShieldDeps({ lastAttack: null });
    const result = await resolveMonsterGatedReaction({ action: THONOT_ACTION, monsterName: THONOT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('shield_refused');
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(state[`${THONOT}.activeBuffs`]).toBeUndefined();
    expect(state[`${THONOT}.${MONSTER_REACTION_USES_KEY}`]).toBeUndefined();
  });

  it('success: one-shot shield buff acBonus 5, spends MONSTER_REACTION_USES 999→998, AC 15 → 20 logged', async () => {
    const { state, logs, campaignWrites, deps } = makeShieldDeps({ round: 2 });
    const result = await resolveMonsterGatedReaction({ action: THONOT_ACTION, monsterName: THONOT, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(result.acBonus).toBe(5);
    expect(result.newAc).toBe(20);
    expect(result.remaining).toBe(998);
    const buffs = state[`${THONOT}.activeBuffs`];
    expect(buffs.some(b => b.effect === 'shield' && b.acBonus === 5 && b.oneShot === true)).toBe(true);
    expect(state[`${THONOT}._shield_usedRound`]).toBe(2);
    expect(state[`${THONOT}.${MONSTER_REACTION_USES_KEY}`]).toEqual({ shield: 1 });
    expect(campaignWrites[0]).toMatchObject({ shieldResolved: true, shieldedBy: THONOT, shieldAcBonus: 5 });
    const spend = logs.find(l => l.type === 'ability_use');
    expect(spend.abilityName).toBe('Shield');
    expect(spend.description).toMatch(/AC 15 → 20/);
    expect(spend.description).toMatch(/At Will/);
  });
});
