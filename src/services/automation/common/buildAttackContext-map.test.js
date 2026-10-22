// @maintained-by-ai
// Map-present branch of buildAttackContextForDamage.
// The map-absent branch is covered by buildAttackContext-noMap.test.js.
//
// Envelope honesty (#1181): loadNPCs resolves the REAL wire envelope
// { npcs: [...] } (GET /api/campaigns/:campaign/npcs, jsonEntityCrud.js:49
// responseWrapper) — bare-array mocks hid the envelope-vs-array TypeError
// in damageRoll.js collectHostileThreats.
// Teardown hygiene (#1181): this lane stubs NO global fetch (all transport
// is vi.mock'd above) — no afterEach vi.unstubAllGlobals pairing needed.

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

const attackerPos = { gridX: 5, gridY: 10 };
const attackerPlayer = { name: playerName, ...attackerPos };
const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
const cs = { creatures: [{ name: 'Enemy' }] };

function makeMapData(players = [attackerPlayer, targetPlayer], placedItems = []) {
    return { players, placedItems, walls: new Set() };
}

function makeAttackContext(overrides = {}) {
    return {
        damageType: 'fire',
        saveDc: 15,
        saveType: 'DEX',
        saveSuccess: 0,
        ...overrides,
    };
}

// ── buildAttackContextForDamage (map present) ──────────────────

