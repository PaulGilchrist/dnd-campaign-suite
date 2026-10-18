// @maintained-by-ai — MA-0374/MA-0383/MA-0577 OWNER lane: eye-rays shared-seam
// truth tables for parseEyeRays validation, the len(rays)-sized reroll-if-used
// picker (d10 Beholder / d4 Beholder Zombie / d10 DC 17 Death Tyrant), single-
// target synthesis, auto-success, and full-byte popup/log templates (#498 pins,
// verbatim disk fixtures by name #387). Cite-skipped to sibling owners: aoe route,
// events chooser popup, advisory log, eyeRaySaveSpellInfo —
// MonsterCardHelpers.cataclysm-rays.test.js (MA-0673, owns :3167/:3187/:3193/:3224);
// gazer/spectator fixture twins — MonsterCardHelpers.gazer-eye-rays.test.js /
// MonsterCardHelpers.spectator-eye-rays.test.js. No timers.
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction, eyeRayAutoSuccessReason, buildEyeRayPickerPopup, buildEyeRayPickerRollLog, buildEyeRayAbilityUseLog, buildEyeRayAutoSuccessLog } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const beholder = list.find(m => m.name === 'Beholder');
const row = beholder.actions.find(a => a.name === 'Eye Rays');
const zombie = list.find(m => m.name === 'Beholder Zombie');
const zRow = zombie.actions.find(a => a.name === 'Eye Rays');
const tyrant = list.find(m => m.name === 'Death Tyrant');
const tRow = tyrant.actions.find(a => a.name === 'Eye Rays');

const seq = rolls => () => rolls.shift();
const BEHOLDER_KEYS = ['charm', 'paralyzing', 'fear', 'slowing', 'enervation', 'telekinetic', 'sleep', 'petrification', 'disintegration', 'death'];

describe('MA-0374 parseEyeRays — Beholder d10 row', () => {
  it('parses 10 structured rays with the RAW damage/dice/clause map, VAR shell dropped', () => {
    const rays = parseEyeRays(row);
    expect(rays.map(r => r.key)).toEqual(BEHOLDER_KEYS);
    const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
    expect(byKey.charm.damage_dice).toBe('3d8');
    expect(byKey.fear.damage_dice).toBe('4d6');
    expect(byKey.slowing.save_ability).toBe('Constitution');
    expect(byKey.slowing.damage_dice).toBe('4d8');
    expect(byKey.disintegration.damage_dice).toBe('8d8');
    expect(byKey.disintegration.zero_hp_clause).toMatch(/dust/);
    expect(byKey.death.damage_dice).toBe('10d10');
    expect(byKey.death.zero_hp_clause).toMatch(/dies/);
    expect(byKey.telekinetic.auto_success_size).toBe('Gargantuan');
    expect(byKey.sleep.auto_success_types).toEqual(['Construct', 'Undead']);
    // The pre-conversion VAR shell (save_type "Varies", multi-string dice) was
    // unparseable — rays[] is the only arm; row keeps dc + description intact.
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    expect(row.description).toMatch(/roll 1d10; reroll if the beholder has already used that ray during this turn/);
  });

  it('byte-inert: no rays / <2 rays / malformed rays parse to null; signed dice arm', () => {
    expect(parseEyeRays({ name: 'Bite' })).toBeNull();
    expect(parseEyeRays({ rays: [{ ...row.rays[0] }] })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, save_ability: 'Varies' })) })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, dc_success: 'sometimes' })) })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, damage_dice: '3d8, 4d6' })) })).toBeNull();
    expect(parseEyeRays({ rays: Array.from({ length: 10 }, (_, i) => ({ ...row.rays[0], key: `k${i}`, conditions: 'frightened' })) })).toBeNull();
    expect(parseEyeRays({ rays: [{ ...row.rays[0], damage_dice: '8d8+2' }, row.rays[1]] })).toHaveLength(2);
  });
});

describe('MA-0374 pickEyeRay d10 picker', () => {
  const rays = parseEyeRays(row);

  it('maps in-range rolls to rays in order (trunc/Number coercion included)', () => {
    expect(pickEyeRay({ rays, rollDie: seq([1]) }).ray.key).toBe('charm');
    expect(pickEyeRay({ rays, rollDie: seq([4]) }).roll).toBe(4);
    expect(pickEyeRay({ rays, rollDie: seq([10]) }).ray.key).toBe('death');
    expect(pickEyeRay({ rays, rollDie: seq(['2.9']) }).roll).toBe(2);
  });

  it('rerolls used rays recording them, rejects out-of-range silently', () => {
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: ['slowing', 'death'], rollDie: seq([0, 4, 11, 10, 7]) });
    expect(rerolls).toEqual([4, 10]);
    expect(roll).toBe(7);
    expect(ray.key).toBe('sleep');
  });
});

