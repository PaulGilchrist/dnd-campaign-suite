// @maintained-by-ai
// CLA-405: Fleet Step grant service — producer-lane tests. Gate opens on the REAL
// disk row public/data/2024/classes.json:6900 ("Fleet Step", Warrior of the Open
// Hand, level 11, prose-only, no automation key): "When you take a Bonus Action
// other than Step of the Wind, you can also use Step of the Wind immediately after
// that Bonus Action." Near-miss rows kept distinct: Step of the Wind :5798 and
// Heightened Step of the Wind :6139 (both automation.type step_of_the_wind) are the
// EXCLUDED triggers; raceTraits canMoveThroughCreatureSpace (#1254) and the
// speedUtils speed_bonus arithmetic fold (cla118/cla201 #1260/#1261) are DISTINCT
// traits owned elsewhere — this service composes no speed values, so only the
// trigger envelope + round latch are pinned here.
//
// Lane: holder-keyed round latch (_Fleet_Step_grantRound) — writer grantFleetStep
// stamps getCurrentCombatRound; reader consumeFleetStep spends on round equality;
// refusal writes NOTHING (no fabricated clear). Round-wrap / new-initiative clears
// are owned by the PLAYER_ROUND_LATCH_KEYS family (navigationHandlers.js:54 +
// Initiative.jsx:80), NOT this service — refusal of a stale-round grant is the
// in-service enforcement leg. This is a round counter, never a clock: no timers,
// no wall-clock expiry in this module (Date.now() appears only inside log payloads).
//
// Owned elsewhere (siblings, cited): caller seam envelope on the BA-row automation
// lane → useCharActionsAutomation.fleetStep.test.js; attack-row grant wiring →
// useCharActionsAttackHandlers.fleetStep.test.js; granted-row render + consume
// click → CharBonusActions.fleet-step.test.jsx. All three mock or spy this service,
// so its internals are covered ONLY here and must stay.
// Re-arm after consume is the writer/reader pair of the stamp test (null latch →
// stamps) plus the consume test (spend → writes null): same path, no duplicate test.
// NOTE (source review): isStepOfTheWindTrigger demoted to module-local (#1363 batch —
// it was an exported dead symbol with zero external callers; only fleetStepService.js:32
// def / :38 internal use) — behavior pinned indirectly via the grant exclusion legs below.
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
    FLEET_STEP_ROW_NAME,
    grantFleetStep,
    consumeFleetStep,
    isFleetStepEligible,
} from './fleetStepService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';

// Shape mirrors the real 2024 classes.json Warrior of the Open Hand row (:6900):
// subclass feature { name: 'Fleet Step', level: 11 } under class.major.features.
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
        it('qualifies a 2024 lv11+ Monk via direct subclass feature or categorized list', () => {
            expect(isFleetStepEligible(openHandMonk())).toBe(true);
            expect(isFleetStepEligible(openHandMonk({ level: 11 }))).toBe(true);
            // categorized surface (rulesFactory splits features into action lists)
            const stats = openHandMonk({ level: 11 });
            delete stats.class.major;
            stats.bonusActions = [{ name: 'Fleet Step' }];
            expect(isFleetStepEligible(stats)).toBe(true);
        });

        it('rejects lv<11, 5e, non-Monk, missing/lv-gated feature, and falsy stats', () => {
            expect(isFleetStepEligible(openHandMonk({ level: 10 }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({ level: undefined }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({ rules: '5e' }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({ class: { name: 'Fighter' } }))).toBe(false);
            // same-name feature not yet unlocked by the character's own level
            expect(isFleetStepEligible(openHandMonk({
                level: 11,
                class: { name: 'Monk', major: { features: [{ name: 'Fleet Step', level: 12 }] } },
            }))).toBe(false);
            expect(isFleetStepEligible(openHandMonk({
                class: { name: 'Monk', major: { features: [{ name: 'Quivering Palm', level: 17 }] } },
            }))).toBe(false);
            expect(isFleetStepEligible(null)).toBe(false);
        });
    });

    describe('grantFleetStep', () => {
        it('stamps the round latch verbatim once and logs fleet_step_triggered after a non-Step Bonus Action', async () => {
            // latch key is the exact string navigationHandlers PLAYER_ROUND_LATCH_KEYS clears
            expect(FLEET_STEP_GRANT_KEY).toBe('_Fleet_Step_grantRound');
            const granted = await grantFleetStep(openHandMonk(), campaignName, 'Unarmed Strike', { type: 'unarmed_strike' });
            expect(granted).toBe(true);
            expect(getRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, 3, campaignName);
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls[0][0]).toBe(campaignName);
            expect(addEntry.mock.calls[0][1]).toEqual(expect.objectContaining({
                type: 'automation',
                characterName: 'Disciplined_Monk',
                automationType: 'fleet_step_triggered',
                name: 'Fleet Step',
                description: expect.stringContaining('Unarmed Strike'),
            }));
        });

        it('does NOT grant when Step of the Wind was the trigger (auto-type leg and name-only leg)', async () => {
            // exclusion is the disk rule itself: "other than Step of the Wind"
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Step of the Wind', { type: 'step_of_the_wind' })).toBe(false);
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Heightened Step of the Wind', {})).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('does NOT grant for ineligible characters (lv<11 / non-Monk)', async () => {
            expect(await grantFleetStep(openHandMonk({ level: 7 }), campaignName, 'Patient Defense', {})).toBe(false);
            expect(await grantFleetStep({ name: 'ElfTest', rules: '2024', level: 20, class: { name: 'Rogue' } }, campaignName, 'Cunning Action', {})).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('is one-shot: an unconsumed grant for the current round does not re-stamp or re-log', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
            expect(await grantFleetStep(openHandMonk(), campaignName, 'Patient Defense', {})).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('consumeFleetStep', () => {
        it('clears the latch and logs fleet_step_used once when the grant is pending this round', async () => {
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 3 : null));
            expect(await consumeFleetStep(openHandMonk(), campaignName)).toBe(true);
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, null, campaignName);
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry.mock.calls[0][0]).toBe(campaignName);
            expect(addEntry.mock.calls[0][1]).toEqual(expect.objectContaining({
                type: 'automation',
                characterName: 'Disciplined_Monk',
                automationType: 'fleet_step_used',
                name: FLEET_STEP_ROW_NAME,
                description: expect.stringContaining('Disciplined_Monk'),
            }));
        });

        it('refuses with fleet_step_refused and NO clear-write when nothing is pending or the grant is a stale round', async () => {
            // no grant (null → sentinel -1) and stale grant (round 2 ≠ current 3) share the
            // refuse branch; refusal must never write the latch (no fabricated clear)
            expect(await consumeFleetStep(openHandMonk(), campaignName)).toBe(false);
            vi.mocked(getRuntimeValue).mockImplementation((_n, key) => (key === FLEET_STEP_GRANT_KEY ? 2 : null));
            expect(await consumeFleetStep(openHandMonk(), campaignName)).toBe(false);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledTimes(2);
            const refusal = addEntry.mock.calls[addEntry.mock.calls.length - 1];
            expect(refusal[0]).toBe(campaignName);
            expect(refusal[1]).toEqual(expect.objectContaining({
                type: 'automation',
                characterName: 'Disciplined_Monk',
                automationType: 'fleet_step_refused',
                name: FLEET_STEP_ROW_NAME,
                description: expect.stringContaining('no_grant_pending'),
            }));
        });
    });
});
