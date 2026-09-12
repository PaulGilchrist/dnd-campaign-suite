// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js', () => ({
    handle: vi.fn(),
    applyOpenHandTechnique: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

import { applyFlurryOfBlows } from '../../services/automation/handlers/combat/bonusAttacksHandler.js';
import { applyOpenHandTechnique } from '../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js';
import { buildSaveDc } from '../../services/automation/common/savePrompt.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestMonk',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Dexterity', bonus: 3 }],
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

const FLURRY_MODAL = {
    action: { name: 'Flurry of Blows' },
    playerStats: { name: 'TestMonk' },
    campaignName: 'test-campaign',
    mapName: 'test-map',
    numAttacks: 2,
};

describe('useModalHandlers - flurry of blows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildSaveDc.mockReturnValue(15);
    });

    describe('handleFlurryOfBlowsConfirm', () => {
        it('clears the flurry modal, calls applyFlurryOfBlows, and sets popup on success', async () => {
            applyFlurryOfBlows.mockResolvedValue({
                payload: 'Flurry hit 1d6!',
                type: 'popup',
            });
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            // Modal is cleared first
            expect(deps.setModalState).toHaveBeenNthCalledWith(1, { flurryOfBlowsModal: null });
            // Then handler is called with correct args
            expect(applyFlurryOfBlows).toHaveBeenCalledWith({
                action: { name: 'Flurry of Blows' },
                playerStats: { name: 'TestMonk' },
                campaignName: 'test-campaign',
                _mapName: 'test-map',
                distribution: 'target1',
                numAttacks: 2,
            });
            // Popup is set from handler result
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Flurry hit 1d6!');
        });

        it('opens open hand modal when flurry returns openHandTargets', async () => {
            applyFlurryOfBlows.mockResolvedValue({
                payload: 'Flurry with knockdown!',
                openHandTargets: [
                    { action: { name: 'Open Hand Technique' }, targetName: 'Goblin' },
                ],
            });
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(deps.setModalState).toHaveBeenNthCalledWith(1, { flurryOfBlowsModal: null });
            expect(deps.setModalState).toHaveBeenNthCalledWith(2, {
                openHandFromFlurry: {
                    targets: [{ action: { name: 'Open Hand Technique' }, targetName: 'Goblin' }],
                    saveDc: 15,
                    currentIndex: 0,
                    popupHtml: 'Flurry with knockdown!',
                },
            });
            // buildSaveDc is called with the first target's action and playerStats
            expect(buildSaveDc).toHaveBeenCalledWith(
                { name: 'Open Hand Technique' },
                { name: 'TestMonk' }
            );
            // No popup set when open hand targets exist
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does not open open hand modal when openHandTargets is empty array', async () => {
            applyFlurryOfBlows.mockResolvedValue({
                payload: 'Flurry result',
                openHandTargets: [],
            });
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when applyFlurryOfBlows returns null', async () => {
            applyFlurryOfBlows.mockResolvedValue(null);
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when result lacks popup type and has no openHandTargets', async () => {
            applyFlurryOfBlows.mockResolvedValue({ someOtherField: 'value' });
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when no flurry modal state exists', async () => {
            const deps = createDeps({ modalState: {} });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(applyFlurryOfBlows).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when applyFlurryOfBlows throws', async () => {
            applyFlurryOfBlows.mockRejectedValue(new Error('network failure'));
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);

            await expect(handleFlurryOfBlowsConfirm({ distribution: 'target1' })).rejects.toThrow('network failure');
            // Modal was cleared before the handler call, so it was already cleared
            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleFlurryOfBlowsSkip', () => {
        it('clears the flurry modal when skipping', () => {
            const deps = createDeps({ modalState: { flurryOfBlowsModal: FLURRY_MODAL } });
            const { handleFlurryOfBlowsSkip } = useModalHandlers(deps);
            handleFlurryOfBlowsSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
        });

        it('clears flurry modal even when no flurry modal state exists', () => {
            const deps = createDeps({ modalState: {} });
            const { handleFlurryOfBlowsSkip } = useModalHandlers(deps);
            handleFlurryOfBlowsSkip();
            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
        });
    });
});

