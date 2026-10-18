// @maintained-by-ai — trimmed 2026-10-18: spectator BY-name gaze-row fingerprint +
// gate discrimination only; generic parse/picker/synthesis/compute cite-skipped to
// owners (eye-rays, gazer-eye-rays, slowed-clauses, saveProcessing.eye-rays,
// applyDamage.helpers). See lane canon header below for citations.
// MA-1483: Spectator "Eye Rays" launcher row — rays[] was ABSENT, so parseEyeRays
// → null, the fire gate (MonsterCardModal.jsx:530) never opened and the row rendered
// zero affordance (§157/§88 fingerprint, §949 rays[] twin). DATA fix: author rays[]
// four ray dicts byte-shape of the gazer MA-0765 / Beholder-Zombie MA-0383 twins
// (len-inferred die: 4 rays → d4) + row-level save_dc:12 + range:"90 ft." +
// save_effect; name/description byte-unchanged. MA-1484/MA-1486: manual
// "Confusion Ray"/"Fear Ray" rows RAW-pay ZERO on a successful save (no
// success-pays clause) — dc_success ABSENT → getSaveDcSuccess default 'half'
// (MonsterCardModal :268/:1128) leaked half Psychic on success (§63/§129 MV-20
// family: MA-0481/0622/0768/0781/0868); DATA fix: dc_success:"none" (gazer MA-0768
// Frost Ray byte-shape), consistent with launcher rays[0]/rays[2].
// Lane canon: pins ONLY the spectator BY-name disk fingerprint (#387) + gate
// discriminators (exactly Wounding pays half; d4 die rejects roll 5 — not d10) +
// disk-driven seam outcomes. Cite-skip owners: parseEyeRays validation truth tables
// incl. comma/multi-string guards (MonsterCardHelpers.eye-rays.test.js:48-56,
// source :3110-3111 — non-null above proves clean), picker order/reroll-if-used/
// exhaustion d4 twin (:100-112), synthesis DC stamp + null desc/save_effect legs +
// ladder pass-through (:119-138); row DC 12 stamp, save_effect-bearing ray builds
// null-leg and sibling-scope shape (MonsterCardHelpers.gazer-eye-rays.test.js:62-83);
// generic computeDamageAfterSave half/none semantics (applyDamage.helpers.test.js:86-102
// — disk-driven seam stays). REC #562: confusion save_effect FAIL-side no_reactions —
// parseSlowedClauses never reads dc_success so 'none' cannot suppress the grant;
// single-clause parse pinned by owner MonsterCardHelpers.slowed-clauses.test.js:30,
// saveProcessing grant rides saveProcessing.eye-rays.test.js. Frightened grant: prose
// fingerprint is the launcher fear conditions leg; extraction consumed fail-only at
// applyFailedSaveConditions (dc_success never gates condition grants).
// #554/#555/#499/#505 cuts. No timers.
import { describe, it, expect } from 'vitest';
import { parseEyeRays, pickEyeRay } from './MonsterCardHelpers.js';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import monsters from '../../../public/data/monsters.json';

const list = Array.isArray(monsters) ? monsters : monsters.monsters;
const spectator = list.find(m => m.name === 'Spectator');
const row = spectator.actions.find(a => a.name === 'Eye Rays');
const confusion = spectator.actions.find(a => a.name === 'Confusion Ray');
const fear = spectator.actions.find(a => a.name === 'Fear Ray');

