// @maintained-by-ai: 2026-10-14
// SP-109 producer-side contract: slowHandler stamps lowercase 'slow' into the
// target's activeConditions (slowHandler.js applySlowToTarget); getSlowAcPenalty
// reads that key and reports the penalty MAGNITUDE 2 until the condition is gone
// (public/data/2024/spells.json "slow": "-2 penalty to AC"). Folding it into
// effectiveAc is the consumer seam, covered in hitResolution.slow.test.js —
// don't re-test hit/miss boundaries here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getSlowAcPenalty } from './loggedDiceRollUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('getSlowAcPenalty', () => {
    it('returns 2 while a slow condition is stamped (case-insensitive), reading the target-side runtime key', () => {
        for (const stamp of ['slow', 'Slow']) {
            getRuntimeValue.mockImplementation((name, key) => (key === 'activeConditions' ? [stamp] : null));
            expect(getSlowAcPenalty('AberrantSorcerer', 'test-campaign')).toBe(2);
            expect(getRuntimeValue).toHaveBeenCalledWith('AberrantSorcerer', 'activeConditions', 'test-campaign');
        }
    });

    it('returns 0 when the target is not slowed or the store is empty', () => {
        getRuntimeValue.mockImplementation((name, key) => (key === 'activeConditions' ? ['poisoned'] : null));
        expect(getSlowAcPenalty('AberrantSorcerer', 'test-campaign')).toBe(0);

        // Default store shape: no stamp at all (null) → no penalty.
        expect(getSlowAcPenalty('AberrantSorcerer', 'test-campaign')).toBe(0);
    });

    it('returns 0 without a target name and skips the runtime read', () => {
        expect(getSlowAcPenalty(undefined, 'test-campaign')).toBe(0);
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });
});
