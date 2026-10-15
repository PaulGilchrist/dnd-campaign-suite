// @maintained-by-ai
// Canonical internals home for Fiendish Resilience (2024 Warlock Fiend Patron):
// handle() modal payload + default DAMAGE_TYPES fallback, the once-per-rest refusal
// latch, applyTypeChoice store + used-latch writes, invalid/falsy rejection with
// no-side-effect guards, and the "set to"/"changed to" own-composition log copy.
// Owned elsewhere: CLA-140 short/long-rest clearing of _fiendishResilienceUsed is
// pinned in restRules-constants.cla140-fiendish-resilience.test.js; passive
// resistance collection in automationPassives.test.js; consumer modal routing in
// useCharActionsAutomation.test.js; sorcerer Elemental Affinity delegation to this
// handler is pinned (delegation only) in elementalAffinityHandler.test.js.
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

const DEFAULT_DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];

function makeFeature(overrides = {}) {
    return {
        name: 'Fiendish Resilience',
        automation: {
            damageTypes: DEFAULT_DAMAGE_TYPES,
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
        it('returns modal with damageTypes when no type has been chosen and ignores the _mapName parameter', async () => {
            getChosenRuntimeValue.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN, 'some-map-name');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('fiendishResilience');
            expect(result.payload.damageTypes).toEqual(DEFAULT_DAMAGE_TYPES);
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
            expect(result.payload.damageTypes).toEqual(DEFAULT_DAMAGE_TYPES);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Fiendish Resilience',
                description: 'Fiendish Resilience — damage type is Fire',
            }));
        });

        it('treats empty string chosenType as no type chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('');
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature(), makeStats(), CAMPAIGN);

            expect(result.type).toBe('modal');
            expect(result.payload.existingType).toBeUndefined();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses with a short-or-long-rest refusal popup and logs the refusal when the used latch stands', async () => {
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
            // Refusal must not touch the choice or latch stores.
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it.each([
            { chosenType: null, label: 'no type chosen' },
            { chosenType: 'Fire', label: 'existing type chosen' },
        ])('falls back to default DAMAGE_TYPES when automation has no damageTypes (%s)', async ({ chosenType }) => {
            getChosenRuntimeValue.mockReturnValue(chosenType);
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeFeature({ automation: {} }), makeStats(), CAMPAIGN);

            expect(result.payload.damageTypes).toEqual(DEFAULT_DAMAGE_TYPES);
        });
    });

    describe('applyTypeChoice', () => {
        it('stores chosen type, sets the used latch, returns popup and logs "set to"', async () => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await applyTypeChoice(
                makeFeature({ automation: { type: 'fiendish_resilience', damageTypes: ['Fire', 'Cold'] } }),
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
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCharacter',
                '_fiendishResilienceUsed',
                true,
                CAMPAIGN,
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fiendish Resilience');
            expect(result.payload.automationType).toBe('fiendish_resilience');
            expect(result.payload.description).toContain('Fire');
            expect(result.payload.description).toContain('resistance');
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Fiendish Resilience',
                description: 'Fiendish Resilience — damage type set to Fire',
            }));
        });

        it('logs "changed to" when type is switched', async () => {
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

        it.each([
            { invalid: 'Force', label: 'type not in the list' },
            { invalid: '', label: 'empty string' },
            { invalid: undefined, label: 'undefined' },
            { invalid: null, label: 'null' },
        ])('rejects invalid chosenType (%s) with no store, latch, or log writes', async ({ invalid }) => {
            getChosenRuntimeValue.mockReturnValue(null);

            const result = await applyTypeChoice(
                makeFeature({ automation: { damageTypes: ['Fire', 'Cold'] } }),
                makeStats(),
                CAMPAIGN,
                invalid,
            );

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
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
