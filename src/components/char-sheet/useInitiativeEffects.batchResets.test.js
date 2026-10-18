// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane map: this file pins ONLY the buildInitiativeUpdates payload delivered
// via setRuntimeBatch at the initiative seam. Event guard clauses (null
// playerStats/detail, name mismatch — including "no batch for another
// roller") are pinned in useInitiativeEffects.initiativeRolled.test.js;
// clearBuffByName / "no buff -> no write" negatives in
// useInitiativeEffects.buffClearing.test.js; the per-character active-state
// setRuntimeValue snapshot and ONCE_PER_TURN_TRACKER_KEYS loop in
// useInitiativeEffects.activeStateClearing.test.js; concentration /
// invisibility / regenerate lanes in their own siblings.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    // Exactly the four exports live in this import graph: useInitiativeEffects
    // .js and its only real collaborator, boonOfCombatProwess.js, import
    // getRuntimeValue/setRuntimeValue/setRuntimeBatch/getAllStoreKeys
    // (probed: lines 2 of useInitiativeEffects.js, line 2 of
    // boonOfCombatProwess.js). Dead-mock purge: getStore/useSyncedState/
    // listeners were never read through any module loaded here.
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

// Each factory supplies every named binding useInitiativeEffects.js imports;
// inert defaults keep the non-batch lanes (concentration, invisibility,
// shapechange, regenerate, storage) inert so only the batch seam is observed.
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

import { getRuntimeValue, setRuntimeBatch } from '../../hooks/runtime/useRuntimeState.js';
import { BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY } from '../../services/rules/features/boonOfCombatProwess.js';

// Byte-exact contract of buildInitiativeUpdates: every once-per-round flag
// it resets unconditionally on a new initiative roll. Any key added to or
// removed from the batch (or a changed value) fails toHaveBeenCalledWith.
const UNCONDITIONAL_RESETS = {
    actionSurgeUsedThisRound: null,
    projectedWardDamage: null,
    psionicStrikeUsedThisTurn: null,
    dreadAmbushUsedThisTurn: null,
    // CLA-100: Ambusher's Leap once-per-combat latch re-arms on initiative.
    dreadAmbushSpeedActive: null,
    hurlThroughHellTurnUsed: null,
    portentUsedThisTurn: null,
    // FT-007: Boon of Combat Prowess round latch + Stroke of Luck.
    [BOON_OF_COMBAT_PROWESS_USED_ROUND_KEY]: null,
    strokeOfLuckUsed: null,
};

describe('useInitiativeEffects - buildInitiativeUpdates batch payload', () => {
    const campaignName = 'test-campaign';
    const defaultPlayerStats = {
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

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it.each([
        {
            label: 'without the Relentless passive',
            passives: [],
            expected: UNCONDITIONAL_RESETS,
        },
        {
            label: 'with the Relentless passive',
            passives: [{ type: 'passive_rule', effect: 'relentless' }],
            expected: { ...UNCONDITIONAL_RESETS, relentlessUsedRound: null },
        },
    ])('sends one byte-exact reset batch for $label', ({ passives, expected }) => {
        const stats = {
            ...defaultPlayerStats,
            automation: { ...defaultPlayerStats.automation, passives },
        };
        renderHook(() => useInitiativeEffects(stats, campaignName, vi.fn()));

        window.dispatchEvent(
            new CustomEvent('initiative-rolled', {
                detail: { characterName: 'TestMonk', roll: 15 },
            })
        );

        expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
        expect(setRuntimeBatch).toHaveBeenCalledWith('TestMonk', expected, campaignName);
    });
});
