// MA-0031: Cold Breath (Recharge 6) enforcement service tests — gate,
// fire-spend, refusal log shape, and turn-start d6 regain (≥6 recharges,
// <6 stays spent + not-recharged log). Turn-start recovery is silent for
// creatures without a spent map entry (no spam for every initiative walk).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MONSTER_RECHARGE_KEY,
  rechargeActionKey,
  parseRechargeThreshold,
  monsterRechargeGate,
  spendMonsterRecharge,
  rollMonsterRecharges,
  buildRechargeRefusalLog,
} from './monsterRecharge.js';

const COLD_BREATH = {
  name: 'Cold Breath (Recharge 6)',
  description: 'Constitution Saving Throw: DC 18, each creature in a 30-foot Cone.',
  save_dc: 18,
  save_type: 'Constitution',
  recharge: '6',
  damage_dice_primary: '10d8',
};

function deps(d6 = 6) {
  const store = {};
  return {
    store,
    addEntry: vi.fn(() => Promise.resolve()),
    rollExpression: vi.fn(() => ({ total: d6, rolls: [d6], modifier: 0 })),
    getRuntimeValue: vi.fn((k, p) => store[`${k}.${p}`] ?? null),
    setRuntimeValue: vi.fn((k, p, v) => { store[`${k}.${p}`] = v; return Promise.resolve(); }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe('MA-0031 recharge parsing + gate', () => {
  it('keys strip the (Recharge N) suffix and parse thresholds', () => {
    expect(rechargeActionKey(COLD_BREATH)).toBe('Cold Breath');
    expect(parseRechargeThreshold('6')).toBe(6);
    expect(parseRechargeThreshold('5-6')).toBe(5);
    expect(parseRechargeThreshold('4-6')).toBe(4);
    expect(parseRechargeThreshold('nonsense')).toBeNull();
  });

  it('fresh row (no stored map) is available; spent row is not', () => {
    const fresh = monsterRechargeGate(COLD_BREATH, null);
    expect(fresh).toEqual({ key: 'Cold Breath', threshold: 6, available: true });
    const spent = monsterRechargeGate(COLD_BREATH, { 'Cold Breath': { recharged: false, threshold: 6 } });
    expect(spent.available).toBe(false);
    const rc = monsterRechargeGate(COLD_BREATH, { 'Cold Breath': { recharged: true, threshold: 6 } });
    expect(rc.available).toBe(true);
  });

  it('non-recharge rows are ungated (null)', () => {
    expect(monsterRechargeGate({ name: 'Bite', save_dc: 12 }, { 'Cold Breath': { recharged: false } })).toBeNull();
  });
});

describe('MA-0031 fire-spend', () => {
  it('spend stamps recharged:false with threshold and logs ability_use', async () => {
    const d = deps();
    const gate = await spendMonsterRecharge({ monsterName: 'Yeti 1', action: COLD_BREATH, campaignName: 'test-campaign', deps: d });
    expect(gate.key).toBe('Cold Breath');
    expect(d.store['Yeti 1.monsterRecharge']).toEqual({ 'Cold Breath': { recharged: false, threshold: 6 } });
    const log = d.addEntry.mock.calls[0][1];
    expect(log.type).toBe('ability_use');
    expect(log.description).toMatch(/Recharge 6; unavailable until a d6 6\+/);
  });

  it('refusal log is <slug>_refused (not recharged), zero prompts implied', () => {
    const log = buildRechargeRefusalLog({ monsterName: 'Yeti 1', actionName: COLD_BREATH.name, rechargeKey: 'Cold Breath', threshold: 6 });
    expect(log.automationType).toBe('cold_breath_refused');
    expect(log.description).toMatch(/refused \(not recharged\)/);
    expect(log.description).toMatch(/Zero spend, no save prompt/);
  });
});

describe('MA-0031 turn-start recharge d6', () => {
  it('nat 6 recharges with `recharge` log "Cold Breath recharged (d6: 6)"', async () => {
    const d = deps(6);
    d.store['Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: false, threshold: 6 } };
    const res = await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d });
    expect(res.rolled).toBe(true);
    expect(d.rollExpression).toHaveBeenCalledWith('1d6');
    expect(d.store['Yeti 1.monsterRecharge']['Cold Breath'].recharged).toBe(true);
    const log = d.addEntry.mock.calls[0][1];
    expect(log.automationType).toBe('recharge');
    expect(log.description).toContain('Cold Breath recharged (d6: 6)');
  });

  it('nat 3 stays spent with `recharge_failed` not-recharged log', async () => {
    const d = deps(3);
    d.store['Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: false, threshold: 6 } };
    const res = await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d });
    expect(res.rolled).toBe(true);
    expect(d.store['Yeti 1.monsterRecharge']['Cold Breath'].recharged).toBe(false);
    const log = d.addEntry.mock.calls[0][1];
    expect(log.automationType).toBe('recharge_failed');
    expect(log.description).toContain('not recharged (d6: 3)');
  });

  it('5-6 rows recharge on nat 5', async () => {
    const d = deps(5);
    d.store['Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: false, threshold: 5 } };
    await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d });
    expect(d.store['Yeti 1.monsterRecharge']['Cold Breath'].recharged).toBe(true);
  });

  it('no-op without a spent map (no roll, no log) — PC turns untouched', async () => {
    const d = deps(6);
    expect((await rollMonsterRecharges({ monsterName: 'AasimarTest', campaignName: 'test-campaign', deps: d })).rolled).toBe(false);
    expect(d.rollExpression).not.toHaveBeenCalled();
    expect(d.addEntry).not.toHaveBeenCalled();
    d.store['Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: true, threshold: 6 } };
    expect((await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d })).rolled).toBe(false);
    expect(d.rollExpression).not.toHaveBeenCalled();
  });

  it('MONSTER_RECHARGE_KEY names the monster-store map', () => {
    expect(MONSTER_RECHARGE_KEY).toBe('monsterRecharge');
  });
});
