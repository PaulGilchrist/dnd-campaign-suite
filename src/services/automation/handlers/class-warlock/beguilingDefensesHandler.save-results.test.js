// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');
const { applyHealingToTarget } = await import('../../../rules/combat/applyHealing.js');
const { applyDamageToTarget } = await import('../../../rules/combat/applyDamage.js');

const campaignName = 'test-campaign';
const playerName = 'WarlockGirl';

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
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

function makeAttackResult(overrides = {}) {
    return {
        attackEvent: overrides.attackEvent ?? null,
        attackerName: overrides.attackerName ?? null,
        targetName: overrides.targetName ?? null,
        primaryDamage: overrides.primaryDamage ?? 0,
        secondaryDamage: overrides.secondaryDamage ?? 0,
        totalDamage: overrides.totalDamage ?? 0,
        damageTypes: overrides.damageTypes ?? [],
    };
}

function makeHitAttack(attacker, target) {
    return makeAttackResult({
        attackEvent: { timestamp: Date.now(), targetName: target, damageTypes: ['Piercing'] },
        attackerName: attacker,
        targetName: target,
        primaryDamage: 20,
        secondaryDamage: 0,
        totalDamage: 20,
        damageTypes: ['Piercing'],
    });
}

function setupHappyPath(attackResult) {
    findLastAttack.mockResolvedValue(attackResult || makeHitAttack('Goblin', playerName));
    getRuntimeValue.mockReturnValue(0);
    getCombatContext.mockResolvedValue({ creatures: [] });
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
    applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 15, newHp: 25 });
    applyDamageToTarget.mockReturnValue(null);
}

function getSaveResultHandler(addEventListenerSpy) {
    const saveResultCall = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'save-result'
    );
    return saveResultCall[1];
}

describe('beguilingDefensesHandler - save results', () => {
    describe('save-result event handling', () => {
        it('applies psychic damage on save failure', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(applyDamageToTarget).toHaveBeenCalled();
            }, { timeout: 100 });

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 10, ['Psychic'], campaignName, ['Goblin'], { ignoreResistance: false, attackerName: playerName });
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                name: 'Beguiling Defenses Psychic Retaliation',
                targetName: 'Goblin',
                damageType: 'Psychic',
                saveResult: 'failure',
                saveRoll: 8,
                saveBonus: 4,
            }));
        });

        it('ignores save-result event with wrong promptId', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'wrong-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(applyDamageToTarget).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalledWith('campaign', 'lastAttack', expect.any(Object));
            }, { timeout: 100 });
        });

        it('stores save result in lastAttack on save failure', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'beguilingDefensesUses') return 0;
                if (key === 'lastAttack') return { attackId: 'old-attack' };
                return null;
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
            applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 15, newHp: 25 });
            applyDamageToTarget.mockReturnValue(null);

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'campaign',
                    'lastAttack',
                    expect.objectContaining({
                        attackId: 'old-attack',
                        saveResult: 'failure',
                        saveDc: 15,
                        saveType: 'WIS',
                        saveRoll: 8,
                        saveBonus: 4,
                        saveTotal: 12,
                    }),
                    campaignName
                );
            }, { timeout: 100 });
        });

        it('stores save result in lastAttack on save success', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'beguilingDefensesUses') return 0;
                if (key === 'lastAttack') return { attackId: 'old-attack' };
                return null;
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
            applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 15, newHp: 25 });
            applyDamageToTarget.mockReturnValue(null);

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: true,
                    total: 18,
                    roll: 14,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'campaign',
                    'lastAttack',
                    expect.objectContaining({
                        attackId: 'old-attack',
                        saveResult: 'success',
                        saveDc: 15,
                        saveType: 'WIS',
                        saveRoll: 14,
                        saveBonus: 4,
                        saveTotal: 18,
                    }),
                    campaignName
                );
            }, { timeout: 100 });
        });

        it('does not apply psychic damage when halfDamage is 0 on save failure', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult({
                attackEvent: { timestamp: Date.now(), targetName: playerName, damageTypes: ['Piercing'] },
                attackerName: 'Goblin',
                targetName: playerName,
                totalDamage: 1,
                damageTypes: ['Piercing'],
            }));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 0;
                return null;
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
            applyHealingToTarget.mockReturnValue({ actualHeal: 0, oldHp: 15, newHp: 15 });
            applyDamageToTarget.mockReturnValue(null);

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 10,
                    roll: 6,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(applyDamageToTarget).not.toHaveBeenCalled();
            }, { timeout: 100 });
        });

        it('logs save success on save success', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: true,
                    total: 18,
                    roll: 14,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    type: 'save_result',
                    targetName: 'Goblin',
                    saveDc: 15,
                    saveType: 'WIS',
                    success: true,
                    saveRoll: 14,
                    saveBonus: 4,
                }));
            }, { timeout: 100 });
        });

        it('handles addEntry rejection on save failure path', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });
            const errorSpy = vi.spyOn(console, 'error');
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(applyDamageToTarget).toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalledWith(
                    '[beguilingDefenses] Error:',
                    expect.any(Error),
                );
            }, { timeout: 100 });
            errorSpy.mockRestore();
        });

        it('handles addEntry rejection on save success path', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });
            const errorSpy = vi.spyOn(console, 'error');
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: true,
                    total: 18,
                    roll: 14,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(errorSpy).toHaveBeenCalledWith(
                    '[beguilingDefenses] Error:',
                    expect.any(Error),
                );
            }, { timeout: 100 });
            errorSpy.mockRestore();
        });

        it('passes empty array fallback when characters is null in applyDamageToTarget', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, null);

            const handler = getSaveResultHandler(spy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 10, ['Psychic'], campaignName, [], { ignoreResistance: false, attackerName: playerName });
            }, { timeout: 100 });
        });

        it('removes event listener after handling save result', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const addSpy = vi.spyOn(window, 'addEventListener');
            const removeSpy = vi.spyOn(window, 'removeEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const handler = getSaveResultHandler(addSpy);
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            await vi.waitFor(() => {
                expect(removeSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            }, { timeout: 100 });
        });
    });
});
