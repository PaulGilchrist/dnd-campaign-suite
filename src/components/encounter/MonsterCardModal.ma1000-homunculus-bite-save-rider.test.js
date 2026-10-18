// @maintained-by-ai: 2026-10-18
// MA-1000: Homunculus Bite — the save leg gates a CONDITION rider only
// ("Failure: Poisoned … Failure by 5 or more: Poisoned … While Poisoned, …
// Unconscious, which ends early if the target takes any damage"), but the
// MA-0560 rider-only discriminator keyed on the BARE word "damage": the RAW
// termination clause false-matched → riderOnly=false → saveChipPlan.clickable
// =false (composite attack_bonus 4) → the DC 12 CON chip was inert cosmetics
// (MA-0551 attack fork nulls saveDc/saveType too — no seam ever saw the save).
// Fix (code): key on damage-BEARING evidence — rollable dice PAIRED with the
// damage word — not the bare word. Fix (data): author the MA-0639/0642
// byte-shape structured save_margin so the fail-by-5+ band rides the LIVE
// applySaveMarginRider, and rework save_effect to the shallow-band-only
// twin layout so extractConditionsFromSaveEffect can never over-grant
// Unconscious on a shallow fail (§214). Wake-on-damage early-end is a §70
// advisory note (no consumer app-wide) — adjudicated GM-side, never a defect.
//
// Cite-skips (covered byte-exact elsewhere, never re-anchored here):
// false-side damage pools (Salamander prose / Dao secondary inside
// save_effect) + saveLegCarriesSecondaryDamage + Death Dog dice-NO-damage-
// word byte-inert twin: MonsterCardModal.secondary-save-transport.test.js
// :118-128/:186-201; full Salamander row: ma1427; margin-band adjudication
// through the REAL save seam (shallow Poisoned-only, deep Poisoned+
// Unconscious, zero save-leg damage): saveProcessing.ma1000-homunculus-
// margin-band.test.js; parseSaveMarginClause unit contract + Drow twin:
// MonsterCardHelpers.save-margin.test.js / ma1584:171-175. Sleep Gaze
// "until it takes damage" is the same termination-clause equivalence class
// as the fingerprint below — one instance is enough.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { saveLegIsConditionRider, saveChipPlan, buildSaveOptions, isCompositeAttackSaveRow } from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

const homunculusBite = () => JSON.parse(readFileSync('public/data/monsters.json', 'utf8'))
  .find((m) => m.name === 'Homunculus').actions.find((a) => a.name === 'Bite');

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
    expect(saveLegIsConditionRider(row)).toBe(true);
    const plan = saveChipPlan(row, false);
    expect(plan.riderOnly).toBe(true);
    expect(plan.formula).toBeNull(); // zero save-leg damage (attack chip pays flat 1 Piercing)
    expect(plan.clickable).toBe(true);
  });
});

describe('MA-1000 disk lock + rider forward through the modal seams', () => {
  it('BY-name Bite row: shallow-band-only save_effect, structured save_margin authored last', () => {
    const row = homunculusBite();
    expect(row.name).toBe('Bite');
    expect(row.attack_bonus).toBe(4);
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('1');
    expect(row.damage_type_primary).toBe('Piercing');
    expect(row.damage_dice_secondary).toBeUndefined();
    expect(row.save_effect).toBe('Failure: The target has the Poisoned condition until the end of the homunculus\'s next turn.');
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['poisoned']); // §214: Unconscious lives ONLY in description (§70 advisory)
    expect(row.save_margin).toEqual({ fails_by: 5, also: 'unconscious' });
    const keys = Object.keys(row);
    expect(keys[keys.length - 1]).toBe('save_margin');
  });

  it('fixed disk row rides both modal seams: clickable rider-only chip plan + save transport threads the margin', () => {
    expect(saveChipPlan(homunculusBite(), false)).toEqual({ riderOnly: true, formula: null, rollable: false, clickable: true });
    const opts = buildSaveOptions(homunculusBite());
    expect(opts.saveDc).toBe(12);
    expect(opts.saveType).toBe('con');
    expect(opts.saveConditions).toEqual(['poisoned']);
    expect(opts.saveMargin).toEqual({ failsBy: 5, also: 'unconscious' });
    expect(opts.autoDamageSecondaryFormula).toBeNull(); // no secondary-damage decoys on the rider leg
    expect(opts.autoDamageSecondaryDamageType).toBeNull();
  });
});
