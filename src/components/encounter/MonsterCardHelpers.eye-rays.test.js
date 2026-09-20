// MA-0374/MA-0383: Eye Rays picker — pure-parser unit locks (rays[]
// validation, len(rays)-sized reroll-if-used-this-turn picker — d10
// Beholder / d4 Beholder Zombie, single-ray action synthesis with row-DC
// stamp, auto-success clauses, popup/log row shapes).
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction, eyeRayAutoSuccessReason, buildEyeRayPickerPopup, buildEyeRayPickerRollLog, buildEyeRayAbilityUseLog, buildEyeRayAutoSuccessLog } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const beholder = (Array.isArray(monsters) ? monsters : monsters.monsters).find(m => m.name === 'Beholder');
const row = beholder.actions.find(a => a.name === 'Eye Rays');
const zombie = (Array.isArray(monsters) ? monsters : monsters.monsters).find(m => m.name === 'Beholder Zombie');
const zRow = zombie.actions.find(a => a.name === 'Eye Rays');

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
    expect(pickEyeRay({ rays, rollDie: seq([1]) }).ray.key).toBe('charm');
    expect(pickEyeRay({ rays, rollDie: seq([4]) }).ray.key).toBe('slowing');
    expect(pickEyeRay({ rays, rollDie: seq([10]) }).ray.key).toBe('death');
    expect(pickEyeRay({ rays, rollDie: seq([4]) }).roll).toBe(4);
  });

  it('rerolls a ray already used this turn (RAW reroll rule)', () => {
    const used = ['slowing', 'death'];
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: used, rollDie: seq([4, 10, 7]) });
    expect(rerolls).toEqual([4, 10]);
    expect(roll).toBe(7);
    expect(ray.key).toBe('sleep');
  });

  it('rerolls out-of-range rolls too, recording only valid rerolled rays', () => {
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: [], rollDie: seq([0, 11, 3]) });
    expect(rerolls).toEqual([]);
    expect(roll).toBe(3);
    expect(ray.key).toBe('fear');
  });

  it('guard: exhausts to null instead of looping forever when nothing is free', () => {
    const allUsed = rays.map(r => r.key);
    const { ray } = pickEyeRay({ rays, usedKeys: allUsed, rollDie: () => Math.floor(Math.random() * 10) + 1 });
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
    expect(act.eyeRay).toEqual({ ...slowing, save_dc: 16 });
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

// ── MA-0383: Beholder Zombie — 4-ray d4 picker on the shared consumer ──
describe('MA-0383 Beholder Zombie parseEyeRays (d4 row)', () => {
  it('zombie Eye Rays row parses 4 structured rays', () => {
    const rays = parseEyeRays(zRow);
    expect(rays).toHaveLength(4);
    expect(rays.map(r => r.key)).toEqual(['paralyzing', 'fear', 'enervation', 'disintegration']);
  });

  it('RAW zombie ray damage/dice/type map byte-on-disk', () => {
    const byKey = Object.fromEntries(parseEyeRays(zRow).map(r => [r.key, r]));
    expect(byKey.paralyzing.damage_dice).toBeNull();
    expect(byKey.paralyzing.save_ability).toBe('Constitution');
    expect(byKey.paralyzing.dc_success).toBe('none');
    expect(byKey.paralyzing.ladder).toBe('paralyzed');
    expect(byKey.fear.damage_dice).toBe('3d8');
    expect(byKey.fear.damage_type).toBe('Psychic');
    expect(byKey.fear.save_ability).toBe('Wisdom');
    expect(byKey.fear.dc_success).toBe('half');
    expect(byKey.fear.conditions).toEqual(['frightened']);
    expect(byKey.enervation.damage_dice).toBe('3d6');
    expect(byKey.enervation.damage_type).toBe('Necrotic');
    expect(byKey.enervation.conditions).toEqual(['poisoned']);
    expect(byKey.enervation.te_grants).toEqual(['no_healing']);
    expect(byKey.disintegration.damage_dice).toBe('5d10');
    expect(byKey.disintegration.damage_type).toBe('Force');
    expect(byKey.disintegration.save_ability).toBe('Dexterity');
    expect(byKey.disintegration.zero_hp_clause).toMatch(/dust/);
  });

  it('row keeps description/save_effect byte-unchanged and drops the Varies noise', () => {
    expect(zRow.save_dc).toBe(14);
    expect(zRow.save_type).toBeUndefined();
    expect(zRow.damage_dice_primary).toBeUndefined();
    expect(zRow.damage_type_primary).toBeUndefined();
    expect(zRow.description).toMatch(/roll 1d4; reroll if the zombie has already used that ray during this turn/);
    expect(zRow.save_effect).toMatch(/Success on damage rays: Half damage\./);
  });

  it('no zombie ray carries auto-success exceptions (RAW: no Sleep/Construct clause)', () => {
    for (const ray of parseEyeRays(zRow)) {
      expect(ray.auto_success_types).toBeUndefined();
      expect(ray.auto_success_size).toBeUndefined();
    }
  });
});

describe('MA-0383 pickEyeRay d4 picker (die = len(rays))', () => {
  const rays = parseEyeRays(zRow);
  const seq = rolls => () => rolls.shift();

  it('plain roll maps 1..4 to rays in order', () => {
    expect(pickEyeRay({ rays, rollDie: seq([1]) }).ray.key).toBe('paralyzing');
    expect(pickEyeRay({ rays, rollDie: seq([2]) }).ray.key).toBe('fear');
    expect(pickEyeRay({ rays, rollDie: seq([3]) }).ray.key).toBe('enervation');
    expect(pickEyeRay({ rays, rollDie: seq([4]) }).ray.key).toBe('disintegration');
    expect(pickEyeRay({ rays, rollDie: seq([3]) }).roll).toBe(3);
  });

  it('d4 bounds: 5+ and 0 are rejected and re-rolled, not indexed', () => {
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: [], rollDie: seq([0, 5, 11, 2]) });
    expect(rerolls).toEqual([]);
    expect(roll).toBe(2);
    expect(ray.key).toBe('fear');
  });

  it('rerolls a ray already used this turn (RAW reroll-if-used)', () => {
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: ['fear', 'disintegration'], rollDie: seq([2, 4, 1]) });
    expect(rerolls).toEqual([2, 4]);
    expect(roll).toBe(1);
    expect(ray.key).toBe('paralyzing');
  });

  it('guard: exhausts to null instead of looping forever when nothing is free', () => {
    const allUsed = rays.map(r => r.key);
    const { ray } = pickEyeRay({ rays, usedKeys: allUsed, rollDie: () => Math.floor(Math.random() * 4) + 1 });
    expect(ray).toBeNull();
  });
});

