// @maintained-by-ai
// Routing-seam lane: healing/distribution modal confirms in useCharActionsModalHandlers.
// Pins gate refusals on isolated legs (falsy arg WITH the modal open vs modal present
// only in the WRONG store — never modalState={} vacuity), byte-exact dispatch payloads
// and arity to each routed healing service (object payload vs positional args, real
// campaignName forwarded, maxTargets-style extra keys never leaking), setPopupHtml on
// result.payload only, and per-handler modalState clears.
// Service internals are owned by massHealHandler.test.js and the healing/ suites; modal
// UI wiring lives in the CharActionModals suites — not restated here.
// Mocks purged to the six routed handler modules: buffToggle/tempHpService/
// useRuntimeState/logService and every non-healing handler in the hook's graph load for
// real and are never invoked by these eight handlers (sibling areaEffects/buffs lanes
// exercise the same real graph and verify it side-effect-free at import).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/automation/handlers/healing/massHealHandler.js', () => ({
  confirmMassHeal: vi.fn(),
  // handle destructured by services/automation/index.js in the live graph (#318;
  // runtime-probed: removing it fails this suite's import with "No handle export")
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/clockworkCavalcadeHandler.js', () => ({
  confirmClockworkCavalcadeHeal: vi.fn(),
  confirmClockworkCavalcadeDispel: vi.fn(),
  confirmClockworkCavalcadeRepair: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/massCureWoundsHandler.js', () => ({
  confirmMassCureWounds: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/prayerOfHealingHandler.js', () => ({
  confirmPrayerOfHealing: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/powerWordFortifyHandler.js', () => ({
  confirmPowerWordFortify: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('../../services/automation/handlers/healing/massHealingWordHandler.js', () => ({
  confirmMassHealingWord: vi.fn(),
  handle: vi.fn(),
}));

const { confirmMassHeal } = await import('../../services/automation/handlers/healing/massHealHandler.js');
const {
  confirmClockworkCavalcadeHeal,
  confirmClockworkCavalcadeDispel,
  confirmClockworkCavalcadeRepair,
} = await import('../../services/automation/handlers/class-sorcerer/clockworkCavalcadeHandler.js');
const { confirmMassCureWounds } = await import('../../services/automation/handlers/healing/massCureWoundsHandler.js');
const { confirmPrayerOfHealing } = await import('../../services/automation/handlers/healing/prayerOfHealingHandler.js');
const { confirmPowerWordFortify } = await import('../../services/automation/handlers/buffs/powerWordFortifyHandler.js');
const { confirmMassHealingWord } = await import('../../services/automation/handlers/healing/massHealingWordHandler.js');

const CAMPAIGN = 'test-campaign';

function stats() {
  return { name: 'TestChar', class: { name: 'Cleric' } };
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

// One row per routed healing-confirm handler: which store the gate reads, the modal key
// it must clear, and the byte-exact service dispatch (args array — object payload vs
// positional, arity pinned by length; distinct values catch key swaps).
// `noArgGate` routes (Repair) guard on the modal alone.
const ROUTES = [
  {
    name: 'Mass Heal',
    service: confirmMassHeal,
    store: 'modalState',
    modalKey: 'massHealModal',
    arg: { Ally1: 20, Ally2: 30 },
    data: () => ({
      action: { name: 'Mass Heal' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      totalPool: 50,
      bonusHeal: 7,
      bonusDetails: 'empowered',
    }),
    invoke: (h, arg) => h.handleMassHealConfirm(arg),
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      distribution: arg,
      totalPool: 50,
      bonusHeal: 7,
      bonusDetails: 'empowered',
    }],
  },
  {
    name: 'Clockwork Cavalcade Heal',
    service: confirmClockworkCavalcadeHeal,
    store: 'mergedModalState',
    modalKey: 'clockworkCavalcadeHealModal',
    arg: { Ally1: 12, Ally2: 18 },
    data: () => ({
      action: { name: 'Clockwork Cavalcade' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      maxHeal: 30,
    }),
    invoke: (h, arg) => h.handleClockworkCavalcadeHealConfirm(arg),
    // positional arity — 5 args, maxHeal last, not an object payload
    expected: (d, arg) => [d.action, d.playerStats, CAMPAIGN, arg, 30],
  },
  {
    name: 'Clockwork Cavalcade Dispel',
    service: confirmClockworkCavalcadeDispel,
    store: 'mergedModalState',
    modalKey: 'clockworkCavalcadeDispelModal',
    arg: ['Enemy1', 'Enemy2'],
    data: () => ({
      action: { name: 'Clockwork Cavalcade' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
    }),
    invoke: (h, arg) => h.handleClockworkCavalcadeDispelConfirm(arg),
    expected: (d, arg) => [d.action, d.playerStats, CAMPAIGN, arg],
  },
  {
    name: 'Clockwork Cavalcade Repair',
    service: confirmClockworkCavalcadeRepair,
    store: 'mergedModalState',
    modalKey: 'clockworkCavalcadeRepairModal',
    noArgGate: true,
    data: () => ({
      action: { name: 'Clockwork Cavalcade' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
    }),
    invoke: (h) => h.handleClockworkCavalcadeRepairConfirm(),
    // repair lane takes 3 args — no targets list
    expected: (d) => [d.action, d.playerStats, CAMPAIGN],
  },
  {
    name: 'Mass Cure Wounds',
    service: confirmMassCureWounds,
    store: 'mergedModalState',
    modalKey: 'massCureWoundsModal',
    arg: ['Ally1', 'Ally2'],
    data: () => ({
      action: { name: 'Mass Cure Wounds' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      healExpression: '3d8',
      maximize: false,
      bonusHeal: 5,
      bonusDetails: 'blessed',
      slotLevel: 5,
      maxTargets: 3,
    }),
    invoke: (h, arg) => h.handleMassCureWoundsConfirm(arg),
    // maxTargets lives in modalData but must NOT leak to the service
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      selectedTargetNames: arg,
      healExpression: '3d8',
      maximize: false,
      bonusHeal: 5,
      bonusDetails: 'blessed',
      slotLevel: 5,
    }],
  },
  {
    name: 'Prayer of Healing',
    service: confirmPrayerOfHealing,
    store: 'mergedModalState',
    modalKey: 'prayerOfHealingModal',
    arg: ['Ally1'],
    data: () => ({
      action: { name: 'Prayer of Healing' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      healExpression: '2d4',
      maximize: true,
      bonusHeal: 3,
      bonusDetails: 'aura',
      slotLevel: 2,
      currentRound: 5,
    }),
    invoke: (h, arg) => h.handlePrayerOfHealingConfirm(arg),
    // currentRound must be forwarded (round-scoped heal pool)
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      selectedTargetNames: arg,
      healExpression: '2d4',
      maximize: true,
      bonusHeal: 3,
      bonusDetails: 'aura',
      slotLevel: 2,
      currentRound: 5,
    }],
  },
  {
    name: 'Power Word Fortify',
    service: confirmPowerWordFortify,
    store: 'mergedModalState',
    modalKey: 'powerWordFortifyModal',
    arg: { Ally1: 10, Ally2: 8 },
    data: () => ({
      action: { name: 'Power Word Fortify' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      totalTempHp: 20,
      tempHpExpression: '2d10',
    }),
    invoke: (h, arg) => h.handlePowerWordFortifyConfirm(arg),
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      distribution: arg,
      totalTempHp: 20,
      tempHpExpression: '2d10',
    }],
  },
  {
    name: 'Mass Healing Word',
    service: confirmMassHealingWord,
    store: 'mergedModalState',
    modalKey: 'massHealingWordModal',
    arg: ['Ally1', 'Ally2', 'Ally3'],
    data: () => ({
      action: { name: 'Mass Healing Word' },
      playerStats: stats(),
      campaignName: CAMPAIGN,
      healExpression: '2d4',
      maximize: false,
      bonusHeal: 3,
      bonusDetails: 'bonus',
      slotLevel: 3,
    }),
    invoke: (h, arg) => h.handleMassHealingWordConfirm(arg),
    expected: (d, arg) => [{
      action: d.action,
      playerStats: d.playerStats,
      campaignName: CAMPAIGN,
      selectedTargetNames: arg,
      healExpression: '2d4',
      maximize: false,
      bonusHeal: 3,
      bonusDetails: 'bonus',
      slotLevel: 3,
    }],
  },
];

