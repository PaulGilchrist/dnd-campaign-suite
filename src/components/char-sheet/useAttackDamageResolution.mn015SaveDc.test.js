// MN-015 regression: handleAttackRiderManeuverUse must forward the Combat
// Superiority feature's save DC spec into the rider action (previously sent an
// empty `{ automation: {} }` -> buildSaveDc DC-10 fallback), and must NOT ride
// the maneuver die onto damage when the service returns a size-gate refusal.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getAttackRiderOptions: vi.fn(),
    getAttackRiderOptionsByContext: vi.fn(),
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { executeAttackRiderManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const makePlayerStats = (specialActions = []) => ({
    name: 'EvasiveFighter',
    level: 18,
    abilities: [
        { name: 'Strength', bonus: 0 },
        { name: 'Dexterity', bonus: 0 },
    ],
    proficiency: 6,
    automation: { actions: [], passives: [], specialActions },
});

function UseAttackDamageResolution(overrides = {}) {
    const setPopupHtml = vi.fn();
    const setModalState = vi.fn();
    return useAttackDamageResolution({
        playerStats: makePlayerStats(),
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml,
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({})),
        buildCtxSync: vi.fn(() => Promise.resolve({})),
        setModalState,
        setPendingDamage: vi.fn(),
        setTacticalMasterModal: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    });
}

describe('MN-015 handleAttackRiderManeuverUse — save DC forwarding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        executeAttackRiderManeuver.mockResolvedValue({ type: 'popup', payload: { description: 'ok' } });
    });

    it('forwards the resolved numeric saveDc from the combat_superiority special-action info', async () => {
        const stats = makePlayerStats([
            { type: 'combat_superiority', name: 'Combat Superiority', saveDc: 14, saveAbility: 'STR', saveAbilities: ['STR', 'DEX'] },
        ]);
        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ playerStats: stats });

        await handleAttackRiderManeuverUse(
            { name: 'Pushing Attack', damageBonus: true },
            { damageType: 'piercing' },
            { isMiss: false, targetName: 'Gibbering Mouther 1' },
            '1d6', 3, [3],
        );

        expect(executeAttackRiderManeuver).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ saveDc: 14, saveAbility: 'STR' }),
            }),
            stats,
            'test-campaign',
            'Pushing Attack',
            expect.anything(),
        );
    });

    it('falls back to saveDc:"ability" + STR/DEX when no combat_superiority info is present', async () => {
        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution();

        await handleAttackRiderManeuverUse(
            { name: 'Pushing Attack', damageBonus: true },
            { damageType: 'piercing' },
            { isMiss: false, targetName: 'Gibbering Mouther 1' },
            '1d6', 3, [3],
        );

        const action = executeAttackRiderManeuver.mock.calls[0][0];
        expect(action.automation.saveDc).toBe('ability');
        expect(action.automation.saveAbility).toEqual(['STR', 'DEX']);
    });

    it('MN-015: a size-gate refusal adds no die to damage, spends nothing, logs, and still shows the popup', async () => {
        executeAttackRiderManeuver.mockResolvedValue({
            type: 'popup',
            refused: true,
            payload: { type: 'automation_info', name: 'Pushing Attack', description: 'Pushing Attack: Target is Huge (too large — only Large or smaller affected).' },
            logEntries: [{ type: 'ability_use', characterName: 'EvasiveFighter', abilityName: 'Pushing Attack', description: 'Pushing Attack: Target is Huge (too large — only Large or smaller affected).' }],
        });
        const setPopupHtml = vi.fn();
        const { handleAttackRiderManeuverUse } = UseAttackDamageResolution({ setPopupHtml });

        const result = await handleAttackRiderManeuverUse(
            { name: 'Pushing Attack', damageBonus: true, dieExpression: 'superiority_die' },
            { damageType: 'piercing' },
            { isMiss: false, targetName: 'Hill Giant 1' },
            { formula: '1d6', total: 3, rolls: [3] },
        );

        expect(result.formula).toBe('1d6');
        expect(result.total).toBe(3);
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'attackRiderDieValue', expect.anything(), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Pushing Attack',
            description: expect.stringContaining('too large'),
        }));
        expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            description: expect.stringContaining('Large or smaller'),
        }));
    });
});
