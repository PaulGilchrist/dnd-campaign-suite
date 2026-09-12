// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(() => []),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(() => ({ totalBonus: 0, details: [] })),
    markFortifiedHealthUsed: vi.fn(),
    hasHealingMaximization: vi.fn(),
    hasHealingMaximizationForTarget: vi.fn(() => false),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(() => 30),
}));

import { handle, confirmPrayerOfHealing } from './prayerOfHealingHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import {
    resolveHealingBonusesWithDetails,
    markFortifiedHealthUsed,
    hasHealingMaximization,
} from '../../../combat/automation/automationService.js';

describe('prayerOfHealingHandler', () => {
    const campaignName = 'TestCampaign';
    const casterStats = {
        name: 'Cleric',
        hitPoints: 50,
        proficiency: 3,
        level: 5,
        spellAbilities: {
            spellCastingAbility: 'Wisdom',
            modifier: 3,
        },
    };

    const baseCombatSummary = {
        players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
        creatures: [
            { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
            { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
            { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
        ],
        round: 1,
    };

    const baseAction = {
        name: 'Prayer of Healing',
        spell: { name: 'Prayer of Healing', level: 2, heal_at_slot_level: { '2': '2d8 + MOD', '3': '3d8 + MOD' } },
        automation: { type: 'prayer_of_healing' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue(baseCombatSummary);
        getAllyList.mockReturnValue(['Fighter', 'Rogue', 'Barbarian']);
        isWithinRange.mockResolvedValue(true);
        getRuntimeValue.mockImplementation((_name, prop, _campaignName) => {
            if (prop === 'currentHitPoints') return 20;
            if (prop === 'activeConditions') return [];
            if (prop === 'prayerOfHealing_lastUsedRound_Fighter') return undefined;
            if (prop === 'prayerOfHealing_lastUsedRound_Rogue') return undefined;
            return null;
        });
        rollExpression.mockReturnValue({ total: 10, rolls: [7, 3], modifier: 3 });
        rollExpressionMaximized.mockReturnValue({ total: 19, rolls: [10, 10], modifier: 3 });
        hasHealingMaximization.mockReturnValue(false);
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    });

    describe('handle', () => {
        it('returns popup when allies are within range (<= maxTargets)', async () => {
            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('heal_multi');
            expect(result.payload.results).toHaveLength(3);
        });

        it('returns modal when > 5 eligible creatures', async () => {
            const combatSummary = {
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
                    { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
                    { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
                    { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
                    { name: 'Druid', maxHp: 35, currentHp: 25, type: 'npc' },
                    { name: 'Paladin', maxHp: 50, currentHp: 40, type: 'player' },
                ],
                round: 1,
            };
            getCombatContext.mockResolvedValue(combatSummary);

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('prayerOfHealingTarget');
            expect(result.payload.creatureTargets).toHaveLength(6);
            expect(result.payload.maxTargets).toBe(5);
        });

        it('returns confirm when <= 5 eligible allies', async () => {
            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('heal_multi');
        });

        it('uses slot level from automation when provided', async () => {
            const action3rdLevel = {
                ...baseAction,
                spell: { ...baseAction.spell, level: 3 },
                automation: { type: 'prayer_of_healing', slotLevel: 4 },
            };

            const result = await handle(action3rdLevel, casterStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('heal_multi');
            expect(result.payload.formula).toContain('3d8 + 3');
        });

        it('returns popup when heal expression cannot be resolved', async () => {
            const actionNoHeal = {
                ...baseAction,
                spell: { ...baseAction.spell, heal_at_slot_level: {} },
            };

            const result = await handle(actionNoHeal, casterStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Could not resolve heal expression');
        });

        it('returns null when no combat context', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result).toBeNull();
        });

        it('includes all creatures in eligible list', async () => {
            const combatSummary = {
                players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 25, type: 'player' },
                    { name: 'Ally', maxHp: 40, currentHp: 15, type: 'player' },
                ],
                round: 1,
            };
            getCombatContext.mockResolvedValue(combatSummary);

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.results.length).toBe(2);
        });
    });

    describe('confirmPrayerOfHealing', () => {
        it('applies healing to each selected target', async () => {
            const result = await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter', 'Rogue'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('heal_multi');
            expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
        });

        it('returns heal_multi popup with per-target results', async () => {
            const result = await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter', 'Rogue'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(result.payload).toEqual(expect.objectContaining({
                type: 'heal_multi',
                name: 'Prayer of Healing',
                formula: '2d8 + 3',
                results: expect.arrayContaining([
                    expect.objectContaining({ targetName: 'Fighter', healAmount: expect.any(Number) }),
                    expect.objectContaining({ targetName: 'Rogue', healAmount: expect.any(Number) }),
                ]),
            }));
        });

        it('rolls separately for each target', async () => {
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 3 });

            await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(rollExpression).toHaveBeenCalledTimes(3);
        });

        it('respects maxTargets limit', async () => {
            const result = await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter', 'Rogue', 'Barbarian', 'Extra1', 'Extra2', 'Extra3'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            // Only 5 targets max, even though 6 were passed
            expect(result.payload.results.length).toBe(5);
            expect(applyHealingToTarget).toHaveBeenCalledTimes(5);
        });

        it('skips already affected targets', async () => {
            getRuntimeValue.mockImplementation((_name, prop, _campaignName) => {
                if (prop === 'prayerOfHealing_lastUsedRound_Fighter') return 1;
                if (prop === 'prayerOfHealing_lastUsedRound_Rogue') return undefined;
                if (prop === 'currentHitPoints') return 20;
                if (prop === 'activeConditions') return [];
                return null;
            });

            const result = await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter', 'Rogue'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            // Only Rogue should be healed, not Fighter
            expect(result.payload.results.length).toBe(1);
            expect(result.payload.results[0].targetName).toBe('Rogue');
        });

        it('uses maximized rolls when hasHealingMaximization', async () => {
            await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: true,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(rollExpressionMaximized).toHaveBeenCalledWith('2d8 + 3');
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('posts hp_change log entry for each target', async () => {
            await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'hp_change',
                    targetName: 'Fighter',
                    isHealing: true,
                    note: 'Prayer of Healing',
                }),
            );
        });

        it('dispatches combat-summary-updated event', async () => {
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

            await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'combat-summary-updated',
            }));
            dispatchEventSpy.mockRestore();
        });

        it('marks target as affected after healing', async () => {
            await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Fighter',
                'prayerOfHealing_lastUsedRound_Fighter',
                1,
                campaignName,
            );
        });

        it('clamps healing to remaining HP', async () => {
            const combatSummary = {
                players: [],
                creatures: [
                    { name: 'Fighter', maxHp: 50, currentHp: 5, type: 'player' },
                ],
                round: 1,
            };
            getCombatContext.mockResolvedValue(combatSummary);
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 5;
                return null;
            });

            const result = await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 0,
                bonusDetails: [],
                slotLevel: 2,
                currentRound: 1,
            });

            // Max heal is 50 - 5 = 45
            expect(result.payload.results[0].healAmount).toBeLessThanOrEqual(45);
        });

        it('includes bonusHeal in popup', async () => {
            resolveHealingBonusesWithDetails.mockReturnValue({
                totalBonus: 2,
                details: [{ name: 'Disciple of Life', amount: 2 }],
            });

            const result = await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 2,
                bonusDetails: [{ name: 'Disciple of Life', amount: 2 }],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(result.payload.bonusHeal).toBe(2);
            expect(result.payload.bonusHealDetail).toContain('Disciple of Life');
        });

        it('marks Fortified Health used when applicable', async () => {
            resolveHealingBonusesWithDetails.mockReturnValue({
                totalBonus: 5,
                details: [{ name: 'Fortified Health', amount: 5 }],
            });

            await confirmPrayerOfHealing({
                action: baseAction,
                playerStats: casterStats,
                campaignName,
                selectedTargetNames: ['Fighter'],
                healExpression: '2d8 + 3',
                maximize: false,
                bonusHeal: 5,
                bonusDetails: [{ name: 'Fortified Health', amount: 5 }],
                slotLevel: 2,
                currentRound: 1,
            });

            expect(markFortifiedHealthUsed).toHaveBeenCalledWith(casterStats, campaignName);
        });
    });
});
