// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage sentinel', () => {
    const baseDeps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestFighter',
                computedStats: {
                    armorClass: 16,
                    characterAdvancement: [{ name: 'Sentinel' }],
                },
            },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    function buildDeps(overrides = {}) {
        return { ...baseDeps, ...overrides };
    }

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    function createFn(deps) {
        return createLogDamageAndShow(deps || baseDeps);
    }

    function makeOpportunityAttackContext(extra = {}) {
        return {
            targetName: 'Goblin',
            damageType: 'slashing',
            isOpportunityAttack: true,
            ...extra,
        };
    }

    describe('sentinel effect application', () => {
        it('applies sentinel speed_zero effect on hit opportunity attack when attacker has feat', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, makeOpportunityAttackContext());

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Sentinel',
                        option: 'Halt',
                        effect: 'speed_zero',
                        duration: 'end_of_turn',
                    }),
                ]),
                'test-campaign'
            );
        });

        it('applies sentinel effect by attacker name when context attackerName differs from characterName', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, makeOpportunityAttackContext({ attackerName: 'TestFighter' }));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({ target: 'Goblin', source: 'Sentinel' }),
                ]),
                'test-campaign'
            );
        });

        it('merges sentinel effect into existing targetEffects array', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
                if (key === 'campaign') return [
                    { target: 'Goblin', source: 'Other', effect: 'some_effect' },
                ];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, makeOpportunityAttackContext());

            const targetEffectsCall = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'targetEffects'
            );
            expect(targetEffectsCall).toBeDefined();
            const updatedEffects = targetEffectsCall[2];
            expect(updatedEffects).toHaveLength(2);
            expect(updatedEffects[0]).toEqual({ target: 'Goblin', source: 'Other', effect: 'some_effect' });
            expect(updatedEffects[1]).toMatchObject({
                target: 'Goblin',
                source: 'Sentinel',
                effect: 'speed_zero',
            });
        });
    });

    describe('sentinel effect not applied', () => {
        it('does not apply sentinel when attack did not hit', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: false };
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, makeOpportunityAttackContext());

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects'
            );
            expect(targetEffectsCalls).toHaveLength(0);
        });

        it('does not apply sentinel when attacker name does not match', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'OtherAttacker' };
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, makeOpportunityAttackContext());

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects'
            );
            expect(targetEffectsCalls).toHaveLength(0);
        });

        it('does not apply sentinel when attacker lacks the feat', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn(buildDeps({
                characters: [
                    {
                        name: 'TestFighter',
                        computedStats: {
                            armorClass: 16,
                            characterAdvancement: [],
                        },
                    },
                    { name: 'Goblin', computedStats: { armorClass: 12 } },
                ],
            }));
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, makeOpportunityAttackContext());

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects'
            );
            expect(targetEffectsCalls).toHaveLength(0);
        });

        it('does not apply sentinel when not an opportunity attack', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'targetEffects'
            );
            expect(targetEffectsCalls).toHaveLength(0);
        });
    });
});
