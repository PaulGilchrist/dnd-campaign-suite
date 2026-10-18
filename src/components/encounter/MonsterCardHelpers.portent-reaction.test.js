// @maintained-by-ai
// MA-0544 regression: Cyclops Oracle Portent — d20-replacement pool reaction
// (advisory-pool floor, CLA-325). GM-click arms the pool roll: resolver rolls
// 1d20, stores the value on the monster's `portentRolls` runtime pool, logs
// ability_use with the honest GM-advisory note, and spends the authored
// recharge "4-6" via spendMonsterRecharge (MA-0031 economy). The spent stamp
// IS the regain registration — rollMonsterRecharges (turnStartEffects seam,
// d6 4+) re-arms. Replacement-application stays GM-enforced (no
// d20-replacement consumer app-wide).
// Distinct legs only — generic faces cite-skip to owners:
// - registry arming + plain-row inertness, gate/latch/uses tables →
//   MonsterCardHelpers.gated-reaction.test.js (:62-69, :81-101)
// - parseRechargeThreshold "4-6"→4, fresh/spent recharge gate, turn-start
//   d6 regain hit/miss boundaries + `recharge`/`recharge_failed` logs →
//   services/encounters/monsterRecharge.test.js (:42, :50, :83-112, :171)
import { describe, it, expect, vi } from 'vitest';
import {
  getGatedMonsterReaction,
  resolveMonsterGatedReaction,
  PORTENT_POOL_KEY,
} from './MonsterCardHelpers.js';
import { MONSTER_RECHARGE_KEY, rollMonsterRecharges } from '../../services/encounters/monsterRecharge.js';
import monsters from '../../../public/data/monsters.json';

const PORTENT_ACTION = monsters.find(m => m.index === 'cyclops-oracle').reactions[0];
const ORACLE = 'Cyclops Oracle 1';
const CAMPAIGN = 'test-campaign';

function cs(round = 1) {
  return { round, creatures: [{ name: ORACLE, type: 'npc', currentHp: 207, maxHp: 207 }] };
}

function makePortentDeps({ round = 1, store = {}, rollTotal = 17 } = {}) {
  const state = { ...store };
  const logs = [];
  const deps = {
    findLastAttack: vi.fn(async () => null),
    getCombatContext: vi.fn(async () => cs(round)),
    getRuntimeValue: vi.fn((key, prop) => state[`${key}.${prop}`] ?? null),
    setRuntimeValue: vi.fn(async (key, prop, value) => { state[`${key}.${prop}`] = value; }),
    addEntry: vi.fn(async (campaign, entry) => { logs.push(entry); }),
    rollExpression: vi.fn((formula) => formula === '1d20' ? { formula, total: rollTotal, rolls: [rollTotal] } : { formula, total: 4, rolls: [4] }),
  };
  return { state, logs, deps };
}

function spentRecharge(map = {}) {
  return { ...map, Portent: { recharged: false, threshold: 4 } };
}

describe('MA-0544 Portent disk row + registry lock', () => {
  it('monsters.json cyclops-oracle reactions[0] carries automation {type,trigger,effect} + recharge "4-6" and arms the chip', () => {
    expect(PORTENT_ACTION.name).toBe('Portent');
    expect(PORTENT_ACTION.automation).toMatchObject({ type: 'reaction', trigger: 'd20_test_seen', effect: 'portent' });
    expect(PORTENT_ACTION.recharge).toBe('4-6');
    expect(getGatedMonsterReaction(PORTENT_ACTION)?.effect).toBe('portent');
  });
});

