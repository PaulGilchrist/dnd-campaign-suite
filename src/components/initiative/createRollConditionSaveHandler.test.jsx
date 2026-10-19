// @maintained-by-ai
/**
 * createRollConditionSaveHandler lane — initiative seam for CONDITION saves.
 * (Concentration saves are owned by the createConcentrationHandlers.* trio — #833-#835 — distinct lane.)
 *
 * Owned contract (verified here):
 *  - resolver seam rollConditionSave called ONCE with exact args; dice come from that
 *    seam, never a clock (turn-based mandate — adjudication prompts wait indefinitely).
 *  - success: removeCondition with the original condition + per-spell cleanup exact payloads
 *    (cleared targetEffects written as literal bytes, exact log rollType/saveDc/saveType).
 *  - failure: nothing removed; ray-of-enfeeblement logs "kept"; caster Maze concentration held.
 *  - popup + combat-log exact bytes, incl. multi-roll advantage passthrough (CLA-209).
 *  - persistence identity (#825): storage.set writes the LIVE combatSummary reference;
 *    setCombatSummary receives a cloneDeep CLONE (not the same object).
 *
 * Cited elsewhere — not duplicated here:
 *  - rollConditionSave resolution internals: conditionSaveService.test.js (resolver producer).
 *  - Study-action maze escape caster-concentration release (mazeHandler.js internals):
 *    mazeHandler.sp080-escape-concentration.test.js.
 *  - ray_of_enfeeble_debuff cast/te-apply producer: rayOfEnfeeblementHandler.test.js.
 *  - slow target-effect strip internals: slowEffects.test.js / slowHandler.test.js.
 *  - Otto's/Tasha's/Confusion spell-lane internals: ottosDanceHandler / tashasLaughterHandler /
 *    confusionHandler save-result lanes.
 *  - popup render internals: condition popup component lane (we pin only the payload bytes).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRollConditionSaveHandler } from './createRollConditionSaveHandler.js';

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
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
    SLOW_TE_EFFECTS: ['no_reactions', 'dex_save_disadvantage', 'ac_penalty', 'action_limit', 'single_attack_limit', 'somatic_failure_chance'],
}));

vi.mock('../../services/encounters/combatLoggingService.js', () => ({
    logConditionSave: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(async () => []),
    addEntry: vi.fn(async () => ({})),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import storage from '../../services/ui/storage.js';
import { rollConditionSave, removeCondition, buildConditionPopup } from '../../services/combat/conditions/conditionSaveService.js';
import { removeForcecageEffect } from '../../services/automation/handlers/spells/forcecageHandler.js';
import { removeMazeEffect } from '../../services/automation/handlers/spells/mazeHandler.js';
import { removeSlowEffectsForTarget } from '../../services/combat/conditions/slowEffects.js';
import { logConditionSave } from '../../services/encounters/combatLoggingService.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

function makeSuccessRoll(overrides = {}) {
    return {
        roll: 15, success: true, bonus: 2, bonusDetail: '', rolls: [15], starryDragonFloor: false,
        ...overrides,
    };
}

function makeFailureRoll(overrides = {}) {
    return {
        roll: 3, success: false, bonus: 2, bonusDetail: '', rolls: [3], starryDragonFloor: false,
        ...overrides,
    };
}

function defaultTargetEffects(target, effect, source, dc) {
    return [{ target, effect, source, dc }];
}

// Single-target-effect fixture: removeTargetEffect's filter then writes exactly [].
function teFor(effect, target = 'Alice', source = 'Goblin', dc = 15) {
    return defaultTargetEffects(target, effect, source, dc);
}

describe('createRollConditionSaveHandler', () => {
    let mockCombatSummary;
    let mockCharacters;
    let mockCampaignNpcs;
    let mockSetConditionPopup;
    let mockSetCombatSummary;

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        storage.set.mockReturnValue(undefined);

        removeCondition.mockReturnValue(undefined);
        buildConditionPopup.mockReturnValue({ success: true });
        removeForcecageEffect.mockReturnValue({});
        removeMazeEffect.mockReturnValue({});
        removeSlowEffectsForTarget.mockReturnValue(true);

        mockCombatSummary = {
            round: 1,
            creatures: [
                { name: 'Alice', type: 'player' },
                { name: 'Goblin', type: 'npc' },
            ],
        };
        mockCharacters = [
            { name: 'Alice', computedStats: { hitPoints: 20, currentHitPoints: 20 } },
        ];
        mockCampaignNpcs = [];
        mockSetConditionPopup = vi.fn();
        mockSetCombatSummary = vi.fn();
    });

    function createHandler(overrides = {}) {
        return createRollConditionSaveHandler({
            combatSummary: mockCombatSummary,
            campaignName: 'test-campaign',
            characters: mockCharacters,
            campaignNpcs: mockCampaignNpcs,
            mapName: 'test-map',
            setConditionPopup: mockSetConditionPopup,
            setCombatSummary: mockSetCombatSummary,
            ...overrides,
        });
    }

    // ------------------------------------------------------------------
    // Core flow: early returns, success/fail branches, popup/log bytes
    // ------------------------------------------------------------------
    it('does nothing when combatSummary is missing or the creature is unknown', async () => {
        await createHandler({ combatSummary: null })('Alice', { key: 'blinded', label: 'Blinded' });
        await createHandler()('NonExistent', { key: 'blinded', label: 'Blinded' });

        expect(rollConditionSave).not.toHaveBeenCalled();
        expect(mockSetConditionPopup).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
    });

    it('success: resolves save once with exact args, removes condition, persists summary by identity, emits exact popup + log bytes', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 15, bonus: 3, bonusDetail: '(+3 proficiency)' }));
        const condition = { key: 'blinded', label: 'Blinded', dc: 12, ability: 'con' };

        await createHandler()('Alice', condition);

        expect(rollConditionSave).toHaveBeenCalledTimes(1);
        expect(rollConditionSave).toHaveBeenCalledWith({
            creature: { name: 'Alice', type: 'player' },
            condition,
            characters: mockCharacters,
            campaignNpcs: mockCampaignNpcs,
            campaignName: 'test-campaign',
            mapName: 'test-map',
            getName: expect.any(Function),
        });
        expect(removeCondition).toHaveBeenCalledTimes(1);
        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition,
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        // SP-109 negative side: non-slow conditions never strip slow effects here.
        expect(removeSlowEffectsForTarget).not.toHaveBeenCalled();

        // Persistence identity (#825): storage gets the live object, UI gets a fresh clone.
        expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
        expect(storage.set.mock.calls[0][1]).toBe(mockCombatSummary);
        expect(mockSetCombatSummary).toHaveBeenCalledTimes(1);
        const uiSummary = mockSetCombatSummary.mock.calls[0][0];
        expect(uiSummary).not.toBe(mockCombatSummary);
        expect(uiSummary).toEqual(mockCombatSummary);

        expect(buildConditionPopup).toHaveBeenCalledWith({
            roll: 15, bonus: 3, bonusDetail: '(+3 proficiency)', abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 12, success: true, rolls: [15], advantage: false, starryDragonFloor: false,
        });
        expect(mockSetConditionPopup).toHaveBeenCalledWith({ success: true });
        expect(logConditionSave).toHaveBeenCalledWith({
            campaignName: 'test-campaign', creatureName: 'Alice', roll: 15, bonus: 3, bonusDetail: '(+3 proficiency)',
            conditionLabel: 'Blinded', abilityLabel: 'Constitution', dc: 12, success: true,
        });
    });

    it('failed save: removes nothing and logs no condition entries, still persists summary, popup + log carry success:false', async () => {
        rollConditionSave.mockResolvedValue(makeFailureRoll());
        const condition = { key: 'blinded', label: 'Blinded', dc: 10, ability: 'con' };

        await createHandler()('Alice', condition);

        expect(removeCondition).not.toHaveBeenCalled();
        expect(removeSlowEffectsForTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
        expect(mockSetCombatSummary).toHaveBeenCalledTimes(1);
        expect(buildConditionPopup).toHaveBeenCalledWith({
            roll: 3, bonus: 2, bonusDetail: '', abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 10, success: false, rolls: [3], advantage: false, starryDragonFloor: false,
        });
        expect(logConditionSave).toHaveBeenCalledWith({
            campaignName: 'test-campaign', creatureName: 'Alice', roll: 3, bonus: 2, bonusDetail: '',
            conditionLabel: 'Blinded', abilityLabel: 'Constitution', dc: 10, success: false,
        });
    });

    it('multi-roll advantage + starryDragonFloor pass through to popup and log as dice array (CLA-209)', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 15, bonus: 2, rolls: [5, 15], starryDragonFloor: true }));

        await createHandler()('Alice', { key: 'blinded', label: 'Blinded', dc: 12, ability: 'con' });

        expect(buildConditionPopup).toHaveBeenCalledWith({
            roll: 15, bonus: 2, bonusDetail: '', abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 12, success: true, rolls: [5, 15], advantage: true, starryDragonFloor: true,
        });
        expect(logConditionSave).toHaveBeenCalledWith({
            campaignName: 'test-campaign', creatureName: 'Alice', roll: [5, 15], bonus: 2, bonusDetail: '',
            conditionLabel: 'Blinded', abilityLabel: 'Constitution', dc: 12, success: true,
        });
    });

    // ------------------------------------------------------------------
    // Spell cleanups on successful saves (this lane's inline handlers)
    // ------------------------------------------------------------------
    it("Otto's Irresistible Dance success: removes speed_zero, clears targetEffects to [], logs both entries", async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((key, prop) =>
            key === 'campaign' && prop === 'targetEffects' ? teFor('ottos_irresistible_dance') : null);

        await createHandler()('Alice', { key: 'charmed', label: 'Charmed', dc: 15, ability: 'wis' });

        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'speed_zero' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        // Fixture holds the matching te alone → cleared write is the literal empty array.
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'save_result', characterName: 'Goblin', rollType: 'save-ottos-dance',
                targetName: 'Alice', saveDc: 15, saveType: 'WIS', success: true,
            })
        );
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Charmed, Speed 0' })
        );
    });

    it("Tasha's Hideous Laughter success (saving prone): removes prone + incapacitated, clears targetEffects to [], logs both", async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((key, prop) =>
            key === 'campaign' && prop === 'targetEffects' ? teFor('tashas_hideous_laughter', 'Alice', 'Goblin', 10) : null);

        await createHandler()('Alice', { key: 'prone', label: 'Prone', dc: 10, ability: 'wis' });

        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'prone' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'incapacitated' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'save_result', characterName: 'Goblin', rollType: 'save-tashas-laughter',
                targetName: 'Alice', saveDc: 10, saveType: 'WIS', success: true,
            })
        );
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Prone, Incapacitated' })
        );
    });

    it("Tasha's cleanup also routes when incapacitated (not prone) is the condition saved", async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((key, prop) =>
            key === 'campaign' && prop === 'targetEffects' ? teFor('tashas_hideous_laughter', 'Alice', 'Goblin', 10) : null);

        await createHandler()('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 10, ability: 'wis' });

        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'prone' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
    });

    it('Confusion success: removes charmed + speed_zero, clears targetEffects to [], logs both', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((key, prop) =>
            key === 'campaign' && prop === 'targetEffects' ? teFor('confusion') : null);

        await createHandler()('Alice', { key: 'confused', label: 'Confused', dc: 15, ability: 'wis' });

        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'charmed' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'speed_zero' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'save_result', characterName: 'Goblin', rollType: 'save-confusion',
                targetName: 'Alice', saveDc: 15, saveType: 'WIS', success: true,
            })
        );
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Charmed, Speed 0' })
        );
    });

    it('Forcecage success: delegates removal to removeForcecageEffect with te source, logs escape', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((key, prop) =>
            key === 'campaign' && prop === 'targetEffects' ? teFor('forcecage') : null);

        await createHandler()('Alice', { key: 'forcecaged', label: 'Forcecaged', dc: 15, ability: 'cha' });

        expect(removeForcecageEffect).toHaveBeenCalledWith('Alice', 'Goblin', 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'save_result', characterName: 'Goblin', rollType: 'save-forcecage',
                targetName: 'Alice', saveDc: 15, saveType: 'CHA', success: true,
            })
        );
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Forcecaged' })
        );
    });

    it('Maze escape success: clears mazeData + activeConditions, breaks caster Maze concentration (SP-080), holds unrelated concentration on rerun', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 18, bonus: 5 }));
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return teFor('maze', 'Alice', 'Goblin', 20);
            if (key === 'Alice' && prop === 'mazeData') return { casterName: 'Goblin', dc: 20 };
            if (key === 'Alice' && prop === 'activeConditions') return ['incapacitated', 'blinded'];
            return null;
        });
        const goblin = mockCombatSummary.creatures.find(c => c.name === 'Goblin');
        goblin.concentration = { spell: 'Maze', dc: 19 };

        await createHandler()('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' });

        expect(removeMazeEffect).toHaveBeenCalledWith('Alice', 'Goblin', 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'mazeData', null, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('Alice', 'activeConditions', ['blinded'], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'save_result', characterName: 'Goblin', rollType: 'save-maze-escape',
                targetName: 'Alice', saveDc: 20, saveType: 'INT', success: true,
            })
        );
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ type: 'condition', action: 'removed', condition: 'Incapacitated' })
        );
        // SP-080: escape ends the spell — caster's Maze concentration breaks with a release log.
        expect(goblin.concentration).toBeNull();
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'automation', automationType: 'maze_concentration_released',
                characterName: 'Goblin', abilityName: 'Maze',
            })
        );

        // Identity gate: an unrelated caster concentration survives an escape cleanup.
        goblin.concentration = { spell: 'Hex', dc: 13 };
        await createHandler()('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' });
        expect(goblin.concentration.spell).toBe('Hex');
        const releaseLogs = addEntry.mock.calls.filter(([, e]) => e.automationType === 'maze_concentration_released');
        expect(releaseLogs.length).toBe(1);
    });

    it('Ray of Enfeeblement success: clears targetEffects to [], breaks caster concentration, logs save-ends; unrelated caster concentration survives rerun', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((key, prop) =>
            key === 'campaign' && prop === 'targetEffects' ? teFor('ray_of_enfeeble_debuff', 'Alice', 'Merlin', 17) : null);
        mockCombatSummary.creatures.push({ name: 'Merlin', type: 'player', concentration: { spell: 'Ray of Enfeeblement', dc: 17 } });

        await createHandler()('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });

        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        const merlin = mockCombatSummary.creatures.find(c => c.name === 'Merlin');
        expect(merlin.concentration).toBeNull();
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'save_result', characterName: 'Merlin', rollType: 'save-ray-of-enfeeblement',
                targetName: 'Alice', saveDc: 17, saveType: 'CON', success: true,
            })
        );
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'condition', action: 'removed', condition: 'Ray of Enfeeblement debuff',
                note: expect.stringContaining('save ends'),
            })
        );

        // Identity gate: a caster concentrating something else is untouched.
        merlin.concentration = { spell: 'Hex', dc: 13 };
        await createHandler()('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });
        expect(merlin.concentration.spell).toBe('Hex');
    });

    it('SP-109 slow success: strips its own target effects and logs removal', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());

        await createHandler()('Goblin', { key: 'slow', label: 'Slow', dc: 17, ability: 'wis' });

        expect(removeCondition).toHaveBeenCalledTimes(1);
        expect(removeSlowEffectsForTarget).toHaveBeenCalledWith('Goblin', 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign',
            expect.objectContaining({ type: 'condition', action: 'removed', characterName: 'Goblin', condition: 'Slow effects' }),
        );
    });

    // ------------------------------------------------------------------
    // Routing guards + failed-save retention
    // ------------------------------------------------------------------
    it('cleanup only fires for a routed key WITH its matching targetEffect — never otherwise', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        const handler = createHandler();

        // Matching keys, no targetEffects in store → every guard returns early.
        for (const key of ['charmed', 'prone', 'incapacitated', 'confused', 'forcecaged', 'ray_of_enfeeble_debuff']) {
            await handler('Alice', { key, label: 'Anything', dc: 10, ability: 'wis' });
        }
        expect(removeForcecageEffect).not.toHaveBeenCalled();
        expect(removeMazeEffect).not.toHaveBeenCalled();
        expect(removeSlowEffectsForTarget).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        // Only the main-flow removal, once per save — no cleanup-side removals.
        expect(removeCondition).toHaveBeenCalledTimes(6);

        // Matching targetEffect, unrelated condition key → no cleanup routing.
        getRuntimeValue.mockImplementation((k, p) =>
            k === 'campaign' && p === 'targetEffects' ? teFor('forcecage') : null);
        await handler('Alice', { key: 'poisoned', label: 'Poisoned', dc: 15, ability: 'con' });
        expect(removeForcecageEffect).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('routes condition keys case-insensitively (key lowercased before dispatch)', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((k, p) =>
            k === 'campaign' && p === 'targetEffects' ? teFor('ottos_irresistible_dance') : null);

        await createHandler()('Alice', { key: 'CHARMED', label: 'Charmed', dc: 15, ability: 'wis' });

        expect(removeCondition).toHaveBeenCalledWith({
            combatSummary: mockCombatSummary, creatureName: 'Alice', condition: { key: 'speed_zero' },
            getRuntimeValue: expect.any(Function), setRuntimeValue: expect.any(Function), campaignName: 'test-campaign',
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ rollType: 'save-ottos-dance', success: true })
        );
    });

    it('failed saves keep their effects: slow te intact, ray logs "kept", caster Maze concentration held', async () => {
        rollConditionSave.mockResolvedValue(makeFailureRoll());
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [
                    ...teFor('ray_of_enfeeble_debuff', 'Alice', 'Merlin', 17),
                    ...teFor('maze', 'Alice', 'Goblin', 20),
                ];
            }
            return null;
        });
        const goblin = mockCombatSummary.creatures.find(c => c.name === 'Goblin');
        goblin.concentration = { spell: 'Maze', dc: 19 };
        const handler = createHandler();

        await handler('Goblin', { key: 'slow', label: 'Slow', dc: 17, ability: 'wis' });
        expect(removeSlowEffectsForTarget).not.toHaveBeenCalled();

        await handler('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });
        expect(addEntry).toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({
                type: 'condition', action: 'kept', characterName: 'Alice',
                condition: 'Ray of Enfeeblement debuff', note: expect.stringContaining('continues'),
            })
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign');

        await handler('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' });
        expect(removeMazeEffect).not.toHaveBeenCalled();
        expect(goblin.concentration.spell).toBe('Maze');
        expect(addEntry).not.toHaveBeenCalledWith(
            'test-campaign', expect.objectContaining({ automationType: 'maze_concentration_released' })
        );
    });

    // ------------------------------------------------------------------
    // Error handling
    // ------------------------------------------------------------------
    it('does not throw when logService.addEntry rejects — cleanup and popup still complete', async () => {
        rollConditionSave.mockResolvedValue(makeSuccessRoll());
        getRuntimeValue.mockImplementation((k, p) =>
            k === 'campaign' && p === 'targetEffects' ? teFor('forcecage') : null);
        addEntry.mockRejectedValue(new Error('log failure'));

        await expect(createHandler()('Alice', { key: 'forcecaged', label: 'Forcecaged', dc: 15, ability: 'cha' }))
            .resolves.toBeUndefined();

        expect(removeForcecageEffect).toHaveBeenCalled();
        expect(mockSetConditionPopup).toHaveBeenCalledWith({ success: true });
    });
});
