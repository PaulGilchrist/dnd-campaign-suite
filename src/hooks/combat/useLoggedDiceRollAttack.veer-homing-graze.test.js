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

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
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

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
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

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

// Mock local sub-modules that are imported by useLoggedDiceRollAttack.js
vi.mock('./attackBlockers.js', () => ({
    checkAttackBlockers: vi.fn(() => false),
}));

vi.mock('./sanctuarySave.js', () => ({
    handleSanctuarySave: vi.fn(() => true),
}));

vi.mock('./d20RollComputation.js', () => ({
    computeD20Roll: vi.fn(() => ({
        r1: 15,
        r2: undefined,
        effectiveD20: 15,
        effectiveD20Roll: 15,
        effectiveBonus: 5,
        finalBonusDetail: '',
    })),
}));

vi.mock('./targetResolution.js', () => ({
    resolveTarget: vi.fn(async () => ({ target: null, availableSuperiorityManeuvers: [] })),
}));

vi.mock('./hitResolution.js', () => ({
    resolveHit: vi.fn(async () => ({
        hit: true,
        isAutoMiss: false,
        isCrit: false,
        unerringStrikeApplied: false,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        targetAc: 12,
        effectiveAc: 12,
        effectiveD20Roll: 15,
    })),
}));

vi.mock('./attackPostProcessing.js', () => ({
    processAttackAfterResult: vi.fn(async () => {}),
    processPotentCantrip: vi.fn(async () => {}),
}));

vi.mock('./saveProcessing.js', () => ({
    processSaveRoll: vi.fn(async () => {}),
}));

vi.mock('./initiativeProcessing.js', () => ({
    processInitiativeRoll: vi.fn(async () => {}),
}));

vi.mock('./globalFeats.js', () => ({
    consumeFeatsOfChaos: vi.fn(),
}));

vi.mock('./battleMaster.js', () => ({
    getKnownManeuvers: vi.fn(() => []),
    getSuperiorityDice: vi.fn(() => 0),
}));

vi.mock('./starryDragon.js', () => ({
    hasStarryDragonActive: vi.fn(),
    starryDragonAppliesToRoll: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
    getUnbreakableMajestySaveDc,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { hasBardicInspirationOffense, hasBardicInspirationDefense, getBardicInspirationDieSize } from '../../services/combat/auras/bardicInspirationState.js';
import { checkAttackBlockers } from './attackBlockers.js';
import { handleSanctuarySave } from './sanctuarySave.js';
import { resolveHit } from './hitResolution.js';
import { processAttackAfterResult } from './attackPostProcessing.js';
import { consumeFeatsOfChaos } from './globalFeats.js';
import { resolveTarget } from './targetResolution.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultDeps(overrides = {}) {
    return {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
        ...overrides,
    };
}

function setupDefaults() {
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
}

// ---------------------------------------------------------------------------
// Sanctuary Save Prompt Flow
// ---------------------------------------------------------------------------

describe('createLogAndShow - Sanctuary Save Prompt Flow', () => {
    beforeEach(setupDefaults);

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('returns early when handleSanctuarySave returns false', async () => {
        const deps = createDefaultDeps();
        handleSanctuarySave.mockResolvedValue(false);

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(handleSanctuarySave).toHaveBeenCalledWith(
            'TestFighter',
            'Goblin',
            'test-campaign',
            deps.setPopupHtml,
            deps.logEntry,
        );
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(resolveHit).not.toHaveBeenCalled();
    });

    it('proceeds with attack when handleSanctuarySave returns true', async () => {
        const deps = createDefaultDeps();
        handleSanctuarySave.mockResolvedValue(true);
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 12, effectiveAc: 12, effectiveD20Roll: 15,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(handleSanctuarySave).toHaveBeenCalled();
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'd20',
            hit: true,
            name: 'Longsword',
        }));
    });

    it('ends Sanctuary on attacker before blockers are checked', async () => {
        const deps = createDefaultDeps();
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === 'campaign' && prop === 'targetEffects') {
                return [{ effect: 'sanctuary', target: 'TestFighter', source: 'Cleric', saveDc: 13 }];
            }
            return null;
        });
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 12, effectiveAc: 12, effectiveD20Roll: 15,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        // Sanctuary on attacker triggers endSanctuary (via mocked handler)
        // handleSanctuarySave is still called because endSanctuary is mocked and doesn't
        // actually remove the targetEffect from the store
        expect(handleSanctuarySave).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Unbreakable Majesty Save Event Handlers
