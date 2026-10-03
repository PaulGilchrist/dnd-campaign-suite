// FT-007: Boon of Combat Prowess once-per-turn round latch. The latch is
// stamped with the round it was spent and must stay locked for the rest of
// that round, re-arming once the round advances (holder's next turn).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import {
    BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY,
    boonOfCombatProwessLocked,
    markBoonOfCombatProwessUsed,
} from './boonOfCombatProwess.js';

describe('FT-007 Boon of Combat Prowess round latch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
    });

    it('is unlocked when the latch has never been stamped', () => {
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(false);
    });

    it('is locked while the current round equals the round it was spent', () => {
        getCurrentCombatRound.mockReturnValue(4);
        getRuntimeValue.mockImplementation((name, key) =>
            key === BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY ? 4 : null);
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(true);
    });

    it('re-arms once the round advances past the spent round', () => {
        getCurrentCombatRound.mockReturnValue(5);
        getRuntimeValue.mockImplementation((name, key) =>
            key === BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY ? 4 : null);
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(false);
    });

    it('stamps the current round when spent', async () => {
        getCurrentCombatRound.mockReturnValue(7);
        await markBoonOfCombatProwessUsed('Monk', 'camp');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Monk', BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY, 7, 'camp');
    });

    it('clearing the latch (null) unlocks regardless of round', () => {
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockReturnValue(null);
        expect(boonOfCombatProwessLocked('Monk', 'camp')).toBe(false);
    });
});
