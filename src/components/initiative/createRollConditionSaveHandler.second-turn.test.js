// @maintained-by-ai
// LANE: createRollConditionSaveHandler.second-turn — locks the holder-remap fix
// (bug-secondturn-badge-click-synthetic-name). The (Second Turn) row card
// DISPLAYS the holder's conditions (CLA-360 buildDisplayCreature resolves via
// holderName), so the badge CLICK (condition-save reroll) on that card must
// resolve the save as the HOLDER. Rolling on the synthetic row lost the
// holder's save bonus (the character lookup matches no file), audited a
// creature with no character file, and removeCondition left the holder's
// condition fully in place while materializing a phantom {activeConditions:[]}
// change-data bucket. Same third-chokepoint law as the badge × remap
// (createAutoBreakConditionHandler.second-turn), openEffectAdder
// (Initiative.effectAdder-second-turn) and openAllyEditor (useAllyEditor).
// Owned here: the handleRollConditionSave remap BEFORE rollConditionSave /
// removeCondition / logConditionSave. NOT owned here: popup payload bytes and
// spell cleanups → createRollConditionSaveHandler.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRollConditionSaveHandler } from './createRollConditionSaveHandler.js';
import { rollConditionSave, removeCondition, buildConditionPopup } from '../../services/combat/conditions/conditionSaveService.js';
import { logConditionSave } from '../../services/encounters/combatLoggingService.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    rollConditionSave: vi.fn(),
    removeCondition: vi.fn(),
    addCondition: vi.fn(),
    buildConditionPopup: vi.fn(),
}));
vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    removeForcecageEffect: vi.fn(),
}));
vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    removeMazeEffect: vi.fn(),
}));
vi.mock('../../services/combat/conditions/slowEffects.js', () => ({
    removeSlowEffectsForTarget: vi.fn(() => true),
    SLOW_TE_EFFECTS: [],
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionSave: vi.fn(),
}));
vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
// Real structural semantics (mirrors thiefsReflexesService.isSecondTurnEntry) —
// same stub pinned in createAutoBreakConditionHandler.second-turn.test.js.
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn((creature) => !!creature?.secondTurn),
}));

const CAMPAIGN = 'test-campaign';
const HOLDER = 'Alice';
const ST_ROW = 'Alice (Second Turn)';
const POISONED = { key: 'poisoned', label: 'Poisoned', dc: 0, ability: 'con' };

const makeSummary = () => ({ round: 1, creatures: [
    { name: HOLDER, type: 'player', initiative: '20', conditions: [{ key: 'poisoned', label: 'Poisoned' }] },
    { name: ST_ROW, type: 'player', initiative: '10', secondTurn: true, holderName: HOLDER, conditions: [{ key: 'poisoned', label: 'Poisoned' }] },
] });

// Live-failure roll face: aura-only bonus (the holder's +6 CON was lost because
// the synthetic row's character lookup matched nothing).
const SUCCESS_ROLL = { roll: 12, success: true, bonus: 5, bonusDetail: '(+5 aura from ElderPaladin)', rolls: [12], starryDragonFloor: false };

const mount = (combatSummary) => {
    const setCombatSummary = vi.fn();
    const setConditionPopup = vi.fn();
    const handle = createRollConditionSaveHandler({
        combatSummary,
        campaignName: CAMPAIGN,
        characters: [{ name: HOLDER, computedStats: {} }],
        campaignNpcs: [],
        mapName: 'test-map',
        setConditionPopup,
        setCombatSummary,
    });
    return { handle, setCombatSummary, setConditionPopup };
};

beforeEach(() => {
    vi.clearAllMocks();
    rollConditionSave.mockResolvedValue(SUCCESS_ROLL);
    buildConditionPopup.mockReturnValue({ success: true });
});

describe('handleRollConditionSave (Second Turn) holder remap', () => {
    it('clicking via the (Second Turn) row rolls the save as the HOLDER — the resolver receives the holder cs row, never the synthetic one', async () => {
        const combatSummary = makeSummary();
        const { handle } = mount(combatSummary);

        await handle(ST_ROW, POISONED);

        expect(rollConditionSave).toHaveBeenCalledTimes(1);
        const holderRow = combatSummary.creatures.find(c => c.name === HOLDER);
        expect(rollConditionSave.mock.calls[0][0]).toMatchObject({ creature: holderRow, campaignName: CAMPAIGN });
        expect(rollConditionSave.mock.calls[0][0].creature.name).toBe(HOLDER);
    });

    it('success clears the HOLDER bucket and audits the HOLDER — no state write or audit ever keys the synthetic bucket', async () => {
        const combatSummary = makeSummary();
        const { handle } = mount(combatSummary);

        await handle(ST_ROW, POISONED);

        // The state-write lane (reads/filters/writes activeConditions by name)
        // must receive the holder, not the doomed synthetic key.
        expect(removeCondition).toHaveBeenCalledTimes(1);
        expect(removeCondition.mock.calls[0][0]).toMatchObject({ creatureName: HOLDER, campaignName: CAMPAIGN });
        expect(removeCondition.mock.calls.some(([arg]) => arg.creatureName === ST_ROW)).toBe(false);
        // Synthetic bucket absent: no direct runtime write ever keys '(Second Turn)'
        // (the phantom {activeConditions:[]} materializer).
        expect(setRuntimeValue.mock.calls.some(([name]) => name === ST_ROW)).toBe(false);
        // Audit truth: the condition-save row names the creature with a character file.
        expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({ creatureName: HOLDER }));
        expect(logConditionSave).not.toHaveBeenCalledWith(expect.objectContaining({ creatureName: ST_ROW }));
    });

    it('control: clicking via the holder row keeps its own name (no remap for real creatures)', async () => {
        const combatSummary = makeSummary();
        const { handle } = mount(combatSummary);

        await handle(HOLDER, POISONED);

        expect(rollConditionSave.mock.calls[0][0]).toMatchObject({ creature: combatSummary.creatures.find(c => c.name === HOLDER) });
        expect(removeCondition.mock.calls[0][0]).toMatchObject({ creatureName: HOLDER });
        expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({ creatureName: HOLDER }));
    });

    it('a secondTurn row without holderName falls back to its own name (no crash, byte-identical legacy face)', async () => {
        const combatSummary = { round: 1, creatures: [
            { name: 'Ghost (Second Turn)', type: 'player', secondTurn: true, conditions: [{ key: 'poisoned', label: 'Poisoned' }] },
        ] };
        const { handle } = mount(combatSummary);

        await handle('Ghost (Second Turn)', POISONED);

        expect(rollConditionSave).toHaveBeenCalledTimes(1);
        expect(rollConditionSave.mock.calls[0][0].creature.name).toBe('Ghost (Second Turn)');
        expect(logConditionSave).toHaveBeenCalledWith(expect.objectContaining({ creatureName: 'Ghost (Second Turn)' }));
    });
});
