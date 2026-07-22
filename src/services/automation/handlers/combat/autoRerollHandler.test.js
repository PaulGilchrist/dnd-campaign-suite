// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findRollsByCreature: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(async () => ({
        attackerPos: { gridX: 1, gridY: 1 },
        targetPos: { gridX: 2, gridY: 2 },
    })),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCurrentCombatRound } from '../../../../services/encounters/combatData.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

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

function makePlayerStatsForLevel(level, classOverrides = {}) {
    return makePlayerStats({
        level,
        class: {
            class_levels: [{ level, ...classOverrides }],
        },
    });
}

// ── Tests ──────────────────────────────────────────────────────

describe('autoRerollHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        isWithinRange.mockResolvedValue(true);
    });

    // ── No recent roll ──────────────────────────────────────────

    describe('no recent roll', () => {
        it('should return info popup when combat context has no lastAttack', async () => {
            getCombatContext.mockResolvedValue({ lastAttack: null });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
        });

        it('should return automationInfoPopup when no automation type matches', async () => {
            getCombatContext.mockResolvedValue({ lastAttack: null });

            const action = makeAction({
                automation: { type: 'auto_reroll' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('should fall through to automationInfoPopup when bonusExpression is unrecognized', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { bonusExpression: 'unknown_expression', bonus: undefined },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });

    // ── Basic bonus on own failed attack ────────────────────────

    describe('basic bonus, own failed attack', () => {
        it('should apply bonus to own failed attack roll', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 8, bonus: 5, targetAc: 15, hit: false }
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(8)');
            expect(result.payload.description).toContain('Modified: d20(10)');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    description: expect.stringContaining('+2 to own failed attack'),
                })
            );
        });

        it('should apply bonus to own failed ability check', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestHero', d20: 12, bonus: 3, checkName: 'Stealth' }
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Stealth');
            expect(result.payload.description).toContain('Modified: d20(14)');
        });

        it('should return info when last roll is a saving throw (not attack/check)', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
        });

        it('should return info when last roll is not a failed attack or check for player', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 18, bonus: 5, targetAc: 15, hit: true }
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    // ── Ally missed attack with range ───────────────────────────

    describe('ally missed attack with range', () => {
        it('should apply bonus to ally missed attack within range', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false }
            });
            getDistanceFeet.mockReturnValue(10);

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    targetName: 'Ally',
                    description: expect.stringContaining("to Ally's failed attack"),
                })
            );
        });

        it('should skip ally attack that is out of range', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false }
            });
            getDistanceFeet.mockReturnValue(50);
            isWithinRange.mockResolvedValue(false);

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
        });

        it('should skip ally attack that already hit', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 18, bonus: 5, targetAc: 15, hit: true }
            });

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
        });

        it('should apply bonus to ally attack when map positions unavailable (range check skipped)', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false }
            });
            const { resolveMapPositions } = await import('../../common/targetResolver.js');
            resolveMapPositions.mockResolvedValue({ attackerPos: null, targetPos: null });

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    targetName: 'Ally',
                })
            );
        });
    });

    // ── Ally attack without range (should not apply to ally) ────

    describe('ally missed attack without range', () => {
        it('should not apply bonus to ally attack when no range specified', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false }
            });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
        });
    });

    // ── Saving throw with override_fail_to_success ───────────────

    describe('saving_throw with override_fail_to_success', () => {
        it('should override a failed save to SUCCESS', async () => {
            getRuntimeValue.mockReturnValue(null);
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
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_guardedMind_usedRest', 'rest', 'campaign');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    description: expect.stringContaining('override a failed WISDOM save'),
                })
            );
        });

        it('should accept abbreviated save type (INT)', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'INT' }
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

        it('should reject if already used this rest', async () => {
            getRuntimeValue.mockReturnValue('rest');
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
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should reject if save is not for the player', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'OtherPlayer', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    effect: 'override_fail_to_success',
                    oncePer: 'short_rest',
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('No recent saving throw found for TestHero');
        });

        it('should reject invalid save type (Strength)', async () => {
            getRuntimeValue.mockReturnValue(null);
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

        it('should reject if lastAttack is not a save', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 8, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    effect: 'override_fail_to_success',
                    oncePer: 'short_rest',
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('No recent saving throw found');
        });
    });

    // ── Saving throw with resource cost ─────────────────────────

    describe('saving_throw with resource cost', () => {
        it('should consume channel divinity charges on success', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    resourceCost: 'channel_divinity',
                },
            });
            const stats = makePlayerStatsForLevel(5, { channel_divinity: 2 });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, 'campaign');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    description: expect.stringContaining('reroll a saving throw'),
                })
            );
        });

        it('should reject when no channel divinity charges', async () => {
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    resourceCost: 'channel_divinity',
                },
            });
            const stats = makePlayerStatsForLevel(5, { channel_divinity: 2 });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('No Channel Divinity charges remaining');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should consume focus points on success', async () => {
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    resourceCost: 'focus_points',
                },
            });
            const stats = makePlayerStatsForLevel(1, { focus_points: 5 });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'focusPoints', 2, 'campaign');
        });

        it('should reject when no focus points', async () => {
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' }
            });

            const action = makeAction({
                automation: {
                    target: 'saving_throw',
                    resourceCost: 'focus_points',
                },
            });
            const stats = makePlayerStats({ level: 1, class: { class_levels: [{ level: 1, focus_points: 5 }] } });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('No Focus Points remaining');
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    // ── Bardic inspiration die ──────────────────────────────────

    describe('bardic_inspiration_die', () => {
        it('should roll bardic die and apply to own failed attack', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(5)');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    biDieSize: 6,
                    description: expect.stringContaining('TestHero'),
                })
            );
        });

        it('should roll bardic die and apply to own failed ability check', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestHero', d20: 8, bonus: 3, checkName: 'Athletics' }
            });

            const stats = makePlayerStatsForLevel(3, { bardic_inspiration_uses: 4, bardic_die: 6 });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Athletics');
        });

        it('should decrement bardic inspiration uses after applying', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });
            getRuntimeValue.mockReturnValue(3);

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die' },
            });
            await handle(action, stats, 'campaign', 'map');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'bardicInspirationUses', 2, 'campaign');
        });

        it('should return info when bardic inspiration has no uses remaining', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });
            getRuntimeValue.mockReturnValue(0);

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die' },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('no uses remaining');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should skip bardic die if player has no bardic class levels', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const stats = makePlayerStats({ class: { class_levels: [{ level: 1 }] } });
            const action = makeAction({
                automation: { bonusExpression: 'bardic_inspiration_die', bonus: undefined },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });

    // ── Psionic energy die ──────────────────────────────────────

    describe('psionic_energy_die', () => {
        it('should use psionic energy die on own failed attack', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const stats = makePlayerStats({ level: 1, resources: { psionicEnergy: { max: 6 } } });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(5)');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    description: expect.stringContaining('Psionic Energy'),
                })
            );
        });

        it('should use psionic energy die on own failed ability check', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestHero', d20: 8, bonus: 3, checkName: 'Perception' }
            });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const stats = makePlayerStats({ level: 1, _trackedResources: { psionicEnergy: { max: 4 } } });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Perception');
        });

        it('should decrement psionic energy after applying', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);
            getRuntimeValue.mockReturnValue(4);

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const stats = makePlayerStats({ level: 1, _trackedResources: { psionicEnergy: { max: 6 } } });
            await handle(action, stats, 'campaign', 'map');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 3, 'campaign');
        });

        it('should return info when no psionic energy remaining', async () => {
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false }
            });

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should return info when last roll is not a failed attack or check for player', async () => {
            getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 18, bonus: 5, targetAc: 15, hit: true }
            });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            const action = makeAction({
                automation: { bonusExpression: 'psionic_energy_die' },
            });
            const stats = makePlayerStats({ level: 1, _trackedResources: { psionicEnergy: { max: 6 } } });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.payload.description).toContain('No recent failed ability check or attack roll');
            expect(addEntry).not.toHaveBeenCalled();
        });
    });
});
