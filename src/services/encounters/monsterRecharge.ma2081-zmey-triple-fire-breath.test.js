// MA-2081: Zmey Gorynych "Triple Fire Breath (Recharge 5-6)" — fingerprint #14
// recharge name-text trap (MA-0663/1916/1924/1948/1978/1987/1996/2017/2041/2051/2059/2067 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:37) → monsterRechargeGate null →
// ungated unlimited refires (live: fire #1 picker roll Bandit −36, same-turn
// re-tap RE-OPENED the picker with zero .mc-recharge-refusal, cd['Zmey Gorynych
// 1'].monsterRecharge absent at every probe — truth via refused-type logs +
// cd.monsterRecharge + DOM, §685). Save core was live-verified exact BEFORE the
// fix (MA-2033 working picker lane: prose "90-foot Cone" noun parses the picker
// shape — "90-ft Cone (GM positions tokens; selection advisory)", DC 23 Dexterity,
// 11d8 Fire, half-on-success RAW default; do NOT author dc_success/range).
// DATA fix (one field, MA-2059 Glacier Wave twin picker-row placement):
//   recharge:"5-6" after damage_type_primary rides the live MA-0031
//   spend/refusal/recovery lane (monsterRecharge.js) — PICKER rows spend at
//   PICKER-OPEN (MA-1996/1987 convention, CLA-384): stamp
//   {Triple Fire Breath:{recharged:false,threshold:5}} + ability_use spend log;
//   re-press refuses pre-gate `.mc-recharge-refusal` + triple_fire_breath_refused,
//   picker never re-opens; d6≥5 recovery at owner turn-start.
// LEGEND DECOUPLING (post-MA-2079): Wing Buffet delegates_to REMOVED, own
// save_dc/save_type/2d8 Fire authored — rechargeUsageOf reads ONLY the pressed
// row's flat recharge (monsterRecharge.js:37) → gate null on Wing Buffet even
// with the master key SPENT: legendary presses never consume this recharge
// (pool-only, MA-2022 decoupling proof shape). §384: the MA-2079 sibling's
// stale pending-absence pins inverted same pass.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  rechargeActionKey,
  rechargeUsageOf,
  monsterRechargeGate,
  spendMonsterRecharge,
  rollMonsterRecharges,
  buildRechargeRefusalPopup,
  buildRechargeRefusalLog,
} from '../../services/encounters/monsterRecharge.js';

const db = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ZMEY = db.find((m) => m.index === 'zmey-gorynych');
const BREATH = ZMEY.actions[3];
const WING = ZMEY.legendary_actions[3];

