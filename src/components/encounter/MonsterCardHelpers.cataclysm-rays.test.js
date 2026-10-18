// @maintained-by-ai — MA-0673 OWNER truth-table: Elemental Cataclysm
// "Cataclysmic Event" structured rays[] → eye-rays picker seam (no pooled
// 13d6 VAR shell). Locks ONLY this lane's MA-0673 branches: buildEyeRayAction's
// aoe route (MonsterCardHelpers.js:3167), eyeRaySaveSpellInfo's spellInfo gate
// (:3187, consumer MonsterCardModal.jsx:570-572), the popup events chooser
// (:3224), the ability_use/advisory log legs (:3245/:3193) and the registered
// burning te (targetEffectDefinitions.js:172). Shared-seam owners, cited not
// re-tested: parseEyeRays validation + comma-dice rejection —
// MonsterCardHelpers.eye-rays.test.js:57-63; picker d4 die=len / reroll-if-used
// / exhaust guard (fixture-agnostic, re-pinned gazer:71-79, spectator:99-108) —
// MonsterCardHelpers.eye-rays.test.js:196-226; single-target byte-inert
// synthesis (description/save_effect null, row-DC stamp) —
// MonsterCardHelpers.gazer-eye-rays.test.js:81-91; secondary-dice transport
// reader — MonsterCardModal.ma0962-half-dragon-claw-secondary.test.js:36-43.
// Full-byte popup/log strings are intentional MA-0673 template pins (#498);
// disk fixtures cited by name (#387). No timers.
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction, eyeRaySaveSpellInfo, buildEyeRayPickerPopup, buildEyeRayAbilityUseLog, buildEyeRayAdvisoryLog } from './MonsterCardHelpers.js';
import { breathAoeShape, buildSecondaryDamageTransport } from './MonsterCardModal.jsx';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const row = list.find(m => m.name === 'Elemental Cataclysm').actions.find(a => a.name === 'Cataclysmic Event');
const beholderRow = list.find(m => m.name === 'Beholder').actions.find(a => a.name === 'Eye Rays');
const rays = parseEyeRays(row);
const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
const fear = beholderRow.rays.find(r => r.key === 'fear');

describe('MA-0673 disk fixture — Cataclysmic Event rays[] (monsters.json)', () => {
  it('four AoE events, DC 23 row, one single save leg each — no pooled VAR shell', () => {
    expect(rays.map(r => r.key)).toEqual(['clinging_flames', 'freezing_waves', 'raging_storm', 'swallowing_earth']);
    expect(rays.every(r => r.aoe === true)).toBe(true);
    expect(row.save_dc).toBe(23);
    expect(row.save_type).toBeUndefined();
    expect(row.damage_dice_primary).toBeUndefined();
    // RAW per-event damage map, byte-on-disk (parser comma-rejection owned by eye-rays.test.js:62).
    expect(rays.map(r => [r.damage_dice, r.damage_type, r.damage_dice_secondary ?? null, r.damage_type_secondary ?? null, r.save_ability, r.dc_success])).toEqual([
      ['13d6', 'Fire', null, null, 'Dexterity', 'half'],
      ['5d8', 'Bludgeoning', '5d8', 'Cold', 'Strength', 'half'],
      ['4d8', 'Lightning', '4d8', 'Thunder', 'Dexterity', 'half'],
      ['4d8', 'Bludgeoning', '4d8', 'Acid', 'Strength', 'half'],
    ]);
    expect(rays.map(r => r.conditions)).toEqual([[], ['prone'], [], ['prone', 'restrained']]);
    // die = len(rays) = 4 picker seam on THIS fixture (full picker truth table: eye-rays.test.js:196-226).
    expect(pickEyeRay({ rays, rollDie: () => 3 }).ray.key).toBe('raging_storm');
  });
});

describe('MA-0673 buildEyeRayAction aoe branch (MonsterCardHelpers.js:3167)', () => {
  it('freezing_waves: event-named row, shape note, both pools, speed_zero rider, row DC stamped onto both legs', () => {
    const act = buildEyeRayAction(row, byKey.freezing_waves);
    expect(act.name).toBe('Freezing Waves (Cataclysmic Event)');
    expect(act.save_type).toBe('Strength');
    expect(act.dc_success).toBe('half');
    expect(act.save_dc).toBe(23);
    expect(act.description).toBe('90-foot Cone');
    expect(act.save_effect).toMatch(/Speed is 0/);
    expect(act.damage_dice_primary).toBe('5d8');
    expect(act.damage_type_primary).toBe('Bludgeoning');
    expect(act.damage_dice_secondary).toBe('5d8');
    expect(act.damage_type_secondary).toBe('Cold');
    expect(act.eyeRay.save_dc).toBe(23);
    // Both pools reach the save leg (transport reader owner: ma0962:36-43).
    expect(buildSecondaryDamageTransport(act)).toMatchObject({ autoDamageSecondaryFormula: '5d8', autoDamageSecondaryDamageType: 'Cold' });
  });

  it('clinging_flames null side: shape note carried, no save_effect, no secondary keys, transport inert', () => {
    const act = buildEyeRayAction(row, byKey.clinging_flames);
    expect(act.name).toBe('Clinging Flames (Cataclysmic Event)');
    expect(act.description).toBe('60-foot-radius Sphere centered on a point the cataclysm can see within 150 feet');
    expect(act.save_effect).toBeNull();
    expect(act.damage_dice_secondary).toBeUndefined();
    expect(act.damage_type_secondary).toBeUndefined();
    expect(buildSecondaryDamageTransport(act).autoDamageSecondaryFormula).toBeNull();
  });
});

