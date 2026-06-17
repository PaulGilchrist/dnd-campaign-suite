import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isLivingLegendActive, hasUnerringStrikeUsed, setUnerringStrikeUsed } from './livingLegendHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'ClericBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Living Legend',
        automation: {
            type: 'living_legend',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('livingLegendHandler', () => {
    describe('handle', () => {
        it('returns popup with automation_info', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Living Legend');
        });

        it('includes automationType in payload', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automationType).toBe('living_legend');
        });

        it('includes description with effects', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Charisma checks have advantage');
            expect(result.payload.description).toContain('reroll failed saving throws');
            expect(result.payload.description).toContain('missed weapon attacks hit once per turn');
        });

        it('includes automation in payload', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automation).toBeInstanceOf(Object);
        });

        it('calls setRuntimeValue to activate living legend', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'livingLegendActive',
                true,
                'test-campaign'
            );
        });

        it('calls addEntry with ability_use type', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'ClericBoy',
                abilityName: 'Living Legend',
                description: expect.stringContaining('activated Living Legend'),
                timestamp: expect.any(Number),
            });
        });

        it('uses custom action name in description', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const action = makeAction({ name: 'Custom Legendary Ability' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Custom Legendary Ability');
        });
    });

    describe('isLivingLegendActive', () => {
        it('returns true when value is true', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(isLivingLegendActive('ClericBoy', 'test-campaign')).toBe(true);
        });

        it('returns false when value is false', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(isLivingLegendActive('ClericBoy', 'test-campaign')).toBe(false);
        });

        it('returns false when value is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(isLivingLegendActive('ClericBoy', 'test-campaign')).toBe(false);
        });

        it('returns false when value is null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isLivingLegendActive('ClericBoy', 'test-campaign')).toBe(false);
        });
    });

    describe('hasUnerringStrikeUsed', () => {
        it('returns true when value is true', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(hasUnerringStrikeUsed('ClericBoy', 'test-campaign')).toBe(true);
        });

        it('returns false when value is false', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(hasUnerringStrikeUsed('ClericBoy', 'test-campaign')).toBe(false);
        });

        it('returns false when value is undefined', () => {
            getRuntimeValue.mockReturnValue(undefined);

            expect(hasUnerringStrikeUsed('ClericBoy', 'test-campaign')).toBe(false);
        });
    });

    describe('setUnerringStrikeUsed', () => {
        it('sets the value to true', async () => {
            await setUnerringStrikeUsed('ClericBoy', 'test-campaign', true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'unerringStrikeUsed',
                true,
                'test-campaign'
            );
        });

        it('sets the value to false', async () => {
            await setUnerringStrikeUsed('ClericBoy', 'test-campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'unerringStrikeUsed',
                false,
                'test-campaign'
            );
        });
    });
});
