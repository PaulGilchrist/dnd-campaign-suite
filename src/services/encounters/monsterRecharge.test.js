// @maintained-by-ai
// MA-0031: Cold Breath (Recharge 6) enforcement service — CANON base for the
// whole recharge family. Gate, fire-spend, refusal vocab (popup + log), and
// turn-start d6 regain (≥threshold recharges, <threshold stays spent).
// Turn-start recovery is silent for creatures without a spent map entry
// (no spam for every initiative walk). Seam-driven only — NEVER wall-clock.
//
// PRESERVED-CITED-BY (refreshed this pass; every recharge ticket lane
// ma1916 #1117 … ma2081 #1131 cites these ranges and deleted its copies —
// NEVER re-drive a cited face in a lane):
//   key-suffix strip + threshold parse census                old :42-48   → :78-93
//   fresh/spent/recharged gate truth-table (THE canonical)   old :50-58   → :96-106
//   ungated rows → null (no field / after-rest / no min_value) old :59-62, :152-155 → :108-119
//   fire-spend stamp + ability_use log (flat "6" + usage "5+") old :65-73, :163-169 → :122-157
//     (MONSTER_RECHARGE_KEY name old :124-126 folded into the store-tuple pin in that table)
//   refusal vocab <slug>_refused + popup + zero-spend          old :75-81   → :159-180
//   turn-start d6 recovery ladder (nat-5 boundary)             old :84-122, :107-112, :171-184 → :182-203
//   multi-entry one-roll-each + single merged write (new, RNG-pin #1072)  → :205-224
//   no-op silence (PC / already-recharged / junk store)        old :84-122  → :226-236
//   MA-0049 usage-object gate + chip label                    old :144-150, :157-161 → :239-250
//   MA-0663 dust-mephit disk+arm                              old :198-208   → :256-268
//   5-6 twin gate-arm vocab (apep threshold-5)                old :231-237   → :282-288
//   MA-1843 apep disk bytes + byte-inertness                 old :223-229, :239-247 → :290-303
// dup-map cuts: old :124-126 (folded), :152-155 (ungated table), :171-184
// (ladder legs 5/5-true + 4/5-false), :198-201+:203-208 (one data test),
// :223-229+:239-247 (one disk test). 18 its → 12 (21 cases via tables).
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MONSTER_RECHARGE_KEY,
  rechargeActionKey,
  parseRechargeThreshold,
  monsterRechargeGate,
  spendMonsterRecharge,
  rollMonsterRecharges,
  buildRechargeRefusalPopup,
  buildRechargeRefusalLog,
  rechargeUsageOf,
  rechargeDisplayText,
} from './monsterRecharge.js';

const COLD_BREATH = {
  name: 'Cold Breath (Recharge 6)',
  description: 'Constitution Saving Throw: DC 18, each creature in a 30-foot Cone.',
  save_dc: 18,
  save_type: 'Constitution',
  recharge: '6',
  damage_dice_primary: '10d8',
};

