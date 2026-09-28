// MA-1483: Spectator "Eye Rays" launcher row — rays[] was ABSENT, so
// parseEyeRays → null, the fire gate (MonsterCardModal) never opened, and
// the row rendered zero affordance (§157/§88 fingerprint, §949 rays[] twin).
// DATA fix: author rays[] four ray dicts byte-shape of the gazer MA-0765 /
// Beholder-Zombie MA-0383 twins (len-inferred die: 4 rays → d4) + row-level
// save_dc:12 + range:"90 ft." + save_effect; name/description byte-unchanged.
// Locks: parseEyeRays non-null, picker die = len = 4, reroll-if-used latch
// (eyeRaysUsed usedKeys), per-ray ability/dice/type match the disk sibling
// rows actions[3..6], row DC 12 stamped onto every synthesized ray save leg,
// the Paralyzing ladder rides the MA-0383 flat-ray twins (no
// staged_paralysis — the eye-ray ladder channel is ray.ladder), and the
// manual single-fire sibling rows stay byte-unchanged (MA-1481 scope).
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction, parseSlowedClauses } from './MonsterCardHelpers.js';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const spectator = list.find(m => m.name === 'Spectator');
const row = spectator.actions[2];
const siblings = spectator.actions.slice(3);

describe('MA-1483 spectator Eye Rays launcher rays[] data', () => {
  it('launcher row is the Eye Rays row with rays[] authored', () => {
    expect(row.name).toBe('Eye Rays');
    expect(Array.isArray(row.rays)).toBe(true);
  });

  it('parseEyeRays accepts the four rays (die = len = 4 arms the d4 picker)', () => {
    const rays = parseEyeRays(row);
    expect(rays).not.toBeNull();
    expect(rays).toHaveLength(4);
    expect(rays.map(r => r.key)).toEqual(['confusion', 'paralyzing', 'fear', 'wounding']);
    expect(rays.map(r => r.name)).toEqual(['Confusion Ray', 'Paralyzing Ray', 'Fear Ray', 'Wounding Ray']);
    expect(rays.every(r => r.aoe !== true)).toBe(true);
  });

  it('row carries save_dc 12 + range token (picker DC stamp + 90 ft range gate)', () => {
    expect(row.save_dc).toBe(12);
    expect(row.range).toBe('90 ft.');
    expect(row.description).toBe('The spectator randomly shoots one of the following magical rays at a target it can see within 90 feet of itself (roll 1d4; reroll if the spectator has already used that ray during this turn)');
  });

  it('per-ray save abilities + dice + types match the disk sibling rows byte-exact', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.confusion.save_ability).toBe(siblings[0].save_type);
    expect(byKey.paralyzing.save_ability).toBe(siblings[1].save_type);
    expect(byKey.fear.save_ability).toBe(siblings[2].save_type);
    expect(byKey.wounding.save_ability).toBe(siblings[3].save_type);
    expect(byKey.confusion.damage_dice).toBe('2d4');
    expect(byKey.confusion.damage_type).toBe('Psychic');
    expect(byKey.fear.damage_dice).toBe('2d4');
    expect(byKey.fear.damage_type).toBe('Psychic');
    expect(byKey.wounding.damage_dice).toBe('3d10');
    expect(byKey.wounding.damage_type).toBe('Necrotic');
    expect(byKey.paralyzing.damage_dice).toBeNull();
    expect(byKey.paralyzing.damage_type).toBeNull();
    for (const ray of parseEyeRays(row)) {
      expect(ray.save_ability).not.toMatch(/,/);
      expect(String(ray.damage_dice || '')).not.toMatch(/,/);
    }
  });

  it('ray save_effect prose harvested byte-from each sibling row', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.confusion.save_effect.startsWith(siblings[0].save_effect)).toBe(true);
    expect(byKey.paralyzing.save_effect).toBe(siblings[1].save_effect);
    expect(byKey.fear.save_effect.startsWith(siblings[2].save_effect)).toBe(true);
    expect(byKey.wounding.save_effect).toBe(siblings[3].save_effect);
  });

  it('conditions + te_grants per each row save_effect prose; registered te keys only', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.confusion.conditions).toEqual([]);
    expect(byKey.confusion.te_grants).toEqual(['no_reactions', 'speed_zero']);
    expect(byKey.confusion.clock_rounds).toBe(2);
    expect(byKey.paralyzing.conditions).toEqual([]);
    expect(byKey.paralyzing.ladder).toBe('paralyzed');
    expect(byKey.paralyzing.staged_paralysis).toBeUndefined();
    expect(byKey.fear.conditions).toEqual(['frightened']);
    expect(byKey.fear.clock_rounds).toBe(2);
    expect(byKey.wounding.conditions).toEqual([]);
  });

  it('dc_success per prose: failure-only rays none, Wounding half (MV-20 half-default guard)', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.confusion.dc_success).toBe('none');
    expect(siblings[0].description).not.toMatch(/half/i);
    expect(byKey.fear.dc_success).toBe('none');
    expect(siblings[2].description).not.toMatch(/half/i);
    expect(byKey.wounding.dc_success).toBe('half');
    expect(siblings[3].description).toMatch(/Success: Half damage/);
    expect(computeDamageAfterSave(16, false, byKey.wounding.dc_success)).toBe(16);
    expect(computeDamageAfterSave(16, true, byKey.wounding.dc_success)).toBe(8);
    expect(computeDamageAfterSave(9, true, byKey.fear.dc_success)).toBe(0);
  });

  it('picker die is d4: rolls 1..4 map to rays in order; used ray rerolls (eyeRaysUsed latch)', () => {
    const rays = parseEyeRays(row);
    const seq = rolls => () => rolls.shift();
    for (let i = 0; i < 4; i += 1) {
      expect(pickEyeRay({ rays, rollDie: seq([i + 1]) }).ray.key).toBe(rays[i].key);
    }
    const picked = pickEyeRay({ rays, usedKeys: ['confusion', 'fear', 'wounding'], rollDie: seq([1, 3, 2]) });
    expect(picked.ray.key).toBe('paralyzing');
    expect(picked.rerolls).toEqual([1, 3]);
    const allUsed = rays.map(r => r.key);
    expect(pickEyeRay({ rays, usedKeys: allUsed, rollDie: () => Math.floor(Math.random() * 4) + 1 }).ray).toBeNull();
  });

  it('buildEyeRayAction stamps the row DC 12 onto every synthesized ray save leg', () => {
    for (const ray of parseEyeRays(row)) {
      const synthesized = buildEyeRayAction(row, ray);
      expect(synthesized.save_dc).toBe(12);
      expect(synthesized.eyeRay.save_dc).toBe(12);
      expect(synthesized.save_type).toBe(ray.save_ability);
      expect(synthesized.dc_success).toBe(ray.dc_success);
      expect(synthesized.name).toBe(`${ray.name} (Eye Rays)`);
      expect(synthesized.description).toBeNull();
      expect(synthesized.save_effect).toBeNull();
    }
    expect(buildEyeRayAction(row, row.rays[1]).eyeRay.ladder).toBe('paralyzed');
    expect(buildEyeRayAction(row, row.rays[3]).damage_dice_primary).toBe('3d10');
    expect(buildEyeRayAction(row, row.rays[3]).damage_type_primary).toBe('Necrotic');
  });

  it('manual sibling ray rows stay byte-unchanged (MA-1481 verified chips)', () => {
    expect(spectator.actions.map(a => a.name)).toEqual(['Multiattack', 'Bite', 'Eye Rays', 'Confusion Ray', 'Paralyzing Ray', 'Fear Ray', 'Wounding Ray']);
    for (const sibling of siblings) {
      expect(sibling.rays).toBeUndefined();
      expect(sibling.save_dc).toBe(12);
    }
    expect(siblings[0].save_type).toBe('Wisdom');
    expect(siblings[1].save_type).toBe('Constitution');
    expect(siblings[2].save_type).toBe('Wisdom');
    expect(siblings[3].save_type).toBe('Constitution');
  });
});

