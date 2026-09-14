import { describe, it, expect, vi, beforeEach } from 'vitest';

// MA-0038: GM-click concentration save on the initiative card consumes the
// failed-save te (Adult Black Dragon Cloud of Insects) as disadvantage.

vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    rollConcentrationSave: vi.fn(),
    buildConcentrationPopup: vi.fn(() => ({ type: 'd20' })),
    cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    stripSummonedFromCombatSummary: vi.fn(),
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
    rollConcentrationSave.mockResolvedValue({ roll: 15, success: true, bonus: 5, bonusDetail: undefined, starryDragonFloor: false, displayRolls: [15] });
});

describe('MA-0038 createConcentrationHandlers te disadvantage', () => {
    it('te on holder: roll runs with disadvantage:true, mode disadvantage, attribution log', async () => {
        getActiveTargetEffect.mockImplementation((_c, name, key) =>
            (name === TARGET && key === 'concentration_disadvantage')
                ? { target: TARGET, effect: 'concentration_disadvantage', source: 'Adult Black Dragon 1', actionName: 'Cloud of Insects' }
                : null);

        const { handlers } = setup();
        await handlers.handleRollConcentrationSave(TARGET);

        expect(getActiveTargetEffect).toHaveBeenCalledWith('test-campaign', TARGET, 'concentration_disadvantage');
        expect(rollConcentrationSave.mock.calls[0][0].disadvantage).toBe(true);
        expect(logConcentrationSave.mock.calls[0][0].mode).toBe('disadvantage');
        expect(addEntry.mock.calls.some(([ , e]) => e.automationType === 'concentration_disadvantage_applied')).toBe(true);
    });

    it('no te: unchanged normal-mode baseline', async () => {
        const { handlers } = setup();
        await handlers.handleRollConcentrationSave(TARGET);

        expect(rollConcentrationSave.mock.calls[0][0].disadvantage).toBe(false);
        expect(logConcentrationSave.mock.calls[0][0].mode).toBe('normal');
        expect(addEntry).not.toHaveBeenCalled();
    });
});
