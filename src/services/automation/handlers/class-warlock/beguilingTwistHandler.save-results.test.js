// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './beguilingTwistHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    createSaveListener: vi.fn().mockReturnValue({ promptId: 'test-prompt-id' }),
    buildSaveDc: vi.fn().mockReturnValue(15),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { createSaveListener, buildSaveDc } = await import('../../common/savePrompt.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { isWithinRange } = await import('../../../rules/combat/rangeCheck.js');

const campaignName = 'test-campaign';
const playerName = 'WarlockPlayer';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Beguiling Twist',
        automation: { type: 'reaction_save', ...automation },
    };
}

function makeAttackResult(overrides = {}) {
    return {
        attackEvent: { hit: true },
        attackerName: 'Goblin',
        targetName: playerName,
        hit: true,
        primaryDamage: 10,
        secondaryDamage: 0,
        totalDamage: 10,
        damageTypes: [],
        ...overrides,
    };
}

function resetMocks() {
    vi.clearAllMocks();
    findLastAttack.mockResolvedValue({
        attackEvent: null,
        attackerName: null,
        targetName: null,
        primaryDamage: 0,
        secondaryDamage: 0,
        totalDamage: 0,
        damageTypes: [],
    });
}

function getSaveResultHandler(addEventListenerSpy) {
    const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'save-result')[1];
    return handler;
}

describe('beguilingTwistHandler', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('save result handler - failure', () => {
        it('should add condition to target when save fails', async () => {
            for (const { conditionType, expectedCondition } of [
                { conditionType: undefined, expectedCondition: 'charmed' },
                { conditionType: 'charmed', expectedCondition: 'charmed' },
                { conditionType: 'frightened', expectedCondition: 'frightened' },
            ]) {
                findLastAttack.mockResolvedValue(makeAttackResult());

                const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
                await handle(makeAction({ target: 'self', condition: conditionType }), makePlayerStats(), campaignName, null);

                const handler = getSaveResultHandler(addEventListenerSpy);
                handler({ detail: { promptId: 'test-prompt-id', success: false } });

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeConditions',
                    expect.arrayContaining([expectedCondition]),
                    campaignName
                );
                addEventListenerSpy.mockRestore();
                resetMocks();
            }
        });

        it('should not add condition when already present in activeConditions', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());
            getRuntimeValue.mockImplementation((_name, key) => {
                if (_name === playerName && key === 'activeConditions') return ['charmed'];
                return undefined;
            });

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = getSaveResultHandler(addEventListenerSpy);
            handler({ detail: { promptId: 'test-prompt-id', success: false } });

            expect(setRuntimeValue).not.toHaveBeenCalled();
            addEventListenerSpy.mockRestore();
        });

        it('should call addExpiration on save failure', async () => {
            for (const { conditionType, expectedCondition } of [
                { conditionType: undefined, expectedCondition: 'charmed' },
                { conditionType: 'frightened', expectedCondition: 'frightened' },
            ]) {
                findLastAttack.mockResolvedValue(makeAttackResult());

                const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
                await handle(makeAction({ target: 'self', condition: conditionType }), makePlayerStats(), campaignName, null);

                const handler = getSaveResultHandler(addEventListenerSpy);
                handler({ detail: { promptId: 'test-prompt-id', success: false } });

                expect(addExpiration).toHaveBeenCalledWith({ attackerName: playerName, targetName: playerName, effects: [{ type: 'condition', condition: expectedCondition }] });
                addEventListenerSpy.mockRestore();
                resetMocks();
            }
        });

        it('should log save_result entry on failure', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = getSaveResultHandler(addEventListenerSpy);
            handler({ detail: { promptId: 'test-prompt-id', success: false } });

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                targetName: playerName,
                saveDc: 15,
                saveType: 'WIS',
                success: false,
            }));
            addEventListenerSpy.mockRestore();
        });

        it('should remove event listener after handling save result', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'save-result')[1];
            handler({ detail: { promptId: 'test-prompt-id', success: false } });

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });

        it('should ignore save-result events with wrong promptId', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = getSaveResultHandler(addEventListenerSpy);
            handler({ detail: { promptId: 'wrong-prompt-id', success: false } });

            expect(setRuntimeValue).not.toHaveBeenCalled();
            addEventListenerSpy.mockRestore();
        });

        it('should apply condition to different targetName from the attack result', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult({
                attackerName: 'Goblin',
                targetName: 'Ally1',
            }));
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1', type: 'player' },
                    { name: playerName, type: 'player' },
                    { name: 'Goblin', type: 'monster' },
                ],
            });
            isWithinRange.mockResolvedValue(true);

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction({ target: 'different_creature' }), makePlayerStats(), campaignName, null);

            const handler = getSaveResultHandler(addEventListenerSpy);
            handler({ detail: { promptId: 'test-prompt-id', success: false } });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName
            );
            addEventListenerSpy.mockRestore();
        });
    });

    describe('save result handler - success', () => {
        it('should log save_result entry and not add condition or expiration on success', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = getSaveResultHandler(addEventListenerSpy);
            handler({ detail: { promptId: 'test-prompt-id', success: true } });

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                targetName: playerName,
                saveDc: 15,
                saveType: 'WIS',
                success: true,
            }));
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            addEventListenerSpy.mockRestore();
        });

        it('should remove event listener after handling save success', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = addEventListenerSpy.mock.calls.find(c => c[0] === 'save-result')[1];
            handler({ detail: { promptId: 'test-prompt-id', success: true } });

            expect(removeEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });
    });

    describe('DC calculation', () => {
        it('should use buildSaveDc to compute the DC', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());
            buildSaveDc.mockReturnValue(17);

            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            expect(buildSaveDc).toHaveBeenCalled();
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveDc: 17,
            }));
        });
    });

    describe('addEntry error handling', () => {
        it('should handle addEntry rejection on ability_use logging', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());
            addEntry.mockRejectedValue(new Error('log failed'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
            const result = await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[beguilingTwist] Error:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });

        it('should handle addEntry rejection on save result logging', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());
            addEntry.mockRejectedValue(new Error('log failed'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction({ target: 'self' }), makePlayerStats(), campaignName, null);

            const handler = getSaveResultHandler(addEventListenerSpy);
            handler({ detail: { promptId: 'test-prompt-id', success: false } });

            expect(consoleErrorSpy).toHaveBeenCalledWith('[beguilingTwist] Error:', expect.any(Error));
            addEventListenerSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });
});
