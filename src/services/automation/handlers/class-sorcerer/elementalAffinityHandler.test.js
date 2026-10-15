// @maintained-by-ai
// Handler-only lane for Elemental Affinity (2024 Draconic Sorcery): the damage-type
// choice modal payload, the valid-type guard, chosenType store + "set to"/"changed to"
// log copy, and the Fiendish Resilience DELEGATION pins (fiendishResilienceHandler.test.js
// owns that handler's internals; ElementalAffinityModal.test.jsx and
// useCharActionsAutomation.test.js mock this handler and own the consumer lane —
// not re-pinned here).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyTypeChoice } from './elementalAffinityHandler.js';

vi.mock('../../common/choiceStorage.js', () => ({
    setChosenRuntimeValue: vi.fn(),
    getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../class-warlock/fiendishResilienceHandler.js', () => ({
    handle: vi.fn(),
    applyTypeChoice: vi.fn(),
}));

const { setChosenRuntimeValue, getChosenRuntimeValue } = await import('../../common/choiceStorage.js');
const { addEntry } = await import('../../../ui/logService.js');
const { handle: handleFiendishResilience, applyTypeChoice: applyFiendishResilience } = await import('../class-warlock/fiendishResilienceHandler.js');

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
        type: 'elemental_affinity',
        automation: {
            type: 'elemental_affinity',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('elementalAffinityHandler', () => {
    describe('handle', () => {
        it('returns modal with damage type options when no type has been chosen yet', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalAffinity');
            expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Poison']);
            expect(result.payload.existingType).toBeUndefined();
            expect(result.payload.action).toEqual(makeAction());
            expect(result.payload.playerStats).toEqual(makePlayerStats());
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('passes action-level damageTypes directly from action.damageTypes', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const action = makeAction({ damageTypes: ['Fire', 'Cold'] });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.damageTypes).toEqual(['Fire', 'Cold']);
        });

        it('returns modal with existingType and logs ability_use when a type has been chosen', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('elementalAffinity');
            expect(result.payload.existingType).toBe('Fire');
            expect(result.payload.damageTypes).toEqual(['Acid', 'Cold', 'Fire', 'Lightning', 'Poison']);
            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type is Fire',
            });
        });

        it('passes automation-level damageTypes from action.automation.damageTypes', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            const action = makeAction({ automation: { damageTypes: ['Lightning', 'Poison'] } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.damageTypes).toEqual(['Lightning', 'Poison']);
        });

        it('delegates to Fiendish Resilience handler when action name is Fiendish Resilience', async () => {
            handleFiendishResilience.mockResolvedValue({ type: 'modal', payload: {} });

            const action = { name: 'Fiendish Resilience', automation: { type: 'fiendish_resilience' } };
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(handleFiendishResilience).toHaveBeenCalledWith(action, makePlayerStats(), 'test-campaign', null);
            expect(result).toEqual({ type: 'modal', payload: {} });
        });
    });

    describe('applyTypeChoice', () => {
        it('returns null and does not store or log for damage type not in the valid list', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Radiant');

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns null for damage type not in custom damageTypes list', async () => {
            const action = makeAction({ automation: { damageTypes: ['Fire', 'Cold'] } });
            const result = await applyTypeChoice(action, makePlayerStats(), 'test-campaign', 'Lightning');

            expect(result).toBeNull();
            expect(setChosenRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('stores the chosen type and returns popup with confirmation details for a valid damage type', async () => {
            const result = await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Fire');

            expect(setChosenRuntimeValue).toHaveBeenCalledWith(
                expect.any(Object),
                'Elemental Affinity',
                'Fire',
                'chosenType',
                'test-campaign',
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Elemental Affinity');
            expect(result.payload.description).toContain('Fire selected');
            expect(result.payload.description).toContain('resistance to Fire damage');
            expect(result.payload.automationType).toBe('elemental_affinity');
            expect(result.payload.automation).toBeDefined();
        });

        it('logs ability_use with "set to" when no type was previously chosen', async () => {
            getChosenRuntimeValue.mockReturnValue(undefined);

            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Acid');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type set to Acid',
            });
        });

        it('logs ability_use with "changed to" when switching to a different type', async () => {
            getChosenRuntimeValue.mockReturnValue('Fire');

            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Cold');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type changed to Cold',
            });
        });

        it('logs ability_use with "set to" when reselecting the same type', async () => {
            getChosenRuntimeValue.mockReturnValue('Poison');

            await applyTypeChoice(makeAction(), makePlayerStats(), 'test-campaign', 'Poison');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'SorcererBoy',
                abilityName: 'Elemental Affinity',
                description: 'Elemental Affinity — damage type set to Poison',
            });
        });

        it('delegates to Fiendish Resilience handler when action name is Fiendish Resilience', async () => {
            applyFiendishResilience.mockResolvedValue({ type: 'popup', payload: {} });

            const action = { name: 'Fiendish Resilience', automation: { type: 'fiendish_resilience' } };
            const result = await applyTypeChoice(action, makePlayerStats(), 'test-campaign', 'Fire');

            expect(applyFiendishResilience).toHaveBeenCalledWith(action, makePlayerStats(), 'test-campaign', 'Fire');
            expect(result).toEqual({ type: 'popup', payload: {} });
        });

        it('returns popup with Elemental Adept description when action.effect is elemental_adept', async () => {
            const action = makeAction({ effect: 'elemental_adept' });
            const result = await applyTypeChoice(action, makePlayerStats(), 'test-campaign', 'Fire');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Fire selected');
            expect(result.payload.description).toContain('ignore Resistance');
            expect(result.payload.description).toContain('treat any 1 on a damage die as a 2');
            expect(result.payload.description).not.toContain('resistance to Fire damage');
        });
    });
});
