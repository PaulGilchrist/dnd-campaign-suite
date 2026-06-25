// @improved-by-ai
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
    describe('when already used this long rest', () => {
        it('returns a popup stating the ability was already used', async () => {
            getRuntimeValue.mockReturnValue(true);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Endurance');
            expect(result.payload.description).toContain('already been used');
            expect(result.payload.description).toContain('once per long rest');
        });

        it('does not call setRuntimeValue', async () => {
            getRuntimeValue.mockReturnValue(true);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('when player is not at 0 HP', () => {
        it('returns a popup when current HP is above 0', async () => {
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

        it('returns a popup when current HP is 1', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'relentlessEnduranceUsed') return false;
                if (key === 'currentHitPoints') return 1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not at 0 Hit Points');
        });
    });

    describe('when player is at 0 HP and ability is available', () => {
        it('marks the ability as used', async () => {
            mockAt0Hp();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'relentlessEnduranceUsed',
                true,
                campaignName,
            );
        });

        it('sets current HP to 1', async () => {
            mockAt0Hp();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'currentHitPoints',
                1,
                campaignName,
            );
        });

        it('resets death saves and death failures', async () => {
            mockAt0Hp(false, []);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

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
        });

        it('removes unconscious condition while preserving others', async () => {
            mockAt0Hp(false, ['unconscious', 'poisoned', 'frightened']);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                ['poisoned', 'frightened'],
                campaignName,
            );
        });

        it('handles empty conditions array', async () => {
            mockAt0Hp(false, []);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'activeConditions',
                [],
                campaignName,
            );
        });

        it('handles undefined conditions as empty array', async () => {
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

        it('dispatches a combat-summary-updated event', async () => {
            mockAt0Hp();

            const mockDispatch = vi.fn();
            vi.spyOn(window, 'dispatchEvent').mockImplementation(mockDispatch);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));
        });

        it('returns a success popup with name and description', async () => {
            mockAt0Hp();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Relentless Endurance');
            expect(result.payload.description).toContain('survive');
            expect(result.payload.description).toContain('1 HP');
        });

        it('includes the automation object in the popup payload', async () => {
            mockAt0Hp();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual({ type: 'relentless_endurance' });
        });
    });

    describe('isRelentlessEnduranceUsed', () => {
        it('returns true when the runtime value is true', () => {
            getRuntimeValue.mockReturnValue(true);

            expect(isRelentlessEnduranceUsed('ClericBoy', campaignName)).toBe(true);
        });

        it('returns false when the runtime value is false', () => {
            getRuntimeValue.mockReturnValue(false);

            expect(isRelentlessEnduranceUsed('ClericBoy', campaignName)).toBe(false);
        });

        it('returns false when the runtime value is null', () => {
            getRuntimeValue.mockReturnValue(null);

            expect(isRelentlessEnduranceUsed('ClericBoy', campaignName)).toBe(false);
        });
    });

    describe('setRelentlessEnduranceUsed', () => {
        it('sets the used flag to true', async () => {
            await setRelentlessEnduranceUsed('ClericBoy', campaignName, true);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'ClericBoy',
                'relentlessEnduranceUsed',
                true,
                campaignName,
            );
        });

        it('sets the used flag to false', async () => {
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
