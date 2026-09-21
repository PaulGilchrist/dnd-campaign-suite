// MA-0673: Elemental Cataclysm "Cataclysmic Event" — structured rays[] on
// actions[2] so the d4 variant chooser resolves one event per fire and each
// event adjudicates its OWN ability/DC/dice/shape through the verified
// eye-rays → picker seam (no pooled 13d6 VAR shell). Locks: parseEyeRays
// accepts the AoE rays, pickEyeRay die = len(rays) = 4, buildEyeRayAction's
// aoe branch carries shape/secondary/save_effect while staying byte-inert on
// beholder rays, breathAoeShape parses each event's coverage, secondary
// transport carries both pools, burning te is registered, popup lists the four
// events.
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay, buildEyeRayAction, buildEyeRayPickerPopup, buildEyeRayAbilityUseLog } from './MonsterCardHelpers.js';
import { breathAoeShape, buildSecondaryDamageTransport } from './MonsterCardModal.jsx';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const cataclysm = list.find(m => m.name === 'Elemental Cataclysm');
const row = cataclysm.actions.find(a => a.name === 'Cataclysmic Event');
const beholder = list.find(m => m.name === 'Beholder');
const beholderRow = beholder.actions.find(a => a.name === 'Eye Rays');

describe('MA-0673 cataclysm rays[] data', () => {
  it('parseEyeRays accepts the four AoE events (die = len = 4)', () => {
    const rays = parseEyeRays(row);
    expect(rays).toHaveLength(4);
    expect(rays.map(r => r.key)).toEqual(['clinging_flames', 'freezing_waves', 'raging_storm', 'swallowing_earth']);
    expect(rays.every(r => r.aoe === true)).toBe(true);
  });

  it('row drops the "See description" shell; keeps DC 23 byte-unchanged', () => {
    expect(row.save_type).toBeUndefined();
    expect(row.save_dc).toBe(23);
    expect(row.damage_dice_primary).toBeUndefined();
  });

  it('every event carries its own single save leg (no pooled formula)', () => {
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.clinging_flames.damage_dice).toBe('13d6');
    expect(byKey.clinging_flames.damage_type).toBe('Fire');
    expect(byKey.freezing_waves.damage_dice).toBe('5d8');
    expect(byKey.freezing_waves.damage_dice_secondary).toBe('5d8');
    expect(byKey.raging_storm.damage_dice_secondary).toBe('4d8');
    expect(byKey.swallowing_earth.damage_dice).toBe('4d8');
    // No event ever pools all four events' dice together.
    for (const ray of parseEyeRays(row)) {
      expect(ray.damage_dice).not.toMatch(/,/);
    }
  });
});

describe('MA-0673 d4 chooser', () => {
  const rays = parseEyeRays(row);
  const seq = rolls => () => rolls.shift();

  it('rolls 1..4 map to events in order', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(pickEyeRay({ rays, rollDie: seq([i + 1]) }).ray.key).toBe(rays[i].key);
    }
  });

  it('rerolls a used event (die = len = 4)', () => {
    const { ray, rerolls } = pickEyeRay({ rays, usedKeys: ['clinging_flames'], rollDie: seq([1, 3]) });
    expect(ray.key).toBe('raging_storm');
    expect(rerolls).toEqual([1]);
  });
});

describe('MA-0673 buildEyeRayAction aoe synthesis', () => {
  const rays = parseEyeRays(row);
  const byKey = Object.fromEntries(rays.map(r => [r.key, r]));

  it('names the event after its parent row (not a generic shell)', () => {
    expect(buildEyeRayAction(row, byKey.clinging_flames).name).toBe('Clinging Flames (Cataclysmic Event)');
  });

  it('carries per-event shape note so breathAoeShape parses coverage', () => {
    expect(buildEyeRayAction(row, byKey.freezing_waves).description).toBe('90-foot Cone');
    expect(buildEyeRayAction(row, byKey.swallowing_earth).description).toBe('90-foot-radius Cube');
  });

  it('carries both damage pools for two-pool events', () => {
    const act = buildEyeRayAction(row, byKey.raging_storm);
    expect(act.damage_dice_primary).toBe('4d8');
    expect(act.damage_type_primary).toBe('Lightning');
    expect(act.damage_dice_secondary).toBe('4d8');
    expect(act.damage_type_secondary).toBe('Thunder');
  });

  it('forwards save_effect only where authored (event 2 grants speed_zero)', () => {
    expect(buildEyeRayAction(row, byKey.freezing_waves).save_effect).toMatch(/Speed is 0/i);
    expect(buildEyeRayAction(row, byKey.raging_storm).save_effect).toBeNull();
  });

  it('save_type/dc come from the event, DC stamped from the row', () => {
    const act = buildEyeRayAction(row, byKey.freezing_waves);
    expect(act.save_type).toBe('Strength');
    expect(act.dc_success).toBe('half');
    expect(act.save_dc).toBe(23);
  });
});

