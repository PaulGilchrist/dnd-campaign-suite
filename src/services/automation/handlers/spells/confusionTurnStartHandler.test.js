import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handleConfusionTurnStart, applyEndOfTurnConfusionSave, removeConfusionEffect } from './confusionTurnStartHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makeConfusionEffect(overrides = {}) {
    return {
        target: 'Goblin',
        effect: 'confusion',
        source: 'TestCaster',
        dc: 13,
        duration: 'concentration',
        conditions: ['charmed', 'speed_zero'],
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('handleConfusionTurnStart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when no confusion effect exists', () => {
        it('returns null when targetEffects is empty', async () => {
            getRuntimeValue.mockReturnValue([]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result).toBeNull();
        });

        it('returns null when targetEffects is missing', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result).toBeNull();
        });

        it('returns null when target has no confusion effect', async () => {
            getRuntimeValue.mockReturnValue([
                makeConfusionEffect({ target: 'Orc', effect: 'fear' }),
            ]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result).toBeNull();
        });
    });

    describe('when confusion effect exists', () => {
        it('returns behavior object with d10Roll, dc, and behaviorText', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('behavior');
            expect(result).toHaveProperty('d10Roll');
            expect(result).toHaveProperty('dc', 13);
            expect(result).toHaveProperty('behaviorText');
        });

        it('rolls a d10 between 1 and 10', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.d10Roll).toBeGreaterThanOrEqual(1);
            expect(result.d10Roll).toBeLessThanOrEqual(10);
        });

        it('returns behavior "move_random" for d10 roll of 1', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0*10)+1 = 1
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.behavior).toBe('move_random');
            expect(result.behaviorText).toContain('moves randomly');
            expect(result.behaviorText).toContain('north');
            Math.random.mockRestore();
        });

        it('includes direction in behavior text for move_random', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0); // d10=1, d4=1 (north)
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.behaviorText).toContain('north');
            Math.random.mockRestore();
        });

        it('returns behavior "do_nothing" for d10 roll between 2 and 6', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.15); // floor(1.5)+1 = 2
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.behavior).toBe('do_nothing');
            expect(result.behaviorText).toContain('does nothing');
            expect(result.behaviorText).toContain('no movement or actions');
            Math.random.mockRestore();
        });

        it('returns behavior "attack_random" for d10 roll between 7 and 8', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.75); // floor(7.5)+1 = 8
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.behavior).toBe('attack_random');
            expect(result.behaviorText).toContain('Attack action');
            expect(result.behaviorText).toContain('random creature');
            Math.random.mockRestore();
        });

        it('returns behavior "choose" for d10 roll between 9 and 10', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.9); // floor(9)+1 = 10
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.behavior).toBe('choose');
            expect(result.behaviorText).toContain('chooses its own behavior');
            Math.random.mockRestore();
        });

        it('logs a condition entry with type "condition"', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            await handleConfusionTurnStart('Goblin', campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'turn_start_behavior',
                characterName: 'Goblin',
                condition: 'Confused',
                reason: 'Confusion spell turn-start effect',
                note: expect.any(String),
                timestamp: expect.any(Number),
            }));
        });

        it('includes target name in the behavior log note', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            await handleConfusionTurnStart('Goblin', campaignName);

            const logEntry = addEntry.mock.calls[0][1];
            expect(logEntry.note).toContain('Goblin');
        });

        it('uses the confusion effect dc in the result', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect({ dc: 17 })]);

            const result = await handleConfusionTurnStart('Goblin', campaignName);

            expect(result.dc).toBe(17);
        });
    });

    describe('error handling', () => {
        it('does not throw when addEntry fails', async () => {
            vi.spyOn(console, 'error').mockReturnValue();
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);
            addEntry.mockRejectedValue(new Error('Log error'));

            await expect(handleConfusionTurnStart('Goblin', campaignName)).resolves.toBeDefined();

            console.error.mockRestore();
        });
    });
});

describe('applyEndOfTurnConfusionSave', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when no confusion effect exists', () => {
        it('returns null when targetEffects is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            expect(result).toBeNull();
        });

        it('returns null when target has no confusion effect', () => {
            getRuntimeValue.mockReturnValue([
                makeConfusionEffect({ target: 'Orc', effect: 'fear' }),
            ]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            expect(result).toBeNull();
        });
    });

    describe('when confusion effect exists', () => {
        it('returns an object with promptId, dc, saveType, and targetName', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            expect(result).toBeDefined();
            expect(result).toHaveProperty('promptId');
            expect(result).toHaveProperty('dc', 13);
            expect(result).toHaveProperty('saveType', 'WIS');
            expect(result).toHaveProperty('targetName', 'Goblin');
        });

        it('generates a promptId with the correct prefix', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            expect(result.promptId).toMatch(/^confusion-end-turn-/);
        });

        it('uses confusion effect dc when provided', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect({ dc: 17 })]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            expect(result.dc).toBe(17);
        });

        it('falls back to passed saveDc when confusion effect dc is missing', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect({ dc: undefined })]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 15, 'WIS');

            expect(result.dc).toBe(15);
        });

        it('defaults to WIS saveType when not provided', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13);

            expect(result.saveType).toBe('WIS');
        });

        it('uses passed saveType when provided', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            const result = applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'INT');

            expect(result.saveType).toBe('INT');
        });

        it('adds the promptId to pendingSaveListenerPrompts', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'pendingSaveListenerPrompts',
                expect.arrayContaining([expect.stringMatching(/^confusion-end-turn-/)]),
                campaignName,
            );
        });

        it('appends to existing pendingSaveListenerPrompts', () => {
            getRuntimeValue.mockReturnValue([
                makeConfusionEffect(),
            ]);
            // First call returns existing prompts with one already there
            let existingPrompts = ['existing-prompt'];
            getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'pendingSaveListenerPrompts') {
                    return existingPrompts;
                }
                return [makeConfusionEffect()];
            });

            applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            const updatedPrompts = setRuntimeValue.mock.calls[0][2];
            expect(updatedPrompts.length).toBe(2);
            expect(updatedPrompts).toContain('existing-prompt');
        });

        it('handles missing pendingSaveListenerPrompts by starting a new array', () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (key === 'pendingSaveListenerPrompts') {
                    return undefined;
                }
                return [makeConfusionEffect()];
            });

            applyEndOfTurnConfusionSave('Goblin', campaignName, 13, 'WIS');

            const updatedPrompts = setRuntimeValue.mock.calls[0][2];
            expect(updatedPrompts.length).toBe(1);
        });
    });
});

