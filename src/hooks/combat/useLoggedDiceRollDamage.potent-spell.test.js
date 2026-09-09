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

vi.mock('./loggedDiceRollUtils.js', () => ({
    isMagicMissileImmune: vi.fn(),
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(() => Promise.resolve({ disadvantage: false })),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance, evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, hasSoulstitchProtection, applyMinDamageAdjustment, isMagicMissileImmune } from './loggedDiceRollUtils.js';
import { rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Blessed Strikes — Potent Spellcasting temp HP dispatch', () => {
    const BASE_DEPS = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12 }, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const BASE_CONTEXT = {
        targetName: 'Goblin',
        damageType: 'lightning',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'none',
        isCantrip: true,
        attackerName: 'TestWizard',
    };

    const blessedStrikesAction = {
        type: 'damage_bonus',
        name: 'Blessed Strikes',
        options: ['Potent Spellcasting'],
        tempHpExpression: '1d4+2',
    };

    const playerStatsWithBlessedStrikes = {
        automation: {
            actions: [blessedStrikesAction],
            passives: [],
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: save fails (target misses)
        rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        isMagicMissileImmune.mockReturnValue(false);
        hasSoulstitchProtection.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        evaluateAutoExpression.mockReturnValue(3);
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        BASE_DEPS.logEntry.mockClear();
        BASE_DEPS.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(BASE_DEPS);
    }

    function trackEvent() {
        return new Promise((resolve) => {
            const handler = (event) => {
                window.removeEventListener('potent-spellcasting-temp-hp', handler);
                resolve(event.detail);
            };
            window.addEventListener('potent-spellcasting-temp-hp', handler);
        });
    }

    it('dispatches potent-spellcasting-temp-hp when cantrip misses and Blessed Strikes has tempHpExpression', async () => {
        const fn = createFn();
        const eventDetail = trackEvent();

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats: playerStatsWithBlessedStrikes,
        });

        const detail = await eventDetail;
        expect(detail).toBeDefined();
        expect(detail.title).toBe('Improved Blessed Strikes — Potent Spellcasting');
        expect(detail.tempHp).toBe(3);
        expect(detail.attackerName).toBe('TestWizard');
        expect(detail.confirmLabel).toBe('Grant Temp HP');
        expect(detail.campaignName).toBe('test-campaign');
        expect(Array.isArray(detail.targets)).toBe(true);
        expect(detail.targets.length).toBeGreaterThan(0);
    });

    it('does not dispatch when Blessed Strikes lacks tempHpExpression', async () => {
        const actionsWithoutTempHp = [
            {
                type: 'damage_bonus',
                name: 'Blessed Strikes',
                options: ['Potent Spellcasting'],
            },
        ];

        const playerStats = {
            automation: { actions: actionsWithoutTempHp, passives: [] },
        };

        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });

    it('does not dispatch when target succeeds on save', async () => {
        rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] });

        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats: playerStatsWithBlessedStrikes,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });

    it('does not dispatch when not a cantrip', async () => {
        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Fireball', '8d6', 20, [4, 6, 2, 5, 1, 3, 4, 5], 0, {
            ...BASE_CONTEXT,
            isCantrip: false,
            playerStats: playerStatsWithBlessedStrikes,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });

    it('does not dispatch when target is soulstitch protected', async () => {
        hasSoulstitchProtection.mockReturnValue(true);

        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats: playerStatsWithBlessedStrikes,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });

    it('dispatches only the upgraded feature when both original and upgraded exist', async () => {
        const actionsWithUpgrade = [
            {
                type: 'damage_bonus',
                name: 'Blessed Strikes',
                options: ['Potent Spellcasting'],
                tempHpExpression: '1d4+2',
            },
            {
                type: 'damage_bonus',
                name: 'Improved Blessed Strikes',
                options: ['Potent Spellcasting'],
                tempHpExpression: '2d4+3',
                upgrades: 'Blessed Strikes',
            },
        ];

        const playerStats = {
            automation: { actions: actionsWithUpgrade, passives: [] },
        };

        const fn = createFn();
        let dispatchedCount = 0;
        let lastDetail = null;
        const handler = (event) => { dispatchedCount++; lastDetail = event.detail; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatchedCount).toBe(1);
        expect(lastDetail.title).toBe('Improved Blessed Strikes — Potent Spellcasting');
        expect(lastDetail.tempHp).toBe(3);
    });

    it('does not dispatch when dcSuccess is not "none"', async () => {
        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            dcSuccess: 'half',
            playerStats: playerStatsWithBlessedStrikes,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });

    it('evaluates tempHpExpression via evaluateAutoExpression', async () => {
        evaluateAutoExpression.mockReturnValue(7);

        const fn = createFn();
        const detail = trackEvent();

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats: playerStatsWithBlessedStrikes,
        });

        const eventDetail = await detail;
        expect(eventDetail).toBeDefined();
        expect(eventDetail.tempHp).toBe(7);
        expect(evaluateAutoExpression).toHaveBeenCalledWith('1d4+2', playerStatsWithBlessedStrikes);
    });

    it('does not dispatch when evaluateAutoExpression returns 0', async () => {
        evaluateAutoExpression.mockReturnValue(0);

        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats: playerStatsWithBlessedStrikes,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });

    it('does not dispatch when evaluateAutoExpression returns NaN', async () => {
        evaluateAutoExpression.mockReturnValue(NaN);

        const fn = createFn();
        let dispatched = false;
        const handler = () => { dispatched = true; };
        window.addEventListener('potent-spellcasting-temp-hp', handler);

        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            ...BASE_CONTEXT,
            playerStats: playerStatsWithBlessedStrikes,
        });

        window.removeEventListener('potent-spellcasting-temp-hp', handler);
        expect(dispatched).toBe(false);
    });
});
