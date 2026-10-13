// MA-2067: Ziz "Solar Flare (Recharge 5-6)" — fingerprint #13
// recharge name-text trap (MA-0663/1916/1924/1948/1987/1996/2017/2041/2051/2059 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:35) → monsterRechargeGate null →
// ungated unlimited refires (live: 2 fires same-boundary, monsterRecharge absent,
// zero refusal/refused/recovery logs; truth via refused-type logs +
// cd.monsterRecharge + DOM, §685). Save core was live-verified exact
// BEFORE the fix (DC 24 Constitution auto-roll, 9d10 Radiant, half-on-
// success RAW default via the INLINE auto-roll lane — shapeless "each creature
// within 60 ft" with no Cone/Line/Sphere noun never opens the picker,
// MA-0701/§211; do NOT author dc_success/range). DATA fix: recharge:"5-6"
// after save_dc rides the live MA-0031 spend/refusal/recovery lane
// (monsterRecharge.js) — inline rows spend at roll resolution, spent chip,
// solar_flare_refused popup+log with zero roll, d6≥5 recovery at owner
// turn-start. twin shapeless-inline rows preserved (MA-2017/2041/2051).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate, rollMonsterRecharges } from '../../services/encounters/monsterRecharge.js';

const db = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ZIZ = db.find((m) => m.index === 'ziz');
const FLARE = ZIZ.actions[3];

describe('MA-2067 disk fingerprint: Ziz Solar Flare recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 24 CON, 9d10 Radiant, default half', () => {
    expect(ZIZ.name).toBe('Ziz');
    expect(FLARE.name).toBe('Solar Flare (Recharge 5-6)');
    expect(FLARE.save_dc).toBe(24);
    expect(FLARE.save_type).toBe('Constitution');
    expect(FLARE.damage_dice_primary).toBe('9d10');
    expect(FLARE.damage_type_primary).toBe('Radiant');
    expect(FLARE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
    expect(FLARE.range).toBeUndefined(); // one-field fix: shapeless-inline lane preserved (MA-2017/2041/2051 twins) — picker must never open (§211)
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(FLARE.recharge).toBe('5-6');
    expect(rechargeUsageOf(FLARE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(FLARE)).toBe('Solar Flare');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(FLARE, { 'Solar Flare': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(FLARE, { 'Solar Flare': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(FLARE, {}).available).toBe(true);
  });

  it('threshold-5 recovery ladder: d6 4 fails (recharge_failed), d6 5 recharges honestly', async () => {
    const logs = [];
    const fails = await rollMonsterRecharges({
      monsterName: 'Ziz 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Solar Flare': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs.push(entry); },
        rollExpression: () => ({ total: 4 }),
      },
    });
    expect(fails.rolled).toBe(true);
    expect(fails.outcomes).toEqual([{ key: 'Solar Flare', rolled: 4, recharged: false }]);
    expect(logs[0].automationType).toBe('recharge_failed');

    const logs2 = [];
    const ok = await rollMonsterRecharges({
      monsterName: 'Ziz 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Solar Flare': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs2.push(entry); },
        rollExpression: () => ({ total: 5 }),
      },
    });
    expect(ok.outcomes).toEqual([{ key: 'Solar Flare', rolled: 5, recharged: true }]);
    expect(logs2[0].automationType).toBe('recharge');
    // recharged map entry now opens the gate for the next press
    expect(monsterRechargeGate(FLARE, { 'Solar Flare': { recharged: true, threshold: 5 } }).available).toBe(true);
  });
});
