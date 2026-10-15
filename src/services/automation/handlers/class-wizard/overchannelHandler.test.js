// @maintained-by-ai
// overchannelHandler: deterministic automation popup handler, pure use-count
// helpers over the (mocked) runtime store, and the CLA-244 necrotic backlash
// damage table. No timers, no DOM — stable contract, no churn as the app moves.
//
// EXPORT LIVENESS (verified by grep 2026-10-15):
// - handle                    LIVE — automation/index.js router ('overchannel')
// - getOverchannelNecroticDamage LIVE — SpellDetailPopup.jsx (damage notice;
//                              also exercised via UI in SpellDetailPopup.overchannel.test.jsx)
// - getOverchannelUses      ORPHAN — popup reads 'Overchannel_useCount' directly
// - hasOverchannelRemaining ORPHAN — eligibility computed inline in popup/damageCalculation
// - consumeOverchannelUse   ORPHAN — live increment is computeOverchannel() in
//                              spellCastService/execution/damageCalculation.js (spellCastService.test.js)
// - restoreOverchannelOnLongRest ORPHAN — live reset is the restRules-longRest.js
//                              key table (restRules-longRest.test.js)
// Orphan helper tests kept as contract pins until a source-trim pass deletes
// the helpers alongside them.
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
const campaignName = 'test-campaign';

beforeEach(() => {
    vi.clearAllMocks();
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
            const result = await handle(makeAction(), mockPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Overchannel');
        });

        it('describes first use as having no adverse effect', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), mockPlayerStats, campaignName, null);

            expect(result.payload.description).toContain('First use');
            expect(result.payload.description).toContain('no adverse effect');
        });

        it('describes subsequent uses with escalating necrotic damage per spell slot level', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(5);

            const result = await handle(makeAction(), mockPlayerStats, campaignName, null);

            expect(result.payload.description).toContain('Use #6');
            expect(result.payload.description).toContain('6d12 necrotic damage per spell slot level');
        });

        it('uses custom action name when provided', async () => {
            const result = await handle(
                makeAction({ name: 'Custom Overchannel' }),
                mockPlayerStats,
                campaignName,
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
                campaignName,
                null
            );

            expect(result.payload.automation).toBe(customAutomation);
        });

        it('handles missing action.automation', async () => {
            const result = await handle(
                { name: 'Overchannel' },
                mockPlayerStats,
                campaignName,
                null
            );

            expect(result.payload.automation).toBeUndefined();
        });
    });

    describe('getOverchannelUses', () => {
        it('returns default 0 when no value stored, or the stored use count', () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            expect(getOverchannelUses(mockPlayerStats, campaignName)).toBe(0);

            runtimeState.getRuntimeValue.mockReturnValue(3);
            expect(getOverchannelUses(mockPlayerStats, campaignName)).toBe(3);
        });
    });

    describe('hasOverchannelRemaining', () => {
        it('always returns true (unlimited uses feature)', () => {
            expect(hasOverchannelRemaining(mockPlayerStats, campaignName)).toBe(true);
        });
    });

    describe('consumeOverchannelUse', () => {
        it('increments the use count and persists it', async () => {
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);
            runtimeState.getRuntimeValue.mockReturnValue(4);

            const result = await consumeOverchannelUse(mockPlayerStats, campaignName);

            expect(result).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'Overchannel_useCount',
                5,
                campaignName
            );
        });
    });

    describe('restoreOverchannelOnLongRest', () => {
        it('resets use count to 0', async () => {
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            await restoreOverchannelOnLongRest(mockPlayerStats, campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'Overchannel_useCount',
                0,
                campaignName
            );
        });
    });

    describe('getOverchannelNecroticDamage', () => {
        it('returns 0 for use counts of 1 or less (first use has no backlash)', () => {
            expect(getOverchannelNecroticDamage(3, 1)).toBe(0);
            expect(getOverchannelNecroticDamage(3, 0)).toBe(0);
            expect(getOverchannelNecroticDamage(3, -1)).toBe(0);
        });

        it('returns RAW 2d12-per-slot payload with full flag shape for use #2', () => {
            const result = getOverchannelNecroticDamage(3, 2);

            expect(result.formula).toBe('2d12');
            expect(result.damageType).toBe('Necrotic');
            expect(result.ignoresResistance).toBe(true);
            expect(result.ignoresImmunity).toBe(true);
            expect(result.perSpellLevel).toBe(true);
            expect(result.expression).toBe('6d12');
        });

        it('scales dice by use count and slot level (dicePerLevel = max(2, useCount), CLA-244)', () => {
            expect(getOverchannelNecroticDamage(3, 3).formula).toBe('3d12');
            expect(getOverchannelNecroticDamage(3, 3).expression).toBe('9d12');
            expect(getOverchannelNecroticDamage(3, 4).formula).toBe('4d12');
            expect(getOverchannelNecroticDamage(3, 4).expression).toBe('12d12');
            // slot-level multiplication at a different slot level
            expect(getOverchannelNecroticDamage(2, 2).expression).toBe('4d12');
        });

        it('defaults spellLevel to 1 when falsy', () => {
            expect(getOverchannelNecroticDamage(null, 2).expression).toBe('2d12');
            expect(getOverchannelNecroticDamage(undefined, 2).expression).toBe('2d12');
            expect(getOverchannelNecroticDamage(0, 2).expression).toBe('2d12');
        });
    });
});
