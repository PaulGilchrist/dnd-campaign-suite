// No-map branch (mapName falsy) of buildAttackContextForDamage.
// The map-present branch is covered by buildAttackContext-map.test.js.
// Note: the buildSyncCtx fallback inside damageRoll.js shares the same
// `saveDc || 0` contract as the no-map early return; it is only reachable
// from the map lane, so its coverage lives in the map file, not here.
// @maintained-by-ai

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

    it('returns base context with all expected fields and skips map services', async () => {
        // Non-default saveSuccess proves dcSuccess is passed through, not defaulted.
        const result = await buildAttackContextForDamage(
            makeAttackContext({ saveSuccess: 0.5 }),
            playerName, campaignName, null,
        );

        expect(result.damageType).toBe('fire');
        expect(result.resistanceNotice).toBeNull();
        expect(result.targetName).toBeUndefined();
        expect(result.saveDc).toBe(15);
        expect(result.saveType).toBe('DEX');
        expect(result.dcSuccess).toBe(0.5);
        expect(result.attackerName).toBe(playerName);
        expect(mapsService.loadMapData).not.toHaveBeenCalled();
        expect(npcsService.loadNPCs).not.toHaveBeenCalled();
    });

    it('defaults saveDc to 0 when not provided', async () => {
        const result = await buildAttackContextForDamage(
            makeAttackContext({ saveDc: undefined }),
            playerName, campaignName, null,
        );

        expect(result.saveDc).toBe(0);
    });

    it('resolves target from combat context', async () => {
        damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
        damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

        const result = await buildAttackContextForDamage(
            makeAttackContext(),
            playerName, campaignName, null,
        );

        expect(result.targetName).toBe('Goblin');
        expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith({ creatures: [] }, playerName);
    });

    it('falls back to getAttackerTargetName when getTargetFromAttacker returns null', async () => {
        damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        damageUtils.getAttackerTargetName.mockReturnValue('Falling Victim');

        const result = await buildAttackContextForDamage(
            makeAttackContext(),
            playerName, campaignName, null,
        );

        expect(result.targetName).toBe('Falling Victim');
    });

    it('includes resistanceNotice when target is resistant', async () => {
        damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
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

        expect(result.resistanceNotice).toBe('Target is resistant to fire');
        expect(damageUtils.getResistanceNotice).toHaveBeenCalledWith(
            ['fire'],
            ['fire'],
            [],
            'Goblin',
        );
    });

    describe("Nature's Sanctuary (no map)", () => {
        function mockSanctuary(creatures, resistance) {
            // Keyed lookup keeps this independent of getRuntimeValue call order.
            runtimeState.getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'naturesSanctuaryCreatures') return creatures;
                if (key === 'naturesSanctuaryResistance') return resistance;
                return null;
            });
        }

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
        });

        it('adds sanctuary notice when target is in the list and damage type matches', async () => {
            mockSanctuary(['Goblin'], 'Fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, null,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });

        it('returns null notice when sanctuary does not apply', async () => {
            // Target absent from the sanctuary creature list.
            mockSanctuary(['Ogre'], 'fire');

            let result = await buildAttackContextForDamage(
                makeAttackContext(),
                playerName, campaignName, null,
            );
            expect(result.resistanceNotice).toBeNull();

            // Damage type does not match the sanctuary resistance.
            runtimeState.getRuntimeValue.mockReset();
            mockSanctuary(['Goblin'], 'cold');

            result = await buildAttackContextForDamage(
                makeAttackContext(),
                playerName, campaignName, null,
            );
            expect(result.resistanceNotice).toBeNull();
        });

        it('does not consult the runtime store when no target is resolved', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);

            const result = await buildAttackContextForDamage(
                makeAttackContext(),
                playerName, campaignName, null,
            );

            expect(result.resistanceNotice).toBeNull();
            expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
