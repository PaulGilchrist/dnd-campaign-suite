// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    setRuntimeValue: vi.fn(),
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

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { addEntry } from '../../services/ui/logService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterSave, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('NPC save damage edge cases', () => {
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

    beforeEach(() => {
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        playerIsImmuneToCondition.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        computeDamageAfterSave.mockImplementation((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total);
        rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3, rawRolls: [8] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('handles soulstitch protection on NPC save damage', async () => {
        hasSoulstitchProtection.mockReturnValue(true);
        applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 13, damageReduced: true });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            saveResult: 'soulstitch_auto_success',
        }));
        expect(applyDamageToTarget).toHaveBeenCalledWith(
            expect.any(Object),
            'Goblin',
            0,
            ['fire'],
            'test-campaign',
            expect.any(Array),
            false,
            'TestWizard',
            true
        );
    });

    it('handles advantage on save from saveModifiers', async () => {
        rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        deps.characters = [
            {
                name: 'Goblin',
                computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12 },
                saveModifiers: [
                    { target: 'saving_throw', effect: 'advantage', condition: 'against_spell' },
                ],
            },
        ];

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(rollSaveForCreature).toHaveBeenCalledWith(
            expect.any(Object),
            'DEX',
            15,
            false,
            true // advantage
        );
    });

    it('applies ignoreResistance flag to secondary damage', async () => {
        hasIgnoreResistance.mockReturnValue(true);
        rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
        rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });

        const fn = createFn();
        await fn('Eldritch Blast', '2d10', 10, [6, 4], 0, {
            targetName: 'Goblin',
            damageType: 'force',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            autoDamageSecondaryFormula: '1d10',
            autoDamageSecondaryDamageType: 'fire',
            playerStats: { automation: { passives: [] } },
        });

        expect(hasIgnoreResistance).toHaveBeenCalledWith(
            expect.any(Object),
            'fire'
        );
    });

    it('logs hp_change threshold when target dies', async () => {
        applyDamageToTarget.mockReturnValue({ finalDamage: 13, newHp: 0, damageReduced: false });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'hp_change',
            targetName: 'Goblin',
            currentHp: 0,
            isUnconscious: true,
        }));
    });

    it('logs hp_change threshold when target becomes bloodied', async () => {
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: false });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'hp_change',
            threshold: 'bloodied',
        }));
    });

    it('handles twin target save damage for NPCs', async () => {
        rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });
        applyDamageToTarget
            .mockReturnValueOnce({ finalDamage: 10, newHp: 3, damageReduced: false })
            .mockReturnValueOnce({ finalDamage: 10, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
            ],
        });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Goblin',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicTwinTarget: 'Orc',
        });

        expect(applyDamageToTarget.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(deps.setPopupHtml.mock.calls.length).toBeGreaterThanOrEqual(2);
        const secondCallArg = deps.setPopupHtml.mock.calls[1][0];
        expect(typeof secondCallArg).toBe('function');
    });


});
