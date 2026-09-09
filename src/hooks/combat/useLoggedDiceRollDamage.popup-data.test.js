// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
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

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn((expr) => {
        const match = expr.match(/^(\d+)d(\d+)\+(\d+)/);
        if (match) return parseInt(match[1]) + parseInt(match[3]);
        return 0;
    }),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(() => ({
        restoreBalance: false,
        autoRerollForSaves: false,
        autoRerollBonus: null,
        autoRerollCondition: null,
        saveAdvantageCount: 0,
        saveAdvantageAbilities: [],
    })),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize, getBardicInspirationDieSizeFromClass } from '../../services/combat/auras/bardicInspirationState.js';
import { hasEmpoweredSpell } from '../../services/rules/spells/empoweredSpellService.js';
import { getChaModifier } from '../../services/rules/spells/metamagicRules.js';
import { isMagicMissileImmune } from './loggedDiceRollUtils.js';

describe('Popup data with bardic inspiration, empowered spell, piercer, savage attacker', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: { armorClass: 12 } },
            { name: 'TestFighter', computedStats: { armorClass: 16 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockImplementation((key, prop) => {
            if (key === 'campaign') return [];
            if (key === 'TestFighter' && prop === 'piercerPunctureUsedThisTurn') return false;
            if (key === 'TestFighter' && prop === '_Savage_Attacker_usedRound') return false;
            return null;
        });
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockReset().mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        isMagicMissileImmune.mockReset().mockReturnValue(false);
        hasIgnoreResistance.mockReset().mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReset().mockReturnValue(undefined);
        applyMinDamageAdjustment.mockReset().mockImplementation((d) => d);
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    function getFirstPopupCall() {
        expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
        return deps.setPopupHtml.mock.calls[0][0];
    }

    describe('core popup data structure', () => {
        it('returns correct popup fields for a plain melee attack', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            const popup = getFirstPopupCall();
            expect(popup.type).toBe('damage');
            expect(popup.name).toBe('Longsword');
            expect(popup.formula).toBe('1d8+3');
            expect(popup.damageType).toBe('slashing');
            expect(popup.targetName).toBe('Goblin');
            expect(popup.total).toBe(8);
            expect(popup.adjustedTotal).toBe(8);
            expect(popup.rolls).toEqual([5, 3]);
            expect(popup.modifier).toBe(3);
            expect(popup.damageApplied).toBe(true);
            expect(popup.finalDamage).toBe(8);
            expect(popup.damageReduced).toBe(false);
            expect(popup.targetCurrentHp).toBe(5);
            expect(popup.targetMaxHp).toBe(13);
        });

        it('sets isCrit to false by default', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().isCrit).toBe(false);
        });

        it('sets isCrit to true when isAutoCrit is in context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isAutoCrit: true,
            });

            expect(getFirstPopupCall().isCrit).toBe(true);
        });

        it('sets isCrit to true when isAutoCrit is in context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isAutoCrit: true,
            });

            expect(getFirstPopupCall().isCrit).toBe(true);
        });

        it('sets elementalAdeptBonus to 0 when no adjustment', async () => {
            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(getFirstPopupCall().elementalAdeptBonus).toBe(0);
        });

        it('sets gwfApplied to false when GWF does not change rolls', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            const popup = getFirstPopupCall();
            expect(popup.gwfApplied).toBe(false);
            expect(popup.gwfOriginalRolls).toBeNull();
            expect(popup.gwfDisplayRolls).toEqual([5, 3]);
        });

        it('includes dc, dcType, dcSuccess from context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                dc: 15,
                dcType: 'strength',
                dcSuccess: false,
            });

            const popup = getFirstPopupCall();
            expect(popup.dc).toBe(15);
            expect(popup.dcType).toBe('strength');
            expect(popup.dcSuccess).toBe(false);
        });

        it('sets dc fields to undefined when absent from context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            const popup = getFirstPopupCall();
            expect(popup.dc).toBeUndefined();
            expect(popup.dcType).toBeUndefined();
            expect(popup.dcSuccess).toBeUndefined();
        });

        it('includes tavernBrawlerRerolls from context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                tavernBrawlerRerolls: [1, 2],
            });

            expect(getFirstPopupCall().tavernBrawlerRerolls).toEqual([1, 2]);
        });

        it('sets tavernBrawlerRerolls to null when not in context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().tavernBrawlerRerolls).toBeNull();
        });
    });

    describe('bardic inspiration passthrough', () => {
        it('passes bardicInspirationOffense and die size through from context', async () => {
            hasBardicInspirationOffense.mockReturnValue(true);
            getBardicInspirationDieSize.mockReturnValue(6);
            getBardicInspirationDieSizeFromClass.mockReturnValue(6);

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                bardicInspirationOffense: true,
                bardicInspirationOffenseDieSize: 6,
            });

            const popup = getFirstPopupCall();
            expect(popup.bardicInspirationOffense).toBe(true);
            expect(popup.bardicInspirationOffenseDieSize).toBe(6);
        });

        it('sets bardicInspirationOffense to false when context flag is absent', async () => {
            hasBardicInspirationOffense.mockReturnValue(false);

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().bardicInspirationOffense).toBe(false);
        });
    });

    describe('empowered spell passthrough', () => {
        it('passes empoweredSpell and cha mod through from context', async () => {
            hasEmpoweredSpell.mockReturnValue(true);
            getChaModifier.mockReturnValue(3);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                empoweredSpell: true,
                empoweredSpellChaMod: 3,
            });

            const popup = getFirstPopupCall();
            expect(popup.empoweredSpell).toBe(true);
            expect(popup.empoweredSpellChaMod).toBe(3);
        });

        it('sets empoweredSpell to false when context flag is absent', async () => {
            hasEmpoweredSpell.mockReturnValue(false);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(getFirstPopupCall().empoweredSpell).toBe(false);
        });
    });

    describe('spellName passthrough', () => {
        it('includes spellName from context', async () => {
            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                spellName: 'Fire Bolt',
            });

            expect(getFirstPopupCall().spellName).toBe('Fire Bolt');
        });

        it('sets spellName to empty string when not in context', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().spellName).toBe('');
        });
    });

    describe('piercer puncture availability', () => {
        function makePiercerStats() {
            return {
                reactions: [{ automation: { type: 'piercer_puncture' } }],
            };
        }

        it('sets piercerPuncture true when piercing damage, feat present, and not used', async () => {
            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'piercing',
                playerStats: makePiercerStats(),
            });

            expect(getFirstPopupCall().piercerPuncture).toBe(true);
        });

        it('sets piercerPuncture false when damage type is not piercing', async () => {
            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                playerStats: makePiercerStats(),
            });

            expect(getFirstPopupCall().piercerPuncture).toBe(false);
        });

        it('sets piercerPuncture false when already used this turn', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === 'piercerPunctureUsedThisTurn') return true;
                return null;
            });

            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'piercing',
                playerStats: makePiercerStats(),
            });

            expect(getFirstPopupCall().piercerPuncture).toBe(false);
        });

        it('sets piercerPuncture false when feat is not present', async () => {
            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'piercing',
                playerStats: {},
            });

            expect(getFirstPopupCall().piercerPuncture).toBe(false);
        });

        it('sets piercerPuncture false when playerStats is missing', async () => {
            const fn = createFn();
            await fn('Rapier', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'piercing',
            });

            expect(getFirstPopupCall().piercerPuncture).toBe(false);
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
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isMelee: true,
                playerStats: makeSavageStats(),
            });

            expect(getFirstPopupCall().savageAttacker).toBe(true);
        });

        it('sets savageAttacker true for unarmed strikes when feat present', async () => {
            const fn = createFn();
            await fn('Unarmed Strike', '1d4', 4, [4], 0, {
                targetName: 'Goblin',
                damageType: 'bludgeoning',
                isUnarmedStrike: true,
                playerStats: makeSavageStats(),
            });

            expect(getFirstPopupCall().savageAttacker).toBe(true);
        });

        it('sets savageAttacker false for ranged attacks even with feat', async () => {
            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                isMelee: false,
                playerStats: makeSavageStats(),
            });

            expect(getFirstPopupCall().savageAttacker).toBe(false);
        });

        it('sets savageAttacker false when already used this round', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign') return [];
                if (key === 'TestFighter' && prop === '_Savage_Attacker_usedRound') return true;
                return null;
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isMelee: true,
                playerStats: makeSavageStats(),
            });

            expect(getFirstPopupCall().savageAttacker).toBe(false);
        });

        it('sets savageAttacker false when feat is not present', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isMelee: true,
                playerStats: {},
            });

            expect(getFirstPopupCall().savageAttacker).toBe(false);
        });

        it('sets savageAttacker false when playerStats is missing', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isMelee: true,
            });

            expect(getFirstPopupCall().savageAttacker).toBe(false);
        });
    });

    describe('weapon type classification', () => {
        it('sets weaponType to unarmed for unarmed strikes', async () => {
            const fn = createFn();
            await fn('Unarmed Strike', '1d4', 4, [4], 0, {
                targetName: 'Goblin',
                damageType: 'bludgeoning',
                isUnarmedStrike: true,
            });

            expect(getFirstPopupCall().weaponType).toBe('unarmed');
        });

        it('sets weaponType to melee for melee attacks', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isMelee: true,
            });

            expect(getFirstPopupCall().weaponType).toBe('melee');
        });

        it('sets weaponType to ranged for ranged attacks', async () => {
            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                isMelee: false,
            });

            expect(getFirstPopupCall().weaponType).toBe('ranged');
        });

        it('defaults weaponType to melee when isMelee is undefined', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().weaponType).toBe('melee');
        });

        it('defaults weaponType to ranged when damageType is ranged', async () => {
            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'ranged',
            });

            expect(getFirstPopupCall().weaponType).toBe('ranged');
        });
    });

    describe('intercepted damage popup data', () => {
        it('includes interceptedFeature and adjusted values when damage is intercepted', async () => {
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
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            const popup = getFirstPopupCall();
            expect(popup.interceptedFeature).toBe('Shield Boy');
            expect(popup.finalDamage).toBe(3);
        });

        it('excludes interceptedFeature when damage is not intercepted', async () => {
            applyDamageToTarget.mockReturnValue({
                finalDamage: 8,
                newHp: 5,
                damageReduced: false,
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().interceptedFeature).toBeUndefined();
        });
    });

    describe('holy aura save result passthrough', () => {
        it('includes holyAuraSaveResult in popup when present in applyResult', async () => {
            applyDamageToTarget.mockReturnValue({
                finalDamage: 8,
                newHp: 5,
                damageReduced: false,
                holyAuraSaveResult: { success: true, saveType: 'wisdom' },
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().holyAuraSaveResult).toEqual({ success: true, saveType: 'wisdom' });
        });

        it('excludes holyAuraSaveResult when not in applyResult', async () => {
            applyDamageToTarget.mockReturnValue({
                finalDamage: 8,
                newHp: 5,
                damageReduced: false,
            });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(getFirstPopupCall().holyAuraSaveResult).toBeUndefined();
        });
    });

    describe('applyDamageToTarget call verification', () => {
        it('calls applyDamageToTarget with correct arguments for plain damage', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            const [, target, damage, damageTypes, campaign, , , attacker] =
                applyDamageToTarget.mock.calls[0];
            expect(target).toBe('Goblin');
            expect(damage).toBe(8);
            expect(damageTypes).toEqual(['slashing']);
            expect(campaign).toBe('test-campaign');
            expect(attacker).toBe('TestFighter');
        });

        it('calls applyDamageToTarget with adjusted total when elemental adept modifies damage', async () => {
            applyMinDamageAdjustment.mockImplementation((d) => d + 2);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.objectContaining({ creatures: expect.any(Array) }),
                'Goblin',
                10,
                ['fire'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestFighter',
                true
            );
        });
    });

    describe('magic missile immunity path', () => {
        it('returns early with immunity popup when target is immune to magic missile', async () => {
            isMagicMissileImmune.mockReturnValue(true);
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });

            const fn = createFn();
            await fn('Magic Missile', '1d4+1', 5, [4, 1], 1, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            const popup = getFirstPopupCall();
            expect(popup.type).toBe('damage');
            expect(popup.finalDamage).toBe(0);
            expect(popup.damageReduced).toBe(true);
            expect(popup.note).toBe('Shield: Immune to Magic Missile');
            expect(popup.damageApplied).toBe(true);
        });

        it('does not call applyDamageToTarget for magic missile immunity', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            const fn = createFn();
            await fn('Magic Missile', '1d4+1', 5, [4, 1], 1, {
                targetName: 'Goblin',
                damageType: 'force',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('auto-miss routing', () => {
        it('routes to auto-miss handler when isAutoMiss is true', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isAutoMiss: true,
                rangeReason: 'Out of range',
            });

            const popup = getFirstPopupCall();
            expect(popup.type).toBe('auto-miss');
            expect(popup.name).toBe('Longsword');
            expect(popup.rangeReason).toBe('Out of range');
            expect(popup.damageApplied).toBeUndefined();
        });

        it('does not call applyDamageToTarget for auto-miss', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
                isAutoMiss: true,
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('AoE routing', () => {
        it('routes to AoE handler when targetName starts with overlay-', async () => {
            const { readAoeContext } = await import('./loggedDiceRollUtils.js');
            readAoeContext.mockResolvedValue({
                overlay: { label: 'Test AoE', shape: 'cone' },
                players: [],
                npcs: [],
            });

            const { getAffectedCreatures, processAoeNpcs } = await import('../../services/rules/combat/aoeService.js');
            getAffectedCreatures.mockReturnValue([]);
            processAoeNpcs.mockReturnValue([]);

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'overlay-1',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'dex',
                dcSuccess: 'none',
            });

            expect(deps.setPopupHtml).toHaveBeenCalled();
            const popup = deps.setPopupHtml.mock.calls[0][0];
            expect(typeof popup).toBe('string');
            expect(popup).toContain('Fireball');
        });

        it('does not call applyDamageToTarget for AoE routing', async () => {
            const { readAoeContext } = await import('./loggedDiceRollUtils.js');
            readAoeContext.mockResolvedValue({
                overlay: { label: 'Test AoE', shape: 'cone' },
                players: [],
                npcs: [],
            });

            const { getAffectedCreatures, processAoeNpcs } = await import('../../services/rules/combat/aoeService.js');
            getAffectedCreatures.mockReturnValue([]);
            processAoeNpcs.mockReturnValue([]);

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'overlay-1',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'dex',
                dcSuccess: 'none',
            });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });
    });

    describe('NPC save damage routing', () => {
        it('routes to NPC save handler when saveDc and saveType are present for NPC target', async () => {
            const coronaAura = await import('../../services/combat/auras/coronaAuraUtils.js');
            coronaAura.getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });

            const elderChampion = await import('../../services/combat/auras/elderChampionAuraUtils.js');
            elderChampion.getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });

            const { rollSaveForCreature } = await import('../../services/rules/combat/applyDamage.js');
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 2, total: 10, rawRolls: [8] });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'dex',
                dcSuccess: 'half',
            });

            expect(deps.setPopupHtml).toHaveBeenCalled();
            const popup = getFirstPopupCall();
            expect(popup.type).toBe('save-damage');
            expect(popup.saveDc).toBe(15);
            expect(popup.saveType).toBe('dex');
            expect(popup.dcSuccess).toBe('half');
        });
    });

    describe('behavioral verification', () => {
        it('calls logEntry with roll data', async () => {
            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'slashing',
            });

            expect(deps.logEntry).toHaveBeenCalled();
            const logData = deps.logEntry.mock.calls[0][0];
            expect(logData.type).toBe('roll');
            expect(logData.rollType).toBe('damage');
            expect(logData.characterName).toBe('TestFighter');
            expect(logData.name).toBe('Longsword');
            expect(logData.finalDamage).toBe(8);
        });

        it('uses adjustedTotal for applyDamageToTarget but original rolls in popup', async () => {
            applyMinDamageAdjustment.mockReturnValue(10);

            const fn = createFn();
            await fn('Fire Bolt', '1d10', 8, [8], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
            });

            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.objectContaining({ creatures: expect.any(Array) }),
                'Goblin',
                10,
                ['fire'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestFighter',
                true
            );

            const popup = getFirstPopupCall();
            expect(popup.total).toBe(10);
            expect(popup.rolls).toEqual([8]);
        });

        it('handles missing target gracefully', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [] });

            const fn = createFn();
            await fn('Longsword', '1d8+3', 8, [5, 3], 3, {
                targetName: 'NonExistent',
                damageType: 'slashing',
            });

            const popup = getFirstPopupCall();
            expect(popup.targetName).toBeUndefined();
        });
    });
});
