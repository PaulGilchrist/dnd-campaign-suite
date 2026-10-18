// @maintained-by-ai
// MA-0275 owner lane: parseAnimalSpiritVariants truth-table (#497 helper-lane canon).
// Downstream behavior is owned elsewhere — grants: saveProcessing.animal-spirit.test.js
// (applyAnimalSpiritVariantGrant), te consumers: conditionEffects.animal-spirit.test.js,
// chooser threading: MonsterCardModal — no consumer echo legs here.
// Cross-pinned exclusions live in MonsterCardHelpers.ma0875-thp-clause.test.js:34-38
// (this row stays inert in parseTempHpGrantClause) and MonsterCardHelpers.save-variant-chooser.test.js:65-67.
// Fiction rows (#396): the Animal Spirit trio row is the ONLY trio on disk and its
// numbers (20 THP / 120 ft) collide with the parser defaults, so distinct-value and
// no-number/no-range legs are unreachable from disk — fictional rows pin that the
// thp/range regexes actually parse and that the defaults fire.
// Trimmed: per-action Animal Lord inertness loop (no distinct branch — every sibling
// row lacks all trio headers; the header legs + Multiattack decoy below pin it).
import { describe, it, expect } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { parseAnimalSpiritVariants } from './MonsterCardHelpers.js';

const animalLord = (monsters.monsters || monsters).find(m => m.name === 'Animal Lord');
const spiritRow = animalLord.actions.find(a => a.name === 'Animal Spirit');
const multiattackRow = animalLord.actions.find(a => a.name === 'Multiattack');

const HEADER = {
    fortify: 'Fortify (Forager Only).',
    prey: 'Marked as Prey (Hunter Only).',
    swarm: 'Pesky Swarm (Sage Only).',
};

describe('MA-0275 parseAnimalSpiritVariants', () => {
    it('parses the authored Animal Lord row — exact output (range 120 + Fortify 20 THP parsed from wording)', () => {
        expect(spiritRow.save_effect).toMatch(/gains 20 temporary hit points/i);
        expect(parseAnimalSpiritVariants(spiritRow)).toEqual({
            rangeFt: 120,
            variants: [
                { key: 'fortify', label: 'Fortify', form: 'Forager', tempHp: 20 },
                { key: 'marked_as_prey', label: 'Marked as Prey', form: 'Hunter' },
                { key: 'pesky_swarm', label: 'Pesky Swarm', form: 'Sage' },
            ],
        });
    });

    it.each([
        ['null action (modal may call with no stageAction)', null],
        ['Multiattack mentions Animal Spirit but carries no save_effect', multiattackRow],
        ['missing fortify header', { save_effect: `${HEADER.prey} ${HEADER.swarm}` }],
        ['missing prey header', { save_effect: `${HEADER.fortify} ${HEADER.swarm}` }],
        ['missing swarm header', { save_effect: `${HEADER.fortify} ${HEADER.prey}` }],
    ])('is byte-inert (null) — %s', (_label, action) => {
        expect(parseAnimalSpiritVariants(action)).toBeNull();
    });

    it('reads THP + range from the wording (fiction trio with distinct numbers — disk values collide with defaults)', () => {
        const result = parseAnimalSpiritVariants({
            description: 'one creature within 60 feet',
            save_effect: `${HEADER.fortify} The animal lord gains 35 Temporary Hit Points. ${HEADER.prey} ${HEADER.swarm}`,
        });
        expect(result.rangeFt).toBe(60);
        expect(result.variants[0].tempHp).toBe(35);
    });

    it('defaults Fortify to 20 THP and rangeFt to null when the wording carries neither number (fiction trio)', () => {
        const result = parseAnimalSpiritVariants({
            description: 'one creature the animal lord can see',
            save_effect: `${HEADER.fortify} The animal lord gains Temporary Hit Points. ${HEADER.prey} ${HEADER.swarm}`,
        });
        expect(result).toEqual({
            rangeFt: null,
            variants: [
                { key: 'fortify', label: 'Fortify', form: 'Forager', tempHp: 20 },
                { key: 'marked_as_prey', label: 'Marked as Prey', form: 'Hunter' },
                { key: 'pesky_swarm', label: 'Pesky Swarm', form: 'Sage' },
            ],
        });
    });
});
