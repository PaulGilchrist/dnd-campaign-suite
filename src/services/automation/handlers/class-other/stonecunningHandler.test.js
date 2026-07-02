// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, restoreUses } from './stonecunningHandler.js';
import { toggleBuff } from '../../common/buffToggle.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'DwarfBoy',
        proficiency: 2,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    const auto = {
        type: 'stonecunning',
        duration: '10_minutes',
        ...(overrides.automation || {}),
    };
    const rest = {};
    for (const [key, value] of Object.entries(overrides)) {
        if (key !== 'automation') rest[key] = value;
    }
    return {
        name: 'Stonecunning',
        automation: auto,
        ...rest,
    };
}

function expectSuccessfulActivation(result) {
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Stonecunning');
    expect(result.payload.automationType).toBe('stonecunning');
}

function expectNoUsesRemaining(result) {
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Stonecunning');
    expect(result.payload.automationType).toBe('stonecunning');
    expect(result.payload.description).toContain('no uses remaining');
    expect(result.payload.description).toContain('Long Rest');
}

describe('stonecunningHandler', () => {
    describe('uses calculation', () => {
        it('calculates usesMax from proficiency_bonus', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { uses: 'proficiency_bonus' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('activated');
            // proficiency_bonus=2, so newUses=1, "1 use remaining"
            expect(result.payload.description).toContain('1 use remaining');
        });

        it('calculates usesMax from explicit number', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { uses: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            // 3 - 1 = 2 uses remaining
            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('defaults to usesMax=1 when uses is undefined and no usesMax', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: {} });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            // 1 - 1 = 0 uses remaining
            expect(result.payload.description).toContain('0 uses remaining');
        });

        it('uses usesMax when provided and uses is not a special value', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { usesMax: 5 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            // usesMax=5, so newUses=4
            expect(result.payload.description).toContain('4 uses remaining');
        });

        it('prefers uses over usesMax when both are numbers', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { uses: 2, usesMax: 10 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            // uses=2 takes precedence, so newUses=1
            expect(result.payload.description).toContain('1 use remaining');
        });
    });

    describe('long rest tracking', () => {
        it('starts fresh with usesMax when no stored value', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('uses stored uses when available', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 2;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('1 use remaining');
        });

        it('blocks activation when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectNoUsesRemaining(result);
            expect(toggleBuff).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('treats stored non-numeric value as usesMax', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 'abc';
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction({ automation: { usesMax: 3 } }), makePlayerStats(), 'test-campaign', null);

            // Number('abc') = NaN, NaN > 0 is false, so this should block
            expectNoUsesRemaining(result);
        });
    });

    describe('toggle behavior', () => {
        it('deactivates when the buff is already active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('toggled OFF');
        });

        it('activates when the buff is not active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
        });

        it('decrements uses on activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 3;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'DwarfBoy',
                'dwarfboy_stonecunningUses',
                2,
                'test-campaign'
            );
        });

        it('does not decrement uses on deactivation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 3;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: true });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // Deactivation should not call setRuntimeValue for uses
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'DwarfBoy',
                'dwarfboy_stonecunningUses',
                expect.anything(),
                'test-campaign'
            );
        });

        it('calls toggleBuff with correct parameters', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(toggleBuff).toHaveBeenCalledWith(
                'DwarfBoy',
                'Stonecunning',
                expect.objectContaining({
                    type: 'stonecunning',
                    duration: '10_minutes',
                }),
                'test-campaign',
                'DwarfBoy'
            );
        });

        it('logs ability use on activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'DwarfBoy',
                abilityName: 'Stonecunning',
            }));
        });

        it('logs ability use on deactivation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: true });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'DwarfBoy',
                abilityName: 'Stonecunning',
                description: 'Stonecunning deactivated.',
            }));
        });
    });

    describe('popup description', () => {
        it('includes duration in activation description', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('10_minutes');
        });

        it('includes remaining uses count in activation description', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 3;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('uses singular "use" when exactly 1 remaining after activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 2;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('1 use remaining');
        });

        it('uses plural "uses" when more than 1 remaining after activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 5;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('4 uses remaining');
        });

        it('uses default duration when not provided', async () => {
            const action = {
                name: 'Stonecunning',
                automation: {
                    type: 'stonecunning',
                },
            };
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('10 min');
        });

        it('includes custom duration when provided', async () => {
            const action = makeAction({ automation: { duration: '1_hour' } });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('1_hour');
        });
    });

    describe('player name handling', () => {
        it('builds usesKey from player name with spaces replaced', async () => {
            const stats = makePlayerStats({ name: 'Dwarf Boy' });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), stats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Dwarf Boy',
                'dwarfboy_stonecunningUses',
                0,
                'test-campaign'
            );
        });

        it('uses action.name for featureName when provided', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ name: 'Custom Stonecunning' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Custom Stonecunning');
            expect(result.payload.description).toContain('Custom Stonecunning');
        });
    });

    describe('restoreUses', () => {
        it('clears uses key by setting to null', () => {
            restoreUses('DwarfBoy', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'DwarfBoy',
                'dwarfboy_stonecunningUses',
                null,
                'test-campaign'
            );
        });

        it('handles player names with spaces', () => {
            restoreUses('Dwarf Boy', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Dwarf Boy',
                'dwarfboy_stonecunningUses',
                null,
                'test-campaign'
            );
        });
    });
});
