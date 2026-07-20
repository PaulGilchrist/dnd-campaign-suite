// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './bewitchingMagicHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationExpressions.js');

const campaignName = 'test-campaign';
const playerName = 'TestWarlock';

beforeEach(() => {
    vi.clearAllMocks();
});

function makeAction(overrides = {}) {
    return {
        name: 'Bewitching Magic',
        automation: { type: 'bewitching_magic', ...overrides },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        proficiency: 3,
        abilities: [{ name: 'Charisma', bonus: 2 }],
        ...overrides,
    };
}

function makeCombatContext(overrides = {}) {
    return {
        creatures: [
            { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
            { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
        ],
        ...overrides,
    };
}

describe('bewitchingMagicHandler', () => {
    describe('guard: lastAttack checks', () => {
        it('returns popup when no lastAttack exists', async () => {
            getCombatContext.mockResolvedValue(makeCombatContext({ lastAttack: null }));
            getRuntimeValue.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('enchantment or illusion');
        });

        it('returns popup when attacker is not the warlock', async () => {
            getCombatContext.mockResolvedValue(makeCombatContext({
                lastAttack: {
                    attackerName: 'Goblin',
                    damageSchool: 'enchantment',
                },
            }));
            getRuntimeValue.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('enchantment or illusion');
        });

        it('returns popup when school is not enchantment or illusion', async () => {
            getCombatContext.mockResolvedValue(makeCombatContext({
                lastAttack: {
                    attackerName: playerName,
                    damageSchool: 'evocation',
                },
            }));
            getRuntimeValue.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('enchantment or illusion');
        });

        it('returns popup when damageSchool is missing', async () => {
            getCombatContext.mockResolvedValue(makeCombatContext({
                lastAttack: {
                    attackerName: playerName,
                    damageSchool: null,
                },
            }));
            getRuntimeValue.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('enchantment or illusion');
        });
    });

    describe('modal return for qualifying spells', () => {
        function setupEnchantmentAttack() {
            getCombatContext.mockResolvedValue(makeCombatContext({
                lastAttack: {
                    attackerName: playerName,
                    damageSchool: 'enchantment',
                },
            }));
            getRuntimeValue.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(1);
        }

        function setupIllusionAttack() {
            getCombatContext.mockResolvedValue(makeCombatContext({
                lastAttack: {
                    attackerName: playerName,
                    damageSchool: 'illusion',
                },
            }));
            getRuntimeValue.mockReturnValue(1);
            evaluateAutoExpression.mockReturnValue(1);
        }

        it('returns modal with enchantment school spell', async () => {
            setupEnchantmentAttack();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('stepsOfTheFey');
            expect(result.payload.title).toBe('Bewitching Magic');
            expect(result.payload.featureName).toBe('Bewitching Magic');
            expect(result.payload.newCount).toBe(1);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
            expect(result.payload.saveDc).toBe(13); // 8 + 2 (CHA) + 3 (prof)
        });

        it('returns modal with illusion school spell (case-insensitive)', async () => {
            setupIllusionAttack();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.title).toBe('Bewitching Magic');
        });

        it('filters out the warlock from eligible targets', async () => {
            setupEnchantmentAttack();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.payload.targets.length).toBe(1);
            expect(result.payload.targets[0].name).toBe('Goblin');
        });

        it('returns modal with zero count when no uses remaining', async () => {
            setupEnchantmentAttack();
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.mode).toBe('stepsOfTheFey');
            expect(result.payload.newCount).toBe(0);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
        });

        it('uses fallback count when runtime value is null', async () => {
            getCombatContext.mockResolvedValue(makeCombatContext({
                lastAttack: {
                    attackerName: playerName,
                    damageSchool: 'enchantment',
                },
            }));
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.newCount).toBe(1);
        });
    });
});
