// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// Only true externals are mocked (runtime store, combat round, combat context,
// network log, damage application, mastery queries). diceRoller and the whole
// attack damage pipeline run REAL — blanket-mocking rollExpression fabricates
// phantom legs (e.g. flat 'rage_damage' → '2' is NOT rollable by the real
// dice grammar; only canonical 'rage_damage_d6' lands on the formula).
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
    // Honest evaluator: resolves pure constants only, falsy for everything else.
    evaluateAutoExpression: vi.fn((expr) => /^\d+$/.test(String(expr).trim()) ? Number(expr) : null),
    hasTwoWeaponFighting: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => Promise.resolve({ total: 0 })),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';

const mockCampaignName = 'test-campaign';

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Wisdom', bonus: 4 },
    ],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const RAGING_BUFFS = [
    { effect: 'advantage_attacks_advantage_against' }, // Reckless Attack marker
    { damageBonusExpression: '2' },                      // Rage damage marker
];

// CLA-147 canon (public/data/classes.json Frenzy, Path of the Berserker):
// rage_damage_d6 resolves via resolveDiceExpression tokens → '2d6' (rage_damage 2).
const FRENZY_ACTION = {
    name: 'Frenzy',
    type: 'damage_bonus',
    trigger: 'reckless_attack_hit_while_raging',
    damageExpression: 'rage_damage_d6',
    damageType: 'same_as_weapon',
    oncePerTurn: true,
};

function defaultRuntimeValue(_name, key) {
    if (key === 'activeBuffs') return RAGING_BUFFS;
    return null;
}

function runtimeDefaults() {
    getRuntimeValue.mockImplementation(defaultRuntimeValue);
}

function UseAttackDamageResolution(stats = mockPlayerStats, mapName = null) {
    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    const rollDamage = vi.fn();
    const resumeRef = { current: null };
    const buildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const hook = useAttackDamageResolution({
        playerStats: stats,
        campaignName: mockCampaignName,
        mapName,
        popupHtml: null,
        setPopupHtml,
        rollDamage,
        buildCtx: mapName ? vi.fn(() => Promise.resolve({ targetName: 'Goblin' })) : undefined,
        buildCtxSync,
        setModalState,
        setPendingDamage: vi.fn(),
        resumeRef,
    });
    return { hook, rollDamage, setModalState, setPopupHtml, resumeRef, buildCtxSync };
}