describe('removeConfusionEffect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('condition removal', () => {
        it('removes charmed and speed_zero from activeConditions', () => {
            getRuntimeValue.mockReturnValue(['charmed', 'speed_zero', 'frightened']);

            removeConfusionEffect('Goblin', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['frightened']),
                campaignName,
            );
            // Should only have frightened left
            const newConditions = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions')[2];
            expect(newConditions).toEqual(['frightened']);
        });

        it('removes charmed and speed_zero even if they appear in different cases', () => {
            getRuntimeValue.mockReturnValue(['CHARMED', 'Speed_Zero', 'blinded']);

            removeConfusionEffect('Goblin', campaignName);

            const newConditions = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions')[2];
            expect(newConditions).toEqual(['blinded']);
        });

        it('handles when charmed and speed_zero are not present', () => {
            getRuntimeValue.mockReturnValue(['frightened', 'blinded']);

            removeConfusionEffect('Goblin', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                ['frightened', 'blinded'],
                campaignName,
            );
        });

        it('handles empty activeConditions array', () => {
            getRuntimeValue.mockReturnValue([]);

            removeConfusionEffect('Goblin', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                [],
                campaignName,
            );
        });

        it('handles undefined activeConditions', () => {
            getRuntimeValue.mockReturnValue(undefined);

            removeConfusionEffect('Goblin', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                [],
                campaignName,
            );
        });

        it('handles non-array activeConditions as empty', () => {
            getRuntimeValue.mockReturnValue('not-an-array');

            removeConfusionEffect('Goblin', campaignName);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                [],
                campaignName,
            );
        });
    });

    describe('targetEffects removal', () => {
        it('removes confusion targetEffect for the target', () => {
            getRuntimeValue.mockReturnValue([
                makeConfusionEffect(),
                { target: 'Orc', effect: 'fear', source: 'Caster' },
            ]);

            removeConfusionEffect('Goblin', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
            expect(effectCalls.length).toBeGreaterThan(0);
            const newEffects = effectCalls[effectCalls.length - 1][2];
            expect(newEffects.length).toBe(1);
            expect(newEffects[0].target).toBe('Orc');
            expect(newEffects[0].effect).toBe('fear');
        });

        it('handles when confusion effect is not present for target', () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Orc', effect: 'fear', source: 'Caster' },
            ]);

            removeConfusionEffect('Goblin', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
            expect(effectCalls.length).toBeGreaterThan(0);
            const newEffects = effectCalls[effectCalls.length - 1][2];
            expect(newEffects.length).toBe(1);
            expect(newEffects[0].target).toBe('Orc');
        });

        it('handles non-array targetEffects', () => {
            getRuntimeValue.mockReturnValue('not-an-array');

            removeConfusionEffect('Goblin', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
            expect(effectCalls.length).toBeGreaterThan(0);
            expect(effectCalls[0][2]).toEqual([]);
        });

        it('handles undefined targetEffects', () => {
            getRuntimeValue.mockReturnValue(undefined);

            removeConfusionEffect('Goblin', campaignName);

            const effectCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
            expect(effectCalls.length).toBeGreaterThan(0);
            expect(effectCalls[0][2]).toEqual([]);
        });
    });

    describe('logging', () => {
        it('logs a condition entry with action "removed"', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            removeConfusionEffect('Goblin', campaignName);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'condition',
                action: 'removed',
                characterName: 'Goblin',
                condition: 'Confused',
                reason: 'Successful WIS save at end of turn',
                timestamp: expect.any(Number),
            }));
        });

        it('includes target name in the condition entry', async () => {
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);

            removeConfusionEffect('Goblin', campaignName);

            const logEntry = addEntry.mock.calls[0][1];
            expect(logEntry.characterName).toBe('Goblin');
        });
    });

    describe('error handling', () => {
        it('does not throw when addEntry fails', () => {
            vi.spyOn(console, 'error').mockReturnValue();
            getRuntimeValue.mockReturnValue([makeConfusionEffect()]);
            addEntry.mockRejectedValue(new Error('Log error'));

            removeConfusionEffect('Goblin', campaignName);

            console.error.mockRestore();
        });
    });
});
