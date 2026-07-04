// @cleaned-by-ai
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

import { rollDamageForAction, buildAttackContextForDamage } from './damageRoll.js';
import * as diceRoller from '../../dice/diceRoller.js';
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

// ── rollDamageForAction ────────────────────────────────────────

describe('rollDamageForAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        diceRoller.rollExpression.mockReturnValue(null);
        diceRoller.rollExpressionDoubled.mockReturnValue(null);
    });

    describe('dice rolling', () => {
        it('rolls normal damage when isCrit is false', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 8, rolls: [3, 5], modifier: 3 };
            diceRoller.rollExpression.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto);

            expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d6+3');
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
            expect(result).toEqual({
                result: mockResult,
                attackContext: {
                    name: '',
                    damage: '2d6+3',
                    damageType: '',
                    saveDc: undefined,
                    saveType: 'DEX',
                    saveSuccess: 0,
                },
            });
        });

        it('rolls doubled damage when isCrit is true', () => {
            const auto = { damage: '2d6+3' };
            const mockResult = { total: 16, rolls: [8, 8], modifier: 3 };
            diceRoller.rollExpressionDoubled.mockReturnValue(mockResult);

            const result = rollDamageForAction(auto, { isCrit: true });

            expect(diceRoller.rollExpressionDoubled).toHaveBeenCalledWith('2d6+3');
            expect(diceRoller.rollExpression).not.toHaveBeenCalled();
            expect(result.result).toBe(mockResult);
            expect(result.attackContext.damage).toBe('2d6+3');
        });

        it('returns null when dice roll fails', () => {
            const auto = { damage: 'invalid' };
            diceRoller.rollExpression.mockReturnValue(null);

            const result = rollDamageForAction(auto);

            expect(result).toBeNull();
        });

        it('returns null when crit dice roll fails', () => {
            const auto = { damage: 'invalid' };
            diceRoller.rollExpressionDoubled.mockReturnValue(null);

            const result = rollDamageForAction(auto, { isCrit: true });

            expect(result).toBeNull();
        });
    });

    describe('pre-rolled result', () => {
        it('uses preRolledResult and skips dice rolling', () => {
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

            expect(result.result).toBe(preRolled);
            expect(diceRoller.rollExpressionDoubled).not.toHaveBeenCalled();
        });

        it('returns null when preRolledResult is null and dice roll fails', () => {
            const auto = { damage: '2d6+3' };
            diceRoller.rollExpression.mockReturnValue(null);

            const result = rollDamageForAction(auto, { preRolledResult: null });

            expect(result).toBeNull();
            expect(diceRoller.rollExpression).toHaveBeenCalled();
        });
    });

    describe('attackContext construction', () => {
        const baseRoll = { total: 5, rolls: [5] };

        beforeEach(() => {
            diceRoller.rollExpression.mockReturnValue(baseRoll);
        });

        it('builds full attackContext from auto object fields', () => {
            const auto = { name: 'Fire Bolt', damage: '1d10', damageType: 'fire', saveDc: 15, saveType: 'DEX' };
            const result = rollDamageForAction(auto);

            expect(result.attackContext).toEqual({
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                saveSuccess: 0,
            });
        });

        it('defaults saveType to DEX when not provided', () => {
            const auto = { damage: '1d6' };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveType).toBe('DEX');
        });

        it('uses saveType and dcSuccess from auto when provided', () => {
            const auto = { damage: '1d6', saveType: 'CON', dcSuccess: 0.75 };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveType).toBe('CON');
            expect(result.attackContext.saveSuccess).toBe(0.75);
        });

        it('defaults saveSuccess to 0.5 for cone shapes', () => {
            const auto = { damage: '1d6', shape: 'cone' };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveSuccess).toBe(0.5);
        });

        it('prefers dcSuccess over shape-derived saveSuccess', () => {
            const auto = { damage: '1d6', dcSuccess: 0, shape: 'cone' };
            const result = rollDamageForAction(auto);
            expect(result.attackContext.saveSuccess).toBe(0);
        });
    });
});

