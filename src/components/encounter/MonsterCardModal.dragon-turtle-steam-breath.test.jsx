// MA-0629: Dragon Turtle Steam Breath (actions[4]) — zero-damage-on-failed-save
// was a DATA gap: the row carried NO damage_dice_primary/damage_type_primary and
// its description has no "Failure:" prefix, so extractDamageDiceFromDescription
// (MonsterCardModal.jsx) returned null → saveChipPlan.formula null → resolvedDamage
// null → the finalDamage>0 guard skipped apply + save-damage log entirely.
// Fix mirrors the MA-0618 twin (Dracolich Necrotic Breath): author the two dice
// fields. dc_success stays UNAUTHORED = half (byte-correct vs prose §63).
import { describe, it, expect } from 'vitest';
import { extractDamageDiceFromDescription, saveChipPlan, buildSaveOptions, breathAoeShape } from './MonsterCardModal.jsx';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import monsters from '../../../public/data/monsters.json';

const turtle = monsters.find(m => m.name === 'Dragon Turtle');
const row = turtle.actions[4];

describe('MA-0629 disk row', () => {
    it('is Steam Breath with save_dc 18 Constitution', () => {
        expect(row.name).toBe('Steam Breath');
        expect(row.save_dc).toBe(18);
        expect(row.save_type).toBe('Constitution');
    });
    it('authors damage_dice_primary 15d6 + damage_type_primary Fire (the fix)', () => {
        expect(row.damage_dice_primary).toBe('15d6');
        expect(row.damage_type_primary).toBe('Fire');
    });
    it('leaves dc_success UNAUTHORED (half-default honest vs prose half-on-save)', () => {
        expect(row.dc_success).toBeUndefined();
    });
});

describe('MA-0629 chip-plan formula extraction', () => {
    it('extractDamageDiceFromDescription picks up the authored primary dice', () => {
        expect(extractDamageDiceFromDescription(row.description, row.damage_dice_primary)).toBe('15d6');
    });
    it('description WITHOUT the dice field stays unparseable (why the field is required)', () => {
        // eslint-disable-next-line no-unused-vars
        const { damage_dice_primary, ...bare } = row;
        expect(extractDamageDiceFromDescription(bare.description, bare.damage_dice_primary)).toBeNull();
    });
    it('saveChipPlan yields a rollable 15d6 formula for the DC 18 save chip', () => {
        const plan = saveChipPlan(row, false);
        expect(plan.formula).toBe('15d6');
        expect(plan.rollable).toBe(true);
        expect(plan.clickable).toBe(true);
    });
    it('buildSaveOptions keeps the half-on-save default', () => {
        const opts = buildSaveOptions(row);
        expect(opts.saveDc).toBe(18);
        expect(opts.dcSuccess).toBe('half');
    });
    it('cone still parses to the picker (shape seam byte-intact)', () => {
        expect(breathAoeShape(row, null)).toMatchObject({ shape: 'Cone', feet: 60 });
    });
});

describe('MA-0629 half-on-save semantics', () => {
    it('failed save pays the FULL raw roll', () => {
        expect(computeDamageAfterSave(41, false, 'half')).toBe(41);
    });
    it('successful save pays floor(raw/2)', () => {
        expect(computeDamageAfterSave(41, true, 'half')).toBe(20);
        expect(computeDamageAfterSave(52, true, 'half')).toBe(26);
    });
});
