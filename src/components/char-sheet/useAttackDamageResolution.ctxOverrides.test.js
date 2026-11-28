// @maintained-by-ai 2026-11-28
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// Mock audit vs useAttackDamageResolution.js import graph (its 8 static imports):
// every module it imports is stubbed so nothing loads; the pipeline is stubbed
// so the exact ctx that reaches pipeline.run is observable as consumer call args.
// No dice roll happens on this path (rollExpression is stubbed only to satisfy
// the module import, never invoked nor asserted).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

import { buildPipelineForAction } from '../../services/combat/steps/index.js';

const pipelineRun = vi.fn(() => Promise.resolve());

const LONGSWORD = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };
const mockPlayerStats = { name: 'TestWizard', level: 10 };

function useResolution(overrides = {}) {
    return useAttackDamageResolution({
        playerStats: mockPlayerStats,
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(),
        buildCtxSync: vi.fn(),
        setModalState: vi.fn(),
        setPendingDamage: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    });
}

function lastCtx() {
    expect(pipelineRun.mock.calls.length).toBeGreaterThan(0);
    return pipelineRun.mock.calls[pipelineRun.mock.calls.length - 1][1];
}

describe('useAttackDamageResolution ctxOverrides: override-vs-derived precedence at the pipeline seam', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        buildPipelineForAction.mockReturnValue({ run: pipelineRun, resume: vi.fn() });
    });

    // Seam contract (useAttackDamageResolution.js:420-450): ctx is built as
    // { ...resolveDamageContextFlags(overrides, popupHtml, attack), ...ctxOverrides }
    // — the trailing raw spread re-applies every override verbatim, so overrides
    // always win at the observable seam and the flag function only matters for
    // keys the caller did NOT override. Rows below each pin one distinguishable
    // branch: popup-derived truthy values, popup-derived defaults, or spread
    // pass-through. (The ?? vs || law is fix#121's normalizeAutoDamage lane,
    // owned by normalizeAutoDamage.test.js — not observable through this seam.)
    it.each([
        {
            name: 'popupHtml.isCrit derives hit=true via the isCrit OR-term; absent fields default',
            popupHtml: { isCrit: true },
            attack: LONGSWORD,
            overrides: {},
            expected: { hit: true, isCrit: true, isNatural20: false, targetName: null, isBonusActionAttack: false },
        },
        {
            name: 'popupHtml.hit/isNatural20/targetName derive to ctx when not overridden',
            popupHtml: { hit: true, isNatural20: true, targetName: 'Orc' },
            attack: LONGSWORD,
            overrides: {},
            expected: { hit: true, isCrit: false, isNatural20: true, targetName: 'Orc' },
        },
        {
            name: 'explicit false overrides beat popup- and attack-derived truths, per-field',
            popupHtml: { hit: true, isCrit: true },
            attack: { ...LONGSWORD, type: 'Bonus Action' },
            overrides: { hit: false, isBonusActionAttack: false },
            expected: { hit: false, isBonusActionAttack: false, isCrit: true },
        },
        {
            name: 'null popupHtml and no overrides default every derived flag to false/null/0/1',
            popupHtml: null,
            attack: LONGSWORD,
            overrides: {},
            expected: {
                hit: false, isCrit: false, isNatural20: false, targetName: null,
                isBonusActionAttack: false, overchannelActive: false, overchannelUseCount: 0,
                overchannelSpellLevel: 1, empoweredEvocationModifier: 0,
            },
        },
        {
            name: 'attack.type "Bonus Action" derives isBonusActionAttack=true',
            popupHtml: null,
            attack: { ...LONGSWORD, type: 'Bonus Action' },
            overrides: {},
            expected: { isBonusActionAttack: true },
        },
        {
            // fix#121 signed parity: a negative INT mod passes through verbatim
            // (never floored to 0) alongside the other spread keys.
            name: 'all ctxOverrides keys pass through to ctx verbatim (raw spread)',
            popupHtml: null,
            attack: LONGSWORD,
            overrides: {
                overchannelActive: true,
                overchannelUseCount: 2,
                overchannelSpellLevel: 3,
                empoweredEvocationModifier: -3,
                sneakDice: 4,
                effectiveSneakDice: 4,
                isMeleeOrUnarmed: true,
                autoFormulaOverride: 'custom formula',
                autoDamageSaveDc: 16,
                attackerName: 'Custom Attacker',
            },
            expected: {
                overchannelActive: true,
                overchannelUseCount: 2,
                overchannelSpellLevel: 3,
                empoweredEvocationModifier: -3,
                sneakDice: 4,
                effectiveSneakDice: 4,
                isMeleeOrUnarmed: true,
                autoFormulaOverride: 'custom formula',
                autoDamageSaveDc: 16,
                attackerName: 'Custom Attacker',
            },
        },
    ])('$name', async ({ popupHtml, attack, overrides, expected }) => {
        const { resolveAttackDamage } = useResolution({ popupHtml });
        await resolveAttackDamage(attack, overrides);
        expect(lastCtx()).toMatchObject(expected);
    });

    it('kicks pipeline with housekeeping:do, passes the resumeRef seam, and ctx self-references resolveAttackDamage for nested attacks', async () => {
        const resumeRef = { current: null };
        const { resolveAttackDamage } = useResolution({ resumeRef });

        await resolveAttackDamage(LONGSWORD);

        expect(pipelineRun).toHaveBeenCalledTimes(1);
        const [event, ctx, ref] = pipelineRun.mock.calls[0];
        expect(event).toBe('housekeeping:do');
        expect(ref).toBe(resumeRef);
        expect(ctx.resolveAttackDamage).toBe(resolveAttackDamage);
    });
});
