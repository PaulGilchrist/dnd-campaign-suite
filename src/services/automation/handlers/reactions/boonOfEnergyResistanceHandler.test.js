// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyTypeChoice } from './boonOfEnergyResistanceHandler.js';

vi.mock('../../common/choiceStorage.js', () => ({
    setChosenRuntimeValue: vi.fn(async () => {}),
    getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { setChosenRuntimeValue, getChosenRuntimeValue } = await import('../../common/choiceStorage.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

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
        it('returns popup when types chosen and already used this rest', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire', 'Cold']);
            getRuntimeValue.mockReturnValue(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already changed this rest');
        });

        it('returns modal when types chosen but not used this rest yet', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire', 'Cold']);
            getRuntimeValue.mockReturnValue(false);

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

        it('uses custom validTypes and count from automation', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const customTypes = ['Fire', 'Cold', 'Acid'];
            const action = makeAction({ automation: { validTypes: customTypes, count: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.damageTypes).toEqual(customTypes);
            expect(result.payload.maxSelections).toBe(3);
        });
    });

    describe('applyTypeChoice', () => {
        it('returns null and does not persist when no valid types selected', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Invalid Type']);

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
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

        it('returns popup with selected types description', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Boon of Energy Resistance');
            expect(result.payload.description).toContain('Fire');
            expect(result.payload.description).toContain('Cold');
            expect(result.payload.description).toContain('resistance');
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

        it('sets once-per-rest flag when changing existing types', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire']);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Cold', 'Lightning']);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCharacter',
                '_boonOfEnergyResistanceUsedThisRest',
                true,
                'test-campaign'
            );
        });

        it('does not set once-per-rest flag on initial selection (no existing types)', async () => {
            getChosenRuntimeValue.mockReturnValue(null);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Fire', 'Cold']);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not set once-per-rest flag when selection matches existing types', async () => {
            getChosenRuntimeValue.mockReturnValue(['Fire', 'Cold']);
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', ['Cold', 'Fire']);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
