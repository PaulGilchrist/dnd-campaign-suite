// MA-1352: NPC-inline save-roll consumer for the ability-scoped
// ability_save_disadvantage te (Psychic Gray Ooze Pseudopod hit-clause):
// disadvantage (2d20, min) on saves of the te's ability ONLY, other save
// types unaffected, te NOT consumed (anchor expiration owns removal).
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

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/features/infernalWoundService.js', () => ({
    grantInfernalWound: vi.fn(),
}));

vi.mock('../../../services/rules/features/cockatricePetrifyService.js', () => ({
    stagePetrifyingBiteTargets: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => String(t || '').toLowerCase()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { rollSaveForCreature, applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

const TE_INT = [{
    target: 'Bandit 1',
    effect: 'ability_save_disadvantage',
    ability: 'int',
    source: 'Psychic Gray Ooze 1',
    duration: 'until_start_of_next_turn',
}];

function saveContext(saveType) {
    return {
        targetName: 'Bandit 1',
        saveDc: 15,
        saveType,
        dcSuccess: 'half',
        damageType: 'Psychic',
    };
}

describe('MA-1352 NPC-inline ability-scoped save disadvantage', () => {
    const deps = {
        characterName: 'AberrantSorcerer',
        campaignName: 'test-campaign',
        characters: [{ name: 'AberrantSorcerer' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };
    const combatSummary = {
        creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', currentHp: 9, maxHp: 9, saveBonuses: { int: -1, wis: 0 } }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollSaveForCreature.mockReturnValue({ roll: 5, total: 4, bonus: -1, success: false, rawRolls: [5, 2] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 4, damageReduced: false });
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return TE_INT.map(te => ({ ...te }));
            return null;
        });
    });

    async function rollSave(saveType) {
        const handler = createNpcSaveDamageHandler(deps);
        await handler({
            name: 'Mind Flayer Tentacle',
            formula: '3d6',
            total: 10,
            rolls: [3, 3, 4],
            modifier: 0,
            context: saveContext(saveType),
            adjustedTotal: 10,
            combatSummary,
            displayRolls: [3, 3, 4],
            gwfBaseRolls: [3, 3, 4],
            gwfDisplayRolls: [3, 3, 4],
        });
    }

    it('rolls the INT save with Disadvantage from the ability-scoped te', async () => {
        await rollSave('Intelligence');

        expect(rollSaveForCreature).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Bandit 1' }),
            'Intelligence',
            15,
            true,
            expect.anything(),
        );
        const saveLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'roll' && e.rollType === 'save-damage');
        expect(saveLog?.forcedMode).toBe('disadvantage');
    });

    it('leaves saves of every OTHER ability unaffected by the INT te', async () => {
        await rollSave('Dexterity');
        expect(rollSaveForCreature).toHaveBeenLastCalledWith(
            expect.objectContaining({ name: 'Bandit 1' }),
            'Dexterity',
            15,
            false,
            expect.anything(),
        );

        await rollSave('Wisdom');
        expect(rollSaveForCreature).toHaveBeenLastCalledWith(
            expect.objectContaining({ name: 'Bandit 1' }),
            'Wisdom',
            15,
            false,
            expect.anything(),
        );
    });

    it('does NOT consume the te (anchor clock owns removal)', async () => {
        await rollSave('Intelligence');

        const teWrites = setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects');
        expect(teWrites).toHaveLength(0);
    });

    it('byte-inert without the te (plain save, disadvantage false)', async () => {
        getRuntimeValue.mockReturnValue(null);
        await rollSave('Intelligence');

        expect(rollSaveForCreature).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Bandit 1' }),
            'Intelligence',
            15,
            false,
            expect.anything(),
        );
    });
});
