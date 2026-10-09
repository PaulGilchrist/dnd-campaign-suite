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

vi.mock('../../../services/combat/conditions/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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

import { addEntry } from '../../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { KEY } from '../../../services/rules/effects/turnStartEffects.js';

describe('Plain damage sentinel (FT-101 Halt seam)', () => {
    const sentinelCharacter = {
        name: 'TestFighter',
        feats: ['Great Weapon Master', 'Sentinel'],
        computedStats: { armorClass: 16 },
    };
    const goblin = { name: 'Goblin', computedStats: { armorClass: 12 } };

    const baseDeps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [sentinelCharacter, goblin],
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
        addEntry.mockClear();
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
            attackerName: 'TestFighter',
            ...extra,
        };
    }

    function oaHitRuntime(key, prop) {
        if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
        if (key === 'campaign') return [];
        return null;
    }

    function targetEffectsCalls() {
        return setRuntimeValue.mock.calls.filter((call) => call[1] === 'targetEffects');
    }

    describe('OA hit by Sentinel-holder stamps Halt', () => {
        it('registers speed_zero te (option Halt, end_of_turn) sourced from the attacker', async () => {
            getRuntimeValue.mockImplementation(oaHitRuntime);
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: makeOpportunityAttackContext() });

            expect(targetEffectsCalls()).toHaveLength(1);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'TestFighter',
                        option: 'Halt',
                        effect: 'speed_zero',
                        duration: 'end_of_turn',
                    }),
                ]),
                'test-campaign',
                true
            );
        });

        it('stamps the activeConditions speed_zero enforcement lane', async () => {
            getRuntimeValue.mockImplementation(oaHitRuntime);
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: makeOpportunityAttackContext() });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                ['speed_zero'],
                'test-campaign'
            );
        });

        it('adds ONE anchor expiry clock cleared at the target next turn-start', async () => {
            getRuntimeValue.mockImplementation(oaHitRuntime);
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: makeOpportunityAttackContext() });

            const expirationCalls = setRuntimeValue.mock.calls.filter((call) => call[1] === KEY && call[0] === 'TestFighter');
            expect(expirationCalls).toHaveLength(1);
            expect(expirationCalls[0][2]).toHaveLength(1);
            expect(expirationCalls[0][2][0]).toMatchObject({
                target: 'Goblin',
                expireOnCreatureName: 'Goblin',
                expiryRounds: Infinity,
            });
            expect(expirationCalls[0][2][0].effects).toEqual([
                { type: 'remove_target_effect', effectKey: 'speed_zero', source: 'TestFighter', target: 'Goblin' },
                { type: 'speed_zero' },
            ]);
        });

        it('logs the Halt grant with event details', async () => {
            getRuntimeValue.mockImplementation(oaHitRuntime);
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: makeOpportunityAttackContext() });

            const grant = addEntry.mock.calls.map(c => c[1]).find(e => e && e.automationType === 'speed_zero_granted');
            expect(grant).toBeDefined();
            expect(grant).toMatchObject({
                type: 'automation',
                characterName: 'Goblin',
                sourceName: 'TestFighter',
                abilityName: 'Sentinel',
            });
            expect(grant.description).toContain('Speed is 0');
        });

        it('merges Halt into existing targetEffects', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'TestFighter' };
                if (key === 'campaign') return [{ target: 'Goblin', source: 'Other', effect: 'some_effect' }];
                return null;
            });
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: makeOpportunityAttackContext() });

            const call = targetEffectsCalls().find(c => Array.isArray(c[2]) && c[2].length === 2);
            expect(call).toBeDefined();
            expect(call[2][0]).toEqual({ target: 'Goblin', source: 'Other', effect: 'some_effect' });
            expect(call[2][1]).toMatchObject({ target: 'Goblin', source: 'TestFighter', effect: 'speed_zero' });
        });
    });

    describe('zero-stamp refusals', () => {
        async function expectNoStamp(deps, context, runtime = oaHitRuntime) {
            getRuntimeValue.mockImplementation(runtime);
            const fn = createFn(deps);
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context });
            expect(targetEffectsCalls()).toHaveLength(0);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditions', expect.anything(), 'test-campaign');
            expect(addEntry.mock.calls.map(c => c[1]).some(e => e && e.automationType === 'speed_zero_granted')).toBe(false);
        }

        it('skips when not an opportunity attack', async () => {
            await expectNoStamp(baseDeps, { targetName: 'Goblin', damageType: 'slashing', attackerName: 'TestFighter' });
        });

        it('skips when the attack did not hit', async () => {
            await expectNoStamp(baseDeps, makeOpportunityAttackContext(), (key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: false, attackerName: 'TestFighter' };
                if (key === 'campaign') return [];
                return null;
            });
        });

        it('skips when the lastAttack attacker identity differs', async () => {
            await expectNoStamp(baseDeps, makeOpportunityAttackContext({ attackerName: 'OtherAttacker' }), (key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, attackerName: 'OtherAttacker' };
                if (key === 'campaign') return [];
                return null;
            });
        });

        it('skips when the attacker lacks the Sentinel feat', async () => {
            await expectNoStamp(buildDeps({
                characters: [
                    { name: 'TestFighter', feats: ['Great Weapon Master'], computedStats: { armorClass: 16 } },
                    goblin,
                ],
            }), makeOpportunityAttackContext());
        });
    });
});