describe('MA-0383 zombie synthesis + picker rows name d4/DC 14', () => {
  const rays = parseEyeRays(zRow);

  it('buildEyeRayAction stamps the zombie row DC 14 onto the ray for the ladder service', () => {
    const para = rays.find(r => r.key === 'paralyzing');
    const act = buildEyeRayAction(zRow, para);
    expect(act.save_dc).toBe(14);
    expect(act.save_type).toBe('Constitution');
    expect(act.dc_success).toBe('none');
    expect(act.damage_dice_primary).toBeUndefined();
    expect(act.eyeRay.save_dc).toBe(14);
    expect(act.eyeRay.ladder).toBe('paralyzed');
    const dis = buildEyeRayAction(zRow, rays.find(r => r.key === 'disintegration'));
    expect(dis.damage_dice_primary).toBe('5d10');
    expect(dis.damage_type_primary).toBe('Force');
  });

  it('popup + logs print d4 and DC 14 (never d10/DC 16)', () => {
    const fear = rays.find(r => r.key === 'fear');
    const html = buildEyeRayPickerPopup({ monsterName: 'Beholder Zombie 1', ray: fear, roll: 2, rerolls: [4], targetName: 'HexWarlock', die: 4, dc: 14 });
    expect(html).toMatch(/Eye Rays d4/);
    expect(html).toMatch(/DC 14 Wisdom save/);
    expect(html).toMatch(/rerolled 4/);

    const rollLog = buildEyeRayPickerRollLog({ monsterName: 'Beholder Zombie 1', ray: fear, roll: 2, rerolls: [], targetName: 'HexWarlock', die: 4 });
    expect(rollLog.rollType).toBe('d4');
    expect(rollLog.name).toBe('Eye Rays (d4 ray picker)');
    expect(rollLog.description).toMatch(/rolled 2 on the Eye Rays d4 — Fear Ray/);

    const use = buildEyeRayAbilityUseLog({ monsterName: 'Beholder Zombie 1', ray: rays.find(r => r.key === 'enervation'), targetName: 'HexWarlock', dc: 14 });
    expect(use.description).toMatch(/DC 14 Constitution save, 3d6 Necrotic/);

    const paraUse = buildEyeRayAbilityUseLog({ monsterName: 'Beholder Zombie 1', ray: rays[0], targetName: 'HexWarlock', dc: 14 });
    expect(paraUse.description).toMatch(/no damage, condition save/);
  });

  it('beholder defaults stay byte-identical (d10/DC 16) — MA-0374 untouched', () => {
    const bRays = parseEyeRays(row);
    const html = buildEyeRayPickerPopup({ monsterName: 'Beholder 1', ray: bRays[2], roll: 3, targetName: 'HexWarlock' });
    expect(html).toMatch(/Eye Rays d10/);
    expect(html).toMatch(/DC 16 Wisdom save/);
    expect(buildEyeRayPickerRollLog({ monsterName: 'Beholder 1', ray: bRays[2], roll: 3, targetName: 'HexWarlock' }).rollType).toBe('d10');
  });
});

