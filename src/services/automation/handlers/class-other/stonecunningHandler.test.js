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

function expectSuccessfulActivation(result, customName) {
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe(customName || 'Stonecunning');
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
            expect(result.payload.description).toContain('1 use remaining');
        });

        it('uses usesMax when provided and uses is not a special value', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { usesMax: 5 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('4 uses remaining');
        });

        it('prefers uses over usesMax when both are numbers', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { uses: 2, usesMax: 10 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
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

        it('uses stored uses when available and blocks when zero', async () => {
            // Stored uses = 2
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 2;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectSuccessfulActivation(result);
            expect(result.payload.description).toContain('1 use remaining');
        });

        it('treats stored non-numeric value as no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 'abc';
                return null;
            });

            const result = await handle(makeAction({ automation: { usesMax: 3 } }), makePlayerStats(), 'test-campaign', null);

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

        it('decrements uses on activation but not on deactivation', async () => {
            // Activation: uses = 3 -> 2
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 3;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'DwarfBoy', 'dwarfboy_stonecunningUses', 2, 'test-campaign'
            );

            // Deactivation: uses stays at 3
            vi.clearAllMocks();
            toggleBuff.mockReturnValue({ wasActive: true });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'DwarfBoy', 'dwarfboy_stonecunningUses', expect.anything(), 'test-campaign'
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

        it('logs ability use on activation and deactivation', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'DwarfBoy',
                abilityName: 'Stonecunning',
            }));

            vi.clearAllMocks();
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
        it('uses correct singular/plural "use" based on remaining count', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });

            // 2 -> 1 remaining (singular)
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 2;
                return null;
            });
            let result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('1 use remaining');

            // 5 -> 4 remaining (plural)
            vi.clearAllMocks();
            toggleBuff.mockReturnValue({ wasActive: false });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 5;
                return null;
            });
            result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);
            expect(result.payload.description).toContain('4 uses remaining');
        });

        it('includes custom duration when provided, default otherwise', async () => {
            toggleBuff.mockReturnValue({ wasActive: false });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                return null;
            });

            let result = await handle(
                makeAction({ automation: { duration: '1_hour' } }),
                makePlayerStats(),
                'test-campaign',
                null
            );
            expect(result.payload.description).toContain('1_hour');

            vi.clearAllMocks();
            toggleBuff.mockReturnValue({ wasActive: false });

            result = await handle(
                { name: 'Stonecunning', automation: { type: 'stonecunning' } },
                makePlayerStats(),
                'test-campaign',
                null
            );
            expect(result.payload.description).toContain('10 min');
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
                'Dwarf Boy', 'dwarfboy_stonecunningUses', 0, 'test-campaign'
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
        it('clears uses key by setting to null for names with and without spaces', () => {
            restoreUses('DwarfBoy', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'DwarfBoy', 'dwarfboy_stonecunningUses', null, 'test-campaign'
            );

            vi.clearAllMocks();
            restoreUses('Dwarf Boy', 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Dwarf Boy', 'dwarfboy_stonecunningUses', null, 'test-campaign'
            );
        });
    });
});
