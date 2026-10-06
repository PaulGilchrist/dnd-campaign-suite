// CLA-405: Fleet Step grant service — holder-keyed round latch + logs,
// eligibility (2024 Monk lv11+ with the Fleet Step feature), Step-of-the-Wind
// trigger exclusion, once-per-round pending guard, consume/refusal conventions.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 3),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

import {
    FLEET_STEP_GRANT_KEY,
    grantFleetStep,
    consumeFleetStep,
    isFleetStepEligible,
} from './fleetStepService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

function openHandMonk(overrides = {}) {
    return {
        name: 'Disciplined_Monk',
        rules: '2024',
        level: 20,
        class: {
            name: 'Monk',
            major: { name: 'Warrior of the Open Hand', features: [{ name: 'Fleet Step', level: 11 }] },
        },
        ...overrides,
    };
}

describe('fleetStepService (CLA-405)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentCombatRound).mockReturnValue(3);
        vi.mocked(getRuntimeValue).mockReturnValue(null);
    });

    describe('isFleetStepEligible', () => {
        it('qualifies a 2024 lv11+ Monk carrying the Fleet Step subclass feature', () => {
            expect(isFleetStepEligible(openHandMonk())).toBe(true);
            expect(isFleetStepEligible(openHandMonk({ level: 11 }))).toBe(true);
        });

        it('qualifies when Fleet Step surfaces only in a categorized feature list', () => {
            const stats = openHandMonk({ level: 11 });
            delete stats.class.major;
            stats.bonusActions = [{ name: 'Fleet Step' }];
            expect(isFleetStepEligible(stats)).toBe(true);
        });

        it('rejects lv<11, 5e, non-Monk, and characters without the feature', () => {
            expect(isFleetStepEligible(openHandMonk({ level: 10 }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({ rules: '5e' }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({ class: { name: 'Fighter' } }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({ class: { name: 'Monk', major: { features: [{ name: 'Quivering Palm', level: 17 }] } } }))).toBe(false);
            expect(isFleetStepEligible(null)).toBe(false);
        });
    });

    describe('grantFleetStep', () => {
        it('stamps the round latch and logs fleet_step_triggered after a non-Step Bonus Action', async () => {
            const granted = await grantFleetStep(openHandMonk(), campaignName, 'Unarmed Strike', { type: 'unarmed_strike' });
            expect(granted).toBe(true);
            expect(getRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, 3, campaignName);
            const log = addEntry.mock.calls.find(c => c[1].automationType === 'fleet_step_triggered');
            expect(log).toBeTruthy();
            expect(log[1].description).toContain('Unarmed Strike');
        });

        it('does NOT grant when Step of the Wind (or Heightened) was the triggering Bonus Action', async () => {
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Step of the Wind', { type: 'step_of_the_wind' })).toBe(false);
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Heightened Step of the Wind', { type: 'step_of_the_wind' })).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does NOT grant for ineligible characters (non-monk / lv<11 / 5e)', async () => {
            expect(await grantFleetStep(openHandMonk({ level: 7 }), campaignName, 'Patient Defense', {})).toBe(false);
            expect(await grantFleetStep({ name: 'ElfTest', rules: '2024', level: 20, class: { name: 'Rogue' } }, campaignName, 'Cunning Action', {})).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('is one-shot: an unconsumed grant for the current round does not re-stamp or re-log', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Patient Defense', {})).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('re-arms after consumption in the same round (grant cleared to null)', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? null : null));
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Patient Defense', {})).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, 3, campaignName);
        });
    });

    describe('consumeFleetStep', () => {
        it('clears the latch and logs fleet_step_used when the grant is pending this round', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
            expect(await consumeFleetStep(openHandMonk(), campaignName)).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, null, campaignName);
            expect(addEntry.mock.calls.some(c => c[1].automationType === 'fleet_step_used')).toBe(true);
        });

        it('refuses with a fleet_step_refused log and no clear-write when no grant is pending', async () => {
            vi.mocked(getRuntimeValue).mockReturnValue(null);
            expect(await consumeFleetStep(openHandMonk(), campaignName)).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            const refusal = addEntry.mock.calls.find(c => c[1].automationType === 'fleet_step_refused');
            expect(refusal).toBeTruthy();
            expect(refusal[1].description).toContain('no_grant_pending');
        });

        it('refuses a stale grant from a previous round', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 2 : null));
            expect(await consumeFleetStep(openHandMonk(), campaignName)).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
