import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
    handle: vi.fn(),
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    handle: vi.fn(),
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    handle: vi.fn(),
    applyFlurryOfBlows: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyConstellationOption } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        ...overrides.playerStats,
    };
    const modalState = {
        ...(overrides.modalState || {}),
    };
    return {
        playerStats,
        campaignName: 'test-campaign',
        rollDamage: vi.fn(),
        proceedWithDamage: vi.fn(),
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        modalState,
        setModalState: vi.fn((updates) => {
            if (typeof updates === 'function') {
                return updates(modalState);
            }
            Object.assign(modalState, updates);
        }),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers - features & constellation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setRuntimeValue.mockReturnValue(undefined);
    });

    describe('handleFeatureChoiceConfirm', () => {
        it('stores chosen option, clears modal, and shows popup with rest message for defensive_tactics', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Defensive Tactics', automation: { type: 'defensive_tactics' } },
                        optionKey: '_DefensiveTactics_choice',
                    },
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Shield Block');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_DefensiveTactics_choice', 'Shield Block', 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.stringMatching(/Defensive Tactics.*Shield Block.*Short or Long Rest/)
            );
        });

        it('stores chosen option and shows popup with re-click message for non-special actions', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Second Wind', automation: { type: 'healing' } },
                        optionKey: '_SecondWind_choice',
                    },
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Heal 5 HP');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_SecondWind_choice', 'Heal 5 HP', 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.stringMatching(/Second Wind.*Heal 5 HP.*clicking the feature again/)
            );
        });

        it('does nothing when no feature choice exists', () => {
            const deps = createDeps();
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('handles hunter_prey automation type with rest message', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Hunter\'s Premise', automation: { type: 'hunter_prey' } },
                        optionKey: '_HunterPrey_choice',
                    },
                },
            });
            const { handleFeatureChoiceConfirm } = useModalHandlers(deps);
            handleFeatureChoiceConfirm('Lurer');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_HunterPrey_choice', 'Lurer', 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                expect.stringMatching(/Hunter's Premise.*Lurer.*Short or Long Rest/)
            );
        });
    });

    describe('handleFeatureChoiceSkip', () => {
        it('clears feature choice modal', () => {
            const deps = createDeps();
            const { handleFeatureChoiceSkip } = useModalHandlers(deps);
            handleFeatureChoiceSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
        });

        it('clears feature choice even when one exists in modalState', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Test Feature' },
                        optionKey: 'test_key',
                    },
                },
            });
            const { handleFeatureChoiceSkip } = useModalHandlers(deps);
            handleFeatureChoiceSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleConstellationSelect', () => {
        it('calls twinkling handler when level >= 10 and sets popup', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 12 },
                campaignName: 'test-campaign',
            };
            twinklingApply.mockResolvedValue({ payload: 'Twinkled!' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Twinkling Constellation');
            expect(twinklingApply).toHaveBeenCalledWith(
                { name: 'Starry Form' },
                expect.objectContaining({ level: 12 }),
                'test-campaign',
                'Twinkling Constellation'
            );
            expect(applyConstellationOption).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Twinkled!');
        });

        it('calls starry handler when level < 10 and sets popup', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue({ payload: 'Starry!' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(applyConstellationOption).toHaveBeenCalledWith(
                { name: 'Starry Form' },
                expect.objectContaining({ level: 6 }),
                'test-campaign',
                'Starry Form'
            );
            expect(twinklingApply).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Starry!');
        });

        it('does not set popup when result is null', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue(null);
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
        });

        it('does not set popup when result is undefined', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue(undefined);
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
        });

        it('sets popup with undefined when result is truthy but lacks payload property', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue({ type: 'other' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Starry Form');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(undefined);
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
        });

        it('passes the optionName to the handler', async () => {
            const deps = createDeps();
            const payload = {
                action: { name: 'Starry Form' },
                playerStats: { level: 6 },
                campaignName: 'test-campaign',
            };
            applyConstellationOption.mockResolvedValue({ payload: 'Selected!' });
            const { handleConstellationSelect } = useModalHandlers(deps);
            await handleConstellationSelect(payload, 'Arrow Storm');
            expect(applyConstellationOption).toHaveBeenLastCalledWith(
                expect.any(Object),
                expect.any(Object),
                expect.any(String),
                'Arrow Storm'
            );
        });
    });
});
