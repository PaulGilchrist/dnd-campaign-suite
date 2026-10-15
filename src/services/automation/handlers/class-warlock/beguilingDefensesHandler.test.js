// @maintained-by-ai
// Activation sub-lane of the beguilingDefenses pair: covers handle()'s
// activation flow — uses gate (incl. Pact Magic recharge), heal, save-prompt
// creation, popup composition, and the activation ability_use/hp_change logs.
// The save-result listener (promptId guard, lastAttack stamping, psychic
// retaliation, listener teardown) is owned by
// beguilingDefensesHandler.save-results.test.js — not covered here.
// Deterministic: all seams mocked, no game timers.
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

describe('beguilingDefensesHandler', () => {
    describe('no recent attack', () => {
        it('returns popup when no attackEvent or target does not match the player', async () => {
            // Scenario 1: no attackEvent
            findLastAttack.mockResolvedValue(makeAttackResult());
            let result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll against you found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();

            vi.clearAllMocks();

            // Scenario 2: attackEvent exists but targetName does not match player
            findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'OtherPlayer'));
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({ creatures: [] });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
            applyHealingToTarget.mockReturnValue({ actualHeal: 10, oldHp: 15, newHp: 25 });
            applyDamageToTarget.mockReturnValue(null);

            result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll against you found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('uses', () => {
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
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
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
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(createSaveListener).not.toHaveBeenCalled();
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
        it('calls buildSaveDc and creates save listener with correct config', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction();
            await handle(action, makePlayerStats(), campaignName, null, []);

            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.any(Object));
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'WIS',
                saveDc: 15,
            }));
        });

        it('uses custom saveType from automation config', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction({ automation: { saveType: 'CHA' } });
            await handle(action, makePlayerStats(), campaignName, null, []);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('resolves attacker from combat context or falls back to attackerName or "Attacker"', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: playerName }],
            });
            await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Orc',
            }));

            vi.clearAllMocks();
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [] });
            await handle(makeAction(), makePlayerStats(), campaignName, null, []);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
            }));

            vi.clearAllMocks();
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
        it('returns popup with correct metadata, description, and feature name fallback', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            let result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

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
            expect(result.payload.description).not.toMatch(/^<b>Beguiling Defenses<\/b>/);

            vi.clearAllMocks();
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction({ name: null });
            result = await handle(action, makePlayerStats(), campaignName, null, []);

            expect(result.payload.name).toBe('Beguiling Defenses');
        });

        it('handles healResult without actualHeal property', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            applyHealingToTarget.mockReturnValue({ oldHp: 15, newHp: 25 });

            await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
            }));
        });
    });

    describe('log entries', () => {
        it('logs ability_use and hp_change entries with correct fields on activation', async () => {
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

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
                targetName: playerName,
                delta: 10,
                isHealing: true,
                sourceName: 'Beguiling Defenses',
            }));

            const abilityUseCall = addEntry.mock.calls.find(
                call => call[1].type === 'ability_use' && call[1].abilityName === 'Beguiling Defenses'
            );
            expect(abilityUseCall[1].description).toContain('Attack dealt 20 damage');
            expect(abilityUseCall[1].description).toContain('Piercing');
            expect(abilityUseCall[1].description).toContain('healed for 10 HP');
            expect(abilityUseCall[1].description).toContain('take 10 Psychic damage');
        });

        it('handles activation addEntry rejection without throwing', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            const errorSpy = vi.spyOn(console, 'error');
            // Reject only the activation ability_use entry — the heal's
            // hp_change entry resolves, so the rejection lands exactly where
            // this test claims (handle()'s final activation log).
            addEntry.mockImplementation((_campaign, entry) =>
                entry && entry.type === 'ability_use'
                    ? Promise.reject(new Error('log error'))
                    : Promise.resolve()
            );

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null, []);

            expect(result.type).toBe('popup');
            expect(createSaveListener).toHaveBeenCalled();
            // Heal still logged successfully before the rejected activation entry.
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
            }));
            // Exactly one rejection (activation only) surfaced as one error log.
            expect(errorSpy).toHaveBeenCalledTimes(1);
            expect(errorSpy).toHaveBeenCalledWith(
                '[beguilingDefenses] Error:',
                expect.any(Error),
            );
            errorSpy.mockRestore();
        });

    });
});
