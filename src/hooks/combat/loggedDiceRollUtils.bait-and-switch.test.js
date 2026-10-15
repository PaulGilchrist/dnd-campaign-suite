// @maintained-by-ai: 2026-10-14
// MN-002: defender-side Bait and Switch AC fold getter — reads the dedicated
// baitAndSwitchActive/Bonus runtime keys (written by executeBaitAndSwitchChoice /
// executeActionManeuvers) so useLoggedDiceRollAttack folds the buff into ANY
// attacker's roll. 2024 Battle Master maneuver: superiority die bonus to AC on the
// chosen creature until the start of the maneuvering fighter's next turn.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { getBaitAndSwitchAcBonus } from './loggedDiceRollUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getBaitAndSwitchAcBonus (MN-002)', () => {
    it('returns 0 without a character name and never reads the store', () => {
        expect(getBaitAndSwitchAcBonus(null, 'test-campaign')).toBe(0);
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns 0 when the buff is inactive or the bonus key is missing', () => {
        getRuntimeValue.mockReturnValue(false);
        expect(getBaitAndSwitchAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);

        getRuntimeValue.mockImplementation((_name, key) => key === 'baitAndSwitchActive');
        expect(getBaitAndSwitchAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });

    it('returns the superiority-die bonus when active', () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return 4;
            return null;
        });
        expect(getBaitAndSwitchAcBonus('EvasiveFighter', 'test-campaign')).toBe(4);
        expect(getRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'baitAndSwitchActive', 'test-campaign');
    });
});
