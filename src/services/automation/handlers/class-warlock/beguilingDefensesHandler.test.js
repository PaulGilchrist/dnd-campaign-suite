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
        it('returns popup when attackEvent is null', async () => {
            findLastAttack.mockResolvedValue(makeAttackResult());

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack roll against you found');
        });

        it('returns popup when attackEvent target does not match the player', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack('Goblin', 'OtherPlayer'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
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

        it('increments use counter when pact magic restored then activated', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'beguilingDefensesUses', 0, campaignName);
        });

        it('supports configurable uses greater than 1', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockReturnValue(0);

            const action = makeAction({ automation: { uses: 2 } });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Uses remaining: 1 / 2');
        });

        it('returns popup when uses exhausted with pactMagicRecharge and multiple max uses', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockReturnValue(2);

            const action = makeAction({ automation: { uses: 2, pactMagicRecharge: false } });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('save prompt creation', () => {
        it('creates save listener with WIS save type by default', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
                saveType: 'WIS',
                saveDc: 15,
            }));
        });

        it('uses custom saveType from automation config', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction({ automation: { saveType: 'CHA' } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveType: 'CHA',
            }));
        });

        it('looks up attacker name from combat context creature matching targetName', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: playerName }],
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('looks up attacker name from combat context creature matching attackerName', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', targetName: playerName }],
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('falls back to attackerName when combat context creatures list is empty', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({ creatures: [] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('falls back to attackerName when combat context has no matching creature', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc', targetName: 'OtherPlayer' }],
            });

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

        it('uses "Attacker" when attackerName is null', async () => {
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
        it('returns popup with correct fields on successful activation', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Beguiling Defenses');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('uses custom feature name when provided', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const action = makeAction({ name: 'Custom Feature' });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Custom Feature');
        });

        it('includes attacker name in popup description', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Attacker: <b>Goblin</b>');
        });

        it('includes damage reduction explanation in popup description', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Damage Reduction');
            expect(result.payload.description).toContain('reduced by half');
        });

        it('includes psychic retaliation explanation in popup description', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Psychic Retaliation');
            expect(result.payload.description).toContain('Psychic damage');
        });

        it('shows remaining uses in popup description', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Uses remaining: 0 / 1');
        });

        it('shows correct remaining uses after pact magic restore', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            const result = await handle(action, makePlayerStats(), campaignName, null);

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
                promptId: 'test-prompt-id',
                timestamp: expect.any(Number),
            }));
        });

        it('includes target name and save info in ability_use log entry', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            const logCall = addEntry.mock.calls[0][1];
            expect(logCall.targetName).toBe('Goblin');
            expect(logCall.description).toContain('Goblin');
            expect(logCall.description).toContain('WIS');
            expect(logCall.description).toContain('DC 15');
        });

        it('logs ability_use entry when pact magic is spent to restore a use', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'beguilingDefensesUses') return 1;
                if (key === 'warlockPactMagic') return 1;
                return null;
            });

            const action = makeAction({ automation: { uses: 1, pactMagicRecharge: true } });
            await handle(action, makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                description: expect.stringContaining('Pact Magic spell slot'),
            }));
        });
    });

    describe('event listener registration', () => {
        it('registers a save-result event listener on the window', async () => {
            setupHappyPath(makeHitAttack('Goblin', playerName));

            const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEventListenerSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
            addEventListenerSpy.mockRestore();
        });
    });
});