// MA-0049: Adult Blue Dracolich Lightning Breath authors recharge as a
// structured usage OBJECT {type:"recharge on roll", dice:"1d6", min_value:5} —
// both shapes gate identically, never render "[object Object]" (MV-26).
const DRACOLICH_BREATH = {
  name: 'Lightning Breath',
  description: 'The dracolich exhales lightning in a 90-foot line that is 5 feet wide. Each creature in that line must make a DC 20 Dexterity saving throw.',
  save_dc: 20,
  save_type: 'Dexterity',
  usage: { type: 'recharge on roll', dice: '1d6', min_value: 5 },
  damage_dice_primary: '12d10',
  damage_type_primary: 'Lightning',
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

afterEach(() => vi.restoreAllMocks());

describe('recharge parsing + key identity (MA-0031)', () => {
  it('keys strip the (Recharge N) suffix; threshold parse census (floor of range, junk → null)', () => {
    for (const [name, key] of [
      ['Cold Breath (Recharge 6)', 'Cold Breath'],
      ['Venomous Darkness (Recharge 5-6)', 'Venomous Darkness'],
      ['Lightning Breath (Recharge 5-6)', 'Lightning Breath'],
      ['Bite', 'Bite'],
    ]) {
      expect(rechargeActionKey({ name })).toBe(key);
    }
    for (const [text, threshold] of [
      ['6', 6], ['5-6', 5], ['4-6', 4], ['7-7', 7], [' 4 - 6 ', 4],
      ['nonsense', null], ['', null], [null, null], [undefined, null],
    ]) {
      expect(parseRechargeThreshold(text)).toBe(threshold);
    }
  });
});

describe('gate truth-table (MA-0031 — THE canonical table cited by every lane)', () => {
  it.each([
    ['no stored map (fresh)', null, true],
    ['empty map (fresh)', {}, true],
    ['spent entry', { 'Cold Breath': { recharged: false, threshold: 6 } }, false],
    ['recharged entry', { 'Cold Breath': { recharged: true, threshold: 6 } }, true],
    ['other key spent (unaffected)', { 'Fire Ball': { recharged: false, threshold: 6 } }, true],
  ])('%s → available %s', (_label, storedMap, available) => {
    expect(monsterRechargeGate(COLD_BREATH, storedMap)).toEqual(
      { key: 'Cold Breath', threshold: 6, available });
  });

  it('ungated rows → null (no field, after-rest usage, usage without min_value)', () => {
    const spent = { 'Cold Breath': { recharged: false, threshold: 6 } };
    for (const row of [
      { name: 'Bite', save_dc: 12 },
      { name: 'Enlarge', save_dc: 12, usage: { type: 'recharge after rest', rest_types: ['short', 'long'] } },
      { name: 'Gust', usage: { type: 'recharge on roll', dice: '1d6' } },
      undefined,
    ]) {
      expect(monsterRechargeGate(row, spent)).toBeNull();
    }
    expect(rechargeUsageOf({ name: 'Enlarge', usage: { type: 'recharge after rest', rest_types: ['short'] } })).toBeNull();
  });
});

describe('fire-spend at picker-open (MA-0031 flat + MA-0049 usage shapes)', () => {
  it.each([
    {
      label: 'flat "6" row',
      monsterName: 'Yeti 1',
      action: COLD_BREATH,
      key: 'Cold Breath',
      threshold: 6,
      log: 'Yeti 1 uses Cold Breath (Recharge 6) — Recharge 6; unavailable until a d6 6+ at the start of Yeti 1\'s next turn.',
    },
    {
      label: 'structured usage row',
      monsterName: 'Adult Blue Dracolich 1',
      action: DRACOLICH_BREATH,
      key: 'Lightning Breath',
      threshold: 5,
      log: 'Adult Blue Dracolich 1 uses Lightning Breath — Recharge 5+; unavailable until a d6 5+ at the start of Adult Blue Dracolich 1\'s next turn.',
    },
  ])('$label: stamps spent, campaign-keyed store tuple, exact ability_use log, zero dice', async ({ monsterName, action, key, threshold, log }) => {
    const d = deps();
    const gate = await spendMonsterRecharge({ monsterName, action, campaignName: 'test-campaign', deps: d });
    expect(gate).toEqual({ key, threshold, available: true });
    expect(d.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(d.setRuntimeValue).toHaveBeenCalledWith(
      monsterName, MONSTER_RECHARGE_KEY, { [key]: { recharged: false, threshold } }, 'test-campaign');
    expect(d.store[`${monsterName}.monsterRecharge`]).toEqual({ [key]: { recharged: false, threshold } });
    expect(d.addEntry).toHaveBeenCalledTimes(1);
    expect(d.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      characterName: monsterName,
      abilityName: action.name,
    }));
    expect(d.addEntry.mock.calls[0][1].description).toBe(log);
    expect(d.rollExpression).not.toHaveBeenCalled();
  });
});

describe('refusal vocabulary (MA-0031, cited #1131 verified-live)', () => {
  it('<slug>_refused log + popup exact-once vocab; zero spend, no save prompt; threshold/keyword defaults', () => {
    expect(monsterRechargeGate(COLD_BREATH, { 'Cold Breath': { recharged: false, threshold: 6 } }).available).toBe(false);
    const log = buildRechargeRefusalLog({ monsterName: 'Yeti 1', actionName: COLD_BREATH.name, rechargeKey: 'Cold Breath', threshold: 6 });
    expect(log.type).toBe('automation');
    expect(log.automationType).toBe('cold_breath_refused');
    expect(log.characterName).toBe('Yeti 1');
    expect(log.abilityName).toBe('Cold Breath (Recharge 6)');
    expect(log.description).toBe('Yeti 1 Cold Breath (Recharge 6) refused (not recharged) — requires a d6 6+ at the start of Yeti 1\'s turn. Zero spend, no save prompt.');
    expect(log.description).not.toMatch(/d6: \d/); // no dice consumed by a refusal

    const popup = buildRechargeRefusalPopup({ monsterName: 'Yeti 1', actionName: COLD_BREATH.name, threshold: 6 });
    expect(popup).toContain('Not Recharged');
    expect(popup).toContain('No save rolled, nothing spent.');

    // guard defaults: missing threshold → "6+", missing key → recharge_refused
    const fallback = buildRechargeRefusalLog({ monsterName: 'Yeti 1', actionName: 'Bite' });
    expect(fallback.automationType).toBe('recharge_refused');
    expect(fallback.description).toContain('a d6 6+');
    expect(buildRechargeRefusalPopup({ monsterName: 'Yeti 1', actionName: 'Bite' })).toContain('(6+ to recharge)');
  });
});

