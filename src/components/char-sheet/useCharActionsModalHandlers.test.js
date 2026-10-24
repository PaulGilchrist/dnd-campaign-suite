// @maintained-by-ai
// Base lane for useCharActionsModalHandlers: the exact 27-key return contract
// consumed by CharActionModals' destructure, plus the only three confirm routings
// no family lane owns (verified by grep 2026-10-17): bulwarkOfForce,
// zealousPresence, psychicWhispers. All other handler routings are owned by the
// six routing-seam lanes: useCharActionsModalHandlers.{areaEffects,buffs,
// combatSuperiority,healing,inspiration,oceanicGift}.test.js.
// Dead-mock purge (#343/#344): bardicInspiration/reactionBonus/oceanicGift and
// every other service mock is never invoked by these tests and is removed; only
// modules whose exports the surviving tests observe are mocked, each carrying the
// keys the live import graph destructures (handle destructured by
// services/automation/index.js per #318 — runtime-probed by sibling lanes;
// removing it fails import with "No handle export"). Everything else loads for
// real — side-effect-free at import, verified by the sibling buffs lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js', () => ({
  handle: vi.fn(), // mandatory at module load (#318)
  activateBulwarkOfForce: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-barbarian/zealousPresenceHandler.js', () => ({
  handle: vi.fn(), // mandatory at module load (#318)
  confirmZealousPresence: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/buffHandler.js', () => ({
  handle: vi.fn(), // mandatory at module load (#318; also real importee celestialRevelationHandler.js)
  confirmPsychicWhispers: vi.fn(),
  confirmTelepathicSpeech: vi.fn(), // destructured by useCharActionsAutomation.js in the live graph
}));

const { activateBulwarkOfForce } = await import('../../services/automation/handlers/class-sorcerer/bulwarkOfForceHandler.js');
const { confirmZealousPresence } = await import('../../services/automation/handlers/class-barbarian/zealousPresenceHandler.js');
const { confirmPsychicWhispers } = await import('../../services/automation/handlers/buffs/buffHandler.js');

const CAMPAIGN = 'test-campaign';

function stats() {
  return { name: 'TestChar', class: { name: 'Sorcerer' } };
}

function mount(modalState = {}, mergedModalState = {}) {
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

// The full public contract: if CharActionModals destructures a key that
// disappears here, every consumer breaks — pin the exact key set.
const EXPECTED_KEYS = [
  'handleBaitAndSwitchChoiceConfirm',
  'handleBardicInspirationConfirm',
  'handleBulwarkOfForceConfirm',
  'handleCelestialResilienceConfirm',
  'handleCelestialResilienceSkip',
  'handleClockworkCavalcadeDispelConfirm',
  'handleClockworkCavalcadeHealConfirm',
  'handleClockworkCavalcadeRepairConfirm',
  'handleCommanderStrikeChoiceConfirm',
  'handleCoronaEnemySelectionConfirm',
  'handleInspiringMovementConfirm',
  'handleInspiringSmiteConfirm',
  'handleMantleOfInspirationConfirm',
  'handleMassCureWoundsConfirm',
  'handleMassHealConfirm',
  'handleMassHealingWordConfirm',
  'handleNaturesSanctuaryConfirm',
  'handleOceanicGiftConfirm',
  'handlePowerWordFortifyConfirm',
  'handlePrayerOfHealingConfirm',
  'handlePsychicWhispersConfirm',
  'handleRadianceOfDawnConfirm',
  'handleRallyChoiceConfirm',
  'handleSweepingAttackConfirm',
  'handleTricksterBlessingConfirm',
  'handleVitalityOfTheTreeConfirm',
  'handleZealousPresenceConfirm',
];

// Rows for the three confirm routes no family lane covers. All three share
// the positional seam (action, playerStats, campaignName, targetNames) read
// from modalState (not mergedModalState) and the payload-only popup + clear.
const UNOWNED_ROUTES = [
  {
    name: 'Bulwark of Force',
    handler: 'handleBulwarkOfForceConfirm',
    modalKey: 'bulwarkOfForceModal',
    service: activateBulwarkOfForce,
    arg: ['Goblin1', 'Goblin2'],
  },
  {
    name: 'Zealous Presence',
    handler: 'handleZealousPresenceConfirm',
    modalKey: 'zealousPresenceModal',
    service: confirmZealousPresence,
    arg: ['Ally1', 'Ally2'],
  },
  {
    name: 'Psychic Whispers',
    handler: 'handlePsychicWhispersConfirm',
    modalKey: 'psychicWhispersModal',
    service: confirmPsychicWhispers,
    arg: ['Victim1'],
  },
];

const modalData = (route) => ({
  action: { name: route.name },
  playerStats: stats(),
  campaignName: CAMPAIGN,
});
const openModal = (route) => ({ [route.modalKey]: modalData(route) });

describe('useCharActionsModalHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exactly the 27 named handler keys', () => {
    const { handlers } = mount();
    expect(Object.keys(handlers).sort()).toEqual(EXPECTED_KEYS);
    // typeof-only loop cut (#245 sharpen): callable behavior of every key is
    // call-pinned — the 3 unowned routes are invoked with asserted passthrough
    // in the it.each directly below, the other 24 across the six family lanes.
  });

  it.each(UNOWNED_ROUTES.map(route => ({ desc: `${route.name} confirm`, route })))(
    '$desc: exact positional service passthrough, payload-only popup, modal cleared',
    async ({ route }) => {
      const data = modalData(route);
      const { handlers, setPopupHtml, setModalState } = mount(openModal(route));
      route.service.mockResolvedValue({ payload: '<b>done</b>' });

      await handlers[route.handler](route.arg);

      expect(route.service).toHaveBeenCalledTimes(1);
      expect(route.service).toHaveBeenCalledWith(data.action, data.playerStats, CAMPAIGN, route.arg);
      expect(setPopupHtml).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).toHaveBeenCalledWith('<b>done</b>');
      expect(setModalState).toHaveBeenCalledTimes(1);
      expect(setModalState).toHaveBeenCalledWith({ [route.modalKey]: null });

      // payload-less result: service still runs, popup stays silent, modal closes
      vi.clearAllMocks();
      route.service.mockResolvedValue({});
      const second = mount(openModal(route));
      await second.handlers[route.handler](route.arg);
      expect(route.service).toHaveBeenCalledTimes(1);
      expect(second.setPopupHtml).not.toHaveBeenCalled();
      expect(second.setModalState).toHaveBeenCalledWith({ [route.modalKey]: null });
    }
  );

  it.each(UNOWNED_ROUTES.flatMap(route => [
    { desc: `${route.name}: no targets selected`, route, modalState: openModal(route), arg: undefined },
    { desc: `${route.name}: modal not open`, route, modalState: {}, arg: route.arg },
  ]))(
    '$desc — refuses: no service call, no popup, no modal clear',
    async ({ route, modalState, arg }) => {
      const { handlers, setPopupHtml, setModalState } = mount(modalState);

      await handlers[route.handler](arg);

      expect(route.service).not.toHaveBeenCalled();
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).not.toHaveBeenCalled();
    }
  );
});
