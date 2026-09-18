// MA-0374: Beholder Eye Rays picker — pure-parser unit locks (rays[]
// validation, d10 reroll-if-used-this-turn, single-ray action synthesis,
// auto-success clauses, popup/log row shapes).
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction, eyeRayAutoSuccessReason, buildEyeRayPickerPopup, buildEyeRayPickerRollLog, buildEyeRayAbilityUseLog, buildEyeRayAutoSuccessLog } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const beholder = (Array.isArray(monsters) ? monsters : monsters.monsters).find(m => m.name === 'Beholder');
const row = beholder.actions.find(a => a.name === 'Eye Rays');

describe('MA-0374 parseEyeRays', () => {
  it('beholders.json Eye Rays row parses 10 structured rays', () => {
    const rays = parseEyeRays(row);
    expect(rays).toHaveLength(10);
    expect(rays.map(r => r.key)).toEqual(['charm', 'paralyzing', 'fear', 'slowing', 'enervation', 'telekinetic', 'sleep', 'petrification', 'disintegration', 'death']);
  });

  it('every ray is a single parseable save leg', () => {
    for (const ray of parseEyeRays(row)) {
      expect(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']).toContain(ray.save_ability);
      expect(['half', 'none']).toContain(ray.dc_success);
      if (ray.damage_dice !== null) {
        expect(ray.damage_dice).toMatch(/^\d+d\d+$/);
        expect(ray.damage_type).toBeTruthy();
        expect(ray.dc_success).toBe('half');
      } else {
        expect(ray.dc_success).toBe('none');
      }
      expect(Array.isArray(ray.conditions)).toBe(true);
      expect(typeof ray.name).toBe('string');
    }
  });

  it('RAW ray damage/dice map per-byte on the structured rows', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.charm.damage_dice).toBe('3d8');
    expect(byKey.fear.damage_dice).toBe('4d6');
    expect(byKey.slowing.damage_dice).toBe('4d8');
    expect(byKey.enervation.damage_dice).toBe('3d8');
    expect(byKey.disintegration.damage_dice).toBe('8d8');
    expect(byKey.death.damage_dice).toBe('10d10');
    expect(byKey.disintegration.zero_hp_clause).toMatch(/dust/);
    expect(byKey.death.zero_hp_clause).toMatch(/dies/);
  });

  it('row keeps description/save_effect byte-unchanged and drops the Varies noise', () => {
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    expect(row.damage_type_primary).toBeUndefined();
    expect(row.description).toMatch(/roll 1d10; reroll if the beholder has already used that ray during this turn/);
  });

  it('byte-inert: no rays / malformed rays parse to null', () => {
    expect(parseEyeRays({ name: 'Bite' })).toBeNull();
    expect(parseEyeRays({ rays: [{ key: 'a' }] })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, save_ability: 'Varies' })) })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, dc_success: 'sometimes' })) })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, damage_dice: '3d8, 4d6' })) })).toBeNull();
  });
});

describe('MA-0374 pickEyeRay d10 picker', () => {
  const rays = parseEyeRays(row);
  const seq = rolls => () => rolls.shift();

  it('plain roll maps 1..10 to rays in order', () => {
    expect(pickEyeRay({ rays, rollD10: seq([1]) }).ray.key).toBe('charm');
    expect(pickEyeRay({ rays, rollD10: seq([4]) }).ray.key).toBe('slowing');
    expect(pickEyeRay({ rays, rollD10: seq([10]) }).ray.key).toBe('death');
    expect(pickEyeRay({ rays, rollD10: seq([4]) }).roll).toBe(4);
  });

  it('rerolls a ray already used this turn (RAW reroll rule)', () => {
    const used = ['slowing', 'death'];
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: used, rollD10: seq([4, 10, 7]) });
    expect(rerolls).toEqual([4, 10]);
    expect(roll).toBe(7);
    expect(ray.key).toBe('sleep');
  });

  it('rerolls out-of-range rolls too, recording only valid rerolled rays', () => {
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: [], rollD10: seq([0, 11, 3]) });
    expect(rerolls).toEqual([]);
    expect(roll).toBe(3);
    expect(ray.key).toBe('fear');
  });

  it('guard: exhausts to null instead of looping forever when nothing is free', () => {
    const allUsed = rays.map(r => r.key);
    const { ray } = pickEyeRay({ rays, usedKeys: allUsed, rollD10: () => Math.floor(Math.random() * 10) + 1 });
    expect(ray).toBeNull();
  });
});

describe('MA-0374 buildEyeRayAction + auto-success + rows', () => {
  const rays = parseEyeRays(row);

  it('synthesized ray row is single-ability parseable and carries the grant spec', () => {
    const slowing = rays.find(r => r.key === 'slowing');
    const act = buildEyeRayAction(row, slowing);
    expect(act.save_type).toBe('Constitution');
    expect(act.save_dc).toBe(16);
    expect(act.dc_success).toBe('half');
    expect(act.damage_dice_primary).toBe('4d8');
    expect(act.name).toBe('Slowing Ray (Eye Rays)');
    expect(act.eyeRay).toBe(slowing);
  });

  it('auto-success honors Gargantuan size and Construct/Undead type', () => {
    const tk = rays.find(r => r.key === 'telekinetic');
    const sleep = rays.find(r => r.key === 'sleep');
    expect(eyeRayAutoSuccessReason(tk, { size: 'Gargantuan' })).toMatch(/Gargantuan/);
    expect(eyeRayAutoSuccessReason(tk, { size: 'Medium' })).toBeNull();
    expect(eyeRayAutoSuccessReason(sleep, { monsterType: 'Construct' })).toMatch(/Construct/);
    expect(eyeRayAutoSuccessReason(sleep, { monsterType: 'Undead' })).toMatch(/Undead/);
    expect(eyeRayAutoSuccessReason(sleep, { monsterType: 'Aberration' })).toBeNull();
    expect(eyeRayAutoSuccessReason(rays[0], null)).toBeNull();
  });

  it('picker popup names the ray, the roll and the reroll history', () => {
    const html = buildEyeRayPickerPopup({ monsterName: 'Beholder 1', ray: rays[3], roll: 4, rerolls: [4, 10], targetName: 'HexWarlock' });
    expect(html).toMatch(/Slowing Ray/);
    expect(html).toMatch(/rolls 4/);
    expect(html).toMatch(/rerolled 4, 10/);
    expect(html).toMatch(/HexWarlock/);
  });

  it('log rows: d10 picker roll, ability_use naming the ray, auto-success record', () => {
    const roll = buildEyeRayPickerRollLog({ monsterName: 'Beholder 1', ray: rays[6], roll: 7, rerolls: [], targetName: 'HexWarlock' });
    expect(roll.type).toBe('roll');
    expect(roll.rollType).toBe('d10');
    expect(roll.total).toBe(7);
    expect(roll.description).toMatch(/Sleep Ray/);

    const use = buildEyeRayAbilityUseLog({ monsterName: 'Beholder 1', ray: rays[0], targetName: 'HexWarlock' });
    expect(use.type).toBe('ability_use');
    expect(use.abilityName).toBe('Charm Ray (Eye Rays)');
    expect(use.description).toMatch(/3d8 Psychic/);

    const auto = buildEyeRayAutoSuccessLog({ monsterName: 'Beholder 1', ray: rays[6], targetName: 'IronGolem', reason: 'Construct creatures succeed automatically' });
    expect(auto.automationType).toBe('eye_ray_auto_success');
    expect(auto.characterName).toBe('IronGolem');
  });
});
