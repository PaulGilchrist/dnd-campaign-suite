// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from './hurlThroughHellHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'campaign';
const MAP = 'map';

function makeAction(overrides = {}) {
    return {
        name: 'Hurl Through Hell',
        automation: {
            type: 'hurl_through_hell',
            uses: 1,
            damageExpression: '8d10',
            damageType: 'Psychic',
            saveType: 'CHA',
            saveAbility: 'CHA',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return { name: 'TestHero', proficiency: 3, ...overrides };
}

function mockRuntimeValues(values) {
    getRuntimeValue.mockImplementation((_playerName, key, _campaign) => {
        if (values[key] !== undefined) return values[key];
        return null;
    });
}

function triggerSaveResult(success, promptId = 'test-prompt-id') {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success },
    }));
}

function flushTimers(count = 1) {
    return new Promise(r => setTimeout(r, count * 5));
}

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler.saveResult', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Remove any lingering event listeners from previous tests
        window.removeEventListener('save-result', () => {});
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Human', type: 'humanoid' }],
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Human' });
        mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });
        rollExpression.mockReturnValue({ total: 44, rolls: [10, 10, 10, 10, 4] });
        buildSaveDc.mockReturnValue(15);
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
    });

    afterEach(() => {
        window.removeEventListener('save-result', () => {});
    });

    describe('save failure - non-fiend', () => {
        it('should apply incapacitated condition to target', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeConditions', ['incapacitated'], CAMPAIGN);
        });

        it('should append incapacitated to existing conditions', async () => {
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: ['frightened'] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeConditions', ['frightened', 'incapacitated'], CAMPAIGN);
        });

        it('should handle null activeConditions gracefully', async () => {
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: null });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            expect(setRuntimeValue).toHaveBeenCalledWith('Human', 'activeConditions', ['incapacitated'], CAMPAIGN);
        });

        it('should log damage_roll entry for non-fiend', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const damageCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'damage_roll');
            expect(damageCalls).toHaveLength(1);
            expect(damageCalls[0][1]).toEqual(expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Human',
                damageType: 'Psychic',
                formula: '8d10',
                description: expect.stringContaining('Human'),
            }));
        });

        it('should log save_result entry with success: false for non-fiend', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const saveResultCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'save_result');
            expect(saveResultCalls).toHaveLength(1);
            expect(saveResultCalls[0][1]).toEqual(expect.objectContaining({
                type: 'save_result',
                targetName: 'Human',
                success: false,
                saveDc: 15,
                saveType: 'CHA',
            }));
        });

        it('should include damage total in damage log entry', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const damageCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'damage_roll');
            expect(damageCalls[0][1].description).toContain('44');
        });

        it('should log entries in correct order: save_result then damage_roll', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const allCalls = addEntry.mock.calls;
            const saveResultIdx = allCalls.findIndex(call => call[1]?.type === 'save_result');
            const damageIdx = allCalls.findIndex(call => call[1]?.type === 'damage_roll');
            expect(saveResultIdx).toBeLessThan(damageIdx);
        });
    });

    describe('save failure - fiend', () => {
        it('should NOT apply incapacitated condition to fiend', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Balor', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Balor' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Balor', 'activeConditions', expect.anything());
        });

        it('should log save_result with fiend no-damage note', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Balor', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Balor' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const saveResultCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'save_result');
            expect(saveResultCalls[0][1].description).toContain('Fiend');
            expect(saveResultCalls[0][1].description).toContain('no Psychic damage');
        });

        it('should NOT log damage_roll for fiend', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Balor', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Balor' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const damageCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'damage_roll');
            expect(damageCalls).toHaveLength(0);
        });

        it('should identify fiend by creature type field', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Imp', type: 'fiend', otherField: 'ignored' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Imp' });
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [], activeConditions: [] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            const damageCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'damage_roll');
            expect(damageCalls).toHaveLength(0);
        });
    });

    describe('save success', () => {
        it('should log save_result with success: true on save success', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(true);
            await flushTimers();

            const saveResultCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'save_result');
            expect(saveResultCalls).toHaveLength(1);
            expect(saveResultCalls[0][1]).toEqual(expect.objectContaining({
                type: 'save_result',
                success: true,
                targetName: 'Human',
                saveDc: 15,
                saveType: 'CHA',
            }));
        });

        it('should include success description text', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(true);
            await flushTimers();

            const saveResultCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'save_result');
            expect(saveResultCalls[0][1].description).toContain('succeeded');
            expect(saveResultCalls[0][1].description).toContain('not hurled');
        });

        it('should NOT apply incapacitated condition on save success', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(true);
            await flushTimers();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Human', 'activeConditions', expect.anything());
        });

        it('should NOT log damage_roll on save success', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(true);
            await flushTimers();

            const damageCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'damage_roll');
            expect(damageCalls).toHaveLength(0);
        });
    });

    describe('event listener management', () => {
        it('should register save-result event listener on handle call', async () => {
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            addEventListenerSpy.mockRestore();
        });

        it('should remove event listener after handling save failure', async () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false);
            await flushTimers();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            removeEventListenerSpy.mockRestore();
        });

        it('should remove event listener after handling save success', async () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(true);
            await flushTimers();

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            removeEventListenerSpy.mockRestore();
        });

        it('should NOT remove event listener when promptId does not match', async () => {
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            triggerSaveResult(false, 'wrong-prompt-id');
            await flushTimers();

            expect(removeEventListenerSpy).not.toHaveBeenCalled();
            removeEventListenerSpy.mockRestore();
        });


    });

    describe('targetEffects setup', () => {
        it('should create targetEffect with teleport and returnToSpace flags', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            expect(targetEffectsCalls).toHaveLength(1);

            const effects = targetEffectsCalls[0][2];
            const effect = effects[0];
            expect(effect.teleport).toBe(true);
            expect(effect.returnToSpace).toBe(true);
        });

        it('should create targetEffect with duration until_end_of_next_turn', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            const effect = targetEffectsCalls[0][2][0];
            expect(effect.duration).toBe('until_end_of_next_turn');
        });

        it('should create targetEffect with saveAbility from automation', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            const effect = targetEffectsCalls[0][2][0];
            expect(effect.saveAbility).toBe('CHA');
        });

        it('should append to existing targetEffects array', async () => {
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: [{ existing: true }] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            const effects = targetEffectsCalls[0][2];
            expect(effects).toHaveLength(2);
            expect(effects[0]).toEqual({ existing: true });
        });

        it('should handle null storedEffects by creating new array', async () => {
            mockRuntimeValues({ currentTurn: 'turn1', targetEffects: null });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            const effects = targetEffectsCalls[0][2];
            expect(effects).toHaveLength(1);
        });

        it('should include source as featureName in targetEffect', async () => {
            await handle(makeAction({ name: 'Custom Hurl' }), makePlayerStats(), CAMPAIGN, MAP);

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'targetEffects'
            );
            const effect = targetEffectsCalls[0][2][0];
            expect(effect.source).toBe('Custom Hurl');
        });
    });

    describe('rollExpression null handling', () => {
        it('should use 0 as damageTotal when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.damageTotal).toBe(0);
        });

        it('should use 0 as damageTotal when rollExpression returns object without total', async () => {
            rollExpression.mockReturnValue({});

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.damageTotal).toBe(0);
        });
    });

    describe('popup description content', () => {
        it('should include feature name in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Hurl Through Hell');
        });

        it('should include target name in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Target:');
            expect(result.payload.description).toContain('Human');
        });

        it('should include save DC in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('DC 15');
        });

        it('should include save type in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('CHA');
        });

        it('should include damage info in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('44 Psychic damage');
        });

        it('should include incapacitated condition in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Incapacitated');
        });

        it('should include return info in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('returns to the space');
        });

        it('should include uses remaining in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Uses remaining: 0 / 1');
        });

        it('should include ability_use log entry with promptId', async () => {
            await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            const abilityCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'ability_use');
            expect(abilityCalls).toHaveLength(1);
            expect(abilityCalls[0][1].promptId).toBe('test-prompt-id');
        });
    });

    describe('multiple uses support', () => {
        it('should show correct remaining uses when max uses is 2', async () => {
            const result = await handle(makeAction({
                automation: { uses: 2 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('Uses remaining: 1 / 2');
        });

        it('should allow activation when current uses is 1 out of 2', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'fiend' }],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            mockRuntimeValues({ hurlThroughHellUses: 1, currentTurn: 'turn1' });

            const result = await handle(makeAction({
                automation: { uses: 2 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Uses remaining: 0 / 2');
        });

        it('should block when current uses equals max uses of 2', async () => {
            mockRuntimeValues({ hurlThroughHellUses: 2, currentTurn: 'turn1' });

            const result = await handle(makeAction({
                automation: { uses: 2 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
        });
    });

    describe('custom damage configuration', () => {
        it('should use custom damage expression from automation', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [13, 12] });

            const result = await handle(makeAction({
                automation: { damageExpression: '2d12', damageType: 'Force' },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.damageTotal).toBe(25);
            expect(result.payload.damageType).toBe('Force');
        });

        it('should use custom save type from automation', async () => {
            buildSaveDc.mockReturnValue(14);

            const result = await handle(makeAction({
                automation: { saveType: 'WIS', saveAbility: 'WIS', saveDc: 14 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(14);
        });

        it('should pass custom save config to buildSaveDc', async () => {
            buildSaveDc.mockReturnValue(16);

            await handle(makeAction({
                automation: { saveType: 'DEX', saveAbility: 'DEX', saveDc: 16 },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(buildSaveDc).toHaveBeenCalled();
        });
    });

    describe('entry log with custom feature name', () => {
        it('should log ability_use with custom feature name', async () => {
            await handle(makeAction({ name: 'My Hurl' }), makePlayerStats(), CAMPAIGN, MAP);

            const abilityCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'ability_use');
            expect(abilityCalls[0][1].abilityName).toBe('My Hurl');
        });

        it('should include custom feature name in ability_use description', async () => {
            await handle(makeAction({ name: 'My Hurl' }), makePlayerStats(), CAMPAIGN, MAP);

            const abilityCalls = addEntry.mock.calls.filter(call => call[1]?.type === 'ability_use');
            expect(abilityCalls[0][1].description).toContain('My Hurl');
        });
    });
});
