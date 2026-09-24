// MA-1000: Homunculus Bite — the save leg gates a CONDITION rider only
// ("Failure: Poisoned … Failure by 5 or more: Poisoned … While Poisoned, …
// Unconscious, which ends early if the target takes any damage"), but the
// MA-0560 rider-only discriminator keyed on the BARE word "damage": the RAW
// termination clause "ends early if the target takes any damage" false-matched
// → riderOnly=false → saveChipPlan.clickable=false (composite attack_bonus 4)
// → the DC 12 CON chip was inert cosmetics, zero adjudication (MA-0551
// attack fork nulls saveDc/saveType too — no seam ever saw the save).
// Fix (code): key on damage-BEARING evidence — rollable dice PAIRED with the
// damage word — not the bare word. Fix (data): author the MA-0639/0642
// byte-shape structured save_margin so the fail-by-5+ band rides the LIVE
// applySaveMarginRider, and rework save_effect to the shallow-band-only word
// layout (twin "Failure: be poisoned for 1 hour.") so
// extractConditionsFromSaveEffect can never over-grant Unconscious on a
// shallow fail (§214 discriminator). Wake-on-damage early-end is a §70
// advisory note (no consumer app-wide) — adjudicated GM-side, never a defect.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { saveLegIsConditionRider, saveChipPlan, buildSaveOptions, isCompositeAttackSaveRow } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect, parseSaveMarginClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const homunculus = () => monsters.find((m) => m.name === 'Homunculus');
const BITE = () => homunculus().actions[0];

// Pre-fix RAW save_effect byte-repro (inert-chip fingerprint): carries the
// termination clause with the bare word "damage" and NO damage pool.
const PRE_FIX_SAVE_EFFECT = 'Failure: The target has the Poisoned condition until the end of the homunculus\'s next turn. Failure by 5 or more: The target has the Poisoned condition for 1 minute. While Poisoned, the target has the Unconscious condition, which ends early if the target takes any damage.';

describe('MA-1000 guard: termination-clause prose arms the rider, damage pools never do', () => {
  it('"ends early if the target takes any damage" prose stays a clickable condition rider', () => {
    const row = {
      name: 'Bite', attack_bonus: 4, save_dc: 12, save_type: 'Constitution',
      damage_dice_primary: '1', damage_type_primary: 'Piercing',
      save_effect: PRE_FIX_SAVE_EFFECT,
    };
    expect(isCompositeAttackSaveRow(row)).toBe(true);
    expect(/\bdamage\b/i.test(row.save_effect)).toBe(true); // the old bare-word false-match
    expect(saveLegIsConditionRider(row)).toBe(true);
    const plan = saveChipPlan(row, false);
    expect(plan.riderOnly).toBe(true);
    expect(plan.formula).toBeNull(); // zero save-leg damage (attack chip pays flat 1 Piercing)
    expect(plan.clickable).toBe(true);
  });

  it('genuine damage-pool save legs stay NON-rider byte-identical (dice + damage word)', () => {
    // Salamander/Marilith save-effect dice family
    expect(saveLegIsConditionRider({
      name: 'Constrict', attack_bonus: 0, save_dc: 15, save_type: 'Strength',
      save_effect: 'Failure: 11 (2d6 + 4) Bludgeoning damage plus 7 (2d6) Fire damage. The target has the Grappled condition (escape DC 14).',
    })).toBe(false);
    expect(saveLegIsConditionRider({
      name: 'Constrict', attack_bonus: 4, save_dc: 12, save_type: 'Strength',
      save_effect: 'Failure: the target takes 3 (1d6) Piercing damage and is Poisoned.',
      damage_dice_secondary: '1d6',
    })).toBe(false);
    // MA-0551 Dao secondary fork already excluded upstream by saveLegCarriesSecondaryDamage
    expect(saveLegIsConditionRider({
      name: 'Earth Burst', attack_bonus: 10, save_dc: 16, save_type: 'Dexterity',
      save_effect: 'Failure: 10 (3d6) Thunder damage.',
      damage_dice_secondary: '3d6',
    })).toBe(false);
  });

  it('MA-0560 Death Dog rider stays byte-inert: (1d10) HP-max ladder carries dice but NO damage word', () => {
    expect(saveLegIsConditionRider({
      name: 'Bite', attack_bonus: 4, save_dc: 12, save_type: 'Constitution',
      save_effect: 'First Failure: The target has the Poisoned condition. While Poisoned, the target\'s Hit Point maximum doesn\'t return to normal when finishing a Long Rest, and it repeats the save every 24 hours that elapse, ending the effect on itself on a success. Subsequent Failures: The Poisoned target\'s Hit Point maximum decreases by 5 (1d10).',
      damage_dice_primary: '1d4 + 2',
    })).toBe(true);
  });

  it('MA-0639/0642 verified twins unchanged: clean save_effect stays rider', () => {
    expect(saveLegIsConditionRider({
      name: 'Hand Crossbow', attack_bonus: 7, save_dc: 13, save_type: 'Constitution',
      save_effect: 'Failure: be poisoned for 1 hour.',
    })).toBe(true);
    // MA-1039 verified row: "until it takes damage" termination clause —
    // plan-level outcome identical (attack_bonus 0 was already clickable).
    expect(saveLegIsConditionRider({
      name: 'Sleep Gaze', attack_bonus: 0, save_dc: 10, save_type: 'Wisdom',
      save_effect: 'Failure: The target has the Unconscious condition for 10 minutes or until it takes damage or a creature within 5 feet of it takes an action to wake it. Success: The target is immune to this jackalwere\'s Sleep Gaze for 24 hours.',
    })).toBe(true);
  });
});