describe('MA-0673 spellInfo gate + per-event coverage shapes (MonsterCardModal.jsx:570-572)', () => {
  it('AoE rays carry spellInfo null so breathAoeShape parses each event shape; single-target keeps its spellInfo leg', () => {
    // Swallowing Earth RAW Cube renders as the largest supported Radius (90 ft)
    // — the MA-0673 accepted cube→radius residual (MonsterCardModal.jsx:107).
    const shapes = {
      clinging_flames: { shape: 'Radius', feet: 60, rangeGateFt: null },
      freezing_waves: { shape: 'Cone', feet: 90, rangeGateFt: 90 },
      raging_storm: { shape: 'Radius', feet: 60, rangeGateFt: null },
      swallowing_earth: { shape: 'Radius', feet: 90, rangeGateFt: null },
    };
    for (const ev of rays) {
      const spellInfo = eyeRaySaveSpellInfo(ev);
      expect(spellInfo).toBeNull();
      expect(breathAoeShape(buildEyeRayAction(row, ev), spellInfo)).toEqual(shapes[ev.key]);
    }
    expect(byKey.swallowing_earth.shape_note).toMatch(/Cube/);
    // Ternary's false side: single-target rays keep damage-type spellInfo → picker stays closed.
    expect(eyeRaySaveSpellInfo(fear)).toMatchObject({ damageType: fear.damage_type, dcSuccess: fear.dc_success });
    expect(breathAoeShape(buildEyeRayAction(beholderRow, fear), eyeRaySaveSpellInfo(fear))).toBeNull();
  });
});

describe('MA-0673 presentation templates + burning te', () => {
  it('popup lists the four-event chooser with picked marker (beholder popup byte-identical without events)', () => {
    const html = buildEyeRayPickerPopup({ monsterName: 'Elemental Cataclysm', ray: byKey.freezing_waves, roll: 2, targetName: 'each creature in the area', die: 4, dc: 23, events: rays });
    expect(html).toContain('at each creature in the area');
    expect(html).toContain('Eye Rays d4');
    for (const ev of rays) expect(html).toContain(ev.name);
    expect(html).toContain('mc-eye-ray-picked-event">Freezing Waves');
    expect(html).toContain('5d8 Bludgeoning + 5d8 Cold');
    expect(html).toContain('90-foot Cone');
    expect(buildEyeRayPickerPopup({ monsterName: 'Beholder', ray: fear, roll: 3, targetName: 'Grommak', die: 10, dc: 16 })).not.toContain('mc-eye-ray-chooser');
  });

  it('ability_use logs both pools + coverage (AoE) and stays byte-identical single-target; advisory records the RAW rider', () => {
    expect(buildEyeRayAbilityUseLog({ monsterName: 'Elemental Cataclysm', ray: byKey.freezing_waves, targetName: 'each creature in the area', dc: 23 }).description).toBe(
      'Elemental Cataclysm fires Freezing Waves from Eye Rays at each creature in the area in 90-foot Cone — DC 23 Strength save, 5d8 Bludgeoning + 5d8 Cold damage (half on a successful save).');
    expect(buildEyeRayAbilityUseLog({ monsterName: 'Beholder', ray: fear, targetName: 'Grommak', dc: 16 }).description).toBe(
      'Beholder fires Fear Ray from Eye Rays at Grommak — DC 16 Wisdom save, 4d6 Psychic damage (half on a successful save).');
    const advisory = buildEyeRayAdvisoryLog({ monsterName: 'Elemental Cataclysm', ray: byKey.clinging_flames, actionName: 'Cataclysmic Event' });
    expect(advisory.automationType).toBe('eye_ray_advisory');
    expect(advisory.description).toContain('starts burning on Failure OR Success');
  });

  it('burning te registered so the badge renders and GM can add it', () => {
    expect(getEffectDefinition('burning')).toMatchObject({ label: 'Burning', icon: 'fa-fire', cls: 'effect-debuff' });
  });
});