describe('MA-2081 disk fingerprint: Zmey Triple Fire Breath recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 23 DEX, 11d8 Fire, default half', () => {
    expect(ZMEY.name).toBe('Zmey Gorynych');
    expect(BREATH.name).toBe('Triple Fire Breath (Recharge 5-6)');
    expect(BREATH.save_dc).toBe(23);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('11d8');
    expect(BREATH.damage_type_primary).toBe('Fire');
    expect(BREATH.description).toBe('Dexterity Saving Throw: DC 23, each creature in a 90-foot Cone. Failure: 49 (11d8) Fire damage. Success: Half damage.');
    expect(BREATH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE (MA-2059 twin)
    expect(BREATH.range).toBeUndefined(); // picker shape parses from prose "90-foot Cone" (MA-2033) — do NOT author range
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text, 2 ungated fires live)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREATH)).toBe('Triple Fire Breath');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(BREATH, { 'Triple Fire Breath': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(BREATH, { 'Triple Fire Breath': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BREATH, {}).available).toBe(true);
    expect(monsterRechargeGate(BREATH, null).available).toBe(true);
  });

  it('picker-open spend stamps {Triple Fire Breath:{recharged:false,threshold:5}} + ability_use log (MA-1996 shape)', async () => {
    const store = {};
    const logs = [];
    const gate = await spendMonsterRecharge({
      monsterName: 'Zmey Gorynych 1',
      action: BREATH,
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: (_n, k) => store[`Zmey Gorynych 1.${k}`],
        setRuntimeValue: async (_n, k, v) => { store[`Zmey Gorynych 1.${k}`] = v; },
        addEntry: async (_c, entry) => { logs.push(entry); },
      },
    });
    expect(gate).toEqual({ key: 'Triple Fire Breath', threshold: 5, available: true });
    expect(store['Zmey Gorynych 1.monsterRecharge']).toEqual({ 'Triple Fire Breath': { recharged: false, threshold: 5 } });
    expect(logs[0].type).toBe('ability_use');
    expect(logs[0].description).toContain('Recharge 5-6');
    // gate now closed — the re-press that used to re-open the picker refuses pre-gate
    expect(monsterRechargeGate(BREATH, store['Zmey Gorynych 1.monsterRecharge']).available).toBe(false);
  });

  it('refusal surface: .mc-recharge-refusal popup + triple_fire_breath_refused log, zero spend copy', () => {
    const popup = buildRechargeRefusalPopup({ monsterName: 'Zmey Gorynych 1', actionName: BREATH.name, threshold: 5 });
    expect(popup).toContain('mc-recharge-refusal');
    expect(popup).toContain('Not Recharged');
    const log = buildRechargeRefusalLog({ monsterName: 'Zmey Gorynych 1', actionName: BREATH.name, rechargeKey: 'Triple Fire Breath', threshold: 5 });
    expect(log.type).toBe('automation');
    expect(log.automationType).toBe('triple_fire_breath_refused');
    expect(log.description).toContain('Zero spend, no save prompt');
  });

  it('threshold-5 recovery ladder: d6 4 fails (recharge_failed), d6 5 recharges honestly', async () => {
    const logs = [];
    const fails = await rollMonsterRecharges({
      monsterName: 'Zmey Gorynych 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Triple Fire Breath': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs.push(entry); },
        rollExpression: () => ({ total: 4 }),
      },
    });
    expect(fails.rolled).toBe(true);
    expect(fails.outcomes).toEqual([{ key: 'Triple Fire Breath', rolled: 4, recharged: false }]);
    expect(logs[0].automationType).toBe('recharge_failed');

    const logs2 = [];
    const ok = await rollMonsterRecharges({
      monsterName: 'Zmey Gorynych 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Triple Fire Breath': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs2.push(entry); },
        rollExpression: () => ({ total: 5 }),
      },
    });
    expect(ok.outcomes).toEqual([{ key: 'Triple Fire Breath', rolled: 5, recharged: true }]);
    expect(logs2[0].automationType).toBe('recharge');
    // recharged map entry now opens the gate for the next press
    expect(monsterRechargeGate(BREATH, { 'Triple Fire Breath': { recharged: true, threshold: 5 } }).available).toBe(true);
  });
});

describe('MA-2081 legend decoupling (post-MA-2079): Wing Buffet own fields pinned, master recharge pool-only', () => {
  it('Wing Buffet self-resolves with OWN numeric fields — delegates_to stays GONE', () => {
    expect(WING.name).toBe('Wing Buffet (Costs 2 Actions)');
    expect(WING.delegates_to).toBeUndefined(); // MA-2079 fix stays decoupled
    expect(WING.save_dc).toBe(23);
    expect(WING.save_type).toBe('Dexterity');
    expect(WING.damage_dice_primary).toBe('2d8');
    expect(WING.damage_type_primary).toBe('Fire');
  });

  it('Wing Buffet presses never consume the master recharge — gate null even with master key SPENT', () => {
    expect(WING.recharge).toBeUndefined();
    expect(rechargeUsageOf(WING)).toBeNull();
    expect(monsterRechargeGate(WING, { 'Triple Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(WING, { 'Triple Fire Breath': { recharged: true, threshold: 5 } })).toBeNull();
  });
});
