// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock audit vs resolveAttackDamageStandalone's live path: the only collaborator
// invoked is buildPipelineForAction → pipeline.run → proceedWithDamage → the
// injected rollDamage, so only the pipeline seam is stubbed. Every other import
// of the source module loads cleanly unmocked in jsdom (proven by the sibling
// .standalone / .ctxOverrides suites, which leave logService/damageUtils real).
vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

import useAttackDamageResolution, { resolveAttackDamageStandalone } from './useAttackDamageResolution.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

// FT-101 transport pin: the OA marker must ride ctxOverrides all the way to
// BOTH consumer gates — pipeline ctx (Charger gate, attackRollRiders.js:126,
// via the raw ...ctxOverrides spread) and rollDamage minimalCtx (standalone
// seam source:57, read by handlePlainDamage's Sentinel/Halt gate in
// MonsterCardModal; hook seam source:369-383 — fix#OA-parity 2026-10-22
// closed the hook branch's omitted-key asymmetry, hook pins below).
describe('standalone damage OA transport (FT-101)', () => {
    const attack = { name: 'Glaive', damage: '1d10+5', damageType: 'Slashing', hitBonus: 9 };
    const playerStats = { name: 'EvasiveFighter', attacks: [attack] };
    const rollDamage = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
        // Mirrors attackRollPostDamage.js:338 — the pipeline hands proceedWithDamage
        // the finished damage tuple with the live pipeline ctx attached.
        buildPipelineForAction.mockReturnValue({
            run: vi.fn(async (_event, ctx) => {
                ctx.proceedWithDamage({ attack, formula: '1d10+5', total: 8, rolls: [3], modifier: 5, pipelineCtx: ctx });
            }),
        });
    });

    it.each([
        {
            name: 'supplied OA true rides pipeline ctx and rollDamage minimalCtx',
            ctxOverrides: { isOpportunityAttack: true },
            pipelineOa: true,
            rollOa: true,
        },
        {
            name: 'omitted OA: absent from pipeline ctx (riders stay live), false default at rollDamage seam',
            ctxOverrides: {},
            pipelineOa: undefined,
            rollOa: false,
        },
    ])('$name', async ({ ctxOverrides, pipelineOa, rollOa }) => {
        await resolveAttackDamageStandalone(
            attack,
            { targetName: 'Bandit 1', attackerName: 'EvasiveFighter', ...ctxOverrides },
            { playerStats, campaignName: 'test-campaign', setPopupHtml: vi.fn(), rollDamage }
        );

        expect(buildPipelineForAction).toHaveBeenCalledWith(attack, playerStats);
        const pipeline = buildPipelineForAction.mock.results[0].value;
        const [event, pipelineCtx] = pipeline.run.mock.calls[0];
        expect(event).toBe('housekeeping:do');
        expect(pipelineCtx.isOpportunityAttack).toBe(pipelineOa);

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage).toHaveBeenCalledWith({
            name: 'Glaive',
            formula: '1d10+5',
            total: 8,
            rolls: [3],
            modifier: 5,
            context: expect.objectContaining({
                isOpportunityAttack: rollOa,
                targetName: 'Bandit 1',
                attackerName: 'EvasiveFighter',
            }),
        });
    });
});

