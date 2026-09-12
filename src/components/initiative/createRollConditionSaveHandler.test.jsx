// @improved-by-ai
// @cleaned-by-ai
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
    // Early returns
    // ------------------------------------------------------------------
    describe('early returns', () => {
        it('returns early when combatSummary is null', async () => {
            const handler = createHandler({ combatSummary: null });
            await handler('Alice', { key: 'blinded', label: 'Blinded' });
            expect(rollConditionSave).not.toHaveBeenCalled();
        });

        it('returns early when creature is not found in combatSummary', async () => {
            const handler = createHandler();
            await handler('NonExistent', { key: 'blinded', label: 'Blinded' });
            expect(rollConditionSave).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // General save flow
    // ------------------------------------------------------------------
    describe('general save flow', () => {
        it('calls all services on a successful save', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'blinded', label: 'Blinded', dc: 10, ability: 'con' });

            expect(rollConditionSave).toHaveBeenCalledWith({
                creature: { name: 'Alice', type: 'player' },
                condition: { key: 'blinded', label: 'Blinded', dc: 10, ability: 'con' },
                characters: mockCharacters,
                campaignNpcs: mockCampaignNpcs,
                campaignName: 'test-campaign',
                mapName: 'test-map',
                getName: expect.any(Function),
            });
            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'blinded', label: 'Blinded', dc: 10, ability: 'con' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
            expect(mockSetCombatSummary).toHaveBeenCalled();
            expect(buildConditionPopup).toHaveBeenCalled();
            expect(logConditionSave).toHaveBeenCalled();
        });

        it('does not remove conditions or log on failed save', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeFailureRoll());

            await handler('Alice', { key: 'blinded', label: 'Blinded', dc: 10, ability: 'con' });

            expect(removeCondition).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(storage.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
            expect(mockSetCombatSummary).toHaveBeenCalled();
        });

        it('works for NPC creatures', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Goblin', { key: 'frightened', label: 'Frightened', dc: 10, ability: 'wis' });

            expect(rollConditionSave).toHaveBeenCalledWith({
                creature: { name: 'Goblin', type: 'npc' },
                condition: expect.any(Object),
                characters: expect.any(Array),
                campaignNpcs: expect.any(Array),
                campaignName: 'test-campaign',
                mapName: 'test-map',
                getName: expect.any(Function),
            });
        });
    });

    // ------------------------------------------------------------------
    // buildConditionPopup arguments
    // ------------------------------------------------------------------
    describe('buildConditionPopup arguments', () => {
        it('passes correct arguments on success', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 15, bonus: 3, bonusDetail: '(+3 proficiency)' }));

            await handler('Alice', { key: 'blinded', label: 'Blinded', dc: 12, ability: 'con' });

            expect(buildConditionPopup).toHaveBeenCalledWith({
                roll: 15, bonus: 3, bonusDetail: '(+3 proficiency)', abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 12, success: true, rolls: [15], advantage: false, starryDragonFloor: false,
            });
        });

        it('passes advantage=true when rolls has multiple entries', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll({ rolls: [15, 12] }));

            await handler('Alice', { key: 'blinded', label: 'Blinded', dc: 12, ability: 'con' });

            expect(buildConditionPopup).toHaveBeenCalledWith({
                roll: 15, bonus: 2, bonusDetail: '', abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 12, success: true, rolls: [15, 12], advantage: true, starryDragonFloor: false,
            });
        });

        it('passes starryDragonFloor when true', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 10, bonus: 3, rolls: [5], starryDragonFloor: true }));

            await handler('Alice', { key: 'blinded', label: 'Blinded', dc: 12, ability: 'con' });

            expect(buildConditionPopup).toHaveBeenCalledWith({
                roll: 10, bonus: 3, bonusDetail: '', abilityLabel: 'Constitution', conditionLabel: 'Blinded', dc: 12, success: true, rolls: [5], advantage: false, starryDragonFloor: true,
            });
        });
    });

    // ------------------------------------------------------------------
    // Otto's Irresistible Dance
    // ------------------------------------------------------------------
    describe("Otto's Irresistible Dance cleanup", () => {
        it('removes speed_zero, clears targetEffect, and logs on charmed save success', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'ottos_irresistible_dance', 'Goblin', 15);
                }
                return null;
            });

            await handler('Alice', { key: 'charmed', label: 'Charmed', dc: 15, ability: 'wis' });

            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'speed_zero' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-ottos-dance',
                    targetName: 'Alice',
                    saveType: 'WIS',
                    success: true,
                })
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    condition: 'Charmed, Speed 0',
                })
            );
        });

        it('does not trigger cleanup when no dance effect exists', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'charmed', label: 'Charmed', dc: 15, ability: 'wis' });

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
            expect(addEntry).not.toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({ rollType: 'save-ottos-dance' })
            );
        });

    });

    // ------------------------------------------------------------------
    // Tasha's Hideous Laughter
    // ------------------------------------------------------------------
    describe("Tasha's Hideous Laughter cleanup", () => {
        it('removes prone and incapacitated, clears targetEffect, and logs on prone save success', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'tashas_hideous_laughter', 'Goblin', 10);
                }
                return null;
            });

            await handler('Alice', { key: 'prone', label: 'Prone', dc: 10, ability: 'wis' });

            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'prone' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'incapacitated' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-tashas-laughter',
                    targetName: 'Alice',
                    saveType: 'WIS',
                    success: true,
                })
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    condition: 'Prone, Incapacitated',
                })
            );
        });

        it('triggers cleanup when incapacitated is the condition being saved', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'tashas_hideous_laughter', 'Goblin', 10);
                }
                return null;
            });

            await handler('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 10, ability: 'wis' });

            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'prone' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'incapacitated' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
        });

        it('does not trigger cleanup when no laughter effect exists', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'prone', label: 'Prone', dc: 10, ability: 'wis' });

            expect(removeCondition).not.toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'incapacitated' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
        });
    });

    // ------------------------------------------------------------------
    // Confusion
    // ------------------------------------------------------------------
    describe('Confusion cleanup', () => {
        it('removes charmed and speed_zero, clears targetEffect, and logs on confused save success', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'confusion', 'Goblin', 15);
                }
                return null;
            });

            await handler('Alice', { key: 'confused', label: 'Confused', dc: 15, ability: 'wis' });

            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'charmed' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(removeCondition).toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'speed_zero' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign', 'targetEffects', expect.any(Array), 'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-confusion',
                    targetName: 'Alice',
                    saveType: 'WIS',
                    success: true,
                })
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    condition: 'Charmed, Speed 0',
                })
            );
        });

        it('does not trigger cleanup when no confusion effect exists', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'confused', label: 'Confused', dc: 15, ability: 'wis' });

            expect(removeCondition).not.toHaveBeenCalledWith(
                mockCombatSummary, 'Alice', { key: 'charmed' },
                expect.any(Function), expect.any(Function), 'test-campaign'
            );
        });
    });

    // ------------------------------------------------------------------
    // Forcecage
    // ------------------------------------------------------------------
    describe('Forcecage cleanup', () => {
        it('calls removeForcecageEffect, clears targetEffect, and logs on forcecaged save success', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'forcecage', 'Goblin', 15);
                }
                return null;
            });

            await handler('Alice', { key: 'forcecaged', label: 'Forcecaged', dc: 15, ability: 'cha' });

            expect(removeForcecageEffect).toHaveBeenCalledWith(
                'Alice', 'Goblin', 'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-forcecage',
                    targetName: 'Alice',
                    saveType: 'CHA',
                    success: true,
                })
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    condition: 'Forcecaged',
                })
            );
        });

        it('does not trigger cleanup when no forcecage effect exists', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'forcecaged', label: 'Forcecaged', dc: 15, ability: 'cha' });

            expect(removeForcecageEffect).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // Maze
    // ------------------------------------------------------------------
    describe('Maze cleanup', () => {
        it('calls removeMazeEffect, clears mazeData, filters activeConditions, and logs on incapacitated save success', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 18, bonus: 5 }));
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'maze', 'Goblin', 20);
                }
                if (key === 'Alice' && prop === 'mazeData') {
                    return { casterName: 'Goblin', dc: 20 };
                }
                if (key === 'Alice' && prop === 'activeConditions') {
                    return ['incapacitated', 'blinded'];
                }
                return null;
            });

            await handler('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' });

            expect(removeMazeEffect).toHaveBeenCalledWith(
                'Alice', 'Goblin', 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Alice', 'mazeData', null, 'test-campaign'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Alice', 'activeConditions', ['blinded'], 'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-maze-escape',
                    targetName: 'Alice',
                    saveType: 'INT',
                    success: true,
                })
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    condition: 'Incapacitated',
                })
            );
        });

        it('does not trigger cleanup when no maze effect exists', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 18, bonus: 5 }));

            await handler('Alice', { key: 'incapacitated', label: 'Incapacitated', dc: 20, ability: 'int' });

            expect(removeMazeEffect).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Alice', 'mazeData', null, 'test-campaign'
            );
        });
    });

    // ------------------------------------------------------------------
    // Ray of Enfeeblement
    // ------------------------------------------------------------------
    describe('Ray of Enfeeblement cleanup', () => {
        it('clears targetEffect, clears caster concentration, and logs save ends on CON save success', async () => {
            mockCombatSummary.creatures.push({ name: 'Merlin', type: 'player', concentration: { spell: 'Ray of Enfeeblement', dc: 17 } });
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll({ roll: 15, bonus: 2 }));
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'ray_of_enfeeble_debuff', 'Merlin', 17);
                }
                return null;
            });

            await handler('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });

            const teCalls = setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
            expect(teCalls.length).toBeGreaterThan(0);
            expect(teCalls[teCalls.length - 1][2]).toEqual([]);
            const merlin = mockCombatSummary.creatures.find(c => c.name === 'Merlin');
            expect(merlin.concentration).toBeNull();
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-ray-of-enfeeblement',
                    targetName: 'Alice',
                    saveDc: 17,
                    saveType: 'CON',
                    success: true,
                })
            );
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'removed',
                    condition: 'Ray of Enfeeblement debuff',
                    note: expect.stringContaining('save ends'),
                })
            );
        });

        it('keeps unrelated caster concentration when ray save succeeds', async () => {
            mockCombatSummary.creatures.push({ name: 'Merlin', type: 'player', concentration: { spell: 'Hex', dc: 13 } });
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'ray_of_enfeeble_debuff', 'Merlin', 17);
                }
                return null;
            });

            await handler('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });

            const merlin = mockCombatSummary.creatures.find(c => c.name === 'Merlin');
            expect(merlin.concentration.spell).toBe('Hex');
        });

        it('logs that enfeeblement continues on failed repeat save without clearing the targetEffect', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeFailureRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'ray_of_enfeeble_debuff', 'Merlin', 17);
                }
                return null;
            });

            await handler('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });

            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({
                    type: 'condition',
                    action: 'kept',
                    characterName: 'Alice',
                    condition: 'Ray of Enfeeblement debuff',
                    note: expect.stringContaining('continues'),
                })
            );
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'campaign', 'targetEffects', [], 'test-campaign'
            );
        });

        it('does not trigger cleanup when no ray effect exists', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'ray_of_enfeeble_debuff', label: 'Enfeeblement', dc: 17, ability: 'con' });

            expect(addEntry).not.toHaveBeenCalledWith(
                'test-campaign', expect.objectContaining({ rollType: 'save-ray-of-enfeeblement' })
            );
        });
    });

    // ------------------------------------------------------------------
    // Case-insensitive condition key matching
    // ------------------------------------------------------------------
    describe('case-insensitive condition key matching', () => {
        const testCases = [
            { key: 'CHARMED', label: 'Charmed', effect: 'ottos_irresistible_dance', cleanupCheck: () => expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), 'test-campaign') },
            { key: 'FORCECAGED', label: 'Forcecaged', effect: 'forcecage', cleanupCheck: () => expect(removeForcecageEffect).toHaveBeenCalledWith('Alice', 'Goblin', 'test-campaign') },
            { key: 'INCAPACITATED', label: 'Incapacitated', effect: 'maze', cleanupCheck: () => expect(removeMazeEffect).toHaveBeenCalledWith('Alice', 'Goblin', 'test-campaign') },
        ];

        for (const { key, label, effect, cleanupCheck } of testCases) {
            it(`matches uppercase ${key} to ${effect}`, async () => {
                const handler = createHandler();
                rollConditionSave.mockResolvedValue(makeSuccessRoll());
                getRuntimeValue.mockImplementation((k, p) => {
                    if (k === 'campaign' && p === 'targetEffects') {
                        return defaultTargetEffects('Alice', effect, 'Goblin', 15);
                    }
                    return null;
                });

                await handler('Alice', { key, label, dc: 15, ability: 'wis' });

                cleanupCheck();
            });
        }
    });

    // ------------------------------------------------------------------
    // Edge cases
    // ------------------------------------------------------------------
    describe('edge cases', () => {
        it('does not trigger special handlers for unrelated conditions even with matching targetEffect', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'forcecage', 'Goblin', 15);
                }
                return null;
            });

            await handler('Alice', { key: 'poisoned', label: 'Poisoned', dc: 15, ability: 'con' });

            expect(removeForcecageEffect).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // Error handling
    // ------------------------------------------------------------------
    describe('error handling', () => {
        it('does not throw when logService.addEntry rejects', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') {
                    return defaultTargetEffects('Alice', 'forcecage', 'Goblin', 15);
                }
                return null;
            });
            addEntry.mockRejectedValue(new Error('log failure'));

            await expect(handler('Alice', { key: 'forcecaged', label: 'Forcecaged', dc: 15, ability: 'cha' }))
                .resolves.toBeUndefined();

            expect(removeForcecageEffect).toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // SP-109: Slow ends on itself on a successful repeat save — strip te + log
    // ------------------------------------------------------------------
    describe('SP-109 slow save-end cleanup', () => {
        it('strips Slow target effects and logs on a successful slow repeat save', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Goblin', { key: 'slow', label: 'Slow', dc: 17, ability: 'wis' });

            expect(removeCondition).toHaveBeenCalled();
            expect(removeSlowEffectsForTarget).toHaveBeenCalledWith('Goblin', 'test-campaign');
            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({ type: 'condition', action: 'removed', characterName: 'Goblin', condition: 'Slow effects' }),
            );
        });

        it('does not touch target effects when the slow repeat save fails', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeFailureRoll());

            await handler('Goblin', { key: 'slow', label: 'Slow', dc: 17, ability: 'wis' });

            expect(removeSlowEffectsForTarget).not.toHaveBeenCalled();
        });

        it('does not strip slow te for non-slow conditions', async () => {
            const handler = createHandler();
            rollConditionSave.mockResolvedValue(makeSuccessRoll());

            await handler('Alice', { key: 'blinded', label: 'Blinded', dc: 15, ability: 'con' });

            expect(removeSlowEffectsForTarget).not.toHaveBeenCalled();
        });
    });
});
