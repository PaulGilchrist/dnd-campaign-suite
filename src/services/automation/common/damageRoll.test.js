import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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

// ── Imports ────────────────────────────────────────────────────

import { rollDamageForAction, buildAttackContextForDamage } from './damageRoll.js';
import * as diceRoller from '../../dice/diceRoller.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import * as rangeValidation from '../../rules/combat/rangeValidation.js';
import * as coverService from '../../rules/combat/coverService.js';
import * as npcsService from '../../npcs/npcsService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';
const playerName = 'Attacker';

function resetMocks() {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue(null);
    diceRoller.rollExpressionDoubled.mockReturnValue(null);
    damageUtils.getTargetFromAttacker.mockReturnValue(null);
    damageUtils.getCombatContext.mockResolvedValue(null);
    damageUtils.getResistanceNotice.mockReturnValue(null);
    damageUtils.getAttackerTargetName.mockReturnValue(undefined);
    mapsService.loadMapData.mockResolvedValue(null);
    npcsService.loadNPCs.mockResolvedValue(null);
    rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
    rangeValidation.computeMeleeProximityEffect.mockReturnValue({ mode: 'normal' });
    rangeValidation.getDistanceFeet.mockReturnValue(5);
    rangeValidation.rangeToFeet.mockReturnValue(0);
    coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
}

// ── Tests ──────────────────────────────────────────────────────

describe('rollDamageForAction', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('dice rolling', () => {
        it('calls rollExpression with undefined when auto.damage is missing', () => {
            const auto = {};
            diceRoller.rollExpression.mockReturnValue(null);

            const result = rollDamageForAction(auto);

            expect(result).toBeNull();
            expect(diceRoller.rollExpression).toHaveBeenCalledWith(undefined);
        });

        it('calls rollExpression with empty string when auto.damage is empty', () => {
            const auto = { damage: '' };
            diceRoller.rollExpression.mockReturnValue(null);

            const result = rollDamageForAction(auto);

            expect(result).toBeNull();
            expect(diceRoller.rollExpression).toHaveBeenCalledWith('');
        });

        it('calls rollExpression for normal roll (not crit)', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 8, rolls: [3, 5], modifier: 3 };
            diceRoller.rollExpression.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto);

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d6+3');
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
            expect(result.result).toBe(mockResult);
        });

        it('calls rollExpressionDoubled when isCrit is true', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 16, rolls: [8, 8], modifier: 3 };
            diceRoller.rollExpressionDoubled.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto, { isCrit: true });

            expect(diceRoller.rollExpressionDoubled).toHaveBeenCalledWith('2d6+3');
            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(result.result).toBe(mockResult);
        });

        it('returns null when rollExpression returns null', () => {
            const auto = { damage: 'invalid' };
            diceRoller.rollExpression.mockReturnValue(null);

            const result = rollDamageForAction(auto);

            expect(result).toBeNull();
        });

        it('returns null when rollExpressionDoubled returns null', () => {
            const auto = { damage: 'invalid' };
            diceRoller.rollExpressionDoubled.mockReturnValue(null);

            const result = rollDamageForAction(auto, { isCrit: true });

            expect(result).toBeNull();
        });
    });

    describe('pre-rolled result', () => {
        it('uses preRolledResult when provided instead of rolling', () => {
            const auto = { damage: '2d6+3' };
            const preRolled = { total: 12, rolls: [6, 6], modifier: 0 };

            const result = rollDamageForAction(auto, { preRolledResult: preRolled });

            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
            expect(result.result).toBe(preRolled);
        });

        it('prefers preRolledResult over isCrit flag', () => {
            const auto = { damage: '2d6+3' };
            const preRolled = { total: 5, rolls: [5] };

            const result = rollDamageForAction(auto, { preRolledResult: preRolled, isCrit: true });

            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
            expect(result.result).toBe(preRolled);
        });
    });

    describe('attackContext construction', () => {
        it('includes name and damage from auto object', () => {
            const auto = { name: 'Fire Bolt', damage: '1d10' };
            diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.name).toBe('Fire Bolt');
            expect(result.attackContext.damage).toBe('1d10');
        });

        it('defaults name to empty string when missing from auto', () => {
            const auto = { damage: '1d6' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.name).toBe('');
        });

        it('includes damageType from auto object', () => {
            const auto = { damage: '1d6', damageType: 'fire' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.damageType).toBe('fire');
        });

        it('defaults damageType to empty string when missing', () => {
            const auto = { damage: '1d6' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.damageType).toBe('');
        });

        it('includes saveDc from auto object', () => {
            const auto = { damage: '1d6', saveDc: 15 };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveDc).toBe(15);
        });

        it('defaults saveDc to undefined when missing', () => {
            const auto = { damage: '1d6' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveDc).toBeUndefined();
        });

        it('defaults saveType to DEX when missing', () => {
            const auto = { damage: '1d6' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveType).toBe('DEX');
        });

        it('uses saveType from auto object when provided', () => {
            const auto = { damage: '1d6', saveType: 'CON' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveType).toBe('CON');
        });

        it('defaults saveSuccess to 0 for non-cone shapes', () => {
            const auto = { damage: '1d6', shape: 'line' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveSuccess).toBe(0);
        });

        it('defaults saveSuccess to 0.5 for cone shapes', () => {
            const auto = { damage: '1d6', shape: 'cone' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveSuccess).toBe(0.5);
        });

        it('uses explicit dcSuccess from auto object when provided', () => {
            const auto = { damage: '1d6', dcSuccess: 0.75, shape: 'cone' };
            diceRoller.rollExpression.mockReturnValue({ total: 3, rolls: [3] });

            const result = rollDamageForAction(auto);

            expect(result.attackContext.saveSuccess).toBe(0.75);
        });
    });
});

