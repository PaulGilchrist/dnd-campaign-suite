import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isRelentlessEnduranceUsed, setRelentlessEnduranceUsed } from './relentlessEnduranceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

const campaignName = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return { name: 'ClericBoy', ...overrides };
}

function makeAction(overrides = {}) {
    return {
        name: 'Relentless Endurance',
        automation: { type: 'relentless_endurance', ...overrides.automation },
        ...overrides,
    };
}

function mockAt0Hp(unused = false, conditions = []) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'relentlessEnduranceUsed') return unused;
        if (key === 'currentHitPoints') return 0;
        if (key === 'activeConditions') return conditions;
        return null;
    });
}

describe('relentlessEnduranceHandler', () => {
    describe('guard conditions', () => {
        it('returns an info popup when the ability was already used this long rest', async () => {
            getRuntimeValue.mockReturnValue(true);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Endurance');
            expect(result.payload.description).toContain('already been used');
            expect(result.payload.description).toContain('once per long rest');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns an info popup when the player is not at 0 HP', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 5;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Endurance');
            expect(result.payload.description).toContain('not at 0 Hit Points');
        });
    });

    describe('successful activation', () => {
        it('sets the ability as used, restores HP to 1, resets death saves, removes unconscious, and returns a success popup', async () => {
            mockAt0Hp(false, ['unconscious', 'poisoned', 'frightened']);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Endurance');
            expect(result.payload.description).toContain('survive');
            expect(result.payload.description).toContain('1 HP');
            expect(result.payload.automation).toEqual({ type: 'relentless_endurance' });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'relentlessEnduranceUsed',
                true,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'currentHitPoints',
                1,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'deathSaves',
                [false, false, false],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'deathFailures',
                [false, false, false],
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                ['poisoned', 'frightened'],
                campaignName,
            );
        });

        it('handles empty conditions gracefully', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                [],
                campaignName,
            );
        });

        it('handles conditions with no unconscious to filter', async () => {
            mockAt0Hp(false, ['poisoned', 'frightened']);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                ['poisoned', 'frightened'],
                campaignName,
            );
        });

        it('handles undefined activeConditions gracefully', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 0;
                if (key === 'activeConditions') return undefined;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                [],
                campaignName,
            );
        });
    });

    describe('isRelentlessEnduranceUsed', () => {
        it('returns true when the ability was used', () => {
            getRuntimeValue.mockReturnValue(true);

            const result = isRelentlessEnduranceUsed('ClericBoy', campaignName);

            expect(result).toBe(true);
            expect(getRuntimeValue).toHaveBeenCalledWith('ClericBoy', 'relentlessEnduranceUsed', campaignName);
        });

        it('returns false when the ability was not used', () => {
            getRuntimeValue.mockReturnValue(false);

            const result = isRelentlessEnduranceUsed('ClericBoy', campaignName);

            expect(result).toBe(false);
        });

        it('returns false when the ability key is not set', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = isRelentlessEnduranceUsed('ClericBoy', campaignName);

            expect(result).toBe(false);
        });
    });

    describe('setRelentlessEnduranceUsed', () => {
        it('sets the ability as used when true', async () => {
            await setRelentlessEnduranceUsed('ClericBoy', campaignName, true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'relentlessEnduranceUsed',
                true,
                campaignName,
            );
        });

        it('sets the ability as not used when false', async () => {
            await setRelentlessEnduranceUsed('ClericBoy', campaignName, false);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'relentlessEnduranceUsed',
                false,
                campaignName,
            );
        });
    });
});
