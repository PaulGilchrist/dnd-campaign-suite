// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map (#346-#353 family): this file owns the initiative-rolled EVENT GUARD
// CLAUSES (useInitiativeEffects.js:311/:315/:318 — whole-handler not.toHaveBeenCalled
// strong form, cited owner by buffClearing:12 and activeStateClearing:52) and the
// three RECOVERY lanes: recoverPerfectFocus positive + above-threshold +
// uncannyMetabolismUsed guards (:258-275), recoverWildShapeUse incl. the CLA-013
// specialActions-vs-actions routing regression (:278-290), and regainBardicInspiration
// incl. the proficiency fallback (:293-305). Not restated here (owned by siblings):
// activeStateClearing #346 snapshot+tracker loop; batchResets #347 exact batch
// payloads; buffClearing #348 clearBuffByName mechanics incl. 'Superior Defense'
// (that test's old duplicate here was dropped — #348 pins it byte-exactly WITH the
// final-state check); concentrationClearing #350/#351 tables; effectClearing #353
// sweep write-sequence; cleanup #349 teardown; edgeCases #352 currentFP>=maxFP and
// falsy-on-found concentration guards.
// No wall-clock gates: every recovery below is seam-driven by the initiative-rolled
// event (no-timers rule); the source lane contains no Date.now/setTimeout paths.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four exports live in this import graph: useInitiativeEffects.js:2
    // and its only unmocked collaborator, boonOfCombatProwess.js:2, import
    // getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys (probed live).
    // Dead-mock purge: getStore/useSyncedState/listeners were never read by any
    // module loaded here — and useSyncedState is not even an export of that file.
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports (:3-10);
// inert defaults keep the non-owned lanes (concentration, invisibility, regenerate,
// buff clearing) silent so only the guard + recovery seams are observed. combatData
// also exports getCurrentCombatRound (boonOfCombatProwess.js:1) but it is never
// called on these lanes, so an undefined binding is honest here (#348 precedent).
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

