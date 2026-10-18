// @maintained-by-ai
// MA-0962: Half-Dragon Claw "plus 7 (2d6) damage of the type chosen for the
// Draconic Origin trait" rider was inert-by-construction — no authored
// damage_dice_secondary, so buildSecondaryDamageTransport emitted the byte-inert
// null triple and rollAndApplySecondaryPlainDamage never rolled a second pool
// (MA-0531 transport live-unarmed). One-field-set DATA fix, MA-0426/0531
// additive-rider placement. Secondary TYPE is DM-chosen (no draconic_origin_type
// machine field exists app-wide) → honest composite label with "(GM-chosen)"
// qualifier; §70-class advisory: the type choice stays GM-enforced. Always-roll
// is RAW-correct ("plus 2d6" rides every hit, no secondary_condition gate).
// Transport-contract faces owned elsewhere — null triple #589
// (cultist-flat-secondary.test.js:34-37), secondaryCondition null/false forwards
// #673 (ma0889-goblin-boss-advantage-rider.test.js:60-68), transport ctx bytes
// #580 (auto-damage-roll it.each tables); multiattack/breath sibling rows are
// MA-0963's lane (ma0963-half-dragon-breath.test.js:85-90).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const halfDragon = monsters.find(m => m.index === 'half-dragon');
const clawRow = halfDragon.actions.find(a => a.name === 'Claw');

describe('MA-0962 Half-Dragon Claw additive 2d6 rider (data lock)', () => {
    it('Claw row BY-name authors secondary "2d6" + honest composite type, no secondary_condition gate (additive every hit)', () => {
        expect(clawRow).toBeDefined();
        expect(clawRow.damage_dice_secondary).toBe('2d6');
        expect(clawRow.damage_type_secondary).toBe('Acid/Cold/Fire/Lightning/Poison (GM-chosen)');
        expect(clawRow.secondary_condition).toBeUndefined();
    });

    it('real transport seam forwards the rider verbatim — dice, composite type, secondaryCondition null (always-roll)', () => {
        expect(buildSecondaryDamageTransport(clawRow, 'Claw')).toEqual({
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryName: 'Claw',
            autoDamageSecondaryDamageType: 'Acid/Cold/Fire/Lightning/Poison (GM-chosen)',
            secondaryCondition: null,
        });
    });
});
