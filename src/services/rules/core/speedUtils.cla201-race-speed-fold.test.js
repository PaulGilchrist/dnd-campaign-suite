// @improved-by-ai
import { describe, it, expect } from 'vitest';

import { applySpeedIncreasePassives, resolveHalfSpeedFeet } from './speedUtils.js';

// CLA-201: Fast Movement (+10 speed_bonus, no_heavy_armor) folded to nothing
// when the automation-layer playerStats carried no speed (Dragonborn Barbarian
// showed Speed 15 ft in the Instinctive Pounce advisory instead of 20 ft).
function fastMovementBarbarian(overrides = {}) {
    return {
        name: 'DraconicDragon',
        level: 20,
        race: { name: 'Dragonborn', speed: 30, subrace: { name: 'Red Dragonborn' } },
        inventory: { equipped: [] },
        equipment: [],
        automation: {
            passives: [
                { name: 'Fast Movement', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '10', condition: 'no_heavy_armor' },
            ],
        },
        ...overrides,
    };
}

describe('speedUtils — CLA-201 race speed fold', () => {
    it('applySpeedIncreasePassives folds passive bonus into race JSON base when speed is undefined', () => {
        const stats = fastMovementBarbarian({ speed: undefined });
        expect(applySpeedIncreasePassives(stats)).toBe(40);
    });

    it('applySpeedIncreasePassives still folds onto an explicit speed', () => {
        const stats = fastMovementBarbarian({ speed: 30 });
        expect(applySpeedIncreasePassives(stats)).toBe(40);
    });

    it('applySpeedIncreasePassives leaves speed untouched with no speed passives', () => {
        const stats = fastMovementBarbarian({ speed: undefined, automation: { passives: [] } });
        expect(applySpeedIncreasePassives(stats)).toBeUndefined();
    });

    it('applySpeedIncreasePassives refuses to invent a base without race speed', () => {
        const stats = fastMovementBarbarian({ speed: undefined, race: undefined });
        expect(applySpeedIncreasePassives(stats)).toBeUndefined();
    });

    it('resolveHalfSpeedFeet halves the folded canonical speed (40 → 20)', () => {
        expect(resolveHalfSpeedFeet({ name: 'X', speed: 40 })).toBe(20);
    });

    it('resolveHalfSpeedFeet falls back to the race JSON speed', () => {
        expect(resolveHalfSpeedFeet({ name: 'X', race: { speed: 30 } })).toBe(15);
    });

    it('resolveHalfSpeedFeet floors odd speeds', () => {
        expect(resolveHalfSpeedFeet({ name: 'X', speed: 35 })).toBe(17);
    });
});
