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

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage popup data', () => {
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
        getRuntimeValue.mockReset().mockReturnValue(null);
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('popup data structure', () => {
        it('includes core popup fields in the first setPopupHtml call', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.type).toBe('damage');
            expect(call.name).toBe('Longsword');
            expect(call.formula).toBe('1d8+3');
            expect(call.damageType).toBe('slashing');
            expect(call.targetName).toBe('Goblin');
            expect(call.total).toBe(8);
            expect(call.adjustedTotal).toBe(8);
            expect(call.rolls).toEqual([5, 3]);
            expect(call.modifier).toBe(3);
            expect(call.damageApplied).toBe(true);
            expect(call.finalDamage).toBe(8);
            expect(call.damageReduced).toBe(false);
            expect(call.targetCurrentHp).toBe(5);
            expect(call.targetMaxHp).toBe(13);
        });

        it('sets isCrit based on context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', isAutoCrit: true, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.isCrit).toBe(true);
        });

        it('sets elementalAdeptBonus when adjustedTotal exceeds total', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.elementalAdeptBonus).toBe(0);
        });
    });

    describe('bardic inspiration and empowered spell passthrough', () => {
        it('passes bardicInspirationOffense and die size through from context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', bardicInspirationOffense: true, bardicInspirationOffenseDieSize: 6, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.bardicInspirationOffense).toBe(true);
            expect(call.bardicInspirationOffenseDieSize).toBe(6);
        });

        it('passes empoweredSpell and cha mod through from context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', empoweredSpell: true, empoweredSpellChaMod: 2, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.empoweredSpell).toBe(true);
            expect(call.empoweredSpellChaMod).toBe(2);
        });
    });

    describe('piercer puncture availability', () => {
        function makePiercerStats() {
            return {
                reactions: [{ automation: { type: 'piercer_puncture' } }],
            };
        }

        it('sets piercerPuncture true when piercing damage, feat present, and not used', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === 'piercerPunctureUsedThisTurn') return false;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'piercing', playerStats: makePiercerStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.piercerPuncture).toBe(true);
        });

        it('sets piercerPuncture false when damage type is not piercing', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === 'piercerPunctureUsedThisTurn') return false;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', playerStats: makePiercerStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.piercerPuncture).toBe(false);
        });

        it('sets piercerPuncture false when already used this turn', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === 'piercerPunctureUsedThisTurn') return true;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'piercing', playerStats: makePiercerStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.piercerPuncture).toBe(false);
        });

        it('sets piercerPuncture false when feat is not present', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'piercing', playerStats: {}, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.piercerPuncture).toBe(false);
        });
    });

    describe('savage attacker availability', () => {
        function makeSavageStats() {
            return {
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'reroll_damage_once_per_turn' }],
                },
            };
        }

        it('sets savageAttacker true for melee attacks when feat present and not used', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === '_Savage_Attacker_usedRound') return false;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', isMelee: true, playerStats: makeSavageStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.savageAttacker).toBe(true);
        });

        it('sets savageAttacker true for unarmed strikes when feat present', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === '_Savage_Attacker_usedRound') return false;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Unarmed Strike', '1d4', 4, [4], 0, { targetName: 'Goblin', damageType: 'bludgeoning', isUnarmedStrike: true, playerStats: makeSavageStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.savageAttacker).toBe(true);
        });

        it('sets savageAttacker false for ranged attacks even with feat', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === '_Savage_Attacker_usedRound') return false;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', isMelee: false, playerStats: makeSavageStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.savageAttacker).toBe(false);
        });

        it('sets savageAttacker false when already used this round', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === '_Savage_Attacker_usedRound') return true;
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', isMelee: true, playerStats: makeSavageStats(), });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.savageAttacker).toBe(false);
        });

        it('sets savageAttacker false when feat is not present', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', isMelee: true, playerStats: {}, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.savageAttacker).toBe(false);
        });
    });

    describe('weapon type classification', () => {
        it('sets weaponType to unarmed for unarmed strikes', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Unarmed Strike', '1d4', 4, [4], 0, { targetName: 'Goblin', damageType: 'bludgeoning', isUnarmedStrike: true, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.weaponType).toBe('unarmed');
        });

        it('sets weaponType to melee for melee attacks', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', isMelee: true, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.weaponType).toBe('melee');
        });

        it('sets weaponType to ranged for ranged attacks', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', isMelee: false, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.weaponType).toBe('ranged');
        });

        it('defaults weaponType to melee when isMelee is undefined', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.weaponType).toBe('melee');
        });
    });

    describe('gwf (great weapon fighting) popup data', () => {
        it('sets gwfApplied false and gwfDisplayRolls when no GWF changes', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.gwfApplied).toBe(false);
            expect(call.gwfOriginalRolls).toBeNull();
            expect(call.gwfDisplayRolls).toEqual([5, 3]);
        });
    });

    describe('holy aura save result passthrough', () => {
        it('includes holyAuraSaveResult in popup when present in applyResult', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({
                finalDamage: 8,
                newHp: 5,
                damageReduced: false,
                holyAuraSaveResult: { success: true, saveType: 'wisdom' },
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.holyAuraSaveResult).toEqual({ success: true, saveType: 'wisdom' });
        });
    });

    describe('dc data passthrough', () => {
        it('includes dc, dcType, dcSuccess from context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', dc: 15, dcType: 'strength', dcSuccess: false, });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.dc).toBe(15);
            expect(call.dcType).toBe('strength');
            expect(call.dcSuccess).toBe(false);
        });
    });

    describe('tavern brawler rerolls passthrough', () => {
        it('includes tavernBrawlerRerolls from context when present', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', tavernBrawlerRerolls: [1, 2], });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.tavernBrawlerRerolls).toEqual([1, 2]);
        });

        it('sets tavernBrawlerRerolls to null when not in context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.tavernBrawlerRerolls).toBeNull();
        });
    });

    describe('spellName passthrough', () => {
        it('includes spellName from context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, { targetName: 'Goblin', damageType: 'fire', spellName: 'Fire Bolt', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.spellName).toBe('Fire Bolt');
        });

        it('sets spellName to empty string when not in context', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.spellName).toBe('');
        });
    });

    describe('intercepted damage popup data', () => {
        it('includes interceptedFeature and adjusted hp values when damage is intercepted', async () => {
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

            const call = deps.setPopupHtml.mock.calls[0][0];
            expect(call.interceptedFeature).toBe('Shield Boy');
            expect(call.finalDamage).toBe(3);
        });
    });

    describe('applyDamageToTarget call verification', () => {
        it('calls applyDamageToTarget with correct arguments for plain damage', async () => {
            getRuntimeValue.mockImplementation((key) => {
                if (key === 'campaign') return [];
                return null;
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, { targetName: 'Goblin', damageType: 'slashing', });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            const [, target, damage, damageTypes, campaign, , options] =
                applyDamageToTarget.mock.calls[0];
            expect(target).toBe('Goblin');
            expect(damage).toBe(8);
            expect(damageTypes).toEqual(['slashing']);
            expect(campaign).toBe('test-campaign');
            expect(options.attackerName).toBe('TestFighter');
        });
    });
});
