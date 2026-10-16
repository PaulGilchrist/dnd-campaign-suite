// @maintained-by-ai
// CLA-081: Defensive Tactics defect-lock/regression lane for 2024 Ranger (Hunter).
// Steady-state handle/applyChoice composition is owned by defensiveTacticsHandler.test.js.
// This lane locks the defect seams the main lane leaves open:
//  - exact runtime-key symmetry (handle derives `_${name.replace(/\s+/g,'_')}_choice`,
//    applyChoice hardcodes it — if either drifts, the round-trip breaks here first)
//  - full-string own-composition of both description templates (main lane only uses toContain)
//  - executeHandler router dispatch through the real automation/index.js registry
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
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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
        vi.clearAllMocks();
    });

    describe('exact-key pin', () => {
        it('handle reads the exact runtime key derived from the action name, with no side effects', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), campaignName);

            expect(getRuntimeValue).toHaveBeenCalledWith('RangerTest', CHOICE_KEY, campaignName);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('defensiveTactics');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('key round-trip through a real in-memory runtime store', () => {
        it('applyChoice writes and handle reads the same key; both description templates pinned verbatim', async () => {
            const store = new Map();
            getRuntimeValue.mockImplementation((_name, key) => store.get(`${_name}::${key}`));
            setRuntimeValue.mockImplementation(async (name, key, value) => {
                store.set(`${name}::${key}`, value);
            });

            const stats = makePlayerStats();

            // Step 1: fresh state — modal, nothing written, nothing logged
            let result = await handle(makeAction(), stats, campaignName);
            expect(result.type).toBe('modal');
            expect(store.size).toBe(0);
            expect(addEntry).not.toHaveBeenCalled();

            // Step 2: applyChoice persists under the exact key and logs once
            result = await applyChoice(stats, campaignName, 'Escape the Horde');
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toBe(
                'Selected: <b>Escape the Horde</b>. This choice can be changed on a Short Rest or Long Rest.'
            );
            expect(result.payload.automation).toBeUndefined();
            expect(store.get(`RangerTest::${CHOICE_KEY}`)).toBe('Escape the Horde');
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'RangerTest',
                abilityName: 'Defensive Tactics',
                description: 'Defensive Tactics choice: Escape the Horde',
            });

            // Step 3: handle now resolves that stored choice into a popup (no re-mocking)
            result = await handle(makeAction(), stats, campaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe(
                '<b>Escape the Horde</b> has been selected. This choice can be changed on a Short Rest or Long Rest.'
            );
            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });

    describe('executeHandler integration', () => {
        it('should execute via executeHandler and return modal', async () => {
            getRuntimeValue.mockReset().mockReturnValue(undefined);

            const result = await executeHandler(makeAction(), makePlayerStats(), campaignName, null, [makePlayerStats()]);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('defensiveTactics');
            expect(result.payload.action.name).toBe('Defensive Tactics');
        });

        it('should execute via executeHandler and return popup when choice exists', async () => {
            getRuntimeValue.mockReturnValue('Multiattack Defense');

            const result = await executeHandler(makeAction(), makePlayerStats(), campaignName, null, [makePlayerStats()]);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Defensive Tactics');
            expect(result.payload.description).toContain('Multiattack Defense');
        });
    });
});
