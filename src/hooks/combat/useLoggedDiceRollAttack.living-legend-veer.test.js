// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

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
    applyDamageToTarget: vi.fn(),
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

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
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

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/banishmentHandler.js', () => ({
    isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/imprisonmentHandler.js', () => ({
    isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/prismaticSprayHandler.js', () => ({
    isPrismaticSprayBlocked: vi.fn(() => false),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/damageRollback.js', () => ({
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/compelledDuelHandler.js', () => ({
    checkCompelledDuelAttackExpiry: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { addEntry } from '../../services/ui/logService.js';

// Attack-lane seam: the REAL hitResolution.js runs through createLogAndShow
// (the veer-homing-graze sibling mocks resolveHit — this file owns the live
// Unerring Strike / Veer behaviour inside resolveHit).

describe('createLogAndShow - Living Legend & Veer', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    // ---------------------------------------------------------------------------
    // Living Legend / Unerring Strike (2024: once per turn, missed weapon
    // attack hits; nat 1 is not an auto-miss in 2024, so it converts too)
    // ---------------------------------------------------------------------------

    describe('living legend / unerring strike', () => {
        function mockLivingLegend(livingActive, unerringUsed) {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'livingLegendActive') return livingActive;
                if (name === 'TestFighter' && prop === 'unerringStrikeUsed') return unerringUsed;
                return null;
            });
        }

        async function runWeaponAttack(context = {}) {
            await createLogAndShow(deps)('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                isWeaponAttack: true,
                ...context,
            });
        }

        it.each([
            ['a regular miss', 5],
            ['a natural 1 (2024: nat 1 is not an auto-miss)', 1],
        ])('converts %s to a hit, consumes the use, and logs Living Legend', async (_label, d20) => {
            rollD20.mockReturnValueOnce(d20);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            mockLivingLegend(true, false);

            await runWeaponAttack();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
                unerringStrikeApplied: true,
            }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Living Legend',
                description: expect.stringContaining('Unerring Strike'),
                timestamp: expect.any(Number),
            }));
        });

        function expectNotConverted() {
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                unerringStrikeApplied: false,
            }));
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
        }

        async function runExpectedMiss() {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            await runWeaponAttack();
        }

        it('does not convert when livingLegendActive is false', async () => {
            mockLivingLegend(false, false);
            await runExpectedMiss();
            expectNotConverted();
        });

        it('does not convert when unerringStrikeUsed was already consumed', async () => {
            mockLivingLegend(true, true);
            await runExpectedMiss();
            expectNotConverted();
        });

        it('does not convert when isWeaponAttack is false', async () => {
            mockLivingLegend(true, false);
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            await runWeaponAttack({ isWeaponAttack: false });
            expectNotConverted();
        });

        it('does not convert when the roll already hits', async () => {
            mockLivingLegend(true, false);
            rollD20.mockReturnValueOnce(20);
            await runWeaponAttack();

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
                unerringStrikeApplied: false,
            }));
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
        });
    });

    // ---------------------------------------------------------------------------
    // Veer (2024 Mount feat): rider forces an attack that hit their mount to
    // hit them instead. 2024 feats.json "Veer" + incapacitated guards.
    // ---------------------------------------------------------------------------

    describe('veer (mounted creature redirect)', () => {
        function mockVeerSetup(mountName, riderName, mountConditions = [], riderConditions = []) {
            getTargetFromAttacker.mockReturnValue({ name: mountName, ac: 12 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === mountName && prop === 'mountedBy') return riderName;
                if (name === riderName && prop === 'veerActive') return true;
                if (name === riderName && prop === 'activeConditions') return riderConditions;
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: mountName, type: 'npc', ac: 12, conditions: mountConditions }],
            });
        }

        // no-timers T2: the veer-confirm prompt waits indefinitely — answer it
        // as the rider would (dispatch until the roll resolves).
        async function runAnsweringVeerPrompt(confirm) {
            const fn = createLogAndShow(deps);
            let settled = false;
            const run = fn('Longsword', 5, 'attack', { targetName: 'Mount' }).then((r) => { settled = true; return r; });
            for (let i = 0; i < 40 && !settled; i++) {
                await new Promise((r) => setTimeout(r, 5));
                window.dispatchEvent(new CustomEvent('veer-confirm', {
                    detail: { promptId: 'veer-Mount', confirm },
                }));
            }
            await run;
        }

        function expectVeerNotTriggered() {
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
            expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
            }));
        }

        it('redirects attack to rider when veer is active and rider confirms', async () => {
            mockVeerSetup('Mount', 'Rider');
            await runAnsweringVeerPrompt(true);

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                characterName: 'Rider',
            }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                description: expect.stringContaining('redirects the attack'),
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ hit: true }));
        });

        it('keeps attack on original target when rider declines veer', async () => {
            mockVeerSetup('Mount', 'Rider');
            await runAnsweringVeerPrompt(false);

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                description: expect.stringContaining('declined to use Veer'),
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ hit: false, isAutoMiss: true }));
        });

        it('does not trigger veer when mount is incapacitated', async () => {
            mockVeerSetup('Mount', 'Rider', [{ key: 'incapacitated' }]);

            await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Mount' });

            expectVeerNotTriggered();
        });

        it('does not trigger veer when rider is incapacitated', async () => {
            mockVeerSetup('Mount', 'Rider', [], [{ key: 'incapacitated' }]);

            await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Mount' });

            expectVeerNotTriggered();
        });

        it('does not trigger veer when there is no rider on the mount', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Mount', ac: 12 });
            getRuntimeValue.mockReturnValue(null);

            await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Mount' });

            expectVeerNotTriggered();
        });
    });
});