describe('useModalHandlers - open hand from flurry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildSaveDc.mockReturnValue(15);
        applyOpenHandTechnique.mockResolvedValue({
            type: 'popup',
            payload: 'Open Hand pushed!',
        });
    });

    describe('handleOpenHandFromFlurryConfirm', () => {
        it('calls applyOpenHandTechnique with correct arguments and advances to next target', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [
                            { action: { name: 'Open Hand Technique' }, targetName: 'Goblin' },
                            { action: { name: 'Open Hand Technique' }, targetName: 'Orc' },
                        ],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Flurry result',
                    },
                },
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(applyOpenHandTechnique).toHaveBeenCalledWith(
                { name: 'Open Hand Technique' },
                undefined,
                undefined,
                'Goblin',
                'Push',
                15
            );
            expect(deps.setModalState).toHaveBeenCalledWith({
                openHandFromFlurry: {
                    targets: [
                        { action: { name: 'Open Hand Technique' }, targetName: 'Goblin' },
                        { action: { name: 'Open Hand Technique' }, targetName: 'Orc' },
                    ],
                    saveDc: 15,
                    currentIndex: 1,
                    popupHtml: 'Flurry result',
                },
            });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('clears open hand state and shows popup when all targets processed with popup result', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [{ action: { name: 'Open Hand' }, targetName: 'Goblin' }],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Flurry result',
                    },
                },
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Open Hand pushed!');
        });

        it('clears open hand state without popup when result is not popup type', async () => {
            applyOpenHandTechnique.mockResolvedValue({ type: 'other' });
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [{ action: { name: 'Open Hand' }, targetName: 'Goblin' }],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Flurry result',
                    },
                },
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when current target is missing', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Flurry result',
                    },
                },
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(applyOpenHandTechnique).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when no open hand state exists', async () => {
            const deps = createDeps();
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(applyOpenHandTechnique).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when applyOpenHandTechnique throws', async () => {
            applyOpenHandTechnique.mockRejectedValue(new Error('handler error'));
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [{ action: { name: 'Open Hand' }, targetName: 'Goblin' }],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Flurry result',
                    },
                },
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);

            await expect(handleOpenHandFromFlurryConfirm({ optionName: 'Push' })).rejects.toThrow('handler error');
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleOpenHandFromFlurrySkip', () => {
        it('advances to next target when more targets remain', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [
                            { action: { name: 'Open Hand' }, targetName: 'Goblin' },
                            { action: { name: 'Open Hand' }, targetName: 'Orc' },
                        ],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Flurry result',
                    },
                },
            });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).toHaveBeenCalledWith({
                openHandFromFlurry: {
                    targets: [
                        { action: { name: 'Open Hand' }, targetName: 'Goblin' },
                        { action: { name: 'Open Hand' }, targetName: 'Orc' },
                    ],
                    saveDc: 15,
                    currentIndex: 1,
                    popupHtml: 'Flurry result',
                },
            });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('clears open hand state and shows popup when all targets processed', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [{ action: { name: 'Open Hand' }, targetName: 'Goblin' }],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: 'Final popup',
                    },
                },
            });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Final popup');
        });

        it('does not set popup when popupHtml is null and all targets processed', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [{ action: { name: 'Open Hand' }, targetName: 'Goblin' }],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: null,
                    },
                },
            });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does not set popup when popupHtml is an empty string', async () => {
            const deps = createDeps({
                modalState: {
                    openHandFromFlurry: {
                        targets: [{ action: { name: 'Open Hand' }, targetName: 'Goblin' }],
                        saveDc: 15,
                        currentIndex: 0,
                        popupHtml: '',
                    },
                },
            });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when no open hand state exists', async () => {
            const deps = createDeps();
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });
});
