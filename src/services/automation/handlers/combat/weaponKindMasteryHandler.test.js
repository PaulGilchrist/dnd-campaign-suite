import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applySelections, WEAPON_KIND_KEY } from './weaponKindMasteryHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

function makeAction(overrides = {}) {
    return {
        name: 'Weapon Mastery',
        description: 'Select weapon kinds for mastery.',
        automation: {
            type: 'weapon_kind_mastery',
            meleeOnly: false,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        ...overrides,
    };
}

describe('weaponKindMasteryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('WEAPON_KIND_KEY', () => {
        it('should be defined', () => {
            expect(WEAPON_KIND_KEY).toBeDefined();
            expect(WEAPON_KIND_KEY).toContain('_Weapon_Kind_Mastery_chosenWeapons');
        });
    });

    describe('handle', () => {
        it('should return modal when no existing selection', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('weaponKindMastery');
            expect(result.payload.meleeOnly).toBe(false);
        });

        it('should return modal with meleeOnly=true for Barbarian', async () => {
            getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ automation: { meleeOnly: true } });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.meleeOnly).toBe(true);
        });

        it('should return popup when existing selection exists', async () => {
            getRuntimeValue.mockReturnValue(['Greataxe', 'Handaxe']);
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Greataxe');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                WEAPON_KIND_KEY,
                ['Greataxe', 'Handaxe'],
                'campaign'
            );
        });
    });

    describe('applySelections', () => {
        it('should return null for empty array', async () => {
            const result = await applySelections([], makePlayerStats(), 'campaign');
            expect(result).toBeNull();
        });

        it('should return null for null', async () => {
            const result = await applySelections(null, makePlayerStats(), 'campaign');
            expect(result).toBeNull();
        });

        it('should store selections and return popup', async () => {
            const result = await applySelections(['Greataxe', 'Handaxe'], makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Weapon Mastery');
            expect(result.payload.description).toContain('Greataxe');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                WEAPON_KIND_KEY,
                ['Greataxe', 'Handaxe'],
                'campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    description: expect.stringContaining('Greataxe'),
                })
            );
        });
    });
});
