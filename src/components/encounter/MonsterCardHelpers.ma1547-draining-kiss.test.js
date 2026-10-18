// MA-1547: Succubus "Draining Kiss" (save row, DC 15 Constitution, 3d8
// Psychic) — FAIL(a) axes fixed:
// (1) half-on-success: prose "Success: Half damage" now matched by AUTHORED
//     dc_success:"half" (§1095: prose half without an authored field is a
//     FAIL(a) fingerprint even when the block-save default happens to halve —
//     the harness must pin it explicitly);
// (2) save-path HP-max-reduce: the RAW "Failure or Success: the target's
//     Hit Point maximum decreases by an amount equal to the damage taken" was
//     structurally unexpressible on save rows (§1096 — MA-1489's
//     hit_hp_max_reduce seam is handlePlainDamage.js/attack-lane only).
//     Fix: structured save_hp_max_reduce:{equal_to:"damage"} key +
//     parseSaveHpMaxReduce (structured-key-only, byte-inert elsewhere)
//     threaded onto the block-save context via buildAbilitySaveRollContext →
//     saveProcessing.applySaveDamage → hpMaxReduceService.applyHpMaxReduce.
// MA-1550 (2026-09-29): the succubus-incubus twin row is now ARMED with the
// same save_hp_max_reduce:{equal_to:"damage"} rider — pins inverted below;
// its dc_success stays UNAUTHORED (half-default verified live, MA-0963
// convention — §523; §165: never copy the succubus' explicit half here).
// CONSUMER behavior (both RAW faces, ledger, clamp, legacy inert) is owned by
// saveProcessing.ma1547-draining-kiss.test.js; succubus save_dc/save_type/
// rider disk bytes are re-pinned by monsterSelfBuff.succubus-incubus-
// etherealness.test.js:82-85 (twin) and ma1639 (rider parity); the
// parseHitHpMaxReduce specter forward owns to ma1645-nightbringer:60.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveHpMaxReduce } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const SUCCUBUS = monsters.find((m) => m.index === 'succubus');
const KISS = SUCCUBUS.actions.find((a) => a.name === 'Draining Kiss');
const INCUBUS_TWIN = monsters.find((m) => m.index === 'succubus-incubus').actions.find((a) => a.name === 'Draining Kiss');
const SPECTER_HIT = monsters.find((m) => m.index === 'specter').actions[0];

describe('MA-1547/1550 disk fingerprint: Draining Kiss save rows', () => {
  it('succubus row: DC 15 CON 3d8 Psychic with EXPLICIT dc_success:"half" + save_hp_max_reduce rider (§1095 explicit-half axis)', () => {
    expect(KISS.save_dc).toBe(15);
    expect(KISS.save_type).toBe('Constitution');
    expect(KISS.damage_dice_primary).toBe('3d8');
    expect(KISS.damage_type_primary).toBe('Psychic');
    expect(KISS.dc_success).toBe('half');
    expect(KISS.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
  });

  it('MA-1550 incubus twin row: rider ARMED but dc_success stays UNAUTHORED (§523/§165 — never copy the explicit half)', () => {
    expect(INCUBUS_TWIN.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
    expect(INCUBUS_TWIN.dc_success).toBeUndefined();
  });
});

describe('MA-1547 parseSaveHpMaxReduce — structured-key-only truth table', () => {
  it('arms equal_to:"damage" (case-folded); inert for missing key, scalar riders, wrong magnitudes, and the attack-lane hit_hp_max_reduce key', () => {
    expect(parseSaveHpMaxReduce({ save_hp_max_reduce: { equal_to: 'damage' } })).toEqual({ equalTo: 'damage' });
    expect(parseSaveHpMaxReduce({ save_hp_max_reduce: { equal_to: 'Damage' } })).toEqual({ equalTo: 'damage' });
    // byte-inert null for every row without the structured key:
    expect(parseSaveHpMaxReduce({ name: 'Constrict', save_dc: 15, save_type: 'Strength' })).toBeNull();
    expect(parseSaveHpMaxReduce(undefined)).toBeNull();
    expect(parseSaveHpMaxReduce({ save_hp_max_reduce: { equal_to: 'half' } })).toBeNull();
    expect(parseSaveHpMaxReduce({ save_hp_max_reduce: 'damage' })).toBeNull();
    // lane separation — never reads MA-1489's attack-lane key (specter row):
    expect(parseSaveHpMaxReduce(SPECTER_HIT)).toBeNull();
  });
});

describe('MA-1547 block-save context threading (buildAbilitySaveRollContext)', () => {
  const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Psychic'];

  function kissContext(action) {
    return buildAbilitySaveRollContext({
      monsterName: 'Succubus 1',
      target: { name: 'Bandit', type: 'npc' },
      spellName: null,
      action,
      saveType: 'CON',
      dcSuccess: action.dc_success ?? 'half',
      saveDamageFormula: action.damage_dice_primary ?? null,
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
  }

  it('both rows ride saveHpMaxReduce:{equalTo:"damage"} — succubus explicit half 3d8, MA-1550 twin half-default 5d10+5', () => {
    const ctx = kissContext(KISS);
    expect(ctx.saveDc).toBe(15);
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('3d8');
    expect(ctx.autoDamageDamageType).toBe('Psychic');
    expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });

    // Twin: harness feeds `action.dc_success ?? 'half'` exactly as MonsterCardModal's
    // getSaveDcSuccess default does — unauthored row lands on half (MA-0963).
    const twin = kissContext(INCUBUS_TWIN);
    expect(INCUBUS_TWIN.dc_success).toBeUndefined();
    expect(twin.saveDc).toBe(15);
    expect(twin.dcSuccess).toBe('half');
    expect(twin.autoDamageFormula).toBe('5d10 + 5');
    expect(twin.autoDamageDamageType).toBe('Psychic');
    expect(twin.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
  });
});

// @maintained-by-ai
