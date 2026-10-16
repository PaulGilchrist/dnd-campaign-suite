// @maintained-by-ai
// MAIN lane — weaponMasteryHandler quint closer. Owns: handle() modal routing
// (registered in automation/index.js as the mastery_rider handler), the
// applyMasteryEffect dispatch table (MASTERY_EFFECTS keys + unknown-name null),
// the Cleave lane incl. once-per-turn wiring (checkOncePerTurn/markOncePerTurn
// delegation — internals owned by oncePerTurn.test.js), and the generic
// te-write paths for Topple/Sap/Slow/Vex/Graze (te writes pinned as the exact
// append to the 'targetEffects' store; registry internals owned by
// targetEffectDefinitions.test.js).
// Sibling lanes: description.test.js owns buildMasteryDescription strings (the
// popups here pin delegation to it, never re-pin text); nick.test.js owns
// applyNickMastery; push.test.js owns applyPushMastery.
// applyPostDamageMasteryEffects is orphan (no production importer — verified by
// grep incl. automation/index.js); its coverage was deleted, not resurrected.
// Removed as duplicated/weak vs siblings:
// - Nick members of the shared once-per-turn loop (nick.test.js owns, stronger)
// - popup-text-only 'should apply X effect' tests for Vex/Sap/Slow/Topple/Graze
//   (toContain on description-lane strings) — replaced by exact te-write +
//   envelope pins
// - Graze 'custom abilityName and abilityMod' test (pure dupe of the
//   ability-not-found default-0 test — both pinned Dexterity/0)
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyMasteryEffect, MASTERY_EFFECTS, buildMasteryDescription } from './weaponMasteryHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as oncePerTurn from '../../common/oncePerTurn.js';

// ── Mocks (hoisted — these replace the real modules) ────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Cleave once-per-turn wiring is pinned as delegation here; checkOncePerTurn/
// markOncePerTurn round-format internals belong to oncePerTurn.test.js.
vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn(() => Promise.resolve(null)),
    markOncePerTurn: vi.fn(() => Promise.resolve({})),
}));

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerStats = {
    name: 'TestHero',
    proficiency: 3,
    size: 'Medium',
    abilities: [
        { name: 'Constitution', bonus: 2 },
        { name: 'Strength', bonus: 3 },
    ],
};

// MERGES overrides — top-level and automation keys must not replace wholesale.
function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Weapon Mastery',
        description: 'Apply a weapon mastery effect.',
        ...rest,
        automation: {
            type: 'mastery_rider',
            masteries: ['Vex', 'Topple', 'Sap', 'Slow', 'Cleave', 'Nick', 'Graze'],
            ...automationOverrides,
        },
    };
}

function masteryPopup(name, targetName) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name,
            description: buildMasteryDescription(name, targetName),
            automation: { type: 'mastery_rider', masteries: [name] },
        },
    };
}

// ── Tests ────────────────────────────────────────────────────────

