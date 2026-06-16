import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyTypeChoice } from './boonOfEnergyResistanceHandler.js';

vi.mock('../../common/choiceStorage.js', () => ({
    setChosenRuntimeValue: vi.fn(async () => {}),
    getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { setChosenRuntimeValue, getChosenRuntimeValue } = await import('../../common/choiceStorage.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestCharacter',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Boon of Energy Resistance',
        automation: {
            type: 'boon_of_energy_resistance',
            count: 2,
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('boonOfEnergyResistanceHandler', () => {
    describe('handle - no existing types', () => {
        it('returns modal when no types chosen yet', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('boonOfEnergyResistance');
            expect(result.payload.damageTypes).toBeDefined();
            expect(result.payload.existingTypes).toBeUndefined();
            expect(result.payload.maxSelections).toBe(2);
        });

        it('returns modal with existing types when already chosen', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire', 'Cold']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('boonOfEnergyResistance');
            expect(result.payload.existingTypes).toEqual(['Fire', 'Cold']);
            expect(result.payload.damageTypes).toBeDefined();
        });

        it('uses custom validTypes from automation', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const customTypes = ['Fire', 'Cold', 'Acid'];
            const action = makeAction({ automation: { validTypes: customTypes } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.damageTypes).toEqual(customTypes);
        });

        it('uses custom count from automation', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { count: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.maxSelections).toBe(3);
        });

        it('includes action, playerStats, and campaignName in payload', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });
    });

    describe('applyTypeChoice', () => {
        it('returns null when no valid types selected', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Invalid Type']);

            expect(result).toBeNull();
        });

        it('filters out invalid types', async () => {
            const action = makeAction({ automation: { validTypes: ['Fire', 'Cold'] } });
            await applyTypeChoice(action, makePlayerStats(), 'test-campaign', ['Fire', 'Invalid', 'Cold']);

            expect(setChosenRuntimeValue).toHaveBeenCalledWith(
                makePlayerStats(),
                'Boon of Energy Resistance',
                ['Fire', 'Cold'],
                'chosenTypes',
                'test-campaign'
            );
        });

        it('stores chosen types via setChosenRuntimeValue', async () => {
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Lightning']);

            expect(setChosenRuntimeValue).toHaveBeenCalledWith(
                makePlayerStats(),
                'Boon of Energy Resistance',
                ['Fire', 'Lightning'],
                'chosenTypes',
                'test-campaign'
            );
        });

        it('returns popup with selected types description', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Boon of Energy Resistance');
            expect(result.payload.description).toContain('Fire');
            expect(result.payload.description).toContain('Cold');
            expect(result.payload.description).toContain('resistance');
        });

        it('logs ability use when setting types', async () => {
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Boon of Energy Resistance',
            }));
        });

        it('logs type change when changing existing types', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire']);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Cold', 'Lightning']);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('changed to'),
            }));
        });

        it('logs type set when no previous types', async () => {
            getChosenRuntimeValue.mockReturnValue(null);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('set to'),
            }));
        });

        it('uses default ENERGY_TYPES when no validTypes in automation', async () => {
            const action = makeAction({ automation: {} });
            await applyTypeChoice(action, makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(setChosenRuntimeValue).toHaveBeenCalledWith(
                makePlayerStats(),
                'Boon of Energy Resistance',
                ['Fire', 'Cold'],
                'chosenTypes',
                'test-campaign'
            );
        });
    });
});
