// @maintained-by-ai
// LANE: createAutoBreakConditionHandler.second-turn — locks the phantom-bucket
// removal fix (bug-secondturn-badge-removal-synthetic-name). The (Second Turn)
// row card DISPLAYS the holder's conditions (CLA-360 buildDisplayCreature
// resolves via holderName), so the badge × on that card must break the HOLDER's
// condition: removing by the synthetic name wrote a false 'condition broken'
// audit naming a creature with no character file and materialized a phantom
// {activeConditions:[]} change-data bucket while the holder stayed poisoned.
// Same holder-remap law as openEffectAdder (Initiative.effectAdder-second-turn)
// and openAllyEditor (useAllyEditor) — the third ST-row chokepoint.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAutoBreakConditionHandler } from './createAutoBreakConditionHandler.js';
import { removeCondition } from '../../services/combat/conditions/conditionSaveService.js';
import { logConditionEvent } from '../../services/encounters/combatLoggingService.js';

vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));
vi.mock('../../services/combat/conditions/conditionSaveService.js', () => ({
    removeCondition: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionEvent: vi.fn(),
}));
// Real structural semantics (mirrors thiefsReflexesService.isSecondTurnEntry) —
// same stub pinned in Initiative.effectAdder-second-turn.test.jsx.
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({
    isSecondTurnEntry: vi.fn((creature) => !!creature?.secondTurn),
}));

const CAMPAIGN = 'test-campaign';
const HOLDER = 'Alice';
const ST_ROW = 'Alice (Second Turn)';
const POISONED = { key: 'poisoned', label: 'Poisoned', dc: 0, ability: 'con' };

const makeSummary = () => ({ round: 1, creatures: [
    { name: HOLDER, type: 'player', initiative: '20', conditions: [{ key: 'POISONED', label: 'Poisoned' }] },
    { name: ST_ROW, type: 'player', initiative: '10', secondTurn: true, holderName: HOLDER, conditions: [{ key: 'POISONED', label: 'Poisoned' }] },
] });

const mount = (combatSummary) => {
    const setCombatSummary = vi.fn();
    const handle = createAutoBreakConditionHandler({
        isLocalhost: true,
        combatSummary,
        campaignName: CAMPAIGN,
        setCombatSummary,
    });
    return { handle, setCombatSummary };
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('handleAutoBreakCondition (Second Turn) holder remap', () => {
    it('breaking a condition via the (Second Turn) row name targets the HOLDER — state removal and audit never carry the synthetic name', () => {
        const combatSummary = makeSummary();
        const { handle } = mount(combatSummary);

        handle(ST_ROW, POISONED);

        // The state-write lane (reads/filters/writes activeConditions by name)
        // must receive the holder, not the doomed synthetic key.
        expect(removeCondition).toHaveBeenCalledTimes(1);
        expect(removeCondition.mock.calls[0][0]).toMatchObject({ creatureName: HOLDER, campaignName: CAMPAIGN });
        expect(removeCondition.mock.calls.some(([arg]) => arg.creatureName === ST_ROW)).toBe(false);
        // Audit truth: the 'broken' row names the real creature with a character file.
        expect(logConditionEvent).toHaveBeenCalledWith({
            campaignName: CAMPAIGN,
            action: 'broken',
            creatureName: HOLDER,
            conditionLabel: 'Poisoned',
        });
    });

    it('the holder combatSummary row loses the condition while the synthetic row is left untouched', () => {
        const combatSummary = makeSummary();
        const { handle, setCombatSummary } = mount(combatSummary);

        handle(ST_ROW, POISONED);

        const holder = combatSummary.creatures.find(c => c.name === HOLDER);
        const stRow = combatSummary.creatures.find(c => c.name === ST_ROW);
        expect(holder.conditions).toEqual([]);
        expect(stRow.conditions).toEqual([{ key: 'POISONED', label: 'Poisoned' }]);
        expect(setCombatSummary).toHaveBeenCalledTimes(1);
    });

    it('control: breaking a condition via the holder row keeps its own name (no remap for real creatures)', () => {
        const combatSummary = makeSummary();
        const { handle } = mount(combatSummary);

        handle(HOLDER, POISONED);

        expect(removeCondition.mock.calls[0][0]).toMatchObject({ creatureName: HOLDER });
        expect(logConditionEvent).toHaveBeenCalledWith(expect.objectContaining({ creatureName: HOLDER }));
        expect(combatSummary.creatures.find(c => c.name === HOLDER).conditions).toEqual([]);
        // The synthetic row is transport, not state authority: it is not stripped here.
        expect(combatSummary.creatures.find(c => c.name === ST_ROW).conditions).toHaveLength(1);
    });

    it('a secondTurn row without holderName falls back to its own name (no crash, byte-identical legacy face)', () => {
        const combatSummary = { round: 1, creatures: [
            { name: 'Ghost (Second Turn)', type: 'player', secondTurn: true, conditions: [{ key: 'poisoned' }] },
        ] };
        const { handle } = mount(combatSummary);

        handle('Ghost (Second Turn)', POISONED);

        expect(removeCondition.mock.calls[0][0]).toMatchObject({ creatureName: 'Ghost (Second Turn)' });
        expect(logConditionEvent).toHaveBeenCalledWith(expect.objectContaining({ creatureName: 'Ghost (Second Turn)' }));
    });
});
