// @maintained-by-ai
// Routing-seam lane: AOE/area-effect modal confirms in useCharActionsModalHandlers.
// Pins gate refusals, exact service-call payloads (including mapName arity for
// Nature's Sanctuary), setPopupHtml on result.payload only, and modalState clears.
// Service internals live in naturesSanctuaryHandler.test.js / coronaOfLightHandler.test.js /
// radianceOfDawnHandler.test.js; modal UI wiring lives in the CharActionModals suites.
// Only the three routed services are mocked; every other import in the hook's graph loads
// for real (verified side-effect-free at import) and is not exercised by these handlers.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/handlers/class-ranger/naturesSanctuaryHandler.js', () => ({
  activateNaturesSanctuary: vi.fn(),
  moveNaturesSanctuary: vi.fn(),
  // handle/handleMove destructured by services/automation/index.js in the live graph (#318)
  handle: vi.fn(),
  handleMove: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js', () => ({
  activateCoronaOfLight: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js', () => ({
  confirmRadianceOfDawn: vi.fn(),
  // handle destructured by services/automation/index.js in the live graph (#318)
  handle: vi.fn(),
}));

const { activateNaturesSanctuary, moveNaturesSanctuary } = await import('../../services/automation/handlers/class-ranger/naturesSanctuaryHandler.js');
const { activateCoronaOfLight } = await import('../../services/automation/handlers/class-cleric-paladin/coronaOfLightHandler.js');
const { confirmRadianceOfDawn } = await import('../../services/automation/handlers/class-cleric-paladin/radianceOfDawnHandler.js');

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

function sanctuaryModalData(isMove) {
  return {
    action: { name: "Nature's Sanctuary" },
    playerStats: { name: 'TestChar', class: { name: 'Ranger' } },
    campaignName: CAMPAIGN,
    isMove,
  };
}

function coronaModalData() {
  return {
    action: { name: 'Corona of Light' },
    playerStats: { name: 'TestChar', class: { name: 'Cleric' } },
    campaignName: CAMPAIGN,
  };
}

function radianceModalData() {
  return {
    action: { name: 'Radiance of Dawn' },
    playerStats: { name: 'TestChar', class: { name: 'Cleric' } },
    campaignName: CAMPAIGN,
  };
}

