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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
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
        attackEvent: { timestamp: Date.now(), targetName: target },
        attackerName: attacker,
        targetName: target,
        primaryDamage: 5,
        secondaryDamage: 0,
        totalDamage: 5,
        damageTypes: ['Piercing'],
    });
}

function setupHappyPath(attackResult) {
    findLastAttack.mockResolvedValue(attackResult || makeHitAttack('Goblin', playerName));
    getRuntimeValue.mockReturnValue(0);
    getCombatContext.mockResolvedValue(null);
    buildSaveDc.mockReturnValue(15);
    createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
}

describe('beguilingDefensesHandler', () => {
    describe('no recent attack', () => {
        it('returns popup when no attackEvent or target does not match the player', async () => {
            // attackEvent is null
            findLastAttack.mockResolvedValue(makeAttackResult());
            let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll against you found');

            // targetName mismatch
            findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'OtherPlayer'));
            result = await handle(makeAction(), makePlayerStats(), campaignName, null);
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
            const result = await handle(action, makePlayerStats(), campaignName, null);

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
            const result = await handle(action, makePlayerStats(), campaignName, null);

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
            await handle(action, makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'warlockPactMagic', 0, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'beguilingDefensesUses', 0, campaignName);
        });

        it('increments use counter on activation from zero', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'beguilingDefensesUses', 1, campaignName);
        });

        it('supports configurable uses greater than 1', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockReturnValue(0);

            const action = makeAction({ automation: { uses: 2 } });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Uses remaining: 1 / 2');
        });
    });

    describe('save prompt creation', () => {
        it('uses custom saveType from automation config', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction({ automation: { saveType: 'CHA' } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('defaults to WIS saveType when not specified', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'WIS',
            }));
        });

        it('resolves attacker from combat context when creature targets the player', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: playerName }],
            });
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('falls back to attackerName when combat context is empty', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [] });
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('falls back to attackerName when combat context is null', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue(null);
            await handle(makeAction(), makePlayerStats(), campaignName, null);
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
            await handle(makeAction(), makePlayerStats(), campaignName, null);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Attacker',
            }));
        });
    });

    describe('popup result', () => {
        it('returns popup with correct fields and description on successful activation', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Beguiling Defenses');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.description).toContain('Beguiling Defenses');
            expect(result.payload.description).toContain('Attacker: <b>Goblin</b>');
            expect(result.payload.description).toContain('Damage Reduction');
            expect(result.payload.description).toContain('reduced by half');
            expect(result.payload.description).toContain('Psychic Retaliation');
            expect(result.payload.description).toContain('Psychic damage');
            expect(result.payload.description).toContain('Uses remaining: 0 / 1');
        });
    });

    describe('log entries', () => {
        it('logs ability_use entry with correct fields on activation', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Beguiling Defenses',
                targetName: 'Goblin',
                promptId: 'test-prompt-id',
                timestamp: expect.any(Number),
            }));
        });
    });
});
