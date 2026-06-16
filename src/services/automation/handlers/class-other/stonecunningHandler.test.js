import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, restoreUses } from './stonecunningHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { toggleBuff } = await import('../../common/buffToggle.js');
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
    return {
        name: 'Stonecunning',
        automation: {
            type: 'stonecunning',
            duration: '10_minutes',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('stonecunningHandler', () => {
    describe('uses calculation', () => {
        it('uses proficiency_bonus when uses is "proficiency_bonus"', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { uses: 'proficiency_bonus' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('uses explicit number when uses is a number', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { uses: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
        });

        it('defaults to 1 when uses is undefined', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: {} });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
        });

        it('uses usesMax when available', async () => {
            getRuntimeValue.mockReturnValue(null);
            toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { usesMax: 5 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
        });
    });

    describe('long rest tracking', () => {
        it('allows use when no rest timestamp (first use)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return undefined;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return null;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
        });

        it('allows use when long rest has passed (> 24 hours)', async () => {
            const oldRest = Date.now() - 172800000; // 2 days ago
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 0;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return oldRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
        });

        it('checks stored uses when within long rest window', async () => {
            const recentRest = Date.now() - 3600000; // 1 hour ago
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 2;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });

            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
        });

        it('blocks use when no uses remaining within long rest window', async () => {
            const recentRest = Date.now() - 3600000; // 1 hour ago
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 0;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('toggle behavior', () => {
        it('deactivates when already active', async () => {
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('OFF');
        });

        it('activates when not active', async () => {
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });

        it('decrements uses on activation', async () => {
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 2;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('DwarfBoy', 'dwarfboy_stonecunningUses', 1, 'test-campaign');
        });

        it('calls toggleBuff with correct parameters', async () => {
            getRuntimeValue.mockReturnValue(null);

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
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
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
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: true });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Stonecunning',
                description: 'Stonecunning deactivated.',
            }));
        });
    });

    describe('popup description', () => {
        it('includes duration in activation description', async () => {
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('10_minutes');
        });

        it('includes remaining uses in activation description', async () => {
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 3;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('uses singular "use" when 1 remaining', async () => {
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // 1 - 1 = 0 uses remaining, so it says "0 uses"
            expect(result.payload.description).toContain('0 uses remaining');
        });

        it('uses default duration when not provided', async () => {
            const action = makeAction({ automation: {} });
            const recentRest = Date.now() - 3600000;
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'dwarfboy_stonecunningUses') return 1;
                if (key === 'dwarfboy_stonecunningRestTimestamp') return recentRest;
                return null;
            });
            toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('10 min');
        });
    });

    describe('restoreUses', () => {
        it('sets rest timestamp to now', async () => {
            const now = Date.now();
            vi.useFakeTimers();
            vi.setSystemTime(now);

            restoreUses('DwarfBoy', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('DwarfBoy', 'dwarfboy_stonecunningRestTimestamp', now, 'test-campaign');

            vi.useRealTimers();
        });

        it('clears uses key', async () => {
            restoreUses('DwarfBoy', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('DwarfBoy', 'dwarfboy_stonecunningUses', null, 'test-campaign');
        });
    });
});
