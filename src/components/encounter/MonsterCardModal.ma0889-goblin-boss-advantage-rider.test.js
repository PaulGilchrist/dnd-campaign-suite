// @maintained-by-ai
// MA-0889: Goblin Boss Scimitar/Shortbow advantage-rider METADATA SPLIT —
// "Hit: 5 (1d6 + 2) … damage, plus 2 (1d4) … damage if the attack roll had
// Advantage." The rider is discriminated by authored `secondary_condition:
// "advantage"` riding the MA-0427 secondary transport; legacy additive
// riders (MA-0426/0531 "plus 3d6 poison" family, flat_sickle twin MA-0530)
// carry no field and forward null = always-roll, byte-identical.
// Seam: the REAL exported buildSecondaryDamageTransport (MonsterCardModal
// .jsx:1199-1214) — transport-level discrimination only. The advantage FOLD
// itself (rider fires only when resolved lastAttack.forcedMode ===
// 'advantage') is proven at the real consumer in
// handlePlainDamage.secondary-advantage-gate.test.js (advantage/normal/
// disadvantage legs :186-223, MA-1444/1445 Scout Captain fold + that file's
// own monsters.json lock :259-266 — cited-skipped here).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const goblinBoss = monsters.find(m => m.index === 'goblin-boss');
const goblinWarrior = monsters.find(m => m.index === 'goblin-warrior');
const scimitarRow = goblinBoss.actions[1];
const shortbowRow = goblinBoss.actions[2];

describe('MA-0889 Goblin Boss advantage-gated secondary rider', () => {
    it('data-lock: Scimitar actions[1] carries secondary_condition "advantage" beside the secondary dice', () => {
        expect(scimitarRow.name).toBe('Scimitar');
        expect(scimitarRow.attack_bonus).toBe(4);
        expect(scimitarRow.damage_dice_primary).toBe('1d6 + 2');
        expect(scimitarRow.damage_type_primary).toBe('Slashing');
        expect(scimitarRow.damage_dice_secondary).toBe('1d4');
        expect(scimitarRow.damage_type_secondary).toBe('Slashing');
        expect(scimitarRow.secondary_condition).toBe('advantage');
        expect(scimitarRow.description).toContain('if the attack roll had Advantage');
        const t = buildSecondaryDamageTransport(scimitarRow, 'Scimitar');
        expect(t.autoDamageSecondaryFormula).toBe('1d4');
        expect(t.autoDamageSecondaryName).toBe('Scimitar');
        expect(t.autoDamageSecondaryDamageType).toBe('Slashing');
        expect(t.secondaryCondition).toBe('advantage');
    });

    it('MA-0890/0897/0898 advantage twins forward "advantage" through the transport', () => {
        const twins = [
            [shortbowRow, 'Shortbow', '1d4', 'Piercing'],
            [goblinWarrior.actions[0], 'Scimitar', '1d4', 'Slashing'],
            [goblinWarrior.actions[1], 'Shortbow', '1d4', 'Piercing'],
        ];
        for (const [row, name, formula, type] of twins) {
            expect(row.name).toBe(name);
            expect(row.damage_dice_secondary).toBe(formula);
            expect(row.secondary_condition).toBe('advantage');
            const t = buildSecondaryDamageTransport(row, name);
            expect(t.autoDamageSecondaryFormula).toBe(formula);
            expect(t.autoDamageSecondaryDamageType).toBe(type);
            expect(t.secondaryCondition).toBe('advantage');
        }
    });

    it('legacy always-roll riders forward secondaryCondition null byte-identical (MA-0426/0531 family)', () => {
        const diceRow = { name: 'Claw', damage_dice_secondary: '3d6', damage_type_secondary: 'Poison' };
        const t = buildSecondaryDamageTransport(diceRow, 'Claw');
        expect(t.secondaryCondition).toBeNull();
        expect(t.autoDamageSecondaryFormula).toBe('3d6');
        expect(t.autoDamageSecondaryDamageType).toBe('Poison');
        const flatRow = { name: 'Ritual Sickle', flat_damage_secondary: 1, damage_type_secondary: 'Necrotic' };
        const f = buildSecondaryDamageTransport(flatRow, 'Ritual Sickle');
        expect(f.secondaryCondition).toBeNull();
        expect(f.autoDamageSecondaryFormula).toBe('1');
    });

    it('secondary-less rows keep the null triple shape byte-identical (no new key)', () => {
        const nullRow = { name: 'Bite', damage_dice_primary: '1d6' };
        expect(buildSecondaryDamageTransport(nullRow)).toEqual({ autoDamageSecondaryFormula: null, autoDamageSecondaryName: null, autoDamageSecondaryDamageType: null });
    });
});