describe('turn-start d6 recovery lifecycle (MA-0031 seam, NEVER wall-clock)', () => {
  it.each([
    { nat: 6, threshold: 6, recharged: true },
    { nat: 5, threshold: 6, recharged: false },
    { nat: 5, threshold: 5, recharged: true },
    { nat: 4, threshold: 5, recharged: false },
    { nat: 6, threshold: undefined, recharged: true }, // honest default: 6+
  ])('nat $nat vs threshold $threshold → recharged $recharged (one 1d6, exact log)', async ({ nat, threshold, recharged }) => {
    const d = deps(nat);
    d.store['Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: false, threshold } };
    const res = await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d });
    expect(res.rolled).toBe(true);
    expect(d.rollExpression).toHaveBeenCalledTimes(1);
    expect(d.rollExpression).toHaveBeenCalledWith('1d6');
    expect(d.store['Yeti 1.monsterRecharge']['Cold Breath'].recharged).toBe(recharged);
    expect(d.setRuntimeValue).toHaveBeenCalledTimes(1);
    const log = d.addEntry.mock.calls[0][1];
    expect(log.automationType).toBe(recharged ? 'recharge' : 'recharge_failed');
    expect(log.description).toBe(recharged
      ? `Yeti 1's Cold Breath recharged (d6: ${nat}).`
      : `Yeti 1's Cold Breath not recharged (d6: ${nat}) — rolls again at the start of Yeti 1's next turn.`);
  });

  it('multi-entry walk: one d6 per spent entry, independent thresholds, single merged write', async () => {
    const d = deps(5);
    d.store['Yeti 1.monsterRecharge'] = {
      'Cold Breath': { recharged: false, threshold: 6 },
      'Frost Nova': { recharged: false, threshold: 5 },
    };
    const res = await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d });
    expect(res.rolled).toBe(true);
    expect(res.outcomes).toEqual([
      { key: 'Cold Breath', rolled: 5, recharged: false },
      { key: 'Frost Nova', rolled: 5, recharged: true },
    ]);
    expect(d.rollExpression).toHaveBeenCalledTimes(2); // RNG-consumed pin: one roll per spent entry
    expect(d.addEntry).toHaveBeenCalledTimes(2);
    expect(d.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(d.store['Yeti 1.monsterRecharge']).toEqual({
      'Cold Breath': { recharged: false, threshold: 6 },
      'Frost Nova': { recharged: true, threshold: 5 },
    });
  });

  it('silent no-op: PC turn (no map), already-recharged entry, junk store — no roll, no log, no write', async () => {
    const d = deps(6);
    expect((await rollMonsterRecharges({ monsterName: 'AasimarTest', campaignName: 'test-campaign', deps: d })).rolled).toBe(false);
    d.store['Yeti 1.monsterRecharge'] = { 'Cold Breath': { recharged: true, threshold: 6 } };
    expect((await rollMonsterRecharges({ monsterName: 'Yeti 1', campaignName: 'test-campaign', deps: d })).rolled).toBe(false);
    d.store['Junk 1.monsterRecharge'] = 'not-an-object';
    expect((await rollMonsterRecharges({ monsterName: 'Junk 1', campaignName: 'test-campaign', deps: d })).rolled).toBe(false);
    expect(d.rollExpression).not.toHaveBeenCalled();
    expect(d.addEntry).not.toHaveBeenCalled();
    expect(d.setRuntimeValue).not.toHaveBeenCalled();
  });
});

