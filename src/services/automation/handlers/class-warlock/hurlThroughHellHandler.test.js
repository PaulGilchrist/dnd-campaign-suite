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
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({
        creatures: [{ name: 'Goblin', type: 'npc', monsterType: 'fiend' }],
    })),
    getCurrentCombatRound: vi.fn(() => 5),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => null),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'campaign';
const MAP = 'map';
const PLAYER_NAME = 'TestHero';

function mockRuntime(overrides = {}) {
    const {
        uses = 0,
        turnUsed = null,
        lastAttack = {
            attackerName: PLAYER_NAME,
            rollType: 'attack',
            hit: true,
            targetName: 'Goblin',
        },
        slotLevel2 = null,
    } = overrides;

    getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key === 'hurlThroughHellUses') return uses;
        if (key === 'hurlThroughHellTurnUsed') return turnUsed;
        if (key === 'lastAttack') return lastAttack;
        if (key === 'spell_slots_level_2') return slotLevel2;
        return null;
    });
}

function mockCombatContext(creatures) {
    getCombatContext.mockResolvedValue({ creatures: creatures || [{ name: 'Goblin', type: 'npc', monsterType: 'fiend' }] });
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
}

function mockDiceRoll(total, rolls) {
    rollExpression.mockReturnValue({ total, rolls: rolls || [10, 10, 10, 10, total - 40] });
}

