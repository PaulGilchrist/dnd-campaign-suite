import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handle,
    getOverchannelUses,
    hasOverchannelRemaining,
    consumeOverchannelUse,
    restoreOverchannelOnLongRest,
    getOverchannelNecroticDamage,
} from './overchannelHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(async () => {}),
    getRuntimeValue: vi.fn(),
}));

const { setRuntimeValue, getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'WizardBoy',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Overchannel',
        automation: {
            type: 'overchannel',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('overchannelHandler', () => {
    describe('handle', () => {
        it('returns popup with automation_info type', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Overchannel');
        });

        it('includes description with current use count', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('First use: no adverse effect');
        });

        it('includes description with correct action name', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Overchannel');
        });

        it('includes automation in payload', async () => {
            const action = makeAction({ automation: { type: 'overchannel', customField: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automation).toBe(action.automation);
        });
    });

    describe('getOverchannelUses', () => {
        it('returns 0 when no stored values exist', () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(0);
        });

        it('returns stored use count when rest timestamp exists and is within 24 hours', () => {
            const now = Date.now();
            const recentRest = now - 3600000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'Overchannel_restTimestamp') return recentRest;
                if (key === 'Overchannel_useCount') return 3;
                return undefined;
            });

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(3);
        });

        it('returns stored use count when no rest timestamp exists', () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'Overchannel_restTimestamp') return undefined;
                if (key === 'Overchannel_useCount') return 2;
                return undefined;
            });

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(2);
        });

        it('returns stored use count even when rest timestamp is older than 24 hours', () => {
            const now = Date.now();
            const oldRest = now - 172800000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'Overchannel_restTimestamp') return oldRest;
                if (key === 'Overchannel_useCount') return 5;
                return undefined;
            });

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(5);
        });
    });

    describe('hasOverchannelRemaining', () => {
        it('returns true (unlimited uses with damage)', () => {
            expect(hasOverchannelRemaining(makePlayerStats(), 'test-campaign')).toBe(true);
        });
    });

    describe('consumeOverchannelUse', () => {
        it('returns true and increments when no stored values exist', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                'Overchannel_useCount',
                1,
                'test-campaign'
            );
        });

        it('returns true and increments from stored value', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'Overchannel_useCount') return 2;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                'Overchannel_useCount',
                3,
                'test-campaign'
            );
        });

        it('increments when rest timestamp exists within 24 hours', async () => {
            const now = Date.now();
            const recentRest = now - 3600000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'Overchannel_restTimestamp') return recentRest;
                if (key === 'Overchannel_useCount') return 1;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                'Overchannel_useCount',
                2,
                'test-campaign'
            );
        });

        it('increments even when rest timestamp is older than 24 hours', async () => {
            const now = Date.now();
            const oldRest = now - 172800000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'Overchannel_restTimestamp') return oldRest;
                if (key === 'Overchannel_useCount') return 1;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                'Overchannel_useCount',
                2,
                'test-campaign'
            );
        });
    });

    describe('restoreOverchannelOnLongRest', () => {
        it('resets use count to 0', async () => {
            await restoreOverchannelOnLongRest(makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                'Overchannel_useCount',
                0,
                'test-campaign'
            );
        });
    });

    describe('getOverchannelNecroticDamage', () => {
        it('returns 0 damage when useCount <= 1', () => {
            const result = getOverchannelNecroticDamage(3, 1);

            expect(result).toBe(0);
        });

        it('returns correct formula for first additional use', () => {
            const result = getOverchannelNecroticDamage(3, 2);

            expect(result.formula).toBe('3d12');
            expect(result.damageType).toBe('Necrotic');
            expect(result.ignoresResistance).toBe(true);
            expect(result.ignoresImmunity).toBe(true);
            expect(result.perSpellLevel).toBe(true);
            expect(result.expression).toBe('9d12');
        });

        it('returns correct formula for second additional use', () => {
            const result = getOverchannelNecroticDamage(3, 3);

            expect(result.formula).toBe('4d12');
            expect(result.expression).toBe('12d12');
        });

        it('uses default spellLevel of 1 when not provided', () => {
            const result = getOverchannelNecroticDamage(null, 2);

            expect(result.expression).toBe('3d12');
        });

        it('uses provided spellLevel for expression calculation', () => {
            const result = getOverchannelNecroticDamage(5, 2);

            expect(result.expression).toBe('15d12');
        });
    });
});
