import { describe, it, expect, vi } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach, campaignName, basePlayerStats } from './useCharActionsAutomation.test.setup.js';

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    handle: vi.fn(),
    onSpellSelected: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

describe('useCharActionsAutomation', () => {
    setupBeforeEach();

    describe('handleAutomationAction - early returns', () => {
        it('should return early when cannotAct is true', async () => {
            const hooks = createHooks({ cannotAct: true });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction' };
            await handleAutomationAction(action);

            expect(hooks.setPopupHtml).not.toHaveBeenCalled();
            expect(hooks.setModalState).not.toHaveBeenCalled();
            expect(hooks.executeHandler).not.toHaveBeenCalled();
        });

        it('should show popup and skip handler when focus points are 0 for monk ki feature', async () => {
            const hooks = createHooks({
                playerStats: { ...basePlayerStats, class: { class_levels: [{ level: 5, focus_points: 2 }] } },
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    return undefined;
                }),
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Flurry of Blows' };
            await handleAutomationAction(action);

            expect(hooks.setPopupHtml).toHaveBeenCalledWith(
                '<b>Flurry of Blows</b><br/>No ki points remaining.'
            );
            expect(hooks.executeHandler).not.toHaveBeenCalled();
        });

        it('should show popup with "Focus Points" message for 2024 rules', async () => {
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    rules: '2024',
                    class: { class_levels: [{ level: 5, focus_points: 2 }] },
                },
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    return undefined;
                }),
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Flurry of Blows' };
            await handleAutomationAction(action);

            expect(hooks.setPopupHtml).toHaveBeenCalledWith(
                '<b>Flurry of Blows</b><br/>No Focus Points remaining.'
            );
            expect(hooks.executeHandler).not.toHaveBeenCalled();
        });

        // CLA-159 INVERTED: standalone Hand of Healing always charges 1 Focus Point.
        // The FP-free HoH exemption is only for HoH used AS PART of Flurry and lives
        // entirely in bonusAttacksHandler (CLA-144/CLA-158).
        it('should spend FP cost for standalone Hand of Healing even with Flurry of Healing and Harm active (CLA-159)', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                    class: { class_levels: [{ level: 5, focus_points: 2 }] },
                },
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Hand of Healing' };
            await handleAutomationAction(action);

            expect(srw).toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                2,
                campaignName
            );
        });

        // CLA-159: 0-FP standalone HoH refuses with popup + <feature>_refused log, zero spend.
        it('should refuse Hand of Healing at 0 FP with refusal log and zero spend (CLA-159)', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                    class: { class_levels: [{ level: 5, focus_points: 2 }] },
                },
                setRuntimeValue: srw,
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return 0;
                    return undefined;
                }),
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Hand of Healing' };
            await handleAutomationAction(action);

            expect(hooks.setPopupHtml).toHaveBeenCalledWith(
                '<b>Hand of Healing</b><br/>No ki points remaining.'
            );
            expect(srw).not.toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                expect.any(Number)
            );
            expect(hooks.executeHandler).not.toHaveBeenCalled();
            expect(hooks.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'automation',
                automationType: 'hand_of_healing_refused',
            }));
        });

        it('should skip FP cost when Flurry of Healing and Harm is active for Flurry of Blows', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                    class: { class_levels: [{ level: 5, focus_points: 2 }] },
                },
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Flurry of Blows' };
            await handleAutomationAction(action);

            expect(srw).not.toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                expect.any(Number)
            );
        });

        it('should skip FP cost for Flurry of Blows when Cloak of Shadows is active', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                activeBuffs: [{ effect: 'cloak_of_shadows' }],
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Flurry of Blows' };
            await handleAutomationAction(action);

            expect(srw).not.toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                expect.any(Number)
            );
        });

        it('should skip FP cost for Heightened Flurry of Blows when Flurry of Healing and Harm is active', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                    class: { class_levels: [{ level: 5, focus_points: 2 }] },
                },
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Heightened Flurry of Blows' };
            await handleAutomationAction(action);

            expect(srw).not.toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                expect.any(Number)
            );
        });

        it('should skip FP cost for Heightened Flurry of Blows when Cloak of Shadows is active', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                activeBuffs: [{ effect: 'cloak_of_shadows' }],
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Heightened Flurry of Blows' };
            await handleAutomationAction(action);

            expect(srw).not.toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                expect.any(Number)
            );
        });

        it('should NOT skip FP cost when Flurry of Healing and Harm is active but action is not Hand of Healing or Flurry of Blows', async () => {
            const srw = vi.fn();
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    specialActions: [{ name: 'Flurry of Healing and Harm' }],
                    class: { class_levels: [{ level: 5, focus_points: 2 }] },
                },
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Patient Defense' };
            await handleAutomationAction(action);

            expect(srw).toHaveBeenCalledWith('TestFighter', 'focusPoints', 2, campaignName);
        });

        it('should decrement focus points for monk ki features', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Stunning Strike' };
            await handleAutomationAction(action);

            expect(srw).toHaveBeenCalledWith('TestFighter', 'focusPoints', 2, campaignName);
        });

        it('should dispatch focus-points-updated event when spending focus points', async () => {
            const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Stunning Strike' };
            await handleAutomationAction(action);

            expect(dispatchEvent).toHaveBeenCalledOnce();
            const event = dispatchEvent.mock.calls[0][0];
            expect(event).toBeInstanceOf(CustomEvent);
            expect(event.type).toBe('focus-points-updated');
            dispatchEvent.mockRestore();
        });

        it('should use _trackedResources fallback when getRuntimeValue returns null for focusPoints', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const trackedResources = { focusPoints: { current: 4 } };
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    _trackedResources: trackedResources,
                },
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'focusPoints') return null;
                    return undefined;
                }),
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Stunning Strike' };
            await handleAutomationAction(action);

            expect(srw).toHaveBeenCalledWith('TestFighter', 'focusPoints', 3, campaignName);
        });

        it('should handle undefined playerStats.class gracefully', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                playerStats: {
                    ...basePlayerStats,
                    class: undefined,
                },
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Stunning Strike' };
            await handleAutomationAction(action);

            expect(srw).toHaveBeenCalledWith('TestFighter', 'focusPoints', 2, campaignName);
        });

        it('should NOT spend focus points when action is not a monk ki feature', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'Fireball' };
            await handleAutomationAction(action);

            expect(srw).not.toHaveBeenCalledWith(
                'TestFighter',
                'focusPoints',
                expect.any(Number)
            );
        });
    });

    describe('handleAutomationAction - trigger conditions', () => {
        it('should show popup when trigger is after_casting_action_spell and no last action spell cast', async () => {
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                }),
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: { trigger: 'after_casting_action_spell' } };
            await handleAutomationAction(action);

            expect(hooks.setPopupHtml).toHaveBeenCalledWith(
                '<b>TestAction</b><br/>You must cast a spell with a casting time of an action first.'
            );
            expect(hooks.executeHandler).not.toHaveBeenCalled();
        });

        it('should clear lastActionSpellCast and proceed when trigger is after_casting_action_spell and spell was cast', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'lastActionSpellCast') return 'Cure Wounds';
                    return undefined;
                }),
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: { trigger: 'after_casting_action_spell' } };
            await handleAutomationAction(action);

            expect(srw).toHaveBeenCalledWith('TestFighter', 'lastActionSpellCast', 0, campaignName);
            expect(hooks.executeHandler).toHaveBeenCalled();
        });

        it('should not apply trigger logic when trigger is empty string', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === 'lastActionSpellCast') return null;
                    return undefined;
                }),
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = { name: 'TestAction', automation: { trigger: '' } };
            await handleAutomationAction(action);

            expect(hooks.executeHandler).toHaveBeenCalled();
        });
    });

    describe('handleAutomationAction - damage_bonus with options', () => {
        it('should show modal when damage_bonus has options and no choice made yet', async () => {
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === '_Test_Action_option') return null;
                    return undefined;
                }),
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = {
                name: 'Test Action',
                automation: { type: 'damage_bonus', options: ['Option A', 'Option B'] },
            };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({
                featureChoice: {
                    action,
                    options: ['Option A', 'Option B'],
                    optionKey: '_Test_Action_option',
                },
            });
            expect(hooks.executeHandler).not.toHaveBeenCalled();
        });

        it('should proceed when damage_bonus has options and a choice was already made', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === '_Test_Action_option') return 'Option A';
                    return undefined;
                }),
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const action = {
                name: 'Test Action',
                automation: { type: 'damage_bonus', options: ['Option A', 'Option B'] },
            };
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction(action);

            expect(hooks.executeHandler).toHaveBeenCalled();
        });

        it('should show modal when damage_bonus has no options', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    return undefined;
                }),
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = {
                name: 'Test Action',
                automation: { type: 'damage_bonus', options: [] },
            };
            await handleAutomationAction(action);

            expect(hooks.executeHandler).toHaveBeenCalled();
        });
    });

    describe('handleAutomationAction - defensive_tactics', () => {
        it('should show modal when defensive_tactics type and no choice made yet', async () => {
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === '_Defensive_Tactics_choice') return null;
                    return undefined;
                }),
            });
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            const action = {
                name: 'Defensive Tactics',
                automation: { type: 'defensive_tactics' },
            };
            await handleAutomationAction(action);

            expect(hooks.setModalState).toHaveBeenCalledWith({
                featureChoice: {
                    action,
                    options: ['Escape the Horde', 'Multiattack Defense'],
                    optionKey: '_Defensive_Tactics_choice',
                },
            });
            expect(hooks.executeHandler).not.toHaveBeenCalled();
        });

        it('should proceed when defensive_tactics choice was already made', async () => {
            const srw = vi.fn().mockResolvedValue(undefined);
            const hooks = createHooks({
                getRuntimeValue: vi.fn((charKey, key, _cn) => {
                    if (key === 'activeBuffs') return [];
                    if (key === '_Defensive_Tactics_choice') return 'Escape the Horde';
                    return undefined;
                }),
                setRuntimeValue: srw,
            });
            hooks.executeHandler.mockResolvedValue({ type: 'popup', payload: 'done' });
            const action = {
                name: 'Defensive Tactics',
                automation: { type: 'defensive_tactics' },
            };
            const { handleAutomationAction } = useCharActionsAutomation(hooks);
            await handleAutomationAction(action);

            expect(hooks.executeHandler).toHaveBeenCalled();
        });
    });
});
