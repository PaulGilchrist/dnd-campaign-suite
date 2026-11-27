// @maintained-by-ai 2026-11-27
// CLA-081: Defensive Tactics defect-lock/regression lane for 2024 Ranger (Hunter).
// Steady-state handle/applyChoice composition is owned by defensiveTacticsHandler.test.js
// (falsy→modal payload fields, popup composition via toContain, invalid-choice refusal
// guard with zero-spend census, per-choice write/log pins). This lane locks the seams
// that lane leaves open:
//  - exact runtime-key symmetry: handle derives `_${name.replace(/\s+/g,'_')}_choice`
//    while applyChoice hardcodes it — the Map-backed round-trip below breaks here first
//    if either side drifts
//  - full-string verbatim pins of both description templates (main lane only toContains)
//  - executeHandler dispatch through the real automation/index.js registry
//  - applyChoice survivor path when the log write rejects
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyChoice } from './defensiveTacticsHandler.js';
// CLA-081 flake fix: static top-level import of the real automation/index.js router
// (this lane's purpose — registry dispatch — still exercises the real registry; only
// its runtime/log deps are mocked below). vi.mock calls are hoisted above static
// imports, so the registry's transitive graph still resolves to the mocks. A dynamic
// `await import('../../index.js')` inside the test paid the giant-graph transform
// (~3.5s standalone) inside the 5000ms test timeout and flaked under full-suite
// parallel load; the static import moves that cost to the unbounded collection phase.
import { executeHandler } from '../../index.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'test-campaign';
const CHOICE_KEY = '_Defensive_Tactics_choice';

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerTest',
        level: 7,
        rules: '2024',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Defensive Tactics',
        automation: {
            type: 'defensive_tactics',
            casting_time: 'passive',
        },
        ...overrides,
    };
}

describe('CLA-081: Defensive Tactics (2024 Ranger Hunter)', () => {
    beforeEach(() => {
        // Re-seed default implementations every test: clearAllMocks keeps prior
        // mockImplementation, so without this the round-trip's store impl would
        // leak into later tests (the old lane patched around it with a mid-test
        // mockReset).
        getRuntimeValue.mockReset().mockReturnValue(undefined);
        setRuntimeValue.mockReset().mockResolvedValue(undefined);
        addEntry.mockReset().mockResolvedValue(undefined);
    });

    it('handle/applyChoice round-trip: exact derived key, no side effects fresh, both description templates verbatim', async () => {
        const store = new Map();
        getRuntimeValue.mockImplementation((name, key) => store.get(`${name}::${key}`));
        setRuntimeValue.mockImplementation(async (name, key, value) => {
            store.set(`${name}::${key}`, value);
        });

        const stats = makePlayerStats();
        const action = makeAction();

        // Step 1: fresh state — handle reads the exact key derived from the action
        // name, returns the modal, writes and logs nothing (store.size 0 proves no
        // setRuntimeValue write reached the store).
        let result = await handle(action, stats, campaignName);
        expect(getRuntimeValue).toHaveBeenCalledWith('RangerTest', CHOICE_KEY, campaignName);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('defensiveTactics');
        expect(store.size).toBe(0);
        expect(addEntry).not.toHaveBeenCalled();

        // Step 2: applyChoice persists under the same hardcoded key, returns its
        // popup verbatim (no automation field), logs exactly once.
        result = await applyChoice(stats, campaignName, 'Escape the Horde');
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Defensive Tactics',
                description:
                    'Selected: <b>Escape the Horde</b>. This choice can be changed on a Short Rest or Long Rest.',
            },
        });
        expect(store.get(`RangerTest::${CHOICE_KEY}`)).toBe('Escape the Horde');
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'RangerTest',
            abilityName: 'Defensive Tactics',
            description: 'Defensive Tactics choice: Escape the Horde',
        });

        // Step 3: handle now resolves that stored choice into the full-shape popup
        // (no re-mocking) with the action's automation echoed through.
        result = await handle(action, stats, campaignName);
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Defensive Tactics',
                description:
                    '<b>Escape the Horde</b> has been selected. This choice can be changed on a Short Rest or Long Rest.',
                automation: action.automation,
            },
        });
    });

    it('executeHandler routes automation.type "defensive_tactics" through the real registry', async () => {
        const action = makeAction();
        const stats = makePlayerStats();

        const result = await executeHandler(action, stats, campaignName, null, [stats]);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'defensiveTactics',
            payload: { action, playerStats: stats, campaignName },
        });
    });

    it('applyChoice persists the choice and still returns the popup when the log write rejects', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        addEntry.mockRejectedValue(new Error('log unavailable'));

        const result = await applyChoice(makePlayerStats(), campaignName, 'Multiattack Defense');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'RangerTest',
            CHOICE_KEY,
            'Multiattack Defense',
            campaignName,
        );
        expect(errorSpy).toHaveBeenCalledTimes(1);
        errorSpy.mockRestore();
    });
});
