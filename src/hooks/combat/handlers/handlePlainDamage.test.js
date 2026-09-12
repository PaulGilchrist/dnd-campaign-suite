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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage core flow', () => {
    const deps = {
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

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('basic damage application', () => {
        it('applies damage, logs entry, and updates popup in a single flow', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 8, ['slashing'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestFighter', suppressHpLog: true },);
            expect(deps.logEntry).toHaveBeenCalled();
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.type).toBe('roll');
            expect(logCall.rollType).toBe('damage');
            expect(logCall.name).toBe('Longsword');
            expect(logCall.formula).toBe('1d8+3');
            expect(logCall.total).toBe(8);
            expect(logCall.finalDamage).toBe(8);
            expect(logCall.targetName).toBe('Goblin');
            expect(logCall.damageType).toBe('slashing');
            expect(logCall.isCrit).toBe(false);
            expect(logCall.gwfApplied).toBe(false);
            expect(logCall.gwfOriginalRolls).toBeNull();
            expect(logCall.gwfDisplayRolls).toEqual([5, 3]);
            expect(logCall.rayOfEnfeebleReduction).toBe(0);
            expect(logCall.rayOfEnfeebleRoll).toBeNull();
            expect(logCall.resistanceReduction).toBe(0);
            expect(logCall.resistanceRoll).toBeNull();
        });

        it('calls endInvisibilityOnHostileAction when applied damage is positive', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith(
                'TestFighter',
                'test-campaign'
            );
        });

        it('sets popup html with hp change and damage breakdown', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall).toBeDefined();
            const popup = popupCall[0];
            expect(popup.type).toBe('damage');
            expect(popup.targetName).toBe('Goblin');
            expect(popup.total).toBe(8);
            expect(popup.adjustedTotal).toBe(8);
            expect(popup.damageApplied).toBe(true);
            expect(popup.finalDamage).toBe(8);
            expect(popup.damageReduced).toBe(false);
            expect(popup.targetCurrentHp).toBe(5);
            expect(popup.targetMaxHp).toBe(13);
            expect(popup.elementalAdeptBonus).toBe(0);
        });

        it('logs hp_change entry with correct delta and target', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const hpChangeCalls = addEntry.mock.calls.filter(
                (call) => call[1]?.type === 'hp_change'
            );
            expect(hpChangeCalls.length).toBeGreaterThan(0);
            expect(hpChangeCalls[0][0]).toBe('test-campaign');
            expect(hpChangeCalls[0][1]).toMatchObject({
                targetName: 'Goblin',
                delta: -8,
                currentHp: 5,
                maxHp: 13,
                isHealing: false,
                isUnconscious: false,
                damageBreakdown: expect.arrayContaining([
                    expect.objectContaining({
                        damageType: 'slashing',
                        amount: 8,
                    }),
                ]),
            });
        });
    });

    describe('threshold tracking', () => {
        function setupThresholdTest(conditions) {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                const hpMap = {
                    wasAlive_notBloodied_newBloodied: { oldHp: 10, newHp: 4, maxHp: 10 },
                    wasBloodied_notBloodied: { oldHp: 3, newHp: 5, maxHp: 10 },
                    notAlive_unconscious: { oldHp: 0, newHp: 0, maxHp: 10 },
                };
                const vals = hpMap[conditions];
                if (!vals) return null;
                if (key === 'Goblin' && prop === 'currentHitPoints') return vals.newHp;
                if (key === 'Goblin' && prop === 'hitPoints') return vals.maxHp;
                return null;
            });
        }

        it('sets threshold to bloodied when target crosses from above-half to at-or-below half', async () => {
            setupThresholdTest('wasAlive_notBloodied_newBloodied');
            applyDamageToTarget.mockReturnValue({ finalDamage: 6, newHp: 4, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 6, [3, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const hpChangeCalls = addEntry.mock.calls.filter(
                (call) => call[1]?.type === 'hp_change'
            );
            expect(hpChangeCalls[0][1].threshold).toBe('bloodied');
        });


        it('sets threshold to dead when target was not alive and remains unconscious', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'Goblin' && prop === 'currentHitPoints') return 0;
                if (key === 'Goblin' && prop === 'hitPoints') return 10;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 0, damageReduced: true });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 6, [3, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const hpChangeCalls = addEntry.mock.calls.filter(
                (call) => call[1]?.type === 'hp_change'
            );
            expect(hpChangeCalls[0][1].threshold).toBe('dead');
        });

        it('omits threshold when no threshold condition is met', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 10, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 3, [3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const hpChangeCalls = addEntry.mock.calls.filter(
                (call) => call[1]?.type === 'hp_change'
            );
            expect(hpChangeCalls[0][1].threshold).toBeUndefined();
        });
    });

    describe('crit formatting in log entry', () => {
        it('formats formula as doubled in log entry when isAutoCrit is true', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', isAutoCrit: true, });

            expect(deps.logEntry).toHaveBeenCalled();
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.isCrit).toBe(true);
            expect(logCall.formula).toContain('*2');
        });

        it('keeps original formula when not a crit', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.isCrit).toBe(false);
            expect(logCall.formula).toBe('1d8+3');
        });
    });

    describe('lastAttack storage', () => {
        it('stores lastAttack with damage rolls and damageType when both are present', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return {};
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', attackerName: 'TestFighter', attackName: 'Longsword', });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'lastAttack',
                expect.objectContaining({
                    attackerName: 'TestFighter',
                    targetName: 'Goblin',
                    attackName: 'Longsword',
                    rolls: [5, 3],
                    primaryDamageType: 'slashing',
                    damageTypes: ['slashing'],
                    damageApplied: true,
                }),
                'test-campaign'
            );
        });

        it('merges new lastAttack data with existing stored data', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return {
                    hit: true,
                    attackerName: 'PreviousAttacker',
                    otherField: 'keep',
                };
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', attackerName: 'TestFighter', attackName: 'Longsword', });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'lastAttack',
                expect.objectContaining({
                    hit: true,
                    attackerName: 'TestFighter',
                    targetName: 'Goblin',
                    otherField: 'keep',
                }),
                'test-campaign'
            );
        });

        it('does not store lastAttack when rolls are absent', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return {};
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, null, 3, { targetName: 'Goblin', damageType: 'slashing', });

            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'lastAttack'
            );
            expect(lastAttackCalls).toHaveLength(0);
        });

        it('does not store lastAttack when damageType is absent', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return {};
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', });

            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'lastAttack'
            );
            expect(lastAttackCalls).toHaveLength(0);
        });
    });

    describe('popup data: weapon type classification', () => {
        it('sets weaponType to unarmed for unarmed strikes', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Unarmed Strike', '1d4', 4, [4], 0, { targetName: 'Goblin', damageType: 'bludgeoning', isUnarmedStrike: true, });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].weaponType).toBe('unarmed');
        });

        it('defaults weaponType to melee when isMelee is undefined and not ranged', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].weaponType).toBe('melee');
        });

        it('sets weaponType to ranged for ranged attacks', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', isMelee: false, });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].weaponType).toBe('ranged');
        });
    });

    describe('intercepted damage popup', () => {
        it('includes interceptedFeature and adjusted finalDamage when damage is intercepted', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({
                finalDamage: 5,
                newHp: 8,
                damageReduced: false,
                intercepted: true,
                interceptedFeature: 'Shield Boy',
                damageDealt: 3,
                oldHp: 11,
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].interceptedFeature).toBe('Shield Boy');
            expect(popupCall[0].finalDamage).toBe(3);
        });
    });

    describe('ray of enfeeble', () => {
        it('applies ray of enfeeble reduction when debuff is active on attacker', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [
                    { target: 'TestFighter', effect: 'ray_of_enfeeble_debuff' },
                ];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 10, damageReduced: false });
            rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 10, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(deps.logEntry).toHaveBeenCalled();
            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.rayOfEnfeebleReduction).toBeGreaterThan(0);
            expect(logCall.rayOfEnfeebleRoll).toBeGreaterThan(0);
        });

        it('sets rayOfEnfeebleReduction to 0 when debuff is not active', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const logCall = deps.logEntry.mock.calls[0][0];
            expect(logCall.rayOfEnfeebleReduction).toBe(0);
            expect(logCall.rayOfEnfeebleRoll).toBeNull();
        });
    });

    describe('popup data: dc passthrough', () => {
        it('includes dc, dcType, dcSuccess from context in popup', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', dc: 15, dcType: 'strength', dcSuccess: false, });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            const popup = popupCall[0];
            expect(popup.dc).toBe(15);
            expect(popup.dcType).toBe('strength');
            expect(popup.dcSuccess).toBe(false);
        });
    });

    describe('popup data: spellName passthrough', () => {
        it('includes spellName from context when present', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', spellName: 'Fire Bolt', });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].spellName).toBe('Fire Bolt');
        });

        it('sets spellName to empty string when not in context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].spellName).toBe('');
        });
    });

    describe('popup data: tavernBrawlerRerolls passthrough', () => {
        it('includes tavernBrawlerRerolls from context when present', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', tavernBrawlerRerolls: [1, 2], });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].tavernBrawlerRerolls).toEqual([1, 2]);
        });

        it('sets tavernBrawlerRerolls to null when not in context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const popupCall = deps.setPopupHtml.mock.calls.find(
                (call) => typeof call[0] === 'object' && call[0]?.type === 'damage'
            );
            expect(popupCall[0].tavernBrawlerRerolls).toBeNull();
        });
    });
});
