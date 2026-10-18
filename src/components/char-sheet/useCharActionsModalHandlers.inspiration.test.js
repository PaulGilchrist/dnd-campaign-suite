// @maintained-by-ai
// Routing-seam lane: inspiration ally-pick confirms in useCharActionsModalHandlers.
// Pins gate refusals on isolated legs (modal only in the WRONG store vs falsy target
// WITH the modal open — never modalState={} vacuity), byte-exact object payloads with
// arity to each routed service (creatureTargets never leaks), real campaignName
// forwarded, popup gated on result.type === 'popup' (not mere payload presence — a
// payload without the popup type and a null result must both stay silent), and that
// the modal clears BEFORE the target gate fires.
// Service internals (temp-HP/insp-marker writes) are owned by bardicInspirationHandler
// and reactionBonusHandler suites; modal UI wiring lives in the CharActionModals
// suites — not restated here.
// Mocks purged to the two routed handler modules; buffToggle/tempHpService/
// useRuntimeState/logService and every non-inspiration handler load for real and are
// never invoked by these two handlers (mirrors the healing/buffs/areaEffects lanes
// which verify the same real graph is side-effect-free at import).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/handlers/class-bard/bardicInspirationHandler.js', () => ({
  applyBardicInspiration: vi.fn(),
  // handle destructured by services/automation/index.js in the live graph (#318;
  // runtime-probed: removing it fails this suite's import with "No handle export")
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/reactions/reactionBonusHandler.js', () => ({
  applyInspiringMovement: vi.fn(),
  // handle destructured by services/automation/index.js; applyD20Modifier destructured
  // by its real importee boonOfFateHandler.js — both mandatory at module load (#318)
  handle: vi.fn(),
  applyD20Modifier: vi.fn(),
}));

const { applyBardicInspiration } = await import('../../services/automation/handlers/class-bard/bardicInspirationHandler.js');
const { applyInspiringMovement } = await import('../../services/automation/handlers/reactions/reactionBonusHandler.js');

const CAMPAIGN = 'test-campaign';

function stats() {
  return { name: 'TestChar', class: { name: 'Bard' } };
}

function mount(modalState, mergedModalState) {
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

// One row per inspiration ally-pick route: both gates read modalState (not
// mergedModalState), object payload dispatch, distinct values catch key swaps.
// creatureTargets lives in modal data but must NOT leak to the service payload.
const ROUTES = [
  {
    name: 'Bardic Inspiration',
    service: applyBardicInspiration,
    modalKey: 'bardicInspirationTargetModal',
    arg: 'Ally1',
    data: () => ({
      action: { name: 'Bardic Inspiration' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      dieSize: 'd8',
      hasCombatOptions: false,
      creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }],
    }),
    invoke: (h, arg) => h.handleBardicInspirationConfirm(arg),
    // single object payload, exact 6 keys — targetName is the picked ally
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      targetName: arg,
      dieSize: 'd8',
      hasCombatOptions: false,
    }],
  },
  {
    name: 'Inspiring Movement',
    service: applyInspiringMovement,
    modalKey: 'inspiringMovementAllyModal',
    arg: 'Ally2',
    data: () => ({
      action: { name: 'Inspiring Movement' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      halfSpeed: true,
      noOAs: false,
      creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }],
    }),
    invoke: (h, arg) => h.handleInspiringMovementConfirm(arg),
    // single object payload, exact 6 keys — allyName is the picked ally
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      allyName: arg,
      halfSpeed: true,
      noOAs: false,
    }],
  },
];

const openModal = (route) => ({ [route.modalKey]: route.data() });

describe('useCharActionsModalHandlers - inspiration routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Modal present only in the WRONG store — pins both gates read modalState, and
  // doubles as the absent-modal refusal (identical truthiness gate, no vacuity).
  it.each(ROUTES.map(r => ({ desc: `${r.name}`, route: r })))(
    '$route.name: refuses when modal is only in mergedModalState',
    async ({ route }) => {
      const { handlers, setPopupHtml, setModalState } = mount({}, openModal(route));

      await route.invoke(handlers, route.arg);

      expect(route.service).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    }
  );

  // Falsy target WITH the modal open — isolates the target gate. The modal clears
  // BEFORE the target gate: refusal must still close the modal, never dispatch.
  it.each(ROUTES.flatMap(r => [null, ''].map(target => ({
    desc: `${r.name}: target ${JSON.stringify(target)}`,
    route: r,
    target,
  }))))(
    '$desc with modal open clears the modal without dispatching',
    async ({ route, target }) => {
      const modalState = openModal(route);
      const { handlers, setPopupHtml, setModalState } = mount(modalState, {});

      await route.invoke(handlers, target);

      expect(route.service).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ [route.modalKey]: null });
    }
  );

  // Popup gate is result.type === 'popup', NOT payload presence: a payload without
  // the popup type and a null result must both stay silent. Dispatch and modal clear
  // happen in every leg.
  it.each(ROUTES.flatMap(route => [
    { desc: `${route.name}: popup result`, route, result: { type: 'popup', payload: `<p>${route.name}!</p>` }, expectPopup: true },
    { desc: `${route.name}: payload without popup type`, route, result: { payload: '<p>silent</p>' }, expectPopup: false },
    { desc: `${route.name}: null result`, route, result: null, expectPopup: false },
  ]))(
    '$desc dispatches byte-exact payload and clears the modal',
    async ({ route, result, expectPopup }) => {
      route.service.mockResolvedValue(result);
      const modalState = openModal(route);
      const { handlers, setPopupHtml, setModalState } = mount(modalState, {});

      await route.invoke(handlers, route.arg);

      expect(route.service).toHaveBeenCalledTimes(1);
      expect(route.service).toHaveBeenCalledWith(...route.expected(modalState[route.modalKey], route.arg));
      if (expectPopup) {
        expect(setPopupHtml).toHaveBeenCalledWith(result.payload);
      } else {
        expect(setPopupHtml).not.toHaveBeenCalled();
      }
      expect(setModalState).toHaveBeenCalledWith({ [route.modalKey]: null });
    }
  );
});
