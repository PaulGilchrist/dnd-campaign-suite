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

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(() => false),
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(() => false),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(() => 0),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('SP-099 — Resistance consumer re-reduces once after per-turn re-arm', () => {
    const deps = {
        characterName: 'Thug 1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Thug 1', computedStats: { armorClass: 11 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    const state = { used: false };

    beforeEach(() => {
        vi.clearAllMocks();
        state.used = false;
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 100, maxHp: 100 }],
        });
        applyDamageToTarget.mockImplementation((_cs, _name, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg }));
        rollExpression.mockImplementation((expr) => {
            if (expr === '1d4') return { total: 3, rolls: [3] };
            return { total: 8, rolls: [8] };
        });
        setRuntimeValue.mockImplementation(async (_key, prop, value) => {
            if (prop === 'resistanceUsedThisTurn') state.used = value;
        });
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [{ target: 'Goblin', effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType: 'Bludgeoning' }];
            }
            if (prop === 'resistanceUsedThisTurn') return state.used;
            return null;
        });
    });

    function attack(attackerName) {
        const fn = createLogDamageAndShow(deps);
        return fn('Mace', '1d6+2', 8, [6], 2, { targetName: 'Goblin', damageType: 'bludgeoning', attackerName, });
    }

    function appliedTotals() {
        return applyDamageToTarget.mock.calls.map(c => c[2]);
    }

    function resistanceLogs() {
        return addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use' && c[1]?.abilityName === 'Resistance');
    }

    it('reduces once per turn across turn boundaries: hit1 reduced, same-turn hit2 full, re-armed hit3 reduced, hit4 full', async () => {
        await attack('Thug 1');
        expect(appliedTotals()).toEqual([5]);
        expect(resistanceLogs()).toHaveLength(1);
        expect(state.used).toBe(true);

        await attack('Thug 1');
        expect(appliedTotals()).toEqual([5, 8]);
        expect(resistanceLogs()).toHaveLength(1);

        state.used = false;

        await attack('Thug 2');
        expect(appliedTotals()).toEqual([5, 8, 5]);
        expect(resistanceLogs()).toHaveLength(2);
        expect(state.used).toBe(true);

        await attack('Thug 2');
        expect(appliedTotals()).toEqual([5, 8, 5, 8]);
        expect(resistanceLogs()).toHaveLength(2);
    });

    it('non-chosen damage type is never reduced even when re-armed', async () => {
        state.used = false;
        const fn = createLogDamageAndShow(deps);
        await fn('Dagger', '1d4+2', 6, [4], 2, { targetName: 'Goblin', damageType: 'piercing', attackerName: 'Thug 2', });

        expect(appliedTotals()).toEqual([6]);
        expect(resistanceLogs()).toHaveLength(0);
        expect(state.used).toBe(false);
    });
});
