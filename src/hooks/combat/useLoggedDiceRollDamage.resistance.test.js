// @maintained-by-ai: 2026-10-14
// Resistance consumer fold in the damage wrapper (createLogDamageAndShow →
// handlePlainDamage.js rollResistanceReduction): te matching (target, chosen
// damage type, case-insensitive), the 1d4 reduction folded into the total
// handed to applyDamageToTarget (clamped ≥ 0), the resistanceReduction/
// resistanceRoll fields on popup + damage-log data, and the ability_use log
// row. 2024 RAW: "reduce the total damage taken by 1d4 ... only once per
// turn" (public/data/2024/spells.json Resistance).
// Owned elsewhere, NOT duplicated here: once-per-turn flag gate and re-arm
// across turns (handlePlainDamage.resistanceReArm.test.js), the re-arm
// PRODUCER turnStartEffects clears the flag (turnStartEffects.resistancePerTurn
// .test.js), general popup structure (useLoggedDiceRollDamage.popup-data
// .test.js), grant/replace/rest-clearing (resistanceHandler.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(() => false),
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(() => false),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(() => 0),
}));

vi.mock('./handlers/handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../services/ui/logService.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('SP-099 — resistance consumer fold in the damage wrapper', () => {
    const TARGET = 'Goblin';
    const CAMPAIGN = 'test-campaign';

    const deps = {
        characterName: 'TestWizard',
        campaignName: CAMPAIGN,
        characters: [{ name: 'TestWizard', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: TARGET, type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        applyDamageToTarget.mockImplementation((_cs, _name, dmg) => ({ finalDamage: dmg, newHp: 13 - dmg }));
    });

    // te + flag setup: chosen type matches, unused this turn; 1d4 answers
    // with resRollTotal. rollExpression mock distinguishes the resistance
    // die from any other expression so totals stay honest.
    function setResistanceTe({ chosenType = 'fire', resRollTotal = 3, tes } = {}) {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return tes ?? [{ target: TARGET, effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType }];
            }
            if (prop === 'resistanceUsedThisTurn') return false;
            return null;
        });
        rollExpression.mockImplementation((expr) =>
            expr === '1d4' ? { total: resRollTotal, rolls: [resRollTotal] } : { total: 8, rolls: [8] });
    }

    function attack({ total = 8, rolls = [8], damageType = 'fire' } = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Fire Bolt', formula: '1d10', total, rolls, modifier: 0,
            context: { targetName: TARGET, damageType },
        });
    }

    const d4RollCalls = () => rollExpression.mock.calls.filter(c => c[0] === '1d4');
    const firstPopup = () => deps.setPopupHtml.mock.calls[0][0];
    const resistanceLogs = () => addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use' && c[1]?.abilityName === 'Resistance');

    it('folds the 1d4 reduction into applied damage, popup, and both logs', async () => {
        setResistanceTe({ chosenType: 'fire', resRollTotal: 3 });

        await attack({ total: 8 });

        expect(d4RollCalls()).toHaveLength(1);
        // Honest value fold: 8 − roll(3) = 5, with the standard apply options.
        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object), TARGET, 5, ['fire'],
            expect.objectContaining({ campaignName: CAMPAIGN, attackerName: 'TestWizard', ignoreResistance: false, suppressHpLog: true }),
        );
        expect(firstPopup()).toMatchObject({ resistanceReduction: 3, resistanceRoll: 3 });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ resistanceReduction: 3, resistanceRoll: 3 }));

        expect(resistanceLogs()).toHaveLength(1);
        expect(resistanceLogs()[0][1]).toMatchObject({
            characterName: TARGET,
            abilityName: 'Resistance',
            description: expect.stringContaining('reduced damage by 3 (1d4)'),
        });
    });

    it('matches the chosen damage type case-insensitively (registry stores "Fire")', async () => {
        setResistanceTe({ chosenType: 'Fire', resRollTotal: 2 });

        await attack({ total: 8, damageType: 'fire' });

        expect(d4RollCalls()).toHaveLength(1);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), TARGET, 6, ['fire'], expect.any(Object));
        expect(firstPopup()).toMatchObject({ resistanceReduction: 2 });
    });

    it('finds the resistance te among unrelated campaign effects', async () => {
        setResistanceTe({
            resRollTotal: 2,
            tes: [
                { target: TARGET, effect: 'some_other_effect', source: 'X' },
                { target: 'Ogre', effect: 'resistance_damage_reduction', source: 'X', chosenType: 'fire' },
                { target: TARGET, effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType: 'fire' },
            ],
        });

        await attack({ total: 8 });

        expect(d4RollCalls()).toHaveLength(1);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), TARGET, 6, ['fire'], expect.any(Object));
    });

    it('clamps the reduced total at zero when the 1d4 exceeds the damage', async () => {
        setResistanceTe({ chosenType: 'fire', resRollTotal: 4 });

        await attack({ total: 2, rolls: [2] });

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), TARGET, 0, ['fire'], expect.any(Object));
        // The fold clamps the applied total; the popup reports the honest roll.
        expect(firstPopup()).toMatchObject({ resistanceReduction: 4, resistanceRoll: 4 });
    });

    it('passes full damage through untouched when the te is absent, type-mismatched, or aimed at another target', async () => {
        const scenarios = [
            ['no resistance te', []],
            ['type mismatch', [{ target: TARGET, effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType: 'cold' }]],
            ['target mismatch', [{ target: 'Ogre', effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType: 'fire' }]],
        ];

        for (const [label, tes] of scenarios) {
            vi.clearAllMocks();
            setResistanceTe({ tes });

            await attack({ total: 8 });

            expect(d4RollCalls(), label).toHaveLength(0);
            expect(applyDamageToTarget, label).toHaveBeenCalledWith(expect.any(Object), TARGET, 8, ['fire'], expect.any(Object));
            expect(firstPopup(), label).toMatchObject({ resistanceReduction: 0, resistanceRoll: null });
            expect(resistanceLogs(), label).toHaveLength(0);
            expect(setRuntimeValue, label).not.toHaveBeenCalledWith(TARGET, 'resistanceUsedThisTurn', true, CAMPAIGN);
        }
    });
});
