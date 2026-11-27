// @maintained-by-ai 2026-11-26
// Attack-lane seam (createLogAndShow): Potent Cantrip (2024 classes.json Evoker lv3:
// "miss with attack roll or target succeeds on saving throw → half the cantrip's damage")
// and Soulknife lv9 Homing Strikes gate wiring. Owns what reaches logEntry /
// setPopupHtml / lastAttackRoll through the full lane, including the half-damage
// APPLICATION through applyDamageToTarget. Unit seams covered elsewhere:
// attackPostProcessing-cla120-potent-cantrip.test.js (formula folding, idempotency,
// school gate) and hitResolution.soul-blades.test.js (conversion, die size, energy
// spend, still-miss, natural 1). Handler-lane gap (run2#1778): the SEPARATE auto-miss
// handler handleAutoMiss.js#handlePotentCantripHalfDamage has no handler-level test —
// its decision is pinned here only at this hook seam.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, rollD20: vi.fn(), rollExpression: vi.fn() }
});

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, newHp: 5 })),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: () => 1,
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    collectWeaponMastery: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { isResilientSphereActive } from '../../services/combat/automation/automationPassives.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import {
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';

describe('createLogAndShow — Potent Cantrip & Soulknife lane', () => {
    const FROZEN_NOW = 1700000000000;
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
        rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
        isResilientSphereActive.mockReturnValue(false);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        hasIgnoreResistance.mockReturnValue(false);
        rollD20.mockReturnValue(15);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    function findCantripMissHalfDamageLogs() {
        return deps.logEntry.mock.calls.filter(
            (call) => call[0].rollType === 'cantrip-miss-half-damage'
        );
    }

    function findSaveDamagePopups() {
        return deps.setPopupHtml.mock.calls.filter(
            (call) => call[0].type === 'save-damage'
        );
    }

    function findKeyWrites(key) {
        return setRuntimeValue.mock.calls.filter((call) => call[1] === key);
    }

    function findHomingLastAttackRollCalls() {
        return findKeyWrites('lastAttackRoll').filter((call) => call[2]?.homingStrikesBonus);
    }

    describe('potent cantrip miss-half-damage', () => {
        const withPotent = { automation: { passives: [{ type: 'potent_cantrip' }] } };
        const baseOpts = {
            targetName: 'Goblin',
            autoDamageFormula: '1d10',
            damageType: 'fire',
            saveDc: 13,
            saveType: 'DEX',
            playerStats: withPotent,
        };
        // Full-shape log row every positive arm produces through the lane
        // (fresh roll of '1d10' → 10 → half 5; stored total 10 → half 5).
        const cantripLogRow = (formula) => ({
            type: 'roll',
            characterName: 'TestWizard',
            rollType: 'cantrip-miss-half-damage',
            name: 'Fire Bolt',
            formula,
            rolls: [5, 5],
            total: 5,
            modifier: 0,
            damageType: 'fire',
            targetName: 'Goblin',
            isPotentCantrip: true,
        });
        const cantripPopup = (formula) => ({
            type: 'save-damage',
            name: 'Fire Bolt',
            formula,
            rolls: [5, 5],
            total: 5,
            bonus: 0,
            modifier: 0,
            damageType: 'fire',
            targetName: 'Goblin',
            targetCurrentHp: 5,
            targetMaxHp: 0,
            saveDc: 13,
            saveType: 'DEX',
            dcSuccess: 'half',
            finalDamage: 5,
            damageApplied: true,
            isPotentCantrip: true,
        });

        it.each([
            ['the player lacks the passive', false, 15, { ...baseOpts, playerStats: { automation: { passives: [] } } }],
            ['there is no damage formula', true, 15, { ...baseOpts, autoDamageFormula: undefined }],
            ['the attack hits', true, 10, baseOpts],
            ['auto miss carries no saveDc', true, 15, { ...baseOpts, isAutoMiss: true, saveDc: undefined }],
        ])('does not apply potent cantrip when %s', async (_label, hasPotent, ac, opts) => {
            hasPotentCantrip.mockReturnValue(hasPotent);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac });
            await createFn()('Fire Bolt', 3, 'attack', opts);
            expect(findCantripMissHalfDamageLogs()).toHaveLength(0);
            expect(findSaveDamagePopups()).toHaveLength(0);
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it.each([
            ['a stored damage result', { autoDamageRollResult: { total: 10, rolls: [5, 5], modifier: 0 } }, false],
            ['no stored result', {}, true],
        ])('miss-half-damage rolls once from %s, applies half, logs + pops the full row', async (_label, extraOpts, expectFreshRoll) => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            await createFn()('Fire Bolt', 3, 'attack', { ...baseOpts, ...extraOpts });

            // Discriminator: the stored-result leg must NOT re-roll (CLA-120
            // phantom roll); the fresh leg rolls '1d10' exactly once.
            if (expectFreshRoll) {
                expect(rollExpression).toHaveBeenCalledTimes(1);
                expect(rollExpression).toHaveBeenCalledWith('1d10');
            } else {
                expect(rollExpression).not.toHaveBeenCalled();
            }

            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toEqual(cantripLogRow('1d10'));

            // The half total reaches the damage pipeline exactly once.
            expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                { creatures: [{ name: 'Goblin', type: 'npc', ac: 15 }] },
                'Goblin',
                5,
                ['fire'],
                { campaignName: 'test-campaign', characters: deps.characters, ignoreResistance: false, attackerName: 'TestWizard' }
            );

            const popups = findSaveDamagePopups();
            expect(popups).toHaveLength(1);
            expect(popups[0][0]).toEqual(cantripPopup('1d10'));
        });

        // REC #931 folded (fix#364): the school-gate and zero-INT non-fold legs
        // belong to attackPostProcessing-cla120-potent-cantrip.test.js t3. This
        // lane keeps only the auto-miss+saveDc dispatch branch, unfolded
        // (also pinned byte-exact by the fresh-roll arm above) and with the
        // Evocation/EE lane-threading folded once.
        it.each([
            ['without Empowered Evocation', '1d10', undefined],
            ['with Empowered Evocation on an Evocation cantrip', '1d10 + 2 [Empowered Evocation]', 2],
        ])('applies half damage on auto miss with saveDc, formula %s', async (_label, expectedFormula, intMod) => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            if (intMod !== undefined) {
                getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
                getEmpoweredEvocationIntModifier.mockReturnValue(intMod);
            }
            await createFn()('Fire Bolt', 3, 'attack', {
                ...baseOpts,
                autoDamageSchool: 'Evocation',
                isAutoMiss: true,
            });
            expect(rollExpression).toHaveBeenCalledTimes(1);
            expect(rollExpression).toHaveBeenCalledWith(expectedFormula);
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toEqual(cantripLogRow(expectedFormula));
            const popups = findSaveDamagePopups();
            expect(popups).toHaveLength(1);
            expect(popups[0][0]).toEqual(cantripPopup(expectedFormula));
        });
    });

    describe('soulknife psychic blades homing strikes', () => {
        function makePs(classInfo, level) {
            return { class: classInfo, level };
        }

        // Conversion, die size, energy spend, still-miss and natural-1 behaviour are
        // owned by hitResolution.soul-blades.test.js — the lane owns the gate wiring
        // and the lastAttackRoll evidence stamp here.
        it('stamps lastAttackRoll with the homing bonus when a convertible miss converts', async () => {
            const ps = { ...makePs({ name: 'Rogue', major: { name: 'Soulknife' } }, 9), _trackedResources: { psionicEnergy: { max: 6 } } };
            getRuntimeValue.mockImplementation((name, key) => (key === 'psionicEnergy' ? 6 : null));
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            const spyRandom = vi.spyOn(Math, 'random').mockReturnValue(0.999); // lv9 psionic die d8 → 8; 15 + 3 + 8 ≥ 20
            await createFn()('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
            });
            const homingCalls = findHomingLastAttackRollCalls();
            expect(homingCalls).toHaveLength(1);
            // Full evidence row: the psionic die folds into the stamped bonus.
            expect(homingCalls[0][2]).toEqual({
                attackName: 'Psychic Blade',
                attackerName: 'TestWizard',
                d20: 15,
                bonus: 11,
                targetName: 'Goblin',
                targetAc: 20,
                hit: true,
                isCrit: false,
                effectiveAc: 20,
                coverAcBonus: 0,
                homingStrikesBonus: 8,
                timestamp: FROZEN_NOW,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'psionicEnergy', 5, 'test-campaign');
            spyRandom.mockRestore();
        });

        const soulknife = { name: 'Rogue', major: { name: 'Soulknife' } };
        it.each([
            ['auto miss', makePs(soulknife, 9), { isAutoMiss: true }],
            ['below level 9', makePs(soulknife, 5), {}],
            ['a non-soulknife class', makePs({ name: 'Fighter', major: { name: 'Champion' } }, 9), {}],
            ['a non-psychic-blade attack', makePs(soulknife, 9), { isPsychicBlade: false }],
        ])('does not apply homing strikes on %s', async (_label, ps, extraOpts) => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 21 });
            await createFn()('Psychic Blade', 3, 'attack', {
                targetName: 'Goblin',
                isPsychicBlade: true,
                playerStats: ps,
                ...extraOpts,
            });
            expect(findHomingLastAttackRollCalls()).toHaveLength(0);
            expect(findKeyWrites('psionicEnergy')).toHaveLength(0);
        });
    });
});
