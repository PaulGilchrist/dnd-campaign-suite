// @maintained-by-ai
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

    // resolveDamageContextFlags uses ?? so explicit false/0 overrides must beat
    // truthy popup-derived values; unknown keys arrive via the raw ...ctxOverrides spread.
    it.each([
        {
            name: 'popupHtml.isCrit derives hit=true when popupHtml.hit is absent',
            popupHtml: { isCrit: true },
            attack: LONGSWORD,
            overrides: {},
            expected: { hit: true, isCrit: true, isNatural20: false, targetName: null, isBonusActionAttack: false },
        },
        {
            name: 'ctxOverrides.hit=false beats popup-derived hit=true (?? not ||)',
            popupHtml: { hit: true, isCrit: true },
            attack: LONGSWORD,
            overrides: { hit: false },
            expected: { hit: false, isCrit: true },
        },
        {
            name: 'ctxOverrides override popup per-field; un-overridden isNatural20 still derived',
            popupHtml: { hit: false, isCrit: false, targetName: 'Orc', isNatural20: true },
            attack: LONGSWORD,
            overrides: { hit: true, isCrit: true, targetName: 'Goblin' },
            expected: { hit: true, isCrit: true, targetName: 'Goblin', isNatural20: true },
        },
        {
            name: 'null/empty popupHtml defaults every derived flag to false/null/0/1',
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
            name: 'non-bonus attack.type derives isBonusActionAttack=false',
            popupHtml: null,
            attack: { ...LONGSWORD, type: 'Action' },
            overrides: {},
            expected: { isBonusActionAttack: false },
        },
        {
            name: 'missing attack.type derives isBonusActionAttack=false',
            popupHtml: null,
            attack: LONGSWORD,
            overrides: {},
            expected: { isBonusActionAttack: false },
        },
        {
            name: 'ctxOverrides.isBonusActionAttack=false beats attack.type "Bonus Action"',
            popupHtml: null,
            attack: { ...LONGSWORD, type: 'Bonus Action' },
            overrides: { isBonusActionAttack: false },
            expected: { isBonusActionAttack: false },
        },
        {
            name: 'overchannel numeric overrides pass through to ctx',
            popupHtml: null,
            attack: { name: 'Fire Bolt', damage: '1d10+4', damageType: 'fire' },
            overrides: { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 3 },
            expected: { overchannelActive: true, overchannelUseCount: 2, overchannelSpellLevel: 3 },
        },
        {
            name: 'ctxOverrides.empoweredEvocationModifier=4 passes through (and stays 0 without it)',
            popupHtml: null,
            attack: { name: 'Fire Bolt', damage: '1d10+4', damageType: 'fire' },
            overrides: { empoweredEvocationModifier: 4 },
            expected: { empoweredEvocationModifier: 4 },
        },
        {
            name: 'arbitrary ctxOverrides keys reach ctx via raw spread',
            popupHtml: null,
            attack: LONGSWORD,
            overrides: {
                sneakDice: 4,
                effectiveSneakDice: 4,
                isMeleeOrUnarmed: true,
                autoFormulaOverride: 'custom formula',
                autoDamageSaveDc: 16,
                attackerName: 'Custom Attacker',
            },
            expected: {
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
