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

import { resolveAttackDamageStandalone } from './useAttackDamageResolution.js';
import { buildPipelineForAction } from '../../services/combat/steps/index.js';

// FT-101 transport pin: the OA marker must ride ctxOverrides all the way to
// BOTH consumer gates — pipeline ctx (Charger gate, attackRollRiders.js:126,
// via the raw ...ctxOverrides spread) and rollDamage minimalCtx (source:57,
// read by handlePlainDamage's Sentinel/Halt gate in MonsterCardModal).
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
