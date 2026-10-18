// @maintained-by-ai
// MA-0367 helper lane: parseInfernalWoundClause is a STRUCTURED-KEY-ONLY arm
// (MonsterCardHelpers.js:356-364) — armed solely by hit_target_effect
// 'infernal_wound' on the BY-name Bearded Devil/Infernal Glaive disk row
// (monsters.json:8975, all wound_* keys explicit); every other row stays
// byte-inert null, so no prose-wound row (e.g. Horned Devil/Infernal Tail,
// monsters.json:37751, DC 17 3d6 variant) can double-arm. Consumers cite-skip
// here: Modal arms at MonsterCardModal.jsx:1344/:1907; the failed-save gate
// (dc_success 'full', unhalved) is covered by saveProcessing.infernal-wound
// .test.js:120 and infernalWoundService.test.js:75 — no timers in this lane.
import { describe, it, expect } from 'vitest';
import { parseInfernalWoundClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0367 parseInfernalWoundClause', () => {
    const glaive = () => monstersData.find(m => m.name === 'Bearded Devil')
        .actions.find(a => a.name === 'Infernal Glaive');
    const ARMED = { effect: 'infernal_wound', bleedDie: '1d10', expiresMinutes: 1, medicineDc: 12 };

    it('arms exact output per key truth table (disk row, defaults, overrides normalised)', () => {
        // BY-name disk row carries all wound_* keys explicit (1d10 / 1 / 12).
        expect(parseInfernalWoundClause(glaive())).toEqual(ARMED);
        // keys omitted → authored defaults.
        expect(parseInfernalWoundClause({ hit_target_effect: 'infernal_wound' })).toEqual(ARMED);
        // overrides win, die lower-cased, numerics coerced from strings.
        expect(parseInfernalWoundClause({
            hit_target_effect: 'infernal_wound',
            wound_bleed_die: '2D6',
            wound_expires_minutes: '2',
            wound_medicine_dc: '15',
        })).toEqual({
            effect: 'infernal_wound',
            bleedDie: '2d6',
            expiresMinutes: 2,
            medicineDc: 15,
        });
    });

    it('byte-inert null once-only: non-objects, missing key, foreign te', () => {
        for (const row of [
            null,
            undefined,
            { name: 'Claws', save_effect: 'bleeds' },
            { name: 'Horn', hit_target_effect: 'no_healing' },
        ]) {
            expect(parseInfernalWoundClause(row)).toBeNull();
        }
    });

    it('only ONE row across the full bestiary arms (prose-only Horned Devil stays inert)', () => {
        const armed = monstersData.flatMap(m =>
            [...(m.actions || []), ...(m.legendary_actions || [])]
                .filter(a => parseInfernalWoundClause(a))
                .map(a => `${m.name}/${a.name}`)
        );
        expect(armed).toEqual(['Bearded Devil/Infernal Glaive']);
    });
});
