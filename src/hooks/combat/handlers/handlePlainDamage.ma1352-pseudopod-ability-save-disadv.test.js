// MA-1352: Psychic Gray Ooze Pseudopod INT-save-Disadvantage rider producer —
// mirrors the MA-0016 no_healing hit-clause byte-shape (applyHitClauseTarget-
// Effect) with the new ability payload: register the registered te with
// ability:"int", ONE attacker-anchored addExpiration clock, one grant log.
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
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => key === 'ability_save_disadvantage'
        ? { effect: key, label: 'Save Disadv (Ability)', description: 'Disadvantage on saving throws of the chosen ability until the end of the source\'s next turn.', group: 'Saves & Checks' }
        : { effect: key, label: key, group: 'Defensive' }),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import monsters from '../../../../public/data/monsters.json';

const OOZE = monsters.find(m => m.index === 'psychic-gray-ooze');
const PSEUDOPOD_ACTION = OOZE.actions[0];

describe('MA-1352 Psychic Gray Ooze Pseudopod ability_save_disadvantage producer', () => {
    const deps = {
        characterName: 'Psychic Gray Ooze 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Psychic Gray Ooze 1', computedStats: { armorClass: 9 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 1, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 12, maxHp: 12 }],
        });
    });

    function hitContext() {
        return {
            targetName: 'Bandit 1',
            damageType: 'Acid',
            attackerName: 'Psychic Gray Ooze 1',
            hitClause: buildHitConditionClause(PSEUDOPOD_ACTION),
        };
    }

    async function resolveHit() {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Pseudopod', formula: '3d6 + 1', total: 11, rolls: [3, 4, 3], modifier: 1, context: hitContext() });
    }

    it('registers ability_save_disadvantage with the int ability payload on a resolved hit', async () => {
        await resolveHit();

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'ability_save_disadvantage',
            'Psychic Gray Ooze 1',
            { duration: 'until_start_of_next_turn', ability: 'int' },
        );
    });

    it('grants ONE attacker-anchored expiration clock (MA-0016 byte-shape)', async () => {
        await resolveHit();

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Psychic Gray Ooze 1',
            targetName: 'Bandit 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'ability_save_disadvantage', source: 'Psychic Gray Ooze 1', target: 'Bandit 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Psychic Gray Ooze 1',
        });
    });

    it('logs a condition-applied grant naming the INT scope and the anchor (DC-free, source-anchored)', async () => {
        await resolveHit();

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Save Disadv (Ability) (INT)',
            reason: "Pseudopod — until the start of Psychic Gray Ooze 1's next turn",
        }));
        const grantLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(grantLog.note).toContain('(INT saves only)');
        expect(grantLog.note).toContain('advisory');
        expect(grantLog.dc).toBeUndefined();
    });

    it('writes NO conditions for the te-only rider', async () => {
        const { setRuntimeValue } = await import('../../runtime/useRuntimeState.js');
        await resolveHit();

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });
});
