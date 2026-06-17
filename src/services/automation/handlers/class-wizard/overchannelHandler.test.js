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

        it('includes description with uses remaining Yes when max uses available', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Uses remaining: Yes');
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
        it('returns MAX_USES (1) when no stored values exist', () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(1);
        });

        it('returns stored uses when rest timestamp exists and is within 24 hours', () => {
            const now = Date.now();
            const recentRest = now - 3600000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_restTimestamp') return recentRest;
                if (key === '_Overchannel_uses') return 0;
                return undefined;
            });

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(0);
        });

        it('returns stored uses when no rest timestamp exists', () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_restTimestamp') return undefined;
                if (key === '_Overchannel_uses') return 0;
                return undefined;
            });

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(0);
        });

        it('returns MAX_USES when rest timestamp is older than 24 hours', () => {
            const now = Date.now();
            const oldRest = now - 172800000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_restTimestamp') return oldRest;
                return undefined;
            });

            const result = getOverchannelUses(makePlayerStats(), 'test-campaign');

            expect(result).toBe(1);
        });
    });

    describe('hasOverchannelRemaining', () => {
        it('returns true when uses > 0', () => {
            getRuntimeValue.mockReturnValue(1);

            expect(hasOverchannelRemaining(makePlayerStats(), 'test-campaign')).toBe(true);
        });

        it('returns false when uses <= 0', () => {
            getRuntimeValue.mockReturnValue(0);

            expect(hasOverchannelRemaining(makePlayerStats(), 'test-campaign')).toBe(false);
        });
    });

    describe('consumeOverchannelUse', () => {
        it('returns true and decrements when uses available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_uses') return 1;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_Overchannel_uses',
                0,
                'test-campaign'
            );
        });

        it('returns false when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_uses') return 0;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns true and decrements when rest timestamp exists within 24 hours', async () => {
            const now = Date.now();
            const recentRest = now - 3600000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_restTimestamp') return recentRest;
                if (key === '_Overchannel_uses') return 1;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_Overchannel_uses',
                0,
                'test-campaign'
            );
        });

        it('resets to MAX_USES when rest timestamp is older than 24 hours', async () => {
            const now = Date.now();
            const oldRest = now - 172800000;
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === '_Overchannel_restTimestamp') return oldRest;
                return undefined;
            });

            const result = await consumeOverchannelUse(makePlayerStats(), 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_Overchannel_uses',
                0,
                'test-campaign'
            );
        });
    });

    describe('restoreOverchannelOnLongRest', () => {
        it('sets rest timestamp and resets uses to MAX_USES', async () => {
            await restoreOverchannelOnLongRest(makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_Overchannel_restTimestamp',
                expect.any(Number),
                'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WizardBoy',
                '_Overchannel_uses',
                1,
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
