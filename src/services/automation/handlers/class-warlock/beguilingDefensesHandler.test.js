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

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => {
    const mockStorage = {
        set: vi.fn(),
    };
    return { default: mockStorage };
});

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { buildSaveDc, createSaveListener } = await import('../../common/savePrompt.js');
const { applyHealingToTarget } = await import('../../../rules/combat/applyHealing.js');
const { applyDamageToTarget } = await import('../../../rules/combat/applyDamage.js');
const storageModule = await import('../../../ui/storage.js');
const storage = storageModule.default;

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
    storage.set.mockReturnValue(undefined);
}

describe('beguilingDefensesHandler', () => {
    describe('no recent attack', () => {
        it('returns popup when no attackEvent or target does not match the player', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());
            let result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll against you found');

            findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'OtherPlayer'));
            result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(result.payload.description).toContain('No recent attack roll against you found');
        });
    });

    describe('uses remaining', () => {
        it('returns popup when uses exhausted and pactMagicRecharge is false', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: false } });
            const result = await handle(action, makePlayerStats(), campaignName, null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('returns popup when uses exhausted and no pact magic slots available', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 0;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            const result = await handle(action, makePlayerStats(), campaignName, null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('No Pact Magic slots available');
        });

        it('spends a pact magic slot to restore a use when available', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            await handle(action, makePlayerStats(), campaignName, null, []);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'warlockPactMagic', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'beguilingDefensesUses', 0, campaignName);
        });

        it('increments use counter on activation from zero', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'beguilingDefensesUses', 1, campaignName);
        });

        it('supports configurable uses greater than 1', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockReturnValue(0);

            const action = makeAction({ automation: { uses: 2 } });
            const result = await handle(action, makePlayerStats(), campaignName, null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Uses remaining: 1 / 2');
        });
    });

    describe('healing', () => {
        it('heals warlock for half the attack damage', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                playerName,
                10, // Math.floor(20 / 2)
                campaignName
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
                targetName: playerName,
                delta: 10,
                isHealing: true,
                sourceName: 'Beguiling Defenses',
            }));
        });

        it('does not heal when no combat context', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('does not heal when no damage dealt', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult({
                attackEvent: { timestamp: Date.now(), targetName: playerName },
                attackerName: 'Goblin',
                targetName: playerName,
                totalDamage: 0,
                damageTypes: [],
            }));
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({ creatures: [] });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });
    });

    describe('save prompt creation', () => {
        it('uses custom saveType from automation config', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction({ automation: { saveType: 'CHA' } });
            await handle(action, makePlayerStats(), campaignName, null, []);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('defaults to WIS saveType when not specified', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        it('resolves attacker from combat context when creature targets the player', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: playerName }],
            });
            await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('falls back to attackerName when combat context is empty', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [] });
            await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('falls back to attackerName when combat context is null', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue(null);
            await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('falls back to "Attacker" when attackerName is null', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult({
                attackEvent: { timestamp: Date.now(), targetName: playerName },
                attackerName: null,
                targetName: playerName,
            }));
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
            await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Attacker',
            }));
        });
    });

    describe('popup result', () => {
        it('returns popup with correct fields and description on successful activation', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Beguiling Defenses');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.description).toContain('Attacker: <b>Goblin</b>');
            expect(result.payload.description).toContain('Attack dealt <b>20</b> damage');
            expect(result.payload.description).toContain('Damage Halved');
            expect(result.payload.description).toContain('heal for <b>10</b> HP');
            expect(result.payload.description).toContain('Psychic Retaliation');
            expect(result.payload.description).toContain('Psychic damage');
            expect(result.payload.description).toContain('Uses remaining: 0 / 1');
            // Verify no duplicate title at the start of description
            expect(result.payload.description).not.toMatch(/^<b>Beguiling Defenses<\/b>/);
        });
    });

    describe('log entries', () => {
        it('logs ability_use entry with correct fields on activation', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Beguiling Defenses',
                targetName: 'Goblin',
                promptId: 'test-prompt-id',
                timestamp: expect.any(Number),
            }));
        });

        it('logs hp_change entry when healing is applied', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
                targetName: playerName,
                delta: 10,
                isHealing: true,
                sourceName: 'Beguiling Defenses',
            }));
        });

        it('includes attack details in ability_use log', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            const abilityUseCall = addEntry.mock.calls.find(
                call => call[1].type === 'ability_use' && call[1].abilityName === 'Beguiling Defenses'
            );
            expect(abilityUseCall[1].description).toContain('Attack dealt 20 damage');
            expect(abilityUseCall[1].description).toContain('Piercing');
            expect(abilityUseCall[1].description).toContain('healed for 10 HP');
            expect(abilityUseCall[1].description).toContain('take 10 Psychic damage');
        });

        it('logs psychic damage on save failure', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            // Simulate save result event
            const saveResultHandler = spy.mock.calls.find(
                call => call[0] === 'save-result'
            );
            const handler = saveResultHandler[1];
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: false,
                    total: 12,
                    roll: 8,
                    bonus: 4,
                },
            });

            // Wait for async addEntry calls to complete
            await new Promise(r => setTimeout(r, 10));

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                10,
                ['Psychic'],
                campaignName,
                ['Goblin'],
                false,
                playerName
            );
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
            spy.mockRestore();
        });

        it('logs save success on save success', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }], lastAttack: {} });

            const spy = vi.spyOn(window, 'addEventListener');
            await handle(makeAction(), makePlayerStats(), campaignName, null, ['Goblin']);

            const saveResultHandler = spy.mock.calls.find(
                call => call[0] === 'save-result'
            );
            const handler = saveResultHandler[1];
            handler({
                detail: {
                    promptId: 'test-prompt-id',
                    success: true,
                    total: 18,
                    roll: 14,
                    bonus: 4,
                },
            });

            // Wait for async addEntry calls to complete
            await new Promise(r => setTimeout(r, 10));

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'save_result',
                targetName: 'Goblin',
                saveDc: 15,
                saveType: 'WIS',
                success: true,
                saveRoll: 14,
                saveBonus: 4,
            }));
            spy.mockRestore();
        });
    });
});
