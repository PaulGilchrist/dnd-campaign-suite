// @maintained-by-ai: 2026-10-15
// MN-015 regression: Pushing Attack save DC must come from the forwarded
// combat_superiority automation (8 + STR + PB), never the buildSaveDc DC-10
// fallback; oversized (Huge) targets are refused BEFORE the die is rolled or
// expended. Canonical owner of the attackRider-lane size-gate refusal; the
// executeManeuver.js executor's own copy of this invariant lives in
// combatSuperiorityHandlerManeuver-modals.test.js, validateSizeLimit's unit
// lane in validateSizeLimit.mn015.test.js, and the canonical popup strings in
// combatSuperiorityUtils.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAttackRiderManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { buildSaveDc, createSaveListener } from '../../../../services/automation/common/savePrompt.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import { resolveTarget } from '../../../../services/automation/common/targetResolver.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Pushing Attack', effect: 'push', trigger: 'weapon_attack_hit', saveType: 'STR', saveAbility: 'STR', value: 15, damageBonus: true, sizeLimit: 'large_or_smaller', dieExpression: 'superiority_die', actionType: 'attack_rider' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
    loadMonsters: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 4 })),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 8),
}));

// Real buildSaveDc locks the DC math; only the interactive listener is stubbed
// (SP-045 fearHandler.saveDc.test.js partial-mock precedent).
vi.mock('../../../../services/automation/common/savePrompt.js', async (importOriginal) => ({
    ...await importOriginal(),
    createSaveListener: vi.fn(() => ({
        promise: Promise.resolve({ success: true }),
    })),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 4 })),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'EvasiveFighter',
    proficiency: 6,
    // STR +2 / DEX +0 discriminates the three MN-015 failure modes:
    // STR picked (16) vs DEX picked (14) vs DC-10 fallback (10).
    abilities: [
        { name: 'Strength', bonus: 2 },
        { name: 'Dexterity', bonus: 0 },
    ],
    level: 18,
    rules: '2024',
    attacks: [{ name: 'Shortsword', weaponType: 'melee', damage: '1d6', damageType: 'piercing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

// The exact automation shape handleAttackRiderManeuverUse now forwards (MN-015).
const RIDER_ACTION = {
    name: 'Combat Superiority',
    automation: { type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'] },
};

describe('MN-015 executeAttackRiderManeuver — Pushing Attack', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
        resolveTarget.mockResolvedValue(null);
    });

    it('buildSaveDc resolves the STR save DC as 8 + STR mod + PB = 16', () => {
        expect(buildSaveDc(RIDER_ACTION.automation, makePlayerStats())).toBe(16);
    });

    it('offers the STR save at DC 16 for a Medium target', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Gibbering Mouther 1', type: 'npc', monsterType: 'Aberration', size: 'Medium' }],
        });

        const result = await executeAttackRiderManeuver(
            RIDER_ACTION,
            makePlayerStats(),
            'test-campaign',
            'Pushing Attack',
            { weaponType: 'melee', hit: true, targetName: 'Gibbering Mouther 1' }
        );

        expect(result.type).toBe('popup');
        expect(result.refused).toBeFalsy();
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            targetName: 'Gibbering Mouther 1',
            saveType: 'STR',
            saveDc: 16,
        }));
        // paid expend happened (pool 4 -> 3)
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 3, 'test-campaign');
    });

    it('refuses a Huge target with "Large or smaller" wording, no save prompt and NO die expend', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Hill Giant 1', type: 'npc', monsterType: 'Giant', size: 'Huge' }],
        });

        const result = await executeAttackRiderManeuver(
            RIDER_ACTION,
            makePlayerStats(),
            'test-campaign',
            'Pushing Attack',
            { weaponType: 'melee', hit: true, targetName: 'Hill Giant 1' }
        );

        expect(result.type).toBe('popup');
        expect(result.refused).toBe(true);
        expect(result.payload.description).toContain('Huge');
        expect(result.payload.description).toContain('too large');
        expect(result.payload.description).toContain('Large or smaller');
        // NO die expend: never rolled, never spent, never prompted.
        expect(diceRoller.rollExpression).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', expect.anything(), expect.anything());
        expect(result.logEntries?.[0]).toMatchObject({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Pushing Attack',
        });
        // The refusal text reaches the log byte-identical to the popup.
        expect(result.logEntries[0].description).toBe(result.payload.description);
        expect(result.logEntries[0].description).toContain('too large');
    });
});
