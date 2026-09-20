// MA-0610: Djinni Create Whirlwind — zone-picker openability + dc_success
// none + data integrity. BEFORE the fix this row had NO zone dict + carried
// instant damage_dice_primary: the cylinder hard-exclusion (sphereRadiusFeet
// returns null on "Cylinder") kept the picker closed, and the missing
// dc_success leaked half-damage on a successful save. The fix authors
// zone:{radius_ft:20,noun,effect_key:'whirlwind',recurring_damage,repeat_save}
// + dc_success:"none" and REMOVES the instant damage dice.
//
// Assertions (proven against disk + exported pure helpers):
//  - breathAoeShape returns a Radius picker for the zone row EVEN THOUGH the
//    description names a Cylinder (zone branch is checked before the guard).
//  - a Cylinder description with NO zone dict stays picker-inert (guard intact).
//  - zoneTeForAction carries recurring_die + repeat_save descriptors onto the te.
//  - saveChipPlan/buildSaveOptions honor dc_success:"none" (no half-leak) and
//    produce no instant damage formula (dice were removed).
import { describe, it, expect } from 'vitest';
import { breathAoeShape, zoneTeForAction, saveChipPlan, buildSaveOptions } from './MonsterCardModal.jsx';
import monsters from '../../../public/data/monsters.json';

const djinni = monsters.find(m => m.name === 'Djinni');
const row = djinni.actions.find(a => a.name === 'Create Whirlwind');

describe('MA-0610 disk row', () => {
    it('carries dc_success:"none" (kills the nat≥17 half-damage leak)', () => {
        expect(row.dc_success).toBe('none');
    });
    it('authores an MA-0043-style zone dict opening the Radius picker', () => {
        expect(row.zone).toBeTruthy();
        expect(row.zone.radius_ft).toBe(20);
        expect(row.zone.noun).toBe('whirlwind');
        expect(row.zone.effect_key).toBe('whirlwind');
    });
    it('carries recurring 6d6 Thunder + STR DC 17 repeat-save descriptors in the zone', () => {
        expect(row.zone.recurring_damage).toBe('6d6');
        expect(row.zone.recurring_damage_type).toBe('Thunder');
        expect(row.zone.repeat_save).toEqual({ save_type: 'Strength', dc: 17, condition: 'restrained' });
    });
    it('REMOVED the instant damage_dice_primary/type legs (recurring-only row)', () => {
        expect(row.damage_dice_primary).toBeUndefined();
        expect(row.damage_type_primary).toBeUndefined();
    });
});

describe('MA-0610 breathAoeShape — zone beats the cylinder guard', () => {
    it('opens a 20-ft Radius picker for the Cylinder zone row', () => {
        expect(/cylinder/i.test(row.description)).toBe(true);
        const aoe = breathAoeShape(row, null);
        expect(aoe).toEqual({ shape: 'Radius', feet: 20, rangeGateFt: null });
    });
    it('leaves a Cylinder description WITHOUT a zone dict picker-inert (guard intact)', () => {
        const noZone = { save_dc: 17, save_type: 'Strength', description: 'A 20-foot-radius, 60-foot-high Cylinder of wind.' };
        expect(breathAoeShape(noZone, null)).toBeNull();
    });
});

describe('MA-0610 zoneTeForAction descriptor passthrough', () => {
    it('carries recurring die + repeat_save descriptors onto the whirlwind te', () => {
        const te = zoneTeForAction(row);
        expect(te.effectKey).toBe('whirlwind');
        expect(te.radiusFt).toBe(20);
        expect(te.noun).toBe('whirlwind');
        expect(te.recurringDie).toBe('6d6');
        expect(te.recurringType).toBe('Thunder');
        expect(te.repeatSave).toEqual({ saveType: 'Strength', dc: 17, condition: 'restrained' });
    });
});

describe('MA-0610 save chip + options are instant-damage-free', () => {
    it('buildSaveOptions honors dc_success:none', () => {
        const opts = buildSaveOptions(row);
        expect(opts.saveDc).toBe(17);
        expect(opts.dcSuccess).toBe('none');
    });
    it('saveChipPlan renders NO instant damage formula (clickable DC-only chip)', () => {
        const plan = saveChipPlan(row, false);
        expect(plan.formula).toBeNull();
        expect(plan.rollable).toBe(false);
        expect(plan.clickable).toBe(true);
    });
});
