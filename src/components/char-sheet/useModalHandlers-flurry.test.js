// @maintained-by-ai
// Routing seam for the Flurry of Blows modals in useModalHandlers:
// confirm → exact applyFlurryOfBlows payload → popup / openHandFromFlurry handoff,
// plus the Flurry of Healing and Harm secondary-target branch (CLA-144).
// Ki-spend / attack-grant internals are owned by bonusAttacksHandler tests;
// popup UI by FlurryOfBlowsTargetPopup tests — only this hook's routing is pinned here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

// Only mock what these lanes call. diceRoller / starryForm / twinkling mocks removed —
// the flurry lanes never touch them and the real modules import cleanly (runtime-probed).
vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    // `handle` kept: automation/index.js destructures it as a feature registry key (runtime-probed).
    handle: vi.fn(),
    applyFlurryOfBlows: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js', () => ({
    // `handle` kept: automation/index.js:352 destructures it as the open_hand_technique registry key (runtime-probed).
    handle: vi.fn(),
    applyOpenHandTechnique: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

// handleFlurryOfBlowsConfirm reads getCombatSummary for the Healing-and-Harm branch.
vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
    getCombatSummary: vi.fn(),
}));

import { applyFlurryOfBlows } from '../../services/automation/handlers/combat/bonusAttacksHandler.js';
import { applyOpenHandTechnique } from '../../services/automation/handlers/class-fighter-rogue/openHandTechniqueHandler.js';
import { buildSaveDc } from '../../services/automation/common/savePrompt.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

function createDeps(modalState = {}) {
    return {
        campaignName: 'test-campaign',
        modalState,
        setModalState: vi.fn(),
        setPopupHtml: vi.fn(),
    };
}