describe('useCharActionsModalHandlers - area effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleNaturesSanctuaryConfirm', () => {
    it.each([
      { name: 'targetNames is null', targetNames: null, modalOpen: true },
      { name: 'targetNames is undefined', targetNames: undefined, modalOpen: true },
      { name: 'modal is not open', targetNames: ['Ally1'], modalOpen: false },
    ])('refuses without touching services, popup, or modalState when $name', async ({ targetNames, modalOpen }) => {
      const modalState = modalOpen
        ? { naturesSanctuaryCreaturesModal: sanctuaryModalData(false) }
        : {};
      const { handlers, setPopupHtml, setModalState } = mount(modalState);

      await handlers.handleNaturesSanctuaryConfirm(targetNames, 'Forest Map');

      expect(activateNaturesSanctuary).not.toHaveBeenCalled();
      expect(moveNaturesSanctuary).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it.each([
      { isMove: true },
      { isMove: false },
      { isMove: undefined },
    ])('routes isMove=$isMove to the matching service with modal-data args, pops the payload, clears the modal', async ({ isMove }) => {
      const targets = ['Ally1', 'Ally2'];
      const popup = isMove
        ? '<p>Sanctuary moved to Forest Map</p>'
        : '<p>Sanctuary activated on Forest Map</p>';
      if (isMove) {
        moveNaturesSanctuary.mockResolvedValue({ payload: popup });
      } else {
        activateNaturesSanctuary.mockResolvedValue({ payload: popup });
      }
      const { handlers, setPopupHtml, setModalState } = mount({
        naturesSanctuaryCreaturesModal: sanctuaryModalData(isMove),
      });

      await handlers.handleNaturesSanctuaryConfirm(targets, 'Forest Map');

      if (isMove) {
        // move lane takes 4 args — mapName must NOT leak into it
        expect(moveNaturesSanctuary).toHaveBeenCalledWith(
          { name: "Nature's Sanctuary" },
          { name: 'TestChar', class: { name: 'Ranger' } },
          CAMPAIGN,
          ['Ally1', 'Ally2']
        );
        expect(activateNaturesSanctuary).not.toHaveBeenCalled();
      } else {
        // activate lane takes 5 args — mapName is positional here
        expect(activateNaturesSanctuary).toHaveBeenCalledWith(
          { name: "Nature's Sanctuary" },
          { name: 'TestChar', class: { name: 'Ranger' } },
          CAMPAIGN,
          'Forest Map',
          ['Ally1', 'Ally2']
        );
        expect(moveNaturesSanctuary).not.toHaveBeenCalled();
      }
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      // Post-branch guard shared by both lanes (positive leg pinned in routing table above)
      activateNaturesSanctuary.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        naturesSanctuaryCreaturesModal: sanctuaryModalData(false),
      });

      await handlers.handleNaturesSanctuaryConfirm(['Ally1'], 'Forest Map');

      expect(activateNaturesSanctuary).toHaveBeenCalledWith(
        { name: "Nature's Sanctuary" },
        { name: 'TestChar', class: { name: 'Ranger' } },
        CAMPAIGN,
        'Forest Map',
        ['Ally1']
      );
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ naturesSanctuaryCreaturesModal: null });
    });
  });

  describe('handleCoronaEnemySelectionConfirm', () => {
    it.each([
      { name: 'selectedEnemies is null', selected: null, modalOpen: true },
      { name: 'selectedEnemies is undefined', selected: undefined, modalOpen: true },
      { name: 'modal is not open', selected: ['Enemy1'], modalOpen: false },
    ])('refuses without touching service, popup, or modalState when $name', async ({ selected, modalOpen }) => {
      const modalState = modalOpen ? { coronaEnemySelectionModal: coronaModalData() } : {};
      const { handlers, setPopupHtml, setModalState } = mount(modalState);

      await handlers.handleCoronaEnemySelectionConfirm(selected);

      expect(activateCoronaOfLight).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('calls activateCoronaOfLight with modal data and selections, pops the payload, clears the modal', async () => {
      const popup = '<p>Corona of Light marked 2 enemies</p>';
      activateCoronaOfLight.mockResolvedValue({ payload: popup });
      const { handlers, setPopupHtml, setModalState } = mount({
        coronaEnemySelectionModal: coronaModalData(),
      });

      await handlers.handleCoronaEnemySelectionConfirm(['Enemy1', 'Enemy2']);

      expect(activateCoronaOfLight).toHaveBeenCalledWith(
        { name: 'Corona of Light' },
        { name: 'TestChar', class: { name: 'Cleric' } },
        CAMPAIGN,
        ['Enemy1', 'Enemy2']
      );
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ coronaEnemySelectionModal: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      activateCoronaOfLight.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        coronaEnemySelectionModal: coronaModalData(),
      });

      await handlers.handleCoronaEnemySelectionConfirm(['Enemy1']);

      expect(activateCoronaOfLight).toHaveBeenCalledWith(
        { name: 'Corona of Light' },
        { name: 'TestChar', class: { name: 'Cleric' } },
        CAMPAIGN,
        ['Enemy1']
      );
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ coronaEnemySelectionModal: null });
    });
  });

  describe('handleRadianceOfDawnConfirm', () => {
    it.each([
      { name: 'selectedTargets is null', selected: null, modalOpen: true },
      { name: 'selectedTargets is undefined', selected: undefined, modalOpen: true },
      { name: 'modal is not open', selected: ['Ally1'], modalOpen: false },
    ])('refuses without touching service, popup, or modalState when $name', async ({ selected, modalOpen }) => {
      const modalState = modalOpen ? { radianceOfDawnModal: radianceModalData() } : {};
      const { handlers, setPopupHtml, setModalState } = mount(modalState);

      await handlers.handleRadianceOfDawnConfirm(selected);

      expect(confirmRadianceOfDawn).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    });

    it('calls confirmRadianceOfDawn with modal data and selections, pops the payload, clears the modal', async () => {
      const popup = '<p>Radiance of Dawn seared 2 targets</p>';
      confirmRadianceOfDawn.mockResolvedValue({ payload: popup });
      const { handlers, setPopupHtml, setModalState } = mount({
        radianceOfDawnModal: radianceModalData(),
      });

      await handlers.handleRadianceOfDawnConfirm(['Ally1', 'Enemy1']);

      expect(confirmRadianceOfDawn).toHaveBeenCalledWith(
        { name: 'Radiance of Dawn' },
        { name: 'TestChar', class: { name: 'Cleric' } },
        CAMPAIGN,
        ['Ally1', 'Enemy1']
      );
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ radianceOfDawnModal: null });
    });

    it('clears the modal without a popup when the service returns no payload', async () => {
      confirmRadianceOfDawn.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount({
        radianceOfDawnModal: radianceModalData(),
      });

      await handlers.handleRadianceOfDawnConfirm(['Ally1']);

      expect(confirmRadianceOfDawn).toHaveBeenCalledWith(
        { name: 'Radiance of Dawn' },
        { name: 'TestChar', class: { name: 'Cleric' } },
        CAMPAIGN,
        ['Ally1']
      );
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ radianceOfDawnModal: null });
    });
  });
});
