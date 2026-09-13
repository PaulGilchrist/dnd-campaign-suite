// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyManeuveringAllyGrant } from './executeAttackRider.js';
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getCombatContext } from '../../../../services/rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [
            { name: 'GoliathFireGiant', type: 'player', speed: 30 },
            { name: 'HeroesFeastBard', type: 'player', speed: 30 },
            { name: 'Animated Rug of Smothering 1', type: 'npc', speed: 30 },
        ],
    })),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 10),
    createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false }) })),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 0 })),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 4 })),
}));

describe('applyManeuveringAllyGrant (MN-011)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes no-OA grant flags and source on the chosen ally', async () => {
        await applyManeuveringAllyGrant('HeroesFeastBard', 'GoliathFireGiant', 'Animated Rug of Smothering 1', 'test-campaign');

        expect(setRuntimeValue).toHaveBeenCalledWith('HeroesFeastBard', 'maneuveringStepGranted', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('HeroesFeastBard', 'maneuveringStepNoOA', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('HeroesFeastBard', 'maneuveringStepNoOASource', 'Animated Rug of Smothering 1', 'test-campaign');
    });

    it('registers a maneuvering_step_granted expiration keyed to the caster', async () => {
        await applyManeuveringAllyGrant('HeroesFeastBard', 'GoliathFireGiant', 'Animated Rug of Smothering 1', 'test-campaign');

        expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'GoliathFireGiant', targetName: 'HeroesFeastBard', effects: [{ type: 'maneuvering_step_granted' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'GoliathFireGiant' });
    });

    it('logs a named ability_use grant entry with half-speed and protection source', async () => {
        const grant = await applyManeuveringAllyGrant('HeroesFeastBard', 'GoliathFireGiant', 'Animated Rug of Smothering 1', 'test-campaign');

        expect(grant.halfSpeed).toBe(15);
        expect(grant.description).toContain('HeroesFeastBard can move up to half their Speed (15 ft)');
        expect(grant.description).toContain('without provoking Opportunity Attacks from Animated Rug of Smothering 1');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'ability_use',
            characterName: 'GoliathFireGiant',
            abilityName: 'Maneuvering Attack',
            description: expect.stringContaining('Maneuvering Attack: HeroesFeastBard can move up to half their Speed'),
        }));
    });

    it('falls back to 30 ft speed when the combat summary lacks the ally', async () => {
        getCombatContext.mockResolvedValueOnce({ creatures: [] });
        const grant = await applyManeuveringAllyGrant('UnknownAlly', 'GoliathFireGiant', 'Goblin', 'test-campaign');
        expect(grant.halfSpeed).toBe(15);
        expect(setRuntimeValue).toHaveBeenCalledWith('UnknownAlly', 'maneuveringStepNoOASource', 'Goblin', 'test-campaign');
    });
});
