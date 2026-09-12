// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    onSpellSelected: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

import { onSpellSelected as mockOnDivineInterventionSpellSelected } from '../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js';
import { executeSpellCast } from '../../services/rules/spells/spellCastService.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getClassFeatures } from '../../services/character/classFeatures.js';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'TestFighter',
    level: 5,
    class: { class_levels: [{ level: 5, focus_points: 2 }] },
    abilities: [
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Wisdom', bonus: 1 },
        { name: 'Constitution', bonus: 3 },
        { name: 'Intelligence', bonus: 0 },
        { name: 'Charisma', bonus: 0 },
    ],
    skills: [],
    feats: [],
    automation: { passives: [] },
};

function makeBaseGRV(activeBuffs, focusPoints) {
    return vi.fn((charKey, key, _cn) => {
        if (key === 'activeBuffs') return activeBuffs;
        if (key === 'focusPoints') return focusPoints;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
}

function pick(value, fallback) {
    return value || fallback;
}

function createDeps(overrides = {}) {
    const {
        cannotAct = false,
        playerStats = basePlayerStats,
        getRuntimeValue: customGRV,
        setRuntimeValue: customSRV,
        campaignName: cn = campaignName,
        activeBuffs = [],
        focusPoints = 3,
        rollDamage: customRollDamage,
        rollAttack: customRollAttack,
        executeHandler: customExecuteHandler,
        addEntry: customAddEntry,
        setPopupHtml: customSetPopupHtml,
        setModalState: customSetModalState,
        onBuffsChange: customOnBuffsChange,
        modalState: customModalState,
        mapName: customMapName,
        characters: customCharacters,
    } = overrides;

    return {
        cannotAct,
        getRuntimeValue: pick(customGRV, makeBaseGRV(activeBuffs, focusPoints)),
        setRuntimeValue: pick(customSRV, vi.fn()),
        rollDamage: pick(customRollDamage, vi.fn()),
        rollAttack: pick(customRollAttack, vi.fn()),
        executeHandler: pick(customExecuteHandler, vi.fn().mockResolvedValue(undefined)),
        addEntry: pick(customAddEntry, vi.fn().mockResolvedValue(undefined)),
        setPopupHtml: pick(customSetPopupHtml, vi.fn()),
        setModalState: pick(customSetModalState, vi.fn()),
        modalState: pick(customModalState, {}),
        playerStats,
        campaignName: cn,
        mapName: pick(customMapName, 'test-map'),
        characters: pick(customCharacters, []),
        onBuffsChange: pick(customOnBuffsChange, vi.fn()),
    };
}

function getHandlers(deps) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCharActionsAutomation(deps);
}

describe('useCharActionsAutomation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleAutomationAction', () => {
        it('should return early without any side effects when cannotAct is true', async () => {
            const deps = createDeps({ cannotAct: true });
            const { handleAutomationAction } = getHandlers(deps);
            const action = { name: 'Test Feature', automation: { type: 'test' } };

            await handleAutomationAction(action);

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.executeHandler).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should return the two handler functions', () => {
            const deps = createDeps();
            const handlers = getHandlers(deps);

            expect(typeof handlers.handleAutomationAction).toBe('function');
            expect(typeof handlers.handleDivineInterventionCast).toBe('function');
        });

        describe('damage_bonus with options', () => {
            it('should show a modal when no choice has been made yet', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    if (key === '_Test_Feature_option') return null;
                    return undefined;
                });
                const action = {
                    name: 'Test Feature',
                    automation: { type: 'damage_bonus', options: ['Option A', 'Option B'] },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setModalState).toHaveBeenCalledWith({
                    featureChoice: {
                        action,
                        options: ['Option A', 'Option B'],
                        optionKey: '_Test_Feature_option',
                    },
                });
                expect(deps.executeHandler).not.toHaveBeenCalled();
            });

            it('should proceed to executeHandler when a choice has already been made', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    if (key === '_Test_Feature_option') return 'Option A';
                    return undefined;
                });
                const action = {
                    name: 'Test Feature',
                    automation: { type: 'damage_bonus', options: ['Option A', 'Option B'] },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setModalState).not.toHaveBeenCalled();
                expect(deps.executeHandler).toHaveBeenCalledWith(
                    action,
                    basePlayerStats,
                    campaignName,
                    'test-map',
                    []
                );
            });
        });

        describe('defensive_tactics', () => {
            it('should show a modal when no choice has been made yet', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    if (key === '_Test_Feature_choice') return null;
                    return undefined;
                });
                const action = {
                    name: 'Test Feature',
                    automation: { type: 'defensive_tactics' },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setModalState).toHaveBeenCalledWith({
                    featureChoice: {
                        action,
                        options: ['Escape the Horde', 'Multiattack Defense'],
                        optionKey: '_Test_Feature_choice',
                    },
                });
                expect(deps.executeHandler).not.toHaveBeenCalled();
            });

            it('should proceed to executeHandler when a choice has already been made', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    if (key === '_Test_Feature_choice') return 'Escape the Horde';
                    return undefined;
                });
                const action = {
                    name: 'Test Feature',
                    automation: { type: 'defensive_tactics' },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setModalState).not.toHaveBeenCalled();
                expect(deps.executeHandler).toHaveBeenCalled();
            });
        });

        describe('Monk Ki features - focus point spending', () => {
            const monkActions = [
                'Flurry of Blows', 'Patient Defense', 'Step of the Wind',
                'Heightened Flurry of Blows', 'Heightened Patient Defense',
                'Heightened Step of the Wind', 'Hand of Healing', 'Stunning Strike',
            ];

            it.each(monkActions)('should spend 1 focus point for %s when FP is available', async (actionName) => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 2;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: actionName, automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', 1, campaignName
                );
            });

            it('should show popup and not spend FP when focus points are depleted', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Flurry of Blows', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).toHaveBeenCalledWith(
                    '<b>Flurry of Blows</b><br/>No ki points remaining.'
                );
                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).not.toHaveBeenCalled();
            });

            it('should show popup with "Focus Points" for 2024 ruleset when depleted', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Flurry of Blows', automation: {} };
                const playerStats = { ...basePlayerStats, rules: '2024' };

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).toHaveBeenCalledWith(
                    '<b>Flurry of Blows</b><br/>No Focus Points remaining.'
                );
            });

            it('should NOT pre-spend FP for 2024 patient_defense actions (handler is sole FP writer)', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 17;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });

                for (const actionName of ['Patient Defense', 'Heightened Patient Defense']) {
                    const action = {
                        name: actionName,
                        automation: { type: 'patient_defense', cost: { resource: 'focus_points', amount: 1 } },
                    };
                    const deps = createDeps({ getRuntimeValue: grv });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                        'TestFighter', 'focusPoints', expect.any(Number), campaignName
                    );
                    expect(deps.executeHandler).toHaveBeenCalledWith(
                        action, basePlayerStats, campaignName, 'test-map', []
                    );
                }
            });

            it('should reach executeHandler for patient_defense at FP=0 (plain Disengage pass-through, no block)', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const playerStats = { ...basePlayerStats, rules: '2024' };
                const action = {
                    name: 'Heightened Patient Defense',
                    automation: { type: 'patient_defense', cost: { resource: 'focus_points', amount: 1 } },
                };

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).not.toHaveBeenCalledWith(
                    expect.stringContaining('No Focus Points remaining.')
                );
                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalledWith(
                    action, playerStats, campaignName, 'test-map', []
                );
            });

            it('should NOT pre-spend FP for step_of_the_wind actions (handler is sole FP writer, CLA-333)', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 17;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });

                for (const actionName of ['Step of the Wind', 'Heightened Step of the Wind']) {
                    const action = {
                        name: actionName,
                        automation: { type: 'step_of_the_wind', cost: { resource: 'focus_points', amount: 1 } },
                    };
                    const deps = createDeps({ getRuntimeValue: grv });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                        'TestFighter', 'focusPoints', expect.any(Number), campaignName
                    );
                    expect(deps.executeHandler).toHaveBeenCalledWith(
                        action, basePlayerStats, campaignName, 'test-map', []
                    );
                }
            });

            it('should pass step_of_the_wind FP=0 gate down to the handler (CLA-333)', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const playerStats = { ...basePlayerStats, rules: '2024' };
                const action = {
                    name: 'Heightened Step of the Wind',
                    automation: { type: 'step_of_the_wind', cost: { resource: 'focus_points', amount: 1 } },
                };

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalledWith(
                    action, playerStats, campaignName, 'test-map', []
                );
            });

            it('should skip FP spending for Flurry of Blows when Flurry of Healing and Harm is active', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const playerStats = {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                };
                const action = { name: 'Flurry of Blows', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should skip FP spending for Hand of Healing when Flurry of Healing and Harm is active', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const playerStats = {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                };
                const action = { name: 'Hand of Healing', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should skip FP spending for Flurry of Blows when Cloak of Shadows is active (Shadow Flurry)', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows' }];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Flurry of Blows', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should skip FP spending for Heightened Flurry of Blows when Cloak of Shadows is active', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows' }];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Heightened Flurry of Blows', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', expect.any(Number), campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should NOT skip FP spending for Patient Defense when Cloak of Shadows is active', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows' }];
                    if (key === 'focusPoints') return 0;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Patient Defense', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).toHaveBeenCalled();
                expect(deps.executeHandler).not.toHaveBeenCalled();
            });

            it('should use _trackedResources fallback when focusPoints is null', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return null;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Flurry of Blows', automation: {} };
                const playerStats = {
                    ...basePlayerStats,
                    _trackedResources: { focusPoints: { current: 1 } },
                };

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', 0, campaignName
                );
            });

            it('should use maxFP from getClassFeatures when _trackedResources is missing', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return null;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Flurry of Blows', automation: {} };
                const playerStats = {
                    ...basePlayerStats,
                    _trackedResources: undefined,
                };
                getClassFeatures.mockReturnValue({ maxFocusPoints: 2 });

                const deps = createDeps({ getRuntimeValue: grv, playerStats });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                // maxFP is 2, so currentFP is 2 (not depleted), action proceeds
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter', 'focusPoints', 1, campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should dispatch focus-points-updated event after spending', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 2;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Flurry of Blows', automation: {} };
                const dispatchSpy = vi.spyOn(window, 'CustomEvent');

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(dispatchSpy).toHaveBeenCalledWith('focus-points-updated');
                dispatchSpy.mockRestore();
            });
        });

        describe('trigger conditions', () => {
            it('should show popup and reset lastActionSpellCast when trigger is after_casting_action_spell and lastCast exists', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return 'Firebolt';
                    return undefined;
                });
                const action = {
                    name: 'War Caster',
                    automation: { trigger: 'after_casting_action_spell' },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).not.toHaveBeenCalled();
                expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                    'TestFighter', 'lastActionSpellCast', 0, campaignName
                );
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should show popup and NOT proceed when trigger condition is not met', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = {
                    name: 'War Caster',
                    automation: { trigger: 'after_casting_action_spell' },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).toHaveBeenCalledWith(
                    '<b>War Caster</b><br/>You must cast a spell with a casting time of an action first.'
                );
                expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                    'TestFighter', 'lastActionSpellCast', 0, campaignName
                );
                expect(deps.executeHandler).not.toHaveBeenCalled();
            });

            it('should skip trigger check when trigger is empty string', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = {
                    name: 'Test Feature',
                    automation: { trigger: '' },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).not.toHaveBeenCalled();
                expect(deps.executeHandler).toHaveBeenCalled();
            });

            it('should skip trigger check when trigger is undefined', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = {
                    name: 'Test Feature',
                    automation: { trigger: undefined },
                };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(deps.setPopupHtml).not.toHaveBeenCalled();
                expect(deps.executeHandler).toHaveBeenCalled();
            });
        });

        describe('executeHandler result processing', () => {
            describe('popup result type', () => {
                it('should call setPopupHtml with the payload', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<b>Test</b><br/>Result',
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setPopupHtml).toHaveBeenCalledWith('<b>Test</b><br/>Result');
                });

                it('should call onBuffsChange when popup is temp_buff type', async () => {
                    const action = { name: 'Test Feature', automation: { type: 'temp_buff' } };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<p>Temp HP granted</p>',
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.onBuffsChange).toHaveBeenCalled();
                });

                it('should call onBuffsChange when popup is combat_stance type', async () => {
                    const action = { name: 'Test Feature', automation: { type: 'combat_stance' } };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<p>Stance active</p>',
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.onBuffsChange).toHaveBeenCalled();
                });

                it('should NOT call onBuffsChange for non-buff popups', async () => {
                    const action = { name: 'Test Feature', automation: { type: 'damage' } };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<p>Damage dealt</p>',
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.onBuffsChange).not.toHaveBeenCalled();
                });
            });

            describe('modal result type', () => {
                it('should route healingPool modal correctly', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'healingPool',
                        payload: { amount: 10 },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        healingPoolModal: { amount: 10 },
                    });
                });

                it('should route elementalAffinity modal with expanded payload', async () => {
                    const action = { name: 'Elemental Affinity', automation: {} };
                    const payload = {
                        action,
                        damageTypes: ['Fire', 'Cold'],
                        existingType: 'Fire',
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'elementalAffinity',
                        payload,
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        elementalAffinityModal: {
                            action: payload.action,
                            playerStats: basePlayerStats,
                            campaignName,
                            damageTypes: ['Fire', 'Cold'],
                            existingType: 'Fire',
                        },
                    });
                });

                it('should use default damageTypes for elementalAffinity when payload lacks them', async () => {
                    const action = { name: 'Elemental Affinity', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'elementalAffinity',
                        payload: {},
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        elementalAffinityModal: expect.objectContaining({
                            damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'],
                        }),
                    });
                });

                it('should route fiendishResilience modal with expanded payload', async () => {
                    const action = { name: 'Fiendish Resilience', automation: {} };
                    const payload = {
                        action,
                        damageTypes: ['Fire'],
                        existingType: 'Fire',
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'fiendishResilience',
                        payload,
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        fiendishResilienceModal: {
                            action: payload.action,
                            playerStats: basePlayerStats,
                            campaignName,
                            damageTypes: ['Fire'],
                            existingType: 'Fire',
                        },
                    });
                });

                it('should use default damageTypes for fiendishResilience when payload lacks them', async () => {
                    const action = { name: 'Fiendish Resilience', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'fiendishResilience',
                        payload: {},
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        fiendishResilienceModal: expect.objectContaining({
                            damageTypes: [
                                'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
                                'Necrotic', 'Piercing', 'Poison', 'Psychic',
                                'Radiant', 'Slashing', 'Thunder',
                            ],
                        }),
                    });
                });

                it('should route divineIntervention modal with action and modal payload', async () => {
                    const action = { name: 'Divine Intervention', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'divineIntervention',
                        payload: { spellOptions: ['Fireball'] },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        divineInterventionAction: action,
                        divineInterventionModal: { spellOptions: ['Fireball'] },
                    });
                });

                it('should route celestialResilienceModal with expanded payload', async () => {
                    const action = { name: 'Celestial Resilience', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'celestialResilienceModal',
                        payload: { resilienceType: 'fire' },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        celestialResilienceModal: {
                            resilienceType: 'fire',
                            playerStats: basePlayerStats,
                            campaignName,
                        },
                    });
                });

                it('should route breathWeaponShape modal with expanded payload', async () => {
                    const action = { name: 'Breath Weapon', automation: {} };
                    const payload = {
                        action,
                        options: ['Cone', 'Line'],
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'breathWeaponShape',
                        payload,
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        breathWeaponShapeModal: {
                            action: payload.action,
                            playerStats: basePlayerStats,
                            campaignName,
                            options: ['Cone', 'Line'],
                        },
                    });
                });

                it('should route hypnoticPatternShake modal directly', async () => {
                    const action = { name: 'Hypnotic Pattern', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'hypnoticPatternShake',
                        payload: { shake: true },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        hypnoticPatternShakeModal: { shake: true },
                    });
                });

                it('should route telepathicSpeech modal with secondary target selection', async () => {
                    const action = { name: 'Telepathic Speech', automation: {} };
                    const payload = {
                        action,
                        creatureTargets: ['Goblin', 'Orc'],
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'telepathicSpeech',
                        payload,
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setModalState).toHaveBeenCalledWith({
                        secondaryTargetModal: expect.objectContaining({
                            title: 'Telepathic Speech',
                            icon: 'fa-brain',
                            targets: ['Goblin', 'Orc'],
                            confirmLabel: 'Establish Link',
                            confirmIcon: 'fa-brain',
                            description: 'Choose one creature within 30 feet to communicate with telepathically.',
                        }),
                    });
                });

                it('should use Charisma bonus for telepathicSpeech featureDescription', async () => {
                    const action = { name: 'Telepathic Speech', automation: {} };
                    const payload = {
                        action,
                        creatureTargets: ['Goblin'],
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'telepathicSpeech',
                        payload,
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    const call = deps.setModalState.mock.calls[0][0].secondaryTargetModal;
                    expect(call.featureDescription).toContain('1 mile');
                    expect(call.featureDescription).toContain('5 minute');
                });

                it('should default telepathicSpeech featureDescription to 1 Charisma bonus when none found', async () => {
                    const action = { name: 'Telepathic Speech', automation: {} };
                    const payload = {
                        action,
                        creatureTargets: ['Goblin'],
                    };
                    const playerStats = { ...basePlayerStats, abilities: [] };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'modal',
                        modalName: 'telepathicSpeech',
                        payload,
                    });

                    const deps = createDeps({ executeHandler, playerStats });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    const call = deps.setModalState.mock.calls[0][0].secondaryTargetModal;
                    expect(call.featureDescription).toContain('1 mile');
                });
            });

            describe('roll result type', () => {
                it('should call rollDamage when result type is roll with damage rollType', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'roll',
                        payload: {
                            rollType: 'damage',
                            name: 'Fireball',
                            formula: '8d6',
                            total: 32,
                            rolls: [6, 5, 4, 3, 2, 1, 6, 5],
                            modifier: 0,
                        },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.rollDamage).toHaveBeenCalledWith(
                        'Fireball', '8d6', 32, [6, 5, 4, 3, 2, 1, 6, 5], 0, {}
                    );
                });

                it('should pass contextConfig to rollDamage when provided', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'roll',
                        payload: {
                            rollType: 'damage',
                            name: 'Fireball',
                            formula: '8d6',
                            total: 32,
                            rolls: [6, 5, 4, 3, 2, 1, 6, 5],
                            modifier: 0,
                            contextConfig: { source: 'spell' },
                        },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.rollDamage).toHaveBeenCalledWith(
                        'Fireball', '8d6', 32, [6, 5, 4, 3, 2, 1, 6, 5], 0, { source: 'spell' }
                    );
                });

                it('should NOT call rollDamage for non-damage rollTypes', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'roll',
                        payload: {
                            rollType: 'attack',
                            name: 'Attack',
                            formula: '1d20',
                            total: 15,
                            rolls: [15],
                            modifier: 0,
                        },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.rollDamage).not.toHaveBeenCalled();
                });
            });

            describe('attack_roll result type', () => {
                it('should call rollAttack with attack details', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const attack = {
                        name: 'Longsword',
                        hitBonus: 7,
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'attack_roll',
                        payload: { attack, targetName: 'Goblin' },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.rollAttack).toHaveBeenCalledWith(
                        'Longsword', 7, {
                            targetName: 'Goblin',
                            forcedMode: undefined,
                            isOpportunityAttack: false,
                            autoDamageFormula: null,
                            autoDamageName: 'Longsword',
                            damageType: 'Slashing',
                        }
                    );
                });

                it('should pass autoDamage fields from attack when present', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const attack = {
                        name: 'Raven Queen\'s Grasp',
                        hitBonus: 5,
                        autoDamageFormula: '2d8',
                        autoDamageName: 'Raven Queen\'s Grasp',
                        damageType: 'Cold',
                    };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'attack_roll',
                        payload: { attack, targetName: 'Orc' },
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.rollAttack).toHaveBeenCalledWith(
                        'Raven Queen\'s Grasp', 5, {
                            targetName: 'Orc',
                            forcedMode: undefined,
                            isOpportunityAttack: false,
                            autoDamageFormula: '2d8',
                            autoDamageName: 'Raven Queen\'s Grasp',
                            damageType: 'Cold',
                        }
                    );
                });
            });

            describe('notify_buffs_changed result type', () => {
                it('should call onBuffsChange when result type is notify_buffs_changed', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'notify_buffs_changed',
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.onBuffsChange).toHaveBeenCalled();
                });

                it('should call onBuffsChange when it is provided (even as default vi.fn)', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'notify_buffs_changed',
                    });

                    const deps = createDeps({
                        executeHandler,
                        onBuffsChange: undefined,
                    });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    // createDeps defaults onBuffsChange to vi.fn() when undefined, so it gets called
                    expect(deps.onBuffsChange).toHaveBeenCalled();
                });
            });

            describe('log entries', () => {
                it('should call addEntry for each log entry', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<p>Done</p>',
                        logEntries: [
                            { type: 'ability_use', characterName: 'TestFighter', abilityName: 'Test Feature' },
                            { type: 'damage', amount: 10 },
                        ],
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.addEntry).toHaveBeenNthCalledWith(
                        1, campaignName, { type: 'ability_use', characterName: 'TestFighter', abilityName: 'Test Feature' }
                    );
                    expect(deps.addEntry).toHaveBeenNthCalledWith(
                        2, campaignName, { type: 'damage', amount: 10 }
                    );
                });

                it('should not throw when addEntry rejects', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<p>Done</p>',
                        logEntries: [{ type: 'test' }],
                    });
                    const addEntry = vi.fn().mockRejectedValue(new Error('log failed'));

                    const deps = createDeps({ executeHandler, addEntry });
                    const { handleAutomationAction } = getHandlers(deps);

                    // Should not throw
                    await expect(handleAutomationAction(action)).resolves.toBeUndefined();
                });

                it('should not call addEntry when there are no log entries', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue({
                        type: 'popup',
                        payload: '<p>Done</p>',
                    });

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.addEntry).not.toHaveBeenCalled();
                });
            });

            describe('executeHandler returns falsy', () => {
                it('should return early when executeHandler returns null', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue(null);

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setPopupHtml).not.toHaveBeenCalled();
                    expect(deps.setModalState).not.toHaveBeenCalled();
                    expect(deps.rollDamage).not.toHaveBeenCalled();
                    expect(deps.rollAttack).not.toHaveBeenCalled();
                    expect(deps.addEntry).not.toHaveBeenCalled();
                });

                it('should return early when executeHandler returns undefined', async () => {
                    const action = { name: 'Test Feature', automation: {} };
                    const executeHandler = vi.fn().mockResolvedValue(undefined);

                    const deps = createDeps({ executeHandler });
                    const { handleAutomationAction } = getHandlers(deps);

                    await handleAutomationAction(action);

                    expect(deps.setPopupHtml).not.toHaveBeenCalled();
                    expect(deps.setModalState).not.toHaveBeenCalled();
                    expect(deps.rollDamage).not.toHaveBeenCalled();
                    expect(deps.rollAttack).not.toHaveBeenCalled();
                    expect(deps.addEntry).not.toHaveBeenCalled();
                });
            });
        });

        describe('activeBuffs reading', () => {
            it('should pass campaignName as third argument when reading activeBuffs', async () => {
                const grv = vi.fn((charKey, key, cn) => {
                    if (charKey === 'TestFighter' && key === 'activeBuffs' && cn === 'test-campaign') return [];
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Test Feature', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                await handleAutomationAction(action);

                expect(grv).toHaveBeenCalledWith('TestFighter', 'activeBuffs', 'test-campaign');
            });

            it('should gracefully handle non-array activeBuffs', async () => {
                const grv = vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return null;
                    if (key === 'focusPoints') return 3;
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                });
                const action = { name: 'Test Feature', automation: {} };

                const deps = createDeps({ getRuntimeValue: grv });
                const { handleAutomationAction } = getHandlers(deps);

                // Should not throw
                await expect(handleAutomationAction(action)).resolves.toBeUndefined();
            });
        });
    });

    describe('handleDivineInterventionCast', () => {
        it('should clear modal at start and return early when there is no divineInterventionAction in runtime or modalState', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return null;
                return undefined;
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: {},
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(mockOnDivineInterventionSpellSelected).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({
                divineInterventionModal: null,
                divineInterventionAction: null,
            });
        });

        it('should clear divine intervention modal and action at the start', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(deps.setModalState).toHaveBeenCalledWith({
                divineInterventionModal: null,
                divineInterventionAction: null,
            });
        });

        it('should call onDivineInterventionSpellSelected with correct args', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({});

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(mockOnDivineInterventionSpellSelected).toHaveBeenCalledWith(
                action, basePlayerStats, campaignName, { name: 'Fireball' }
            );
        });

        it('should return early when onDivineInterventionSpellSelected returns falsy', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue(null);

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('should call executeSpellCast when result type is spell_selected', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({});

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(executeSpellCast).toHaveBeenCalledWith(
                { name: 'Fireball' },
                {},
                expect.objectContaining({
                    rollAttack: deps.rollAttack,
                    rollDamage: deps.rollDamage,
                    playerStats: basePlayerStats,
                    campaignName,
                    mapName: 'test-map',
                    characters: [],
                })
            );
        });

        it('should pass a getTargetInfo function to executeSpellCast that uses getCombatContext', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            getCombatContext.mockResolvedValue({ creatures: [] });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            executeSpellCast.mockResolvedValue({});

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(executeSpellCast).toHaveBeenCalledWith(
                expect.any(Object),
                {},
                expect.objectContaining({
                    getTargetInfo: expect.any(Function),
                })
            );

            // Verify the getTargetInfo function calls getCombatContext
            const callArgs = executeSpellCast.mock.calls[0][2];
            const targetInfo = callArgs.getTargetInfo;
            const result = targetInfo();
            expect(result).toBeInstanceOf(Promise);
        });

        it('should handle executeSpellCast result with triggerResult type modal', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({
                triggerResult: {
                    type: 'modal',
                    modalName: 'wildMagicSurge',
                    payload: { surge: 'Explosive Burst' },
                },
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(deps.setModalState).toHaveBeenCalledWith({
                wildMagicSurgeModal: { surge: 'Explosive Burst' },
            });
        });

        it('should handle executeSpellCast result with triggerResult type popup', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({
                triggerResult: {
                    type: 'popup',
                    payload: { name: 'Fireball', description: 'Burst' },
                },
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(deps.setPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Fireball',
                description: 'Burst',
            });
        });

        it('should handle executeSpellCast result with healing amount', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Cure Wounds' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({
                healAmount: 15,
                rawTotal: 18,
                formula: '1d8 + 3',
                rolls: [5, 4, 3],
                targetName: 'Ally1',
                bonusHeal: 5,
                bonusDetails: [{ amount: 5, name: 'Channel Divinity' }],
                healingRerollOriginalRolls: null,
                healingRerollDisplayRolls: null,
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Cure Wounds' });

            expect(deps.setPopupHtml).toHaveBeenCalledWith({
                type: 'heal',
                name: 'Cure Wounds',
                formula: '1d8 + 3',
                rolls: [5, 4, 3],
                total: 18,
                targetName: 'Ally1',
                finalHeal: 15,
                bonusHeal: 5,
                bonusHealDetail: '5 Channel Divinity',
                healingRerollOriginalRolls: null,
                healingRerollDisplayRolls: null,
            });
        });

        it('should always show the final automation_info popup after spell execution', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({});

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(deps.setPopupHtml).toHaveBeenCalledWith({
                type: 'automation_info',
                name: 'Divine Intervention',
                description: 'Divine Intervention cast Fireball. Divine Intervention recharges after a long rest',
            });
        });

        it('should catch and log errors from executeSpellCast', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return action;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockRejectedValue(new Error('cast failed'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            // Wait for the .catch() microtask to run
            await new Promise(process.nextTick);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[CharActions] executeSpellCast error:',
                expect.any(Error)
            );
            consoleErrorSpy.mockRestore();
        });

        it('should use modalState divineInterventionAction as fallback when runtime returns null', async () => {
            const action = { name: 'Divine Intervention' };
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return null;
                return undefined;
            });
            mockOnDivineInterventionSpellSelected.mockResolvedValue({
                type: 'spell_selected',
                spell: { name: 'Fireball' },
                name: 'Divine Intervention',
                rechargeMessage: 'after a long rest',
            });
            executeSpellCast.mockResolvedValue({});

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: { divineInterventionAction: action },
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(mockOnDivineInterventionSpellSelected).toHaveBeenCalled();
        });

        it('should return early when both runtime and modalState lack divineInterventionAction', async () => {
            const grv = vi.fn((charKey, key, _cn) => {
                if (key === 'divineInterventionAction') return null;
                return undefined;
            });

            const deps = createDeps({
                getRuntimeValue: grv,
                modalState: {},
            });
            const { handleDivineInterventionCast } = getHandlers(deps);

            await handleDivineInterventionCast({ name: 'Fireball' });

            expect(mockOnDivineInterventionSpellSelected).not.toHaveBeenCalled();
        });
    });
});
