// @maintained-by-ai
// Routing-seam lane: buff-choice modal confirms in useCharActionsModalHandlers.
// Pins gate refusals (isolated falsy legs per #339), exact buff-service call
// payloads (arity + byte), setPopupHtml on result.payload only, runtime-store
// writes / log copy for the inline Inspiring Smite & Trickster Blessing lanes,
// and modalState clears.
// Service internals live in tempHpBuffHandler.*.test.js and
// celestialResilienceHandler.confirmSkip.test.js; the CLA-200 latch semantics are
// owned by inspiringSmiteLatch.test.js; modal UI wiring lives in the
// CharActionModals suites.
// Dead-mock purge: the hook's other imports (combatSuperiority, healing, area
// handlers, etc.) are never invoked by these six handlers, so they load for real
// — verified side-effect-free at import by the sibling areaEffects suite.
// Only modules whose exports these handlers observe are mocked, with every key
// the live import graph destructures (handle destructured by
// services/automation/index.js per #318).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpBuffHandler.js', () => ({
  confirmMantleOfInspiration: vi.fn(),
  confirmVitalityOfTheTree: vi.fn(),
  // handle destructured by services/automation/index.js in the live graph (#318;
  // runtime-verified: removing it fails this suite's import with "No handle export")
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-warlock/celestialResilienceHandler.js', () => ({
  confirmCelestialResilience: vi.fn(),
  skipCelestialResilience: vi.fn(),
  // handle destructured by services/automation/index.js in the live graph (#318;
  // runtime-verified: removing it fails this suite's import with "No handle export")
  handle: vi.fn(),
}));

