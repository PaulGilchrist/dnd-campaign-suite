// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map (#346-#351 family prune): this file keeps ONLY the initiative-seam
// branches no sibling owns, verified against current disk:
//   1) recoverPerfectFocus no-write via `currentFP >= maxFP` (useInitiativeEffects.js:269)
//      when maxFP collapses to 0 through a failed class_levels lookup (the
//      `classLevel?.focus_points || 0` collapse is the same outcome as a stored
//      focus_points: 0, so that twin row is folded here) or when focusPoints
//      already sit at maxFP. initiativeRolled.test.js owns the positive recoveries,
//      the above-threshold and uncannyMetabolismUsed guards.
//   2) clearConcentrationOnInitiative guard `!creature?.concentration` with the
//      creature FOUND (useInitiativeEffects.js:193-194). concentrationClearing.test.js
//      (#350) seeds null / no-creatures / empty-array / creature-absent and a truthy
//      spell-undefined concentration, but never a falsy concentration on a found
//      creature — so that guard sub-branch was unowned.
// Removed here (covered elsewhere, reported to orchestrator):
//   - FT-007 boon latch + strokeOfLuck find() checks → batchResets.test.js (#347)
//     byte-exact batch payload contains both keys with toHaveBeenCalledTimes(1).
//   - Calm Emotions mode/already-present/empty-suppressed guards →
//     concentrationClearing2.test.js (#351) seeded guard table, stronger asserts.
//   - 'Shield' unhandled-spell gating → concentrationClearing.test.js (#350)
//     undefined-spell row: any spell string matching no table row takes the
//     identical all-comparisons-false path.
//   - Wild Shape level-lookup miss → initiativeRolled.test.js "max wild shape is 0"
//     row hits the same `druidLevel?.wild_shape || 0` → maxWS <= 0 guard.
//   - Bardic inspiration maxBI=0 vacuous 0-write → initiativeRolled pins the
//     proficiency fallback positively; writing 0 onto a 0 store is inert.
//   - Regenerate empty/mixed store keys → invisibilityRegen.test.js owns the full
//     regenerate lane including both exact fixtures (empty getAllStoreKeys,
//     ['ValidCreature', 123, null, ...]).
//   - automation undefined safety .not.toThrow() → activeStateClearing.test.js
//     (#346) covers automation null/{passives,actions:undefined} with real
//     completion assertions; `.not.toThrow()` around dispatchEvent is vacuous
//     anyway (jsdom reports listener exceptions instead of rethrowing them).
// Fixed + pinned 2026-10-22: restoreCalmEmotions multi-condition clobber
// (useInitiativeEffects.js:163-171) — one merged write per effect-target now;
// multi-suppressedConditions byte pins live in concentrationClearing2.test.js.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four exports live in this import graph: useInitiativeEffects.js:2
    // and its loaded collaborator boonOfCombatProwess.js:2 import
    // getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys
    // (probed: useRuntimeState.js exports at :5,:21,:63,:78,:201,:242).
    // Dead-mock purge: getStore/useSyncedState/listeners were never read by any
    // module loaded here — and useSyncedState is not even an export of that file.
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports (:3-10);
// inert defaults keep the non-owned lanes (invisibility, shapechange, dice, regenerate)
// silent so only the two kept seams are observed. combatData also exports
// getCurrentCombatRound (boonOfCombatProwess.js:1) but it is never called on these
// lanes, so an undefined binding is honest here (#350/#351 precedent).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibility: vi.fn(),
    endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
    revertPolymorph: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
    revertShapechange: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import * as storageService from '../../services/ui/storage.js';