// ── MA-0577: Death Tyrant — §88 rays[] conversion of the missed twin ────
const tyrant = (Array.isArray(monsters) ? monsters : monsters.monsters).find(m => m.name === 'Death Tyrant');
const tRow = tyrant.actions.find(a => a.name === 'Eye Rays');

describe('MA-0577 Death Tyrant parseEyeRays (d10 DC 17 row)', () => {
  it('Eye Rays row carries 10 structured rays — no Varies/multi-string noise', () => {
    const rays = parseEyeRays(tRow);
    expect(rays).toHaveLength(10);
    expect(rays.map(r => r.key)).toEqual(['charm', 'paralyzing', 'fear', 'slowing', 'enervation', 'telekinetic', 'sleep', 'petrification', 'disintegration', 'death']);
    expect(rays.map(r => r.name)).toEqual(['Charm Ray', 'Paralyzing Ray', 'Fear Ray', 'Slowing Ray', 'Enervation Ray', 'Telekinetic Ray', 'Sleep Ray', 'Petrification Ray', 'Disintegration Ray', 'Death Ray']);
    expect(tRow.save_dc).toBe(17);
    expect(tRow.save_type).toBeUndefined();
    expect(tRow.damage_dice_primary).toBeUndefined();
    expect(tRow.damage_type_primary).toBeUndefined();
    expect(tRow.description).toMatch(/roll 1d10; reroll if the death tyrant has already used that ray during this turn/);
  });

  it('RAW tyrant ray damage/dice/type map byte-on-disk (3d6 fear, 3d10 enervation)', () => {
    const byKey = Object.fromEntries(parseEyeRays(tRow).map(r => [r.key, r]));
    expect(byKey.charm.damage_dice).toBe('3d8');
    expect(byKey.charm.damage_type).toBe('Psychic');
    expect(byKey.charm.conditions).toEqual(['charmed']);
    expect(byKey.paralyzing.damage_dice).toBeNull();
    expect(byKey.paralyzing.ladder).toBe('paralyzed');
    expect(byKey.fear.damage_dice).toBe('3d6');
    expect(byKey.fear.damage_type).toBe('Psychic');
    expect(byKey.fear.conditions).toEqual(['frightened']);
    expect(byKey.slowing.damage_dice).toBe('4d8');
    expect(byKey.slowing.damage_type).toBe('Necrotic');
    expect(byKey.slowing.te_grants).toEqual(['speed_half', 'no_reactions', 'no_action_and_bonus_action']);
    expect(byKey.enervation.damage_dice).toBe('3d10');
    expect(byKey.enervation.damage_type).toBe('Poison');
    expect(byKey.enervation.conditions).toEqual(['poisoned']);
    expect(byKey.enervation.te_grants).toEqual(['no_healing']);
    expect(byKey.telekinetic.save_ability).toBe('Strength');
    expect(byKey.telekinetic.auto_success_size).toBe('Gargantuan');
    expect(byKey.sleep.auto_success_types).toEqual(['Construct', 'Undead']);
    expect(byKey.petrification.ladder).toBe('petrification');
    expect(byKey.disintegration.damage_dice).toBe('8d8');
    expect(byKey.disintegration.zero_hp_clause).toMatch(/dust/);
    expect(byKey.death.damage_dice).toBe('10d10');
    expect(byKey.death.zero_hp_clause).toMatch(/dies/);
  });

  it('synthesized ray row + picker rows stamp DC 17 and d10 (never the VAR shell)', () => {
    const rays = parseEyeRays(tRow);
    const act = buildEyeRayAction(tRow, rays.find(r => r.key === 'enervation'));
    expect(act.save_dc).toBe(17);
    expect(act.save_type).toBe('Constitution');
    expect(act.damage_dice_primary).toBe('3d10');
    expect(act.eyeRay.save_dc).toBe(17);
    const html = buildEyeRayPickerPopup({ monsterName: 'Death Tyrant 1', ray: rays[2], roll: 3, targetName: 'Bandit 1', die: 10, dc: 17 });
    expect(html).toMatch(/Fear Ray/);
    expect(html).toMatch(/Eye Rays d10/);
    expect(html).toMatch(/DC 17 Wisdom save/);
    const seq = rolls => () => rolls.shift();
    expect(pickEyeRay({ rays, rollDie: seq([10]) }).ray.key).toBe('death');
    const { ray, rerolls } = pickEyeRay({ rays, usedKeys: ['death'], rollDie: seq([10, 5]) });
    expect(rerolls).toEqual([10]);
    expect(ray.key).toBe('enervation');
  });
});
