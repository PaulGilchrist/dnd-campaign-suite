// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyTypeChoice } from './fiendishResilienceHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/choiceStorage.js', () => ({
    getChosenRuntimeValue: vi.fn(),
    setChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocks after mocking ──────────────────────────────

import { getChosenRuntimeValue, setChosenRuntimeValue } from '../../common/choiceStorage.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';

function makeFeature(overrides = {}) {
    return {
        name: 'Fiendish Resilience',
        automation: {
            damageTypes: ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'],
        },
        ...overrides,
    };
}

function makeStats(overrides = {}) {
    return { name: 'TestCharacter', ...overrides };
}

// ── Tests ──────────────────────────────────────────────────────

describe('fiendishResilienceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal with damageTypes when no type has been chosen', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('fiendishResilience');
            expect(result.payload.damageTypes).toHaveLength(12);
            expect(result.payload.existingType).toBeUndefined();
            expect(result.payload.action).toEqual(expect.objectContaining({ name: 'Fiendish Resilience' }));
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe(CAMPAIGN);
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns modal with existingType when a type has already been chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('fiendishResilience');
            expect(result.payload.existingType).toBe('Fire');
            expect(result.payload.damageTypes).toHaveLength(12);
        });

        it('logs ability use when a type has already been chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('Cold');

            await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Fiendish Resilience',
                description: 'Fiendish Resilience — damage type is Cold',
            }));
        });

        it('uses custom damageTypes from feature automation', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const customTypes = ['Fire', 'Cold'];
            const result = await handle(makeFeature({ automation: { damageTypes: customTypes } }), makeStats(), CAMPAIGN);

            expect(result.payload.damageTypes).toEqual(customTypes);
        });

        it('passes through custom damageTypes when existing type is set', async () => {
            getChosenRuntimeValue.mockReturnValue('Poison');

            const customTypes = ['Fire', 'Poison', 'Necrotic'];
            const result = await handle(makeFeature({ automation: { damageTypes: customTypes } }), makeStats(), CAMPAIGN);

            expect(result.payload.damageTypes).toEqual(customTypes);
            expect(result.payload.existingType).toBe('Poison');
        });
    });

    describe('applyTypeChoice', () => {
        it('stores chosen type and returns popup when valid', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                'Fire',
            );

            expect(setChosenRuntimeValue).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'TestCharacter' }),
                'Fiendish Resilience',
                'Fire',
                'chosenType',
                CAMPAIGN,
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fiendish Resilience');
            expect(result.payload.description).toContain('Fire');
            expect(result.payload.description).toContain('resistance');
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                description: 'Fiendish Resilience — damage type set to Fire',
            }));
        });

        it('rejects invalid damage type', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                'Force',
            );

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('logs change when type is switched', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                'Cold',
            );

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                description: 'Fiendish Resilience — damage type changed to Cold',
            }));
        });

        it('allows re-selecting the same type', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            const result = await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                'Fire',
            );

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                description: 'Fiendish Resilience — damage type set to Fire',
            }));
        });
    });
});
