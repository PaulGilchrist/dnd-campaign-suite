// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
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
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { hasSoulstitchProtection } from './loggedDiceRollUtils.js';
import { rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

// Blessed Strikes (2024 Cleric): the lv14 Improved upgrade authors the temp-HP
// leg (tempHpExpression: '2 * WIS modifier'). NPC save lane only — when the
// target FAILS its save against a damage cantrip (dcSuccess 'none'), the
// handler dispatches 'potent-spellcasting-temp-hp' so allies can be granted
// temp HP. The weapon-miss potent_cantrip lane lives in attackPostProcessing
// and is covered by attackPostProcessing-cla120-potent-cantrip.test.js.
describe('Blessed Strikes — Potent Spellcasting temp HP dispatch', () => {
    const SAVE_FAIL = { success: false, roll: 5, total: 8, bonus: 3, rawRolls: [5] };
    const SAVE_SUCCESS = { success: true, roll: 18, total: 21, bonus: 3, rawRolls: [18] };

    // Real lv14 data shape from public/data/2024/classes.json.
    const improvedBlessedStrikes = {
        type: 'damage_bonus',
        name: 'Improved Blessed Strikes',
        options: ['Divine Strike', 'Potent Spellcasting'],
        damageExpression: '2d8',
        damageType: 'Necrotic or Radiant',
        oncePerTurn: true,
        tempHpExpression: '2 * WIS modifier',
        upgrades: 'Blessed Strikes',
        casting_time: 'passive',
    };

    // Authored lv7 Blessed Strikes — same options, no tempHpExpression leg.
    const baseBlessedStrikes = {
        ...improvedBlessedStrikes,
        name: 'Blessed Strikes',
        damageExpression: '1d8',
        tempHpExpression: undefined,
        upgrades: undefined,
    };

    const playerStats = {
        automation: { actions: [improvedBlessedStrikes], passives: [] },
    };

    const BASE_CONTEXT = {
        targetName: 'Goblin',
        damageType: 'lightning',
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'none',
        isCantrip: true,
        attackerName: 'TestWizard',
        playerStats,
    };

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

    // Collect every potent-spellcasting-temp-hp dispatch; listeners are torn
    // down in afterEach so a mid-test throw cannot leak into later cases.
    const activeStops = [];
    function trackDispatches() {
        const events = [];
        const handler = (event) => events.push(event.detail);
        window.addEventListener('potent-spellcasting-temp-hp', handler);
        activeStops.push(() => window.removeEventListener('potent-spellcasting-temp-hp', handler));
        return events;
    }

    function castCantrip(contextOverrides = {}) {
        return createLogDamageAndShow(BASE_DEPS)({
            name: 'Shocking Grasp', formula: '1d8', total: 5, rolls: [5], modifier: 0,
            context: { ...BASE_CONTEXT, ...contextOverrides },
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        rollSaveForCreature.mockReturnValue(SAVE_FAIL);
        getRuntimeValue.mockReturnValue(null);
        hasSoulstitchProtection.mockReturnValue(false);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        evaluateAutoExpression.mockReturnValue(3);
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    afterEach(() => {
        activeStops.forEach(stop => stop());
        activeStops.length = 0;
    });

    it('dispatches temp-HP grant with full detail when a cantrip save fails', async () => {
        evaluateAutoExpression.mockReturnValue(7);
        const events = trackDispatches();

        await castCantrip();

        expect(evaluateAutoExpression).toHaveBeenCalledWith('2 * WIS modifier', playerStats);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            title: 'Improved Blessed Strikes — Potent Spellcasting',
            tempHp: 7,
            attackerName: 'TestWizard',
            campaignName: 'test-campaign',
            confirmLabel: 'Grant Temp HP',
        });
        expect(events[0].targets.map(t => t.name)).toEqual(['Goblin']);
    });

    it('dispatches once for the upgrade only when base and Improved both carry expressions', async () => {
        const events = trackDispatches();

        const bothStats = {
            automation: {
                actions: [
                    { ...baseBlessedStrikes, tempHpExpression: '1d4+2' },
                    improvedBlessedStrikes,
                ],
                passives: [],
            },
        };

        await castCantrip({ playerStats: bothStats });

        expect(events).toHaveLength(1);
        expect(evaluateAutoExpression).toHaveBeenCalledTimes(1);
        expect(evaluateAutoExpression).toHaveBeenCalledWith('2 * WIS modifier', bothStats);
    });

    it('does not dispatch when the damage bonus lacks tempHpExpression (lv7 data shape)', async () => {
        const events = trackDispatches();

        await castCantrip({
            playerStats: { automation: { actions: [baseBlessedStrikes], passives: [] } },
        });

        expect(events).toHaveLength(0);
    });

    it('does not dispatch when trigger conditions are unmet', async () => {
        const cases = [
            { label: 'save succeeds', save: SAVE_SUCCESS },
            { label: 'not a cantrip', context: { isCantrip: false } },
            { label: 'soulstitch protected', soulstitch: true },
            { label: 'dcSuccess is half', context: { dcSuccess: 'half' } },
        ];

        for (const testCase of cases) {
            rollSaveForCreature.mockReturnValue(testCase.save || SAVE_FAIL);
            hasSoulstitchProtection.mockReturnValue(testCase.soulstitch || false);
            const events = trackDispatches();

            await castCantrip(testCase.context);

            expect(events, testCase.label).toHaveLength(0);
        }
    });

    it('does not dispatch when the temp HP expression does not resolve positive', async () => {
        for (const value of [0, NaN]) {
            evaluateAutoExpression.mockReturnValue(value);
            const events = trackDispatches();

            await castCantrip();

            expect(events, String(value)).toHaveLength(0);
        }
    });
});
