// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 8, rolls: [5], modifier: 3 })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

import { resolveAttackDamageStandalone, normalizeAutoDamage } from './useAttackDamageResolution.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

const mockRollDamage = vi.fn();

// Mirrors attackRollPostDamage.js:338 — the pipeline hands proceedWithDamage
// the finished damage tuple; the standalone resolver must forward the OA
// marker onward so the handlePlainDamage Sentinel (Halt) gate can see it.
function runAndProceed(phase, ctx) {
    ctx.proceedWithDamage({ attack: ctx.attack, formula: '1d8+3', total: 8, rolls: [5], modifier: 3, pipelineCtx: ctx });
    return Promise.resolve();
}

describe('standalone damage OA transport (FT-101)', () => {
    const attack = { name: 'Glaive', damage: '1d10+5', damageType: 'Slashing', hitBonus: 9 };
    const playerStats = { name: 'EvasiveFighter', attacks: [attack] };

    beforeEach(() => {
        vi.clearAllMocks();
        buildPipelineForAction.mockReturnValue({ run: vi.fn(runAndProceed) });
    });

    function runStandalone(ctxOverrides) {
        return resolveAttackDamageStandalone(attack, ctxOverrides, {
            playerStats,
            campaignName: 'test-campaign',
            setPopupHtml: vi.fn(),
            rollDamage: mockRollDamage,
        });
    }

    it('threads isOpportunityAttack:true into the plain-damage rollDamage context', async () => {
        await runStandalone({ targetName: 'Bandit 1', attackerName: 'EvasiveFighter', isOpportunityAttack: true });

        expect(mockRollDamage).toHaveBeenCalledTimes(1);
        expect(mockRollDamage.mock.calls[0][0].context).toMatchObject({
            isOpportunityAttack: true,
            targetName: 'Bandit 1',
            attackerName: 'EvasiveFighter',
        });
    });

    it('non-OA rolls forward isOpportunityAttack:false (byte-inert)', async () => {
        await runStandalone({ targetName: 'Bandit 1', attackerName: 'EvasiveFighter' });

        expect(mockRollDamage).toHaveBeenCalledTimes(1);
        expect(mockRollDamage.mock.calls[0][0].context.isOpportunityAttack).toBe(false);
    });

    it('normalizeAutoDamage keeps the OA marker on the popup auto-damage transport', () => {
        const { ctx } = normalizeAutoDamage(
            { name: 'Glaive', formula: '1d10+5', targetName: 'Bandit 1', attackerName: 'EvasiveFighter', isOpportunityAttack: true },
            false,
            playerStats
        );
        expect(ctx.isOpportunityAttack).toBe(true);
    });
});
