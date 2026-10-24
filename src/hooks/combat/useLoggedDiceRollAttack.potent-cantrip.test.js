// @maintained-by-ai: 2026-10-14
// Attack-lane seam (createLogAndShow): Potent Cantrip (2024 classes.json Evoker lv3:
// "miss with attack roll or target succeeds on saving throw → half the cantrip's damage")
// and Soulknife lv9 Homing Strikes gate wiring. Owns what reaches logEntry /
// setPopupHtml / lastAttackRoll through the full lane. Unit seams covered elsewhere:
// attackPostProcessing-cla120-potent-cantrip.test.js (formula folding, idempotency,
// school gate) and hitResolution.soul-blades.test.js (conversion, die size, energy
// spend, still-miss, natural 1).
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

    function findHomingLastAttackRollCalls() {
        return setRuntimeValue.mock.calls.filter(
            (call) => call[1] === 'lastAttackRoll' && call[2]?.homingStrikesBonus
        );
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
        });

        it('rolls half damage from the stored damage result and logs + pops cantrip-miss-half-damage', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            await createFn()('Fire Bolt', 3, 'attack', {
                ...baseOpts,
                autoDamageRollResult: { total: 10, rolls: [5, 5], modifier: 0 },
            });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toMatchObject({
                rollType: 'cantrip-miss-half-damage',
                isPotentCantrip: true,
                targetName: 'Goblin',
                damageType: 'fire',
                total: 5,
            });
            const popups = findSaveDamagePopups();
            expect(popups).toHaveLength(1);
            expect(popups[0][0]).toMatchObject({
                type: 'save-damage',
                isPotentCantrip: true,
                targetName: 'Goblin',
                total: 5,
                dcSuccess: 'half',
            });
        });

        it('rolls fresh damage when no stored result is present', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            await createFn()('Fire Bolt', 3, 'attack', baseOpts);
            expect(rollExpression).toHaveBeenCalledWith('1d10');
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toMatchObject({
                rollType: 'cantrip-miss-half-damage',
                isPotentCantrip: true,
                total: 5,
            });
        });

        it('applies half damage on auto miss when saveDc is provided', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            await createFn()('Fire Bolt', 3, 'attack', { ...baseOpts, isAutoMiss: true });
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0]).toMatchObject({ isPotentCantrip: true, total: 5 });
        });

        it('folds Empowered Evocation into the miss half-damage formula for evocation cantrips', async () => {
            hasPotentCantrip.mockReturnValue(true);
            getEmpoweredEvocationFeatures.mockReturnValue([{ type: 'empowered_evocation' }]);
            getEmpoweredEvocationIntModifier.mockReturnValue(2);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 25 });
            await createFn()('Fire Bolt', 3, 'attack', {
                ...baseOpts,
                autoDamageSchool: 'Evocation',
                isAutoMiss: true,
            });
            const folded = '1d10 + 2 [Empowered Evocation]';
            expect(rollExpression).toHaveBeenCalledWith(folded);
            const missLogs = findCantripMissHalfDamageLogs();
            expect(missLogs).toHaveLength(1);
            expect(missLogs[0][0].formula).toBe(folded);
            const popups = findSaveDamagePopups();
            expect(popups).toHaveLength(1);
            expect(popups[0][0].formula).toBe(folded);
        });

        // REC #931 folded (fix#364): the school-gate and zero-INT non-fold legs
        // owned by attackPostProcessing-cla120-potent-cantrip.test.js t3 (same
        // production gate, buildPotentMissFormula). Full-lane unfolded pass-through
        // stays pinned here above (:226 rolls '1d10' byte-exact) — zero coverage loss.
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
            spyRandom.mockRestore();
            const homingCalls = findHomingLastAttackRollCalls();
            expect(homingCalls).toHaveLength(1);
            expect(homingCalls[0][2]).toMatchObject({
                hit: true,
                isCrit: false,
                homingStrikesBonus: 8,
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'psionicEnergy', 5, 'test-campaign');
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
        });
    });
});