describe('MA-0383 Beholder Zombie — d4 row (die = len(rays))', () => {
  it('parses 4 rays with RAW map on DC 14 shell, no auto-success clauses (RAW)', () => {
    const rays = parseEyeRays(zRow);
    expect(rays.map(r => r.key)).toEqual(['paralyzing', 'fear', 'enervation', 'disintegration']);
    const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
    expect(byKey.paralyzing.damage_dice).toBeNull();
    expect(byKey.paralyzing.save_ability).toBe('Constitution');
    expect(byKey.paralyzing.dc_success).toBe('none');
    expect(byKey.paralyzing.ladder).toBe('paralyzed');
    expect(byKey.fear.damage_dice).toBe('3d8');
    expect(byKey.fear.save_ability).toBe('Wisdom');
    expect(byKey.enervation.damage_dice).toBe('3d6');
    expect(byKey.enervation.damage_type).toBe('Necrotic');
    expect(byKey.enervation.te_grants).toEqual(['no_healing']);
    expect(byKey.disintegration.damage_dice).toBe('5d10');
    expect(byKey.disintegration.damage_type).toBe('Force');
    expect(rays.some(r => r.auto_success_types || r.auto_success_size)).toBe(false);
    expect(zRow.save_dc).toBe(14);
    expect(zRow.save_type).toBeUndefined();
    expect(zRow.description).toMatch(/roll 1d4; reroll if the zombie has already used that ray during this turn/);
    expect(zRow.save_effect).toMatch(/Success on damage rays: Half damage\./);
  });

  it('d4 picker: maps 1..4 in order, rerolls used, rejects 0/5+ without recording, exhausts to null', () => {
    const rays = parseEyeRays(zRow);
    expect(pickEyeRay({ rays, rollDie: seq([1]) }).ray.key).toBe('paralyzing');
    expect(pickEyeRay({ rays, rollDie: seq([2]) }).ray.key).toBe('fear');
    expect(pickEyeRay({ rays, rollDie: seq([3]) }).ray.key).toBe('enervation');
    expect(pickEyeRay({ rays, rollDie: seq([4]) }).ray.key).toBe('disintegration');
    const { ray, roll, rerolls } = pickEyeRay({ rays, usedKeys: ['fear', 'disintegration'], rollDie: seq([0, 2, 5, 4, 1]) });
    expect(rerolls).toEqual([2, 4]);
    expect(roll).toBe(1);
    expect(ray.key).toBe('paralyzing');
    const allUsed = rays.map(r => r.key);
    expect(pickEyeRay({ rays, usedKeys: allUsed, rollDie: () => Math.floor(Math.random() * 4) + 1 }).ray).toBeNull();
  });
});

describe('MA-0374/MA-0383 synthesis + auto-success', () => {
  const rays = parseEyeRays(row);
  const zRays = parseEyeRays(zRow);

  it('single-target synthesis: row-DC stamp, parseable legs, null description/save_effect; per-monster DC (16/14)', () => {
    const slowing = rays.find(r => r.key === 'slowing');
    const act = buildEyeRayAction(row, slowing);
    expect(act.name).toBe('Slowing Ray (Eye Rays)');
    expect(act.save_dc).toBe(16);
    expect(act.save_type).toBe('Constitution');
    expect(act.dc_success).toBe('half');
    expect(act.damage_dice_primary).toBe('4d8');
    expect(act.description).toBeNull();
    expect(act.save_effect).toBeNull();
    expect(act.eyeRay).toEqual({ ...slowing, save_dc: 16 });

    const para = zRays.find(r => r.key === 'paralyzing');
    const zAct = buildEyeRayAction(zRow, para);
    expect(zAct.save_dc).toBe(14);
    expect(zAct.dc_success).toBe('none');
    expect(zAct.damage_dice_primary).toBeUndefined();
    expect(zAct.eyeRay.save_dc).toBe(14);
    expect(zAct.eyeRay.ladder).toBe('paralyzed');
  });

  it('auto-success truth table: size hit, type hit, misses, null inputs', () => {
    const tk = rays.find(r => r.key === 'telekinetic');
    const sleep = rays.find(r => r.key === 'sleep');
    expect(eyeRayAutoSuccessReason(tk, { size: 'Gargantuan' })).toBe('Gargantuan creatures succeed automatically');
    expect(eyeRayAutoSuccessReason(tk, { size: 'Medium' })).toBeNull();
    expect(eyeRayAutoSuccessReason(sleep, { monsterType: 'Construct' })).toBe('Construct creatures succeed automatically');
    expect(eyeRayAutoSuccessReason(sleep, { type: 'undead' })).toBe('Undead creatures succeed automatically');
    expect(eyeRayAutoSuccessReason(sleep, { monsterType: 'Aberration' })).toBeNull();
    expect(eyeRayAutoSuccessReason(sleep, null)).toBeNull();
    expect(eyeRayAutoSuccessReason(null, { size: 'Gargantuan' })).toBeNull();
  });
});

