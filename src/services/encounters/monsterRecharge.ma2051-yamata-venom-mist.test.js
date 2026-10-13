// MA-2051: Yamata no Orochi "Venom Mist (Recharge 5-6)" — fingerprint #11
// recharge name-text trap (MA-0663/1916/1924/1948/1987/1996/2017/2041 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:35) → monsterRechargeGate null →
// ungated unlimited refires (live: 2 fires same-boundary + past owner-turn,
// monsterRecharge absent, zero refusal/refused/recovery logs; recharge-log
// substring grep hits only roll.name on this lane — truth via refused-type
// logs + cd.monsterRecharge + DOM, §685). Save core was live-verified exact
// BEFORE the fix (DC 26 Constitution auto-roll, 77/22d6 Poison, half-on-
// success RAW default via the INLINE auto-roll lane — shapeless "each creature
// within 90 ft" with no Cone/Line/Sphere noun never opens the picker,
// MA-0701/§211; do NOT author dc_success/range). DATA fix: recharge:"5-6"
// after save_dc rides the live MA-0031 spend/refusal/recovery lane
// (monsterRecharge.js) — inline rows spend at roll resolution, spent chip,
// venom_mist_refused popup+log with zero roll, d6≥5 recovery at owner
// turn-start. twin shapeless-inline rows preserved (MA-2017/2041).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate, rollMonsterRecharges } from '../../services/encounters/monsterRecharge.js';

const db = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const OROCHI = db.find((m) => m.index === 'yamata-no-orochi');
const MIST = OROCHI.actions[2];

describe('MA-2051 disk fingerprint: Yamata no Orochi Venom Mist recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 26 CON, 22d6 Poison, default half', () => {
    expect(OROCHI.name).toBe('Yamata no Orochi');
    expect(MIST.name).toBe('Venom Mist (Recharge 5-6)');
    expect(MIST.save_dc).toBe(26);
    expect(MIST.save_type).toBe('Constitution');
    expect(MIST.damage_dice_primary).toBe('22d6');
    expect(MIST.damage_type_primary).toBe('Poison');
    expect(MIST.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
    expect(MIST.range).toBeUndefined(); // one-field fix: shapeless-inline lane preserved (MA-2017/2041 twins) — picker must never open (§211)
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(MIST.recharge).toBe('5-6');
    expect(rechargeUsageOf(MIST)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(MIST)).toBe('Venom Mist');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(MIST, { 'Venom Mist': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(MIST, { 'Venom Mist': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(MIST, {}).available).toBe(true);
  });

  it('threshold-5 recovery ladder: d6 4 fails (recharge_failed), d6 5 recharges honestly', async () => {
    const logs = [];
    const fails = await rollMonsterRecharges({
      monsterName: 'Yamata no Orochi 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Venom Mist': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs.push(entry); },
        rollExpression: () => ({ total: 4 }),
      },
    });
    expect(fails.rolled).toBe(true);
    expect(fails.outcomes).toEqual([{ key: 'Venom Mist', rolled: 4, recharged: false }]);
    expect(logs[0].automationType).toBe('recharge_failed');

    const logs2 = [];
    const ok = await rollMonsterRecharges({
      monsterName: 'Yamata no Orochi 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Venom Mist': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs2.push(entry); },
        rollExpression: () => ({ total: 5 }),
      },
    });
    expect(ok.outcomes).toEqual([{ key: 'Venom Mist', rolled: 5, recharged: true }]);
    expect(logs2[0].automationType).toBe('recharge');
    // recharged map entry now opens the gate for the next press
    expect(monsterRechargeGate(MIST, { 'Venom Mist': { recharged: true, threshold: 5 } }).available).toBe(true);
  });
});