// FT-101 parity (fix#OA-parity 2026-10-22): the hook-path proceedWithDamage
// else-branch minimalCtx must carry isOpportunityAttack with the same
// `o.isOpportunityAttack || false` expression as the standalone twin (:39-58) —
// o is the same upstream source object on both paths (pendingCtxOverrides IS the
// ctxOverrides assigned at :406; the standalone receives ctxOverrides directly).
// Reachability verdict: LATENT in production — the hook's only production mount
// (CharActions.jsx:265) always injects a truthy buildCtxSync (:221 useCallback),
// so real OA damage resolves through the merge branch (pinned by the last test
// below, which shows the marker riding pendingCtxOverrides). The else branch is
// reached today only by test mounts with buildCtxSync: null — parity is therefore
// pinned at unit level: byte-exact full-set at the rollDamage seam (dropping
// any minimalCtx key dies) plus identical-input cross-path OA equality.
// Mock audit: same single steps/index.js stub as the standalone block — the hook
// is a plain factory (zero React hooks) called directly; with buildCtxSync null
// the else branch runs synchronously to the injected rollDamage, and the truthy
// buildCtxSync is injected, never a module import (fix#10r-clean: no
// applyDamage/saveBonuses surfaces involved).
describe('hook damage OA transport (FT-101 parity)', () => {
    const attack = { name: 'Glaive', damage: '1d10+5', damageType: 'Slashing', hitBonus: 9 };
    const playerStats = { name: 'EvasiveFighter', attacks: [attack] };

    // Mirrors attackRollPostDamage.js:338 — same handoff shape as the standalone
    // block above, so both paths see identical inputs at proceedWithDamage.
    const mockPipelineHandoff = () => ({
        run: vi.fn(async (_event, ctx) => {
            ctx.proceedWithDamage({ attack, formula: '1d10+5', total: 8, rolls: [3], modifier: 5, pipelineCtx: ctx });
        }),
        resume: vi.fn(),
    });

    const flushMicrotasks = async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
    };

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

    beforeEach(() => {
        vi.resetAllMocks();
        buildPipelineForAction.mockReturnValue(mockPipelineHandoff());
    });

    it('buildCtxSync null: OA TRUE rides the hook minimalCtx — byte-exact full-set pin', async () => {
        const { api, rollDamage } = useResolution();

        await api.resolveAttackDamage(attack, { targetName: 'Bandit 1', isOpportunityAttack: true });

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage.mock.calls[0][0]).toStrictEqual({
            name: 'Glaive',
            formula: '1d10+5',
            total: 8,
            rolls: [3],
            modifier: 5,
            context: {
                damageType: 'Slashing',
                targetName: 'Bandit 1',
                attackerName: 'Glaive',
                critLabels: null,
                autoDamageSecondaryFormula: null,
                autoDamageSecondaryName: null,
                autoDamageSecondaryDamageType: null,
                saveDc: null,
                saveType: null,
                dcSuccess: null,
                tavernBrawlerRerolls: null,
                isOpportunityAttack: true,
            },
        });
    });

    it('buildCtxSync null: OA omitted — false default, exact standalone-twin semantics', async () => {
        const { api, rollDamage } = useResolution();

        await api.resolveAttackDamage(attack, { targetName: 'Bandit 1' });

        expect(rollDamage.mock.calls[0][0].context.isOpportunityAttack).toBe(false);
    });

    it('cross-path parity: identical OA input marks both rollDamage seams identically, key present on both', async () => {
        const { api, rollDamage: hookRollDamage } = useResolution();
        await api.resolveAttackDamage(attack, { targetName: 'Bandit 1', isOpportunityAttack: true });

        const standaloneRollDamage = vi.fn();
        buildPipelineForAction.mockReturnValue(mockPipelineHandoff());
        await resolveAttackDamageStandalone(
            attack,
            { targetName: 'Bandit 1', attackerName: 'EvasiveFighter', isOpportunityAttack: true },
            { playerStats, campaignName: 'test-campaign', setPopupHtml: vi.fn(), rollDamage: standaloneRollDamage }
        );

        const hookCtx = hookRollDamage.mock.calls[0][0].context;
        const standaloneCtx = standaloneRollDamage.mock.calls[0][0].context;
        expect('isOpportunityAttack' in hookCtx).toBe(true);
        expect('isOpportunityAttack' in standaloneCtx).toBe(true);
        expect(hookCtx.isOpportunityAttack).toBe(standaloneCtx.isOpportunityAttack);
    });

    it('production branch: with truthy buildCtxSync the merged ctx still carries the OA marker', async () => {
        const buildCtxSync = vi.fn(async () => ({ sneakAttackDice: 0 }));
        const { api, rollDamage } = useResolution({ buildCtxSync });

        await api.resolveAttackDamage(attack, { targetName: 'Bandit 1', isOpportunityAttack: true });
        await flushMicrotasks();

        expect(buildCtxSync).toHaveBeenCalledWith(attack, { consumeAttackTe: false });
        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage.mock.calls[0][0].context.isOpportunityAttack).toBe(true);
    });
});
