import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findRollsByCreature: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 5),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(async () => ({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 2, gridY: 2 },
    })),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => null),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((_expr) => 1),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Test Auto Reroll',
        description: 'Reroll ability.',
        automation: {
            type: 'auto_reroll',
            bonus: 2,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3 }] },
        level: 1,
        resources: {},
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('autoRerollHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle with basic bonus', () => {
        it('should return info popup when no recent attack roll', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ lastAttack: null });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('should handle attack roll reroll', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 8, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Test Auto Reroll');
        });

        it('should handle ability check reroll', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestHero', d20: 12, bonus: 3, checkName: 'Stealth' }
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Stealth');
        });

        it('should handle ally missed attack within range', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should skip ally attack that is out of range', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false }
            });
            const { getDistanceFeet } = await import('../../../rules/combat/rangeValidation.js');
            getDistanceFeet.mockReturnValue(50);

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
        });
    });

    describe('handle with saving_throw target', () => {
        it('should handle override_fail_to_success once per rest', async () => {
            getRuntimeValue.mockReturnValue(null);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    effect: 'override_fail_to_success',
                    oncePer: 'short_rest',
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('SUCCESS');
        });

        it('should reject override_fail_to_success if already used this rest', async () => {
            getRuntimeValue.mockReturnValue('rest');
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    effect: 'override_fail_to_success',
                    oncePer: 'short_rest',
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('once per Short or Long Rest');
        });

        it('should reject override_fail_to_success for invalid save type', async () => {
            getRuntimeValue.mockReturnValue(null);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Strength' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    effect: 'override_fail_to_success',
                    oncePer: 'short_rest',
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Intelligence, Wisdom, or Charisma');
        });
    });

    describe('handle with bardic_inspiration_die', () => {
        it('should roll bardic die and apply to attack', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3, bardic_die: 6 }] },
            });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should return info when no recent failed check or attack', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 18, bonus: 5, targetAc: 15, hit: true }
            });

            const stats = makePlayerStats({
                class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3, bardic_die: 6 }] },
            });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('recent failed ability check or attack roll');
        });
    });

    describe('handle with psionic_energy_die', () => {
        it('should use psionic energy die', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const stats = makePlayerStats({ resources: { psionicEnergy: { max: 6 } } });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should return info when no psionic energy remaining', async () => {
            getRuntimeValue.mockReturnValue(0);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('No Psionic Energy remaining');
        });
    });

    describe('handle with convert_miss_to_hit', () => {
        it('should convert a miss to a hit', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { effect: 'convert_miss_to_hit' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Miss converted to hit');
        });

        it('should reject when attack already hit', async () => {
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 18, bonus: 5, targetAc: 15, hit: true }
            });

            const action = makeAction({
                automation: { effect: 'convert_miss_to_hit' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('already hit');
        });

        it('should track once per turn', async () => {
            getRuntimeValue.mockReturnValue(null);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { effect: 'convert_miss_to_hit', oncePerTurn: true },
            });
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(getRuntimeValue).toHaveBeenCalledWith('TestHero', '_fearlessAim_usedRound', 'campaign');
        });
    });



    describe('resource cost handling', () => {
        it('should consume channel divinity charges', async () => {
            getRuntimeValue.mockReturnValue(2);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    resourceCost: 'channel_divinity',
                },
            });
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
        });

        it('should reject when no channel divinity charges', async () => {
            getRuntimeValue.mockReturnValue(0);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    resourceCost: 'channel_divinity',
                },
            });
            const stats = makePlayerStats({
                class: { class_levels: [{ level: 5, channel_divinity: 2 }] },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('No Channel Divinity charges remaining');
        });
    });
});
