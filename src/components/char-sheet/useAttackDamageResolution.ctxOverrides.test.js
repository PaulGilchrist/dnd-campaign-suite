import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    executeAttackRiderManeuver: vi.fn(),
    applyManeuveringAllyGrant: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/combat/steps/index.js', () => ({
    buildPipelineForAction: vi.fn(() => mockPipeline),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const mockPipeline = {
    run: vi.fn().mockResolvedValue(undefined),
};

const mockPlayerStats = {
    name: 'TestWizard',
    level: 10,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
    proficiency: 5,
    class: { name: 'Wizard', class_levels: [{ level: 10 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';

const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

const mockPendingDamageRef = { current: null };

function UseAttackDamageResolution(overrides = {}) {
    const deps = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: mockPendingDamageRef.current,
        setPendingDamage: vi.fn(),
        resumeRef: mockPendingDamageRef,
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function getCtx() {
    const runCalls = mockPipeline.run.mock.calls;
    return runCalls.length > 0 ? runCalls[runCalls.length - 1][1] : null;
}

describe('useAttackDamageResolution - ctxOverrides and popupHtml fallbacks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 3 });
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        Object.keys(modalState).forEach(k => delete modalState[k]);
        mockSetModalState.mockClear();
        mockPendingDamageRef.current = null;
        mockPipeline.run.mockClear();
    });

    describe('popupHtml fallbacks for hit/crit flags', () => {
        it('uses popupHtml.isCrit to set hit when popupHtml.hit is not provided', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { isCrit: true, hit: undefined },
            });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.hit).toBe(true);
            expect(ctx.isCrit).toBe(true);
        });

        it('prefers ctxOverrides.hit over popupHtml.isCrit', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { isCrit: true, hit: true },
            });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack, { hit: false });
            const ctx = getCtx();
            expect(ctx.hit).toBe(false);
            expect(ctx.isCrit).toBe(true);
        });

        it('defaults hit to false when popupHtml is null', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.hit).toBe(false);
            expect(ctx.isCrit).toBe(false);
            expect(ctx.isNatural20).toBe(false);
            expect(ctx.targetName).toBe(null);
            expect(ctx.isBonusActionAttack).toBe(false);
            expect(ctx.overchannelActive).toBe(false);
            expect(ctx.overchannelUseCount).toBe(0);
            expect(ctx.overchannelSpellLevel).toBe(1);
            expect(ctx.empoweredEvocationModifier).toBe(0);
        });

        it('defaults all fields to false/null/zero when popupHtml is empty object', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: {},
            });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.hit).toBe(false);
            expect(ctx.isCrit).toBe(false);
            expect(ctx.isNatural20).toBe(false);
            expect(ctx.targetName).toBe(null);
        });
    });

    describe('isBonusActionAttack detection', () => {
        it('detects bonus action from attack.type', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Handaxe', damage: '1d6+3', damageType: 'slashing', type: 'Bonus Action' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.isBonusActionAttack).toBe(true);
        });

        it('does not detect bonus action for non-bonus action attack types', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', type: 'Action' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.isBonusActionAttack).toBe(false);
        });

        it('does not detect bonus action when attack.type is missing', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.isBonusActionAttack).toBe(false);
        });

        it('prefers ctxOverrides.isBonusActionAttack over attack.type', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Handaxe', damage: '1d6+3', damageType: 'slashing', type: 'Bonus Action' };

            await resolveAttackDamage(attack, { isBonusActionAttack: false });
            const ctx = getCtx();
            expect(ctx.isBonusActionAttack).toBe(false);
        });
    });

    describe('overchannelActive overrides', () => {
        it('passes overchannel overrides through to ctx', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Fire Bolt', damage: '1d10+4', damageType: 'fire' };

            await resolveAttackDamage(attack, {
                overchannelActive: true,
                overchannelUseCount: 2,
                overchannelSpellLevel: 3,
            });
            const ctx = getCtx();
            expect(ctx.overchannelActive).toBe(true);
            expect(ctx.overchannelUseCount).toBe(2);
            expect(ctx.overchannelSpellLevel).toBe(3);
        });

        it('defaults overchannel values when not in ctxOverrides', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Fire Bolt', damage: '1d10+4', damageType: 'fire' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.overchannelActive).toBe(false);
            expect(ctx.overchannelUseCount).toBe(0);
            expect(ctx.overchannelSpellLevel).toBe(1);
        });
    });

    describe('empoweredEvocationModifier override', () => {
        it('passes empoweredEvocationModifier through to ctx and defaults to 0', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Fire Bolt', damage: '1d10+4', damageType: 'fire' };

            await resolveAttackDamage(attack, { empoweredEvocationModifier: 4 });
            let ctx = getCtx();
            expect(ctx.empoweredEvocationModifier).toBe(4);

            mockPipeline.run.mockClear();
            await resolveAttackDamage(attack);
            ctx = getCtx();
            expect(ctx.empoweredEvocationModifier).toBe(0);
        });
    });

    describe('resolveAttackDamage returns', () => {
        it('returns a promise that resolves when pipeline completes', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            const result = resolveAttackDamage(attack);
            expect(result).toBeInstanceOf(Promise);

            await result;
            expect(mockPipeline.run).toHaveBeenCalled();
        });

        it('adds resolveAttackDamage to context for nested attacks', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack);
            const ctx = getCtx();
            expect(ctx.resolveAttackDamage).toBe(resolveAttackDamage);
        });
    });

    describe('ctxOverrides spread into pipeline context', () => {
        it('spreads all ctxOverrides into the pipeline context', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack, {
                sneakDice: 4,
                effectiveSneakDice: 4,
                isMeleeOrUnarmed: true,
                autoFormulaOverride: 'custom formula',
                autoDamageSaveDc: 16,
                attackerName: 'Custom Attacker',
            });
            const ctx = getCtx();
            expect(ctx.sneakDice).toBe(4);
            expect(ctx.effectiveSneakDice).toBe(4);
            expect(ctx.isMeleeOrUnarmed).toBe(true);
            expect(ctx.autoFormulaOverride).toBe('custom formula');
            expect(ctx.autoDamageSaveDc).toBe(16);
            expect(ctx.attackerName).toBe('Custom Attacker');
        });

        it('ctxOverrides override popupHtml values for the same field', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({
                popupHtml: { hit: false, isCrit: false, targetName: 'Orc', isNatural20: true },
            });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing' };

            await resolveAttackDamage(attack, { hit: true, isCrit: true, targetName: 'Goblin' });
            const ctx = getCtx();
            expect(ctx.hit).toBe(true);
            expect(ctx.isCrit).toBe(true);
            expect(ctx.targetName).toBe('Goblin');
            expect(ctx.isNatural20).toBe(true);
        });
    });
});