const { toggleBuff } = await import('../../services/automation/common/buffToggle.js');
const { setTempHp } = await import('../../services/automation/handlers/buffs/tempHpService.js');
const { setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../services/ui/logService.js');
const { confirmMantleOfInspiration, confirmVitalityOfTheTree } = await import('../../services/automation/handlers/buffs/tempHpBuffHandler.js');
const { confirmCelestialResilience, skipCelestialResilience } = await import('../../services/automation/handlers/class-warlock/celestialResilienceHandler.js');

const CAMPAIGN = 'test-campaign';

function mount(modalState = {}) {
  const setPopupHtml = vi.fn();
  const setModalState = vi.fn();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handlers = useCharActionsModalHandlers({
    setPopupHtml,
    setModalState,
    modalState,
    mergedModalState: {},
  });
  return { handlers, setPopupHtml, setModalState };
}

function stats() {
  return { name: 'TestChar', class: { name: 'Fighter' } };
}

describe('useCharActionsModalHandlers - buffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleMantleOfInspirationConfirm', () => {
    it.each([
      { name: 'selectedTargets is null', targets: null, modalOpen: true },
      { name: 'selectedTargets is undefined', targets: undefined, modalOpen: true },
      { name: 'modal is not open', targets: ['Ally1'], modalOpen: false },
    ])('refuses without touching service, popup, or modalState when $name', async ({ targets, modalOpen }) => {
      const { handlers, setPopupHtml, setModalState } = mount(
        modalOpen ? { mantleOfInspirationTarget: { action: { name: 'Mantle of Inspiration' } } } : {}
      );

      await handlers.handleMantleOfInspirationConfirm(targets);

      expect(confirmMantleOfInspiration).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('calls confirmMantleOfInspiration with the full object payload, pops the payload, clears the modal', async () => {
      const popup = '<p>Inspired!</p>';
      confirmMantleOfInspiration.mockResolvedValue({ payload: popup });
      const action = { name: 'Mantle of Inspiration' };
      const { handlers, setPopupHtml, setModalState } = mount({
        mantleOfInspirationTarget: {
          action,
          playerStats: stats(),
          campaignName: CAMPAIGN,
          dieRoll: 7,
          bardicDieSize: 'd8',
          tempHp: 5,
        },
      });

      await handlers.handleMantleOfInspirationConfirm(['Ally1']);

      // object payload — 7 keys exactly, dieRoll/bardicDieSize/tempHp forwarded
      expect(confirmMantleOfInspiration).toHaveBeenCalledWith({
        action,
        playerStats: stats(),
        campaignName: CAMPAIGN,
        selectedTargets: ['Ally1'],
        dieRoll: 7,
        bardicDieSize: 'd8',
        tempHp: 5,
      });
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ mantleOfInspirationTarget: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      confirmMantleOfInspiration.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        mantleOfInspirationTarget: {
          action: { name: 'Mantle of Inspiration' },
          playerStats: stats(),
          campaignName: CAMPAIGN,
          dieRoll: 5,
          bardicDieSize: 'd6',
          tempHp: 3,
        },
      });

      await handlers.handleMantleOfInspirationConfirm(['Ally1']);

      expect(confirmMantleOfInspiration).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ mantleOfInspirationTarget: null });
    });
  });

  describe('handleCelestialResilienceConfirm', () => {
    it.each([
      { name: 'selectedTargets is null', targets: null, modalOpen: true },
      { name: 'selectedTargets is undefined', targets: undefined, modalOpen: true },
      { name: 'modal is not open', targets: ['Ally1'], modalOpen: false },
    ])('refuses without touching service, popup, or modalState when $name', async ({ targets, modalOpen }) => {
      const { handlers, setPopupHtml, setModalState } = mount(
        modalOpen ? { celestialResilienceModal: { action: { name: 'Celestial Resilience' } } } : {}
      );

      await handlers.handleCelestialResilienceConfirm(targets);

      expect(confirmCelestialResilience).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('calls confirmCelestialResilience with 4 positional args, pops the payload, clears the modal', async () => {
      const popup = '<p>Resilience applied</p>';
      confirmCelestialResilience.mockResolvedValue({ payload: popup });
      const action = { name: 'Celestial Resilience' };
      const { handlers, setPopupHtml, setModalState } = mount({
        celestialResilienceModal: { action, playerStats: stats(), campaignName: CAMPAIGN },
      });

      await handlers.handleCelestialResilienceConfirm(['Ally1']);

      // positional arity — 4 args, not an object payload
      expect(confirmCelestialResilience).toHaveBeenCalledWith(action, stats(), CAMPAIGN, ['Ally1']);
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      confirmCelestialResilience.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        celestialResilienceModal: {
          action: { name: 'Celestial Resilience' },
          playerStats: stats(),
          campaignName: CAMPAIGN,
        },
      });

      await handlers.handleCelestialResilienceConfirm(['Ally1']);

      expect(confirmCelestialResilience).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });
  });

  describe('handleCelestialResilienceSkip', () => {
    it('refuses without touching service, popup, or modalState when the modal is not open', async () => {
      const { handlers, setPopupHtml, setModalState } = mount({});

      await handlers.handleCelestialResilienceSkip();

      expect(skipCelestialResilience).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('calls skipCelestialResilience with 3 positional args, pops the payload, clears the modal', async () => {
      const popup = '<p>Resilience skipped</p>';
      skipCelestialResilience.mockResolvedValue({ payload: popup });
      const action = { name: 'Celestial Resilience' };
      const { handlers, setPopupHtml, setModalState } = mount({
        celestialResilienceModal: { action, playerStats: stats(), campaignName: CAMPAIGN },
      });

      await handlers.handleCelestialResilienceSkip();

      // skip lane takes 3 args — no targets list on the skip path
      expect(skipCelestialResilience).toHaveBeenCalledWith(action, stats(), CAMPAIGN);
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      skipCelestialResilience.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        celestialResilienceModal: {
          action: { name: 'Celestial Resilience' },
          playerStats: stats(),
          campaignName: CAMPAIGN,
        },
      });

      await handlers.handleCelestialResilienceSkip();

      expect(skipCelestialResilience).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ celestialResilienceModal: null });
    });
  });

  describe('handleInspiringSmiteConfirm', () => {
    // Inline lane (no service delegation): setTempHp + runtime writes + log live in the hook itself.
    it.each([
      { name: 'distribution is null', distribution: null, modalOpen: true },
      { name: 'distribution is undefined', distribution: undefined, modalOpen: true },
      { name: 'modal is not open', distribution: { Ally1: 5 }, modalOpen: false },
      { name: 'distribution has no targets', distribution: {}, modalOpen: true },
    ])('refuses without touching temp HP, runtime store, log, popup, or modalState when $name', async ({ distribution, modalOpen }) => {
      const { handlers, setPopupHtml, setModalState } = mount(
        modalOpen ? { inspiringSmiteModal: { action: { name: 'Inspiring Smite' }, playerStats: stats(), campaignName: CAMPAIGN, channelDivinityCharges: 1 } } : {}
      );

      await handlers.handleInspiringSmiteConfirm(distribution);

      expect(setTempHp).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('CLA-200: distributes temp HP per target, spends the charge, latches castToken, logs, pops, clears', async () => {
      const { handlers, setPopupHtml, setModalState } = mount({
        inspiringSmiteModal: {
          action: { name: 'Inspiring Smite' },
          playerStats: stats(),
          campaignName: CAMPAIGN,
          channelDivinityCharges: 2,
          castToken: 4242,
        },
      });

      await handlers.handleInspiringSmiteConfirm({ Ally1: 5, Ally2: 10 });

      // per-target temp HP, insertion order, exact amounts
      expect(setTempHp).toHaveBeenNthCalledWith(1, 'Ally1', 5, CAMPAIGN);
      expect(setTempHp).toHaveBeenNthCalledWith(2, 'Ally2', 10, CAMPAIGN);
      expect(setTempHp).toHaveBeenCalledTimes(2);
      // two runtime writes in order: charge decrement, then the cast latch (same-store writes race otherwise)
      expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestChar', 'channelDivinityCharges', 1, CAMPAIGN);
      expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'TestChar', 'inspiringSmiteUsedToken', 4242, CAMPAIGN);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Inspiring Smite',
        description: 'TestChar used Inspiring Smite (15 temp HP). Distribution: Ally1=5, Ally2=10',
      });
      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Inspiring Smite</b><br/>Granted 15 temporary hit points: Ally1 (5 HP), Ally2 (10 HP).'
      );
      expect(setModalState).toHaveBeenCalledWith({ inspiringSmiteModal: null });
    });

    it('latches a wall-clock stamp token when the modal carries no castToken', async () => {
      const before = Date.now();
      const { handlers, setModalState } = mount({
        inspiringSmiteModal: {
          action: { name: 'Inspiring Smite' },
          playerStats: stats(),
          campaignName: CAMPAIGN,
          channelDivinityCharges: 3,
        },
      });

      await handlers.handleInspiringSmiteConfirm({ TestChar: 6 });
      const after = Date.now();

      expect(setTempHp).toHaveBeenCalledWith('TestChar', 6, CAMPAIGN);
      // castToken ?? Date.now() fallback: token is a fresh stamp between the call bounds
      expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'TestChar', 'channelDivinityCharges', 2, CAMPAIGN);
      const tokenCall = setRuntimeValue.mock.calls[1];
      expect(tokenCall[0]).toBe('TestChar');
      expect(tokenCall[1]).toBe('inspiringSmiteUsedToken');
      expect(tokenCall[2]).toBeGreaterThanOrEqual(before);
      expect(tokenCall[2]).toBeLessThanOrEqual(after);
      expect(tokenCall[3]).toBe(CAMPAIGN);
      expect(setModalState).toHaveBeenCalledWith({ inspiringSmiteModal: null });
    });
  });

  describe('handleVitalityOfTheTreeConfirm', () => {
    it.each([
      { name: 'selectedTargets is null', targets: null, modalOpen: true },
      { name: 'selectedTargets is undefined', targets: undefined, modalOpen: true },
      { name: 'modal is not open', targets: ['Ally1'], modalOpen: false },
    ])('refuses without touching service, popup, or modalState when $name', async ({ targets, modalOpen }) => {
      const { handlers, setPopupHtml, setModalState } = mount(
        modalOpen ? { vitalityOfTheTreeTarget: { action: { name: 'Vitality of the Tree' } } } : {}
      );

      await handlers.handleVitalityOfTheTreeConfirm(targets);

      expect(confirmVitalityOfTheTree).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('calls confirmVitalityOfTheTree with the object payload (maxTargets NOT forwarded), pops, clears', async () => {
      const popup = '<p>Tree heal!</p>';
      confirmVitalityOfTheTree.mockResolvedValue({ payload: popup });
      const action = { name: 'Vitality of the Tree' };
      const { handlers, setPopupHtml, setModalState } = mount({
        vitalityOfTheTreeTarget: {
          action,
          playerStats: stats(),
          campaignName: CAMPAIGN,
          tempHp: 10,
          maxTargets: 3,
        },
      });

      await handlers.handleVitalityOfTheTreeConfirm(['Ally1', 'Ally2']);

      // deep-equal payload: maxTargets lives in modalState but must NOT leak to the service
      expect(confirmVitalityOfTheTree).toHaveBeenCalledWith({
        action,
        playerStats: stats(),
        campaignName: CAMPAIGN,
        selectedTargets: ['Ally1', 'Ally2'],
        tempHp: 10,
      });
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      confirmVitalityOfTheTree.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        vitalityOfTheTreeTarget: {
          action: { name: 'Vitality of the Tree' },
          playerStats: stats(),
          campaignName: CAMPAIGN,
          tempHp: 10,
          maxTargets: 3,
        },
      });

      await handlers.handleVitalityOfTheTreeConfirm(['Ally1']);

      expect(confirmVitalityOfTheTree).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });
  });

  describe('handleTricksterBlessingConfirm', () => {
    // Inline lane: toggleBuff + log + automation_info popup live in the hook itself.
    const blessingModal = (action) => ({
      tricksterBlessingModal: { action, playerStats: stats(), campaignName: CAMPAIGN },
    });
    const auto = { type: 'buff', duration: '1 hour' };

    it('refuses without touching buffToggle, log, popup, or modalState when the modal is not open', async () => {
      const { handlers, setPopupHtml, setModalState } = mount({});

      await handlers.handleTricksterBlessingConfirm('Ally1');

      expect(toggleBuff).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'explicit ally target',
        targetName: 'Ally1',
        expectedTarget: 'Ally1',
        expectedActivationCopy: 'Blessing of the Trickster activated on Ally1 (1 hour)',
      },
      {
        name: 'null targetName resolves to self',
        targetName: null,
        expectedTarget: 'TestChar',
        expectedActivationCopy: 'Blessing of the Trickster activated on yourself (1 hour)',
      },
      {
        name: 'action name and automation defaults when missing',
        targetName: 'Ally1',
        expectedTarget: 'Ally1',
        expectedActivationCopy: 'Blessing of the Trickster activated on Ally1 (1 hour)',
        actionOverride: { automation: { type: 'buff' } },
        expectedAutomation: { type: 'buff' },
      },
    ])('toggles buff ON for $name, logs, pops automation_info, clears the modal', async ({ targetName, expectedTarget, expectedActivationCopy, actionOverride, expectedAutomation }) => {
      const expectedAuto = expectedAutomation || auto;
      toggleBuff.mockReturnValue({ wasActive: false });
      const { handlers, setPopupHtml, setModalState } = mount(blessingModal(actionOverride || { name: 'Blessing of the Trickster', automation: auto }));

      await handlers.handleTricksterBlessingConfirm(targetName);

      expect(toggleBuff).toHaveBeenCalledWith(expectedTarget, 'Blessing of the Trickster', expectedAuto, CAMPAIGN, expectedTarget);
      expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Blessing of the Trickster',
        description: `Blessing granted to ${expectedTarget} with advantage on Stealth checks.`,
      });
      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Blessing of the Trickster',
        automationType: 'buff',
        description: expectedActivationCopy,
        automation: expectedAuto,
      });
      expect(setModalState).toHaveBeenCalledWith({ tricksterBlessingModal: null });
    });

    it('shows toggled-OFF copy and skips the log when the buff was already active, still clearing the modal', async () => {
      toggleBuff.mockReturnValue({ wasActive: true });
      const { handlers, setPopupHtml, setModalState } = mount(blessingModal({ name: 'Blessing of the Trickster', automation: auto }));

      await handlers.handleTricksterBlessingConfirm('Ally1');

      expect(toggleBuff).toHaveBeenCalledWith('Ally1', 'Blessing of the Trickster', auto, CAMPAIGN, 'Ally1');
      expect(addEntry).not.toHaveBeenCalled();
      expect(setPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Blessing of the Trickster',
        automationType: 'buff',
        description: 'Blessing of the Trickster toggled OFF',
        automation: auto,
      });
      expect(setModalState).toHaveBeenCalledWith({ tricksterBlessingModal: null });
    });
  });
});
