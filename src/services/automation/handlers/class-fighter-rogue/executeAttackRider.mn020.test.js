// @maintained-by-ai: 2026-10-15
// MN-020 downstream DC lane for executeAttackRiderManeuver: the Trip Attack save
// must resolve at prompt time via the REAL buildSaveDc (8 + STR + PB = 17 for a
// STR +3 PB +6 host), never the build-time baked DC 14 / DC 10 fallback, and the
// rider ability_use log must carry the save outcome + prone text on BOTH branches.
//
// Ownership (this file = sole prompt-time DC-17 + MN-020 log owner):
//   - Token-passthrough rebuild of the rider action ('ability' / 'STR','DEX'
//     tokens) lives in combatSuperiorityQueries.mn020.test.js; the info builder's
//     own "never bakes a number" contract (incl. its buildSaveDc→17 cross-check)
//     in automationInfoBuilder/combatSuperiority.test.js; the size-gate refusal +
//     DC-16 STR+2 discrimination in executeAttackRider.mn015.test.js; die roll +
//     expend and the per-effect payload-description branches in
//     combatSuperiorityAttackRider.test.js; canonical popup strings in
//     combatSuperiorityUtils.test.js.
//
// Trim notes (2026-10-15): removed the info-builder 'ability'-token test and the
// isolated buildSaveDc-unit test — both byte-equivalent in coverage to
// automationInfoBuilder/combatSuperiority.test.js (its MN-020 tests) and the
// latter also to this file's end-to-end DC-17 offer test, which runs the real
// buildSaveDc through the handler. Dropped the expend assertion (4→3) from the
// offer test: the expend contract is pinned verbatim in
// combatSuperiorityAttackRider.test.js and executeAttackRider.mn015.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAttackRiderManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../../services/automation/common/savePrompt.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import { resolveTarget } from '../../../../services/automation/common/targetResolver.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Trip Attack', effect: 'prone', trigger: 'weapon_attack_hit', saveType: 'STR', saveAbility: 'STR', damageBonus: true, sizeLimit: 'large_or_smaller', dieExpression: 'superiority_die', actionType: 'attack_rider' },
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
    rollExpression: vi.fn(() => ({ total: 5 })),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 12),
}));

vi.mock('../../../combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5 })),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

vi.mock('../../../../services/combat/filterMeleeAttacks.js', () => ({
    filterMeleeAttacks: vi.fn(() => []),
}));

// Real buildSaveDc locks the DC math; only the interactive listener is stubbed
// (SP-045 / MN-015 partial-mock precedent).
vi.mock('../../../../services/automation/common/savePrompt.js', async (importOriginal) => ({
    ...await importOriginal(),
    createSaveListener: vi.fn(() => ({
        promise: Promise.resolve({ success: false }),
    })),
}));

// STR +3, PB +6 host (EvasiveFighter lv18) — computed abilities WITH `.bonus`.
// The baked-build DC-14 / fallback DC-10 failure modes are dead against DC 17.
const makePlayerStats = (overrides = {}) => ({
    name: 'EvasiveFighter',
    proficiency: 6,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 0 },
    ],
    level: 18,
    rules: '2024',
    attacks: [{ name: 'Scimitar', weaponType: 'melee', damage: '1d6+3', damageType: 'slashing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

const RIDER_ACTION = {
    name: 'Combat Superiority',
    automation: { type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'] },
};

describe('MN-020 Trip Attack — prompt-time DC 17 + full log', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'superiorityDice') return 4;
            return undefined;
        });
        resolveTarget.mockResolvedValue(null);
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'npc', monsterType: 'Humanoid', size: 'Medium' }],
        });
    });

    it('offers the STR save at DC 17 (not 14)', async () => {
        const result = await executeAttackRiderManeuver(
            RIDER_ACTION,
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Knight 1' }
        );

        expect(result.type).toBe('popup');
        expect(result.refused).toBeFalsy();
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            targetName: 'Knight 1',
            saveType: 'STR',
            saveDc: 17,
        }));
    });

    it('rider ability_use log carries the save outcome AND the prone text', async () => {
        const result = await executeAttackRiderManeuver(
            RIDER_ACTION,
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Knight 1' }
        );

        expect(result.logEntries?.[0]).toMatchObject({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Trip Attack',
        });
        expect(result.logEntries[0].description).toContain('STR save DC 17');
        expect(result.logEntries[0].description).toContain('Failure');
        expect(result.logEntries[0].description).toContain('fell Prone');
        expect(result.logEntries[0].description).toContain('Added 5 to the damage roll');
    });

    it('success branch logs no prone but still carries the DC', async () => {
        createSaveListener.mockImplementationOnce(() => ({
            promise: Promise.resolve({ success: true }),
        }));

        const result = await executeAttackRiderManeuver(
            RIDER_ACTION,
            makePlayerStats(),
            'test-campaign',
            'Trip Attack',
            { weaponType: 'melee', hit: true, targetName: 'Knight 1' }
        );

        expect(result.logEntries[0].description).toContain('STR save DC 17');
        expect(result.logEntries[0].description).toContain('Success');
        expect(result.logEntries[0].description).not.toContain('Prone');
    });
});
