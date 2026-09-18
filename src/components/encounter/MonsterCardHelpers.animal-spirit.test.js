import { describe, it, expect } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { parseAnimalSpiritVariants } from './MonsterCardHelpers.js';

// MA-0275: Animal Lord "Animal Spirit" variant trio parser.
const animalLord = (monsters.monsters || monsters).find(m => m.name === 'Animal Lord');
const spiritRow = animalLord.actions.find(a => a.name === 'Animal Spirit');

describe('MA-0275 parseAnimalSpiritVariants', () => {
    it('parses the authored Animal Lord row into the three variants with range + fortify amount', () => {
        const result = parseAnimalSpiritVariants(spiritRow);
        expect(result).toBeTruthy();
        expect(result.rangeFt).toBe(120);
        expect(result.variants.map(v => v.key)).toEqual(['fortify', 'marked_as_prey', 'pesky_swarm']);
        expect(result.variants[0]).toMatchObject({ label: 'Fortify', form: 'Forager', tempHp: 20 });
        expect(result.variants[1]).toMatchObject({ label: 'Marked as Prey', form: 'Hunter' });
        expect(result.variants[2]).toMatchObject({ label: 'Pesky Swarm', form: 'Sage' });
    });

    it('is byte-inert (null) for rows without the full variant trio', () => {
        expect(parseAnimalSpiritVariants(null)).toBeNull();
        expect(parseAnimalSpiritVariants({ description: 'Claw. Melee Weapon Attack.' })).toBeNull();
        expect(parseAnimalSpiritVariants({ save_effect: 'Fortify (Forager Only) only' })).toBeNull();
        const noSwarm = animalLord.actions.filter(a => a.name !== 'Animal Spirit');
        for (const row of noSwarm) {
            expect(parseAnimalSpiritVariants(row)).toBeNull();
        }
    });

    it('defaults fortify to 20 THP when the wording carries no number', () => {
        const result = parseAnimalSpiritVariants({
            description: 'one creature within 120 feet',
            save_effect: 'Fortify (Forager Only). The animal lord gains Temporary Hit Points. Marked as Prey (Hunter Only). Pesky Swarm (Sage Only).',
        });
        expect(result.variants[0].tempHp).toBe(20);
    });
});
