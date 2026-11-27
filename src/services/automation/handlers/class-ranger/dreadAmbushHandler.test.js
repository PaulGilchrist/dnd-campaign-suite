// @maintained-by-ai 2026-11-26
// Sole owner of dreadAmbushHandler.handle() runtime composition (5e Ranger): uses gate,
// oncePerTurn gate, findLastAttack attack gates, level scaling resolution, damage apply,
// uses decrement, log entry, and full-string popup/log description pins.
// Distinct lanes, do not absorb here: dread_ambush_speed / dreadAmbushSpeedActive turn-start
// latch (turnStartEffects*.test.js), dread_ambush_initiative (rules-playerStats-initiative),
// dread_ambush_damage info-builder metadata (automationInfoBuilder/reaction.test.js),
// dreadAmbushUses rest regrant (restRules / trackedResources), rogue stealthAttackHandler
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

// Frozen wall clock so every addEntry timestamp pin is exact (no expect.any(Number) slack).
const FROZEN_NOW = 1730000000000;

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
        // defaultBeforeEach only clears call history, not implementations; re-establish
        // the happy-path log write so a rejection test cannot leak into the next test.
        addEntry.mockResolvedValue(undefined);
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    it('commits a full round trip: rolls, damages the last-attack target, decrements uses, logs, and returns the success popup', async () => {
        // Nameless action pins the 'Dread Ambush' feature-name default; automation without
        // damageType pins the Psychic fallback default.
        const automation = { type: 'dread_ambush', damageExpression: '2d6', uses_expression: '1' };
        const action = { automation };

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(evaluateAutoExpression).toHaveBeenCalledWith('1', expect.objectContaining({ name: playerName }));
        expect(rollExpression).toHaveBeenCalledWith('2d6');
        expect(applyDamageToTarget).toHaveBeenCalledWith(
            {}, 'Goblin', 7, ['Psychic'],
            { campaignName, characters: [], ignoreResistance: false, attackerName: playerName },
        );
        // Exact write census: uses decrement only — oncePerTurn absent must not mark the round.
        expect(setRuntimeValue.mock.calls).toEqual([
            [playerName, 'dreadAmbushUses', 1, campaignName],
        ]);
        expect(addEntry.mock.calls).toEqual([[campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Dread Ambush',
            description: 'RangerGirl used Dread Ambush to deal 7 Psychic damage to Goblin (rolled 2d6).',
            targetName: 'Goblin',
            damageType: 'Psychic',
            damageTotal: 7,
            formula: '2d6',
            timestamp: FROZEN_NOW,
        }]]);
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

    it('takes the target from findLastAttack and the damageType from automation, and writes no uses when uses_expression is absent', async () => {
        findLastAttack.mockResolvedValue(makeHitAttack({ targetName: 'Orc' }));
        const automation = { type: 'dread_ambush', damageExpression: '2d6', damageType: 'Force' };

        const result = await handle({ automation }, makePlayerStats(), campaignName, null);

        expect(applyDamageToTarget).toHaveBeenCalledWith(
            {}, 'Orc', 7, ['Force'],
            { campaignName, characters: [], ignoreResistance: false, attackerName: playerName },
        );
        // No uses_expression → no resource bookkeeping at all.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Dread Ambush',
                targetName: 'Orc',
                description: 'Dread Ambush: Dealt <strong>7</strong> Force damage to Orc. (Rolled 2d6.)',
                automation,
            },
        });
    });

    it('reports 0 damage when the roll fails', async () => {
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

    it.each([
        ['absent damageExpression falls back to 2d6', { type: 'dread_ambush' }, 5, '2d6'],
        ['base expression below all thresholds', { damageExpression: '2d6', scaling: { '5': '3d6', '11': '4d6' } }, 2, '2d6'],
        ['exact threshold level (>=)', { damageExpression: '2d6', scaling: { '5': '3d6' } }, 5, '3d6'],
        ['highest met threshold wins', { damageExpression: '2d6', scaling: { '5': '3d6', '11': '4d6', '17': '6d6' } }, 18, '6d6'],
        ['non-numeric scaling keys are skipped', { damageExpression: '2d6', scaling: { foo: '99d6', '5': '3d6' } }, 10, '3d6'],
    ])('resolves damage expression: %s', async (_label, automation, level, expected) => {
        await handle({ automation }, makePlayerStats({ level }), campaignName, null);

        expect(rollExpression).toHaveBeenCalledWith(expected);
    });

    it.each([
        [
            'no uses remaining',
            () => getRuntimeValue.mockImplementation((_p, key) =>
                key === 'dreadAmbushUses' ? 0 : key === 'characters' ? [] : undefined),
            makeAction().automation,
            'Dread Ambush has no uses remaining. Recharges on a Long Rest.',
        ],
        [
            'already used this turn',
            () => getRuntimeValue.mockImplementation((_p, key) =>
                key === 'dreadAmbushUsedThisTurn' ? 1 : key === 'characters' ? [] : undefined),
            makeAction({ automation: { damageExpression: '2d6', oncePerTurn: true } }).automation,
            'Dread Ambush: Already used this turn. Once per turn.',
        ],
        [
            'no recent attack',
            () => findLastAttack.mockResolvedValue({ attackEvent: null, targetName: null }),
            makeAction().automation,
            'Dread Ambush: No recent attack found. Must be used after you deal damage with a weapon attack.',
        ],
        [
            'last attack made by another creature',
            () => findLastAttack.mockResolvedValue(
                makeHitAttack({ attackEvent: { attackerName: 'Goblin', damageApplied: true } }),
            ),
            makeAction().automation,
            'Dread Ambush: You must be the attacker to use this feature.',
        ],
        [
            'last attack applied no damage',
            () => findLastAttack.mockResolvedValue(
                makeHitAttack({ attackEvent: { attackerName: playerName, damageApplied: false } }),
            ),
            makeAction().automation,
            'Dread Ambush: No damage was applied by your last attack.',
        ],
    ])('refuses with %s: exact refusal popup and zero-spend write census', async (_label, setup, automation, description) => {
        setup();

        const result = await handle({ automation }, makePlayerStats(), campaignName, null);

        // Refusal popup schema: no targetName key (diverges from the success popup shape).
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Dread Ambush',
                description,
                automation,
            },
        });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('allows a once-per-turn use in a later round and marks the new round', async () => {
        getRuntimeValue.mockImplementation((_p, key) =>
            key === 'dreadAmbushUsedThisTurn' ? 1 : key === 'characters' ? [] : undefined);
        getCurrentCombatRound.mockReturnValue(2);
        const automation = { type: 'dread_ambush', damageExpression: '2d6', oncePerTurn: true };

        const result = await handle({ automation }, makePlayerStats(), campaignName, null);

        expect(rollExpression).toHaveBeenCalledWith('2d6');
        // Exact write census: round mark only — automation has no uses_expression.
        expect(setRuntimeValue.mock.calls).toEqual([
            [playerName, 'dreadAmbushUsedThisTurn', 2, campaignName],
        ]);
        expect(result.payload.description).toBe(
            'Dread Ambush: Dealt <strong>7</strong> Psychic damage to Goblin. (Rolled 2d6.)',
        );
    });

    it('propagates the action name into the popup and the campaign log', async () => {
        const automation = makeAction().automation;

        const result = await handle({ name: 'Ambush Strike', automation }, makePlayerStats(), campaignName, null);

        expect(result.payload.name).toBe('Ambush Strike');
        expect(result.payload.description).toBe(
            'Ambush Strike: Dealt <strong>7</strong> Psychic damage to Goblin. (Rolled 2d6.)',
        );
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            abilityName: 'Ambush Strike',
            description: 'RangerGirl used Ambush Strike to deal 7 Psychic damage to Goblin (rolled 2d6).',
        }));
    });

    it('still returns the popup and logs to console when addEntry rejects', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        addEntry.mockRejectedValue(new Error('Log service error'));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(consoleSpy).toHaveBeenCalledWith('[dreadAmbushHandler] Error:', expect.any(Error));

        consoleSpy.mockRestore();
    });
});
