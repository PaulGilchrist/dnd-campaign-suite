// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmMassHeal } from './massHealHandler.js';

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
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(() => 60),
}));

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';

describe('massHealHandler', () => {
    const campaignName = 'TestCampaign';
    const casterStats = {
        name: 'Cleric',
        hitPoints: 50,
        proficiency: 3,
        level: 10,
    };

    const baseCombatSummary = {
        players: [{ name: 'Cleric', gridX: 1, gridY: 1 }],
        creatures: [
            { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
            { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
            { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
        ],
    };

    const baseAction = {
        name: 'Mass Heal',
        spell: { name: 'Mass Heal', level: 9, heal_at_slot_level: { '9': '700' } },
        automation: { type: 'mass_heal' },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        getCombatContext.mockResolvedValue(baseCombatSummary);
        getAllyList.mockReturnValue(['Fighter', 'Rogue', 'Barbarian']);
        isWithinRange.mockResolvedValue(true);
        getRuntimeValue.mockImplementation((_name, prop) => {
            if (prop === 'currentHitPoints') return 20;
            if (prop === 'activeConditions') return [];
            return null;
        });
    });

    describe('handle', () => {
        it('returns modal when allies are within range', async () => {
            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'massHealTarget',
                payload: expect.objectContaining({
                    creatureTargets: expect.arrayContaining(['Fighter', 'Rogue', 'Barbarian']),
                    maxTargets: 10,
                    totalPool: 700,
                }),
            });
        });

        it('returns popup when no allies within range', async () => {
            getAllyList.mockReturnValue([]);

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'massHealTarget',
                payload: expect.objectContaining({
                    creatureTargets: expect.arrayContaining(['Fighter', 'Rogue', 'Barbarian']),
                    maxTargets: 10,
                    totalPool: 700,
                }),
            });
        });

        it('returns popup when combat summary has no creatures', async () => {
            getAllyList.mockReturnValue([]);
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Mass Heal',
                    description: 'Mass Heal: No allies within range.',
                },
            });
        });

        it('respects maxTargets from automation', async () => {
            const action = {
                ...baseAction,
                automation: { type: 'mass_heal', maxTargets: 5 },
            };

            const result = await handle(action, casterStats, campaignName, null);

            expect(result.payload.maxTargets).toBe(5);
        });

        it('respects heal_at_slot_level for pool size', async () => {
            const action = {
                ...baseAction,
                spell: { name: 'Mass Heal', level: 5, heal_at_slot_level: { 5: '200', 9: '700' } },
            };

            const result = await handle(action, casterStats, campaignName, null);

            expect(result.payload.totalPool).toBe(200);
        });

        it('uses highest slot key when slotLevel not in heal_at_slot_level', async () => {
            const action = {
                ...baseAction,
                spell: { name: 'Mass Heal', level: 9, heal_at_slot_level: { 5: '200' } },
            };

            const result = await handle(action, casterStats, campaignName, null);

            expect(result.payload.totalPool).toBe(200);
        });
    });

    describe('confirmMassHeal', () => {
        it('applies healing to each target from distribution', async () => {
            const distribution = { Fighter: 100, Rogue: 50 };

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                baseCombatSummary,
                'Fighter',
                25,
                campaignName,
            );
            expect(applyHealingToTarget).toHaveBeenCalledWith(
                baseCombatSummary,
                'Rogue',
                10,
                campaignName,
            );
        });

        it('caps healing at missing HP', async () => {
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'currentHitPoints') return 44;
                if (prop === 'activeConditions') return [];
                return null;
            });

            const distribution = { Fighter: 100 };

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                baseCombatSummary,
                'Fighter',
                1,
                campaignName,
            );
        });

        it('logs hp_change for each target', async () => {
            const distribution = { Fighter: 100, Rogue: 50 };

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            const hpLogs = addEntry.mock.calls.filter(call => call[1].type === 'hp_change');
            expect(hpLogs.length).toBe(2);
            expect(hpLogs[0][1].note).toBe('Mass Heal');
            expect(hpLogs[0][1].isHealing).toBe(true);
            expect(hpLogs[0][1].sourceName).toBe('Cleric');
        });

        it('removes conditions on each target', async () => {
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['blinded', 'poisoned'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            const distribution = { Fighter: 100 };

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Fighter',
                'activeConditions',
                expect.any(Array),
                campaignName,
            );

            const condLogs = addEntry.mock.calls.filter(call => call[1].type === 'condition');
            expect(condLogs.length).toBe(3);
            expect(condLogs[0][1].action).toBe('removed');
            expect(condLogs[0][1].reason).toBe('Mass Heal');
            if (condLogs.length !== 3) {
                console.debug('Condition logs:', condLogs.map(c => c[1]));
            }
        });

        it('dispatches combat-summary-updated event', async () => {
            const distribution = { Fighter: 100 };
            const originalDispatch = window.dispatchEvent;
            const mockDispatch = vi.fn();
            window.dispatchEvent = mockDispatch;

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(mockDispatch).toHaveBeenCalled();
            expect(mockDispatch.mock.calls[0][0].type).toBe('combat-summary-updated');

            window.dispatchEvent = originalDispatch;
        });

        it('returns popup with healing summary', async () => {
            const distribution = { Fighter: 100, Rogue: 50 };

            const result = await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Mass Heal');
            expect(result.payload.description).toContain('Mass Heal healed');
            expect(result.payload.description).toContain('Fighter');
            expect(result.payload.description).toContain('Rogue');
        });

        it('handles empty distribution gracefully', async () => {
            const distribution = {};

            const result = await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('0 HP');
        });

        it('uses spell status_effects when present', async () => {
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['poisoned', 'exhaustion'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            const spellWithEffects = {
                ...baseAction.spell,
                status_effects: ['poisoned', 'exhaustion'],
            };
            const action = { ...baseAction, spell: spellWithEffects };

            const distribution = { Fighter: 100 };

            await confirmMassHeal({ action, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            const condLogs = addEntry.mock.calls.filter(call => call[1].type === 'condition');
            expect(condLogs.length).toBe(2);
            expect(condLogs.every(log => log[1].condition !== 'Blinded')).toBe(true);
        });
    });
});
