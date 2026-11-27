// @maintained-by-ai 2026-11-27
// Sole lane for massHealHandler.js (Mass Heal, level-9 hit-point pool distribution):
// handle() opener (gate ORDER, ally-list fallback/fan-out target-set eligibility,
// range filtering, maxTargets/slot config, local resolveTotalHealPool family) and
// confirmMassHeal() fan-out (ordered per-target commit census, sequential pool-spend
// accounting, delta-0 sign-stamp, hp_change/condition full-row shapes, popup
// composition, Fortified Health marking, addEntry-rejection survivor).
//
// Lane map: per-target HP batch-write math belongs to the applyHealing chokepoint
// owner (seam mocked here; only call bytes pinned). Single-target ally routing
// belongs to the healingHandler targeted lane; shared massHealUtils.js branches are
// canonically owned by massCureWounds.main — the pool pins below exercise only this
// file's LOCAL resolveTotalHealPool duplicate (massHealHandler.js:40-47), which has
// no other coverage; they retire if production consolidates onto massHealUtils.
// NOTE (run2#1828-1831 mirrored-fixture sweep 2026-11-27): applyHealingToTarget is a
// bare spy — every clamp/pool/row number below is COMPUTED by the real handler from
// each fixture's runtime buckets, never mirrored from a hardcoded helper return.
// Known same-face check: this lane does NOT route through healingRoll.js's
// ally-clamp (its clamp at :130 is target-local via resolveTargetMaxHp); the only
// healer-max leak face is the malformed-row fallback at :119 (row without maxHp).
// Determinism: bare vi.fn factories with ALL defaults re-seeded in beforeEach after
// resetAllMocks, FROZEN Date.now, no *Once chains, no mid-test re-harnesses.
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
    addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(),
    markFortifiedHealthUsed: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(),
}));

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { resolveHealingBonusesWithDetails, markFortifiedHealthUsed } from '../../../combat/automation/automationService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

