import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isRelentlessEnduranceUsed, setRelentlessEnduranceUsed } from './relentlessEnduranceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

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
        name: 'Relentless Endurance',
        automation: {
            type: 'relentless_endurance',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('relentlessEnduranceHandler', () => {
    describe('already used this long rest', () => {
        it('returns popup when already used', async () => {
            getRuntimeValue.mockReturnValue(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already been used');
            expect(result.payload.description).toContain('once per long rest');
        });

        it('does not modify any state when already used', async () => {
            getRuntimeValue.mockReturnValue(true);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('player not at 0 HP', () => {
        it('returns popup when current HP is above 0', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not at 0 Hit Points');
        });

        it('returns popup when current HP is 1', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not at 0 Hit Points');
        });

        it('returns popup when current HP is null (defaults to 0)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') null;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // currentHp is 0 (from ?? 0), which is NOT > 0, so it proceeds
            // This tests the edge case where currentHp defaults to 0
            expect(result.type).toBe('popup');
        });
    });

    describe('successful activation at 0 HP', () => {
        it('sets relentlessEnduranceUsed to true', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'relentlessEnduranceUsed', true, 'test-campaign');
        });

        it('sets currentHitPoints to 1', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'currentHitPoints', 1, 'test-campaign');
        });

        it('resets death saves to all false', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                if (key === 'deathSaves') return [true, false, false];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'deathSaves', [false, false, false], 'test-campaign');
        });

        it('resets death failures to all false', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                if (key === 'deathFailures') return [false, true, false];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'deathFailures', [false, false, false], 'test-campaign');
        });

        it('removes unconscious condition', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                if (key === 'activeConditions') return ['unconscious', 'blinded'];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                ['blinded'],
                'test-campaign'
            );
        });

        it('preserves other conditions while removing unconscious', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                if (key === 'activeConditions') return ['unconscious', 'poisoned', 'frightened'];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                ['poisoned', 'frightened'],
                'test-campaign'
            );
        });

        it('dispatches combat-summary-updated event', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                return null;
            });

            const mockDispatch = vi.fn();
            const originalDispatch = window.dispatchEvent;
            window.dispatchEvent = mockDispatch;

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));

            window.dispatchEvent = originalDispatch;
        });

        it('returns popup with success description', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Endurance');
            expect(result.payload.description).toContain('survive');
            expect(result.payload.description).toContain('1 HP');
        });
    });

    describe('isRelentlessEnduranceUsed', () => {
        it('returns true when used', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(isRelentlessEnduranceUsed('ClericBoy', 'test-campaign')).toBe(true);
        });

        it('returns false when not used', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(isRelentlessEnduranceUsed('ClericBoy', 'test-campaign')).toBe(false);
        });

        it('returns false when null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isRelentlessEnduranceUsed('ClericBoy', 'test-campaign')).toBe(false);
        });
    });

    describe('setRelentlessEnduranceUsed', () => {
        it('sets the used flag to the provided value', async () => {
            await setRelentlessEnduranceUsed('ClericBoy', 'test-campaign', true);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'relentlessEnduranceUsed', true, 'test-campaign');
        });

        it('can set used flag to false', async () => {
            await setRelentlessEnduranceUsed('ClericBoy', 'test-campaign', false);

            expect(setRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'relentlessEnduranceUsed', false, 'test-campaign');
        });
    });
});
