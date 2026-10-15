// @maintained-by-ai: 2026-10-14
// Save-disadvantage lane: owns the corona/elder-champion/targetEffect aura →
// save-roll seam as it flows through createLogDamageAndShow into the NPC save
// handler (roll flags + forcedMode propagation). Handler-owned resolution
// (success/half damage, hp_change rows, invisibility, soulstitch, evasion,
// circle-of-power solo) lives in handleNpcSaveDamage*.test.js and the
// circle-of-power lane file.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
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
    evaluateAutoExpression: vi.fn(),
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
    computeDamageAfterSave: vi.fn((total, success) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { getCoronaSaveDisadvantage } from '../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';

describe('createLogDamageAndShow - NPC save disadvantage integration', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12 }, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultSaveResult = { roll: 8, total: 11, bonus: 3, success: false, rawRolls: [8] };

    function castFireball(contextOverride = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Fireball',
            formula: '8d6',
            total: 20,
            rolls: [3, 4, 5, 2, 3, 3],
            modifier: 0,
            context: {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                attackerName: 'TestWizard',
                ...contextOverride,
            },
        });
    }

    function saveRollArgs() {
        return rollSaveForCreature.mock.calls[0];
    }

    function saveDamageLog() {
        return deps.logEntry.mock.calls.find((call) => call[0].rollType === 'save-damage')[0];
    }

    function popupData() {
        return deps.setPopupHtml.mock.calls[0][0];
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReset().mockReturnValue(null);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    describe('corona save disadvantage', () => {
        it('applies corona disadvantage to the save roll, the log, and the popup', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true, source: 'CoronaCaster' });

            await castFireball();

            expect(getCoronaSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                targetName: 'Goblin',
                damageType: 'fire',
                skipRangeCheck: true,
            }));
            expect(saveRollArgs()).toEqual([
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true,  // disadvantage from corona
                false, // no advantage
            ]);
            expect(saveDamageLog()).toEqual(expect.objectContaining({
                rollType: 'save-damage',
                name: 'Fireball',
                targetName: 'Goblin',
                saveType: 'DEX',
                saveDc: 15,
                saveResult: 'failure',
                forcedMode: 'disadvantage',
            }));
            expect(popupData()).toEqual(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
                targetName: 'Goblin',
                saveDc: 15,
                saveType: 'DEX',
                forcedMode: 'disadvantage',
            }));
        });

        it('rolls normally when no disadvantage source applies', async () => {
            await castFireball();

            expect(saveRollArgs()).toEqual([
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                false, // no disadvantage
                false, // no advantage
            ]);
            expect(popupData().forcedMode).toBe('normal');
        });
    });

    describe('elder champion save disadvantage', () => {
        it('applies elder champion disadvantage when corona does not', async () => {
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'ElderChampion' });

            await castFireball({ playerStats: { automation: { actions: [], passives: [] } } });

            expect(getElderChampionSaveDisadvantage).toHaveBeenCalledWith(expect.objectContaining({
                attackerName: 'TestWizard',
                targetName: 'Goblin',
            }));
            expect(saveRollArgs()[3]).toBe(true);
            expect(saveDamageLog().forcedMode).toBe('disadvantage');
        });

        it('short-circuits elder champion when corona already set disadvantage', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: true });

            await castFireball({ playerStats: { automation: { actions: [], passives: [] } } });

            expect(getCoronaSaveDisadvantage).toHaveBeenCalled();
            expect(getElderChampionSaveDisadvantage).not.toHaveBeenCalled();
            expect(saveRollArgs()[3]).toBe(true);
        });
    });

    describe('disadvantage + advantage flags coexist (disadvantage wins display)', () => {
        it('passes both flags when corona and circle of power apply; forcedMode stays disadvantage', async () => {
            getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });
            isCircleOfPowerActive.mockReturnValue(true);

            await castFireball();

            expect(saveRollArgs()).toEqual([
                expect.objectContaining({ name: 'Goblin' }),
                'DEX',
                15,
                true, // disadvantage from corona
                true, // advantage from circle of power
            ]);
            expect(saveDamageLog().forcedMode).toBe('disadvantage');
            expect(popupData().forcedMode).toBe('disadvantage');
        });
    });

    describe('targetEffects disadvantage_on_next_save', () => {
        it('consumes the stamp into a disadvantaged roll and forcedMode log', async () => {
            getRuntimeValue.mockImplementation((key, prop, cn) => {
                if (key === 'campaign' && prop === 'targetEffects' && cn === 'test-campaign') return [
                    { target: 'Goblin', effect: 'disadvantage_on_next_save' },
                ];
                return null;
            });

            await castFireball();

            expect(saveRollArgs()[3]).toBe(true); // disadvantage from targetEffect stamp
            expect(saveDamageLog().forcedMode).toBe('disadvantage');
        });
    });
});
