// @improved-by-ai
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
    describe('handle', () => {
        it('returns modal with existing types when previously chosen', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire', 'Cold']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('boonOfEnergyResistance');
            expect(result.payload.existingTypes).toEqual(['Fire', 'Cold']);
            expect(result.payload.damageTypes).toBeDefined();
            expect(result.payload.maxSelections).toBe(2);
        });

        it('returns modal without existingTypes when none chosen yet', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('boonOfEnergyResistance');
            expect(result.payload.existingTypes).toBeUndefined();
            expect(result.payload.damageTypes).toBeDefined();
            expect(result.payload.maxSelections).toBe(2);
        });

        it('returns modal without existingTypes when chosenTypes is empty array', async () => {
            getChosenRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.payload.existingTypes).toBeUndefined();
        });

        it('uses custom validTypes and count from automation', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const customTypes = ['Fire', 'Cold', 'Acid'];
            const action = makeAction({ automation: { validTypes: customTypes, count: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.damageTypes).toEqual(customTypes);
            expect(result.payload.maxSelections).toBe(3);
        });

        it('includes action, playerStats, and campaignName in payload', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.campaignName).toBe('test-campaign');
        });
    });

    describe('applyTypeChoice', () => {
        it('returns null when all selected types are invalid', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Invalid Type']);

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns null when empty array is passed', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', []);

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
        });

        it('filters out invalid types and stores only valid ones', async () => {
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
            expect(result.payload.automationType).toBe('boon_of_energy_resistance');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('logs ability use when setting types for the first time', async () => {
            getChosenRuntimeValue.mockReturnValue(null);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Boon of Energy Resistance',
                description: expect.stringContaining('set to'),
            }));
        });

        it('logs type change when existing types differ from new selection', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire']);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Cold', 'Lightning']);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('changed to'),
            }));
        });

        it('does not log a change when types are identical', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire', 'Cold']);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Cold', 'Fire']);

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
