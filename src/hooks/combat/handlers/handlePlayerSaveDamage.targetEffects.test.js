// @maintained-by-ai: 2026-10-14
// handlePlayerSaveDamage targetEffect lane: verifies the handler's resolveTargetSaveContext
// wiring — activeBuffs-derived flags, strict-=== true runtime flags, the elder champion
// attacker self-guard, campaign.targetEffects filtering for the target, rider and
// ability-scoped save-disadvantage tes (per targetEffectDefinitions.js registry), and
// Death Ward save advantage on the pending prompt / save prompt.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
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

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { isDeathWardActive } from '../../../services/automation/handlers/buffs/deathWardHandler.js';

const BASE_CONTEXT = {
    saveDc: 15,
    saveType: 'CON',
    dcSuccess: 'half',
    damageType: 'Poison',
    targetName: 'TestWizard',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

let deps;

function mockRuntimeReads(reads) {
    // keys are 'storeKey.subKey'; everything else resolves null (handler applies its own defaults)
    getRuntimeValue.mockImplementation((key, subKey) => reads[`${key}.${subKey}`] ?? null);
}

// Runs the full save-prompt path and returns the args passed to computeConditionEffects.
async function runSave(context = BASE_CONTEXT) {
    const handler = createPlayerSaveDamageHandler(deps);
    await handler({
        name: 'Acid Arrow',
        formula: '4d4',
        total: 10,
        rolls: [3, 4, 2, 1],
        modifier: 0,
        context,
        adjustedTotal: 10,
        combatSummary: BASE_COMBAT_SUMMARY,
        displayRolls: [3, 4, 2, 1],
    });
    expect(computeConditionEffects).toHaveBeenCalledTimes(1);
    return computeConditionEffects.mock.calls[0][0];
}

describe('handlePlayerSaveDamage - targetEffects and buff flags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: 'TestWizard',
            campaignName: 'test-campaign',
            characters: [{ name: 'TestWizard' }],
            charactersRef: { current: [] },
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
            pendingSaves: {},
        };
        getRuntimeValue.mockReset().mockReturnValue(null);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        isDeathWardActive.mockReturnValue(false);
    });

    const ALL_FLAGS_FALSE = {
        shapeShiftActive: false,
        seeInvisibilityActive: false,
        isRaging: false,
        isProtectionFromPoisonActive: false,
    };

    describe('buff flags derived from activeBuffs', () => {
        it.each([
            {
                title: 'shape_shift',
                buffs: [{ effect: 'shape_shift' }],
                expected: { ...ALL_FLAGS_FALSE, shapeShiftActive: true },
            },
            {
                title: 'see_invisibility',
                buffs: [{ effect: 'see_invisibility' }],
                expected: { ...ALL_FLAGS_FALSE, seeInvisibilityActive: true },
            },
            {
                title: 'damageBonusExpression (rage)',
                buffs: [{ damageBonusExpression: '2d6' }],
                expected: { ...ALL_FLAGS_FALSE, isRaging: true },
            },
            {
                title: 'Protection from Poison name+effect match',
                buffs: [{ name: 'Protection from Poison', effect: 'protection_from_poison' }],
                expected: { ...ALL_FLAGS_FALSE, isProtectionFromPoisonActive: true },
            },
            {
                title: 'Protection from Poison name mismatch',
                buffs: [{ name: 'Shield', effect: 'protection_from_poison' }],
                expected: ALL_FLAGS_FALSE,
            },
            {
                title: 'Protection from Poison effect mismatch',
                buffs: [{ name: 'Protection from Poison', effect: 'other' }],
                expected: ALL_FLAGS_FALSE,
            },
            {
                title: 'no buffs',
                buffs: [],
                expected: ALL_FLAGS_FALSE,
            },
        ])('derives $title flag from activeBuffs', async ({ buffs, expected }) => {
            mockRuntimeReads({ 'TestWizard.activeBuffs': buffs });

            const args = await runSave();

            expect(args).toMatchObject(expected);
            // unrelated flags must never leak as undefined
            expect(args.targetEffects).toEqual([]);
        });
    });

    describe('livingLegend / elderChampion target flags (strict === true)', () => {
        it.each([
            {
                title: 'true/true',
                living: true,
                elder: true,
                expected: { isLivingLegendActive: true, isElderChampionActive: true },
            },
            {
                title: 'false/null coerce to false',
                living: false,
                elder: null,
                expected: { isLivingLegendActive: false, isElderChampionActive: false },
            },
        ])('passes runtime flags ($title)', async ({ living, elder, expected }) => {
            mockRuntimeReads({
                'TestWizard.livingLegendActive': living,
                'TestWizard.elderChampionActive': elder,
            });

            const args = await runSave();

            expect(args).toMatchObject(expected);
        });
    });

    describe('isElderChampionAttackerActive (attacker-side flag with self-guard)', () => {
        it.each([
            {
                title: 'active attacker distinct from target',
                attackerName: 'Goblin',
                attackerActive: true,
                expected: true,
            },
            {
                title: 'absent attackerName resolves to self — guard blocks own flag',
                attackerName: undefined,
                attackerActive: true,
                expected: false,
            },
            {
                title: 'distinct but inactive attacker',
                attackerName: 'Goblin',
                attackerActive: false,
                expected: false,
            },
        ])('isElderChampionAttackerActive=$expected when $title', async ({ attackerName, attackerActive, expected }) => {
            mockRuntimeReads({
                'Goblin.elderChampionActive': attackerActive,
                'TestWizard.elderChampionActive': false,
            });

            const context = { ...BASE_CONTEXT, ...(attackerName ? { attackerName } : {}) };
            const { isElderChampionAttackerActive } = await runSave(context);

            expect(isElderChampionAttackerActive).toBe(expected);
        });
    });

    describe('campaign.targetEffects filtered to the target', () => {
        it.each([
            {
                title: 'mixed targets keep only the target\'s own',
                te: [
                    { target: 'OtherPlayer', effect: 'some_effect' },
                    { target: 'TestWizard', effect: 'relevant_effect' },
                    { target: 'TestWizard', effect: 'another_effect' },
                ],
                expected: [
                    { target: 'TestWizard', effect: 'relevant_effect' },
                    { target: 'TestWizard', effect: 'another_effect' },
                ],
            },
            { title: 'other-target-only', te: [{ target: 'OtherPlayer', effect: 'some_effect' }], expected: [] },
            { title: 'null store', te: null, expected: [] },
        ])('passes $title', async ({ te, expected }) => {
            mockRuntimeReads({ 'campaign.targetEffects': te });

            const { targetEffects } = await runSave();

            expect(targetEffects).toEqual(expected);
        });
    });

    describe('targetEffects applied as save disadvantage', () => {
        it('disadvantage_on_next_save targeted at the player rides the prompt', async () => {
            mockRuntimeReads({ 'campaign.targetEffects': [{ target: 'TestWizard', effect: 'disadvantage_on_next_save' }] });

            await runSave();

            // buildPendingData carries save disadvantage under the metamagicHeighten key
            expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', true);
            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                promptId: 'test-guid-1234',
                disadvantage: true,
            }));
        });

        // MA-1352: ability-scoped te only bites saves of the chosen ability.
        it.each([
            { ability: 'CON', expected: true },
            { ability: 'INT', expected: false },
        ])('ability_save_disadvantage(ability=$ability) vs CON save → disadvantage=$expected', async ({ ability, expected }) => {
            mockRuntimeReads({ 'campaign.targetEffects': [{ target: 'TestWizard', effect: 'ability_save_disadvantage', ability }] });

            await runSave();

            expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('metamagicHeighten', expected);
        });
    });

    describe('Death Ward grants advantage on saves', () => {
        it('sets saveAdvantage on the pending prompt and advantage on the save prompt', async () => {
            isDeathWardActive.mockReturnValue(true);

            await runSave();

            expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                promptId: 'test-guid-1234',
                advantage: true,
            }));
        });
    });
});
