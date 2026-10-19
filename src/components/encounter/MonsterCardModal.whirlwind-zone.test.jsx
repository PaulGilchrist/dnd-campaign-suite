// @maintained-by-ai
// MA-0610: Djinni Create Whirlwind — zone-picker openability + dc_success
// none + data integrity. BEFORE the fix this row had NO zone dict + carried
// instant damage_dice_primary: the cylinder hard-exclusion (sphereRadiusFeet
// returns null on "Cylinder") kept the picker closed, and the missing
// dc_success leaked half-damage on a successful save. The fix authors
// zone:{radius_ft:20,noun,effect_key:'whirlwind',recurring_damage,repeat_save}
// + dc_success:"none" and REMOVES the instant damage dice.
//
// Ownership: sole disk/shape/chip owner of this row (no sibling file
// fingerprints Djinni Create Whirlwind). save-variant-shape.test.jsx defers
// zone-beats-cylinder here; :the guard-it below is the pure-shape cylinder
// guard cited by thunderclap-sphere.test.jsx (#782 cites this file :50).
// dc_success transport byte cited by ma1971-wing-defense.test.jsx (was :72).
// Runtime lanes owned elsewhere, not re-pinned: recurring tick
// (whirlwindService.whirlwind.test.js), repeat save (repeatSaveService.test.js),
// picker confirm/grant legs (SaveAttackAoeModal.ma1212 / demilich-howl).
import { describe, it, expect } from 'vitest';
import { breathAoeShape, zoneTeForAction, saveChipPlan, buildSaveOptions } from './MonsterCardModal.jsx';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';
import monsters from '../../../public/data/monsters.json';

const djinni = monsters.find(m => m.name === 'Djinni');
const row = djinni.actions.find(a => a.name === 'Create Whirlwind');

describe('MA-0610 disk row', () => {
    it('dc_success:"none" + full zone dict authored, instant damage dice REMOVED (recurring-only row)', () => {
        expect(row.dc_success).toBe('none');
        expect(row.damage_dice_primary).toBeUndefined();
        expect(row.damage_type_primary).toBeUndefined();
        // Exact shape zone dict (advisory prose is GM-facing, not pinned).
        const { advisory, ...zoneShape } = row.zone;
        expect(advisory).toBeTruthy();
        expect(zoneShape).toEqual({
            radius_ft: 20,
            noun: 'whirlwind',
            effect_key: 'whirlwind',
            recurring_damage: '6d6',
            recurring_damage_type: 'Thunder',
            repeat_save: { save_type: 'Strength', dc: 17, condition: 'restrained' },
        });
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
    it('carries recurring die + repeat_save descriptors onto the whirlwind te (registered effect)', () => {
        const te = zoneTeForAction(row);
        const { clause, ...teShape } = te;
        expect(clause).toBe(row.zone.advisory);
        expect(teShape).toEqual({
            effectKey: 'whirlwind',
            radiusFt: 20,
            noun: 'whirlwind',
            recurringDie: '6d6',
            recurringType: 'Thunder',
            repeatSave: { saveType: 'Strength', dc: 17, condition: 'restrained' },
            damage: null,
            duration: 'Concentration, until the djinni dismisses it (GM-enforced)',
            repeatTurnEnd: false,
            trackingPrefix: 'whirlwind',
        });
        // te must resolve in the targetEffect registry (badge + GM add UI read it).
        const def = getEffectDefinition('whirlwind');
        expect(def).toBeTruthy();
        expect(def.cls).toBe('effect-debuff');
        expect(def.fields).toEqual(expect.arrayContaining(['dc', 'saveType']));
    });
});

describe('MA-0610 save chip + options are instant-damage-free', () => {
    it('DC-only clickable chip: saveDc 17 / dc_success "none" / no instant formula', () => {
        const opts = buildSaveOptions(row);
        expect(opts.saveDc).toBe(17);
        expect(opts.dcSuccess).toBe('none');
        const plan = saveChipPlan(row, false);
        expect(plan.formula).toBeNull();
        expect(plan.rollable).toBe(false);
        expect(plan.clickable).toBe(true);
    });
});
