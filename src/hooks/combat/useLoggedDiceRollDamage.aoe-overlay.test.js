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
    getSoulstitchProtectedCreatures: vi.fn(() => []),
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

vi.mock('./handlers/handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { hasSoulstitchProtection, readAoeContext } from './loggedDiceRollUtils.js';
import { getAffectedCreatures, processAoeNpcs, sendAoePlayerSaves } from '../../services/rules/combat/aoeService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';

describe('AoE overlay path', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ally1', computedStats: { armorClass: 14, saveBonuses: { DEX: 2 } } },
        ],
        charactersRef: { current: [{ name: 'Ally1', computedStats: { armorClass: 14, saveBonuses: { DEX: 2 } } }] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const defaultOverlayCtx = {
        overlay: { label: 'Fireball Zone', shape: 'circle', radius: 20 },
        players: [{ name: 'Ally1' }],
        npcs: [{ name: 'Goblin' }],
    };

    const defaultCombatSummary = {
        creatures: [
            { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
            { name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 },
        ],
    };

    beforeEach(() => {
        vi.resetAllMocks();
        deps.pendingSaves = {};
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue(defaultCombatSummary);
        readAoeContext.mockResolvedValue(defaultOverlayCtx);
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 } },
        ]);
        processAoeNpcs.mockReturnValue([]);
        sendAoePlayerSaves.mockReturnValue([]);
        hasSoulstitchProtection.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('routes to aoE handler when targetName starts with overlay-', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(readAoeContext).toHaveBeenCalledWith('test-campaign', '1');
        expect(getAffectedCreatures).toHaveBeenCalled();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'aoe-damage',
            targetName: 'Fireball Zone',
        }));
        expect(deps.setPopupHtml).toHaveBeenCalled();
    });

    it('does nothing when readAoeContext returns null', async () => {
        readAoeContext.mockResolvedValue(null);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
        });

        expect(readAoeContext).toHaveBeenCalledWith('test-campaign', '1');
        expect(getAffectedCreatures).not.toHaveBeenCalled();
        expect(processAoeNpcs).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ rollType: 'aoe-damage' }));
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
    });

    it('does nothing when loadCombatSummary returns null', async () => {
        loadCombatSummary.mockResolvedValue(null);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
        });

        expect(getAffectedCreatures).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ rollType: 'aoe-damage' }));
    });

    it('handles non-save AoE damage (no saveDc/saveType)', async () => {
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 } },
            { creature: { name: 'Ally1', type: 'player', ac: 14 } },
        ]);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
        });

        expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 20, ['fire'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestWizard' });
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'aoe-damage',
            affectedCount: 2,
        }));
    });

    it('writes lastAttack via setRuntimeValue for AoE', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({
                attackerName: 'TestWizard',
                rollType: 'aoe-damage',
                damageType: 'fire',
                affectedTargets: ['Goblin'],
            }),
            'test-campaign'
        );
    });

    it('uses attackerName from context when provided', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            attackerName: 'Ally2',
        });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'lastAttack',
            expect.objectContaining({ attackerName: 'Ally2' }),
            'test-campaign'
        );
    });

    it('registers player save prompts when players are affected', async () => {
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 } },
            { creature: { name: 'Ally1', type: 'player', ac: 14 } },
        ]);
        sendAoePlayerSaves.mockReturnValue([{ promptId: 'save-1', targetName: 'Ally1' }]);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(sendAoePlayerSaves).toHaveBeenCalled();
        expect(deps.pendingSaves['save-1']).toEqual(expect.objectContaining({
            targetName: 'Ally1',
            saveDc: 15,
            saveType: 'DEX',
            isAoe: true,
        }));
    });

    it('skips save prompts for soulstitch-protected players', async () => {
        getAffectedCreatures.mockReturnValue([
            { creature: { name: 'Goblin', type: 'npc', ac: 12 } },
            { creature: { name: 'Ally1', type: 'player', ac: 14 } },
        ]);
        hasSoulstitchProtection.mockReturnValue(true);

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(hasSoulstitchProtection).toHaveBeenCalledWith('Ally1', 'TestWizard', 'test-campaign');
        expect(sendAoePlayerSaves).not.toHaveBeenCalled();
        expect(deps.pendingSaves).toEqual({});
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally1', 0, ['fire'], 'test-campaign', expect.any(Array), { ignoreResistance: false, attackerName: 'TestWizard' });
    });

    it('applies correct overlay label from overlay context', async () => {
        readAoeContext.mockResolvedValue({
            overlay: { label: 'Custom Zone', shape: 'square', radius: 15 },
            players: [],
            npcs: [{ name: 'Goblin' }],
        });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
        });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            targetName: 'Custom Zone',
        }));
    });

    it('uses shape as fallback label when overlay has no label', async () => {
        readAoeContext.mockResolvedValue({
            overlay: { shape: 'cone', radius: 30 },
            players: [],
            npcs: [{ name: 'Goblin' }],
        });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
        });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            targetName: 'cone',
        }));
    });

    it('passes displayRolls and adjustedTotal to logEntry', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rolls: [3, 4, 5, 2, 3, 3],
            total: 20,
        }));
    });

    it('handles overlay id extraction from various targetName formats', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'overlay-42',
            damageType: 'fire',
        });

        expect(readAoeContext).toHaveBeenCalledWith('test-campaign', '42');
    });
});