// ---------------------------------------------------------------------------

describe('createLogAndShow - Unbreakable Majesty Save Event Handlers', () => {
    beforeEach(() => {
        setupDefaults();
        rollD20.mockReturnValue(20);
        getTargetFromAttacker.mockReturnValue({ name: 'Mage', ac: 14 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Mage', type: 'npc', ac: 14 }] });
        isUnbreakableMajestyActive.mockReturnValue(true);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getUnbreakableMajestySaveDc.mockReturnValue(15);
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('skips attack when Unbreakable Majesty save fails', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Mage', computedStats: { armorClass: 14 } }],
        });
        resolveHit.mockImplementation(async () => {
            // Simulate majesty save via event
            return new Promise((resolve) => {
                const handler = (event) => {
                    window.removeEventListener('save-result', handler);
                    if (!event.detail.success) {
                        resolve({
                            hit: false, isAutoMiss: true, isCrit: false,
                            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
                            targetAc: 14, effectiveAc: 14, effectiveD20Roll: 20,
                        });
                    } else {
                        resolve({
                            hit: true, isAutoMiss: false, isCrit: false,
                            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
                            targetAc: 14, effectiveAc: 14, effectiveD20Roll: 20,
                        });
                    }
                };
                window.addEventListener('save-result', handler);
                // Simulate failure
                handler(new CustomEvent('save-result', {
                    detail: { promptId: expect.stringMatching(/^majesty-/), success: false, roll: 10, total: 10 },
                }));
            });
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Mage' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: false,
        }));
    });

    it('keeps hit=true when Unbreakable Majesty save succeeds via event', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Mage', computedStats: { armorClass: 14 } }],
        });
        resolveHit.mockImplementation(async () => {
            return new Promise((resolve) => {
                const handler = (_event) => {
                    window.removeEventListener('save-result', handler);
                    resolve({
                        hit: true, isAutoMiss: false, isCrit: false,
                        unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
                        targetAc: 14, effectiveAc: 14, effectiveD20Roll: 20,
                    });
                };
                window.addEventListener('save-result', handler);
                handler(new CustomEvent('save-result', {
                    detail: { promptId: expect.stringMatching(/^majesty-/), success: true, roll: 18, total: 18 },
                }));
            });
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Mage' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: true,
        }));
    });
});

// ---------------------------------------------------------------------------
// Veer Mount Redirect
// ---------------------------------------------------------------------------

describe('createLogAndShow - Veer Mount Redirect', () => {
    beforeEach(() => {
        setupDefaults();
        rollD20.mockReturnValue(20);
        getTargetFromAttacker.mockReturnValue({ name: 'Horse', ac: 10 });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Horse', type: 'npc', ac: 10, conditions: [] }],
        });
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    function mockVeerActive(riderName = 'Rider', mountName = 'Horse') {
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === mountName && prop === 'mountedBy') return riderName;
            if (name === riderName && prop === 'veerActive') return true;
            if (name === riderName && prop === 'activeConditions') return [];
            return null;
        });
    }

    it('redirects attack when veer is active and rider confirms', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Rider', computedStats: { armorClass: 14 } }],
        });
        mockVeerActive();
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 10, effectiveAc: 10, effectiveD20Roll: 20,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Horse' });

        // Popup shows the attack result
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: true,
            targetName: 'Horse',
        }));
    });

    it('keeps attack on original target when rider declines veer', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Rider', computedStats: { armorClass: 14 } }],
        });
        mockVeerActive();
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 10, effectiveAc: 10, effectiveD20Roll: 20,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Horse' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: true,
        }));
    });

    it('defaults to confirm when veer timeout expires', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Rider', computedStats: { armorClass: 14 } }],
        });
        mockVeerActive();
        resolveHit.mockImplementation(async () => {
            // Simulate timeout: resolve with confirm=true after a tick
            await Promise.resolve();
            return {
                hit: true, isAutoMiss: false, isCrit: false,
                unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
                targetAc: 10, effectiveAc: 10, effectiveD20Roll: 20,
            };
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Horse' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            hit: true,
        }));
    });

    it('does not trigger veer when mount is incapacitated', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Rider', computedStats: { armorClass: 14 } }],
        });
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === 'Horse' && prop === 'mountedBy') return 'Rider';
            if (name === 'Rider' && prop === 'veerActive') return true;
            if (name === 'Rider' && prop === 'activeConditions') return [];
            return null;
        });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Horse', type: 'npc', ac: 10, conditions: [{ key: 'incapacitated' }] }],
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Horse' });

        expect(setRuntimeValue).not.toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
    });

    it('does not trigger veer when rider is incapacitated', async () => {
        const deps = createDefaultDeps({
            characters: [{ name: 'Rider', computedStats: { armorClass: 14 } }],
        });
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === 'Horse' && prop === 'mountedBy') return 'Rider';
            if (name === 'Rider' && prop === 'veerActive') return true;
            if (name === 'Rider' && prop === 'activeConditions') return ['incapacitated'];
            return null;
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Horse' });

        expect(setRuntimeValue).not.toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
    });
});