describe('useInitiativeEffects - initiative-rolled guards and recoveries', () => {
    const campaignName = 'test-campaign';
    const FOCUS = 'focusPoints';
    const WS = 'wildShapeUses';
    const BI = 'bardicInspirationUses';

    const baseStats = {
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

    const withPassive = (effect) => ({
        ...baseStats,
        automation: {
            ...baseStats.automation,
            passives: [{ type: 'passive_rule', effect }],
        },
    });

    const withSpecialAction = (effect, classOverrides = []) => ({
        ...baseStats,
        automation: {
            ...baseStats.automation,
            specialActions: [{ type: 'initiative_action', effect }],
        },
        class: { ...baseStats.class, class_levels: classOverrides },
    });

    // Production-faithful fake store (#348 lineage): setRuntimeValue updates the
    // value the NEXT getRuntimeValue sees, so recoveries read fresh state and a
    // stale-write resurrection fails the final-state assertions.
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

    function rollInitiative(detail = { characterName: 'TestMonk', roll: 15 }) {
        window.dispatchEvent(new CustomEvent('initiative-rolled', { detail }));
    }

    const writesTo = (key) =>
        setRuntimeValue.mock.calls.filter(([, k]) => k === key);

    // Recovery-capable monk: every post-guard recovery lane is armed so each
    // guard's presence is what keeps the store untouched.
    const armedStats = {
        ...withPassive('perfect_focus'),
        automation: {
            ...withPassive('perfect_focus').automation,
            specialActions: [{ type: 'initiative_action', effect: 'wild_shape_regen_on_initiative' }],
        },
    };

    describe('guard clauses', () => {
        it.each([
            ['playerStats is null', null, { characterName: 'TestMonk', roll: 15 }],
            ['playerStats is undefined', undefined, { characterName: 'TestMonk', roll: 15 }],
            ['event detail is missing', armedStats, null],
            ['detail has no characterName', armedStats, { roll: 15 }],
            ['detail characterName is an empty string', armedStats, { characterName: '', roll: 15 }],
            ['the rolling name does not match the player name', armedStats, { characterName: 'OtherPlayer', roll: 15 }],
        ])('writes nothing to the runtime store when %s', (_label, stats, detail) => {
            // Seeds so each guard's absence bites: with the playerStats guard
            // removed, the matched-name rows crash before the batch; with the
            // detail guard removed, setRuntimeValue writes fire immediately
            // (:321); with the name guard removed, the armed focus/wildShape
            // recoveries rewrite 2→4 and 0→1.
            store.set(`TestMonk|${FOCUS}`, 2);
            store.set(`TestMonk|${WS}`, 0);

            renderHook(() => useInitiativeEffects(stats, campaignName, vi.fn()));
            rollInitiative(detail);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(setRuntimeBatch).not.toHaveBeenCalled();
        });
    });

    describe('Perfect Focus recovery (Monk level 15 passive)', () => {
        it.each([
            ['to the 4-point target when current 2 sits below max 6', 6, 2, 4, false],
            ['capped at max 3 when max is below the target', 3, 2, 3, false],
            ['not at all when current 4 is above the 3-point threshold', 6, 4, null, false],
            ['not at all when Uncanny Metabolism was used', 6, 2, null, true],
        ])('recovers focusPoints %s', (_label, maxFP, storedFP, expected, uncannyUsed) => {
            store.set(`TestMonk|${FOCUS}`, storedFP);
            if (uncannyUsed) store.set('TestMonk|uncannyMetabolismUsed', true);
            const stats = {
                ...withPassive('perfect_focus'),
                class: { name: 'Monk', class_levels: [{ level: 15, focus_points: maxFP }] },
            };

            renderHook(() => useInitiativeEffects(stats, campaignName, vi.fn()));
            rollInitiative();

            if (expected === null) {
                // Positive leg: the batch is the handler's last statement, so its
                // presence proves the guard branch — not a dead seam — blocked
                // recovery (payload bytes owned by batchResets.test.js #347).
                expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
                expect(writesTo(FOCUS)).toHaveLength(0);
            } else {
                expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', FOCUS, expected, campaignName);
            }
            expect(store.get(`TestMonk|${FOCUS}`)).toBe(expected ?? storedFP);
        });
    });

    describe('Wild Shape recovery (Archdruid Evergreen, CLA-013 routing)', () => {
        it.each([
            ['to 1 when all uses are expended', 'specialActions', 3, 0, 1],
            ['not at all when a use remains', 'specialActions', 3, 1, null],
            ['not at all when max wild shape is 0', 'specialActions', 0, 0, null],
            ['not at all when no evergreen action exists', 'none', 3, 0, null],
            ['not at all when the action sits in actions, not specialActions (CLA-013)', 'actions', 3, 0, null],
        ])('recovers wildShapeUses %s', (_label, lane, maxWS, storedWS, expected) => {
            store.set(`TestMonk|${WS}`, storedWS);
            const action = { type: 'initiative_action', effect: 'wild_shape_regen_on_initiative' };
            const stats = withSpecialAction(action.effect, [{ level: 15, wild_shape: maxWS }]);
            if (lane === 'actions') {
                // CLA-013 regression shape: action ONLY in actions, empty specialActions
                stats.automation.actions = [action];
                stats.automation.specialActions = [];
            }
            if (lane === 'none') delete stats.automation.specialActions;

            renderHook(() => useInitiativeEffects(stats, campaignName, vi.fn()));
            rollInitiative();

            if (expected === null) {
                expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
                expect(writesTo(WS)).toHaveLength(0);
            } else {
                expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', WS, expected, campaignName);
            }
            expect(store.get(`TestMonk|${WS}`)).toBe(expected ?? storedWS);
        });
    });

    describe('Bardic Inspiration recovery (Superior Inspiration)', () => {
        it.each([
            ['to 2 via the proficiency fallback when class_levels declare no uses', 'Bard', { level: 15 }, 6, 0, 2],
            ['capped at max 1 when declared uses sit below the target', 'Bard', { level: 15, bardic_inspiration_uses: 1 }, 6, 0, 1],
            ['not at all when already at the 2-use target', 'Bard', { level: 15 }, 6, 2, null],
            ['not at all for a non-Bard class', 'Monk', { level: 15 }, 6, 0, null],
        ])('recovers bardicInspirationUses %s', (_label, className, classLevelRow, proficiency, storedBI, expected) => {
            store.set(`TestMonk|${BI}`, storedBI);
            const stats = {
                ...baseStats,
                automation: {
                    ...baseStats.automation,
                    specialActions: [{ type: 'initiative_action', effect: 'regain_bardic_inspiration_on_initiative' }],
                },
                class: { name: className, class_levels: [classLevelRow] },
                proficiency,
            };

            renderHook(() => useInitiativeEffects(stats, campaignName, vi.fn()));
            rollInitiative();

            if (expected === null) {
                expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
                expect(writesTo(BI)).toHaveLength(0);
            } else {
                expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', BI, expected, campaignName);
            }
            expect(store.get(`TestMonk|${BI}`)).toBe(expected ?? storedBI);
        });
    });
});
