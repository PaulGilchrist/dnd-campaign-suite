// @maintained-by-ai
// Sole owner of dreadAmbushHandler.handle() runtime composition (5e Ranger): uses gate,
// oncePerTurn gate, findLastAttack attack gates, level scaling resolution, damage apply,
// uses decrement, log entry, and full-string popup/log description pins.
// Distinct lanes, do not absorb here: dread_ambush_speed / dreadAmbushSpeedActive turn-start
// latch (turnStartEffects*.test.js), dread_ambush_initiative (rules-playerStats-initiative),
// dread_ambush_damage info-builder metadata (automationInfoBuilder/reaction.test.js),
// dreadambushUses rest regrant (restRules / trackedResources), rogue stealthAttackHandler
// (stealth-gated sneak dice — separate feature). Uses shared dreadAmbush.test-utils fixtures.
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

    describe('golden path', () => {
        it('rolls, applies damage to the last attack target, decrements uses, and reports the popup', async () => {
            // Full automation without damageType — pins the Psychic fallback default.
            // (makeAction's outer ...overrides spread REPLACES automation wholesale,
            // so automation variants must be specified in full.)
            const automation = { type: 'dread_ambush', damageExpression: '2d6', uses_expression: '1' };
            const action = makeAction({ automation });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('1', expect.objectContaining({ name: playerName }));
            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                {}, 'Goblin', 7, ['Psychic'],
                { campaignName, characters: [], ignoreResistance: false, attackerName: playerName },
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(playerName, 'dreadambushUses', 1, campaignName);
            // oncePerTurn absent on default action — must not mark.
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                playerName, 'dreadAmbushUsedThisTurn', expect.any(Number), campaignName,
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dread Ambush',
                    targetName: 'Goblin',
                    description: 'Dread Ambush: Dealt <strong>7</strong> Psychic damage to Goblin. (Rolled 2d6.)',
                    automation: action.automation,
                },
            });
        });

        it('logs an ability_use entry with full damage details to the campaign', async () => {
            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Dread Ambush',
                description: 'RangerGirl used Dread Ambush to deal 7 Psychic damage to Goblin (rolled 2d6).',
                targetName: 'Goblin',
                damageType: 'Psychic',
                damageTotal: 7,
                formula: '2d6',
                timestamp: expect.any(Number),
            });
        });

        it('damages the target reported by findLastAttack, not a hardcoded name', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({ targetName: 'Orc' }));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                {}, 'Orc', 7, ['Psychic'],
                { campaignName, characters: [], ignoreResistance: false, attackerName: playerName },
            );
            expect(result.payload.targetName).toBe('Orc');
        });

        it('honours a custom damageType from automation', async () => {
            const result = await handle(
                makeAction({ automation: { type: 'dread_ambush', damageExpression: '2d6', damageType: 'Force', uses_expression: '1' } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                {}, 'Goblin', 7, ['Force'],
                { campaignName, characters: [], ignoreResistance: false, attackerName: playerName },
            );
            expect(result.payload.description).toBe(
                'Dread Ambush: Dealt <strong>7</strong> Force damage to Goblin. (Rolled 2d6.)',
            );
        });

        it('falls back to 0 damage when the roll returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                {}, 'Goblin', 0, ['Psychic'],
                { campaignName, characters: [], ignoreResistance: false, attackerName: playerName },
            );
            expect(result.payload.description).toBe(
                'Dread Ambush: Dealt <strong>0</strong> Psychic damage to Goblin. (Rolled 2d6.)',
            );
        });
    });

    describe('damage expression scaling', () => {
        it('uses the scaling expression at the exact threshold level (>=)', async () => {
            const action = makeAction({ automation: { damageExpression: '2d6', scaling: { '5': '3d6' } } });

            await handle(action, makePlayerStats({ level: 5 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('3d6');
        });

        it('uses the highest met threshold when multiple are satisfied', async () => {
            const action = makeAction({
                automation: { damageExpression: '2d6', scaling: { '5': '3d6', '11': '4d6', '17': '6d6' } },
            });

            await handle(action, makePlayerStats({ level: 18 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('6d6');
        });

        it('uses the base damageExpression when below all thresholds', async () => {
            const action = makeAction({
                automation: { damageExpression: '2d6', scaling: { '5': '3d6', '11': '4d6' } },
            });

            await handle(action, makePlayerStats({ level: 2 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
        });

        it('skips non-numeric scaling keys', async () => {
            const action = makeAction({
                automation: { damageExpression: '2d6', scaling: { 'foo': '99d6', '5': '3d6' } },
            });

            await handle(action, makePlayerStats({ level: 10 }), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('3d6');
        });
    });

    describe('guard: no uses remaining', () => {
        it('refuses with no side effects when uses are 0', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadambushUses') return 0;
                if (key === 'characters') return [];
                return undefined;
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dread Ambush',
                    description: 'Dread Ambush has no uses remaining. Recharges on a Long Rest.',
                    automation: action.automation,
                },
            });
            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('guard: once per turn', () => {
        it('refuses with no side effects when already used this turn', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadAmbushUsedThisTurn') return 1;
                if (key === 'characters') return [];
                return undefined;
            });

            const action = makeAction({ automation: { damageExpression: '2d6', oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dread Ambush',
                    description: 'Dread Ambush: Already used this turn. Once per turn.',
                    automation: action.automation,
                },
            });
            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('allows use in a later round and marks the current round', async () => {
            getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
                if (key === 'dreadAmbushUsedThisTurn') return 1;
                if (key === 'characters') return [];
                return undefined;
            });
            getCurrentCombatRound.mockReturnValue(2);

            const result = await handle(
                makeAction({ automation: { damageExpression: '2d6', oncePerTurn: true } }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                playerName, 'dreadAmbushUsedThisTurn', 2, campaignName,
            );
            expect(result.payload.description).not.toContain('Already used this turn');
        });
    });

    describe('guard: attack gates', () => {
        it('refuses with no dice rolled when no recent attack exists', async () => {
            findLastAttack.mockResolvedValue({ attackEvent: null, targetName: null });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Dread Ambush',
                    description: 'Dread Ambush: No recent attack found. Must be used after you deal damage with a weapon attack.',
                    automation: action.automation,
                },
            });
            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('refuses when another creature made the last attack', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({
                attackEvent: { attackerName: 'Goblin', damageApplied: true },
            }));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toBe('Dread Ambush: You must be the attacker to use this feature.');
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('refuses when the last attack applied no damage', async () => {
            findLastAttack.mockResolvedValue(makeHitAttack({
                attackEvent: { attackerName: playerName, damageApplied: false },
            }));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.description).toBe('Dread Ambush: No damage was applied by your last attack.');
            expect(rollExpression).not.toHaveBeenCalled();
        });
    });

    describe('uses_expression absent', () => {
        it('deals damage but never writes dreadambushUses when uses_expression is absent', async () => {
            const action = makeAction({ automation: { type: 'dread_ambush', damageExpression: '2d6', damageType: 'Psychic' } });

            await handle(action, makePlayerStats(), campaignName, null);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('feature naming', () => {
        it('defaults the feature name to "Dread Ambush" when the action has no name', async () => {
            const result = await handle(
                { automation: makeAction().automation },
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.name).toBe('Dread Ambush');
        });

        it('uses the action name in popup, description, and log', async () => {
            const result = await handle(
                { name: 'Ambush Strike', automation: makeAction().automation },
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result.payload.name).toBe('Ambush Strike');
            expect(result.payload.description).toContain('Ambush Strike');
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                abilityName: 'Ambush Strike',
            }));
        });
    });

    describe('error handling', () => {
        it('surfaces the popup and logs to console when addEntry rejects', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            addEntry.mockRejectedValueOnce(new Error('Log service error'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(consoleSpy).toHaveBeenCalledWith('[dreadAmbushHandler] Error:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });
});
