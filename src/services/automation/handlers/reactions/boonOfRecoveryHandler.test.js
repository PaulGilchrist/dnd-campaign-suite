// @maintained-by-ai 2026-11-27 — handler suite for the survive_and_heal dispatch lane
// (automation/index.js → handleBoonOfRecovery, fed by 2024 feats.json "Last Stand").
// Pins this handler's own execution composition: direct currentHitPoints write (no
// applyHealing / no shared heal util), latch key boonOfRecoveryLastStandUsed,
// unconscious-filter + death-save clears + isDead reset, hp_change + ability_use logs,
// and the combat-summary-updated dispatch event.
// Test-trim audit 2026-11-27: refusals now pin the FULL read census (latch is the only
// read → gate short-circuit); the commit test pins exact ordered write/log arrays with
// campaignName threading on every call and drops the masked deathSaves/deathFailures
// READ fixtures (this handler never reads them — it writes the cleared arrays
// unconditionally); multi-branch re-harness tests split into it.each legs with
// full-shape popups; addEntry-rejection survivor leg added (console.error pinned);
// dispatch spy + console spy centralised in beforeEach/afterEach.
// NOTE: isLastStandAvailable/getLastStandUsed were dead exports (grep-zero production
// callers) — removed from the source; `handle` is the only live export surface.
// Distinct from boonOfRecoveryService.test coverage in applyDamage.lastStand.test.js
// (that module intercepts applyDamage and logs type 'healing'; this handler logs
// 'hp_change'). reactionSaveHealHandler.test.js owns the save-then-heal lane; this
// file owns the direct-write survive_and_heal lane (no save listener here).

import { handle } from './boonOfRecoveryHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../ui/logService.js', () => ({ addEntry: vi.fn() }));

describe('boonOfRecoveryHandler', () => {
    const campaignName = 'TestCampaign';
    const playerName = 'TestFighter';

    const mockPlayerStats = { name: playerName, hitPoints: { max: 40 } };
    const mockAction = {
        name: 'Boon Of Recovery',
        automation: {
            type: 'survive_and_heal',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healExpression: 'half_max_hp',
            recharge: 'long_rest',
        },
    };

    const popup = (description) => ({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Boon Of Recovery',
            description,
            automation: mockAction.automation,
        },
    });

    const writeCensus = () =>
        runtimeState.setRuntimeValue.mock.calls.map(([name, key, value, camp]) => [name, key, value, camp]);
    const readCensus = () =>
        runtimeState.getRuntimeValue.mock.calls.map(([name, key, camp]) => [name, key, camp]);

    let dispatchSpy;
    let consoleError;

    beforeEach(() => {
        vi.resetAllMocks();
        logService.addEntry.mockResolvedValue(undefined);
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
        consoleError.mockRestore();
    });

    it('refuses with an exact popup when the long-rest latch is set — latch is the only read, zero spend', async () => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) =>
            key === 'boonOfRecoveryLastStandUsed' ? true : undefined);

        const result = await handle(mockAction, mockPlayerStats, campaignName);

        expect(result).toEqual(popup(
            'Boon Of Recovery: Last Stand has already been used. Recharges after a Long Rest.'
        ));
        // Gate short-circuits before any later-channel read (conditions/death saves).
        expect(readCensus()).toEqual([
            [playerName, 'boonOfRecoveryLastStandUsed', campaignName],
        ]);
        expect(writeCensus()).toEqual([]);
        expect(logService.addEntry.mock.calls).toEqual([]);
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['filters Unconscious case-insensitively, keeps other conditions',
            ['unconscious', 'Unconscious', 'poisoned'], ['poisoned']],
        ['writes an empty condition list when none are stored', undefined, []],
    ])('trigger commit census: %s', async (_label, storedConditions, expectedConditions) => {
        runtimeState.getRuntimeValue.mockImplementation((_name, key) =>
            key === 'activeConditions' ? storedConditions : undefined);

        const result = await handle(mockAction, mockPlayerStats, campaignName);

        expect(result).toEqual(popup(
            'TestFighter uses Last Stand to drop to 21 HP instead of 0, regaining 20 hit points.'
        ));
        // Only two reads exist on this lane: the latch gate, then activeConditions.
        expect(readCensus()).toEqual([
            [playerName, 'boonOfRecoveryLastStandUsed', campaignName],
            [playerName, 'activeConditions', campaignName],
        ]);
        // Ordered commit census: latch → HP → conditions → death saves → isDead,
        // every write threading playerName + campaignName.
        expect(writeCensus()).toEqual([
            [playerName, 'boonOfRecoveryLastStandUsed', true, campaignName],
            [playerName, 'currentHitPoints', 21, campaignName],
            [playerName, 'activeConditions', expectedConditions, campaignName],
            [playerName, 'deathSaves', [false, false, false], campaignName],
            [playerName, 'deathFailures', [false, false, false], campaignName],
            [playerName, 'isDead', 0, campaignName],
        ]);
        // Ordered log census: hp_change before ability_use.
        expect(logService.addEntry.mock.calls).toEqual([
            [campaignName, {
                type: 'hp_change',
                targetName: playerName,
                delta: 21,
                currentHp: 21,
                maxHp: 40,
                isHealing: true,
                isUnconscious: false,
            }],
            [campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Boon Of Recovery',
                description: 'TestFighter used Boon Of Recovery (Last Stand) to drop to 21 HP instead of 0.',
            }],
        ]);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const dispatched = dispatchSpy.mock.calls[0][0];
        expect(dispatched).toBeInstanceOf(window.CustomEvent);
        expect(dispatched.type).toBe('combat-summary-updated');
        expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([
        ['odd max HP floors the heal', { hitPoints: { max: 47 } }, 24, 23, 47],
        ['barbarianLevel fallback when hitPoints is absent', { barbarianLevel: 12 }, 7, 6, 12],
        ['level fallback', { level: 10 }, 6, 5, 10],
        ['falsy hitPoints.max continues the derivation chain', { hitPoints: { max: 0 }, level: 10 }, 6, 5, 10],
        ['no stat sources clamps at 1 HP', {}, 1, 0, 1],
    ])('HP derivation: %s', async (_label, statsExtra, newHp, healAmount, maxHp) => {
        // Latch reads default undefined via the auto-mock (available).
        const result = await handle(mockAction, { name: playerName, ...statsExtra }, campaignName);

        expect(result).toEqual(popup(
            `TestFighter uses Last Stand to drop to ${newHp} HP instead of 0, regaining ${healAmount} hit points.`
        ));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
            playerName, 'currentHitPoints', newHp, campaignName
        );
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'hp_change',
            delta: newHp,
            currentHp: newHp,
            maxHp,
        }));
    });

    it('survives rejecting log writes — full commit, dispatch and popup still land, errors surfaced', async () => {
        logService.addEntry.mockRejectedValue(new Error('log down'));

        const result = await handle(mockAction, mockPlayerStats, campaignName);

        expect(result).toEqual(popup(
            'TestFighter uses Last Stand to drop to 21 HP instead of 0, regaining 20 hit points.'
        ));
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
        expect(consoleError).toHaveBeenCalledTimes(2);
        expect(writeCensus()).toHaveLength(6);
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });
});