describe('MA-1000 disk lock: homunculus Bite save_margin + save_effect layout', () => {
  it('structured save_margin authored in MA-0639/0642 byte-shape, positioned last', () => {
    const row = BITE();
    expect(row.name).toBe('Bite');
    expect(row.attack_bonus).toBe(4);
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('1');
    expect(row.damage_type_primary).toBe('Piercing');
    expect(row.save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
    const keys = Object.keys(row);
    expect(keys[keys.length - 1]).toBe('save_margin');
    expect(parseSaveMarginClause(row)).toEqual({ failsBy: 5, also: 'unconscious' });
  });

  it('save_effect reworked to shallow-band-only twin layout: Unconscious word lives ONLY in description', () => {
    const row = BITE();
    expect(row.save_effect).toBe('Failure: The target has the Poisoned condition until the end of the homunculus\'s next turn.');
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['poisoned']);
    // canonical RAW text stays honest in description (both bands + wake clause)
    expect(row.description).toContain('<strong>Failure:</strong> The target has the <strong>Poisoned</strong> condition until the end of the homunculus\'s next turn.');
    expect(row.description).toContain('<strong>Failure by 5 or more:</strong> The target has the <strong>Poisoned</strong> condition for 1 minute.');
    expect(row.description).toContain('<strong>Unconscious</strong> condition, which ends early if the target takes any damage.');
    expect(row.damage_dice_secondary).toBeUndefined();
  });

  it('chip plan on the fixed disk row: clickable rider-only DC chip, zero save-leg damage', () => {
    const plan = saveChipPlan(BITE(), false);
    expect(plan).toEqual({ riderOnly: true, formula: null, rollable: false, clickable: true });
  });

  it('buildSaveOptions threads the margin rider with no secondary-damage decoys', () => {
    const opts = buildSaveOptions(BITE());
    expect(opts.saveDc).toBe(12);
    expect(opts.saveType).toBe('con');
    expect(opts.saveConditions).toEqual(['poisoned']);
    expect(opts.saveMargin).toEqual({ failsBy: 5, also: 'unconscious' });
    expect(opts.autoDamageSecondaryFormula).toBeNull();
    expect(opts.autoDamageSecondaryDamageType).toBeNull();
  });
});
