// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// Hook-seam lane: generic damage_bonus / attack_rider trigger dispatch through
// the REAL buildPipelineForAction. Sibling lanes own their triggers:
// automationDamage (monk/GWM/Frenzy), advancedAutomations (cantrip riders),
// pausedStates (applyPauseState with a faked pipeline), classFeatures, feats,
// ctxOverrides. Only true externals are mocked — diceRoller runs REAL.
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
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';

const CAMPAIGN = 'test-campaign';
const PLAYER = 'TestFighter';

const basePlayerStats = {
    name: PLAYER,
    level: 5,
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

// Base roll with seeded RNG: d8 → 8, modifier +3 → total 11.
const baseAttack = {
    name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
    weaponType: 'melee', properties: [], abilityName: 'Strength',
};
const baseCtx = { hit: true, targetName: 'Goblin' };

const statsWith = (actions, passives = []) => ({
    ...basePlayerStats,
    automation: { actions, passives },
});

// Buff list that marks the character as raging (rage damage marker).
const RAGING_BUFFS = [{ damageBonusExpression: '2' }];

function UseAttackDamageResolution(stats, popupHtml = null) {
    const rollDamage = vi.fn();
    const setModalState = vi.fn();
    const setPopupHtml = vi.fn();
    const setPendingDamage = vi.fn();
    const resumeRef = { current: null };
    const hook = useAttackDamageResolution({
        playerStats: stats,
        campaignName: CAMPAIGN,
        mapName: null,
        popupHtml,
        setPopupHtml,
        rollDamage,
        buildCtx: undefined,
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        setModalState,
        setPendingDamage,
        resumeRef,
    });
    return { hook, rollDamage, setModalState, setPopupHtml, setPendingDamage, resumeRef };
}

// Drain microtasks so proceedWithDamage's buildCtxSync().then() lands.
const flush = () => Promise.resolve();

// Filtered latch-write inspector: only the runtime key under test.
const latchWrites = (key) => setRuntimeValue.mock.calls.filter((c) => c[1] === key);

describe('useAttackDamageResolution - automations at the hook seam', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Deterministic RNG: Math.random() → 0.99 makes diceRoller's
        // floor(Math.random() * sides) + 1 land every die on its max face
        // (IEEE-754: floor(0.99*8)=7 → 8, floor(0.99*6)=5 → 6, floor(0.99*10)=9 → 10),
        // so every formula/total below is an exact pin, never expect.any(Number).
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        getActiveBuffs.mockReturnValue([]);
        getCombatContext.mockReturnValue(undefined);
        getTargetFromAttacker.mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('melee_weapon_hit rider lands on a melee hit', async () => {
        const { hook, rollDamage } = UseAttackDamageResolution(statsWith([
            { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
        ]));

        await hook.resolveAttackDamage(baseAttack, baseCtx);
        await flush();

        expect(rollDamage).toHaveBeenCalledTimes(1);
        expect(rollDamage).toHaveBeenCalledWith({
            name: 'Longsword',
            formula: '1d8+3 [slashing] + 1d4 [radiant]',
            total: 15,
            rolls: [8, 4],
            modifier: 3,
            context: expect.any(Object),
        });
    });

    describe('divine fury (first_hit_while_raging)', () => {
        const furyAction = (damageType) => ({
            name: 'Divine Fury', type: 'damage_bonus', trigger: 'first_hit_while_raging',
            damageExpression: '2d6', damageType, oncePerTurn: true,
        });

        it.each([
            {
                label: 'rolls inline and stamps _divineFuryUsedRound while raging',
                damageType: 'fire', usedRound: null,
                formula: '1d8+3 [slashing] + 2d6 [fire]', total: 23, rolls: [8, 6, 6], stamped: true,
            },
            {
                label: 'skips and leaves the latch untouched when already used this round',
                damageType: 'fire', usedRound: 1,
                formula: '1d8+3 [slashing]', total: 11, rolls: [8], stamped: false,
            },
        ])('$label', async ({ damageType, usedRound, formula, total, rolls, stamped }) => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === '_divineFuryUsedRound') return usedRound;
                if (key === 'activeBuffs') return RAGING_BUFFS;
                return null;
            });
            const { hook, rollDamage } = UseAttackDamageResolution(statsWith([furyAction(damageType)]));

            await hook.resolveAttackDamage(baseAttack, baseCtx);
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula, total, rolls }));
            expect(latchWrites('_divineFuryUsedRound')).toEqual(
                stamped ? [[PLAYER, '_divineFuryUsedRound', 1, CAMPAIGN]] : []
            );
        });

        it('"fire or cold" pauses the real pipeline: opens divineFuryChoice, stashes pendingDamage, damage stalls unrolled and unlatched', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return RAGING_BUFFS;
                return null;
            });
            const { hook, rollDamage, setModalState, setPendingDamage, resumeRef } = UseAttackDamageResolution(
                statsWith([furyAction('fire or cold')]),
            );

            await hook.resolveAttackDamage(baseAttack, baseCtx);
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(0);
            expect(setModalState).toHaveBeenCalledWith({
                divineFuryChoice: { damageType: 'fire or cold' },
            });
            expect(setPendingDamage).toHaveBeenCalledWith(expect.objectContaining({
                attack: baseAttack,
                bonusExpr: '2d6',
                bonusTotal: 12,
                bonusRolls: [6, 6],
            }));
            // The type is unresolved, so the once-per-round latch must NOT be spent yet.
            expect(latchWrites('_divineFuryUsedRound')).toHaveLength(0);
            expect(resumeRef.current?._modalType).toBe('divineFury');
        });
    });

    describe('weapon riders (weaponHitBonuses)', () => {
        const divineStrike = {
            name: 'Divine Strike', type: 'damage_bonus', trigger: 'weapon_attack_hit',
            damageExpression: '1d8', damageType: 'Radiant', oncePerTurn: true,
        };

        it.each([
            {
                label: 'applies once and stamps _Divine_Strike_usedRound',
                actions: [divineStrike], usedRound: null, round: 1,
                formula: '1d8+3 [slashing] + 1d8 [radiant]', total: 19, stamped: 1,
            },
            {
                label: 'skips when spent this round, latch untouched',
                actions: [divineStrike], usedRound: 1, round: 1,
                formula: '1d8+3 [slashing]', total: 11, stamped: false,
            },
            {
                label: 're-arms when the round advances, stamps the new round',
                actions: [divineStrike], usedRound: 1, round: 2,
                formula: '1d8+3 [slashing] + 1d8 [radiant]', total: 19, stamped: 2,
            },
            {
                label: 'upgraded rider replaces the base — only 3d8 lands',
                actions: [
                    divineStrike,
                    { name: 'Paladin 17', type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '3d8', damageType: 'Radiant', upgrades: 'Divine Strike' },
                ],
                usedRound: null, round: 1,
                formula: '1d8+3 [slashing] + 3d8 [radiant]', total: 35, stamped: false,
            },
        ])('$label', async ({ actions, usedRound, round, formula, total, stamped }) => {
            getCurrentCombatRound.mockReturnValue(round);
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === '_Divine_Strike_usedRound') return usedRound;
                return null;
            });
            const { hook, rollDamage } = UseAttackDamageResolution(statsWith(actions));

            await hook.resolveAttackDamage(baseAttack, baseCtx);
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula, total }));
            expect(latchWrites('_Divine_Strike_usedRound')).toEqual(
                stamped ? [[PLAYER, '_Divine_Strike_usedRound', stamped, CAMPAIGN]] : []
            );
            // Absence of the base 1d8 only meaningful when a rider branch ran at all
            // (positive legs pinned above): proves upgrades-subtraction, not a dead path.
            if (formula.includes('3d8')) {
                expect(formula).not.toContain(' + 1d8 [radiant]');
            }
        });
    });

    it('brutal strike rider lands while _brutalStrikeActive is latched, then both latches clear', async () => {
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === '_brutalStrikeActive') return true;
            return null;
        });
        const { hook, rollDamage } = UseAttackDamageResolution(statsWith([
            { name: 'Brutal Strike', type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '1d6', damageType: 'Radiant' },
        ]));

        await hook.resolveAttackDamage(baseAttack, baseCtx);
        await flush();

        expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({
            formula: '1d8+3 [slashing] + 1d6 [radiant]',
            total: 17,
            rolls: [8, 6],
        }));
        expect(latchWrites('_brutalStrikeActive')).toEqual([[PLAYER, '_brutalStrikeActive', null, CAMPAIGN]]);
        expect(latchWrites('_brutalStrikeEffects')).toEqual([[PLAYER, '_brutalStrikeEffects', null, CAMPAIGN]]);
    });

    describe('natural 20 riders (Overwhelming Strike)', () => {
        const n20Action = (extra) => ({
            name: 'Overwhelming Strike', type: 'damage_bonus', trigger: 'natural_20_attack_roll', ...extra,
        });

        it.each([
            {
                label: 'dice expression rolls and appends with the feature-name label',
                action: n20Action({ extraDamageExpression: '2d10', extraDamageType: 'force' }),
                formula: '1d8+3 [slashing] + 2d10 [Overwhelming Strike]', total: 31, rolls: [8, 10, 10],
            },
            {
                label: 'increased_ability_score resolves to the flat STR bonus, no roll',
                action: n20Action({ extraDamageExpression: 'increased_ability_score', extraDamageType: 'force', abilityIncreased: 'Strength' }),
                formula: '1d8+3 [slashing] + 3 [Overwhelming Strike]', total: 14, rolls: [8],
            },
        ])('$label on a natural 20', async ({ action, formula, total, rolls }) => {
            const { hook, rollDamage } = UseAttackDamageResolution(statsWith([action]));

            await hook.resolveAttackDamage(baseAttack, { ...baseCtx, isNatural20: true });
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula, total, rolls }));
        });
    });

    describe('celestial transformation rider (celestialRevelation)', () => {
        const heavenlyWings = {
            name: 'Heavenly Wings', type: 'attack_rider', trigger: 'hit',
            damageExpression: '1d6', damageType: 'radiant', oncePerTurn: true,
        };

        it.each([
            {
                label: 'buff active: rider lands and stamps its own round latch',
                buffs: [{ name: 'Heavenly Wings' }],
                formula: '1d8+3 [slashing] + 1d6 [radiant]', total: 17, stamped: true,
            },
            {
                label: 'buff inactive: formula stays pure base weapon damage',
                buffs: [],
                formula: '1d8+3 [slashing]', total: 11, stamped: false,
            },
        ])('$label', async ({ buffs, formula, total, stamped }) => {
            getActiveBuffs.mockReturnValue(buffs);
            const { hook, rollDamage } = UseAttackDamageResolution(statsWith([], [heavenlyWings]));

            await hook.resolveAttackDamage(baseAttack, baseCtx);
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula, total }));
            expect(latchWrites('_Heavenly_Wings_usedRound')).toEqual(
                stamped ? [[PLAYER, '_Heavenly_Wings_usedRound', 1, CAMPAIGN]] : []
            );
        });
    });

    describe("Colossus Slayer (Hunter's Prey feature module)", () => {
        it.each([
            {
                label: 'target below max HP: adds 1d8 and stamps the used-round side effect',
                prey: 'Colossus Slayer', target: { name: 'Goblin', currentHp: 5, maxHp: 15 },
                formula: '1d8+3 [slashing] + 1d8 [extra]', total: 19, stamped: true,
            },
            {
                label: 'target at full HP: base damage only, latch untouched',
                prey: 'Colossus Slayer', target: { name: 'Goblin', currentHp: 15, maxHp: 15 },
                formula: '1d8+3 [slashing]', total: 11, stamped: false,
            },
        ])('$label', async ({ prey, target, formula, total, stamped }) => {
            getRuntimeValue.mockImplementation((_name, key) =>
                key === "_Hunter's_Prey_choice" ? prey : null);
            getCombatContext.mockReturnValue(Promise.resolve({ creatures: [] }));
            getTargetFromAttacker.mockReturnValue(target);
            const { hook, rollDamage } = UseAttackDamageResolution(basePlayerStats);

            await hook.resolveAttackDamage(baseAttack, baseCtx);
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            expect(rollDamage).toHaveBeenCalledWith(expect.objectContaining({ formula, total, rolls: stamped ? [8, 8] : [8] }));
            expect(latchWrites('_Hunters_Prey_Colossus_UsedRound')).toEqual(
                stamped ? [[PLAYER, '_Hunters_Prey_Colossus_UsedRound', 1, CAMPAIGN]] : []
            );
        });
    });

    describe('proceedWithDamage logging contract', () => {
        // Regression pin for the removal of leftover unconditional per-pass
        // [sw-debug] console.log litter in the hook-path proceedWithDamage
        // (entry line + buildCtxSync .then line). Called DIRECTLY so the pin
        // covers this seam only — sacredWeapon.js pipeline-step litter is a
        // separate file, reported elsewhere, not owned here.
        it('drives the rollDamage seam emitting zero [sw-debug] console bytes', async () => {
            const logSpy = vi.spyOn(console, 'log');
            const { hook, rollDamage } = UseAttackDamageResolution(basePlayerStats);

            hook.proceedWithDamage({
                attack: baseAttack, formula: '1d8+3', total: 11, rolls: [8],
                modifier: 3, critLabels: {}, pipelineCtx: {},
            });
            await flush();

            expect(rollDamage).toHaveBeenCalledTimes(1);
            const litter = logSpy.mock.calls.filter(call =>
                call.some(arg => String(arg).includes('[sw-debug]')));
            expect(litter).toEqual([]);
        });
    });
});