describe('useAttackDamageResolution - automation damage trigger dispatch', () => {
    // Deterministic RNG: Math.random() → 0.99 makes diceRoller's
    // floor(Math.random() * sides) + 1 land every die on its max face
    // (IEEE-754: floor(0.99*12)=11 → 12, floor(0.99*6)=5 → 6, floor(0.99*4)=3 → 4),
    // so totals are exact pins rather than expect.any(Number).
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        vi.clearAllMocks();
        getCurrentCombatRound.mockReturnValue(1);
        runtimeDefaults();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('monk weapon / unarmed strike rider (monk_weapon_or_unarmed_hit)', () => {
        const monkAttack = {
            name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
            weaponType: 'unarmed', properties: [],
        };

        it.each([
            {
                label: 'defaults to fire when no Elemental Attunement is set',
                attunement: null,
                expected: { formula: '1d6 [bludgeoning] + 1d6 [fire]', total: 12, rolls: [6, 6] },
            },
            {
                label: 'uses the attuned Cold type when set',
                attunement: 'Cold',
                expected: { formula: '1d6 [bludgeoning] + 1d6 [cold]', total: 12, rolls: [6, 6] },
            },
            {
                label: 'absent rider never touches the formula (trigger discrimination)',
                absentAction: true,
                expected: { formula: '1d6 [bludgeoning]', total: 6, rolls: [6] },
            },
        ])('$label', async ({ attunement, absentAction, expected }) => {
            if (attunement) {
                getRuntimeValue.mockImplementation((_name, key) =>
                    key === '_Elemental_Attunement_option' ? attunement : null);
            }
            const actions = absentAction ? [] : [
                { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: 'fire' },
            ];
            const { hook, rollDamage, setModalState } = UseAttackDamageResolution({ ...mockPlayerStats, automation: { actions, passives: [] } });

            await hook.resolveAttackDamage(monkAttack);
            await Promise.resolve();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith({
                name: 'Unarmed Strike',
                formula: expected.formula,
                total: expected.total,
                rolls: expected.rolls,
                modifier: 0,
                context: expect.any(Object),
            });
            // fire-by-default is a single-type rider — never opens the type-choice modal
            expect(setModalState).not.toHaveBeenCalledWith(expect.objectContaining({ damageTypeChoice: expect.anything() }));
        });
    });

    describe('GWM heavy weapon rider (melee_heavy_weapon_hit)', () => {
        const heavyAttack = {
            name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
            weaponType: 'melee', properties: ['Heavy'],
        };
        const gwmAction = (damageType) => ({
            type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType,
        });

        it.each([
            { label: 'explicit Force type', action: gwmAction('Force'), expected: { formula: '1d12+3 [slashing] + 1d4 [force]', total: 19 } },
            { label: 'same_as_weapon borrows the weapon type', action: gwmAction('same_as_weapon'), expected: { formula: '1d12+3 [slashing] + 1d4 [slashing]', total: 19 } },
        ])('applies $label on a Heavy weapon', async ({ action, expected }) => {
            const { hook, rollDamage } = UseAttackDamageResolution({ ...mockPlayerStats, automation: { actions: [action], passives: [] } });

            await hook.resolveAttackDamage(heavyAttack);

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith({
                name: 'Greataxe',
                formula: expected.formula,
                total: expected.total,
                rolls: [12, 4],
                modifier: 3,
                context: expect.any(Object),
            });
        });

        it('never rolls the rider die when the weapon is not Heavy', async () => {
            const { hook, rollDamage } = UseAttackDamageResolution({
                ...mockPlayerStats,
                automation: { actions: [gwmAction('Force')], passives: [] },
            });

            await hook.resolveAttackDamage({
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            });

            // positive leg is pinned above — here the Heavy gate keeps 1d4 unspent
            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({
                formula: '1d8+3 [slashing]',
                total: 11,
            }));
            expect(evaluateAutoExpression).not.toHaveBeenCalledWith('1d4', expect.anything());
        });
    });

    describe('Frenzy rider (reckless_attack_hit_while_raging)', () => {
        const frenzyAttack = {
            name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
            weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
        };

        it('hits raging+reckless+Strength: rolls 2d6 once, stamps _frenzyUsedRound, no modal', async () => {
            const { hook, rollDamage, setModalState } = UseAttackDamageResolution({
                ...mockPlayerStats,
                automation: { actions: [FRENZY_ACTION], passives: [] },
            });

            await hook.resolveAttackDamage(frenzyAttack, { hit: true });

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith({
                name: 'Greataxe',
                formula: '1d12+3 [slashing] + 2d6 [slashing]',
                total: 27,
                rolls: [12, 6, 6],
                modifier: 3,
                context: expect.objectContaining({ hit: true }),
            });
            // featureRiders step null-clears unrelated keys on every attack —
            // pin the one frenzy latch write it must make.
            const stampCalls = setRuntimeValue.mock.calls.filter(c => c[1] === '_frenzyUsedRound');
            expect(stampCalls).toEqual([['TestFighter', '_frenzyUsedRound', 1, mockCampaignName]]);
            // inline rider: no modal may open on the triggering hit
            const modalOpens = setModalState.mock.calls.filter(([u]) => Object.values(u || {}).some(Boolean));
            expect(modalOpens).toHaveLength(0);
        });

        it.each([
            {
                label: 'skips when already used this round, latch untouched',
                setup: () => getRuntimeValue.mockImplementation((_n, key) => {
                    if (key === '_frenzyUsedRound') return 1;
                    return defaultRuntimeValue(_n, key);
                }),
                formula: '1d12+3 [slashing]', total: 15, stamped: false,
            },
            {
                label: 're-arms when the round advanced',
                setup: () => {
                    getCurrentCombatRound.mockReturnValue(2);
                    getRuntimeValue.mockImplementation((_n, key) => {
                        if (key === '_frenzyUsedRound') return 1;
                        return defaultRuntimeValue(_n, key);
                    });
                },
                formula: '1d12+3 [slashing] + 2d6 [slashing]', total: 27, stamped: true, round: 2,
            },
            {
                label: 'skips when the rage buff is missing (no damageBonusExpression)',
                setup: () => getRuntimeValue.mockImplementation((_n, key) => {
                    if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
                    return null;
                }),
                formula: '1d12+3 [slashing]', total: 15, stamped: false,
            },
            {
                label: 'skips on a miss',
                setup: () => runtimeDefaults(),
                hit: false,
                formula: '1d12+3 [slashing]', total: 15, stamped: false,
            },
        ])('Frenzy: $label', async ({ setup, hit, formula, total, stamped, round }) => {
            setup();
            const { hook, rollDamage } = UseAttackDamageResolution({
                ...mockPlayerStats,
                automation: { actions: [FRENZY_ACTION], passives: [] },
            });

            await hook.resolveAttackDamage(frenzyAttack, { hit: hit ?? true });

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula, total }));
            const stampCalls = setRuntimeValue.mock.calls.filter(c => c[1] === '_frenzyUsedRound');
            if (stamped) {
                expect(stampCalls).toEqual([['TestFighter', '_frenzyUsedRound', round ?? 1, mockCampaignName]]);
            } else {
                expect(stampCalls).toHaveLength(0);
            }
        });
    });

    describe('empty automation', () => {
        const plainAttack = {
            name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
            weaponType: 'melee', properties: [],
        };

        it.each([
            { label: 'empty actions[]', automation: { actions: [], passives: [] } },
            { label: 'automation missing entirely', automation: undefined },
        ])('delivers base weapon damage only when $label', async ({ automation }) => {
            const { hook, rollDamage } = UseAttackDamageResolution({ ...mockPlayerStats, automation });

            await hook.resolveAttackDamage(plainAttack);

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith({
                name: 'Longsword',
                formula: '1d8+3 [slashing]',
                total: 11,
                rolls: [8],
                modifier: 3,
                context: expect.any(Object),
            });
        });
    });
});
