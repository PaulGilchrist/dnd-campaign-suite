// MA-0962: Half-Dragon Claw "plus 7 (2d6) damage of the type chosen for the
// Draconic Origin trait" rider was inert-by-construction — no authored
// damage_dice_secondary, so buildSecondaryDamageTransport emitted the byte-
// inert null triple and rollAndApplySecondaryPlainDamage never rolled a
// second pool (MA-0531 transport live-unarmed). One-field-set DATA fix
// mirrors the MA-0531/MA-0426 additive-rider placement (secondary keys after
// damage_type_primary). The secondary TYPE is dynamic (Draconic Origin DM's
// choice — no draconic_origin_type machine field exists app-wide), so the
// honest composite label carries the RAW candidate set + "(GM-chosen)"
// qualifier; §70-class advisory: the type choice itself stays GM-enforced.
// Always-roll semantics are RAW-correct ("plus 2d6" rides every hit, no
// secondary_condition discriminator).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const halfDragon = monsters.find(m => m.index === 'half-dragon');
const clawRow = halfDragon.actions[1];

describe('MA-0962 Half-Dragon Claw additive 2d6 rider (data lock)', () => {
    it('actions[1] Claw authors damage_dice_secondary "2d6" + honest composite type beside the primary', () => {
        expect(clawRow.name).toBe('Claw');
        expect(clawRow.attack_bonus).toBe(7);
        expect(clawRow.reach).toBe('10 ft.');
        expect(clawRow.damage_dice_primary).toBe('1d4 + 4');
        expect(clawRow.damage_type_primary).toBe('Slashing');
        expect(clawRow.damage_dice_secondary).toBe('2d6');
        expect(clawRow.damage_type_secondary).toBe('Acid/Cold/Fire/Lightning/Poison (GM-chosen)');
        expect(clawRow.description).toContain('plus 7 (2d6) damage of the type chosen for the Draconic Origin trait');
    });

    it('rider is ADDITIVE every hit — no secondary_condition gate (MA-0426/0531 semantics)', () => {
        expect(clawRow.secondary_condition).toBeUndefined();
        const t = buildSecondaryDamageTransport(clawRow, 'Claw');
        expect(t.autoDamageSecondaryFormula).toBe('2d6');
        expect(t.autoDamageSecondaryName).toBe('Claw');
        expect(t.secondaryCondition).toBeNull();
    });

    it('transport arms the honest type label verbatim through formatDamageTypes', () => {
        const t = buildSecondaryDamageTransport(clawRow);
        expect(t.autoDamageSecondaryDamageType).toBe('Acid/Cold/Fire/Lightning/Poison (GM-chosen)');
        expect(t.autoDamageSecondaryName).toBe('Claw');
    });

    it('Multiattack actions[0] sibling stays byte-inert — no secondary (multiattack is header text)', () => {
        const multi = halfDragon.actions[0];
        expect(multi.name).toBe('Multiattack');
        expect(multi.damage_dice_secondary).toBeUndefined();
        expect(multi.damage_type_secondary).toBeUndefined();
        expect(buildSecondaryDamageTransport(multi)).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });

    it("Dragon's Breath actions[2] stays untouched — secondary ABSENT (MA-0963 owns that row)", () => {
        const breath = halfDragon.actions[2];
        expect(breath.name).toBe("Dragon's Breath");
        expect(breath.damage_dice_secondary).toBeUndefined();
        expect(breath.damage_type_secondary).toBeUndefined();
        expect(buildSecondaryDamageTransport(breath)).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });
});