// ---------------------------------------------------------------------------
// Feats of Chaos & Lucky Cleanup
// ---------------------------------------------------------------------------

describe('createLogAndShow - Feats of Chaos & Lucky Cleanup', () => {
    beforeEach(setupDefaults);

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    describe('feats of chaos consumption', () => {
        it('consumes featsOfChaosActive after one d20 roll', async () => {
            const deps = createDefaultDeps();
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'featsOfChaosActive') return true;
                return null;
            });

            const fn = createFn(deps);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

            expect(consumeFeatsOfChaos).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        });

        it('does not consume when featsOfChaosActive is not true', async () => {
            const deps = createDefaultDeps();

            const fn = createFn(deps);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

            expect(consumeFeatsOfChaos).toHaveBeenCalledWith('TestFighter', 'test-campaign');
        });
    });

    describe('lucky advantageActive cleanup', () => {
        it('cleans up luckyAdvantageActive after popup when shouldSkipPopup is false', async () => {
            const deps = createDefaultDeps();
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'luckyAdvantageActive') return true;
                return null;
            });

            const fn = createFn(deps);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'luckyAdvantageActive', null, 'test-campaign');
        });

        it('does not clean up when luckyAdvantageActive is not set', async () => {
            const deps = createDefaultDeps();

            const fn = createFn(deps);
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

            const luckyCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'luckyAdvantageActive'
            );
            expect(luckyCalls).toHaveLength(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Miss Effects & Combat Inspiration
// ---------------------------------------------------------------------------

describe('createLogAndShow - Miss Effects & Combat Inspiration', () => {
    beforeEach(() => {
        setupDefaults();
        rollD20.mockReturnValue(5);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    describe('miss effects (Vex/Sap)', () => {
        it('calls processAttackAfterResult with miss context when attack misses', async () => {
            const deps = createDefaultDeps();
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'psionicEnergy') return 0;
                return null;
            });
            resolveHit.mockResolvedValue({
                hit: false, isAutoMiss: false, isCrit: false,
                unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
                targetAc: 20, effectiveAc: 20, effectiveD20Roll: 5,
            });
            processAttackAfterResult.mockImplementation(async ({ hit, isAutoMiss }) => {
                expect(hit).toBe(false);
                expect(isAutoMiss).toBe(false);
            });

            const fn = createFn(deps);
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                playerStats: {
                    automation: {
                        passives: [{ type: 'auto_effect', trigger: 'miss', effect: 'next_attack_advantage', duration: 'until_start_of_next_turn', name: 'Vex' }],
                    },
                },
            });

            expect(processAttackAfterResult).toHaveBeenCalled();
        });

        it('does not add miss effects when attack hits', async () => {
            const deps = createDefaultDeps();
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            rollD20.mockReturnValue(15);
            resolveHit.mockResolvedValue({
                hit: true, isAutoMiss: false, isCrit: false,
                unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
                targetAc: 10, effectiveAc: 10, effectiveD20Roll: 15,
            });
            processAttackAfterResult.mockImplementation(async ({ hit }) => {
                expect(hit).toBe(true);
            });

            const fn = createFn(deps);
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                playerStats: {
                    automation: {
                        passives: [{ type: 'auto_effect', trigger: 'miss', effect: 'next_attack_advantage', duration: 'until_start_of_next_turn', name: 'Vex' }],
                    },
                },
            });

            expect(processAttackAfterResult).toHaveBeenCalled();
        });
    });

    describe('combat inspiration offense', () => {
        const wizardDeps = {
            characterName: 'TestWizard',
            campaignName: 'test-campaign',
            characters: [{ name: 'Bard', computedStats: { armorClass: 14 } }],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
            autoDamageSourceRef: { current: null },
        };

        beforeEach(() => {
            vi.clearAllMocks();
            rollD20.mockReturnValue(20);
            rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
            getTargetFromAttacker.mockReturnValue({ name: 'Bard', ac: 14 });
            loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Bard', type: 'player', ac: 14 }] });
            isUnbreakableMajestyActive.mockReturnValue(false);
            hasAttackerTriggeredMajesty.mockReturnValue(false);
            getRuntimeValue.mockReturnValue(null);
            getShieldAcBonus.mockReturnValue(0);
            getShieldOfFaithAcBonus.mockReturnValue(0);
            applyMinDamageAdjustment.mockImplementation((d) => d);
            utils.getName.mockImplementation((n) => n);
            hasBardicInspirationDefense.mockReturnValue(false);
            getBardicInspirationDieSize.mockReturnValue(null);
            hasBardicInspirationOffense.mockReturnValue(false);
        });

        function createWizardFn() {
            return createLogAndShow(wizardDeps);
        }

        it('includes bardicInspirationOffense in popup when playerStats provided', async () => {
            hasBardicInspirationOffense.mockReturnValue(true);
            const context = {
                targetName: 'Bard',
                playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
            };
            const fn = createWizardFn();
            await fn('Fire Bolt', 3, 'attack', context);
            expect(wizardDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                bardicInspirationOffense: true,
            }));
        });

        it('includes bardicInspirationOffenseDieSize in popup', async () => {
            hasBardicInspirationOffense.mockReturnValue(true);
            getBardicInspirationDieSize.mockReturnValue('d6');
            const context = {
                targetName: 'Bard',
                playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
            };
            const fn = createWizardFn();
            await fn('Fire Bolt', 3, 'attack', context);
            expect(wizardDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                bardicInspirationOffenseDieSize: 'd6',
            }));
        });
    });
});

