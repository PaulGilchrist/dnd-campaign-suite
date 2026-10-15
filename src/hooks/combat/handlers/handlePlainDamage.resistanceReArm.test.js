// @maintained-by-ai: 2026-10-14
// SP-099 consumer contract for the plain-damage lane (handlePlainDamage.js
// rollResistanceReduction): the resistance_damage_reduction te reduces the
// chosen damage type by exactly 1d4, consumed once per turn via the
// resistanceUsedThisTurn flag, and re-reduces after the flag re-arms (the
// re-arm PRODUCER — turnStartEffects clearing the flag at the target's own
// turn start — is owned by turnStartEffects.resistancePerTurn.test.js).
// te matching / popup / damage-log shape for this feature is owned by
// useLoggedDiceRollDamage.resistance.test.js; grant/replace/rest-clearing
// by resistanceHandler.test.js. 2024 RAW: "reduce the total damage taken by
// 1d4 ... only once per turn" (public/data/2024/spells.json Resistance).
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
    getGuardianProtectionAcBonus: vi.fn(() => 0),
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
    const TARGET = 'Goblin';
    const CAMPAIGN = 'test-campaign';

    const deps = {
        characterName: 'Thug 1',
        campaignName: CAMPAIGN,
        characters: [{ name: 'Thug 1', computedStats: { armorClass: 11 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    // resistanceUsedThisTurn stand-in — setRuntimeValue writes flow back
    // through it so the once-per-turn gate reads honestly between hits.
    const state = { used: false };

    beforeEach(() => {
        vi.clearAllMocks();
        state.used = false;
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: TARGET, type: 'npc', ac: 12, currentHp: 100, maxHp: 100 }],
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
                return [{ target: TARGET, effect: 'resistance_damage_reduction', source: 'Divine_Cleric', chosenType: 'Bludgeoning' }];
            }
            if (prop === 'resistanceUsedThisTurn') return state.used;
            return null;
        });
    });

    function attack({ weapon = 'Mace', formula = '1d6+2', total = 8, rolls = [6], damageType = 'bludgeoning', attackerName = 'Thug 1' }) {
        return createLogDamageAndShow(deps)({
            name: weapon, formula, total, rolls, modifier: 2,
            context: { targetName: TARGET, damageType, attackerName },
        });
    }

    const appliedTotals = () => applyDamageToTarget.mock.calls.map(c => c[2]);
    const d4RollCalls = () => rollExpression.mock.calls.filter(c => c[0] === '1d4');
    const resistanceLogs = () => addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use' && c[1]?.abilityName === 'Resistance');

    it('reduces once per turn across turn boundaries: hit1 reduced, same-turn hit2 full, re-armed hit3 reduced, hit4 full', async () => {
        await attack({ attackerName: 'Thug 1' });
        expect(appliedTotals()).toEqual([5]); // 8 − 1d4(3)
        expect(d4RollCalls()).toHaveLength(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(TARGET, 'resistanceUsedThisTurn', true, CAMPAIGN);
        expect(resistanceLogs()).toHaveLength(1);
        expect(resistanceLogs()[0][1].description).toContain('reduced damage by 3 (1d4)');
        expect(state.used).toBe(true);

        // Consumed this turn: full damage, no second d4 roll, no re-log.
        await attack({ attackerName: 'Thug 1' });
        expect(appliedTotals()).toEqual([5, 8]);
        expect(d4RollCalls()).toHaveLength(1);
        expect(resistanceLogs()).toHaveLength(1);

        // Simulate the re-arm seam (turnStartEffects clears the flag at the
        // target's own turn start).
        state.used = false;

        // Re-armed: reduces again — flag is per-target, not per-attacker.
        await attack({ attackerName: 'Thug 2' });
        expect(appliedTotals()).toEqual([5, 8, 5]);
        expect(d4RollCalls()).toHaveLength(2);
        expect(resistanceLogs()).toHaveLength(2);
        expect(state.used).toBe(true);

        await attack({ attackerName: 'Thug 2' });
        expect(appliedTotals()).toEqual([5, 8, 5, 8]);
        expect(d4RollCalls()).toHaveLength(2);
        expect(resistanceLogs()).toHaveLength(2);
    });

    it('non-chosen damage type is never reduced or rolled against, even when re-armed', async () => {
        state.used = false;
        await attack({ weapon: 'Dagger', formula: '1d4+2', total: 6, rolls: [4], damageType: 'piercing', attackerName: 'Thug 2' });

        expect(appliedTotals()).toEqual([6]);
        expect(d4RollCalls()).toHaveLength(0);
        expect(resistanceLogs()).toHaveLength(0);
        expect(setRuntimeValue).not.toHaveBeenCalledWith(TARGET, 'resistanceUsedThisTurn', true, CAMPAIGN);
        expect(state.used).toBe(false);
    });
});