// MA-1484: manual "Confusion Ray" row (actions[3]) RAW pays ZERO on a
// successful save ("Wisdom Saving Throw: DC 12. Failure: 5 (2d4)..." — no
// success-pays clause). dc_success was ABSENT → getSaveDcSuccess default
// 'half' (MonsterCardModal :268/:1128) leaked half Psychic on success
// (§63/§129 MV-20 family: MA-0481/0622/0768/0781/0868) — live ledger:
// nat17 sum4→fd2, nat19 sum6→fd3. DATA fix: dc_success:"none" after
// save_effect (gazer MA-0768 Frost Ray byte-shape), consistent with the
// MA-1483 launcher rays[0] which already carries 'none'. The FAIL-side
// no_reactions te rides parseSlowedClauses on save_effect grants at
// saveProcessing :333/:480 regardless of dc_success (§63 trap-check).
describe('MA-1484 spectator "Confusion Ray" dc_success none — zero damage on save success', () => {
  const confusion = spectator.actions[3];

  it('row is the Confusion Ray save row', () => {
    expect(confusion.name).toBe('Confusion Ray');
    expect(confusion.save_dc).toBe(12);
    expect(confusion.save_type).toBe('Wisdom');
  });

  it('canonical prose carries NO half-on-success clause', () => {
    expect(confusion.description).not.toMatch(/half/i);
    expect(confusion.save_effect).not.toMatch(/half/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(confusion.dc_success).toBe('none');
  });

  it('launcher rays[0] Confusion stays consistent dc_success "none" (MA-1483 twin)', () => {
    expect(parseEyeRays(row)[0].key).toBe('confusion');
    expect(parseEyeRays(row)[0].dc_success).toBe('none');
  });

  it('dc_success "none" does not suppress the FAIL-side slowed-clause transport', () => {
    expect(parseSlowedClauses(confusion.save_effect)).toEqual({ effects: ['no_reactions'] });
  });

  it('save seam pays full 2d4 on fail, zero on success', () => {
    expect(computeDamageAfterSave(7, false, confusion.dc_success)).toBe(7);
    expect(computeDamageAfterSave(2, false, confusion.dc_success)).toBe(2);
    expect(computeDamageAfterSave(4, true, confusion.dc_success)).toBe(0);
    expect(computeDamageAfterSave(6, true, confusion.dc_success)).toBe(0);
  });
});
