// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyTypeChoice } from './fiendishResilienceHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/choiceStorage.js', () => ({
    getChosenRuntimeValue: vi.fn(),
    setChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocks after mocking ──────────────────────────────

import { getChosenRuntimeValue, setChosenRuntimeValue } from '../../common/choiceStorage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
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
            getRuntimeValue.mockReturnValue(null);

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

        it('returns modal with existingType and logs ability_use when a type has already been chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('fiendishResilience');
            expect(result.payload.existingType).toBe('Fire');
            expect(result.payload.damageTypes).toHaveLength(12);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Fiendish Resilience',
                description: 'Fiendish Resilience — damage type is Fire',
            }));
        });

        it('refuses with a short-or-long-rest refusal popup and logs the refusal when used latch stands', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');
            getRuntimeValue.mockReturnValue(true);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fiendish Resilience');
            expect(result.payload.description).toContain('short or long rest');
            expect(result.payload.description).not.toContain('Finish a long rest');
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'automation',
                automationType: 'fiendish_resilience_refused',
                characterName: 'TestCharacter',
            }));
        });

        // CLA-140: a completed Short Rest nulls _fiendishResilienceUsed via
        // SHORT_REST_RESOURCES, so the latch reads falsy and handle() must
        // re-open the chooser instead of refusing.
        it('re-opens chooser after a short rest clears the used latch (CLA-140)', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');
            getRuntimeValue.mockImplementation((_name, key) =>
                key === '_fiendishResilienceUsed' ? null : undefined);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('fiendishResilience');
            expect(result.payload.existingType).toBe('Fire');
        });

        it.each([
            { chosenType: null, label: 'no type chosen' },
            { chosenType: 'Fire', label: 'existing type chosen' },
        ])('falls back to default DAMAGE_TYPES when automation has no damageTypes (%s)', async ({ chosenType }) => {
            getChosenRuntimeValue.mockReturnValue(chosenType);
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature({ automation: {} }), makeStats(), CAMPAIGN);

            expect(result.payload.damageTypes).toEqual(['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder']);
        });

        it('ignores the _mapName parameter', async () => {
            getChosenRuntimeValue.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN, 'some-map-name');

            expect(result.type).toBe('modal');
            expect(result.payload.campaignName).toBe(CAMPAIGN);
        });

        it('treats empty string chosenType as no type chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('');
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.payload.existingType).toBeUndefined();
            expect(addEntry).not.toHaveBeenCalled();
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

        it('marks feature as used when type is chosen', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                'Fire',
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCharacter',
                '_fiendishResilienceUsed',
                true,
                CAMPAIGN,
            );
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

        it('rejects falsy chosenType values (undefined, null)', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            for (const invalid of [undefined, null]) {
                vi.clearAllMocks();
                const result = await applyTypeChoice(
                    makeFeature(),
                    makeStats(),
                    CAMPAIGN,
                    invalid,
                );

                expect(result).toBeNull();
                expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            }
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

        it('logs "set to" when reselecting the same type', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                'Fire',
            );

            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                description: 'Fiendish Resilience — damage type set to Fire',
            }));
        });

        it('uses default DAMAGE_TYPES when automation has no damageTypes', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await applyTypeChoice(
                makeFeature({ automation: {} }),
                makeStats(),
                CAMPAIGN,
                'Fire',
            );

            expect(result).not.toBeNull();
            expect(setChosenRuntimeValue).toHaveBeenCalled();
        });

    });
});