describe('MA-0673 buildEyeRayAction stays byte-inert on beholder rays', () => {
  const slowing = beholderRow.rays.find(r => r.key === 'slowing');

  it('single-target ray keeps null description/save_effect and no secondary keys', () => {
    const act = buildEyeRayAction(beholderRow, slowing);
    expect(act.name).toBe('Slowing Ray (Eye Rays)');
    expect(act.description).toBeNull();
    expect(act.save_effect).toBeNull();
    expect(act.damage_dice_secondary).toBeUndefined();
    expect(act.damage_type_secondary).toBeUndefined();
  });
});

describe('MA-0673 per-event coverage parses in the picker', () => {
  const rays = parseEyeRays(row);
  const byKey = Object.fromEntries(rays.map(r => [r.key, r]));

  it('spellInfo must be null or the picker never opens (documented intent)', () => {
    const act = buildEyeRayAction(row, byKey.freezing_waves);
    expect(breathAoeShape(act, { damageType: 'Cold' })).toBeNull();
    const shape = breathAoeShape(act, null);
    expect(shape).toEqual({ shape: 'Cone', feet: 90, rangeGateFt: 90 });
  });

  it('sphere events resolve to a point-centered Radius picker', () => {
    expect(breathAoeShape(buildEyeRayAction(row, byKey.clinging_flames), null)).toMatchObject({ shape: 'Radius', feet: 60 });
    expect(breathAoeShape(buildEyeRayAction(row, byKey.raging_storm), null)).toMatchObject({ shape: 'Radius', feet: 60 });
  });

  it('Cube event renders as the largest supported shape (90-ft radius, advisory)', () => {
    expect(breathAoeShape(buildEyeRayAction(row, byKey.swallowing_earth), null)).toMatchObject({ shape: 'Radius', feet: 90 });
    expect(byKey.swallowing_earth.advisory).toMatch(/Cube/);
  });

  it('secondary transport carries both pools for two-pool events', () => {
    const t = buildSecondaryDamageTransport(buildEyeRayAction(row, byKey.freezing_waves));
    expect(t.autoDamageSecondaryFormula).toBe('5d8');
    expect(t.autoDamageSecondaryDamageType).toMatch(/Cold/);
    // Single-pool event has no secondary.
    expect(buildSecondaryDamageTransport(buildEyeRayAction(row, byKey.clinging_flames)).autoDamageSecondaryFormula).toBeNull();
  });
});

describe('MA-0673 burning te registration', () => {
  it('burning is registered so the badge renders and GM can add it', () => {
    const def = getEffectDefinition('burning');
    expect(def).toBeDefined();
    expect(def.icon).toMatch(/^fa-/);
    expect(def.cls).toMatch(/^effect-/);
  });
});

describe('MA-0673 picker popup lists the four-event chooser', () => {
  const rays = parseEyeRays(row);

  it('shows every event name beside the picked event', () => {
    const html = buildEyeRayPickerPopup({ monsterName: 'Elemental Cataclysm', ray: rays[1], roll: 2, targetName: 'each creature in the area', die: 4, dc: 23, events: rays });
    for (const ev of rays) expect(html).toContain(ev.name);
    expect(html).toContain('Cone');
  });

  it('beholder popup stays byte-identical without an events list', () => {
    const ray = beholderRow.rays.find(r => r.key === 'fear');
    const html = buildEyeRayPickerPopup({ monsterName: 'Beholder', ray, roll: 3, targetName: 'Grommak', die: 10, dc: 16 });
    expect(html).not.toContain('mc-eye-ray-chooser');
    expect(html).toContain('at Grommak');
  });

  it('ability_use log names both pools + coverage for AoE, byte-inert for single-target', () => {
    const freezing = rays.find(r => r.key === 'freezing_waves');
    const log = buildEyeRayAbilityUseLog({ monsterName: 'Elemental Cataclysm', ray: freezing, targetName: 'each creature in the area', dc: 23 });
    expect(log.description).toContain('5d8 Bludgeoning + 5d8 Cold');
    expect(log.description).toContain('90-foot Cone');
    const fear = beholderRow.rays.find(r => r.key === 'fear');
    expect(buildEyeRayAbilityUseLog({ monsterName: 'Beholder', ray: fear, targetName: 'Grommak', dc: 16 }).description).toBe(
      'Beholder fires Fear Ray from Eye Rays at Grommak — DC 16 Wisdom save, 4d6 Psychic damage (half on a successful save).'
    );
  });
});
