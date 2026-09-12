// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './dreadAmbushHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(() => Promise.resolve({})),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');
const { addEntry } = await import('../../../ui/logService.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');

const { findLastAttack } = await import('../../common/damageRollback.js');
const { loadCombatSummary, getCurrentCombatRound } = await import('../../../encounters/combatData.js');
const { applyDamageToTarget } = await import('../../../rules/combat/applyDamage.js');

import {
    campaignName,
    playerName,
    makePlayerStats,
    makeAction,
    makeHitAttack,
    defaultCombatRound,
    defaultBeforeEach,
} from './dreadAmbush.test-utils.js';

describe('dreadAmbushHandler', () => {
    beforeEach(() => {
        defaultBeforeEach({
            getRuntimeValue,
            setRuntimeValue,
            rollExpression,
            getCurrentCombatRound,
            evaluateAutoExpression,
            findLastAttack,
            loadCombatSummary,
        });
    });

    describe('guard: no uses remaining', () => {
        it('returns popup when uses are 0', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 0;
                if (key === 'characters') return [];
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Dread Ambush");
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Recharges on a Long Rest');
        });

        it('returns popup when uses are negative', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return -1;
                if (key === 'characters') return [];
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('does not roll dice or apply damage when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 0;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('guard: once per turn', () => {
        it('returns popup when already used this turn', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadAmbushUsedThisTurn') return defaultCombatRound();
                if (key === 'characters') return [];
                return undefined;
            });

            const result = await handle(
                makeAction({ automation: { oncePerTurn: true } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Already used this turn');
            expect(result.payload.description).toContain('Once per turn');
        });

        it('allows usage when in a different round', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadAmbushUsedThisTurn') return 1;
                if (key === 'characters') return [];
                return undefined;
            });
            getCurrentCombatRound.mockReturnValue(2);

            const result = await handle(
                makeAction({ automation: { oncePerTurn: true } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).not.toContain('Already used this turn');
        });

        it('does not roll dice or apply damage when once per turn guard fires', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadAmbushUsedThisTurn') return defaultCombatRound();
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(
                makeAction({ automation: { oncePerTurn: true } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('guard: no recent attack', () => {
        it('returns popup when findLastAttack returns no attackEvent', async () => {
            findLastAttack.mockResolvedValue({ attackEvent: null, targetName: null });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack found');
            expect(result.payload.description).toContain('weapon attack');
        });

        it('does not roll dice when no attack found', async () => {
            findLastAttack.mockResolvedValue({ attackEvent: null });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('guard: attacker mismatch', () => {
        it('returns popup when another creature made the last attack', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({
                attackEvent: { attackerName: 'Goblin', damageApplied: true },
                targetName: 'Goblin',
            }));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('You must be the attacker');
        });

        it('does not roll dice when attacker mismatch', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({
                attackEvent: { attackerName: 'Goblin', damageApplied: true },
            }));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollExpression).not.toHaveBeenCalled();
        });
    });

    describe('guard: no damage applied', () => {
        it('returns popup when attackEvent has damageApplied=false', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({
                attackEvent: { attackerName: playerName, damageApplied: false },
            }));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No damage was applied');
        });

        it('does not roll dice when no damage was applied', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({
                attackEvent: { attackerName: playerName, damageApplied: false },
            }));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollExpression).not.toHaveBeenCalled();
        });
    });

    describe('damage expression scaling', () => {
        it('uses default damageExpression when no scaling', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(result.payload.description).toContain('Rolled 2d6');
        });

        it('scales up damageExpression based on player level', async () => {
            const action = makeAction({
                automation: {
                    scaling: {
                        '5': '3d6',
                        '11': '4d6',
                        '17': '6d6',
                    },
                },
            });
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 2;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(action, makePlayerStats({ level: 10 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('3d6');
        });

        it('uses highest scaling level when player meets multiple thresholds', async () => {
            const action = makeAction({
                automation: {
                    scaling: {
                        '5': '3d6',
                        '11': '4d6',
                        '17': '6d6',
                    },
                },
            });
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 2;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(action, makePlayerStats({ level: 18 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('6d6');
        });

        it('uses base damageExpression when player is below all scaling thresholds', async () => {
            const action = makeAction({
                automation: {
                    damageExpression: '2d6',
                    scaling: {
                        '5': '3d6',
                        '11': '4d6',
                    },
                },
            });
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 2;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(action, makePlayerStats({ level: 2 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
        });

        it('handles non-numeric scaling keys by skipping them', async () => {
            const action = makeAction({
                automation: {
                    damageExpression: '2d6',
                    scaling: {
                        'foo': '99d6',
                        '5': '3d6',
                    },
                },
            });
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 2;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(action, makePlayerStats({ level: 10 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('3d6');
        });
    });

    describe('damage type', () => {
        it('uses default Psychic damage type', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Psychic');
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', expect.any(Number), ['Psychic'], expect.any(String), expect.any(Array), { ignoreResistance: false, attackerName: playerName },);
        });

        it('uses custom damageType from automation', async () => {
            const action = makeAction({
                automation: { damageType: 'Force' },
            });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Force');
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Goblin', expect.any(Number), ['Force'], expect.any(String), expect.any(Array), { ignoreResistance: false, attackerName: playerName },);
        });
    });

    describe('successful execution', () => {
        it('rolls the damage expression', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
        });

        it('uses roll total as damage', async () => {
            rollExpression.mockReturnValue({ total: 12, rolls: [7, 5] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('12');
        });

        it('calls applyDamageToTarget with correct arguments', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 7, ['Psychic'], campaignName, [], { ignoreResistance: false, attackerName: playerName },);
        });

        it('uses targetName from findLastAttack result', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({ targetName: 'Orc' }));

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Orc', expect.any(Number), expect.any(Array), expect.any(String), expect.any(Array), { ignoreResistance: false, attackerName: playerName },);
        });

        it('returns automation_info popup with correct structure', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Dread Ambush");
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.automation).toBeDefined();
        });

        it('includes damage total and target in popup description', async () => {
            rollExpression.mockReturnValue({ total: 9, rolls: [5, 4] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('9');
            expect(result.payload.description).toContain('Goblin');
        });

        it('includes rolled formula in popup description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('Rolled 2d6');
        });

        it('bolds damage total in popup description', async () => {
            rollExpression.mockReturnValue({ total: 5, rolls: [2, 3] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('<strong>5</strong>');
        });
    });

    describe('uses decrement', () => {
        it('decrements uses when uses_expression is present', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 3;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'dreadambushUses',
                2,
                campaignName,
            );
        });

        it('does not decrement uses when uses_expression is absent', async () => {
            const action = makeAction({
                automation: { uses_expression: undefined },
            });

            await handle(action, makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'dreadambushUses',
                expect.any(Number),
                campaignName,
            );
        });

    });

    describe('oncePerTurn marking', () => {
        it('marks oncePerTurn when oncePerTurn is true', async () => {
            getCurrentCombatRound.mockReturnValue(3);

            await handle(
                makeAction({ automation: { oncePerTurn: true } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'dreadAmbushUsedThisTurn',
                3,
                campaignName,
            );
        });

        it('does not mark oncePerTurn when oncePerTurn is false', async () => {
            await handle(
                makeAction({ automation: { oncePerTurn: false } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'dreadAmbushUsedThisTurn',
                expect.any(Number),
                campaignName,
            );
        });

        it('does not mark oncePerTurn when oncePerTurn is absent', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerName,
                'dreadAmbushUsedThisTurn',
                expect.any(Number),
                campaignName,
            );
        });
    });

    describe('logging', () => {
        it('logs ability_use entry on successful execution', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: "Dread Ambush",
                targetName: 'Goblin',
                damageType: 'Psychic',
                damageTotal: 7,
                formula: '2d6',
                timestamp: expect.any(Number),
            }));
        });

        it('includes description with damage details in log', async () => {
            rollExpression.mockReturnValue({ total: 10, rolls: [6, 4] });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('used Dread Ambush'),
            }));
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('10 Psychic damage'),
            }));
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: expect.stringContaining('rolled 2d6'),
            }));
        });

        it('logs with custom feature name', async () => {
            const result = await handle(
                { name: 'My Dread Ambush', automation: makeAction().automation },
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.name).toBe('My Dread Ambush');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'My Dread Ambush',
            }));
        });

        it('does not log on guard failures', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 0;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).not.toHaveBeenCalled();
        });

        it('handles addEntry error gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error');
            consoleSpy.mockImplementation(() => {});

            addEntry.mockRejectedValue(new Error('Log service error'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(consoleSpy).toHaveBeenCalledWith(
                '[dreadAmbushHandler] Error:',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });
    });

    describe('campaign name propagation', () => {
        it('passes campaignName to applyDamageToTarget', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), expect.any(String), expect.any(Number), expect.any(Array), 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: expect.any(String) },);
        });

        it('passes campaignName to setRuntimeValue for uses', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 2;
                if (key === 'characters') return [];
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'dreadambushUses',
                expect.any(Number),
                'test-campaign',
            );
        });

        it('passes campaignName to setRuntimeValue for oncePerTurn', async () => {
            await handle(
                makeAction({ automation: { oncePerTurn: true } }),
                makePlayerStats(),
                'test-campaign',
                null,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'dreadAmbushUsedThisTurn',
                expect.any(Number),
                'test-campaign',
            );
        });

        it('passes campaignName to addEntry', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
        });
    });

    describe('automation payload', () => {
        it('includes automation object in popup payload', async () => {
            const auto = makeAction().automation;
            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual(auto);
        });
    });

    describe('roll edge cases', () => {
        it('handles rollExpression returning null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('0');
        });

        it('handles rollExpression returning result with no total', async () => {
            rollExpression.mockReturnValue({ rolls: [3, 4] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('0');
        });

        it('uses 0 when roll total is 0', async () => {
            rollExpression.mockReturnValue({ total: 0, rolls: [0, 0] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toContain('0');
        });
    });

    describe('action name fallback', () => {
        it('uses "Dread Ambush" as default feature name when action has no name', async () => {
            const result = await handle(
                { automation: makeAction().automation },
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.name).toBe('Dread Ambush');
        });

        it('uses custom name from action when provided', async () => {
            const result = await handle(
                { name: 'Ambush Strike', automation: makeAction().automation },
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.name).toBe('Ambush Strike');
            expect(result.payload.description).toContain('Ambush Strike');
        });
    });
});
