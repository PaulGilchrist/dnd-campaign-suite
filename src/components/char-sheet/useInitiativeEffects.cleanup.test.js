// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map: this file owns ONLY the teardown contract of useInitiativeEffects —
// proof that dispatching a full, production-valid event AFTER unmount causes zero
// store writes (initiative-rolled) and zero damage rolls (turn-undead-result),
// with a positive leg while mounted so "removed" is distinguishable from
// "handler never does anything". Replaces three weak spies that accepted any
// function reference in removeEventListener (a stale-listener leak passed them).
// Handler behavior while mounted is owned by siblings: guards + whole-handler
// negatives (initiativeRolled), byte snapshots + tracker loop (activeStateClearing
// #346), exact batch payloads (batchResets #347), buff/clearBuffByName mechanics
// on this fake-store pattern (buffClearing #348), turn-undead payloads
// (turnUndeadResult), concentration / invisibility / regenerate lanes in theirs.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four exports live in this import graph (probed):
    // useInitiativeEffects.js:2 and its only real collaborator
    // boonOfCombatProwess.js import getRuntimeValue/setRuntimeValue/
    // setRuntimeBatch/getAllStoreKeys.
    // Dead-mock purge (with justification, load-keys probed #318): the previous
    // getStore/useSyncedState/listeners mocks were never read through any
    // module loaded here — no call and no import touches them.
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding the import graph touches; inert
// defaults keep the non-teardown lanes (concentration, shapechange, storage)
// quiet so only listener-liveness is observed. combatData also exports
// getCurrentCombatRound (boonOfCombatProwess.js:1) but it is never called on
// the teardown lane, so an undefined binding is honest here.
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

import {
    getRuntimeValue,
    setRuntimeValue,
    setRuntimeBatch,
} from '../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

describe('useInitiativeEffects - listener teardown on unmount', () => {
    const campaignName = 'test-campaign';
    const CANARY_KEY = '_War_Gods_Blessing_active';

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

    // Turn Undead attacker: searingUndead action + Wisdom are required for the
    // turn-undead-result handler to reach rollDamage (production-valid fixture).
    const clericStats = {
        ...playerStats,
        name: 'Cleric',
        automation: {
            passives: [],
            actions: [{
                name: 'Searing Undead',
                type: 'damage_bonus',
                trigger: 'turn_undead_fail',
                damageType: 'Radiant',
            }],
        },
    };

    // Fake store mirroring production semantics (#348 pattern): setRuntimeValue
    // updates what the NEXT getRuntimeValue sees, so mounted-vs-unmounted store
    // state is honest across both dispatch legs.
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

    function dispatchInitiativeRolled(characterName) {
        window.dispatchEvent(
            new CustomEvent('initiative-rolled', {
                detail: { characterName, roll: 15 },
            })
        );
    }

    function dispatchTurnUndeadResult() {
        window.dispatchEvent(
            new CustomEvent('turn-undead-result', {
                detail: {
                    attackerName: clericStats.name,
                    campaignName,
                    failedTargets: ['Skeleton'],
                },
            })
        );
    }

    // The handler awaits rollDamage per target (CLA-303 sequential path) — flush
    // microtasks so any leaked-listener call has landed before asserting counts.
    async function flushMicrotasks() {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    it('initiative-rolled writes stop at unmount: clears the canary while mounted, preserves it byte-exactly after', () => {
        store.set(`TestMonk|${CANARY_KEY}`, true);
        const { unmount } = renderHook(() =>
            useInitiativeEffects(playerStats, campaignName, vi.fn())
        );

        // Positive leg — listener is live: own-name event clears the canary
        // byte-exactly (this write's content is pinned by activeStateClearing;
        // here it only proves the mounted handler runs end-to-end past guards).
        dispatchInitiativeRolled('TestMonk');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestMonk', CANARY_KEY, null, campaignName
        );
        expect(store.get(`TestMonk|${CANARY_KEY}`)).toBe(null);

        unmount();

        // Re-arm observable state, then dispatch the same valid event again.
        store.set(`TestMonk|${CANARY_KEY}`, true);
        const writesAtUnmount = setRuntimeValue.mock.calls.length;
        const batchesAtUnmount = setRuntimeBatch.mock.calls.length;

        dispatchInitiativeRolled('TestMonk');

        // Leak detector: any surviving listener re-runs the handler, producing
        // new writes AND re-clearing the canary to null.
        expect(setRuntimeValue.mock.calls).toHaveLength(writesAtUnmount);
        expect(setRuntimeBatch.mock.calls).toHaveLength(batchesAtUnmount);
        expect(store.get(`TestMonk|${CANARY_KEY}`)).toBe(true);
    });

    it('turn-undead-result damage stops at unmount: rolls once while mounted, zero extra rolls after', async () => {
        const rollDamage = vi.fn();
        rollExpression.mockReturnValue({ total: 9, rolls: [4, 5], modifier: 0 });
        const { unmount } = renderHook(() =>
            useInitiativeEffects(clericStats, campaignName, rollDamage)
        );

        // Positive leg — listener is live: valid attack event rolls once.
        dispatchTurnUndeadResult();
        await flushMicrotasks();
        expect(rollDamage).toHaveBeenCalledTimes(1);

        unmount();

        dispatchTurnUndeadResult();
        await flushMicrotasks();
        expect(rollDamage).toHaveBeenCalledTimes(1);
    });
});
