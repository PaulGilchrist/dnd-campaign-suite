// @maintained-by-ai: 2026-10-14
// Authoritative popup-data lane for createLogDamageAndShow: plain-damage popup
// structure/flags AND the NPC save-damage popup shape, plus routing (auto-miss,
// AoE string popup) and missing-target handling.
// Covered elsewhere, not duplicated here: magic-missile immunity
// (useLoggedDiceRollDamage.shield-immunity.test.js), AoE internals
// (useLoggedDiceRollDamage.aoe-overlay.test.js), save-handler mechanics
// (handlers/handleNpcSaveDamage.*.test.js).
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
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
import { applyMinDamageAdjustment, isMagicMissileImmune, readAoeContext } from './loggedDiceRollUtils.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../services/rules/combat/applyDamage.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { getAffectedCreatures, processAoeNpcs } from '../../services/rules/combat/aoeService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize, getBardicInspirationDieSizeFromClass } from '../../services/combat/auras/bardicInspirationState.js';
import { hasEmpoweredSpell } from '../../services/rules/spells/empoweredSpellService.js';
import { getChaModifier } from '../../services/rules/spells/metamagicRules.js';

describe('useLoggedDiceRollDamage popup data (plain + save lanes)', () => {
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
        getRuntimeValue.mockReset().mockImplementation((key) => {
            if (key === 'campaign') return [];
            return null;
        });
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockReset().mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        isMagicMissileImmune.mockReset().mockReturnValue(false);
        hasIgnoreResistance.mockReset().mockReturnValue(false);
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

    describe('plain damage popup data', () => {
        it('carries the full core popup structure with sane defaults', async () => {
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
            } });

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
            // defaults: no crit, no adjustments, no passthrough flags
            expect(popup.isCrit).toBe(false);
            expect(popup.elementalAdeptBonus).toBe(0);
            expect(popup.gwfApplied).toBe(false);
            expect(popup.gwfOriginalRolls).toBeNull();
            expect(popup.gwfDisplayRolls).toEqual([5, 3]);
            expect(popup.dc).toBeUndefined();
            expect(popup.dcType).toBeUndefined();
            expect(popup.dcSuccess).toBeUndefined();
            expect(popup.tavernBrawlerRerolls).toBeNull();
            expect(popup.spellName).toBe('');
            expect(popup.bardicInspirationOffense).toBe(false);
            expect(popup.empoweredSpell).toBe(false);
            expect(popup.interceptedFeature).toBeUndefined();
            expect(popup.holyAuraSaveResult).toBeUndefined();
        });

        it('sets isCrit from context.isAutoCrit', async () => {
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
                isAutoCrit: true,
            } });

            expect(getFirstPopupCall().isCrit).toBe(true);
        });

        it('routes elemental adept adjustment to damage while popup keeps original rolls', async () => {
            applyMinDamageAdjustment.mockImplementation((d) => d + 2);

            const fn = createFn();
            await fn({ name: 'Fire Bolt', formula: '1d10', total: 8, rolls: [8], modifier: 0, context: {
                targetName: 'Goblin',
                damageType: 'fire',
            } });

            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.objectContaining({ creatures: expect.any(Array) }), 'Goblin', 10, ['fire'], { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestFighter', suppressHpLog: true });

            const popup = getFirstPopupCall();
            expect(popup.total).toBe(10);
            expect(popup.adjustedTotal).toBe(10);
            expect(popup.elementalAdeptBonus).toBe(2);
            expect(popup.rolls).toEqual([8]);
        });

        it('includes interceptedFeature and damageDealt values when damage is intercepted', async () => {
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
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
            } });

            const popup = getFirstPopupCall();
            expect(popup.interceptedFeature).toBe('Shield Boy');
            expect(popup.finalDamage).toBe(3);
        });

        it('includes holyAuraSaveResult when present in applyResult', async () => {
            applyDamageToTarget.mockReturnValue({
                finalDamage: 8,
                newHp: 5,
                damageReduced: false,
                holyAuraSaveResult: { success: true, saveType: 'wisdom' },
            });

            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
            } });

            expect(getFirstPopupCall().holyAuraSaveResult).toEqual({ success: true, saveType: 'wisdom' });
        });

        it('calls applyDamageToTarget with correct arguments for plain damage', async () => {
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
            } });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            const [, target, damage, damageTypes, options] = applyDamageToTarget.mock.calls[0];
            expect(target).toBe('Goblin');
            expect(damage).toBe(8);
            expect(damageTypes).toEqual(['slashing']);
            expect(options.campaignName).toBe('test-campaign');
            expect(options.attackerName).toBe('TestFighter');
        });

        it('logs the roll entry with damage details', async () => {
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
            } });

            expect(deps.logEntry).toHaveBeenCalled();
            const logData = deps.logEntry.mock.calls[0][0];
            expect(logData.type).toBe('roll');
            expect(logData.rollType).toBe('damage');
            expect(logData.characterName).toBe('TestFighter');
            expect(logData.name).toBe('Longsword');
            expect(logData.finalDamage).toBe(8);
        });

        it('leaves targetName undefined when the target is missing from the combat summary', async () => {
            loadCombatSummary.mockResolvedValue({ creatures: [] });

            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'NonExistent',
                damageType: 'slashing',
            } });

            expect(getFirstPopupCall().targetName).toBeUndefined();
        });
    });

    describe('feature flag passthrough', () => {
        it('passes context flags through to the popup', async () => {
            const fn = createFn();
            await fn({ name: 'Fire Bolt', formula: '1d10', total: 8, rolls: [8], modifier: 0, context: {
                targetName: 'Goblin',
                damageType: 'fire',
                bardicInspirationOffense: true,
                bardicInspirationOffenseDieSize: 6,
                empoweredSpell: true,
                empoweredSpellChaMod: 3,
                spellName: 'Fire Bolt',
                dc: 15,
                dcType: 'strength',
                dcSuccess: false,
                tavernBrawlerRerolls: [1, 2],
            } });

            const popup = getFirstPopupCall();
            expect(popup.bardicInspirationOffense).toBe(true);
            expect(popup.bardicInspirationOffenseDieSize).toBe(6);
            expect(popup.empoweredSpell).toBe(true);
            expect(popup.empoweredSpellChaMod).toBe(3);
            expect(popup.spellName).toBe('Fire Bolt');
            expect(popup.dc).toBe(15);
            expect(popup.dcType).toBe('strength');
            expect(popup.dcSuccess).toBe(false);
            expect(popup.tavernBrawlerRerolls).toEqual([1, 2]);
        });

        it('derives bardic/empowered flags from services when context flags are absent', async () => {
            hasBardicInspirationOffense.mockReturnValue(true);
            getBardicInspirationDieSize.mockReturnValue(8);
            getBardicInspirationDieSizeFromClass.mockReturnValue(8);
            hasEmpoweredSpell.mockReturnValue(true);
            getChaModifier.mockReturnValue(4);

            const fn = createFn();
            await fn({ name: 'Fire Bolt', formula: '1d10', total: 8, rolls: [8], modifier: 0, context: {
                targetName: 'Goblin',
                damageType: 'fire',
                playerStats: {},
            } });

            const popup = getFirstPopupCall();
            expect(popup.bardicInspirationOffense).toBe(true);
            expect(popup.bardicInspirationOffenseDieSize).toBe(8);
            expect(popup.empoweredSpell).toBe(true);
            expect(popup.empoweredSpellChaMod).toBe(4);
        });
    });

    describe('piercer puncture availability', () => {
        const piercerStats = { reactions: [{ automation: { type: 'piercer_puncture' } }] };

        const cases = [
            { label: 'piercing damage, feat present, unused', damageType: 'piercing', playerStats: piercerStats, punctureUsed: false, expected: true },
            { label: 'non-piercing damage type', damageType: 'fire', playerStats: piercerStats, punctureUsed: false, expected: false },
            { label: 'already used this turn', damageType: 'piercing', playerStats: piercerStats, punctureUsed: true, expected: false },
            { label: 'feat not present', damageType: 'piercing', playerStats: {}, punctureUsed: false, expected: false },
            { label: 'playerStats missing', damageType: 'piercing', playerStats: undefined, punctureUsed: false, expected: false },
        ];

        it('sets piercerPuncture per availability truth table', async () => {
            for (const c of cases) {
                deps.setPopupHtml.mockClear();
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (key === 'campaign') return [];
                    if (prop === 'piercerPunctureUsedThisTurn') return c.punctureUsed;
                    return null;
                });

                const fn = createFn();
                await fn({ name: 'Rapier', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                    targetName: 'Goblin',
                    damageType: c.damageType,
                    playerStats: c.playerStats,
                } });

                expect(getFirstPopupCall().piercerPuncture, c.label).toBe(c.expected);
            }
        });
    });

    describe('savage attacker availability', () => {
        const savageStats = { automation: { passives: [{ type: 'passive_rule', effect: 'reroll_damage_once_per_turn' }] } };

        const cases = [
            { label: 'melee with feat, unused', weapon: { name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3 }, ctx: { damageType: 'slashing', isMelee: true, playerStats: savageStats }, used: false, expected: true },
            { label: 'unarmed strike with feat', weapon: { name: 'Unarmed Strike', formula: '1d4', total: 4, rolls: [4], modifier: 0 }, ctx: { damageType: 'bludgeoning', isUnarmedStrike: true, playerStats: savageStats }, used: false, expected: true },
            { label: 'ranged attack even with feat', weapon: { name: 'Fire Bolt', formula: '1d10', total: 8, rolls: [8], modifier: 0 }, ctx: { damageType: 'fire', isMelee: false, playerStats: savageStats }, used: false, expected: false },
            { label: 'already used this round', weapon: { name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3 }, ctx: { damageType: 'slashing', isMelee: true, playerStats: savageStats }, used: true, expected: false },
            { label: 'feat not present', weapon: { name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3 }, ctx: { damageType: 'slashing', isMelee: true, playerStats: {} }, used: false, expected: false },
            { label: 'playerStats missing', weapon: { name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3 }, ctx: { damageType: 'slashing', isMelee: true }, used: false, expected: false },
        ];

        it('sets savageAttacker per availability truth table', async () => {
            for (const c of cases) {
                deps.setPopupHtml.mockClear();
                getRuntimeValue.mockImplementation((key, prop) => {
                    if (key === 'campaign') return [];
                    if (prop === '_Savage_Attacker_usedRound') return c.used;
                    return null;
                });

                const fn = createFn();
                await fn({ ...c.weapon, context: { targetName: 'Goblin', ...c.ctx } });

                expect(getFirstPopupCall().savageAttacker, c.label).toBe(c.expected);
            }
        });

        it('classifies weaponType across attack kinds', async () => {
            const cases = [
                { label: 'unarmed strike', name: 'Unarmed Strike', context: { targetName: 'Goblin', damageType: 'bludgeoning', isUnarmedStrike: true }, expected: 'unarmed' },
                { label: 'melee attack', name: 'Longsword', context: { targetName: 'Goblin', damageType: 'slashing', isMelee: true }, expected: 'melee' },
                { label: 'ranged attack', name: 'Fire Bolt', context: { targetName: 'Goblin', damageType: 'fire', isMelee: false }, expected: 'ranged' },
                { label: 'isMelee undefined defaults to melee', name: 'Longsword', context: { targetName: 'Goblin', damageType: 'slashing' }, expected: 'melee' },
                { label: 'ranged damageType defaults to ranged', name: 'Fire Bolt', context: { targetName: 'Goblin', damageType: 'ranged' }, expected: 'ranged' },
            ];

            for (const c of cases) {
                deps.setPopupHtml.mockClear();
                const fn = createFn();
                await fn({ name: c.name, formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: c.context });

                expect(getFirstPopupCall().weaponType, c.label).toBe(c.expected);
            }
        });
    });

    describe('routing', () => {
        it('routes auto-miss to the auto-miss popup without applying damage', async () => {
            const fn = createFn();
            await fn({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: {
                targetName: 'Goblin',
                damageType: 'slashing',
                isAutoMiss: true,
                rangeReason: 'Out of range',
            } });

            const popup = getFirstPopupCall();
            expect(popup.type).toBe('auto-miss');
            expect(popup.name).toBe('Longsword');
            expect(popup.rangeReason).toBe('Out of range');
            expect(popup.damageApplied).toBeUndefined();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('routes overlay- targets to a string AoE popup without applying damage', async () => {
            readAoeContext.mockResolvedValue({
                overlay: { label: 'Test AoE', shape: 'cone' },
                players: [],
                npcs: [],
            });
            getAffectedCreatures.mockReturnValue([]);
            processAoeNpcs.mockReturnValue([]);

            const fn = createFn();
            await fn({ name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0, context: {
                targetName: 'overlay-1',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'dex',
                dcSuccess: 'none',
            } });

            const popup = getFirstPopupCall();
            expect(typeof popup).toBe('string');
            expect(popup).toContain('Fireball');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('routes NPC save damage to the save-damage popup with save fields', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, bonus: 2, total: 10, rawRolls: [8] });

            const fn = createFn();
            await fn({ name: 'Fireball', formula: '8d6', total: 20, rolls: [3, 4, 5, 2, 3, 3], modifier: 0, context: {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'dex',
                dcSuccess: 'half',
            } });

            const popup = getFirstPopupCall();
            expect(popup.type).toBe('save-damage');
            expect(popup.name).toBe('Fireball');
            expect(popup.saveDc).toBe(15);
            expect(popup.saveType).toBe('dex');
            expect(popup.dcSuccess).toBe('half');
            expect(popup.saveResult).toEqual({ success: false, roll: 8, bonus: 2, total: 10, rawRolls: [8] });
            expect(popup.finalDamage).toBe(8);
            expect(popup.damageApplied).toBe(true);
            expect(popup.targetCurrentHp).toBe(5);
            expect(popup.targetMaxHp).toBe(13);
            expect(popup.forcedMode).toBe('normal');
        });
    });
});
