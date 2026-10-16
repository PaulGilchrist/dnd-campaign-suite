// @maintained-by-ai
// PrayerOfHealing latch lane (SP-091). The generic massHealUtils.createMassHealHandler
// behaviour (casting-mod/expression resolution, modal-vs-popup dispatch, maxTargets
// slicing, clamp/apply, hp_change logging, heal_multi payload shape, maximization rolls,
// CLA-038 post-cast gating) is canonically owned by the massCureWounds pair
// (massCureWoundsHandler.test.js opener + massCureWoundsHandler.confirm.test.js) —
// NOT re-pinned here. This file owns what is unique to this lane:
//   1. Prayer config: modalName 'prayerOfHealingTarget', lv2 cap 5 (2024) vs
//      defaultMaxTargets5e 6 (5e twin), currentRound enforcement pass-through
//      (the pair pins its ABSENCE for Mass Cure Wounds).
//   2. The once-per-Long-Rest latch contract end-to-end: refuse with zero heal /
//      zero short-rest benefit / zero latch mutation, mixed-batch partial heal,
//      ONE merged setRuntimeBatch (latch stamp + SHORT_REST_RESOURCES re-arm),
//      5e twin byte-inertness, range advisory, and the Fortified Health consumption
//      via finalizePrayerPostCast — load-bearing repo-wide (other lanes' FH pins
//      pointed here and were removed; keep these pins exact).
// The rules/features/prayerOfHealingService twin lane owns its own module's pins.
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
    setRuntimeBatch: vi.fn(),
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
import { getRuntimeValue, setRuntimeBatch } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import {
    resolveHealingBonusesWithDetails,
    markFortifiedHealthUsed,
    hasHealingMaximization,
} from '../../../combat/automation/automationService.js';