const openModal = (route) => ({ [route.modalKey]: route.data() });
// Place a modal payload in the store the handler owns, or (wrongStore) the other one.
const place = (route, owned, foreign = {}) =>
  route.store === 'modalState' ? [owned, foreign] : [foreign, owned];

describe('useCharActionsModalHandlers - healing routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    // falsy arg WITH the modal open — isolates the arg gate
    ...ROUTES.filter(r => !r.noArgGate).map(r => ({
      desc: `${r.name}: null confirm arg, modal open`,
      route: r,
      arg: null,
    })),
    // modal open but only in the WRONG store — pins which store each gate reads
    ...ROUTES.map(r => ({
      desc: `${r.name}: modal only in ${r.store === 'modalState' ? 'mergedModalState' : 'modalState'}`,
      route: r,
      arg: r.noArgGate ? undefined : r.arg,
      wrongStore: true,
    })),
  ])('refuses without side effects — $desc', async ({ route, arg, wrongStore }) => {
    const modal = openModal(route);
    const [modalState, mergedModalState] = wrongStore
      ? place(route, {}, modal)
      : place(route, modal);
    const { handlers, setPopupHtml, setModalState } = mount(modalState, mergedModalState);

    await route.invoke(handlers, arg);

    expect(route.service).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(setModalState).not.toHaveBeenCalled();
  });

  it.each(ROUTES.map(r => ({
    desc: `${r.name} confirm`,
    route: r,
    popup: `<p>${r.name}!</p>`,
  })))(
    '$desc dispatches the byte-exact service payload, pops the popup, clears the modal',
    async ({ route, popup }) => {
      route.service.mockResolvedValue({ payload: popup });
      const modal = openModal(route);
      const [modalState, mergedModalState] = place(route, modal);
      const { handlers, setPopupHtml, setModalState } = mount(modalState, mergedModalState);

      await route.invoke(handlers, route.arg);

      expect(route.service).toHaveBeenCalledTimes(1);
      expect(route.service).toHaveBeenCalledWith(...route.expected(modal[route.modalKey], route.arg));
      expect(setPopupHtml).toHaveBeenCalledWith(popup);
      expect(setModalState).toHaveBeenCalledWith({ [route.modalKey]: null });
    }
  );

  // popup is the ONLY thing gated on result.payload — service dispatch and modal
  // clear still happen when the service returns nothing to show.
  it.each(ROUTES.map(r => ({ desc: `${r.name} confirm`, route: r })))(
    '$desc with no payload still dispatches and clears the modal without popping',
    async ({ route }) => {
      route.service.mockResolvedValue({});
      const modal = openModal(route);
      const [modalState, mergedModalState] = place(route, modal);
      const { handlers, setPopupHtml, setModalState } = mount(modalState, mergedModalState);

      await route.invoke(handlers, route.arg);

      expect(route.service).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ [route.modalKey]: null });
    }
  );
});