describe('MA-1483 spectator Eye Rays launcher rays[] data', () => {
  it('BY-name fingerprint: four rays arm parseEyeRays on the DC 12 / 90 ft. d4 reroll-if-used row', () => {
    expect(row.save_dc).toBe(12);
    expect(row.range).toBe('90 ft.');
    expect(row.description).toBe('The spectator randomly shoots one of the following magical rays at a target it can see within 90 feet of itself (roll 1d4; reroll if the spectator has already used that ray during this turn)');
    const rays = parseEyeRays(row);
    expect(rays).not.toBeNull();
    expect(rays).toHaveLength(4);
    const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
    expect(Object.keys(byKey).sort()).toEqual(['confusion', 'fear', 'paralyzing', 'wounding']);
    // Route selection: all single-target — buildEyeRayAction keeps the null
    // desc/save_effect leg (owner + gazer :62-76), never the cataclysm AoE route.
    expect(rays.every(r => r.aoe !== true)).toBe(true);
    // die = len(rays) = 4: the d10 fallback roll is rejected on this row.
    expect(pickEyeRay({ rays, rollDie: () => 5 }).ray).toBeNull();
    // MA-1481/1484/1486 scope: manual single-fire sibling rows stay save rows.
    expect(spectator.actions.filter(a => a.name.endsWith('Ray')).every(a => a.rays === undefined)).toBe(true);
  });

  it('per-ray save/dice/type + harvested save_effect match the disk sibling rows byte-exact', () => {
    const siblings = Object.fromEntries(['Confusion Ray', 'Paralyzing Ray', 'Fear Ray', 'Wounding Ray'].map(n => [n, spectator.actions.find(a => a.name === n)]));
    const byKey = Object.fromEntries(parseEyeRays(row).map(r => [r.key, r]));
    expect(byKey.confusion.save_ability).toBe(siblings['Confusion Ray'].save_type);
    expect(byKey.paralyzing.save_ability).toBe(siblings['Paralyzing Ray'].save_type);
    expect(byKey.fear.save_ability).toBe(siblings['Fear Ray'].save_type);
    expect(byKey.wounding.save_ability).toBe(siblings['Wounding Ray'].save_type);
    expect([byKey.confusion.damage_dice, byKey.confusion.damage_type]).toEqual(['2d4', 'Psychic']);
    expect([byKey.fear.damage_dice, byKey.fear.damage_type]).toEqual(['2d4', 'Psychic']);
    expect([byKey.wounding.damage_dice, byKey.wounding.damage_type]).toEqual(['3d10', 'Necrotic']);
    expect([byKey.paralyzing.damage_dice, byKey.paralyzing.damage_type]).toEqual([null, null]);
    expect(byKey.confusion.save_effect.startsWith(siblings['Confusion Ray'].save_effect)).toBe(true);
    expect(byKey.fear.save_effect.startsWith(siblings['Fear Ray'].save_effect)).toBe(true);
    expect(byKey.paralyzing.save_effect).toBe(siblings['Paralyzing Ray'].save_effect);
    expect(byKey.wounding.save_effect).toBe(siblings['Wounding Ray'].save_effect);
  });

  it('extractor outcomes + dc_success gate discrimination: exactly Wounding pays half', () => {
    const rays = parseEyeRays(row);
    const byKey = Object.fromEntries(rays.map(r => [r.key, r]));
    expect(rays.filter(r => r.dc_success !== 'none').map(r => r.key)).toEqual(['wounding']);
    expect(byKey.confusion.te_grants).toEqual(['no_reactions', 'speed_zero']);
    expect(byKey.confusion.clock_rounds).toBe(2);
    expect(byKey.fear.conditions).toEqual(['frightened']);
    expect(byKey.fear.clock_rounds).toBe(2);
    expect(byKey.paralyzing.conditions).toEqual([]);
    expect(byKey.paralyzing.ladder).toBe('paralyzed');
    expect(byKey.paralyzing.staged_paralysis).toBeUndefined();
    expect(byKey.wounding.conditions).toEqual([]);
    expect(computeDamageAfterSave(16, false, byKey.wounding.dc_success)).toBe(16);
    expect(computeDamageAfterSave(16, true, byKey.wounding.dc_success)).toBe(8);
  });
});

describe('MA-1484 spectator "Confusion Ray" dc_success none — zero damage on save success', () => {
  it('dc_success authored "none", prose carries no half-clause, disk-driven seam pays full/zero', () => {
    expect(confusion.save_dc).toBe(12);
    expect(confusion.save_type).toBe('Wisdom');
    expect(confusion.dc_success).toBe('none');
    expect(confusion.description).not.toMatch(/half/i);
    expect(confusion.save_effect).not.toMatch(/half/i);
    expect(computeDamageAfterSave(7, false, confusion.dc_success)).toBe(7);
    expect(computeDamageAfterSave(7, true, confusion.dc_success)).toBe(0);
  });
  // FAIL-side no_reactions te (REC #562): parseSlowedClauses never inspects
  // dc_success — cite owner slowed-clauses.test.js:30 + saveProcessing.eye-rays
  // grant; launcher rays[0] twin pinned by the dc_success discrimination above.
});

describe('MA-1486 spectator "Fear Ray" dc_success none — zero damage on save success', () => {
  it('dc_success authored "none", prose carries no half-clause, disk-driven seam pays full/zero', () => {
    expect(fear.save_dc).toBe(12);
    expect(fear.save_type).toBe('Wisdom');
    expect(fear.dc_success).toBe('none');
    expect(fear.description).not.toMatch(/half/i);
    expect(fear.save_effect).not.toMatch(/half/i);
    expect(computeDamageAfterSave(7, false, fear.dc_success)).toBe(7);
    expect(computeDamageAfterSave(7, true, fear.dc_success)).toBe(0);
  });
  // FAIL-side Frightened grant: prose fingerprint pinned by the launcher fear
  // conditions leg; extraction is fail-only at applyFailedSaveConditions —
  // dc_success never gates condition grants.
});