describe('MA-0049 structured usage{recharge on roll} shape', () => {
  it('threshold 5 from min_value (non-1d6 dice warned, still gated on min_value); chip label "Recharge 5+", flat verbatim, none → null', () => {
    expect(rechargeUsageOf(DRACOLICH_BREATH)).toEqual({ threshold: 5 });
    expect(monsterRechargeGate(DRACOLICH_BREATH, { 'Lightning Breath': { recharged: false, threshold: 5 } }).available).toBe(false);
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(rechargeUsageOf({ name: 'X', usage: { type: 'Recharge on Roll', dice: '2d6', min_value: 6 } })).toEqual({ threshold: 6 });
    expect(warn).toHaveBeenCalledTimes(1); // unsupported dice warned, never silent
    expect(rechargeDisplayText(DRACOLICH_BREATH)).toBe('Recharge 5+');
    expect(rechargeDisplayText(COLD_BREATH)).toBe('6');
    expect(rechargeDisplayText({ name: 'Claw' })).toBeNull();
  });
});

// MA-0663: Dust Mephit Blinding Breath (Recharge 6) data-consistency lock —
// RAW threshold was name-text only, so the economy never armed (unlimited
// refires, zero refusals). One data field fix, mirroring the string "6"
// byte-shape of the Ice/Magma/Mud Mephit and Yeti (MA-0031) twins.
describe('MA-0663 dust-mephit blinding-breath recharge data', () => {
  const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const blindingBreath = monsters.find((m) => m.name === 'Dust Mephit')
    .actions.find((a) => a.name.startsWith('Blinding Breath'));

  it('disk bytes recharge "6" + gate arms: threshold 6, fresh available, spent refused', () => {
    expect(blindingBreath.name).toBe('Blinding Breath (Recharge 6)');
    expect(blindingBreath.recharge).toBe('6');
    expect(rechargeUsageOf(blindingBreath)).toEqual({ threshold: 6 });
    expect(monsterRechargeGate(blindingBreath, null)).toEqual({ key: 'Blinding Breath', threshold: 6, available: true });
    expect(monsterRechargeGate(blindingBreath, { 'Blinding Breath': { recharged: false, threshold: 6 } }).available).toBe(false);
  });
});

// MA-1843: Apep "Venomous Darkness (Recharge 5-6)" authored recharge:"5-6"
// (MA-0663 twin one-field DATA fix) — name-text "(Recharge 5-6)" is parsed
// by NO recharge parser, so the flat field arms the live economy
// (spend/refusal/recovery via monsterRechargeGate consumers). Byte-inertness
// pinned: no top-level advisory key (AdvisoryLink would duplicate the live
// DC 26 save chip) and no dc_success override (app default "half" is
// RAW-correct for this row).
describe('MA-1843 apep venomous-darkness recharge data', () => {
  const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const venomousDarkness = monsters.find((m) => m.name === 'Apep')
    .actions.find((a) => a.name.startsWith('Venomous Darkness'));

  it('rechargeUsageOf + gate arm: threshold 5, fresh available, spent refused', () => {
    expect(rechargeUsageOf(venomousDarkness)).toEqual({ threshold: 5 });
    const fresh = monsterRechargeGate(venomousDarkness, null);
    expect(fresh).toEqual({ key: 'Venomous Darkness', threshold: 5, available: true });
    expect(monsterRechargeGate(venomousDarkness, { 'Venomous Darkness': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(venomousDarkness, { 'Venomous Darkness': { recharged: true, threshold: 5 } }).available).toBe(true);
  });

  it('disk bytes: recharge "5-6" on the DC 26 CON save row, byte-inert otherwise (no advisory/dc_success/save_effect, exact key set)', () => {
    expect(venomousDarkness.name).toBe('Venomous Darkness (Recharge 5-6)');
    expect(venomousDarkness.recharge).toBe('5-6');
    expect(venomousDarkness.save_dc).toBe(26);
    expect(venomousDarkness.save_type).toBe('Constitution');
    expect(venomousDarkness.damage_dice_primary).toBe('14d10');
    expect(venomousDarkness.advisory).toBeUndefined();
    expect(venomousDarkness.advisory_message).toBeUndefined();
    expect(venomousDarkness.dc_success).toBeUndefined();
    expect(venomousDarkness.save_effect).toBeUndefined();
    expect(Object.keys(venomousDarkness).sort()).toEqual(
      ['damage_dice_primary', 'damage_type_primary', 'description', 'name', 'recharge', 'save_dc', 'save_type']
    );
  });
});
