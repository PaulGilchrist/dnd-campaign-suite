// MA-2059: Ymir "Glacier Wave (Recharge 5-6)" — fingerprint #12 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996/2017/2041/2051 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:37) → monsterRechargeGate null →
// ungated unlimited refires (live: 4 fires incl same-turn + past owner-turn,
// cd['Ymir 1'].monsterRecharge absent at every probe, zero refusal/recovery
// logs). SECOND gap: prose Restrained clause inert (§567 bait twin) — save
// lane word-scans save_effect ONLY (extractConditionsFromSaveEffect,
// Helpers:383) → row carried no save_effect → ['restrained'] never produced,
// zero grant after two failed saves (live cd['Bandit'].activeConditions []).
// DATA fix (two fields on monsters.json ymir actions[3]):
//   recharge:"5-6"  — rides the live MA-0031 spend/refusal/recovery lane
//                     (picker-open spend convention MA-1996/1987; re-press
//                     refuses `.mc-recharge-refusal` + glacier_wave_refused
//                     pre-gate, picker never re-opens; d6≥5 recovery at own
//                     turn-start).
//   save_effect:"The target has the Restrained condition until the end of
//     its next turn." — centaur Entangling Trail byte-twin (MA-2021 lane):
//     canonical Restrained word grants fail-only via picker applySaveFail-
//     Conditions (SaveAttackAoeModal:652); "until..." clause rides
//     extractConditionDurationNote into the grant-log copy.
// dc_success stays UNSET — half-default pays half on success, matching RAW
// "Success: Half damage" (MA-2045/MA-1855 pin). escape_dc stays OMITTED —
// RAW states no escape DC here (§537: restrained≠grappled, escape badges
// ride the grapple hit-clause lane anyway). Core picker lane was live-
// verified EXACT pre-fix (MA-2033 Line parse, fail Σ==fd, half floor via
// full-word saveBonuses.strength) — byte-unchanged, pinned below.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  rechargeActionKey,
  rechargeUsageOf,
  monsterRechargeGate,
  rollMonsterRecharges,
  buildRechargeRefusalPopup,
  buildRechargeRefusalLog,
} from '../../services/encounters/monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

const db = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const YMIR = db.find((m) => m.index === 'ymir');
const WAVE = YMIR.actions[3];

describe('MA-2059 disk fingerprint: Ymir Glacier Wave core bytes intact', () => {
  it('row identity + save core byte-unchanged (live-verified exact pre-fix): DC 26 STR, 14d10 Bludgeoning', () => {
    expect(YMIR.name).toBe('Ymir');
    expect(WAVE.name).toBe('Glacier Wave (Recharge 5-6)');
    expect(WAVE.save_dc).toBe(26);
    expect(WAVE.save_type).toBe('Strength');
    expect(WAVE.damage_dice_primary).toBe('14d10');
    expect(WAVE.damage_type_primary).toBe('Bludgeoning');
    expect(WAVE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct ("Success: Half damage") — pin its ABSENCE (MA-2045 twin)
    expect(WAVE.escape_dc).toBeUndefined(); // RAW states no escape DC — do NOT fabricate (bug-file directive; §537 badges ride grapple lane)
    expect(WAVE.description).toBe('Strength Saving Throw: DC 26, each creature in a 120-foot-long, 10-foot-wide Line. Failure: 77 (14d10) Bludgeoning damage. Success: Half damage. The target is also Restrained until the end of its next turn.');
  });
});

describe('MA-2059 recharge axis: flat recharge:"5-6" arms the MA-0031 gate (was ungated name-text, 4 fires live)', () => {
  it('recharge field authored + parsed to threshold 5; key strips the name suffix', () => {
    expect(WAVE.recharge).toBe('5-6');
    expect(rechargeUsageOf(WAVE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(WAVE)).toBe('Glacier Wave');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(WAVE, { 'Glacier Wave': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(WAVE, { 'Glacier Wave': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(WAVE, {}).available).toBe(true);
    expect(monsterRechargeGate(WAVE, null).available).toBe(true);
  });

  it('refusal surface: .mc-recharge-refusal popup + glacier_wave_refused log, zero spend copy', () => {
    const popup = buildRechargeRefusalPopup({ monsterName: 'Ymir 1', actionName: WAVE.name, threshold: 5 });
    expect(popup).toContain('mc-recharge-refusal');
    expect(popup).toContain('Not Recharged');
    const log = buildRechargeRefusalLog({ monsterName: 'Ymir 1', actionName: WAVE.name, rechargeKey: 'Glacier Wave', threshold: 5 });
    expect(log.type).toBe('automation');
    expect(log.automationType).toBe('glacier_wave_refused');
    expect(log.description).toContain('Zero spend, no save prompt');
  });

  it('threshold-5 recovery ladder: d6 4 fails (recharge_failed), d6 5 recharges honestly', async () => {
    const logs = [];
    const fails = await rollMonsterRecharges({
      monsterName: 'Ymir 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Glacier Wave': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs.push(entry); },
        rollExpression: () => ({ total: 4 }),
      },
    });
    expect(fails.rolled).toBe(true);
    expect(fails.outcomes).toEqual([{ key: 'Glacier Wave', rolled: 4, recharged: false }]);
    expect(logs[0].automationType).toBe('recharge_failed');

    const logs2 = [];
    const ok = await rollMonsterRecharges({
      monsterName: 'Ymir 1',
      campaignName: 'test-campaign',
      deps: {
        getRuntimeValue: () => ({ 'Glacier Wave': { recharged: false, threshold: 5 } }),
        setRuntimeValue: async (_c, _k, v) => v,
        addEntry: async (_c, entry) => { logs2.push(entry); },
        rollExpression: () => ({ total: 5 }),
      },
    });
    expect(ok.outcomes).toEqual([{ key: 'Glacier Wave', rolled: 5, recharged: true }]);
    expect(logs2[0].automationType).toBe('recharge');
    expect(monsterRechargeGate(WAVE, { 'Glacier Wave': { recharged: true, threshold: 5 } }).available).toBe(true);
  });
});

describe('MA-2059 Restrained bait closed: save_effect authored, word-scan + duration note live', () => {
  it('save_effect authored with the canonical Restrained word (centaur twin byte-shape)', () => {
    expect(WAVE.save_effect).toBe('The target has the Restrained condition until the end of its next turn.');
  });

  it('extractor yields [restrained] (was [] — no save_effect, display-only prose)', () => {
    expect(extractConditionsFromSaveEffect(WAVE.save_effect)).toEqual(['restrained']);
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]); // pre-fix input: zero save-lane producers
  });

  it('duration clause rides the grant-log copy via extractConditionDurationNote', () => {
    expect(extractConditionDurationNote(WAVE.save_effect)).toBe('until the end of its next turn (GM-enforced)');
  });
});
