// MA-0963: Half-Dragon "Dragon's Breath" (actions[2]) — save row was
// damage-less on BOTH legs: the row authored NO damage_dice_primary/
// damage_type_primary, so the save/picker route (saveChipPlan.formula ->
// saveDamageFormula -> SaveAttackAoeModal, MA-0901/§408 cone picker reads
// damage_dice_primary ONLY) got a null pool and paid zero on fail AND
// success. Description "(8d6)" sits behind </strong> so the prose extractor
// (extractDamageDiceFromDescription) never sees it either. DATA fix mirrors
// the MA-0618/0629 Dragon Turtle Steam Breath twin: author the two dice
// fields; the TYPE is dynamic (Draconic Origin DM's choice) so the honest
// composite label "Acid/Cold/Fire/Lightning/Poison (GM-chosen)" rides, same
// precedent as the MA-0962 Claw rider on this very monster (§422: unknown
// labels are safe in resistance lookups — exact-lowercase compare, miss =
// full damage cosmetic pass-through). dc_success stays UNAUTHORED = half
// (byte-correct vs prose "Success: Half damage", §63/MA-0618).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractDamageDiceFromDescription, saveChipPlan, buildSaveOptions, buildSecondaryDamageTransport, breathAoeShape } from './MonsterCardModal.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const halfDragon = monsters.find(m => m.index === 'half-dragon');
const breath = halfDragon.actions[2];

describe('MA-0963 Half-Dragon Dragon\'s Breath disk row (data lock)', () => {
    it('is the DC 14 Dexterity 30-foot Cone recharge 5-6 save row', () => {
        expect(breath.name).toBe("Dragon's Breath");
        expect(breath.save_dc).toBe(14);
        expect(breath.save_type).toBe('Dexterity');
        expect(breath.range).toBe('30-foot Cone');
        expect(breath.recharge).toBe('5-6');
    });
    it('authors damage_dice_primary "8d6" + honest composite type (the fix)', () => {
        expect(breath.damage_dice_primary).toBe('8d6');
        expect(breath.damage_type_primary).toBe('Acid/Cold/Fire/Lightning/Poison (GM-chosen)');
    });
    it('leaves dc_success UNAUTHORED (half-default honest vs prose half-on-save)', () => {
        expect(breath.dc_success).toBeUndefined();
    });
    it('description prose stays byte-identical (fix is fields-only)', () => {
        expect(breath.description).toContain('Failure:</strong> 28 (8d6) damage of the type chosen for the Draconic Origin trait');
        expect(breath.description).toContain('<strong>Success:</strong> Half damage');
    });
});

describe('MA-0963 picker pool transport feeds the 8d6 dice to both legs', () => {
    it('extractDamageDiceFromDescription short-circuits on the authored field', () => {
        expect(extractDamageDiceFromDescription(breath.description, breath.damage_dice_primary)).toBe('8d6');
    });
    it('description WITHOUT the authored field stays unparseable (why the field is required)', () => {
        // eslint-disable-next-line no-unused-vars
        const { damage_dice_primary, ...bare } = breath;
        expect(extractDamageDiceFromDescription(bare.description, bare.damage_dice_primary)).toBeNull();
    });
    it('saveChipPlan yields a rollable 8d6 formula for the save chip', () => {
        const plan = saveChipPlan(breath, false);
        expect(plan.formula).toBe('8d6');
        expect(plan.rollable).toBe(true);
        expect(plan.clickable).toBe(true);
    });
    it('breathAoeShape parses the 30-foot Cone picker (shape seam byte-intact)', () => {
        expect(breathAoeShape(breath, null)).toMatchObject({ shape: 'Cone', feet: 30 });
    });
    it('save options arm DC 14 + half default + PRIMARY-only pool (secondary null triple)', () => {
        const opts = buildSaveOptions(breath);
        expect(opts.saveDc).toBe(14);
        expect(opts.saveType).toBe('dex');
        expect(opts.dcSuccess).toBe('half');
        expect(buildSecondaryDamageTransport(breath)).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });
});

describe('MA-0963 half-on-save semantics', () => {
    it('failed save pays the FULL raw roll', () => {
        expect(computeDamageAfterSave(28, false, 'half')).toBe(28);
        expect(computeDamageAfterSave(48, false, 'half')).toBe(48);
    });
    it('successful save pays floor(raw/2)', () => {
        expect(computeDamageAfterSave(28, true, 'half')).toBe(14);
        expect(computeDamageAfterSave(41, true, 'half')).toBe(20);
        expect(computeDamageAfterSave(8, true, 'half')).toBe(4);
    });
});

describe('MA-0963 sibling rows byte-inert (actions[0]/actions[1] untouched)', () => {
    it('Multiattack stays header text with its own primary, no secondary', () => {
        const multi = halfDragon.actions[0];
        expect(multi.name).toBe('Multiattack');
        expect(multi.damage_dice_primary).toBe('1d4 + 4');
        expect(multi.damage_dice_secondary).toBeUndefined();
    });
    it('Claw keeps the MA-0962 secondary rider exactly as authored', () => {
        const claw = halfDragon.actions[1];
        expect(claw.name).toBe('Claw');
        expect(claw.damage_dice_secondary).toBe('2d6');
        expect(claw.damage_type_secondary).toBe('Acid/Cold/Fire/Lightning/Poison (GM-chosen)');
    });
});
