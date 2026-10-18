// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

// Runtime store writes would POST to the server — stub. Both keys are load-required by the
// live graph (combatData.js and savePrompt.js import getRuntimeValue/setRuntimeValue at top
// level); a missing key fails at import.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));

// The only services this lane calls — routing targets of handleConstellationSelect.
// Runtime-probed by removal: the diceRoller and bonusAttacksHandler mocks from the previous
// version are dead here (the feature lane never calls them; the flurry lane is owned by
// useModalHandlers-flurry.test.js, and the base test file proves the unmocked live graph loads
// cleanly). The `handle` keys ARE load-required: live-graph automation/index.js registers
// handleStarryForm/handleTwinklingConstellation from these modules at import time.
vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
    applyConstellationOption: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    applyConstellationOption: vi.fn(),
    handle: vi.fn(),
}));

import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyConstellationOption as starryApply } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';
import { applyConstellationOption as twinklingApply } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';

function createDeps(overrides = {}) {
    const modalState = {
        ...(overrides.modalState || {}),
    };
    return {
        playerStats: { name: 'TestFighter', ...(overrides.playerStats || {}) },
        campaignName: 'test-campaign',
        proceedWithDamage: vi.fn(),
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        modalState,
        setModalState: vi.fn((updates) => Object.assign(modalState, updates)),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers - feature choice & constellation modals', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleFeatureChoiceConfirm', () => {
        it.each([
            [{ type: 'defensive_tactics' }, 'on a Short or Long Rest'],
            [{ type: 'hunter_prey' }, 'on a Short or Long Rest'],
            [{ type: 'healing' }, 'by clicking the feature again'],
            [undefined, 'by clicking the feature again'],
        ])('stores the choice once and reports the rest policy for automation $automation', async (automation, expectedTail) => {
            const deps = createDeps({
                modalState: {
                    featureChoice: {
                        action: { name: 'Test Feature', automation },
                        optionKey: '_Test_choice',
                    },
                },
            });
            useModalHandlers(deps).handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Test_choice', 'Option A', 'test-campaign');
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(
                `<b>Test Feature</b><br/>Option chosen: <b>Option A</b>. This choice can be changed ${expectedTail}.`
            );
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(twinklingApply).not.toHaveBeenCalled();
            expect(starryApply).not.toHaveBeenCalled();
        });

        it('refuses when the featureChoice slot is falsy — an unrelated open modal stays untouched', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: undefined,
                    flurryOfBlowsModal: { action: { name: 'Flurry of Blows' } },
                },
            });
            useModalHandlers(deps).handleFeatureChoiceConfirm('Option A');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
        });
    });

    describe('handleFeatureChoiceSkip', () => {
        it('closes the modal only — never writes the choice to the runtime store or shows a popup', () => {
            const deps = createDeps({
                modalState: {
                    featureChoice: { action: { name: 'Test Feature' }, optionKey: '_Test_choice' },
                },
            });
            useModalHandlers(deps).handleFeatureChoiceSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ featureChoice: null });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleConstellationSelect', () => {
        // 10 is the exact `ps.level >= 10` gate boundary.
        it.each([
            [10, 'twinkling'],
            [9, 'starry'],
        ])('level %i routes the selection to the %s handler', async (level, lane) => {
            const action = { name: 'Starry Form' };
            const playerStats = { level };
            const chosenResult = { type: 'popup', payload: `popup for ${lane}` };
            const routed = lane === 'twinkling' ? twinklingApply : starryApply;
            const idle = lane === 'twinkling' ? starryApply : twinklingApply;
            routed.mockResolvedValue(chosenResult);
            const deps = createDeps();
            await useModalHandlers(deps).handleConstellationSelect(
                { action, playerStats, campaignName: 'test-campaign' },
                'Dragon'
            );
            expect(routed).toHaveBeenCalledTimes(1);
            expect(routed).toHaveBeenCalledWith(action, playerStats, 'test-campaign', 'Dragon');
            expect(idle).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(chosenResult.payload);
            expect(deps.setModalState).toHaveBeenCalledWith({ starryFormConstellationModal: null, twinklingConstellationModal: null });
        });
    });
});
