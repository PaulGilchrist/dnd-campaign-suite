// SP-052: Foresight/Blur attacker-side Disadvantage on the PC popup lane.
// The deferred resolver lane (hasBlurOrForesightWithoutCounter) accumulated
// dis++ but buildAttackContextSync never converted it — attacker rolls were
// logged mode:'normal' against foresighted targets. Single choke point:
// forcedMode is re-resolved once from the combined counts after
// resolveDeferredAttackMode (same resolveAdvantageMode fold, no forks).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { computeConditionEffects, combineAttackModes } from '../combat/conditions/conditionEffects.js';

vi.mock('./common/damageRoll.js', () => ({
    buildBaseAttackContext: vi.fn(),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../rules/combat/rangeValidation.js', () => ({
    computeRangeEffect: vi.fn(),
    computeMeleeProximityEffect: vi.fn(),
    getDistanceFeet: vi.fn(),
    isHostileNPC: vi.fn(),
    getNearestPlacedItem: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../rules/combat/coverService.js', () => ({
    computeCover: vi.fn(),
}));

vi.mock('../npcs/npcsService.js', () => ({
    loadNPCs: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../combat/buffs/buffService.js', () => ({
    getInnateSorceryBonus: vi.fn(),
}));

vi.mock('../combat/auras/wolfAuraUtils.js', () => ({
    getWolfAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({
    getDuplicityAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/lionAuraUtils.js', () => ({
    getLionDisadvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
    isActive: vi.fn(),
    isAuraTarget: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
    isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
    isCreatureWarded: vi.fn().mockReturnValue(false),
    handle: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn().mockReturnValue(false),
    handle: vi.fn(),
}));

vi.mock('../combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }),
}));

vi.mock('../combat/automation/automationExpressions.js', () => ({
    resolveDiceExpression: vi.fn(),
}));

vi.mock('../combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn().mockReturnValue(false),
}));

vi.mock('../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');

const attackerStats = (overrides = {}) => ({
    name: 'ElfTest',
    level: 5,
    proficiency: 2,
    class: { name: 'Wizard', class_levels: [] },
    abilities: [{ name: 'Dexterity', bonus: 3 }],
    automation: { passives: [] },
    senses: [],
    ...overrides,
});

const attack = {
    name: 'Unarmed Strike',
    damage: '1d4-1',
    damageType: 'Bludgeoning',
    hitBonus: 1,
    hitBonusFormula: 'To Hit = -1 + 2',
    weaponType: 'unarmed',
};

function teMock(targetEffects, attackerBuffs = []) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return targetEffects;
        if (key === 'activeBuffs') return name === 'ElfTest' ? attackerBuffs : [];
        return undefined;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    buildBaseAttackContext.mockResolvedValue({
        target: { name: 'Bandit 1' },
        targetName: 'Bandit 1',
        resistanceNotice: null,
    });
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
});

describe('SP-052 contextBuilder-sync: attacker Disadvantage vs foresight/blur targets', () => {
    it('forces mode:"disadvantage" for a PC attacking a foresighted target (no counter senses)', async () => {
        teMock([{ effect: 'foresight', target: 'Bandit 1', source: 'DivinationWizard', duration: '8_hours' }]);

        const ctx = await buildAttackContextSync(attack, attackerStats(), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBe('disadvantage');
    });

    it('forces mode:"disadvantage" for a PC attacking a blurred target (same lane)', async () => {
        teMock([{ effect: 'blur', target: 'Bandit 1', source: 'Ranger' }]);

        const ctx = await buildAttackContextSync(attack, attackerStats(), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBe('disadvantage');
    });

    it('honors the Blindsight counter: mode stays normal', async () => {
        teMock([{ effect: 'foresight', target: 'Bandit 1', source: 'DivinationWizard' }]);

        const ctx = await buildAttackContextSync(attack, attackerStats({ senses: [{ name: 'Blindsight' }] }), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBeUndefined();
    });

    it('honors the Truesight counter: mode stays normal', async () => {
        teMock([{ effect: 'foresight', target: 'Bandit 1', source: 'DivinationWizard' }]);

        const ctx = await buildAttackContextSync(attack, attackerStats({ senses: [{ name: 'Truesight' }] }), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBeUndefined();
    });

    it('does not self-penalize the foresighted creature attacking someone else', async () => {
        teMock([{ effect: 'foresight', target: 'ElfTest', source: 'DivinationWizard' }]);
        getRuntimeValue.mockImplementation((name, key) => {
            if (name === 'campaign' && key === 'targetEffects') return [{ effect: 'foresight', target: 'ElfTest', source: 'DivinationWizard' }];
            if (key === 'activeBuffs') return [];
            return undefined;
        });
        buildBaseAttackContext.mockResolvedValue({ target: { name: 'Orc' }, targetName: 'Orc', resistanceNotice: null });

        const ctx = await buildAttackContextSync(attack, attackerStats(), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBeUndefined();
    });

    it('the caster attacking its own foresighted ally is an "other creature" — disadvantage ships (matches te-consumer convention)', async () => {
        teMock([{ effect: 'foresight', target: 'Bandit 1', source: 'ElfTest' }]);

        const ctx = await buildAttackContextSync(attack, attackerStats(), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBe('disadvantage');
    });

    it('upstream decided advantage is preserved (resolver-first convention)', async () => {
        teMock([{ effect: 'foresight', target: 'Bandit 1', source: 'Wizard' }], [{ effect: 'advantage_attacks_and_saves' }]);

        const ctx = await buildAttackContextSync(attack, attackerStats(), 'test-campaign', 'normal');

        expect(ctx.forcedMode).toBe('advantage');
    });
});

describe('SP-052 canonical te-consumer fold (MonsterCardModal lane) keeps foresight semantics', () => {
    const emptySide = () => computeConditionEffects({ targetEffects: [], attackerSenses: [] });

    it('foresight holder attacking keeps Advantage', () => {
        const holderEffects = computeConditionEffects({
            targetEffects: [{ effect: 'foresight', target: 'ElfTest', source: 'DivinationWizard' }],
            attackerSenses: [],
        });
        expect(holderEffects.attackAdvantageCount).toBe(1);

        expect(combineAttackModes(holderEffects, emptySide(), 5, 'Orc')).toBe('advantage');
    });

    it('other creature attacking the foresight holder gets Disadvantage', () => {
        const holderAsTarget = computeConditionEffects({
            targetEffects: [{ effect: 'foresight', target: 'ElfTest', source: 'DivinationWizard' }],
            attackerSenses: [],
        });

        expect(combineAttackModes(emptySide(), holderAsTarget, 5, 'ElfTest')).toBe('disadvantage');
    });

    it('attacker with Blindsight attacking the foresight holder rolls normal', () => {
        const holderAsTarget = computeConditionEffects({
            targetEffects: [{ effect: 'foresight', target: 'ElfTest', source: 'DivinationWizard' }],
            attackerSenses: [{ name: 'Blindsight' }],
        });

        expect(combineAttackModes(emptySide(), holderAsTarget, 5, 'ElfTest')).toBe('normal');
    });
});
