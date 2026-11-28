// @maintained-by-ai 2026-11-28
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lane scope: ONLY the isOpportunityAttack transport seam (FT-101 / fix#OA-parity).
// The false-default legs and byte-exact minimalCtx key sets are pinned by the
// sibling suites (standalone.test.js full-set rows; tacticalMaster /
// shieldBashResume / stalkersFlurryResume else-branch full-set assertions), the
// raw ctxOverrides spread into the pipeline ctx by ctxOverrides.test.js, and the
// consumer gates by attackRollRiders / handlePlainDamage.sentinel. This file
// pins only what no sibling carries: the OA TRUE leg on each production seam.
// Mock audit (bisect-proven): the only collaborator invoked on these paths is
// buildPipelineForAction → pipeline.run → proceedWithDamage → the injected
// rollDamage, so only the steps/index.js seam is stubbed; every other import
// loads cleanly unmocked in jsdom.
vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

import useAttackDamageResolution, { resolveAttackDamageStandalone } from './useAttackDamageResolution.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

const attack = { name: 'Glaive', damage: '1d10+5', damageType: 'Slashing', hitBonus: 9 };
const playerStats = { name: 'EvasiveFighter', attacks: [attack] };

// Mirrors attackRollPostDamage's handoff — the pipeline gives proceedWithDamage
// the finished damage tuple with the live pipeline ctx attached.
const mockPipelineHandoff = () => ({
    run: vi.fn(async (_event, ctx) => {
        ctx.proceedWithDamage({ attack, formula: '1d10+5', total: 8, rolls: [3], modifier: 5, pipelineCtx: ctx });
    }),
});

describe('standalone OA transport (FT-101)', () => {
    const rollDamage = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
        buildPipelineForAction.mockReturnValue(mockPipelineHandoff());
    });

    it('supplied OA true rides BOTH consumer gates: pipeline ctx (Charger) and rollDamage context (Sentinel/Halt)', async () => {
        await resolveAttackDamageStandalone(
            attack,
            { targetName: 'Bandit 1', attackerName: 'EvasiveFighter', isOpportunityAttack: true },
            { playerStats, campaignName: 'test-campaign', setPopupHtml: vi.fn(), rollDamage }
        );

        const [, pipelineCtx] = buildPipelineForAction.mock.results[0].value.run.mock.calls[0];
        expect(pipelineCtx.isOpportunityAttack).toBe(true);

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage.mock.calls[0][0].context.isOpportunityAttack).toBe(true);
    });
});

describe('hook OA transport (fix#OA-parity)', () => {
    function useResolution(overrides = {}) {
        const rollDamage = vi.fn();
        const api = useAttackDamageResolution({
            playerStats,
            campaignName: 'test-campaign',
            mapName: null,
            popupHtml: null,
            setPopupHtml: vi.fn(),
            rollDamage,
            buildCtx: vi.fn(),
            buildCtxSync: null,
            setModalState: vi.fn(),
            setPendingDamage: vi.fn(),
            resumeRef: { current: null },
            ...overrides,
        });
        return { api, rollDamage };
    }

    const flushMicrotasks = async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    };

    beforeEach(() => {
        vi.resetAllMocks();
        buildPipelineForAction.mockReturnValue(mockPipelineHandoff());
    });

    it('buildCtxSync null: OA true rides the else-branch minimalCtx at the rollDamage seam', async () => {
        const { api, rollDamage } = useResolution();

        await api.resolveAttackDamage(attack, { targetName: 'Bandit 1', isOpportunityAttack: true });

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage.mock.calls[0][0].context.isOpportunityAttack).toBe(true);
    });

    // Production is always the merge branch: CharActions mounts with a truthy
    // buildCtxSync, so the OA marker must survive mergeDamagePipelineCtx's
    // pendingCtxOverrides spread into the merged rollDamage context — this is
    // the only seam real OA damage crosses, and no sibling lane pins OA here.
    it('production merge branch: OA true survives the rebuilt-ctx merge into the rollDamage context', async () => {
        const { api, rollDamage } = useResolution({
            buildCtxSync: vi.fn(async () => ({ sneakAttackDice: 0 })),
        });

        await api.resolveAttackDamage(attack, { targetName: 'Bandit 1', isOpportunityAttack: true });
        await flushMicrotasks();

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage.mock.calls[0][0].context.isOpportunityAttack).toBe(true);
    });
});
