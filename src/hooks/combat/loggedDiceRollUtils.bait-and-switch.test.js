// MN-002: defender-side Bait and Switch AC fold getter — reads the dedicated
// baitAndSwitchActive/Bonus runtime keys and feeds ctx.baitAndSwitchBonus in
// useLoggedDiceRollAttack so ANY attacker's roll folds the buff.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({ sendSavePrompt: vi.fn() }));
vi.mock('../../services/combat/automation/automationService.js', () => ({ hasMinDamage: vi.fn() }));
vi.mock('../../services/maps/mapsService.js', () => ({ loadMapData: vi.fn() }));

import { getBaitAndSwitchAcBonus } from './loggedDiceRollUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getBaitAndSwitchAcBonus (MN-002)', () => {
    it('returns 0 without a character name', () => {
        expect(getBaitAndSwitchAcBonus(null, 'test-campaign')).toBe(0);
    });

    it('returns 0 when the buff is not active', () => {
        getRuntimeValue.mockImplementation(() => null);
        expect(getBaitAndSwitchAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });

    it('returns the granted die bonus when active', () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return 12;
            return null;
        });
        expect(getBaitAndSwitchAcBonus('EvasiveFighter', 'test-campaign')).toBe(12);
    });

    it('floors an unparseable bonus to 0', () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            return null;
        });
        expect(getBaitAndSwitchAcBonus('EvasiveFighter', 'test-campaign')).toBe(0);
    });
});