describe('useInitiativeEffects - unowned edge branches at the initiative seam', () => {
    const campaignName = 'test-campaign';
    const TE = 'targetEffects';
    const BUFFS = 'activeBuffs';
    const CONDS = 'activeConditions';

    const playerStats = {
        name: 'TestMonk',
        level: 15,
        class: {
            name: 'Monk',
            class_levels: [{ level: 15, focus_points: 6 }],
        },
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        automation: {
            passives: [],
            actions: [],
        },
        actions: [],
    };

    // Production-faithful fake store (#348/#350 pattern): setRuntimeValue updates
    // the value the NEXT getRuntimeValue sees, so seeded state is checked
    // byte-exactly at final state and a resurrected or over-cleared value fails.
    let store;

    beforeEach(() => {
        vi.clearAllMocks();
        store = new Map();
        getRuntimeValue.mockImplementation((name, key) =>
            store.has(`${name}|${key}`) ? store.get(`${name}|${key}`) : null
        );
        setRuntimeValue.mockImplementation((name, key, value) => {
            store.set(`${name}|${key}`, value);
        });
    });

    function rollInitiative() {
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            })
        );
    }

    const teWrites = () =>
        setRuntimeValue.mock.calls.filter(([name, key]) => name === 'campaign' && key === TE);
    const buffWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === BUFFS);
    const condWrites = () =>
        setRuntimeValue.mock.calls.filter(([, key]) => key === CONDS);
    const storedTE = () => store.get(`campaign|${TE}`);

    describe('Perfect Focus: currentFP >= maxFP no-write guard', () => {
        it.each([
            {
                label: 'class_levels lookup fails for the character level (maxFP collapses to 0)',
                level: 15,
                class_levels: [{ level: 20, focus_points: 6 }],
                focusPoints: 2,
            },
            {
                label: 'focusPoints already sit at maxFP',
                level: 15,
                class_levels: [{ level: 15, focus_points: 3 }],
                focusPoints: 3,
            },
        ])('writes no focusPoints when $label, yet the handler completes', ({ level, class_levels, focusPoints }) => {
            // Non-empty seed so the absence assertion bites: recovery would move
            // this stored value toward 4.
            store.set('TestMonk|focusPoints', focusPoints);
            const stats = {
                ...playerStats,
                level,
                automation: {
                    ...playerStats.automation,
                    passives: [{ type: 'passive_rule', effect: 'perfect_focus' }],
                },
                class: { name: 'Monk', class_levels },
            };

            renderHook(() => useInitiativeEffects(stats, campaignName, vi.fn()));
            rollInitiative();

            // Positive leg: setRuntimeBatch is the handler's last statement, so its
            // presence proves the guard branch — not a dead seam — blocked recovery
            // (payload bytes owned by batchResets.test.js #347).
            expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue.mock.calls.filter(([, key]) => key === 'focusPoints')).toHaveLength(0);
            expect(store.get('TestMonk|focusPoints')).toBe(focusPoints);
        });
    });

    describe('Concentration: rolling creature found with falsy concentration', () => {
        it.each([
            ['the concentration property is absent', {}],
            ['concentration is explicitly undefined', { concentration: undefined }],
        ])('persists no summary and clears no effects when %s', (_label, monkShape) => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestMonk', ...monkShape, hp: 30 },
                    { name: 'Ally', concentration: { spell: 'Bless' } },
                ],
            });
            // Seed own-source state the spell-tables would clear if the
            // `!creature?.concentration` guard were removed: both absences bite.
            const ownBane = { effect: 'bane_penalty', source: 'TestMonk', target: 'Goblin1' };
            store.set(`campaign|${TE}`, [ownBane]);
            store.set(`TestMonk|${BUFFS}`, [{ name: 'Bless', effect: 'bless' }]);

            renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
            rollInitiative();

            // Seam fired (batch is the handler's last statement) — a guard removal
            // would throw on creature.concentration.spell and skip it.
            expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
            expect(storageService.default.set).not.toHaveBeenCalled();
            expect(teWrites()).toHaveLength(0);
            expect(buffWrites()).toHaveLength(0);
            expect(condWrites()).toHaveLength(0);
            expect(storedTE()).toEqual([ownBane]);
        });
    });
});