const FROZEN_NOW = 1700000000000;

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

    const confirm = (overrides = {}) => confirmMassHeal({
        action: baseAction,
        playerStats: casterStats,
        campaignName,
        distribution: {},
        totalPool: 700,
        bonusHeal: 0,
        bonusDetails: [],
        ...overrides,
    });

    // Full-shape hp_change row built from REAL per-fixture numbers via caller args.
    const hpRow = (targetName, delta, currentHp, maxHp, isHealing, formula) => ({
        type: 'hp_change',
        targetName,
        delta,
        currentHp,
        maxHp,
        isHealing,
        sourceName: 'Cleric',
        note: 'Mass Heal',
        formula,
        bonusDetails: undefined,
        timestamp: FROZEN_NOW,
    });

    const hpRows = () => addEntry.mock.calls.map(([campaign, entry]) => [campaign, entry]).filter(([, e]) => e.type === 'hp_change');
    const condRows = () => addEntry.mock.calls.map(([campaign, entry]) => [campaign, entry]).filter(([, e]) => e.type === 'condition');

    let dispatchSpy;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetAllMocks();
        // Re-seed EVERY default so no per-test impl can leak across reset.
        getCombatContext.mockResolvedValue(baseCombatSummary);
        getAllyList.mockReturnValue(['Fighter', 'Rogue', 'Barbarian']);
        isWithinRange.mockResolvedValue(true);
        rangeToFeet.mockImplementation(range => (range === '100 feet' ? 100 : 60));
        getRuntimeValue.mockImplementation((_name, prop) => {
            if (prop === 'currentHitPoints') return 20;
            if (prop === 'activeConditions') return [];
            return null;
        });
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
        addEntry.mockResolvedValue(undefined);
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    describe('handle', () => {
        it('opens modal with exact payload, bonus weaving, and ordered opener call census', async () => {
            resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 7, details: [{ name: 'Bond of Magic', amount: 7 }] });

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result).toEqual({
                type: 'modal',
                modalName: 'massHealTarget',
                payload: {
                    action: baseAction,
                    playerStats: casterStats,
                    campaignName,
                    creatureTargets: ['Fighter', 'Rogue', 'Barbarian'],
                    maxTargets: 10,
                    totalPool: 700,
                    bonusHeal: 7,
                    bonusDetails: [{ name: 'Bond of Magic', amount: 7 }],
                    combatSummary: baseCombatSummary,
                },
            });
            // Opener wiring census: ally probe once by caster name, spell-range
            // fallback '60 feet' through rangeToFeet, bonus resolve with slotLevel
            // config, range probes in ally-list order at 60 ft.
            expect(getAllyList.mock.calls).toEqual([['Cleric']]);
            expect(rangeToFeet.mock.calls).toEqual([['60 feet']]);
            expect(resolveHealingBonusesWithDetails.mock.calls).toEqual([
                [casterStats, { prof: 3, level: 10, slotLevel: 9, campaignName }],
            ]);
            expect(isWithinRange.mock.calls).toEqual([
                ['Cleric', 'Fighter', 60],
                ['Cleric', 'Rogue', 60],
                ['Cleric', 'Barbarian', 60],
            ]);
        });

        it.each([
            ['full ally list is kept in list order', ['Fighter', 'Rogue', 'Barbarian'], ['Fighter', 'Rogue', 'Barbarian']],
            ['empty ally list falls back to summary creature rows', [], ['Fighter', 'Rogue', 'Barbarian']],
            ['lone self entry falls back to summary creature rows', ['Cleric'], ['Fighter', 'Rogue', 'Barbarian']],
            ['lone non-self entry is used without fallback', ['Rogue'], ['Rogue']],
            ['multi list keeps order; caster with no creature row is dropped', ['Fighter', 'Cleric'], ['Fighter']],
        ])('target set: %s', async (_title, allyList, expectedTargets) => {
            getAllyList.mockReturnValue(allyList);

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result.payload.creatureTargets).toEqual(expectedTargets);
        });

        it('applies automation maxTargets/range overrides and filters rowless and out-of-range allies', async () => {
            getAllyList.mockReturnValue(['Fighter', 'Ghost', 'Rogue']);
            isWithinRange.mockImplementation((_p, allyName) => Promise.resolve(allyName !== 'Rogue'));

            const result = await handle(makeAction({ automation: { maxTargets: 5, range: '100 feet' } }), casterStats, campaignName, null);

            expect(result.payload.maxTargets).toBe(5);
            expect(result.payload.creatureTargets).toEqual(['Fighter']);
            expect(rangeToFeet.mock.calls).toEqual([['100 feet']]);
            // 'Ghost' has no creature row: skipped BEFORE any range probe (zero-read
            // of the later channel); surviving probes run in list order at 100 ft.
            expect(isWithinRange.mock.calls).toEqual([
                ['Cleric', 'Fighter', 100],
                ['Cleric', 'Rogue', 100],
            ]);
        });

        it.each([
            ['exact slot key', { spell: { level: 5, heal_at_slot_level: { 5: '200', 9: '700' } } }, 200],
            ['highest key when cast level absent from map', { spell: { level: 9, heal_at_slot_level: { 5: '200' } } }, 200],
            ['missing heal_at_slot_level map', { spell: { level: 9, heal_at_slot_level: undefined } }, 700],
            ["'max' expression", { spell: { level: 9, heal_at_slot_level: { 9: 'max' } } }, 700],
            ['unparsable expression', { spell: { level: 9, heal_at_slot_level: { 9: 'abc' } } }, 700],
            ['automation.slotLevel outranks spell level', { automation: { slotLevel: 5 }, spell: { heal_at_slot_level: { 5: '200', 9: '700' } } }, 200],
        ])('pool: %s resolves to 700- or map-driven total', async (_title, overrides, expectedPool) => {
            const result = await handle(makeAction(overrides), casterStats, campaignName, null);

            expect(result.payload.totalPool).toBe(expectedPool);
        });

        it.each([
            {
                title: 'null combat context returns null before bonus resolve or ally reads',
                setup: () => getCombatContext.mockResolvedValue(null),
                expected: null,
                allyCalls: [],
                rangeCalls: [],
                bonusCalls: [],
            },
            {
                title: 'summary with no creature rows returns no-allies popup',
                setup: () => {
                    getCombatContext.mockResolvedValue({ creatures: [] });
                    getAllyList.mockReturnValue([]);
                },
                expected: {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Mass Heal',
                        description: 'Mass Heal: No allies within range.',
                    },
                },
                allyCalls: [['Cleric']],
                rangeCalls: [],
                bonusCalls: [[casterStats, { prof: 3, level: 10, slotLevel: 9, campaignName }]],
            },
            {
                title: 'ally with no creature row is dropped pre-range with no probe',
                setup: () => getAllyList.mockReturnValue(['Ghost']),
                expected: {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Mass Heal',
                        description: 'Mass Heal: No allies within range.',
                    },
                },
                allyCalls: [['Cleric']],
                rangeCalls: [],
                bonusCalls: [[casterStats, { prof: 3, level: 10, slotLevel: 9, campaignName }]],
            },
        ])('opener refusal: $title', async ({ setup, expected, allyCalls, rangeCalls, bonusCalls }) => {
            setup();

            const result = await handle(baseAction, casterStats, campaignName, null);

            expect(result).toEqual(expected);
            // Gate-ORDER zero-reads: config/rangeToFeet computed first even on the
            // null-context refusal; bonus resolve outranks ally collection.
            expect(rangeToFeet.mock.calls).toEqual([['60 feet']]);
            expect(resolveHealingBonusesWithDetails.mock.calls).toEqual(bonusCalls);
            expect(getAllyList.mock.calls).toEqual(allyCalls);
            expect(isWithinRange.mock.calls).toEqual(rangeCalls);
        });
    });

    describe('confirmMassHeal', () => {
        it('fans out in distribution order with clamped exact apply calls, full hp rows, one dispatch, and exact popup', async () => {
            const result = await confirm({ distribution: { Fighter: 100, Rogue: 50 } });

            // Fighter: row max 45, runtime current 20 → clamp 100→25.
            // Rogue: row max 30, runtime current 20 → clamp 50→10.
            expect(applyHealingToTarget.mock.calls).toEqual([
                [baseCombatSummary, 'Fighter', 25, campaignName],
                [baseCombatSummary, 'Rogue', 10, campaignName],
            ]);
            expect(hpRows()).toEqual([
                [campaignName, hpRow('Fighter', 25, 45, 45, true, '2 targets')],
                [campaignName, hpRow('Rogue', 10, 30, 30, true, '2 targets')],
            ]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
            expect(dispatchSpy.mock.calls.length).toBe(1);
            expect(dispatchSpy.mock.calls[0][0].type).toBe('combat-summary-updated');
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Mass Heal',
                    automationType: 'mass_heal',
                    description: 'Mass Heal healed 35 HP across 2 target(s): Fighter, Rogue.',
                },
            });
        });

        it('heals player targets from runtime HP buckets despite combatSummary stub maxHp:1 (CLA-055)', async () => {
            const stubSummary = {
                creatures: [
                    { name: 'AasimarTest', maxHp: 1, currentHp: 1, type: 'player' },
                    { name: 'FeyRanger', maxHp: 1, currentHp: 1, type: 'player' },
                ],
            };
            getCombatContext.mockResolvedValue(stubSummary);
            getRuntimeValue.mockImplementation((name, prop) => {
                if (prop === 'activeConditions') return [];
                if (name === 'AasimarTest' && prop === 'currentHitPoints') return 80;
                if (name === 'AasimarTest' && prop === 'hitPoints') return 143;
                if (name === 'FeyRanger' && prop === 'currentHitPoints') return 40;
                if (name === 'FeyRanger' && prop === 'hitPoints') return 89;
                return null;
            });

            const result = await confirm({ distribution: { AasimarTest: 63, FeyRanger: 37 } });

            expect(applyHealingToTarget.mock.calls).toEqual([
                [stubSummary, 'AasimarTest', 63, campaignName],
                [stubSummary, 'FeyRanger', 37, campaignName],
            ]);
            // Row maxHp/currentHp must come from the runtime buckets (143/80, 89/40),
            // never from the 1/1 placeholder rows.
            expect(hpRows()).toEqual([
                [campaignName, hpRow('AasimarTest', 63, 143, 143, true, '2 targets')],
                [campaignName, hpRow('FeyRanger', 37, 77, 89, true, '2 targets')],
            ]);
            expect(result.payload.description).toBe('Mass Heal healed 100 HP across 2 target(s): AasimarTest, FeyRanger.');
        });

        it('spends the pool sequentially across targets and stamps delta-0 rows honestly', async () => {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'Fighter' && prop === 'currentHitPoints') return 45; // at row max 45
                if (prop === 'currentHitPoints') return 20;
                if (prop === 'activeConditions') return [];
                return null;
            });

            const result = await confirm({ distribution: { Fighter: 50, Rogue: 100, Barbarian: 100 }, totalPool: 15 });

            // Fighter missing 0 → 0 (no apply call, isHealing:false sign-stamp,
            // healingRoll.js:88 law). Rogue missing 10 of pool 15 → 10.
            // Barbarian missing 40 but only 5 pool remains → 5; pool now 0.
            expect(applyHealingToTarget.mock.calls).toEqual([
                [baseCombatSummary, 'Rogue', 10, campaignName],
                [baseCombatSummary, 'Barbarian', 5, campaignName],
            ]);
            expect(hpRows()).toEqual([
                [campaignName, hpRow('Fighter', 0, 45, 45, false, '3 targets')],
                [campaignName, hpRow('Rogue', 10, 30, 30, true, '3 targets')],
                [campaignName, hpRow('Barbarian', 5, 25, 60, true, '3 targets')],
            ]);
            expect(result.payload.description).toBe('Mass Heal healed 15 HP across 3 target(s): Fighter, Rogue, Barbarian.');
        });

        // Honest pin of the CURRENT source face (massHealHandler.js:25-31): once ANY
        // removal happens, the loop logs EVERY name in the remove list — including
        // 'deafened' the target never had. The surviving-conditions check compares
        // against newConditions, which by construction excludes the whole list.
        // Reported as a source defect; update this census if production fixes it.
        it.each([
            {
                title: 'default blinded/deafened/poisoned list on a default spell',
                overrides: {},
                stored: ['blinded', 'poisoned'],
                expectedWrite: [],
                expectedLogged: ['Blinded', 'Deafened', 'Poisoned'],
            },
            {
                title: 'spell status_effects replace the default list (case-insensitive match)',
                overrides: { spell: { status_effects: ['poisoned', 'exhaustion'] } },
                stored: ['poisoned', 'Exhaustion', 'blinded'],
                expectedWrite: ['blinded'],
                expectedLogged: ['Poisoned', 'Exhaustion'],
            },
            {
                title: 'no matching conditions means no write and no condition rows',
                overrides: {},
                stored: ['prone'],
                expectedWrite: null,
                expectedLogged: [],
            },
        ])('condition removal: $title', async ({ overrides, stored, expectedWrite, expectedLogged }) => {
            getRuntimeValue.mockImplementation((_name, prop) => {
                if (prop === 'activeConditions') return stored;
                if (prop === 'currentHitPoints') return 20;
                return null;
            });

            await confirm({ action: makeAction(overrides), distribution: { Fighter: 100 } });

            const expectedSetWrites = expectedWrite === null
                ? []
                : [['Fighter', 'activeConditions', expectedWrite, campaignName]];
            expect(setRuntimeValue.mock.calls).toEqual(expectedSetWrites);
            expect(condRows().map(([, row]) => row)).toEqual(expectedLogged.map(condition => ({
                type: 'condition',
                action: 'removed',
                characterName: 'Fighter',
                condition,
                reason: 'Mass Heal',
                timestamp: FROZEN_NOW,
            })));
        });

        it('empty distribution commits nothing and still returns the zero popup', async () => {
            const result = await confirm();

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Mass Heal',
                    automationType: 'mass_heal',
                    description: 'Mass Heal healed 0 HP across 0 target(s): none.',
                },
            });
            expect(applyHealingToTarget.mock.calls).toEqual([]);
            expect(addEntry.mock.calls).toEqual([]);
            expect(setRuntimeValue.mock.calls).toEqual([]);
            expect(markFortifiedHealthUsed.mock.calls).toEqual([]);
            expect(dispatchSpy.mock.calls.length).toBe(1);
        });

        it.each([
            ['a heal lands', { Fighter: 100 }, 1],
            ['every target is delta-0', { Fighter: 50 }, 0],
        ])('marks Fortified Health exactly once when %s', async (_title, distribution, expectedMarks) => {
            if (expectedMarks === 0) {
                getRuntimeValue.mockImplementation((name, prop) => {
                    if (name === 'Fighter' && prop === 'currentHitPoints') return 45;
                    if (prop === 'currentHitPoints') return 20;
                    if (prop === 'activeConditions') return [];
                    return null;
                });
            }

            await confirm({ distribution, bonusDetails: [{ name: 'Fortified Health', amount: 5 }] });

            expect(markFortifiedHealthUsed.mock.calls).toEqual(
                expectedMarks === 1 ? [[casterStats, campaignName]] : [],
            );
        });

        it('survives a rejected addEntry: healing still commits and popup still returns', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            addEntry.mockRejectedValue(new Error('log down'));

            const result = await confirm({ distribution: { Fighter: 100 } });

            expect(applyHealingToTarget.mock.calls).toEqual([
                [baseCombatSummary, 'Fighter', 25, campaignName],
            ]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Mass Heal',
                    automationType: 'mass_heal',
                    description: 'Mass Heal healed 25 HP across 1 target(s): Fighter.',
                },
            });
            expect(errorSpy).toHaveBeenCalled();
        });
    });
});
