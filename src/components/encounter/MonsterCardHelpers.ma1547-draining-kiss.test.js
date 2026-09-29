// MA-1547: Succubus "Draining Kiss" (save row, DC 15 Constitution, 3d8
// Psychic) — FAIL(a) axes fixed:
// (1) half-on-success: prose "Success: Half damage" now matched by AUTHORED
//     dc_success:"half" (§1095: prose half without an authored field is a
//     FAIL(a) fingerprint even when the block-save default happens to halve —
//     the harness must pin it explicitly; MA-0481 family placement, after
//     save_type);
// (2) save-path HP-max-reduce: the RAW "Failure or Success: the target's
//     Hit Point maximum decreases by an amount equal to the damage taken" was
//     structurally unexpressible on save rows (§1096 — MA-1489's
//     hit_hp_max_reduce seam is handlePlainDamage.js/attack-lane only).
//     Fix: structured save_hp_max_reduce:{equal_to:"damage"} key +
//     parseSaveHpMaxReduce (structured-key-only, byte-inert elsewhere)
//     threaded onto the block-save context via buildAbilitySaveRollContext →
//     saveProcessing.applySaveDamage → hpMaxReduceService.applyHpMaxReduce.
// The incubus twin row stays UNTOUCHED (MA-1550 is its own ticket).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveHpMaxReduce, parseHitHpMaxReduce } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const SUCCUBUS = monsters.find((m) => m.index === 'succubus');
const KISS = SUCCUBUS.actions.find((a) => a.name === 'Draining Kiss');
const INCUBUS_TWIN = monsters.find((m) => m.index === 'succubus-incubus').actions.find((a) => a.name === 'Draining Kiss');
const SPECTER_HIT = monsters.find((m) => m.index === 'specter').actions[0];

describe('MA-1547 disk fingerprint: succubus Draining Kiss save row', () => {
  it('keeps the adjudication bytes unchanged (DC 15 CON, 3d8 Psychic, 5 ft)', () => {
    expect(KISS.name).toBe('Draining Kiss');
    expect(KISS.save_dc).toBe(15);
    expect(KISS.save_type).toBe('Constitution');
    expect(KISS.damage_dice_primary).toBe('3d8');
    expect(KISS.damage_type_primary).toBe('Psychic');
    expect(KISS.range).toBe('5 feet');
  });

  it('authors dc_success:"half" explicitly after save_type (§1095/MA-0481 placement)', () => {
    expect(KISS.dc_success).toBe('half');
    const keys = Object.keys(KISS);
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
  });

  it('description/save_effect byte-unchanged (RAW both-faces copy)', () => {
    expect(KISS.description).toBe("Constitution Saving Throw: DC 15, one creature Charmed by the succubus within 5 feet. Failure: 13 (3d8) Psychic damage. Success: Half damage. Failure or Success: The target's Hit Point maximum decreases by an amount equal to the damage taken.");
    expect(KISS.save_effect).toBe("13 (3d8) Psychic damage. Success: Half damage. Failure or Success: The target's Hit Point maximum decreases by an amount equal to the damage taken");
  });

  it('authors save_hp_max_reduce:{equal_to:"damage"} right after dc_success', () => {
    expect(KISS.save_hp_max_reduce).toEqual({ equal_to: 'damage' });
    const keys = Object.keys(KISS);
    expect(keys.indexOf('save_hp_max_reduce')).toBe(keys.indexOf('dc_success') + 1);
  });

  it('incubus twin row stays byte-inert — MA-1550 owns its own fix', () => {
    expect(INCUBUS_TWIN.dc_success).toBeUndefined();
    expect(INCUBUS_TWIN.save_hp_max_reduce).toBeUndefined();
  });
});

describe('MA-1547 parseSaveHpMaxReduce — structured-key-only parser', () => {
  it('arms the succubus row clause', () => {
    expect(parseSaveHpMaxReduce(KISS)).toEqual({ equalTo: 'damage' });
  });

  it('byte-inert null for rows without the key (incubus twin, clauseless rows)', () => {
    expect(parseSaveHpMaxReduce(INCUBUS_TWIN)).toBeNull();
    expect(parseSaveHpMaxReduce({ name: 'Constrict', save_dc: 15, save_type: 'Strength' })).toBeNull();
    expect(parseSaveHpMaxReduce(undefined)).toBeNull();
  });

  it('does NOT read the attack-lane hit_hp_max_reduce key (lane separation)', () => {
    expect(parseSaveHpMaxReduce(SPECTER_HIT)).toBeNull();
    expect(parseHitHpMaxReduce(SPECTER_HIT)).toEqual({ equalTo: 'damage' });
    expect(parseHitHpMaxReduce(KISS)).toBeNull();
  });

  it('equal_to must name "damage" — any other magnitude is inert', () => {
    expect(parseSaveHpMaxReduce({ save_hp_max_reduce: { equal_to: 'half' } })).toBeNull();
    expect(parseSaveHpMaxReduce({ save_hp_max_reduce: 'damage' })).toBeNull();
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

  it('save_hp_max_reduce rides the save context alongside dc_success half', () => {
    const ctx = kissContext(KISS);
    expect(ctx.saveDc).toBe(15);
    expect(ctx.dcSuccess).toBe('half');
    expect(ctx.autoDamageFormula).toBe('3d8');
    expect(ctx.autoDamageDamageType).toBe('Psychic');
    expect(ctx.saveHpMaxReduce).toEqual({ equalTo: 'damage' });
  });

  it('legacy save rows stay byte-inert — saveHpMaxReduce null without the key', () => {
    const ctx = kissContext(INCUBUS_TWIN);
    expect(ctx.saveHpMaxReduce).toBeNull();
    expect(ctx.autoDamageFormula).toBe('5d10 + 5');
  });
});
