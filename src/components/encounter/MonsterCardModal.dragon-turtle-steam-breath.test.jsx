// @maintained-by-ai
// MA-0629: Dragon Turtle Steam Breath (BY-name disk lock #387) — zero-damage-on-failed-save
// was a DATA gap: the row carried NO damage_dice_primary/damage_type_primary and
// its description has no "Failure:" prefix, so extractDamageDiceFromDescription
// (MonsterCardModal.jsx) returned null → saveChipPlan.formula null → resolvedDamage
// null → the finalDamage>0 guard skipped apply + save-damage log entirely.
// Fix mirrors the MA-0618 twin (Dracolich Necrotic Breath): author the two dice
// fields. dc_success stays UNAUTHORED = half (byte-correct vs prose §63).
// Owned elsewhere, not re-pinned here: extract short-circuit/bare-null contract +
// Cone shape parse (MonsterCardModal.ma0963-half-dragon-breath.test.js twin,
// save-variant-shape owners), buildSaveOptions half-default (ma1971-wing-defense:71),
// save-full/save-half math (applyDamage.save-full.test.js:17-19), recharge economy
// (monsterRecharge.test.js), picker lane (SaveAttackAoeModal owners).
import { describe, it, expect } from 'vitest';
import { saveChipPlan } from './MonsterCardModal.jsx';
import monsters from '../../../public/data/monsters.json';

const turtle = monsters.find(m => m.name === 'Dragon Turtle');
const row = turtle.actions.find(a => a.name === 'Steam Breath');

describe('MA-0629 Dragon Turtle Steam Breath disk row (BY-name lock)', () => {
    it('authors 15d6 Fire in a 60-foot Cone, DC 18 Constitution, dc_success UNAUTHORED (half-default honest vs prose)', () => {
        expect(row.save_dc).toBe(18);
        expect(row.save_type).toBe('Constitution');
        expect(row.damage_dice_primary).toBe('15d6');
        expect(row.damage_type_primary).toBe('Fire');
        expect(row.range).toBe('60-foot Cone');
        expect(row.dc_success).toBeUndefined();
    });
    it('saveChipPlan resolves the rollable 15d6 formula (pre-fix: null formula → zero damage)', () => {
        const plan = saveChipPlan(row, false);
        expect(plan.formula).toBe('15d6');
        expect(plan.rollable).toBe(true);
    });
});
