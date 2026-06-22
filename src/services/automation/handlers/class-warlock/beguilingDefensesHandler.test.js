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

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'WarlockGirl',
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

describe('beguilingDefensesHandler', () => {
    describe('no recent attack', () => {
        it('returns popup when no attack event exists', async () => {
            findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack roll against you found');
        });

        it('returns popup when attack event is stale (> 60 seconds)', async () => {
            const oldTimestamp = Date.now() - 120000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: oldTimestamp },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll against you found');
        });

        it('accepts non-stale attack event', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 5,
                secondaryDamage: 0,
                totalDamage: 5,
                damageTypes: ['Piercing'],
            });

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Beguiling Defenses');
        });
    });

    describe('uses remaining', () => {
        it('returns popup when uses exhausted and no pact magic recharge', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            // Uses counter at max (1 used of 1 max)
            getRuntimeValue.mockReturnValue(1);

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: false } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('returns popup when uses exhausted and no pact slots available', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            // Uses counter at max
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 0;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Pact Magic slots available');
        });

        it('spends a pact magic slot to restore a use when available', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('WarlockGirl', 'warlockPactMagic', 0, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('WarlockGirl', 'beguilingDefensesUses', 0, 'test-campaign');
        });

        it('increments use counter on activation', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('WarlockGirl', 'beguilingDefensesUses', 1, 'test-campaign');
        });
    });

    describe('save prompt', () => {
        it('creates save listener with correct parameters', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
                saveType: 'WIS',
                saveDc: 15,
            }));
        });

        it('uses custom saveType from automation', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const action = makeAction({ automation: { saveType: 'CHA' } });
            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('looks up attacker from combat context', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: 'WarlockGirl' }],
            });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('falls back to attackerName from attack event when combat context lookup fails', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue({
                creatures: [],
            });
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });
    });

    describe('popup result', () => {
        it('returns popup with feature name and description', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Beguiling Defenses');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('uses custom feature name when provided', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            const action = makeAction({ name: 'Custom Feature' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Custom Feature');
        });

        it('logs ability use with save prompt details', async () => {
            const recentTimestamp = Date.now() - 30000;
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: recentTimestamp, targetName: 'Goblin' },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });
            getRuntimeValue.mockReturnValue(0);

            getCombatContext.mockResolvedValue(null);
            buildSaveDc.mockReturnValue(15);
            createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'WarlockGirl',
                abilityName: 'Beguiling Defenses',
                promptId: 'test-prompt-id',
            }));
        });
    });

    describe('event staleness', () => {
        it('treats event without timestamp as stale', async () => {
            findLastAttack.mockResolvedValue({
                attackEvent: {},
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll');
        });

        it('treats event with null timestamp as stale', async () => {
            findLastAttack.mockResolvedValue({
                attackEvent: { timestamp: null },
                attackerName: 'Goblin',
                targetName: 'WarlockGirl',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll');
        });
    });
});
