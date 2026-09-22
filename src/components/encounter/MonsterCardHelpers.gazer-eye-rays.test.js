// MA-0765: Gazer "Eye Rays" launcher row — rays[] was ABSENT, so
// parseEyeRays → null, the fire gate (MonsterCardModal) never opened, and
// the row rendered zero affordance (random-two-ray adjudication impossible,
// §154/§88 fingerprint). DATA fix: author rays[] four ray dicts byte-shape
// of the Beholder-Zombie/Beholder twins (len-inferred die: 4 rays → d4) +
// row-level save_dc:12 (picker stamps row DC onto the chosen ray) +
// range:"60 ft." token. Locks: parseEyeRays non-null, picker die = len = 4,
// reroll-if-used latch, per-ray ability/dice match disk siblings, row DC 12
// stamped onto every synthesized ray row, and the manual single-fire sibling
// rows actions[2..5] stay byte-unchanged (MA-0766/0767/0768/0769 scope).
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction } from './MonsterCardHelpers.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const gazer = list.find(m => m.name === 'Gazer');
const row = gazer.actions[1];

describe('MA-0765 gazer Eye Rays launcher rays[] data', () => {
  it('launcher row is the Eye Rays row with rays[] authored', () => {
    expect(row.name).toBe('Eye Rays');
    expect(Array.isArray(row.rays)).toBe(true);
  });

  it('parseEyeRays accepts the four rays (die = len = 4)', () => {
    const rays = parseEyeRays(row);
    expect(rays).not.toBeNull();
    expect(rays).toHaveLength(4);
    expect(rays.map(r => r.key)).toEqual(['dazing', 'fear', 'frost', 'telekinetic']);
    expect(rays.map(r => r.name)).toEqual(['Dazing Ray', 'Fear Ray', 'Frost Ray', 'Telekinetic Ray']);
    expect(rays.every(r => r.aoe !== true)).toBe(true);
  });

  it('row carries save_dc 12 + range token (picker DC stamp)', () => {
    expect(row.save_dc).toBe(12);
    expect(row.range).toBe('60 ft.');
  });

  it('per-ray save abilities + dice match the disk sibling rows', () => {
    const siblings = gazer.actions.slice(2);
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.dazing.save_ability).toBe(siblings[0].save_type);
    expect(byKey.fear.save_ability).toBe(siblings[1].save_type);
    expect(byKey.frost.save_ability).toBe(siblings[2].save_type);
    expect(byKey.telekinetic.save_ability).toBe(siblings[3].save_type);
    expect(byKey.dazing.damage_dice).toBeNull();
    expect(byKey.frost.damage_dice).toBe('3d6');
    expect(byKey.frost.damage_type).toBe('Cold');
    expect(byKey.frost.damage_dice).toBe(siblings[2].damage_dice_primary);
    expect(byKey.telekinetic.damage_dice).toBeNull();
    for (const ray of parseEyeRays(row)) {
      expect(ray.save_ability).not.toMatch(/,/);
      expect(String(ray.damage_dice || '')).not.toMatch(/,/);
    }
  });

  it('condition rays grant their canonical conditions, rider te_grants registered', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.dazing.conditions).toEqual(['charmed']);
    expect(byKey.fear.conditions).toEqual(['frightened']);
    expect(byKey.frost.conditions).toEqual([]);
    expect(byKey.telekinetic.conditions).toEqual([]);
    expect(byKey.dazing.te_grants).toContain('speed_half');
    expect(byKey.telekinetic.te_grants).toContain('telekinetic_movement');
    expect(byKey.dazing.dc_success).toBe('none');
    expect(byKey.frost.dc_success).toBe('none');
  });

  it('picker die is d4: rolls 1..4 map to rays in order; used ray rerolls', () => {
    const rays = parseEyeRays(row);
    const seq = rolls => () => rolls.shift();
    for (let i = 0; i < 4; i += 1) {
      expect(pickEyeRay({ rays, rollDie: seq([i + 1]) }).ray.key).toBe(rays[i].key);
    }
    const picked = pickEyeRay({ rays, usedKeys: ['dazing', 'fear', 'telekinetic'], rollDie: seq([1, 1, 3]) });
    expect(picked.ray.key).toBe('frost');
    expect(picked.rerolls).toEqual([1, 1]);
  });

  it('buildEyeRayAction stamps the row DC 12 onto every single-target ray', () => {
    for (const ray of parseEyeRays(row)) {
      const synthesized = buildEyeRayAction(row, ray);
      expect(synthesized.save_dc).toBe(12);
      expect(synthesized.eyeRay.save_dc).toBe(12);
      expect(synthesized.save_type).toBe(ray.save_ability);
      expect(synthesized.name).toBe(`${ray.name} (Eye Rays)`);
      expect(synthesized.description).toBeNull();
      expect(synthesized.save_effect).toBeNull();
    }
  });

  it('manual sibling ray rows stay byte-unchanged (separate tickets)', () => {
    expect(gazer.actions.map(a => a.name)).toEqual(['Bite', 'Eye Rays', '1. Dazing Ray', '2. Fear Ray', '3. Frost Ray', '4. Telekinetic Ray']);
    for (const sibling of gazer.actions.slice(2)) {
      expect(sibling.rays).toBeUndefined();
    }
    expect(gazer.actions[2].save_dc).toBe(12);
    expect(gazer.actions[3].save_dc).toBe(12);
    expect(gazer.actions[4].save_dc).toBe(12);
    expect(gazer.actions[5].save_dc).toBe(12);
  });
});
