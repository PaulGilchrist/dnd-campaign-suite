// @maintained-by-ai
// Routing-seam lane: Oceanic Gift (Gift of the Sea) target confirm in
// useCharActionsModalHandlers. Pins the gate reading modalState (wrong-store refusal —
// never modalState={} vacuity), the modal clearing BEFORE the selectedAllyName gate
// (source order verified: setModalState precedes the falsy-target return), the
// doubleOverride ?? doubleEmanation merge (override:false over modal:true distinguishes
// ?? from ||, CLA-240), byte-exact single-object dispatch payload with real
// campaignName, popup keyed strictly on result.type === 'popup' with the exact payload
// object passed through, and no side effects when the gate refuses.
// Service internals are owned by oceanicGiftHandler.test.js; modal-open lives in
// useCharActionsAutomation.test.class-feature-modals.js; UI click wiring lives in
// SecondaryTargetModals.oceanicVariant / CharActionModals.target-selection-handlers —
// not restated here.
// Mock purged to the one routed handler module; the rest of the hook's graph loads for
// real and is never invoked by this seam (same real-graph pattern as the sibling
// healing/areaEffects/buffs lanes). `handle` is runtime-probed: services/automation/
// index.js destructures it from this module when the live graph imports (#318).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/handlers/class-druid/oceanicGiftHandler.js', () => ({
  confirmOceanicGift: vi.fn(),
  // runtime-probed: removing it fails this suite's import at
  // services/automation/index.js:323 ("No handle export") — the live graph
  // destructures it (#318)
  handle: vi.fn(),
}));

const { confirmOceanicGift } = await import('../../services/automation/handlers/class-druid/oceanicGiftHandler.js');

const CAMPAIGN = 'test-campaign';

function stats() {
  return { name: 'TestChar', class: { name: 'Druid' } };
}

// Distinct spellSaveDc/wisMod values so a key swap in the dispatch payload fails.
function modalData(overrides = {}) {
  return {
    action: { name: 'Oceanic Gift' },
    playerStats: stats(),
    campaignName: CAMPAIGN,
    spellSaveDc: 15,
    wisMod: 4,
    doubleEmanation: false,
    ...overrides,
  };
}

// The handler's real success shape: popup envelope around an automation_info payload.
function popupResult(payload) {
  return { type: 'popup', payload };
}

function mount(modalState, mergedModalState = {}) {
  const setPopupHtml = vi.fn();
  const setModalState = vi.fn();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handlers = useCharActionsModalHandlers({
    setPopupHtml,
    setModalState,
    modalState,
    mergedModalState,
  });
  return { handlers, setPopupHtml, setModalState };
}

describe('useCharActionsModalHandlers - oceanicGift routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { desc: 'modal closed', modalState: { oceanicGiftTargetModal: null }, merged: {} },
    {
      desc: 'modal only in mergedModalState (wrong store)',
      modalState: {},
      merged: { oceanicGiftTargetModal: modalData() },
    },
  ])('refuses without side effects — $desc', async ({ modalState, merged }) => {
    const { handlers, setPopupHtml, setModalState } = mount(modalState, merged);

    await handlers.handleOceanicGiftConfirm('Ally1', true);

    expect(confirmOceanicGift).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(setModalState).not.toHaveBeenCalled();
  });

  // Source clears the modal BEFORE the falsy-target gate — a skip-click must still
  // close the chooser even though nothing dispatches.
  it.each([null, undefined, ''])('falsy target %s with modal open: no dispatch, but modal still cleared', async (target) => {
    const { handlers, setPopupHtml, setModalState } = mount({ oceanicGiftTargetModal: modalData() });

    await handlers.handleOceanicGiftConfirm(target);

    expect(confirmOceanicGift).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(setModalState).toHaveBeenCalledTimes(1);
    expect(setModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
  });

  // The chooser toggle override wins over the stored modal value via ?? — the
  // (override:false, modal:true) leg is what distinguishes ?? from ||.
  it.each([
    { desc: 'override true over modal false', modalDouble: false, override: true, expectedDouble: true },
    { desc: 'override false over modal true', modalDouble: true, override: false, expectedDouble: false },
    { desc: 'override omitted forwards modal value', modalDouble: true, override: undefined, expectedDouble: true },
  ])('dispatches byte-exact payload — $desc (CLA-240)', async ({ modalDouble, override, expectedDouble }) => {
    const payload = { type: 'automation_info', name: 'Oceanic Gift', description: 'Wrath of the Sea granted to Ally1.' };
    confirmOceanicGift.mockResolvedValue(popupResult(payload));
    const data = modalData({ doubleEmanation: modalDouble });
    const { handlers, setPopupHtml, setModalState } = mount({ oceanicGiftTargetModal: data });

    await handlers.handleOceanicGiftConfirm('Ally1', override);

    expect(confirmOceanicGift).toHaveBeenCalledTimes(1);
    expect(confirmOceanicGift).toHaveBeenCalledWith({
      action: data.action,
      playerStats: data.playerStats,
      campaignName: CAMPAIGN,
      selectedAllyName: 'Ally1',
      spellSaveDc: 15,
      wisMod: 4,
      doubleEmanation: expectedDouble,
    });
    expect(setPopupHtml).toHaveBeenCalledWith(payload);
    expect(setModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
  });

  // Popup is keyed on result.type — a truthy payload under a non-popup type must not
  // pop, while dispatch and modal clear still stand.
  it('does not pop when confirmOceanicGift resolves a non-popup type, still clears modal', async () => {
    confirmOceanicGift.mockResolvedValue({ type: 'automation_info', payload: { description: 'never shown' } });
    const { handlers, setPopupHtml, setModalState } = mount({ oceanicGiftTargetModal: modalData() });

    await handlers.handleOceanicGiftConfirm('Ally1');

    expect(confirmOceanicGift).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(setModalState).toHaveBeenCalledWith({ oceanicGiftTargetModal: null });
  });
});