describe('buildAttackContextForDamage (map present)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageUtils.getCombatContext.mockResolvedValue(cs);
        damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
        damageUtils.getResistanceNotice.mockReturnValue(null);
        damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        mapsService.loadMapData.mockResolvedValue(makeMapData());
        // Real wire envelope from GET /api/campaigns/:campaign/npcs (jsonEntityCrud.js:49) (#1181).
        npcsService.loadNPCs.mockResolvedValue({ npcs: [] });
        runtimeState.getRuntimeValue.mockReturnValue(null);
        rangeValidation.rangeToFeet.mockReturnValue(0);
        rangeValidation.getDistanceFeet.mockReturnValue(5);
        rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
        rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'normal' });
        rangeValidation.getNearestPlacedItem.mockReturnValue(null);
        rangeValidation.isHostileNPC.mockImplementation(npc => npc.attitude === 'negative');
        coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
    });

    describe('map loading and fallbacks', () => {
        it('loads map data and NPCs for the campaign', async () => {
            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, mapName);
            expect(npcsService.loadNPCs).toHaveBeenCalledWith(campaignName);
            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
            expect(result.targetName).toBe('Enemy');
        });

        it('returns base context when the attacker cannot be located on the map', async () => {
            const incompleteMaps = [
                null,
                { placedItems: [] },
                makeMapData([{ name: 'OtherPlayer', gridX: 1, gridY: 1 }]),
            ];

            for (const mapData of incompleteMaps) {
                mapsService.loadMapData.mockResolvedValue(mapData);

                const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

                expect(result.damageType).toBe('fire');
                expect(result.attackerName).toBe(playerName);
                expect(result.targetName).toBe('Enemy');
                expect(result.forcedMode).toBeUndefined();
                expect(result.isAutoMiss).toBeUndefined();
                expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
            }
        });

        it('returns base context when map or NPC loading rejects', async () => {
            npcsService.loadNPCs.mockRejectedValue(new Error('Failed to load NPCs'));

            let result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
            expect(result.targetName).toBe('Enemy');

            npcsService.loadNPCs.mockResolvedValue({ npcs: [] });
            mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map'));

            result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('skips distance checks when combat context disappears during target resolution', async () => {
            damageUtils.getCombatContext
                .mockResolvedValueOnce(cs)
                .mockResolvedValueOnce(null);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.targetName).toBe('Enemy');
            expect(rangeValidation.getDistanceFeet).not.toHaveBeenCalled();
        });
    });

    describe('range effects', () => {
        it('forces disadvantage when the range effect is disadvantage', async () => {
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
            expect(rangeValidation.computeMeleeProximityEffect).not.toHaveBeenCalled();
            expect(coverService.computeCover).not.toHaveBeenCalled();
        });

        it('marks auto-miss when beyond maximum range', async () => {
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

        it('applies melee proximity disadvantage for ranged attacks without target position', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            mapsService.loadMapData.mockResolvedValue({ players: [attackerPlayer] });
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
            // Missing placedItems must fall back to an empty threat list.
            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(true, attackerPlayer, [], {});
        });

        it('marks auto-miss on full cover, defaulting missing walls and placedItems', async () => {
            mapsService.loadMapData.mockResolvedValue({ players: [attackerPlayer, targetPlayer] });
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)
                .mockReturnValueOnce(0);
            coverService.computeCover.mockReturnValue({ level: 'full', acBonus: 0 });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.isAutoMiss).toBe(true);
            expect(result.coverReason).toBe('Target has full cover');
            expect(coverService.computeCover).toHaveBeenCalledWith(
                attackerPos,
                { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY },
                new Set(),
                [],
            );
        });

        it('applies cover AC bonus for half cover', async () => {
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)
                .mockReturnValueOnce(0);
            coverService.computeCover.mockReturnValue({ level: 'half', acBonus: 2 });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(result.coverAcBonus).toBe(2);
            expect(result.coverLevel).toBe('half');
        });

        it('returns unmodified context when no range or cover effects apply', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(20);

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
        it('resolves target position from the players list on the map', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);

            await buildAttackContextForDamage(makeAttackContext({ range: '60 ft.' }), playerName, campaignName, mapName);

            expect(rangeValidation.getDistanceFeet).toHaveBeenCalledWith(attackerPos, { gridX: 10, gridY: 15 });
            expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
        });

        it('falls back to the nearest placed item when the target is not a player token', async () => {
            const targetNpc = { name: 'Enemy', type: 'npc', gridX: 20, gridY: 25 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [targetNpc]));
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });
            rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);

            const result = await buildAttackContextForDamage(makeAttackContext(), playerName, campaignName, mapName);

            expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalledWith([targetNpc], 'Enemy', attackerPos);
            expect(rangeValidation.getDistanceFeet).toHaveBeenCalledWith(attackerPos, { gridX: 20, gridY: 25 });
            expect(result.targetName).toBe('Enemy');
        });
    });

    describe("Nature's Sanctuary resistance", () => {
        const targetName = 'Goblin';

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: targetName });
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer]));
        });

        function mockSanctuary(creatures, resistance) {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(creatures)
                .mockReturnValueOnce(resistance);
        }

        it('adds resistance notice when target is in sanctuary list and damage matches', async () => {
            mockSanctuary(['Goblin'], 'fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });

        it('does not add resistance when target is not in the sanctuary creature list', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(['Ogre']);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not add resistance when the sanctuary resistance type is unset', async () => {
            mockSanctuary(['Goblin'], null);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not add resistance when damage type does not match sanctuary resistance', async () => {
            mockSanctuary(['Goblin'], 'cold');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not consult sanctuary when a resistance notice already exists', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: targetName,
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Goblin resists fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe('Goblin resists fire');
            expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
        });

        it('matches sanctuary resistance case-insensitively', async () => {
            mockSanctuary(['Goblin'], 'Fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });
    });

    describe('hostile threat collection for melee proximity', () => {
        beforeEach(() => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');
            rangeValidation.rangeToFeet.mockReturnValue(60);
        });

        it('collects hostile NPCs with attitude mapped from the NPC service', async () => {
            const thug = { type: 'npc', name: 'Thug', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [thug]));
            // ENVELOPE-FIXTURE pin (#1181): GET /npcs resolves { npcs:[...] }
            // (jsonEntityCrud.js:49) — collectHostileThreats must unwrap, not .find the envelope.
            npcsService.loadNPCs.mockResolvedValue({ npcs: [{ name: 'Thug', attitude: 'negative' }] });
            rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Flanked' });

            const result = await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(true, attackerPlayer, [{ gridX: 6, gridY: 11, name: 'Thug' }], {});
            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Flanked');
        });

        it('excludes non-NPC items, friendly NPCs, and NPCs unknown to the NPC service', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [
                { type: 'furniture', name: 'Table', gridX: 6, gridY: 11 },
                { type: 'npc', name: 'Ally', gridX: 7, gridY: 12 },
                { type: 'npc', name: 'Mystery', gridX: 8, gridY: 13 },
            ]));
            npcsService.loadNPCs.mockResolvedValue({ npcs: [{ name: 'Ally', attitude: 'positive' }] });

            await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(true, attackerPlayer, [], {});
        });

        it('matches placed NPCs with numeric suffixes to base NPC names', async () => {
            const goblin2 = { type: 'npc', name: 'Goblin 2', gridX: 6, gridY: 11 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [goblin2]));
            // ENVELOPE-FIXTURE pin (#1181): unwrapped lookup must still match the numeric suffix.
            npcsService.loadNPCs.mockResolvedValue({ npcs: [{ name: 'Goblin', attitude: 'negative' }] });

            await buildAttackContextForDamage(
                makeAttackContext({ range: '60 ft.' }),
                playerName, campaignName, mapName,
            );

            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(true, attackerPlayer, [{ gridX: 6, gridY: 11, name: 'Goblin 2' }], {});
        });
    });
});
