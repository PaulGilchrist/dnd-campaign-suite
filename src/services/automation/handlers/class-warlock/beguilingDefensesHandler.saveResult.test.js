// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './beguilingDefensesHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn().mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
    }),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');

const campaignName = 'test-campaign';
const playerName = 'WarlockGirl';

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        abilities: [{ name: 'CHA', bonus: 4 }],
        proficiency: 3,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Beguiling Defenses',
        automation: {
            type: 'beguiling_defenses',
            saveDc: 15,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makeHitAttack(attacker, target) {
    return {
        attackEvent: { timestamp: Date.now(), targetName: target },
        attackerName: attacker,
        targetName: target,
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
    };
}

function dispatchSaveResult(promptId, success) {
    window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success },
    }));
}

function setupSaveTest(attackResult) {
    findLastAttack.mockResolvedValue(attackResult || makeHitAttack('Goblin', playerName));
    getRuntimeValue.mockReturnValue(0);
    getCombatContext.mockResolvedValue(null);
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
}

describe('beguilingDefensesHandler.saveResult', () => {
    describe('save failure handling', () => {
        it('logs damage_roll entry when attacker fails save', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'damage_roll',
                characterName: playerName,
                targetName: 'Goblin',
                damageType: 'Psychic',
                formula: 'equal to damage taken (after halving)',
                description: expect.stringContaining('failed'),
                timestamp: expect.any(Number),
            }));
        });

        it('includes the target name and feature name in failure description', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.description).toContain('Goblin');
            expect(logCall.description).toContain('Beguiling Defenses');
            expect(logCall.description).toContain('Psychic damage');
        });

        it('logs damage_roll with correct targetName from combat context', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: playerName }],
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.targetName).toBe('Orc');
            expect(logCall.description).toContain('Orc');
        });

        it('logs damage_roll when pact magic was spent to restore a use', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            await handle(action, makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'damage_roll',
                targetName: 'Goblin',
                damageType: 'Psychic',
            }));
        });

        it('uses custom saveType in failure description', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));
            buildSaveDc.mockReturnValue(14);

            const action = makeAction({ automation: { saveType: 'CHA', saveDc: 14 } });
            await handle(action, makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.description).toContain('CHA');
        });

        it('uses custom feature name in failure description', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            const action = makeAction({ name: 'Custom Defense' });
            await handle(action, makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.description).toContain('Custom Defense');
        });
    });

    describe('save success handling', () => {
        it('logs save_result entry when attacker succeeds on save', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                characterName: playerName,
                targetName: 'Goblin',
                saveDc: 15,
                saveType: 'WIS',
                success: true,
                description: expect.stringContaining('succeeded'),
                timestamp: expect.any(Number),
            }));
        });

        it('includes save DC and type in success log entry', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.saveDc).toBe(15);
            expect(logCall.saveType).toBe('WIS');
        });

        it('mentions no Psychic damage in success description', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.description).toContain('no Psychic damage');
        });

        it('uses custom saveType in success log entry', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));
            buildSaveDc.mockReturnValue(14);

            const action = makeAction({ automation: { saveType: 'CON', saveDc: 14 } });
            await handle(action, makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.saveType).toBe('CON');
        });

        it('uses custom feature name in success description', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            const action = makeAction({ name: 'My Feature' });
            await handle(action, makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.description).toContain('My Feature');
        });

        it('logs success entry with correct targetName from combat context', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: playerName }],
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            const logCall = addEntry.mock.calls[1][1];
            expect(logCall.targetName).toBe('Orc');
        });
    });

    describe('promptId filtering', () => {
        it('ignores save result events with wrong promptId', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('wrong-prompt-id', false);

            // Should have exactly one addEntry call (the initial ability_use),
            // not the damage_roll from the save failure
            const damageRollCalls = addEntry.mock.calls.filter(
                call => call[1].type === 'damage_roll'
            );
            expect(damageRollCalls).toHaveLength(0);
        });

        it('ignores save result events with wrong promptId on success', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('wrong-prompt-id', true);

            // Should have exactly one addEntry call (the initial ability_use),
            // not the save_result from the save success
            const saveResultCalls = addEntry.mock.calls.filter(
                call => call[1].type === 'save_result'
            );
            expect(saveResultCalls).toHaveLength(0);
        });

        it('does not remove event listener when promptId does not match', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('wrong-prompt-id', false);

            expect(removeEventListenerSpy).not.toHaveBeenCalled();
            removeEventListenerSpy.mockRestore();
        });
    });

    describe('event listener cleanup', () => {
        it('removes the save-result event listener after handling save failure', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', false);

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            removeEventListenerSpy.mockRestore();
        });

        it('removes the save-result event listener after handling save success', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));

            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

            await handle(makeAction(), makePlayerStats(), campaignName, null);
            dispatchSaveResult('test-prompt-id', true);

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            removeEventListenerSpy.mockRestore();
        });
    });

    describe('error handling in log entries', () => {
        it('does not throw when pact magic ability_use addEntry rejects (fire-and-forget logging)', async () => {
            setupSaveTest(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });
            addEntry.mockImplementation(() => Promise.reject(new Error('pact magic log error')));

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });
});