// ── buildAttackContextForDamage ────────────────────────────────

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

    describe('without map (mapName falsy)', () => {
        it('returns basic context with all expected fields', async () => {
            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.damageType).toBe('fire');
            expect(result.resistanceNotice).toBeNull();
            expect(result.targetName).toBeUndefined();
            expect(result.saveDc).toBe(15);
            expect(result.saveType).toBe('DEX');
            expect(result.dcSuccess).toBe(0);
            expect(result.attackerName).toBe(playerName);
            expect(mapsService.loadMapData).not.toHaveBeenCalled();
            expect(npcsService.loadNPCs).not.toHaveBeenCalled();
        });

        it('falls back saveDc to 0 when not provided', async () => {
            const attackContext = makeAttackContext({ saveDc: undefined });

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.saveDc).toBe(0);
        });

        it('resolves target from combat context', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.targetName).toBe('Goblin');
            expect(damageUtils.getTargetFromAttacker).toHaveBeenCalledWith({ creatures: [] }, playerName);
        });

        it('falls back to getAttackerTargetName when getTargetFromAttacker returns null', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue('Falling Victim');

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.targetName).toBe('Falling Victim');
        });

        it('returns null resistanceNotice when no target found', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);
            damageUtils.getTargetFromAttacker.mockReturnValue(null);

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.resistanceNotice).toBeNull();
        });

        it('includes resistanceNotice when target is resistant', async () => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue({
                name: 'Goblin',
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Target is resistant to fire');

            const attackContext = makeAttackContext();

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.resistanceNotice).toBe('Target is resistant to fire');
            expect(damageUtils.getResistanceNotice).toHaveBeenCalledWith(
                ['fire'],
                ['fire'],
                [],
                'Goblin',
            );
        });

        it('passes saveSuccess from attackContext to result.dcSuccess', async () => {
            const attackContext = makeAttackContext({ saveSuccess: 0.5 });

            const result = await buildAttackContextForDamage(attackContext, playerName, campaignName, null);

            expect(result.dcSuccess).toBe(0.5);
        });
    });

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
        const targetInCube = { name: 'Goblin', gridX: 6, gridY: 11 };
        const targetOutsideCube = { name: 'Goblin', gridX: 20, gridY: 20 };

        beforeEach(() => {
            damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
            damageUtils.getTargetFromAttacker.mockReturnValue(targetInCube);
            damageUtils.getResistanceNotice.mockReturnValue(null);
            damageUtils.getAttackerTargetName.mockReturnValue(undefined);
            npcsService.loadNPCs.mockResolvedValue([]);
        });

        function makeSanctuaryScenario(target, sanctuaryActive = true) {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, target]));
            rangeValidation.rangeToFeet.mockReturnValue(0);
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

            if (sanctuaryActive) {
                runtimeState.getRuntimeValue
                    .mockReturnValueOnce('true')
                    .mockReturnValueOnce('5')
                    .mockReturnValueOnce('10')
                    .mockReturnValueOnce('fire');
            } else {
                runtimeState.getRuntimeValue.mockReturnValue(null);
            }
        }

        it('adds resistance notice when target is in sanctuary cube and damage matches', async () => {
            makeSanctuaryScenario(targetInCube, true);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });

        it('does not add resistance when target is outside sanctuary cube', async () => {
            makeSanctuaryScenario(targetOutsideCube, true);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not add resistance when sanctuary is not active', async () => {
            makeSanctuaryScenario(targetInCube, false);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not add resistance when damage type does not match sanctuary resistance', async () => {
            makeSanctuaryScenario(targetInCube, true);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'cold' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBeNull();
        });

        it('does not override existing resistance notice', async () => {
            damageUtils.getTargetFromAttacker.mockReturnValue({
                ...targetInCube,
                resistances: ['fire'],
                immunities: [],
            });
            damageUtils.getResistanceNotice.mockReturnValue('Goblin resists fire');

            makeSanctuaryScenario(targetInCube, true);

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe('Goblin resists fire');
        });

        it('matches sanctuary resistance case-insensitively', async () => {
            mapsService.loadMapData.mockResolvedValue(makeMapData([attackerPlayer, targetInCube]));
            rangeValidation.rangeToFeet.mockReturnValue(0);
            coverService.computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce('true')
                .mockReturnValueOnce('5')
                .mockReturnValueOnce('10')
                .mockReturnValueOnce('Fire');

            const result = await buildAttackContextForDamage(
                makeAttackContext({ damageType: 'fire' }),
                playerName, campaignName, mapName,
            );

            expect(result.resistanceNotice).toBe("Goblin resists fire (Nature's Sanctuary)");
        });
    });
});
