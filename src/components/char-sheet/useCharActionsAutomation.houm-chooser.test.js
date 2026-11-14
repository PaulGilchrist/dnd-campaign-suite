// @maintained-by-ai
// modalMap routing for the HoUoM in-sheet corpse chooser (backlog 2026-11-14
// NP improve): executeHandler's {type:'modal', modalName:'handOfUltimateMercy'}
// result must open handOfUltimateMercyModal with the producer payload passed
// through (creatureTargets roster + confirmResurrect closure) PLUS the
// host-side wiring — onResolved closes the chooser and surfaces the commit's
// automation_info popup; onClose is the zero-spend dismiss (state clear only,
// no popup, no runtime write). Real modules, no vi.mock — same lane as the
// resource-modals routing family.
import { describe, it, expect, vi } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';
import { createHooks, setupBeforeEach } from './useCharActionsAutomation.test.setup.js';

const HOUM_ACTION = { name: 'Hand of Ultimate Mercy', automation: {} };

function chooserPayload() {
    const confirmResurrect = vi.fn();
    return {
        confirmResurrect,
        payload: {
            featureName: HOUM_ACTION.name,
            casterName: 'TestFighter',
            costAmount: 5,
            creatureTargets: [{ name: 'CorpseAlly', type: 'player', currentHp: 0, maxHp: 90 }],
            confirmResurrect,
        },
    };
}

describe('useCharActionsAutomation — handOfUltimateMercy chooser routing', () => {
    setupBeforeEach();

    it('opens handOfUltimateMercyModal with the producer payload plus host wiring', async () => {
        const hooks = createHooks();
        const { payload, confirmResurrect } = chooserPayload();
        hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName: 'handOfUltimateMercy', payload });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(HOUM_ACTION);
        const state = hooks.setModalState.mock.calls[0][0].handOfUltimateMercyModal;

        expect(hooks.setModalState).toHaveBeenCalledTimes(1);
        expect(state.featureName).toBe('Hand of Ultimate Mercy');
        expect(state.casterName).toBe('TestFighter');
        expect(state.costAmount).toBe(5);
        expect(state.creatureTargets).toBe(payload.creatureTargets);
        expect(state.confirmResurrect).toBe(confirmResurrect);
        expect(typeof state.onResolved).toBe('function');
        expect(typeof state.onClose).toBe('function');
        // Routing a chooser result defers the economy charge — no popup on open.
        expect(hooks.setPopupHtml).not.toHaveBeenCalled();
    });

    it('onResolved closes the chooser and surfaces the success popup payload', async () => {
        const hooks = createHooks();
        const { payload } = chooserPayload();
        hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName: 'handOfUltimateMercy', payload });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(HOUM_ACTION);
        const state = hooks.setModalState.mock.calls[0][0].handOfUltimateMercyModal;
        hooks.setModalState.mockClear();

        const popup = { type: 'automation_info', name: 'Hand of Ultimate Mercy', description: 'Returns to life with 31 HP. Expended 5 Focus Points.' };
        state.onResolved(popup);

        expect(hooks.setModalState).toHaveBeenCalledWith({ handOfUltimateMercyModal: null });
        expect(hooks.setPopupHtml).toHaveBeenCalledWith(popup);
    });

    it('onResolved(null) closes without opening any popup', async () => {
        const hooks = createHooks();
        const { payload } = chooserPayload();
        hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName: 'handOfUltimateMercy', payload });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(HOUM_ACTION);
        const state = hooks.setModalState.mock.calls[0][0].handOfUltimateMercyModal;
        hooks.setModalState.mockClear();

        state.onResolved(null);

        expect(hooks.setModalState).toHaveBeenCalledWith({ handOfUltimateMercyModal: null });
        expect(hooks.setPopupHtml).not.toHaveBeenCalled();
    });

    it('onClose is a pure zero-spend dismiss: state clear only', async () => {
        const hooks = createHooks();
        const { payload } = chooserPayload();
        hooks.executeHandler.mockResolvedValue({ type: 'modal', modalName: 'handOfUltimateMercy', payload });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(HOUM_ACTION);
        const state = hooks.setModalState.mock.calls[0][0].handOfUltimateMercyModal;
        hooks.setModalState.mockClear();

        state.onClose();

        expect(hooks.setModalState).toHaveBeenCalledTimes(1);
        expect(hooks.setModalState).toHaveBeenCalledWith({ handOfUltimateMercyModal: null });
        expect(hooks.setPopupHtml).not.toHaveBeenCalled();
        expect(hooks.setRuntimeValue).not.toHaveBeenCalled();
    });
});
