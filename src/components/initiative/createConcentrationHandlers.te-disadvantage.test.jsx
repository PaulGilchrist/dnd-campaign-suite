// @maintained-by-ai
// Lane (per createConcentrationHandlers-2.test.jsx header): MA-0038 te-driven
// disadvantage (concentration_disadvantage) on handleRollConcentrationSave ONLY.
// Two distinct decision branches exist for the te at this call site (source line
// 68-79: getActiveTargetEffect → addEntry attribution + `|| !!te` breaker):
//   1. te present on roller  → disadvantage:true, mode 'disadvantage', one exact
//      attribution log entry (even when the save itself succeeds).
//   2. te miss for roller    → disadvantage:false, mode 'normal', NO attribution entry.
// Explicitly NOT here (owned elsewhere — do not re-add):
//   - base .test.jsx: early returns, success/fail flows, static concentration_breaker
//     incl. resolveSaveMode breaker-over-advantage precedence, advantageSources modes,
//     full rollConcentrationSave payload shape with disadvantage:false.
//   - -2.test.jsx: handleBreakConcentration payloads/counts/SP-114.
//   - targetEffectDefinitions.test.js: registry definition + getActiveTargetEffect
//     active/expired/wrong-target resolution (mocked out here — handler consumes it).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(),
    buildConcentrationPopup: vi.fn(() => ({ type: 'd20' })),
    cleanupConcentrationEffects: vi.fn(),
}));

const logConcentrationSave = vi.fn();
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConcentrationSave: (...args) => logConcentrationSave(...args),
    logConditionEvent: vi.fn(),
}));

const addEntry = vi.fn(() => Promise.resolve());
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (...args) => addEntry(...args),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
    setRuntimeValue: vi.fn(),
}));

const getActiveTargetEffect = vi.fn(() => null);
vi.mock('../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    getActiveTargetEffect: (...args) => getActiveTargetEffect(...args),
}));

import { createConcentrationHandlers } from './createConcentrationHandlers.js';
import { rollConcentrationSave } from '../../services/combat/concentration/concentrationService.js';

const TARGET = 'AberrantSorcerer';
const TE = {
    target: TARGET,
    effect: 'concentration_disadvantage',
    source: 'Adult Black Dragon 1',
    actionName: 'Cloud of Insects',
};

function setup() {
    const combatSummary = {
        round: 1,
        creatures: [{ name: TARGET, type: 'player', concentration: { spell: 'Haste', dc: 13 } }],
    };
    const handlers = createConcentrationHandlers({
        combatSummary,
        campaignName: 'test-campaign',
        characters: [{ name: TARGET, saveModifiers: [], computedStats: {} }],
        campaignNpcs: [],
        mapName: 'test-map',
        setConditionPopup: vi.fn(),
        setCombatSummary: vi.fn(),
    });
    return { combatSummary, handlers };
}

beforeEach(() => {
    vi.clearAllMocks();
    getActiveTargetEffect.mockReturnValue(null);
    // Determinism pin: fixed successful roll so attribution bytes are the only variable.
    rollConcentrationSave.mockResolvedValue({ roll: 15, success: true, bonus: 5, bonusDetail: undefined, starryDragonFloor: false, displayRolls: [15] });
});

describe('MA-0038 createConcentrationHandlers te disadvantage', () => {
    it('te on roller: queried by roller name, rolls once with disadvantage:true, logs mode disadvantage + one exact attribution entry (even on a successful save)', async () => {
        getActiveTargetEffect.mockImplementation((_campaign, name, key) =>
            (name === TARGET && key === 'concentration_disadvantage') ? TE : null);

        const { handlers } = setup();
        await handlers.handleRollConcentrationSave(TARGET);

        expect(getActiveTargetEffect).toHaveBeenCalledTimes(1);
        expect(getActiveTargetEffect).toHaveBeenCalledWith('test-campaign', TARGET, 'concentration_disadvantage');

        expect(rollConcentrationSave).toHaveBeenCalledTimes(1);
        expect(rollConcentrationSave.mock.calls[0][0].disadvantage).toBe(true);
        expect(logConcentrationSave.mock.calls[0][0].mode).toBe('disadvantage');

        // Exact attribution literals (#786/#825) + exact count (#744).
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'automation',
            automationType: 'concentration_disadvantage_applied',
            characterName: TARGET,
            sourceName: 'Adult Black Dragon 1',
            abilityName: 'Cloud of Insects',
            description: 'AberrantSorcerer rolls this Concentration save with Disadvantage (Adult Black Dragon 1 — Cloud of Insects).',
        });
    });

    it('te miss for roller (held by another creature): queried with roller name, disadvantage:false, mode normal, no attribution entry', async () => {
        // Registry itself is tested in targetEffectDefinitions.test.js; here the mock
        // simulates that lookup for THIS roller misses the te carried by 'Goblin 1'.
        getActiveTargetEffect.mockImplementation((_campaign, name) =>
            (name === 'Goblin 1' ? { ...TE, target: 'Goblin 1' } : null));

        const { handlers } = setup();
        await handlers.handleRollConcentrationSave(TARGET);

        expect(getActiveTargetEffect).toHaveBeenCalledWith('test-campaign', TARGET, 'concentration_disadvantage');
        expect(rollConcentrationSave).toHaveBeenCalledTimes(1);
        expect(rollConcentrationSave.mock.calls[0][0].disadvantage).toBe(false);
        expect(logConcentrationSave.mock.calls[0][0].mode).toBe('normal');
        expect(addEntry).not.toHaveBeenCalled();
    });
});
