// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    handle,
    getOverchannelUses,
    hasOverchannelRemaining,
    consumeOverchannelUse,
    restoreOverchannelOnLongRest,
    getOverchannelNecroticDamage,
} from './overchannelHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

const mockPlayerStats = { name: 'TestWizard' };

beforeEach(() => {
    vi.restoreAllMocks();
});

function makeAction(overrides = {}) {
    return {
        name: 'Overchannel',
        automation: { type: 'overchannel', ...overrides.automation },
        ...overrides,
    };
}

describe('overchannelHandler', () => {
    describe('handle', () => {
        it('returns popup with automation_info type and correct payload structure', async () => {
            const result = await handle(makeAction(), mockPlayerStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Overchannel');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('describes first use as having no adverse effect', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(0);

            const result = await handle(makeAction(), mockPlayerStats, 'test-campaign', null);

            expect(result.payload.description).toContain('First use');
            expect(result.payload.description).toContain('no adverse effect');
        });

        it('describes subsequent uses with escalating necrotic damage', async () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(5);

            const result = await handle(makeAction(), mockPlayerStats, 'test-campaign', null);

            expect(result.payload.description).toContain('Use #6');
            expect(result.payload.description).toContain('12d12 necrotic damage');
        });

        it('uses the action name in the popup description', async () => {
            const result = await handle(makeAction(), mockPlayerStats, 'test-campaign', null);

            expect(result.payload.description).toContain('Overchannel');
        });

        it('uses custom action name when provided', async () => {
            const result = await handle(
                makeAction({ name: 'Custom Overchannel' }),
                mockPlayerStats,
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Custom Overchannel');
            expect(result.payload.description).toContain('Custom Overchannel');
        });

        it('passes through automation object unchanged', async () => {
            const customAutomation = { type: 'overchannel', customField: true };
            const result = await handle(
                makeAction({ automation: customAutomation }),
                mockPlayerStats,
                'test-campaign',
                null
            );

            expect(result.payload.automation).toBe(customAutomation);
        });
    });

    describe('getOverchannelUses', () => {
        it('returns 0 when no stored value exists', () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(undefined);

            const result = getOverchannelUses(mockPlayerStats, 'test-campaign');

            expect(result).toBe(0);
        });

        it('returns the stored use count as a number', () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(3);

            const result = getOverchannelUses(mockPlayerStats, 'test-campaign');

            expect(result).toBe(3);
        });

        it('coerces string values to numbers', () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('5');

            const result = getOverchannelUses(mockPlayerStats, 'test-campaign');

            expect(result).toBe(5);
        });

        it('returns 0 for falsy stored values', () => {
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(null);

            const result = getOverchannelUses(mockPlayerStats, 'test-campaign');

            expect(result).toBe(0);
        });
    });

    describe('hasOverchannelRemaining', () => {
        it('always returns true (unlimited uses feature)', () => {
            expect(hasOverchannelRemaining(mockPlayerStats, 'test-campaign')).toBe(true);
        });
    });

    describe('consumeOverchannelUse', () => {
        it('increments from 0 when no stored value exists', async () => {
            const setRuntimeValue = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(undefined);

            const result = await consumeOverchannelUse(mockPlayerStats, 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'Overchannel_useCount',
                1,
                'test-campaign'
            );
        });

        it('increments from the stored use count', async () => {
            const setRuntimeValue = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue(4);

            const result = await consumeOverchannelUse(mockPlayerStats, 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'Overchannel_useCount',
                5,
                'test-campaign'
            );
        });

        it('handles stored string values by coercing to number', async () => {
            const setRuntimeValue = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);
            vi.spyOn(runtimeState, 'getRuntimeValue').mockReturnValue('2');

            const result = await consumeOverchannelUse(mockPlayerStats, 'test-campaign');

            expect(result).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'Overchannel_useCount',
                3,
                'test-campaign'
            );
        });
    });

    describe('restoreOverchannelOnLongRest', () => {
        it('resets use count to 0', async () => {
            const setRuntimeValue = vi.spyOn(runtimeState, 'setRuntimeValue').mockResolvedValue(undefined);

            await restoreOverchannelOnLongRest(mockPlayerStats, 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'Overchannel_useCount',
                0,
                'test-campaign'
            );
        });
    });

    describe('getOverchannelNecroticDamage', () => {
        it('returns 0 when useCount is 0', () => {
            const result = getOverchannelNecroticDamage(3, 0);

            expect(result).toBe(0);
        });

        it('returns 0 when useCount is 1 (first use has no damage)', () => {
            const result = getOverchannelNecroticDamage(3, 1);

            expect(result).toBe(0);
        });

        it('returns correct formula for first additional use (useCount=2)', () => {
            const result = getOverchannelNecroticDamage(3, 2);

            expect(result.formula).toBe('3d12');
            expect(result.damageType).toBe('Necrotic');
            expect(result.ignoresResistance).toBe(true);
            expect(result.ignoresImmunity).toBe(true);
            expect(result.perSpellLevel).toBe(true);
            expect(result.expression).toBe('9d12');
        });

        it('returns correct formula for second additional use (useCount=3)', () => {
            const result = getOverchannelNecroticDamage(3, 3);

            expect(result.formula).toBe('4d12');
            expect(result.expression).toBe('12d12');
        });

        it('returns correct formula for third additional use (useCount=4)', () => {
            const result = getOverchannelNecroticDamage(3, 4);

            expect(result.formula).toBe('5d12');
            expect(result.expression).toBe('15d12');
        });

        it('uses default spellLevel of 1 when spellLevel is null', () => {
            const result = getOverchannelNecroticDamage(null, 2);

            expect(result.expression).toBe('3d12');
        });

        it('uses default spellLevel of 1 when spellLevel is undefined', () => {
            const result = getOverchannelNecroticDamage(undefined, 2);

            expect(result.expression).toBe('3d12');
        });

        it('uses provided spellLevel for expression calculation', () => {
            const result = getOverchannelNecroticDamage(5, 2);

            expect(result.expression).toBe('15d12');
        });

        it('treats spellLevel 0 as falsy and defaults to 1', () => {
            const result = getOverchannelNecroticDamage(0, 2);

            expect(result.expression).toBe('3d12');
        });
    });
});