function mockSaveDc(dc) {
    buildSaveDc.mockReturnValue(dc);
}

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
    return {
        name: PLAYER_NAME,
        proficiency: 3,
        class: { name: 'Warlock' },
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCombatContext();
        mockDiceRoll(44, [10, 10, 10, 10, 4]);
        mockSaveDc(15);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Guard: per-turn check (CLA-175 round-keyed latch) ──

    describe('guard: already used this turn', () => {
        it('should return popup when latch holds the current round number', async () => {
            mockRuntime({ turnUsed: 5 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Already used this turn');
            expect(result.payload.description).toContain('Once per turn');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should allow use when latch holds a previous round number (self-re-arms)', async () => {
            mockRuntime({ turnUsed: 4 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
        });

        it('should allow use when latch holds the legacy unknown sentinel', async () => {
            mockRuntime({ turnUsed: 'unknown' });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
        });

        it('should allow use on the next round after a same-round refusal', async () => {
            mockRuntime({ turnUsed: 5 });
            const refused = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            expect(refused.type).toBe('popup');

            // Round advances — latch stored 5, current round now 6.
            const combatData = await import('../../../encounters/combatData.js');
            combatData.getCurrentCombatRound.mockReturnValue(6);

            const allowed = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);
            expect(allowed.type).toBe('modal');
        });
    });

    // ── Guard: lastAttack validation ──

    describe('guard: lastAttack validation', () => {
        it('should return popup when no lastAttack exists', async () => {
            mockRuntime({ lastAttack: null });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No attack recorded');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should return popup when lastAttack was not from this player (including missing attackerName or non-object)', async () => {
            mockRuntime({
                lastAttack: {
                    attackerName: 'Goblin',
                    rollType: 'attack',
                    hit: true,
                    targetName: PLAYER_NAME,
                },
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Last attack was not yours');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should return popup when lastAttack was not an attack roll', async () => {
            mockRuntime({
                lastAttack: {
                    attackerName: PLAYER_NAME,
                    rollType: 'save',
                    hit: true,
                    targetName: 'Goblin',
                },
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Last action was not an attack');
        });

        it('should return popup when lastAttack missed', async () => {
            mockRuntime({
                lastAttack: {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: false,
                    targetName: 'Goblin',
                },
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Last attack missed');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });

    // ── Guard: target validation ──

    describe('guard: target validation', () => {
        it('should return popup when no target selected via getTargetFromAttacker', async () => {
            mockRuntime({
                lastAttack: {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                },
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should return popup when combat context is null', async () => {
            mockRuntime({
                lastAttack: {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                },
            });
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should return popup when target has no name', async () => {
            mockRuntime({
                lastAttack: {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                },
            });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            getTargetFromAttacker.mockReturnValue({});

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });
    });

    // ── Guard: uses remaining ──

    describe('guard: uses remaining', () => {
        it('should return popup when uses exhausted without pact magic', async () => {
            mockRuntime({ uses: 1 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should return popup when pact magic recharge enabled but no Pact Magic slots available', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'hurlThroughHellTurnUsed') return null;
                if (key === 'lastAttack') return {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                };
                return null;
            });

            const result = await handle(
                makeAction({ automation: { pactMagicRecharge: true } }),
                makePlayerStats({ spellAbilities: null }),
                CAMPAIGN,
                MAP,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Pact Magic slots available');

            vi.clearAllMocks();
            mockCombatContext();
            mockDiceRoll(44, [10, 10, 10, 10, 4]);
            mockSaveDc(15);

            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'hurlThroughHellTurnUsed') return null;
                if (key === 'lastAttack') return {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                };
                return null;
            });

            const result2 = await handle(
                makeAction({ automation: { pactMagicRecharge: true } }),
                makePlayerStats({ spellAbilities: {} }),
                CAMPAIGN,
                MAP,
            );

            expect(result2.type).toBe('popup');
            expect(result2.payload.description).toContain('No Pact Magic slots available');
        });
    });

    // ── Guard: pact magic slot level detection ──

    describe('guard: pact magic slot level detection', () => {
        it('should find highest slot level when multiple levels have slots', async () => {
            getRuntimeValue.mockImplementation((_name, key, _campaign) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'hurlThroughHellTurnUsed') return null;
                if (key === 'lastAttack') return {
                    attackerName: PLAYER_NAME,
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                };
                if (key === 'spell_slots_level_5') return 1;
                if (key === 'spell_slots_level_2') return 0;
                return null;
            });

            const result = await handle(
                makeAction({ automation: { pactMagicRecharge: true } }),
                makePlayerStats({ spellAbilities: { spell_slots_level_5: 1, spell_slots_level_2: 0 } }),
                CAMPAIGN,
                MAP,
            );

            expect(result.type).toBe('modal');
            expect(result.payload.pactSlotLevel).toBe(5);
            expect(result.payload.pactSlotsAvailable).toBe(true);
        });
    });

    // ── Modal return ──

    describe('modal return', () => {
        it('should return modal when use is available with correct payload', async () => {
            mockRuntime({ uses: 0 });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('hurlThroughHell');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageTotal).toBe(44);
            expect(result.payload.damageExpression).toBe('8d10');
            expect(result.payload.currentUses).toBe(0);
            expect(result.payload.maxUses).toBe(1);
            expect(result.payload.dieRoll).toEqual({ total: 44, rolls: [10, 10, 10, 10, 4] });
            expect(result.payload.pactMagicRecharge).toBe(false);
            expect(result.payload.pactSlotLevel).toBe(0);
            expect(result.payload.pactSlotsAvailable).toBe(false);
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe(CAMPAIGN);
        });

        it('should return modal when pact magic slots are available', async () => {
            mockRuntime({ uses: 1, slotLevel2: 2 });

            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_2: 2 },
            });

            const result = await handle(
                makeAction({ automation: { pactMagicRecharge: true } }),
                stats,
                CAMPAIGN,
                MAP,
            );

            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.pactSlotLevel).toBe(2);
            expect(result.payload.pactSlotsAvailable).toBe(true);
            expect(result.payload.pactMagicRecharge).toBe(true);
        });
    });

    // ── Custom config ──

    describe('custom automation config', () => {
        it('should use custom values from automation config', async () => {
            mockRuntime({ uses: 0 });
            mockDiceRoll(60, [12, 12, 12, 12, 12]);

            const action = makeAction({
                name: 'Custom Hurl',
                automation: { saveType: 'WIS', saveAbility: 'WIS', damageExpression: '10d10', damageType: 'Force' },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.damageType).toBe('Force');
            expect(result.payload.damageTotal).toBe(60);
            expect(result.payload.damageExpression).toBe('10d10');
            expect(result.payload.action.name).toBe('Custom Hurl');
            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.any(Object));
        });

        it('should handle rollExpression returning null', async () => {
            mockRuntime({ uses: 0 });
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.payload.damageTotal).toBe(0);
            expect(result.payload.dieRoll).toBeNull();
        });
    });
});
