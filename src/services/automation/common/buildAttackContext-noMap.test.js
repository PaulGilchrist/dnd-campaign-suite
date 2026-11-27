// @maintained-by-ai 2026-11-27
// No-map branch (mapName falsy) of buildAttackContextForDamage.
// The map-present branch is covered by buildAttackContext-map.test.js.
// Note: the buildSyncCtx fallback inside damageRoll.js shares the same
// `saveDc || 0` contract as the no-map early return; it is only reachable
// from the map lane, so its coverage lives in the map file, not here.
// The Nature's Sanctuary branch table (resolveSanctuaryNotice is pre-branch
// shared code) is owned by the map file's "Nature's Sanctuary resistance"
// describe; only the positive integration into the no-map output is pinned here.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    getCombatContext: vi.fn(),
    getResistanceNotice: vi.fn(),
    getAttackerTargetName: vi.fn(),
}));

vi.mock('../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(),
    computeMeleeProximityEffect: vi.fn(),
    getDistanceFeet: vi.fn(),
    isHostileNPC: vi.fn(),
    getNearestPlacedItem: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../rules/combat/coverService.js', () => ({
    computeCover: vi.fn(),
}));

vi.mock('../../npcs/npcsService.js', () => ({
    loadNPCs: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { buildAttackContextForDamage } from './damageRoll.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import * as npcsService from '../../npcs/npcsService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const playerName = 'Attacker';

function makeAttackContext(overrides = {}) {
    return {
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        saveSuccess: 0,
        ...overrides,
    };
}

// ── buildAttackContextForDamage (no map) ───────────────────────

describe('buildAttackContextForDamage (no map)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(null);
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        damageUtils.getResistanceNotice.mockReturnValue(null);
        damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        mapsService.loadMapData.mockResolvedValue(null);
        // Wire-envelope shape kept honest even though the no-map branch never calls loadNPCs (#1181).
        npcsService.loadNPCs.mockResolvedValue({ npcs: [] });
        runtimeState.getRuntimeValue.mockReturnValue(null);
    });

    it('early-returns the full base context, applies saveDc||0, and touches no map/NPC/sanctuary services', async () => {
        // Non-default saveSuccess proves dcSuccess is passed through, not defaulted.
        const result = await buildAttackContextForDamage(
            makeAttackContext({ saveSuccess: 0.5 }),
            playerName, campaignName, null,
        );

        expect(result).toEqual({
            damageType: 'fire',
            resistanceNotice: null,
            targetName: undefined,
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 0.5,
            attackerName: playerName,
        });

        // Degraded path: `saveDc || 0` fallback branch.
        const defaulted = await buildAttackContextForDamage(
            makeAttackContext({ saveDc: undefined }),
            playerName, campaignName, null,
        );
        expect(defaulted.saveDc).toBe(0);

        // Exactly one combat-context fetch per call, no second fetch from the
        // map lane's resolveTargetPosition; nothing else consulted. With no
        // target name resolved, the sanctuary guard must not read the store.
        expect(damageUtils.getCombatContext.mock.calls).toEqual([[campaignName], [campaignName]]);
        expect(damageUtils.getTargetFromAttacker).not.toHaveBeenCalled();
        expect(damageUtils.getResistanceNotice).not.toHaveBeenCalled();
        expect(damageUtils.getAttackerTargetName).not.toHaveBeenCalled();
        expect(mapsService.loadMapData).not.toHaveBeenCalled();
        expect(npcsService.loadNPCs).not.toHaveBeenCalled();
        expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
    });

    it('resolves the creature target and passes its resistance notice through, skipping the sanctuary check', async () => {
        const cs = { creatures: [] };
        damageUtils.getCombatContext.mockResolvedValue(cs);
        damageUtils.getTargetFromAttacker.mockReturnValue({
            name: 'Goblin',
            resistances: ['fire'],
            immunities: [],
        });
        damageUtils.getResistanceNotice.mockReturnValue('Target is resistant to fire');

        const result = await buildAttackContextForDamage(
            makeAttackContext(),
            playerName, campaignName, null,
        );

        expect(result).toEqual({
            damageType: 'fire',
            resistanceNotice: 'Target is resistant to fire',
            targetName: 'Goblin',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 0,
            attackerName: playerName,
        });
        expect(damageUtils.getTargetFromAttacker.mock.calls).toEqual([[cs, playerName]]);
        expect(damageUtils.getResistanceNotice.mock.calls).toEqual([
            [['fire'], ['fire'], [], 'Goblin'],
        ]);
        // Truthful notice short-circuits the sanctuary store read.
        expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
    });

    it('falls back to getAttackerTargetName when no creature target resolves', async () => {
        const cs = { creatures: [] };
        damageUtils.getCombatContext.mockResolvedValue(cs);
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        damageUtils.getAttackerTargetName.mockReturnValue('Falling Victim');

        const result = await buildAttackContextForDamage(
            makeAttackContext(),
            playerName, campaignName, null,
        );

        expect(result.targetName).toBe('Falling Victim');
        expect(result.resistanceNotice).toBeNull();
        expect(damageUtils.getAttackerTargetName.mock.calls).toEqual([[cs, playerName]]);
        // A name-only fallback has no creature data, so no resistance probe runs.
        expect(damageUtils.getResistanceNotice).not.toHaveBeenCalled();
    });

    it("surfaces a matching Nature's Sanctuary notice in the no-map output", async () => {
        // Branch-table negatives (absent from list, unset/mismatched
        // resistance, case handling) are owned by the map file — same
        // shared pre-branch code path.
        damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
        damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        // Keyed lookup keeps this independent of getRuntimeValue call order.
        runtimeState.getRuntimeValue.mockImplementation((player, key) => {
            if (key === 'naturesSanctuaryCreatures') return ['Goblin'];
            if (key === 'naturesSanctuaryResistance') return 'Fire';
            return null;
        });

        const result = await buildAttackContextForDamage(
            makeAttackContext({ damageType: 'fire' }),
            playerName, campaignName, null,
        );

        expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        // Runtime-store key names are a cross-module contract with the writer.
        expect(runtimeState.getRuntimeValue.mock.calls).toEqual([
            [playerName, 'naturesSanctuaryCreatures', campaignName],
            [playerName, 'naturesSanctuaryResistance', campaignName],
        ]);
    });
});
