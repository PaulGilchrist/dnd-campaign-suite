// @maintained-by-ai — MA-0765/MA-0768 gazer FIXTURE lane: Gazer "Eye Rays"
// launcher rays[] was ABSENT (parseEyeRays → null, fire gate never opened,
// zero affordance, §154/§88 fingerprint). Pins only the gazer-distinct map:
// ray set dazing/fear/frost/telekinetic, die = len(rays) = 4 vs owner d10,
// row DC 12 + "60 ft." + random-two prose, EVERY ray dc_success "none"
// (beholder half-ray RAW does NOT apply — MA-0481/0622/0768/0781 half-default
// family), disk sibling rows actions[2..5] byte-pinned unchanged (MA-0766/
// 0767/0769 scope — sole lane). Cite-skipped to owner canonical
// MonsterCardHelpers.eye-rays.test.js (#506: generic parse validation incl.
// comma/multi-string guards :3110-3111, picker order/reroll-if-used/
// out-of-range, synthesis stamps, auto-success, popup/log templates);
// AoE route — cataclysm-rays lane; d4 twin — spectator-eye-rays.test.js.
// Fixtures by name (#387). Generic computeDamageAfterSave 'none' semantics —
// terrifying-presence-dracolich lane :150-154; only the disk-driven seam stays.
// No timers.
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction } from './MonsterCardHelpers.js';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const gazer = list.find(m => m.name === 'Gazer');
const row = gazer.actions.find(a => a.name === 'Eye Rays');
const manual = gazer.actions.filter(a => /^\d\. /.test(a.name));

describe('MA-0765 gazer Eye Rays launcher rays[] data', () => {
  it('parseEyeRays arms the launcher: gazer four-ray set, all dc_success "none", DC 12 + 60 ft. row', () => {
    const rays = parseEyeRays(row);
    expect(rays).not.toBeNull();
    expect(rays.map(r => r.key)).toEqual(['dazing', 'fear', 'frost', 'telekinetic']);
    expect(rays.map(r => r.name)).toEqual(['Dazing Ray', 'Fear Ray', 'Frost Ray', 'Telekinetic Ray']);
    expect(rays.map(r => r.dc_success)).toEqual(['none', 'none', 'none', 'none']);
    expect(rays.map(r => r.conditions)).toEqual([['charmed'], ['frightened'], [], []]);
    expect(row.save_dc).toBe(12);
    expect(row.range).toBe('60 ft.');
    expect(row.description).toBe('The gazer shoots two of the following magical eye rays at random (reroll duplicates), choosing one or two targets it can see within 60 feet of it:');
  });

  it('per-ray ability/dice/type gazer map matches disk siblings; rider te_grants registered', () => {
    // Comma/multi-string hygiene is structural: parseEyeRays returns null on
    // any non-enum save_ability or non-single dice (MonsterCardHelpers.js
    // :3110-3111, owner-invalidated :48-56) — non-null above proves clean.
    const rays = parseEyeRays(row);
    expect(rays.map(r => [r.save_ability, r.damage_dice, r.damage_type])).toEqual([
      ['Wisdom', null, null], ['Wisdom', null, null], ['Dexterity', '3d6', 'Cold'], ['Strength', null, null],
    ]);
    expect(rays.map(r => r.save_ability)).toEqual(manual.map(s => s.save_type));
    const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
    expect(byKey.dazing.te_grants).toEqual(['speed_half']);
    expect(byKey.telekinetic.te_grants).toEqual(['telekinetic_movement']);
  });

  it('picker die seam is gazer len 4: roll 4 lands Telekinetic Ray, roll 5 is rejected (not d10)', () => {
    // Generic picker order/reroll-if-used/out-of-range recording is owner
    // canonical (eye-rays.test.js :59-75/:100-112) — cite-skipped; only the
    // die-size distinctness of THIS fixture is pinned here.
    const rays = parseEyeRays(row);
    expect(pickEyeRay({ rays, rollDie: () => 4 }).ray.key).toBe('telekinetic');
    expect(pickEyeRay({ rays, rollDie: () => 5 }).ray).toBeNull();
  });

  it('buildEyeRayAction stamps row DC 12 + zero-on-success onto the synthesized frost leg', () => {
    const frostRay = parseEyeRays(row).find(r => r.key === 'frost');
    const act = buildEyeRayAction(row, frostRay);
    expect(act.name).toBe('Frost Ray (Eye Rays)');
    expect(act.save_dc).toBe(12);
    expect(act.eyeRay.save_dc).toBe(12);
    expect(act.save_type).toBe('Dexterity');
    expect(act.dc_success).toBe('none');
    expect(act.damage_dice_primary).toBe('3d6');
    expect(act.damage_type_primary).toBe('Cold');
    // Single-target leg: null description/save_effect even though the ray
    // dict carries save_effect prose (AoE would route cataclysm, #0673).
    expect(act.description).toBeNull();
    expect(act.save_effect).toBeNull();
  });

  it('manual sibling ray rows stay byte-unchanged (MA-0766/0767/0769 scope)', () => {
    expect(gazer.actions.map(a => a.name)).toEqual(['Bite', 'Eye Rays', '1. Dazing Ray', '2. Fear Ray', '3. Frost Ray', '4. Telekinetic Ray']);
    expect(manual.map(s => s.save_dc)).toEqual([12, 12, 12, 12]);
    expect(manual.map(s => s.save_type)).toEqual(['Wisdom', 'Wisdom', 'Dexterity', 'Strength']);
    expect(manual.every(s => s.rays === undefined)).toBe(true);
  });
});

// MA-0768: "3. Frost Ray" RAW pays ZERO on a successful save ("...or take 10
// (3d6) cold damage" — no half-on-success clause). dc_success was ABSENT →
// consumer default-half leak (§63/§126/§252 family). Launcher rays[2] twin
// stays consistent — pinned by the all-rays dc_success map above.
describe('MA-0768 gazer "3. Frost Ray" dc_success none — zero damage on save success', () => {
  const frost = gazer.actions.find(a => a.name === '3. Frost Ray');

  it('dc_success authored "none", prose carries no half-clause, disk-driven seam pays full/zero', () => {
    expect(frost.name).toBe('3. Frost Ray');
    expect(frost.save_dc).toBe(12);
    expect(frost.save_type).toBe('Dexterity');
    expect(frost.damage_dice_primary).toBe('3d6');
    expect(frost.dc_success).toBe('none');
    expect(frost.description).not.toMatch(/half/i);
    expect(frost.save_effect).not.toMatch(/half/i);
    expect(computeDamageAfterSave(12, false, frost.dc_success)).toBe(12);
    expect(computeDamageAfterSave(12, true, frost.dc_success)).toBe(0);
  });
});
