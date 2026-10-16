// @maintained-by-ai
// Sole lane for massHealHandler.js (Mass Heal, level-9 hit-point pool distribution):
// handle() opener routing (ally-list fallback, max-targets config, total-pool resolution)
// and confirmMassHeal() application lane (per-target clamp to missing HP, runtime hitPoints
// truth, hp_change + condition logging, combat-summary-updated dispatch, popup composition).
//
// CANONICAL-OWNER decision (massHealUtils shared-branch question): massCureWounds.main is
// canonical for massHealUtils.js branches (getSpellCastingMod, resolveHealExpression highest-
// slot-below fallback). This file does NOT import massHealUtils.js — the "highest slot key"
// pin here re-pins only the *semantics*, exercising massHealHandler.js's own local
// resolveTotalHealPool fallback (a production duplicate of that util branch), which has no
// other coverage. Option (i) adopted: massCureWounds.main owns the shared-util pins; this
// lane keeps the massHeal-local duplicates because they execute different production code.
// If production ever consolidates massHealHandler onto massHealUtils (option ii via a new
// massHealUtils.test.js), these local pool pins retire with the duplicate code.
// production: automation/index.js `mass_heal` dispatch + useCharActionsModalHandlers.js.
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

    // Overrides MERGE into nested spell/automation — never replace them wholesale.
    function makeAction(overrides = {}) {
        const { spell: spellOverrides, automation: automationOverrides, ...rest } = overrides;
        return {
            ...baseAction,
            spell: { ...baseAction.spell, ...spellOverrides },
            automation: { ...baseAction.automation, ...automationOverrides },
            ...rest,
        };
    }

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

        it('falls back to combatSummary creatures when ally list is empty and still opens modal', async () => {
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

        it('returns null when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);

            expect(await handle(baseAction, casterStats, campaignName, null)).toBeNull();
        });

        it('respects maxTargets from automation', async () => {
            const result = await handle(makeAction({ automation: { maxTargets: 5 } }), casterStats, campaignName, null);

            expect(result.payload.maxTargets).toBe(5);
        });

        it('respects heal_at_slot_level for pool size', async () => {
            const result = await handle(makeAction({ spell: { level: 5, heal_at_slot_level: { 5: '200', 9: '700' } } }), casterStats, campaignName, null);

            expect(result.payload.totalPool).toBe(200);
        });

        it('uses highest slot key when slotLevel not in heal_at_slot_level', async () => {
            const result = await handle(makeAction({ spell: { level: 9, heal_at_slot_level: { 5: '200' } } }), casterStats, campaignName, null);

            expect(result.payload.totalPool).toBe(200);
        });
    });

    describe('confirmMassHeal', () => {
        it('applies healing to each target from distribution, clamped to missing HP', async () => {
            const distribution = { Fighter: 100, Rogue: 50 };

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            // Fighter: max 45, runtime current 20 → clamps 100→25. Rogue: max 30, current 20 → 50→10.
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

        it('heals player targets from runtime HP despite combatSummary stub maxHp:1 (CLA-055)', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'AasimarTest', maxHp: 1, currentHp: 1, type: 'player' },
                    { name: 'FeyRanger', maxHp: 1, currentHp: 1, type: 'player' },
                ],
            });
            getAllyList.mockReturnValue(['AasimarTest', 'FeyRanger']);
            getRuntimeValue.mockImplementation((name, prop) => {
                if (prop === 'activeConditions') return [];
                if (name === 'AasimarTest' && prop === 'currentHitPoints') return 80;
                if (name === 'AasimarTest' && prop === 'hitPoints') return 143;
                if (name === 'FeyRanger' && prop === 'currentHitPoints') return 40;
                if (name === 'FeyRanger' && prop === 'hitPoints') return 89;
                return null;
            });

            const distribution = { AasimarTest: 63, FeyRanger: 37 };

            const result = await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'AasimarTest', 63, campaignName);
            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'FeyRanger', 37, campaignName);
            expect(result.payload.description).toContain('healed 100 HP');
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

        it('removes default conditions on each target', async () => {
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
        });

        it('dispatches combat-summary-updated event', async () => {
            const distribution = { Fighter: 100 };
            const mockDispatch = vi.spyOn(window, 'dispatchEvent');

            await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(mockDispatch).toHaveBeenCalled();
            expect(mockDispatch.mock.calls[0][0].type).toBe('combat-summary-updated');
        });

        it('returns popup with healing summary', async () => {
            const distribution = { Fighter: 100, Rogue: 50 };

            const result = await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Mass Heal');
            expect(result.payload.automationType).toBe('mass_heal');
            // Full-string own-composition pin: 25 + 10 clamped heals across 2 targets.
            expect(result.payload.description).toBe('Mass Heal healed 35 HP across 2 target(s): Fighter, Rogue.');
        });

        it('handles empty distribution gracefully with zero side effects', async () => {
            const result = await confirmMassHeal({ action: baseAction, playerStats: casterStats, campaignName, distribution: {}, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Mass Heal healed 0 HP across 0 target(s): none.');
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses spell status_effects when present', async () => {
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return ['poisoned', 'exhaustion'];
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            const action = makeAction({ spell: { status_effects: ['poisoned', 'exhaustion'] } });
            const distribution = { Fighter: 100 };

            await confirmMassHeal({ action, playerStats: casterStats, campaignName, distribution, totalPool: 700, bonusHeal: 0, bonusDetails: [] });

            const condLogs = addEntry.mock.calls.filter(call => call[1].type === 'condition');
            expect(condLogs.length).toBe(2);
            expect(condLogs.every(log => log[1].condition !== 'Blinded')).toBe(true);
        });
    });
});