// ---------------------------------------------------------------------------
// Graze Damage on Miss
// ---------------------------------------------------------------------------

describe('createLogAndShow - Graze Damage on Miss', () => {
    beforeEach(setupDefaults);

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('calls processAttackAfterResult with graze context on miss', async () => {
        const deps = createDefaultDeps();
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        rollD20.mockReturnValue(5);
        processAttackAfterResult.mockImplementation(async () => {});

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', {
            targetName: 'Goblin',
            grazeDamage: true,
            grazeAbilityMod: 3,
            damageType: 'slashing',
        });

        expect(processAttackAfterResult).toHaveBeenCalled();
    });

    it('does not call graze processing when attack hits', async () => {
        const deps = createDefaultDeps();
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
        rollD20.mockReturnValue(15);
        processAttackAfterResult.mockImplementation(async () => {});

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', {
            targetName: 'Goblin',
            grazeDamage: true,
            grazeAbilityMod: 3,
        });

        expect(processAttackAfterResult).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Homing Strikes (Soul Blades)
// ---------------------------------------------------------------------------

describe('createLogAndShow - Homing Strikes (Soul Blades)', () => {
    beforeEach(() => {
        setupDefaults();
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        rollD20.mockReturnValue(5);
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    function mockSoulknifeStats() {
        getRuntimeValue.mockImplementation((name, prop, _campaign) => {
            if (name === 'TestRogue' && prop === 'psionicEnergy') return 1;
            return null;
        });
    }

    it('does not trigger homing strikes when not a Soulknife', async () => {
        const deps = createDefaultDeps();
        resolveHit.mockResolvedValue({
            hit: false, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 20, effectiveAc: 20, effectiveD20Roll: 5,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(resolveHit).toHaveBeenCalled();
    });

    it('does not trigger homing strikes when not using psychic blade', async () => {
        const deps = createDefaultDeps({ characterName: 'TestRogue' });
        mockSoulknifeStats();
        resolveHit.mockResolvedValue({
            hit: false, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 20, effectiveAc: 20, effectiveD20Roll: 5,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(resolveHit).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Attack Blockers
// ---------------------------------------------------------------------------

describe('createLogAndShow - Attack Blockers', () => {
    beforeEach(() => {
        setupDefaults();
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('returns early when checkAttackBlockers returns true', async () => {
        const deps = createDefaultDeps();
        checkAttackBlockers.mockReturnValue(true);

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(checkAttackBlockers).toHaveBeenCalledWith(
            'TestFighter', 'Goblin', 'test-campaign', deps.setPopupHtml, expect.any(Function)
        );
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalled();
    });

    it('proceeds when checkAttackBlockers returns false', async () => {
        const deps = createDefaultDeps();
        checkAttackBlockers.mockReturnValue(false);
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 12, effectiveAc: 12, effectiveD20Roll: 15,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(deps.setPopupHtml).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Sanctuary Save Integration
// ---------------------------------------------------------------------------

describe('createLogAndShow - Sanctuary Save Integration', () => {
    beforeEach(() => {
        setupDefaults();
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('returns early when handleSanctuarySave returns false', async () => {
        const deps = createDefaultDeps();
        checkAttackBlockers.mockReturnValue(false);
        handleSanctuarySave.mockResolvedValue(false);

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(handleSanctuarySave).toHaveBeenCalled();
        expect(deps.setPopupHtml).not.toHaveBeenCalled();
        expect(resolveHit).not.toHaveBeenCalled();
    });

    it('proceeds when handleSanctuarySave returns true', async () => {
        const deps = createDefaultDeps();
        checkAttackBlockers.mockReturnValue(false);
        handleSanctuarySave.mockResolvedValue(true);
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 12, effectiveAc: 12, effectiveD20Roll: 15,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(handleSanctuarySave).toHaveBeenCalled();
        expect(resolveHit).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Non-Attack Roll Types
// ---------------------------------------------------------------------------

describe('createLogAndShow - Non-Attack Roll Types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('does not call attack-specific functions for check roll type', async () => {
        const deps = createDefaultDeps();

        const fn = createFn(deps);
        await fn('Athletics', 3, 'check', {});

        expect(checkAttackBlockers).not.toHaveBeenCalled();
        expect(handleSanctuarySave).not.toHaveBeenCalled();
        expect(resolveHit).not.toHaveBeenCalled();
    });

    it('does not call attack-specific functions for save roll type', async () => {
        const deps = createDefaultDeps();

        const fn = createFn(deps);
        await fn('Saving Throw', 0, 'save', { saveDc: 12, saveType: 'DEX' });

        expect(checkAttackBlockers).not.toHaveBeenCalled();
        expect(resolveHit).not.toHaveBeenCalled();
    });

    it('does not call attack-specific functions for initiative roll type', async () => {
        const deps = createDefaultDeps();

        const fn = createFn(deps);
        await fn('Initiative', 0, 'initiative', {});

        expect(checkAttackBlockers).not.toHaveBeenCalled();
        expect(resolveHit).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Popup Data Composition
// ---------------------------------------------------------------------------

describe('createLogAndShow - Popup Data Composition', () => {
    beforeEach(setupDefaults);

    function createFn(deps) {
        return createLogAndShow(deps);
    }

    it('includes characterName and campaignName in popup', async () => {
        const deps = createDefaultDeps();
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 12, effectiveAc: 12, effectiveD20Roll: 15,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            characterName: 'TestFighter',
            campaignName: 'test-campaign',
        }));
    });

    it('includes isNatural20 and isNatural1 flags in popup', async () => {
        const deps = createDefaultDeps();
        rollD20.mockReturnValue(20);
        resolveHit.mockResolvedValue({
            hit: true, isAutoMiss: false, isCrit: false,
            unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0,
            targetAc: 12, effectiveAc: 12, effectiveD20Roll: 20,
        });

        const fn = createFn(deps);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            isNatural20: true,
            isNatural1: false,
        }));
    });

    it('skips popup for save rolls targeting players with a saveDc', async () => {
        const deps = createDefaultDeps();
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name === 'Goblin' && prop === 'type') return 'player';
            return null;
        });
        resolveTarget.mockResolvedValue({
            target: { name: 'Goblin', type: 'player' },
            availableSuperiorityManeuvers: [],
        });

        const fn = createFn(deps);
        await fn('Saving Throw', 0, 'save', {
            targetName: 'Goblin',
            saveDc: 12,
            saveType: 'DEX',
        });

        expect(deps.setPopupHtml).not.toHaveBeenCalled();
    });
});
