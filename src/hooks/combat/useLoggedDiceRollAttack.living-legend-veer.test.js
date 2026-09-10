// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

    function createFn() {
        return createLogAndShow(deps);
    }

    // ---------------------------------------------------------------------------
    // Living Legend / Unerring Strike
    // ---------------------------------------------------------------------------

    describe('living legend / unerring strike', () => {
        function mockLivingLegend(livingActive, unerringUsed) {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'livingLegendActive') return livingActive;
                if (name === 'TestFighter' && prop === 'unerringStrikeUsed') return unerringUsed;
                return null;
            });
        }

        it('converts miss to hit when livingLegendActive and unerringStrikeUsed is false', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            mockLivingLegend(true, false);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
                unerringStrikeApplied: true,
            }));
        });

        it('logs Unerring Strike ability use to campaign log when converting miss to hit', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            mockLivingLegend(true, false);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Living Legend',
                description: expect.stringContaining('Unerring Strike'),
                timestamp: expect.any(Number),
            }));
        });

        it('does not convert when livingLegendActive is false', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            getRuntimeValue.mockReturnValue(null);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                unerringStrikeApplied: false,
            }));
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
        });

        it('does not convert when unerringStrikeUsed was already consumed', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            mockLivingLegend(true, true);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                unerringStrikeApplied: false,
            }));
        });

        it('does not convert when isWeaponAttack is false', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            mockLivingLegend(true, false);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: false });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
                unerringStrikeApplied: false,
            }));
        });

        it('does not convert when the roll already hits', async () => {
            rollD20.mockReturnValueOnce(20);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 15 });
            mockLivingLegend(true, false);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });

            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
                unerringStrikeApplied: false,
            }));
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
        });

        it('does convert on an auto miss since natural 1 is not isAutoMiss', async () => {
            rollD20.mockReturnValueOnce(1);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            mockLivingLegend(true, false);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
                unerringStrikeApplied: true,
            }));
        });
    });

    // ---------------------------------------------------------------------------
    // Veer (mounted creature redirect)
    // ---------------------------------------------------------------------------

    describe('veer (mounted creature redirect)', () => {
        function mockVeerSetup(mountName, riderName, mountConditions = []) {
            getTargetFromAttacker.mockReturnValue({ name: mountName, ac: 12 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === mountName && prop === 'mountedBy') return riderName;
                if (name === riderName && prop === 'veerActive') return true;
                if (name === riderName && prop === 'activeConditions') return [];
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: mountName, type: 'npc', ac: 12, conditions: mountConditions }],
            });
        }

        function fakeTimersSync() {
            const orig = globalThis.setTimeout;
            globalThis.setTimeout = (cb) => { cb(); return 0; };
            return () => { globalThis.setTimeout = orig; };
        }

        it('redirects attack to rider when veer is active and rider confirms', async () => {
            const restoreTimer = fakeTimersSync();
            mockVeerSetup('Mount', 'Rider');

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mount' });

            restoreTimer();

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                characterName: 'Rider',
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ hit: true }));
        });

        it('keeps attack on original target when rider declines veer', async () => {
            vi.useFakeTimers();
            const origAddEventListener = window.addEventListener.bind(window);
            let veerHandler = null;
            window.addEventListener = (event, cb) => {
                if (event === 'veer-confirm') {
                    veerHandler = cb;
                } else {
                    origAddEventListener(event, cb);
                }
            };

            mockVeerSetup('Mount', 'Rider');

            const fn = createFn();
            const promise = fn('Longsword', 5, 'attack', { targetName: 'Mount' });

            // Advance microtasks so the async code sets up the event listener
            await vi.advanceTimersByTimeAsync(0);

            // Dispatch the decline event before the 15s timeout fires
            if (veerHandler) {
                veerHandler(new CustomEvent('veer-confirm', {
                    detail: { promptId: 'veer-Mount', confirm: false },
                }));
            }

            // Advance past the timeout so the promise fully resolves
            await vi.advanceTimersByTimeAsync(1);

            await promise;
            vi.useRealTimers();
            window.addEventListener = origAddEventListener;

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                description: expect.stringContaining('declined to use Veer'),
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ hit: false, isAutoMiss: true }));
        });

        it('does not trigger veer when mount is incapacitated', async () => {
            mockVeerSetup('Mount', 'Rider', [{ key: 'incapacitated' }]);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mount' });

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
            expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
            }));
        });

        it('does not trigger veer when rider is incapacitated', async () => {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'Mount' && prop === 'mountedBy') return 'Rider';
                if (name === 'Rider' && prop === 'veerActive') return true;
                if (name === 'Rider' && prop === 'activeConditions') return [{ key: 'incapacitated' }];
                return null;
            });

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mount' });

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
            expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
            }));
        });

        it('does not trigger veer when there is no rider on the mount', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Mount', ac: 12 });
            getRuntimeValue.mockReturnValue(null);

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mount' });

            expect(setRuntimeValue).not.toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
        });

        it('logs veer ability use when redirecting attack to rider', async () => {
            const restoreTimer = fakeTimersSync();
            mockVeerSetup('Mount', 'Rider');

            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mount' });

            restoreTimer();

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'ability_use',
                characterName: 'Rider',
                abilityName: 'Veer',
                description: expect.stringContaining('redirects the attack'),
            }));
        });
    });
});