describe('MA-0374/MA-0383 popup + log templates (full-byte pins)', () => {
  const rays = parseEyeRays(row);
  const zRays = parseEyeRays(zRow);

  it('picker popup: beholder default d10/DC 16 and zombie d4/DC 14 with reroll history', () => {
    expect(buildEyeRayPickerPopup({ monsterName: 'Beholder 1', ray: rays[3], roll: 4, rerolls: [4, 10], targetName: 'HexWarlock' })).toBe('<div class="mc-eye-ray-picked"><h3><i class="fa-solid fa-eye"></i> Slowing Ray</h3><p>Beholder 1 rolls 4 (rerolled 4, 10 — already used this turn) on the Eye Rays d10 — <strong>Slowing Ray</strong> at HexWarlock (DC 16 Constitution save).</p></div>');
    expect(buildEyeRayPickerPopup({ monsterName: 'Beholder Zombie 1', ray: zRays.find(r => r.key === 'fear'), roll: 2, rerolls: [4], targetName: 'HexWarlock', die: 4, dc: 14 })).toBe('<div class="mc-eye-ray-picked"><h3><i class="fa-solid fa-eye"></i> Fear Ray</h3><p>Beholder Zombie 1 rolls 2 (rerolled 4 — already used this turn) on the Eye Rays d4 — <strong>Fear Ray</strong> at HexWarlock (DC 14 Wisdom save).</p></div>');
  });

  it('picker roll log: d10 default and d4, rolls/total/description exact', () => {
    const roll = buildEyeRayPickerRollLog({ monsterName: 'Beholder 1', ray: rays[6], roll: 7, rerolls: [], targetName: 'HexWarlock' });
    expect(roll).toMatchObject({
      type: 'roll',
      rollType: 'd10',
      name: 'Eye Rays (d10 ray picker)',
      rolls: [7],
      total: 7,
      targetName: 'HexWarlock',
      description: 'Beholder 1 rolled 7 on the Eye Rays d10 — Sleep Ray.',
    });
    const zRoll = buildEyeRayPickerRollLog({ monsterName: 'Beholder Zombie 1', ray: zRays.find(r => r.key === 'fear'), roll: 2, rerolls: [], targetName: 'HexWarlock', die: 4 });
    expect(zRoll.rollType).toBe('d4');
    expect(zRoll.name).toBe('Eye Rays (d4 ray picker)');
    expect(zRoll.description).toBe('Beholder Zombie 1 rolled 2 on the Eye Rays d4 — Fear Ray.');
  });

  it('ability_use log: damage leg (DC 16 default / DC 14) and no-damage condition-save leg, trailing-space quirk fixed', () => {
    expect(buildEyeRayAbilityUseLog({ monsterName: 'Beholder 1', ray: rays[0], targetName: 'HexWarlock' }).description).toBe('Beholder 1 fires Charm Ray from Eye Rays at HexWarlock — DC 16 Wisdom save, 3d8 Psychic damage (half on a successful save).');
    expect(buildEyeRayAbilityUseLog({ monsterName: 'Beholder Zombie 1', ray: zRays.find(r => r.key === 'enervation'), targetName: 'HexWarlock', dc: 14 }).description).toBe('Beholder Zombie 1 fires Enervation Ray from Eye Rays at HexWarlock — DC 14 Constitution save, 3d6 Necrotic damage (half on a successful save).');
    expect(buildEyeRayAbilityUseLog({ monsterName: 'Beholder Zombie 1', ray: zRays[0], targetName: 'HexWarlock', dc: 14 }).description).toBe('Beholder Zombie 1 fires Paralyzing Ray from Eye Rays at HexWarlock — DC 14 Constitution save — no damage, condition save.');
  });

  it('auto-success log: fields + full description', () => {
    const auto = buildEyeRayAutoSuccessLog({ monsterName: 'Beholder 1', ray: rays[6], targetName: 'IronGolem', reason: 'Construct creatures succeed automatically' });
    expect(auto.type).toBe('automation');
    expect(auto.automationType).toBe('eye_ray_auto_success');
    expect(auto.characterName).toBe('IronGolem');
    expect(auto.sourceName).toBe('Beholder 1');
    expect(auto.description).toBe('IronGolem succeeds automatically against Beholder 1\'s Sleep Ray (Construct creatures succeed automatically) — no save rolled, no effect applied.');
  });
});

describe('MA-0577 Death Tyrant — DC 17 d10 twin on the shared seam', () => {
  it('parses the same 10 keys with tyrant-specific dice (fear 3d6, enervation 3d10 Poison) and synthesis stamps DC 17', () => {
    const rays = parseEyeRays(tRow);
    expect(rays.map(r => r.key)).toEqual(BEHOLDER_KEYS);
    const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
    expect(byKey.fear.damage_dice).toBe('3d6');
    expect(byKey.enervation.damage_dice).toBe('3d10');
    expect(byKey.enervation.damage_type).toBe('Poison');
    expect(byKey.paralyzing.ladder).toBe('paralyzed');
    expect(tRow.save_dc).toBe(17);
    expect(tRow.save_type).toBeUndefined();
    const act = buildEyeRayAction(tRow, byKey.enervation);
    expect(act.save_dc).toBe(17);
    expect(act.save_type).toBe('Constitution');
    expect(act.damage_dice_primary).toBe('3d10');
    expect(act.eyeRay.save_dc).toBe(17);
  });
});
