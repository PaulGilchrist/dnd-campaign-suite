// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map (#346-#352 family): this file owns ONLY the INITIATIVE_CLEARED_EFFECT_KEYS
// wholesale sweep at useInitiativeEffects.js:33-41 / :367-369 — each of the 7 keys
// (pass_without_trace_bonus, blur, globe_barrier, forcecage, antimagic_field,
// regenerate, beacon_of_hope) is removed from campaign targetEffects regardless of
// source, re-reading the store per sweep (sequential snapshot semantics).
// Distinct from siblings (verified against current disk, grep for the 7 keys across
// all useInitiativeEffects.*.test.js matches nothing outside this file):
//   - source-scoped clears (clearSourceEffects tables) → #350/#351/#348
//   - per-character activeBuffs / activeConditions / tracker resets → #346
//   - unowned guards (Perfect Focus FP>=max, falsy concentration on found
//     creature) → edgeCases #352
// Known source defect (never enshrined here): restoreCalmEmotions multi-condition
// clobber (useInitiativeEffects.js:163-171) — owned by #351 lane.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four exports live in this import graph: useInitiativeEffects.js:2
    // and its loaded collaborator boonOfCombatProwess.js:2 import
    // getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys
    // (probed exports: useRuntimeState.js:5,:21,:63,:78,:201,:242).
    // Dead-mock purge: getStore/useSyncedState/listeners were never read by any
    // module loaded here — and useSyncedState is not even an export of that file.
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports (:3-10);
// inert defaults keep the non-owned lanes (invisibility, shapechange, dice, storage,
// concentration) silent so only the targetEffects sweep is observed
// (edgeCases #352 precedent).
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

describe('useInitiativeEffects - wholesale campaign targetEffects sweep', () => {
    const campaignName = 'test-campaign';
    const TE = 'targetEffects';

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

    // One entry per swept key, in INITIATIVE_CLEARED_EFFECT_KEYS table order
    // (:33-41). The duplicate pass_without_trace entries carry different
    // owners/shapes: the sweep is source-agnostic, so both must fall.
    const SURVIVOR = { effect: 'other_effect', source: 'Ally' };
    const PWT_MONK = { effect: 'pass_without_trace_bonus', source: 'TestMonk' };
    const PWT_ALLY = { effect: 'pass_without_trace_bonus', target: 'Ally2' };
    const BLUR = { effect: 'blur', target: 'Enemy' };
    const GLOBE = { effect: 'globe_barrier', target: 'Ally' };
    const CAGE = { effect: 'forcecage', target: 'Enemy' };
    const ANTI = { effect: 'antimagic_field', target: 'Area' };
    const REGEN = { effect: 'regenerate', target: 'Enemy' };
    const BEACON = { effect: 'beacon_of_hope', target: 'Party' };

    // Production-faithful fake store (#348/#350 pattern): setRuntimeValue updates
    // the value the NEXT getRuntimeValue sees, so the sequential per-key re-read
    // is observable — a write built from a stale single snapshot resurrects an
    // already-cleared key and fails the byte-exact sequence below.
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

    it('clears all 7 swept keys source-agnostically, re-reading the store per sweep', () => {
        store.set(`campaign|${TE}`, [PWT_MONK, SURVIVOR, PWT_ALLY, BLUR, GLOBE, CAGE, ANTI, REGEN, BEACON]);

        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        rollInitiative();

        // One write per table key, shrinking byte-exactly in table order; every
        // call pins campaign scoping and the skipSync=true flag (5th arg).
        expect(teWrites()).toEqual([
            ['campaign', TE, [SURVIVOR, BLUR, GLOBE, CAGE, ANTI, REGEN, BEACON], campaignName, true],
            ['campaign', TE, [SURVIVOR, GLOBE, CAGE, ANTI, REGEN, BEACON], campaignName, true],
            ['campaign', TE, [SURVIVOR, CAGE, ANTI, REGEN, BEACON], campaignName, true],
            ['campaign', TE, [SURVIVOR, ANTI, REGEN, BEACON], campaignName, true],
            ['campaign', TE, [SURVIVOR, REGEN, BEACON], campaignName, true],
            ['campaign', TE, [SURVIVOR, BEACON], campaignName, true],
            ['campaign', TE, [SURVIVOR], campaignName, true],
        ]);
    });

    it.each([
        ['a null store', null],
        ['an empty store', []],
        [
            'only unlisted bystanders',
            [SURVIVOR, { effect: 'bless_bonus', source: 'Cleric' }, { effect: 'bane_penalty', source: 'OtherCaster' }],
        ],
    ])('writes no campaign targetEffects for any swept key when the store holds %s', (_label, seed) => {
        store.set(`campaign|${TE}`, seed);

        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        rollInitiative();

        // Seam fired (batch is the handler's last statement), so the absence of
        // writes is the length-guard blocking them — not a dead seam or an
        // exception before the sweep.
        expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
        expect(teWrites()).toHaveLength(0);
        expect(store.get(`campaign|${TE}`)).toEqual(seed);
    });
});