const OH_ACTION = { name: 'Open Hand Technique' };

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
        it('clears the modal once, calls applyFlurryOfBlows with the exact payload, and shows the popup', async () => {
            applyFlurryOfBlows.mockResolvedValue({ type: 'popup', payload: 'Flurry hit 1d6!' });
            const deps = createDeps({ flurryOfBlowsModal: FLURRY_MODAL });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(applyFlurryOfBlows).toHaveBeenCalledWith({
                action: { name: 'Flurry of Blows' },
                playerStats: { name: 'TestMonk' },
                campaignName: 'test-campaign',
                _mapName: 'test-map',
                distribution: 'target1',
                numAttacks: 2,
            });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Flurry hit 1d6!');
        });

        it('opens the open-hand queue instead of a popup when openHandTargets are returned', async () => {
            const targets = [{ action: OH_ACTION, targetName: 'Goblin' }];
            applyFlurryOfBlows.mockResolvedValue({
                type: 'popup',
                payload: 'Flurry with knockdown!',
                openHandTargets: targets,
            });
            const deps = createDeps({ flurryOfBlowsModal: FLURRY_MODAL });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(deps.setModalState).toHaveBeenNthCalledWith(1, { flurryOfBlowsModal: null });
            expect(deps.setModalState).toHaveBeenNthCalledWith(2, {
                openHandFromFlurry: { targets, saveDc: 15, currentIndex: 0, popupHtml: 'Flurry with knockdown!' },
            });
            expect(buildSaveDc).toHaveBeenCalledWith(OH_ACTION, { name: 'TestMonk' });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        // Both legs reachable at the real callee: applyFlurryOfBlows returns null on its
        // gate checks (missing distribution / no combat summary) and rejects on network failure.
        it.each([
            { name: 'resolves null (service gate)', result: null, rejects: false },
            { name: 'rejects', result: new Error('network failure'), rejects: true },
        ])('surfaces no popup when applyFlurryOfBlows $name', async ({ result, rejects }) => {
            if (rejects) applyFlurryOfBlows.mockRejectedValue(result);
            else applyFlurryOfBlows.mockResolvedValue(result);
            const deps = createDeps({ flurryOfBlowsModal: FLURRY_MODAL });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);

            if (rejects) {
                await expect(handleFlurryOfBlowsConfirm({ distribution: 'target1' })).rejects.toThrow('network failure');
            } else {
                await handleFlurryOfBlowsConfirm({ distribution: 'target1' });
            }
            // Modal is cleared before the handler runs, but nothing else happens on failure.
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('refuses to act when the flurry modal key is absent (other modals stay untouched)', async () => {
            const deps = createDeps({ flurryOfBlowsModal: null, divineFuryChoice: { pending: true } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(applyFlurryOfBlows).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('CLA-144: with Healing and Harm and an ally present, opens the secondary target modal and only executes on selection with healingTarget', async () => {
            const monk = { name: 'TestMonk', specialActions: [{ name: 'Flurry of Healing and Harm' }] };
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestMonk', currentHp: 10, maxHp: 20 },
                    { name: 'Goblin', currentHp: 7, maxHp: 9 },
                ],
            });
            applyFlurryOfBlows.mockResolvedValue({ type: 'popup', payload: 'Healing flurry!' });
            const deps = createDeps({
                flurryOfBlowsModal: { ...FLURRY_MODAL, playerStats: monk },
            });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            // Defers execution until a heal target is chosen.
            expect(applyFlurryOfBlows).not.toHaveBeenCalled();
            const secondary = deps.setModalState.mock.calls[1][0].secondaryTargetModal;
            expect(deps.setModalState).toHaveBeenNthCalledWith(2, {
                secondaryTargetModal: {
                    title: 'Select Target for Hand of Healing',
                    targets: [{ name: 'Goblin', currentHp: 7, maxHp: 9 }],
                    description: 'Choose a creature to heal with Hand of Healing. Subsequent strikes will use Hand of Harm.',
                    confirmLabel: 'Heal',
                    confirmIcon: 'fa-heart',
                    showHp: true,
                    onTargetSelected: expect.any(Function),
                    onSkip: expect.any(Function),
                },
            });

            await secondary.onTargetSelected('Goblin');
            expect(deps.setModalState).toHaveBeenCalledWith({ secondaryTargetModal: null });
            expect(applyFlurryOfBlows).toHaveBeenCalledWith({
                action: { name: 'Flurry of Blows' },
                playerStats: monk,
                campaignName: 'test-campaign',
                _mapName: 'test-map',
                distribution: 'target1',
                numAttacks: 2,
                healingTarget: 'Goblin',
            });
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Healing flurry!');
        });

        it('CLA-144: with Healing and Harm but no heal targets, executes the flurry directly without healingTarget', async () => {
            const monk = { name: 'TestMonk', specialActions: [{ name: 'Flurry of Healing and Harm' }] };
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestMonk', currentHp: 10, maxHp: 20 }] });
            applyFlurryOfBlows.mockResolvedValue({ type: 'popup', payload: 'Damage only' });
            const deps = createDeps({ flurryOfBlowsModal: { ...FLURRY_MODAL, playerStats: monk } });
            const { handleFlurryOfBlowsConfirm } = useModalHandlers(deps);
            await handleFlurryOfBlowsConfirm({ distribution: 'target1' });

            expect(applyFlurryOfBlows).toHaveBeenCalledWith({
                action: { name: 'Flurry of Blows' },
                playerStats: monk,
                campaignName: 'test-campaign',
                _mapName: 'test-map',
                distribution: 'target1',
                numAttacks: 2,
            });
            const openedSecondary = deps.setModalState.mock.calls.some(c => c[0].secondaryTargetModal !== undefined);
            expect(openedSecondary).toBe(false);
            expect(deps.setPopupHtml).toHaveBeenCalledWith('Damage only');
        });
    });

    describe('handleFlurryOfBlowsSkip', () => {
        // Source is an unconditional one-liner — single pin, and skip must never execute.
        it('clears the flurry modal without executing anything', () => {
            const deps = createDeps({ flurryOfBlowsModal: FLURRY_MODAL, divineFuryChoice: { pending: true } });
            const { handleFlurryOfBlowsSkip } = useModalHandlers(deps);
            handleFlurryOfBlowsSkip();
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
            expect(applyFlurryOfBlows).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });
});

describe('useModalHandlers - open hand from flurry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        buildSaveDc.mockReturnValue(15);
    });

    const queue = (overrides = {}) => ({
        targets: [
            { action: OH_ACTION, targetName: 'Goblin', playerStats: { name: 'TestMonk' }, campaignName: 'test-campaign' },
            { action: OH_ACTION, targetName: 'Orc', playerStats: { name: 'TestMonk' }, campaignName: 'test-campaign' },
        ],
        saveDc: 15,
        currentIndex: 0,
        popupHtml: 'Flurry result',
        ...overrides,
    });

    describe('handleOpenHandFromFlurryConfirm', () => {
        it('applies the technique to the current target with its exact payload and advances the queue', async () => {
            applyOpenHandTechnique.mockResolvedValue({ type: 'popup', payload: 'Open Hand pushed!' });
            const state = queue();
            const deps = createDeps({ openHandFromFlurry: state });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(applyOpenHandTechnique).toHaveBeenCalledWith({
                action: OH_ACTION,
                playerStats: { name: 'TestMonk' },
                campaignName: 'test-campaign',
                targetName: 'Goblin',
                selectedOptionName: 'Push',
                saveDc: 15,
            });
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({
                openHandFromFlurry: { ...state, currentIndex: 1 },
            });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        // Real callee returns null (unknown option) or type:'popup' — only those two shapes.
        it.each([
            { name: 'popup result', result: { type: 'popup', payload: 'Open Hand pushed!' }, expectPopup: true },
            { name: 'null result', result: null, expectPopup: false },
        ])('clears the queue on the last target ($name)', async ({ result, expectPopup }) => {
            applyOpenHandTechnique.mockResolvedValue(result);
            const deps = createDeps({
                openHandFromFlurry: queue({ targets: [queue().targets[0]] }),
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            if (expectPopup) expect(deps.setPopupHtml).toHaveBeenCalledWith('Open Hand pushed!');
            else expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when the current target index points past the queue (other modals stay untouched)', async () => {
            const deps = createDeps({
                openHandFromFlurry: queue({ targets: [] }),
                flurryOfBlowsModal: FLURRY_MODAL,
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(applyOpenHandTechnique).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when no open hand state exists (flurry modal still open)', async () => {
            const deps = createDeps({ openHandFromFlurry: null, flurryOfBlowsModal: FLURRY_MODAL });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);
            await handleOpenHandFromFlurryConfirm({ optionName: 'Push' });

            expect(applyOpenHandTechnique).not.toHaveBeenCalled();
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('propagates handler failure without advancing or clearing the queue', async () => {
            applyOpenHandTechnique.mockRejectedValue(new Error('handler error'));
            const deps = createDeps({
                openHandFromFlurry: queue({ targets: [queue().targets[0]] }),
            });
            const { handleOpenHandFromFlurryConfirm } = useModalHandlers(deps);

            await expect(handleOpenHandFromFlurryConfirm({ optionName: 'Push' })).rejects.toThrow('handler error');
            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });

    describe('handleOpenHandFromFlurrySkip', () => {
        it('advances to the next target without touching popup', async () => {
            const state = queue();
            const deps = createDeps({ openHandFromFlurry: state });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).toHaveBeenCalledTimes(1);
            expect(deps.setModalState).toHaveBeenCalledWith({
                openHandFromFlurry: { ...state, currentIndex: 1 },
            });
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it.each([
            { name: 'carried popup', popupHtml: 'Final popup', expectPopup: true },
            { name: 'null popupHtml', popupHtml: null, expectPopup: false },
            { name: 'empty popupHtml', popupHtml: '', expectPopup: false },
        ])('on the last target ($name)', async ({ popupHtml, expectPopup }) => {
            const deps = createDeps({
                openHandFromFlurry: queue({ targets: [queue().targets[0]], popupHtml }),
            });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).toHaveBeenCalledWith({ openHandFromFlurry: null });
            if (expectPopup) expect(deps.setPopupHtml).toHaveBeenCalledWith(popupHtml);
            else expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does nothing when no open hand state exists (flurry modal still open)', async () => {
            const deps = createDeps({ openHandFromFlurry: null, flurryOfBlowsModal: FLURRY_MODAL });
            const { handleOpenHandFromFlurrySkip } = useModalHandlers(deps);
            await handleOpenHandFromFlurrySkip();

            expect(deps.setModalState).not.toHaveBeenCalled();
            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });
    });
});