describe('prayerOfHealingHandler', () => {
    const campaignName = 'TestCampaign';
    const casterStats = {
        name: 'Cleric',
        rules: '2024',
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

    // Six eligible creatures: exceeds the 2024 cap of 5, matches the 5e twin cap of 6.
    const sixCreatures = [
        { name: 'Fighter', maxHp: 45, currentHp: 20, type: 'player' },
        { name: 'Rogue', maxHp: 30, currentHp: 10, type: 'player' },
        { name: 'Barbarian', maxHp: 60, currentHp: 30, type: 'npc' },
        { name: 'Wizard', maxHp: 25, currentHp: 15, type: 'player' },
        { name: 'Druid', maxHp: 35, currentHp: 25, type: 'npc' },
        { name: 'Paladin', maxHp: 50, currentHp: 40, type: 'player' },
    ];

    function sixSummary(round = 4) {
        return { players: [{ name: 'Cleric', gridX: 1, gridY: 1 }], creatures: sixCreatures, round };
    }

    // Runtime stub: overrides MERGE per name/prop, never replace wholesale.
    function stubRuntime({ affected = {}, currentHp = {} } = {}) {
        getRuntimeValue.mockImplementation((name, prop) => {
            if (prop === 'prayerOfHealingAffected') return affected[name];
            if (prop === 'currentHitPoints') return name in currentHp ? currentHp[name] : 20;
            if (prop === 'activeConditions') return [];
            return null;
        });
    }

    // Confirm args helper: overrides MERGE, never replace wholesale.
    function confirmArgs(overrides = {}) {
        return {
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
            ...overrides,
        };
    }

    function entriesByAutomationType(automationType) {
        return addEntry.mock.calls.filter(([, entry]) => entry.automationType === automationType);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue(baseCombatSummary);
        stubRuntime();
        rollExpression.mockReturnValue({ total: 10, rolls: [7, 3], modifier: 3 });
        hasHealingMaximization.mockReturnValue(false);
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    });

    describe('handle() opener — Prayer config', () => {
        it('routes eligible <= 5 directly to confirm with the lv2 formula in combat order', async () => {
            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('heal_multi');
            // Full-string own-composition pin: spell name + lv2 default expression.
            expect(result.payload.name).toBe('Prayer of Healing');
            expect(result.payload.formula).toBe('2d8 + 3');
            expect(result.payload.results.map(r => r.targetName)).toEqual(['Fighter', 'Rogue', 'Barbarian']);
        });

        it('caps 2024 at five: six eligible open prayerOfHealingTarget modal with round stamp', async () => {
            getCombatContext.mockResolvedValue(sixSummary(4));

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('prayerOfHealingTarget');
            expect(result.payload.maxTargets).toBe(5);
            expect(result.payload.creatureTargets).toEqual(
                ['Fighter', 'Rogue', 'Barbarian', 'Wizard', 'Druid', 'Paladin'],
            );
            // Enforcement pass-through: 2024 modal carries currentRound for the latch stamp
            // (the massCureWounds pair pins this key's ABSENCE for its non-latch config).
            expect(result.payload.currentRound).toBe(4);
        });

        it('keeps the 5e twin cap at six: same six-eligible combat routes popup, not modal', async () => {
            getCombatContext.mockResolvedValue(sixSummary(4));

            const result = await handle(baseAction, { ...casterStats, rules: '5e' }, campaignName, null);

            // defaultMaxTargets5e: 6 — six eligible fit the 5e cap, so no modal.
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('heal_multi');
            expect(result.payload.results).toHaveLength(6);
        });
    });

    describe('confirmPrayerOfHealing — SP-091 once-per-Long-Rest latch', () => {
        it('refuses already affected targets (once per Long Rest)', async () => {
            stubRuntime({ affected: { Fighter: 1 } });

            const result = await confirmPrayerOfHealing(confirmArgs({ currentRound: 2 }));

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Long Rest');
            // Zero heal, zero short-rest benefit, zero latch mutation.
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeBatch).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'prayer_of_healing_refused',
                characterName: 'Fighter',
            }));
            // No successful cast, so no range advisory either.
            expect(entriesByAutomationType('prayer_of_healing_range_advisory')).toHaveLength(0);
        });

        it('refuses a mixed batch of affected targets but still heals fresh ones', async () => {
            stubRuntime({ affected: { Fighter: 1 } });

            const result = await confirmPrayerOfHealing(confirmArgs({
                selectedTargetNames: ['Fighter', 'Rogue'],
                currentRound: 2,
            }));

            expect(result.payload.type).toBe('heal_multi');
            expect(result.payload.results.length).toBe(1);
            expect(result.payload.results[0].targetName).toBe('Rogue');
            // Fresh target fully healed: Rogue 30 max − 20 current, roll 10 lands unclamped.
            expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Rogue', 10, campaignName);
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'prayer_of_healing_refused',
                characterName: 'Fighter',
            }));
        });

        it('marks target as affected with short-rest re-arm in ONE merged batch', async () => {
            await confirmPrayerOfHealing(confirmArgs());

            // SP-091: latch stamp + short-rest re-arm keys land in ONE merged
            // setRuntimeBatch per affected target (§5 single-write rule).
            expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
            expect(setRuntimeBatch).toHaveBeenCalledWith(
                'Fighter',
                expect.objectContaining({
                    prayerOfHealingAffected: 1,
                    channelDivinityCharges: null,
                    kiPoints: null,
                }),
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'short_rest_benefit_applied',
                characterName: 'Fighter',
            }));
        });

        it('grants the short-rest benefit even when the heal clamps to zero, without consuming Fortified Health', async () => {
            stubRuntime({ currentHp: { Fighter: 45 } }); // Fighter at max HP (45).

            const result = await confirmPrayerOfHealing(confirmArgs({
                bonusHeal: 5,
                bonusDetails: [{ name: 'Fortified Health', amount: 5 }],
            }));

            // Spell still AFFECTS the creature: latch + re-arm land, raw heal clamps to 0.
            expect(result.payload.results[0].healAmount).toBe(0);
            expect(result.payload.totalHealed).toBe(0);
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(setRuntimeBatch).toHaveBeenCalledWith(
                'Fighter',
                expect.objectContaining({ prayerOfHealingAffected: 1 }),
                campaignName,
            );
            // finalizePrayerPostCast gate: no actual healing → Fortified Health not consumed.
            expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
        });

        it('keeps enforcement inert for the 5e twin ruleset', async () => {
            stubRuntime({ affected: { Fighter: 5 } });

            const result = await confirmPrayerOfHealing(confirmArgs({
                playerStats: { ...casterStats, rules: '5e' },
                currentRound: 7,
            }));

            // 5e twin has neither latch-refusal nor short-rest-benefit clause.
            expect(result.payload.results.length).toBe(1);
            expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
            expect(setRuntimeBatch).not.toHaveBeenCalled();
            expect(entriesByAutomationType('prayer_of_healing_range_advisory')).toHaveLength(0);
            expect(entriesByAutomationType('prayer_of_healing_refused')).toHaveLength(0);
            expect(entriesByAutomationType('short_rest_benefit_applied')).toHaveLength(0);
        });

        it('logs the range advisory once per cast with affected targets', async () => {
            await confirmPrayerOfHealing(confirmArgs({
                selectedTargetNames: ['Fighter', 'Rogue'],
            }));

            const advisories = entriesByAutomationType('prayer_of_healing_range_advisory');
            expect(advisories).toHaveLength(1);
            expect(advisories[0][1]).toEqual(expect.objectContaining({
                type: 'automation',
                characterName: 'Cleric',
            }));
            expect(advisories[0][1].description).toContain('Fighter, Rogue');
        });

        // LOAD-BEARING (repo-wide): massCureWounds.confirm and MHW.confirm deleted their
        // FH pins pointing at finalizePrayerPostCast — this is the canonical consumption pin.
        it('marks Fortified Health used when applicable', async () => {
            await confirmPrayerOfHealing(confirmArgs({
                bonusHeal: 5,
                bonusDetails: [{ name: 'Fortified Health', amount: 5 }],
            }));

            expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);
            expect(markFortifiedHealthUsed).toHaveBeenCalledWith(casterStats, campaignName);
        });
    });
});