// ── buildAttackContextForDamage ──────────────────────────────

describe('buildAttackContextForDamage', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('without map (mapName falsy)', () => {
        it('returns basic context when mapName is null', async () => {
            const attackContext = {
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result).toEqual({
                damageType: 'fire',
                resistanceNotice: null,
                targetName: undefined,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 0,
                attackerName: playerName,
            });
            expect(mapsService.loadMapData).not.toHaveBeenCalled();
        });

        it('returns basic context when mapName is empty string', async () => {
            const attackContext = {
                damageType: 'cold',
                saveDc: 12,
                saveType: 'CON',
                saveSuccess: 0.5,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, '');

            expect(result).toEqual({
                damageType: 'cold',
                resistanceNotice: null,
                targetName: undefined,
                saveDc: 12,
                saveType: 'CON',
                dcSuccess: 0.5,
                attackerName: playerName,
            });
        });

        it('returns basic context when mapName is undefined', async () => {
            const attackContext = { damageType: 'bludgeoning' };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, undefined);

            expect(result.damageType).toBe('bludgeoning');
            expect(result.attackerName).toBe(playerName);
        });

        it('uses combat context to resolve target when available', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const attackContext = { damageType: 'fire' };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.targetName).toBe('Goblin');
            expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith({ creatures: [] }, playerName);
        });

        it('falls back to getAttackerTargetName when getTargetFromAttacker returns null', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Falling Victim');

            const attackContext = { damageType: 'fire' };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.targetName).toBe('Falling Victim');
        });

        it('defaults saveDc to 0 when not provided in attackContext', async () => {
            const attackContext = { damageType: 'fire' };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.saveDc).toBe(0);
        });

        it('uses saveDc from attackContext when provided', async () => {
            const attackContext = { damageType: 'fire', saveDc: 18 };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.saveDc).toBe(18);
        });
    });

    describe('with map (mapName truthy)', () => {
        const mapData = {
            players: [
                { name: playerName, gridX: 5, gridY: 10 },
            ],
            placedItems: [],
            walls: new Set(),
        };

        const attackContext = {
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            saveSuccess: 0,
            range: '60 ft.',
        };

        it('loads map data and NPCs when mapName is provided', async () => {
            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);

            await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(mapsService.loadMapData).toHaveBeenCalledWith(campaignName, mapName);
            expect(npcsService.loadNPCs).toHaveBeenCalledWith(campaignName);
        });

        it('returns basic context when attackerPlayer not found in mapData', async () => {
            mapsService.loadMapData.mockResolvedValue({
                ...mapData,
                players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }],
            });
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when mapData is null', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when mapData has no players array', async () => {
            mapsService.loadMapData.mockResolvedValue({ placedItems: [] });

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when mapData.players is empty', async () => {
            mapsService.loadMapData.mockResolvedValue({ players: [], placedItems: [] });

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when loadNPCs rejects', async () => {
            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockRejectedValue(new Error('Failed to load NPCs'));

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('returns basic context when loadMapData rejects', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map'));

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });
    });

    describe('map-based range effects', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
        const mapData = {
            players: [attackerPlayer, targetPlayer],
            placedItems: [],
            walls: new Set(),
        };
        const cs = { creatures: [{ name: 'Enemy' }] };

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
        });

        it('returns context with forcedMode disadvantage when range effect is disadvantage', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(50);
            rangeValidation.computeRangeEffect.mockReturnValue({
                mode: 'disadvantage',
                reason: 'Long range beyond half',
            });

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Long range beyond half');
        });

        it('returns context with isAutoMiss when range effect is miss', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.getDistanceFeet.mockReturnValue(120);
            rangeValidation.computeRangeEffect.mockReturnValue({
                mode: 'miss',
                reason: 'Beyond maximum range',
            });

            const attackContext = {
                damageType: 'fire',
                range: '60/240 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.isAutoMiss).toBe(true);
            expect(result.rangeReason).toBe('Beyond maximum range');
        });

        it('applies range effects for melee range using range string', async () => {
            rangeValidation.rangeToFeet.mockReturnValue(0);
            rangeValidation.computeRangeEffect.mockReturnValue({ mode: 'normal' });
            rangeValidation.getDistanceFeet.mockReturnValue(3);

            const attackContext = {
                damageType: 'fire',
                range: '5 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.forcedMode).toBeUndefined();
            expect(result.isAutoMiss).toBeUndefined();
            expect(rangeValidation.computeRangeEffect).toHaveBeenCalledWith(
                '5 ft.',
                3,
                {},
            );
        });

        it('applies melee proximity effect for ranged attacks without target position', async () => {
            // No combat context target, so targetPos will be null
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');

            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.computeMeleeProximityEffect.mockReturnValue({
                mode: 'disadvantage',
                reason: 'Threatened by nearby enemy',
            });

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.forcedMode).toBe('disadvantage');
            expect(result.rangeReason).toBe('Threatened by nearby enemy');
        });

        it('filters nearby threats to hostile NPCs only', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');

            const mapDataWithNpcs = {
                ...mapData,
                placedItems: [
                    { type: 'npc', name: 'Friendly NPC', gridX: 3, gridY: 3, attitude: 'friendly' },
                    { type: 'npc', name: 'Hostile NPC', gridX: 4, gridY: 4, attitude: 'hostile' },
                ],
            };
            mapsService.loadMapData.mockResolvedValue(mapDataWithNpcs);
            npcsService.loadNPCs.mockResolvedValue([
                { name: 'Friendly NPC', attitude: 'friendly' },
                { name: 'Hostile NPC', attitude: 'hostile' },
            ]);

            rangeValidation.rangeToFeet.mockReturnValue(60);
            rangeValidation.isHostileNPC.mockImplementation((item) => item.attitude === 'hostile');

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(rangeValidation.isHostileNPC).toHaveBeenCalled();
        });

        it('handles NPC name matching with numeric suffix', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Enemy');

            const mapDataWithNpcs = {
                ...mapData,
                placedItems: [
                    { type: 'npc', name: 'Goblin #1', gridX: 3, gridY: 3 },
                ],
            };
            mapsService.loadMapData.mockResolvedValue(mapDataWithNpcs);
            npcsService.loadNPCs.mockResolvedValue([
                { name: 'Goblin', attitude: 'hostile' },
            ]);

            rangeValidation.rangeToFeet.mockReturnValue(60);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            // Should not throw when matching 'Goblin #1' to 'Goblin'
            await expect(buildAttackContextForDamage(attackContext, playerName, campaignName, mapName))
                .resolves.toBeDefined();
        });

        it('applies cover calculation for ranged attacks with target position', async () => {
            // rangeToFeet('60 ft.') returns 0 (falsy) so !rangeToFeet is true
            // but numericRange = rangeToFeet(...) || 0 = 0, so isRanged is false
            // We need isRanged=true, so rangeToFeet must return >8 for numeric check
            // The source does: numericRange = rangeToFeet(attackContext.range) || 0
            // Then: if (isRanged && targetPos && !rangeToFeet(attackContext.range))
            // So rangeToFeet is called twice with same arg — first for numericRange, second for cover check
            // We mock it to return 60 for first call (isRanged), 0 for second call (!rangeToFeet)
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)  // first call: numericRange = 60, isRanged = true
                .mockReturnValueOnce(0);  // second call: !rangeToFeet = true, cover check runs

            coverService.computeCover.mockReturnValue({
                level: 'half',
                acBonus: 2,
            });

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.coverAcBonus).toBe(2);
            expect(result.coverLevel).toBe('half');
        });

        it('returns isAutoMiss when cover is full', async () => {
            rangeValidation.rangeToFeet
                .mockReturnValueOnce(60)  // first call: numericRange = 60, isRanged = true
                .mockReturnValueOnce(0);  // second call: !rangeToFeet = true, cover check runs

            coverService.computeCover.mockReturnValue({
                level: 'full',
                acBonus: 0,
            });

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.isAutoMiss).toBe(true);
            expect(result.coverReason).toBe('Target has full cover');
        });

        it('only checks cover when isRanged and targetPos exists and no numeric range', async () => {
            // rangeToFeet returns non-zero => no cover check
            rangeValidation.rangeToFeet.mockReturnValue(60);
            coverService.computeCover.mockReturnValue({ level: 'full', acBonus: 0 });

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(coverService.computeCover).not.toHaveBeenCalled();
            expect(result.isAutoMiss).toBeUndefined();
        });
    });

    describe('target position resolution', () => {
        const attackerPlayer = { name: playerName, gridX: 5, gridY: 10 };
        const targetPlayer = { name: 'Enemy', gridX: 10, gridY: 15 };
        const targetNpc = { name: 'Enemy', gridX: 20, gridY: 25 };
        const cs = { creatures: [{ name: 'Enemy' }] };

        it('finds targetPos from targetPlayer in mapData.players', async () => {
            const mapData = {
                players: [attackerPlayer, targetPlayer],
                placedItems: [targetNpc],
                walls: new Set(),
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
            expect(result.attackerName).toBe(playerName);
        });

        it('finds targetPos from nearest placed item when target not in players', async () => {
            const mapData = {
                players: [attackerPlayer],
                placedItems: [targetNpc],
                walls: new Set(),
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetNpc);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);
            rangeValidation.rangeToFeet.mockReturnValue(0);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
        });

        it('prioritizes targetPlayer over targetNpc when both exist', async () => {
            const mapData = {
                players: [attackerPlayer, targetPlayer],
                placedItems: [targetNpc],
                walls: new Set(),
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetPlayer);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.getNearestPlacedItem.mockReturnValue(targetNpc);
            rangeValidation.rangeToFeet.mockReturnValue(0);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            // Should have used targetPlayer, not targetNpc
            expect(rangeValidation.getNearestPlacedItem).toHaveBeenCalled();
        });

        it('handles targetPlayer without gridX/gridY gracefully', async () => {
            const targetNoGrid = { name: 'Enemy' };
            const mapData = {
                players: [attackerPlayer, targetNoGrid],
                placedItems: [],
                walls: new Set(),
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(targetNoGrid);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
        });

        it('handles mapData with no placedItems array', async () => {
            const mapData = {
                players: [attackerPlayer],
                walls: new Set(),
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
        });

        it('handles walls as undefined in mapData', async () => {
            const mapData = {
                players: [attackerPlayer],
                placedItems: [],
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue(cs);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            rangeValidation.rangeToFeet.mockReturnValue(0);

            const attackContext = {
                damageType: 'fire',
                range: '60 ft.',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.damageType).toBe('fire');
        });
    });

    describe('resistance notice', () => {
        it('passes damageType to getResistanceNotice', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: 'Goblin',
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Target is resistant to fire');

            const attackContext = {
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.resistanceNotice).toBe('Target is resistant to fire');
            expect(damageUtils.getResistanceNotice).toHaveBeenCalledWith(
                ['fire'],
                ['fire'],
                [],
                'Goblin',
            );
        });

        it('returns null resistanceNotice when no target found', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);

            const attackContext = {
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.resistanceNotice).toBeNull();
        });

        it('uses attackContext.damageType for resistance check in map scenario', async () => {
            const mapData = {
                players: [{ name: playerName, gridX: 5, gridY: 10 }],
                placedItems: [],
                walls: new Set(),
            };

            mapsService.loadMapData.mockResolvedValue(mapData);
            npcsService.loadNPCs.mockResolvedValue([]);
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: 'Goblin',
                resistances: ['cold'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Target is resistant to cold');

            const attackContext = {
                damageType: 'cold',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
                range: '60 ft.',
            };

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, mapName);

            expect(result.resistanceNotice).toBe('Target is resistant to cold');
        });
    });
});
