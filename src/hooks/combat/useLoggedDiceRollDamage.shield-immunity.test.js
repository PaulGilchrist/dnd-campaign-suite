// @maintained-by-ai: 2026-10-14
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
import { isMagicMissileImmune } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

// OWNER lane for the Shield-spell Magic Missile immunity contract in the
// damage wrapper (createLogDamageAndShow): zero-damage log/popup payloads,
// exact-lowercase name gate, no HP mutation. 5e + 2024 spells.json both keep
// the Shield "take no damage from Magic Missile" rule.
const IMMUNITY_NOTE = 'Shield: Immune to Magic Missile';

describe('Magic Missile shield immunity', () => {
    const deps = {
        characterName: 'Wizard1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const magicMissile = {
        name: 'Magic Missile',
        formula: '3d4+2',
        total: 8,
        rolls: [2, 3, 3],
        modifier: 2,
        context: { targetName: 'Goblin', damageType: 'force' },
    };

    beforeEach(() => {
        getRuntimeValue.mockReturnValue(null);
        isMagicMissileImmune.mockReturnValue(false);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockClear().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    describe('when target has shield buff and spell is Magic Missile', () => {
        it('logs a zero-damage entry with immunity note and skips applyDamageToTarget', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            await createLogDamageAndShow(deps)(magicMissile);

            expect(deps.logEntry).toHaveBeenCalledTimes(1);
            const logArgs = deps.logEntry.mock.calls[0][0];
            expect(logArgs).toMatchObject({
                type: 'roll',
                rollType: 'damage',
                name: 'Magic Missile',
                formula: '3d4+2',
                rolls: [2, 3, 3],
                total: 8,
                modifier: 2,
                damageType: 'force',
                targetName: 'Goblin',
                finalDamage: 0,
                note: IMMUNITY_NOTE,
                isCrit: false,
            });
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('shows damage popup with zero finalDamage, damageReduced, and resolved target HP', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            await createLogDamageAndShow(deps)(magicMissile);

            expect(loadCombatSummary).toHaveBeenCalledWith('test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledTimes(1);
            expect(deps.setPopupHtml).toHaveBeenCalledWith({
                type: 'damage',
                name: 'Magic Missile',
                formula: '3d4+2',
                rolls: [2, 3, 3],
                bonus: 0,
                modifier: 2,
                damageType: 'force',
                targetName: 'Goblin',
                total: 8,
                adjustedTotal: 0,
                targetCurrentHp: 13,
                targetMaxHp: 13,
                damageApplied: true,
                finalDamage: 0,
                damageReduced: true,
                note: IMMUNITY_NOTE,
            });
        });

        it('applies immunity for lowercase spell name since source compares via toLowerCase', async () => {
            isMagicMissileImmune.mockReturnValue(true);

            await createLogDamageAndShow(deps)({ ...magicMissile, name: 'magic missile', formula: '1d4+1', total: 3, rolls: [2, 1], modifier: 1 });

            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.objectContaining({ finalDamage: 0, note: IMMUNITY_NOTE })
            );
        });
    });

    describe('name gate: only exact "magic missile" is blocked', () => {
        it('proceeds with normal damage flow for other and similarly named spells', async () => {
            isMagicMissileImmune.mockReturnValue(true);
            const fn = createLogDamageAndShow(deps);

            await fn({ name: 'Fire Bolt', formula: '1d10', total: 5, rolls: [5], modifier: 0, context: { targetName: 'Goblin', damageType: 'fire' } });
            await fn({ name: 'Magic Missile Burst', formula: '2d4+1', total: 5, rolls: [3, 2], modifier: 1, context: { targetName: 'Goblin', damageType: 'force' } });

            expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
            expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ note: IMMUNITY_NOTE }));
            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(expect.objectContaining({ note: IMMUNITY_NOTE }));
        });
    });

    it('handles missing target in combat summary gracefully', async () => {
        isMagicMissileImmune.mockReturnValue(true);
        loadCombatSummary.mockResolvedValue({ creatures: [] });

        await createLogDamageAndShow(deps)({ ...magicMissile, context: { targetName: 'NonExistent', damageType: 'force' } });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'damage', finalDamage: 0, targetName: 'NonExistent' })
        );
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});