describe('weaponMasteryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(combatData.getCurrentCombatRound).mockReturnValue(1);
        vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([]);
        vi.mocked(oncePerTurn.checkOncePerTurn).mockResolvedValue(null);
    });

    describe('MASTERY_EFFECTS', () => {
        it('should define all 8 mastery effects', () => {
            const expectedKeys = ['Topple', 'Sap', 'Slow', 'Vex', 'Cleave', 'Push', 'Nick', 'Graze'];
            expect(Object.keys(MASTERY_EFFECTS)).toEqual(expectedKeys);
        });
    });

    describe('handle', () => {
        it('should return a modal with available masteries and target info', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(
                { creatures: [{ name: 'Ogre', size: 'Huge' }] }
            );
            vi.mocked(damageUtils.getTargetFromAttacker).mockReturnValue({ name: 'Ogre' });

            const action = makeAction();
            const result = await handle(action, playerStats, campaignName, 'map');

            expect(result).toEqual({
                type: 'modal',
                modalName: 'weaponMastery',
                payload: expect.objectContaining({
                    action,
                    playerStats,
                    campaignName,
                    targetName: 'Ogre',
                    availableMasteries: ['Vex', 'Topple', 'Sap', 'Slow', 'Cleave', 'Nick', 'Graze'],
                }),
            });
        });

        it('should log an ability_use entry via addEntry', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            vi.mocked(damageUtils.getTargetFromAttacker).mockReturnValue({ name: 'Goblin' });

            await handle(makeAction(), playerStats, campaignName, 'map');

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Weapon Mastery',
                description: 'Weapon Mastery available against Goblin',
            }));
        });

        it('should set targetName null and omit target from log when no target exists', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null);

            const result = await handle(makeAction(), playerStats, campaignName, 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.targetName).toBeNull();
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                description: 'Weapon Mastery available',
            }));
        });

        it('should pass through custom masteries from action.automation', async () => {
            vi.mocked(damageUtils.getCombatContext).mockResolvedValue({ creatures: [] });
            vi.mocked(damageUtils.getTargetFromAttacker).mockReturnValue(null);

            const result = await handle(makeAction({ automation: { masteries: ['Vex', 'Graze'] } }), playerStats, campaignName, 'map');

            expect(result.payload.availableMasteries).toEqual(['Vex', 'Graze']);
            // makeAction merge semantics: non-overridden automation keys survive.
            expect(result.payload.action.automation.type).toBe('mastery_rider');
        });
    });

    describe('applyMasteryEffect', () => {
        it('should return null for an unknown mastery name', async () => {
            const result = await applyMasteryEffect('Bash', playerStats, campaignName, 'Goblin');
            expect(result).toBeNull();
        });

        // ── Cleave lane (once-per-turn wiring) ───────────────────────

        it('Cleave accept: consults and marks the once-per-turn latch under the holder store, writes the cleave te, returns the mastery_rider popup, logs ability_use', async () => {
            const result = await applyMasteryEffect('Cleave', playerStats, campaignName, 'Goblin');

            expect(oncePerTurn.checkOncePerTurn).toHaveBeenCalledWith('Cleave', '_Cleave_UsedRound', 'TestHero', campaignName);
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Goblin',
                source: 'Cleave',
                option: 'Cleave',
                effect: 'cleave',
                value: null,
                duration: 'until_start_of_next_turn',
            }], campaignName);
            expect(oncePerTurn.markOncePerTurn).toHaveBeenCalledWith('Cleave', '_Cleave_UsedRound', expect.objectContaining({ name: 'TestHero' }), campaignName);

            // Envelope delegation — description text owned by description.test.js.
            expect(result).toEqual(masteryPopup('Cleave', 'Goblin'));

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cleave',
                description: 'TestHero applied Cleave to Goblin',
                targetName: 'Goblin',
            }));
        });

        it('Cleave refuse: returns the once-per-turn popup verbatim with zero te writes and no latch mark', async () => {
            const refusal = { type: 'popup', payload: { type: 'automation_info', name: 'Cleave', description: 'Cleave can only be used once per turn.' } };
            vi.mocked(oncePerTurn.checkOncePerTurn).mockResolvedValueOnce(refusal);

            const result = await applyMasteryEffect('Cleave', playerStats, campaignName, 'Goblin');

            expect(result).toBe(refusal);
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(oncePerTurn.markOncePerTurn).not.toHaveBeenCalled();
        });

        // ── Generic paths: Slow ──────────────────────────────────────

        it('Slow accept: writes speed_reduction te value 10, arms a 1-round expiration, returns mastery_rider popup', async () => {
            const result = await applyMasteryEffect('Slow', playerStats, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Goblin',
                source: 'Slow',
                option: 'Slow',
                effect: 'speed_reduction',
                value: 10,
                duration: 'until_start_of_next_turn',
            }], campaignName);
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestHero',
                targetName: 'Goblin',
                effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'Slow', target: 'Goblin' }],
                campaignName,
                rounds: 1,
            });
            expect(result).toEqual(masteryPopup('Slow', 'Goblin'));
        });

        it('Slow refuses a target already reduced by Slow without stacking or arming expiration', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([
                { target: 'Goblin', effect: 'speed_reduction', source: 'Slow' },
            ]);

            const result = await applyMasteryEffect('Slow', playerStats, campaignName, 'Goblin');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Slow: Target already has Speed reduction from Slow — additional reductions don\'t stack.');
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
        });

        it('Slow refusal is per-target: another target is still slowed', async () => {
            vi.mocked(useRuntimeState.getRuntimeValue).mockReturnValue([
                { target: 'Goblin', effect: 'speed_reduction', source: 'Slow' },
            ]);

            const result = await applyMasteryEffect('Slow', playerStats, campaignName, 'Ogre');

            expect(result).toEqual(masteryPopup('Slow', 'Ogre'));
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([expect.objectContaining({ target: 'Ogre', effect: 'speed_reduction' })]),
                campaignName,
            );
        });

        // ── Generic paths: Vex / Sap / Topple ────────────────────────

        it('Vex writes a self-targeted te carrying vexTarget/appliedRound, arms a 2-round expiration, returns mastery_rider popup', async () => {
            const result = await applyMasteryEffect('Vex', playerStats, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'TestHero',
                source: 'Vex',
                option: 'Vex',
                effect: 'next_attack_advantage',
                value: 5,
                duration: 'until_start_of_next_turn',
                vexTarget: 'Goblin',
                appliedRound: 1,
            }], campaignName);
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestHero',
                targetName: 'Goblin',
                effects: [{ type: 'remove_target_effect', effectKey: 'next_attack_advantage', source: 'Vex', target: 'Goblin' }],
                campaignName,
                rounds: 2,
            });
            expect(result).toEqual(masteryPopup('Vex', 'Goblin'));
        });

        it('Sap writes disadvantage te stamped with appliedRound, arms an expire-on-attacker expiration, returns mastery_rider popup', async () => {
            const result = await applyMasteryEffect('Sap', playerStats, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Goblin',
                source: 'Sap',
                option: 'Sap',
                effect: 'disadvantage_next_attack',
                value: null,
                duration: 'until_start_of_next_turn',
                appliedRound: 1,
            }], campaignName);
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestHero',
                targetName: 'Goblin',
                effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: 'Sap', target: 'Goblin' }],
                campaignName,
                rounds: undefined,
                expireOnCreatureName: 'TestHero',
            });
            expect(result).toEqual(masteryPopup('Sap', 'Goblin'));
        });

        it('Topple writes a passive topple te with no expiration, returns mastery_rider popup', async () => {
            const result = await applyMasteryEffect('Topple', playerStats, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Goblin',
                source: 'Topple',
                option: 'Topple',
                effect: 'topple',
                value: null,
                duration: 'until_start_of_next_turn',
            }], campaignName);
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(result).toEqual(masteryPopup('Topple', 'Goblin'));
        });

        // ── Generic paths: Graze ability resolution ───────────────────

        it('Graze defaults to Strength when no weapon_mastery_choice passive exists', async () => {
            const result = await applyMasteryEffect('Graze', playerStats, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [{
                target: 'Goblin',
                source: 'Graze',
                option: 'Graze',
                effect: 'graze',
                value: null,
                duration: 'until_end_of_turn',
                abilityName: 'Strength',
                abilityMod: 3,
            }], campaignName);
            expect(result).toEqual(masteryPopup('Graze', 'Goblin'));
        });

        it('Graze resolves abilityName from the passive and pulls the live modifier from abilities', async () => {
            const ps = {
                ...playerStats,
                abilities: [...playerStats.abilities, { name: 'Dexterity', bonus: 5 }],
                automation: {
                    passives: [
                        { type: 'weapon_mastery_choice', name: 'Graze', abilityName: 'Dexterity' },
                    ],
                },
            };

            await applyMasteryEffect('Graze', ps, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([expect.objectContaining({ abilityName: 'Dexterity', abilityMod: 5 })]),
                campaignName,
            );
        });

        it('Graze defaults abilityMod to 0 when the chosen ability is not found', async () => {
            const ps = {
                ...playerStats,
                abilities: [{ name: 'Intelligence', bonus: 4 }],
                automation: {
                    passives: [
                        { type: 'weapon_mastery_choice', name: 'Graze', abilityName: 'Dexterity' },
                    ],
                },
            };

            await applyMasteryEffect('Graze', ps, campaignName, 'Goblin');

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([expect.objectContaining({ abilityName: 'Dexterity', abilityMod: 0 })]),
                campaignName,
            );
        });
    });
});