describe('MA-0544 resolveMonsterGatedReaction — Portent pool + recharge lifecycle', () => {
  it('first press: rolls 1d20, stores pool value, logs ability_use with GM-advisory note, stamps recharge spent', async () => {
    const { state, logs, deps } = makePortentDeps({ round: 2, rollTotal: 17 });
    const result = await resolveMonsterGatedReaction({ action: PORTENT_ACTION, monsterName: ORACLE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(true);
    expect(deps.rollExpression).toHaveBeenCalledWith('1d20');
    expect(result.rollTotal).toBe(17);
    const pool = state[`${ORACLE}.${PORTENT_POOL_KEY}`];
    expect(pool).toHaveLength(1);
    expect(pool[0].roll).toBe(17);
    expect(pool[0].round).toBe(2);
    expect(state[`${ORACLE}.${MONSTER_RECHARGE_KEY}`]).toEqual({ Portent: { recharged: false, threshold: 4 } });
    const spend = logs.find(l => l.type === 'ability_use' && l.abilityName === 'Portent' && /rolled 17/.test(l.description));
    expect(spend.characterName).toBe(ORACLE);
    expect(spend.description).toMatch(/GM applies 17 in place of a D20 Test/);
    expect(spend.description).toMatch(/advisory/);
    expect(spend.description).toMatch(/Recharge 4-6/);
    expect(result.popupHtml).toMatch(/<strong>17<\/strong>/);
  });

  it('spent gate refuses honestly: portent_refused, zero roll, zero pool growth, zero spend', async () => {
    const { state, logs, deps } = makePortentDeps({
      store: { [`${ORACLE}.${MONSTER_RECHARGE_KEY}`]: spentRecharge(), [`${ORACLE}.${PORTENT_POOL_KEY}`]: [{ roll: 9, round: 1 }] },
    });
    const result = await resolveMonsterGatedReaction({ action: PORTENT_ACTION, monsterName: ORACLE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(deps.rollExpression).not.toHaveBeenCalled();
    expect(deps.setRuntimeValue).not.toHaveBeenCalled();
    expect(logs).toHaveLength(1);
    expect(logs[0].automationType).toBe('portent_refused');
    expect(logs[0].description).toMatch(/not recharged/);
    expect(state[`${ORACLE}.${PORTENT_POOL_KEY}`]).toHaveLength(1);
    expect(result.popupHtml).toMatch(/Not Recharged|not recharged/i);
  });

  it('dice failure: portent_refused (dice), zero pool write, zero recharge spend', async () => {
    const { state, logs, deps } = makePortentDeps();
    deps.rollExpression = vi.fn(() => null);
    const result = await resolveMonsterGatedReaction({ action: PORTENT_ACTION, monsterName: ORACLE, campaignName: CAMPAIGN, deps });
    expect(result.ok).toBe(false);
    expect(logs[0].automationType).toBe('portent_refused');
    expect(logs[0].description).toMatch(/\(dice\)/);
    expect(state[`${ORACLE}.${PORTENT_POOL_KEY}`]).toBeUndefined();
    expect(state[`${ORACLE}.${MONSTER_RECHARGE_KEY}`]).toBeUndefined();
  });

  it('latch chain: spend stamp → turn-start d6 4+ regain → press re-arms, pool grows', async () => {
    const { state, deps } = makePortentDeps({ round: 3, rollTotal: 12 });
    await resolveMonsterGatedReaction({ action: PORTENT_ACTION, monsterName: ORACLE, campaignName: CAMPAIGN, deps });
    expect(state[`${ORACLE}.${MONSTER_RECHARGE_KEY}`].Portent.recharged).toBe(false);
    const regain = await rollMonsterRecharges({
      monsterName: ORACLE,
      campaignName: CAMPAIGN,
      deps: {
        getRuntimeValue: deps.getRuntimeValue,
        setRuntimeValue: deps.setRuntimeValue,
        addEntry: deps.addEntry,
        rollExpression: deps.rollExpression,
      },
    });
    expect(regain.rolled).toBe(true);
    expect(state[`${ORACLE}.${MONSTER_RECHARGE_KEY}`].Portent.recharged).toBe(true);
    const second = await resolveMonsterGatedReaction({ action: PORTENT_ACTION, monsterName: ORACLE, campaignName: CAMPAIGN, deps });
    expect(second.ok).toBe(true);
    expect(second.pool).toHaveLength(2);
    expect(second.rollTotal).toBe(12);
  });
});
