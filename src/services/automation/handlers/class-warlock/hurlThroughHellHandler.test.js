// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './hurlThroughHellHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 44, rolls: [10, 10, 10, 10, 4] })),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((_auto, _stats) => 15),
    createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', type: 'fiend' }],
        lastAttack: {
            attackerName: 'TestHero',
            rollType: 'attack',
            hit: true,
            targetName: 'Goblin',
        },
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({
        creatures: [{ name: 'Goblin', type: 'fiend' }],
    })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => null),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc } from '../../common/savePrompt.js';

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
    return { name: 'TestHero', proficiency: 3, class: { name: 'Warlock' }, ...overrides };
}

// ── Tests ──────────────────────────────────────────────────────

describe('hurlThroughHellHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('handle', () => {
        // ── Early exit paths ──

        it('should return popup when already used this turn', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellTurnUsed') return 'turn1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Already used this turn');
        });

        it('should return popup when no target selected', async () => {
            getRuntimeValue.mockImplementation(() => null);
            getCombatContext.mockResolvedValue({
                lastAttack: {
                    attackerName: 'TestHero',
                    rollType: 'attack',
                    hit: true,
                    targetName: 'Goblin',
                },
            });
            getTargetFromAttacker.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        // ── lastAttack validation ──

        it('should return popup when no lastAttack exists', async () => {
            getRuntimeValue.mockImplementation(() => null);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
                lastAttack: null,
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No attack recorded');
        });

        it('should return popup when lastAttack was not from this player', async () => {
            getRuntimeValue.mockImplementation(() => null);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
                lastAttack: {
                    attackerName: 'Goblin',
                    rollType: 'attack',
                    hit: true,
                    targetName: 'TestHero',
                },
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Last attack was not yours');
        });

        it('should return popup when lastAttack was not an attack roll', async () => {
            getRuntimeValue.mockImplementation(() => null);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
                lastAttack: {
                    attackerName: 'TestHero',
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
            getRuntimeValue.mockImplementation(() => null);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
                lastAttack: {
                    attackerName: 'TestHero',
                    rollType: 'attack',
                    hit: false,
                    targetName: 'Goblin',
                },
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Last attack missed');
        });

        // ── Modal return for normal flow ──

        it('should return modal when use is available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 0;
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('hurlThroughHell');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.saveType).toBe('CHA');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageTotal).toBe(44);
            expect(result.payload.currentUses).toBe(0);
            expect(result.payload.maxUses).toBe(1);
        });

        it('should return modal when pact magic slots are available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'currentTurn') return 'turn1';
                if (key === 'spell_slots_level_2') return 2;
                return null;
            });

            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_2: 2 },
            });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), stats, CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.pactSlotLevel).toBe(2);
            expect(result.payload.pactSlotsAvailable).toBe(true);
            expect(result.payload.pactMagicRecharge).toBe(true);
        });

        it('should return popup when no uses and no pact magic available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                return null;
            });

            const stats = makePlayerStats({
                spellAbilities: {},
            });

            const result = await handle(makeAction(), stats, CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
        });

        it('should return popup when pact magic recharge is disabled and no uses', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                return null;
            });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: false },
            }), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
            expect(result.payload.description).toContain('Long Rest');
        });

        it('should return popup when pact magic slots are exhausted', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'spell_slots_level_2') return 0;
                return null;
            });

            const stats = makePlayerStats({
                spellAbilities: { spell_slots_level_2: 2 },
            });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), stats, CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Pact Magic slots available');
        });

        // ── Custom config ──

        it('should use custom saveType from automation config', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 0;
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const action = makeAction({
                automation: { saveType: 'WIS', saveAbility: 'WIS' },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.payload.saveType).toBe('WIS');
            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, expect.any(Object));
        });

        it('should use custom damageExpression from automation config', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 0;
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const action = makeAction({
                automation: { damageExpression: '10d10', damageType: 'Force' },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.payload.damageType).toBe('Force');
        });

        it('should pass automation config through to modal payload', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 0;
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, MAP);

            expect(result.payload.action.automation).toEqual(expect.objectContaining({
                type: 'hurl_through_hell',
                uses: 1,
                damageExpression: '8d10',
                damageType: 'Psychic',
                saveType: 'CHA',
                saveAbility: 'CHA',
            }));
        });

        it('should use custom feature name when provided in action', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 0;
                if (key === 'currentTurn') return 'turn1';
                return null;
            });

            const action = makeAction({ name: 'Custom Hurl' });
            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('modal');
            expect(result.payload.action.name).toBe('Custom Hurl');
        });

        it('should block when uses exhausted with multiple maxUses', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 2;
                return null;
            });

            const action = makeAction({
                automation: { uses: 2 },
            });

            const result = await handle(action, makePlayerStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No uses remaining');
        });

        it('should include pactMagicRecharge flag in payload when available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'hurlThroughHellUses') return 1;
                if (key === 'currentTurn') return 'turn1';
                if (key === 'spell_slots_level_2') return 2;
                return null;
            });

            const stats = makePlayerStats({
                resources: { warlockPactMagic: { max: 2 } },
                spellAbilities: { spell_slots_level_2: 2 },
            });

            const result = await handle(makeAction({
                automation: { pactMagicRecharge: true },
            }), stats, CAMPAIGN, MAP);

            expect(result.payload.pactMagicRecharge).toBe(true);
        });
    });
});
