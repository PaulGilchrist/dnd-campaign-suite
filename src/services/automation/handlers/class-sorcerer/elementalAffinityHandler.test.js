import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyTypeChoice } from './elementalAffinityHandler.js';

vi.mock('../../common/choiceStorage.js', () => ({
    setChosenRuntimeValue: vi.fn(),
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
        name: 'SorcererBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Elemental Affinity',
        automation: {
            type: 'elemental_affinity',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('elementalAffinityHandler', () => {
    describe('handle', () => {
        it('returns modal when no type has been chosen yet', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalAffinity');
            expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Poison']);
            expect(result.payload.existingType).toBeUndefined();
        });

        it('returns modal with existingType when a type has been chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalAffinity');
            expect(result.payload.existingType).toBe('Fire');
        });

        it('uses custom damageTypes from automation when provided', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const action = makeAction({ automation: { damageTypes: ['Fire', 'Cold'] } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.damageTypes).toEqual(['Fire', 'Cold']);
        });

        it('passes action, playerStats, and campaignName in payload', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('logs ability_use when type already chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('Lightning');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type is Lightning',
            });
        });
    });

    describe('applyTypeChoice', () => {
        it('returns null for invalid damage type', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Radiant');

            expect(result).toBeNull();
        });

        it('returns popup for valid damage type', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Fire');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elemental Affinity');
            expect(result.payload.description).toContain('Fire selected');
            expect(result.payload.description).toContain('resistance to Fire damage');
        });

        it('calls setChosenRuntimeValue with the chosen type', async () => {
            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Cold');

            expect(setChosenRuntimeValue).toHaveBeenCalledWith(
                expect.any(Object),
                'Elemental Affinity',
                'Cold',
                'chosenType',
                'test-campaign'
            );
        });

        it('logs ability_use with "set to" for first selection', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Acid');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type set to Acid',
            });
        });

        it('logs ability_use with "changed to" when type changes', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Cold');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type changed to Cold',
            });
        });

        it('uses custom damageTypes for validation', async () => {
            const action = makeAction({ automation: { damageTypes: ['Fire', 'Cold'] } });
            const result = await applyTypeChoice(action, makePlayerStats(), 'test-campaign', 'Lightning');

            expect(result).toBeNull();
        });

        it('returns popup with correct automation info', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Poison');

            expect(result.payload.automation).toBeDefined();
            expect(result.payload.automation.type).toBe('elemental_affinity');
        });
    });
});
