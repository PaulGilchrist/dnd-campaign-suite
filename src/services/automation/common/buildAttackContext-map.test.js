// @maintained-by-ai 2026-11-27
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

// isHostileNPC stays REAL (rangeValidation.js:197-202: null attitude is
// hostile, 'extreme opposition' counts too) so the threat-filter tests pin
// production semantics, not a drifted mock.
vi.mock('../../rules/combat/rangeValidation.js', async (importOriginal) => ({
    ...(await importOriginal()),
    computeRangeEffect: vi.fn(),
    computeMeleeProximityEffect: vi.fn(),
    getDistanceFeet: vi.fn(),
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

async function build(overrides = {}) {
    return buildAttackContextForDamage(makeAttackContext(overrides), playerName, campaignName, mapName);
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
        coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
    });

    describe('map loading and fallbacks', () => {
        it('loads map data and NPCs for the campaign', async () => {
            const result = await build();

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

                const result = await build();

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

            let result = await build();

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
            expect(result.targetName).toBe('Enemy');

            npcsService.loadNPCs.mockResolvedValue({ npcs: [] });
            mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map'));

            result = await build();

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });
    });

    describe('range and cover effects', () => {
        it('forces disadvantage when the range effect is disadvantage', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(50);
            rangeValidation.computeRangeEffect.mockReturnValue({
                mode: 'disadvantage',
                reason: 'Long range beyond half',
            });

            const result = await build({ range: '60 ft.' });

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

            const result = await build({ range: '60/240 ft.' });

            expect(result.isAutoMiss).toBe(true);
            expect(result.rangeReason).toBe('Beyond maximum range');
            expect(result.coverAcBonus).toBeUndefined();
        });

        it('applies melee proximity disadvantage for ranged attacks without target position', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            mapsService.loadMapData.mockResolvedValue({ players: [attackerPlayer] });
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.computeMeleeProximityEffect.mockReturnValue({
                mode: 'disadvantage',
                reason: 'Threatened by nearby enemy',
            });

            const result = await build({ range: '60 ft.' });

            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Threatened by nearby enemy');
            // Missing placedItems must fall back to an empty threat list.
            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(true, attackerPlayer, [], {});
        });

        // NOTE: damageRoll.js:96 re-calls rangeToFeet(attackContext.range) and
        // requires it FALSY to enter the cover lane — with the real rangeToFeet
        // that is unreachable for any ranged attack (isRanged implies > 8).
        // Reported as a source defect; these two tests pin the unit behaviour of
        // computeCoverAdjustment via the double-call mock sequence.
        it('marks auto-miss on full cover, defaulting missing walls and placedItems', async () => {
            mapsService.loadMapData.mockResolvedValue({ players: [attackerPlayer, targetPlayer] });
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)
                .mockReturnValueOnce(0);
            coverService.computeCover.mockReturnValue({ level: 'full', acBonus: 0 });

            const result = await build({ range: '60 ft.' });

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

            const result = await build({ range: '60 ft.' });

            expect(result.coverAcBonus).toBe(2);
            expect(result.coverLevel).toBe('half');
        });

        it('measures distance to the target player token and returns base context when nothing applies', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(20);

            const result = await build({ range: '60 ft.' });

            // Target position resolves from the players list, not placed items.
            expect(rangeValidation.getDistanceFeet).toHaveBeenCalledWith(attackerPos, { gridX: 10, gridY: 15 });
            expect(rangeValidation.getNearestPlacedItem).not.toHaveBeenCalled();
            expect(result.forcedMode).toBeUndefined();
            expect(result.isAutoMiss).toBeUndefined();
            expect(result.coverAcBonus).toBeUndefined();
            expect(result.damageType).toBe('fire');
        });
    });

    describe('target position resolution', () => {
        it('falls back to the nearest placed item when the target is not a player token', async () => {
            const targetNpc = { name: 'Enemy', type: 'npc', gridX: 20, gridY: 25 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [targetNpc]));
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Enemy' });
            rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);

            const result = await build();

            expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalledWith([targetNpc], 'Enemy', attackerPos);
            expect(rangeValidation.getDistanceFeet).toHaveBeenCalledWith(attackerPos, { gridX: 20, gridY: 25 });
            expect(result.targetName).toBe('Enemy');
        });
    });

    describe("Nature's Sanctuary resistance", () => {
        // Full branch table lives here (shared pre-branch code; the no-map file
        // only pins one pass-through case).
        const targetName = 'Goblin';

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: targetName });
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer]));
        });

        function mockSanctuary(creatures, resistance) {
            runtimeState.getRuntimeValue.mockImplementation((p, key) =>
                key === 'naturesSanctuaryCreatures' ? creatures : resistance);
        }

        it('adds resistance notice when target is in the sanctuary list and damage matches case-insensitively', async () => {
            mockSanctuary(['Goblin'], 'Fire');

            const result = await build({ damageType: 'fire' });

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });

        it('adds no notice when the target is outside the list, resistance is unset, or the type differs', async () => {
            const noMatchCases = [
                [['Ogre'], 'fire', 'target not in the sanctuary creature list'],
                [['Goblin'], null, 'sanctuary resistance type unset'],
                [['Goblin'], 'cold', 'damage type mismatch'],
            ];

            for (const [creatures, resistance, why] of noMatchCases) {
                mockSanctuary(creatures, resistance);

                const result = await build({ damageType: 'fire' });

                expect(result.resistanceNotice, why).toBeNull();
            }
        });

        it('does not consult sanctuary when a resistance notice already exists', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: targetName,
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Goblin resists fire');

            const result = await build({ damageType: 'fire' });

            expect(result.resistanceNotice).toBe('Goblin resists fire');
            expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('hostile threat collection for melee proximity', () => {
        beforeEach(() => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');
            rangeValidation.rangeToFeet.mockReturnValue(60);
        });

        it('collects hostile NPCs, unwrapping the wire envelope and matching numeric-suffix names', async () => {
            const thug = { type: 'npc', name: 'Thug', gridX: 6, gridY: 11 };
            const goblin2 = { type: 'npc', name: 'Goblin 2', gridX: 7, gridY: 12 };
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [thug, goblin2]));
            // ENVELOPE-FIXTURE pin (#1181): GET /npcs resolves { npcs:[...] }
            // (jsonEntityCrud.js:49) — collectHostileThreats must unwrap, not
            // .find the envelope; the suffix-stripped lookup must still match.
            npcsService.loadNPCs.mockResolvedValue({
                npcs: [
                    { name: 'Thug', attitude: 'negative' },
                    { name: 'Goblin', attitude: 'negative' },
                ],
            });
            rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Flanked' });

            const result = await build({ range: '60 ft.' });

            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(
                true,
                attackerPlayer,
                [
                    { gridX: 6, gridY: 11, name: 'Thug' },
                    { gridX: 7, gridY: 12, name: 'Goblin 2' },
                ],
                {},
            );
            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Flanked');
        });

        it('excludes non-NPC items and friendly NPCs, and counts service-unknown NPCs as hostile', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer], [
                { type: 'furniture', name: 'Table', gridX: 6, gridY: 11 },
                { type: 'npc', name: 'Ally', gridX: 7, gridY: 12 },
                { type: 'npc', name: 'Mystery', gridX: 8, gridY: 13 },
            ]));
            npcsService.loadNPCs.mockResolvedValue({ npcs: [{ name: 'Ally', attitude: 'positive' }] });

            // Real isHostileNPC treats null attitude as hostile, so 'Mystery'
            // (unknown to the NPC service) is a threat in production.
            await build({ range: '60 ft.' });

            expect(rangeValidation.computeMeleeProximityEffect).toHaveBeenCalledWith(
                true,
                attackerPlayer,
                [{ gridX: 8, gridY: 13, name: 'Mystery' }],
                {},
            );
        });
    });
});
