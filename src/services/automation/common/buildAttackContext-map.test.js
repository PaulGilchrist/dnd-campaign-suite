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
import * as rangeValidation from '../../rules/combat/rangeValidation.js';
import * as coverService from '../../rules/combat/coverService.js';
import * as npcsService from '../../npcs/npcsService.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';
const playerName = 'Attacker';

function makeMapData(players, placedItems) {
    return {
        players: players || [],
        placedItems: placedItems || [],
        walls: new Set(),
    };
}

// ── buildAttackContextForDamage (with map) ─────────────────────

describe('buildAttackContextForDamage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(null);
        damageUtils.getTargetFromAttacker.mockReturnValue(null);
        damageUtils.getResistanceNotice.mockReturnValue(null);
        damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        mapsService.loadMapData.mockResolvedValue(null);
        npcsService.loadNPCs.mockResolvedValue([]);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        rangeValidation.rangeToFeet.mockReturnValue(0);
        rangeValidation.getDistanceFeet.mockReturnValue(5);
    });

    function makeAttackContext(overrides = {}) {
        return {
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            saveSuccess: 0,
            ...overrides,
        };
    }

    describe('with map', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
        const cs = { creatures: [{ name: 'Enemy' }] };

        function setupMapScenario(mapOverrides = {}) {
            const mapData = makeMapData(
                [attackerPlayer, targetPlayer],
                [{ type: 'npc', name: 'Enemy', gridX: 20, gridY: 25 }],
            );
            mapsService.loadMapData.mockResolvedValue({ ...mapData, ...mapOverrides });
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
        }

        it('loads map data and NPCs when mapName is provided', async () => {
            setupMapScenario();

            await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, mapName);
            expect(npcsService.loadNPCs).toHaveBeenCalledWith(campaignName);
        });

        it('returns basic context when mapData is null', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
            expect(result.targetName).toBeUndefined();
            expect(result.resistanceNotice).toBeNull();
        });

        it('returns basic context when mapData has no players array', async () => {
            mapsService.loadMapData.mockResolvedValue({ placedItems: [] });

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when loadNPCs or loadMapData rejects', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer]));
            npcsService.loadNPCs.mockRejectedValue(new Error('Failed to load NPCs'));

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when loadMapData rejects', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map'));

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });
    });

    describe('map-based range effects', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
        const cs = { creatures: [{ name: 'Enemy' }] };

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, targetPlayer]));
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        });

        it('returns forcedMode disadvantage when range effect is disadvantage', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(50);
            rangeValidation.computeRangeEffect.mockReturnValue({
                mode: 'disadvantage',
                reason: 'Long range beyond half',
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Long range beyond half');
            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns isAutoMiss when range effect is miss', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(120);
            rangeValidation.computeRangeEffect.mockReturnValue({
                mode: 'miss',
                reason: 'Beyond maximum range',
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60/240 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.isAutoMiss).toBe(true);
            expect(result.rangeReason).toBe('Beyond maximum range');
        });

        it('applies melee proximity effect for ranged attacks without target position', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');

            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.computeMeleeProximityEffect.mockReturnValue({
                mode: 'disadvantage',
                reason: 'Threatened by nearby enemy',
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Threatened by nearby enemy');
        });

        it('returns isAutoMiss when cover is full', async () => {
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)
                .mockReturnValueOnce(0);
            rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });

            coverService.computeCover.mockReturnValue({
                level: 'full',
                acBonus: 0,
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.isAutoMiss).toBe(true);
            expect(result.coverReason).toBe('Target has full cover');
        });

        it('returns coverAcBonus and coverLevel for half cover', async () => {
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)
                .mockReturnValueOnce(0);
            rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });

            coverService.computeCover.mockReturnValue({
                level: 'half',
                acBonus: 2,
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.coverAcBonus).toBe(2);
            expect(result.coverLevel).toBe('half');
        });

        it('returns normal context when no range or cover effects apply', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(0);
            rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.forcedMode).toBeUndefined();
            expect(result.isAutoMiss).toBeUndefined();
            expect(result.coverAcBonus).toBeUndefined();
            expect(result.damageType).toBe('fire');
        });
    });

    describe('target position resolution', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
        const targetNpc = { name: 'Enemy', type: 'npc', gridX: 20, gridY: 25 };
        const cs = { creatures: [{ name: 'Enemy' }] };

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);
        });

        it('finds targetPos from targetPlayer in mapData.players', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, targetPlayer], [targetNpc]));
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('finds targetPos from nearest placed item when target not in players', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [targetNpc]));
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetNpc);
            rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
        });

        it('handles targetPlayer without gridX/gridY gracefully', async () => {
            const targetNoGrid = { name: 'Enemy' };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, targetNoGrid]));
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetNoGrid);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
        });

        it('handles attackerPlayer not found in mapData', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([{ name: 'OtherPlayer', gridX: 1, gridY: 1 }]));
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });
    });

    describe('Nature Sanctuary resistance', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetName = 'Goblin';

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: targetName });
            damageUtils.getResistanceNotice.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            npcsService.loadNPCs.mockResolvedValue([]);
        });

        function makeSanctuaryScenario(targetInList = true, resistanceType = 'fire') {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer]));
            rangeValidation.rangeToFeet.mockReturnValue(0);
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

            if (targetInList) {
                runtimeState.getRuntimeValue
                    .mockReturnValueOnce(['Goblin'])
                    .mockReturnValueOnce(resistanceType);
            } else {
                runtimeState.getRuntimeValue.mockReturnValue(null);
            }
        }

        it('adds resistance notice when target is in sanctuary creature list and damage matches', async () => {
            makeSanctuaryScenario(true, 'fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });

        it('does not add resistance when target is not in sanctuary creature list', async () => {
            makeSanctuaryScenario(false, 'fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not add resistance when sanctuary is not active', async () => {
            makeSanctuaryScenario(false, 'fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not add resistance when damage type does not match sanctuary resistance', async () => {
            makeSanctuaryScenario(true, 'cold');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not override existing resistance notice', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: 'Goblin',
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Goblin resists fire');

            makeSanctuaryScenario(true, 'fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe('Goblin resists fire');
        });

        it('matches sanctuary resistance case-insensitively', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer]));
            rangeValidation.rangeToFeet.mockReturnValue(0);
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(['Goblin'])
                .mockReturnValueOnce('Fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });
    });

    describe('nearbyThreats computation for melee proximity', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const cs = { creatures: [{ name: 'Enemy' }] };

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');
            damageUtils.getResistanceNotice.mockReturnValue(null);
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
            rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'normal' });
            rangeValidation.getDistanceFeet.mockReturnValue(10);
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer]));
            npcsService.loadNPCs.mockResolvedValue([]);
        });

        it('computes nearbyThreats from placedItems NPCs with hostile attitude', async () => {
            const hostileNpc = { type: 'npc', name: 'Thug', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [hostileNpc]));
            npcsService.loadNPCs.mockResolvedValue([{ name: 'Thug', attitude: 'negative' }]);

            rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Flanked' });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Flanked');
        });

        it('filters out non-NPC placed items', async () => {
            const nonNpcItem = { type: 'furniture', name: 'Table', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [nonNpcItem]));
            npcsService.loadNPCs.mockResolvedValue([]);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('filters out friendly NPCs (positive attitude)', async () => {
            const friendlyNpc = { type: 'npc', name: 'Ally', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [friendlyNpc]));
            npcsService.loadNPCs.mockResolvedValue([{ name: 'Ally', attitude: 'positive' }]);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('matches NPC by name with number suffix replacement', async () => {
            const npcWithNumber = { type: 'npc', name: 'Goblin 2', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [npcWithNumber]));
            npcsService.loadNPCs.mockResolvedValue([{ name: 'Goblin', attitude: 'negative' }]);

            rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Flanked' });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.forcedMode).toBe('disadvantage');
        });

        it('skips NPCs not found in npcs service', async () => {
            const orphanNpc = { type: 'npc', name: 'Mystery', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [orphanNpc]));
            npcsService.loadNPCs.mockResolvedValue([]);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
        });

        it('handles empty placedItems array', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], []));
            npcsService.loadNPCs.mockResolvedValue([]);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
        });
    });

    describe('map data edge cases', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
        const cs = { creatures: [{ name: 'Enemy' }] };

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
            damageUtils.getResistanceNotice.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);
            rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, targetPlayer]));
            npcsService.loadNPCs.mockResolvedValue([]);
        });

        it('handles mapData without walls property', async () => {
            mapsService.loadMapData.mockResolvedValue({
                players: [attackerPlayer, targetPlayer],
                placedItems: [],
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('handles mapData without placedItems property', async () => {
            mapsService.loadMapData.mockResolvedValue({
                players: [attackerPlayer, targetPlayer],
                walls: new Set(),
            });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
        });

        it('handles combat context returning null inside map block', async () => {
            damageUtils.getCombatContext
                .mockResolvedValueOnce(cs)
                .mockResolvedValueOnce(null);

            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, targetPlayer]));

            const result = await buildAttackContextForDamage(
                makeAttackContext(),
                playerName, campaignName, mapName,
            );

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });
    });
});
