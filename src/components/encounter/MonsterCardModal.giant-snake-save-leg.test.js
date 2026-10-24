// @maintained-by-ai
// Owner legs (keep stable): disk BY-name bytes · save-chip ctx damage
// fields adjudicating 3d6 Poison through the composite save-leg path.
// Predicate truth tables owned by secondary-save-transport.test.js (it.each
// :303-312); this row's predicate satisfaction is covered transitively by
// the save-chip leg below. Salamander constrict bytes owned by ma1427 twin.
// MA-0816: Giant Poisonous Snake Bite — save_leg was rolling the attack
// primary dice ("1d4 + 4" Piercing) because the row lacked damage_dice_secondary,
// so saveLegCarriesSecondaryDamage was false and resolveSaveLegDamageFields
// fell through to the legacy branch. DATA fix: author damage_dice_secondary
// "3d6" + damage_type_secondary "Poison" (save_effect failure clause byte
// carries "3d6"), mirroring the Salamander Constrict / Dao Earth Burst twins.
// Attack chip stays fixed "1d4 + 4" Piercing (buildAttackChipSaveOptions drops
// the save keys + secondary transport on composite save-leg-rider rows —
// no MA-0427 double-charge; fork covered in secondary-save-transport).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];

const snakeRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
    .find((m) => m.index === 'giant-poisonous-snake').actions[0];

describe('MA-0816 giant-poisonous-snake Bite — save-leg secondary data', () => {
    it('disk row BY-name bytes: flat "1d4 + 4" primary + "3d6" Poison save leg', () => {
        expect(snakeRow.name).toBe('Bite');
        expect(snakeRow.attack_bonus).toBe(6);
        expect(snakeRow.save_dc).toBe(11);
        expect(snakeRow.damage_dice_primary).toBe('1d4 + 4');
        expect(snakeRow.damage_type_primary).toBe('Piercing');
        expect(snakeRow.damage_dice_secondary).toBe('3d6');
        expect(snakeRow.damage_type_secondary).toBe('Poison');
        expect(snakeRow.save_effect.includes('3d6')).toBe(true);
    });

    it('save chip adjudicates 3d6 Poison, NOT the attack primary "1d4 + 4"', () => {
        const ctx = buildAbilitySaveRollContext({
            monsterName: 'Giant Poisonous Snake 1',
            target: { name: 'Bandit 1', type: 'monster' },
            spellName: null,
            action: snakeRow,
            saveType: 'CON',
            dcSuccess: 'half',
            saveDamageFormula: '1d4 + 4',
            saveConditions: [],
            usesGate: null,
            prerequisite: null,
            getDamageTypesForAction,
        });
        expect(ctx.autoDamageFormula).toBe('3d6');
        expect(ctx.autoDamageDamageType).toBe('Poison');
        expect(ctx.autoDamageSecondaryFormula).toBeNull();
        expect(ctx.autoDamageSecondaryDamageType).toBeNull();
    });
});
