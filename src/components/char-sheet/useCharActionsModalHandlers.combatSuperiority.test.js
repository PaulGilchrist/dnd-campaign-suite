// @maintained-by-ai 2026-11-28
// Routing-seam lane: combat-superiority maneuver-choice modal confirms in useCharActionsModalHandlers.
// Pins arg-gate refusals (both falsy clauses, all four handlers), byte-exact dispatch payloads +
// arity to the combatSuperiorityHandler execute* services, popup surfacing on result.payload only,
// logEntries flush semantics on the payload-present branch (MN-002/MN-016): bait-and-switch,
// commander-strike and rally forward every entry once, keyed by modalData.campaignName; sweeping
// attack is the one route with NO flush branch and must stay silent even when the service returns
// logEntries. Modal clears happen unconditionally after dispatch.
// Handler/service internals (real grant-entry wording) are owned by combatSuperiorityHandler.test.js,
// combatSuperiorityChoices.test.js and combatSuperiorityUtils tests; modal UI wiring
// lives in CharActionModals.inline-choice-modals.test.jsx and
// CharActionModals.secondary-targets.test.jsx — not restated here. The 27-key return contract is
// pinned in useCharActionsModalHandlers.test.js.
// Mocks: only the routed execute* services + logService are replaced; every other import
// in the hook's graph loads for real (buffToggle/tempHp/useRuntimeState are never invoked
// by these four handlers). Mock keys kept to everything automation/index.js destructures
// from combatSuperiorityHandler in the live graph (#318).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsModalHandlers from './useCharActionsModalHandlers.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeSweepingAttack: vi.fn(),
  executeBaitAndSwitchChoice: vi.fn(),
  executeCommanderStrikeChoice: vi.fn(),
  executeRallyChoice: vi.fn(),
  // destructured by services/automation/index.js in the live graph (#318)
  handle: vi.fn(),
  handleCombatSuperiorityBonusAction: vi.fn(),
  handleCombatSuperiorityReaction: vi.fn(),
  handleCombatSuperiorityGrantAttack: vi.fn(),
  handleCombatSuperiorityMovement: vi.fn(),
  handleCombatSuperioritySkillCheck: vi.fn(),
  handleCombatSuperiorityCommandingPresenceReaction: vi.fn(),
  handleCombatSuperioritySweepingAttack: vi.fn(),
  handleAttackRiderPrompt: vi.fn(),
  handleSkillCheckPrompt: vi.fn(),
}));

const { addEntry } = await import('../../services/ui/logService.js');
const {
  executeSweepingAttack,
  executeBaitAndSwitchChoice,
  executeCommanderStrikeChoice,
  executeRallyChoice,
} = await import('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js');

const CAMPAIGN = 'test-campaign';

// The hook is a plain closure factory (zero React hooks) — safe to call directly.
function mount() {
  const setPopupHtml = vi.fn();
  const setModalState = vi.fn();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handlers = useCharActionsModalHandlers({
    setPopupHtml,
    setModalState,
    modalState: {},
    mergedModalState: {},
  });
  return { handlers, setPopupHtml, setModalState };
}

function stats() {
  return { name: 'TestChar', class: { name: 'Fighter' } };
}

// Minimal pass-through log entry: the handler must forward it verbatim; the real
// grant wording inside these entries is owned by the service-side tests.
const grantEntry = (abilityName) => ({
  type: 'ability_use',
  characterName: 'TestChar',
  abilityName,
});

// One row per routed maneuver-confirm handler: how to invoke it, which service it must
// dispatch to with byte-exact args, which modalState key it must clear, and its flush
// contract on the payload-present branch (entries forwarded -> addEntry legs expected).
const MANEUVERS = [
  {
    name: 'Sweeping Attack',
    target: 'Goblin',
    invoke: (h, target, data) => h.handleSweepingAttackConfirm(target, data),
    service: executeSweepingAttack,
    data: () => ({ playerStats: stats(), campaignName: CAMPAIGN }),
    expectedCall: (data, target) => [
      { automation: { secondaryTargetName: target } },
      data.playerStats,
      CAMPAIGN,
      target,
    ],
    clearKey: 'sweepingAttackTargetModal',
    // This route has no logEntries flush branch — silence even when entries arrive.
    logEntries: [grantEntry('Sweeping Attack')],
    expectedFlush: [],
  },
  {
    name: 'Bait and Switch',
    target: 'Orc',
    invoke: (h, target, data) => h.handleBaitAndSwitchChoiceConfirm(target, data),
    service: executeBaitAndSwitchChoice,
    data: () => ({ playerStats: stats(), campaignName: CAMPAIGN, dieValue: 15, maneuverName: 'Trip' }),
    expectedCall: (data, target) => [
      { dieValue: 15, maneuverName: 'Trip' },
      data.playerStats,
      CAMPAIGN,
      target,
    ],
    clearKey: 'baitAndSwitchChoiceModal',
    logEntries: [grantEntry('Bait and Switch')],
    expectedFlush: [grantEntry('Bait and Switch')],
  },
  {
    name: 'Commander Strike',
    target: 'Ally1',
    invoke: (h, target, data) => h.handleCommanderStrikeChoiceConfirm(target, data),
    service: executeCommanderStrikeChoice,
    data: () => ({ playerStats: stats(), campaignName: CAMPAIGN, dieValue: 12, maneuverName: 'Commander Strike' }),
    expectedCall: (data, target) => [
      { dieValue: 12, maneuverName: 'Commander Strike' },
      data.playerStats,
      CAMPAIGN,
      target,
    ],
    clearKey: 'commanderStrikeChoiceModal',
    logEntries: [grantEntry('Commander Strike')],
    expectedFlush: [grantEntry('Commander Strike')],
  },
  {
    name: 'Rally',
    target: 'Ally2',
    invoke: (h, target, data) => h.handleRallyChoiceConfirm(target, data),
    service: executeRallyChoice,
    data: () => ({
      playerStats: stats(),
      campaignName: CAMPAIGN,
      dieValue: 10,
      maneuverName: 'Rally the Brave',
      totalHp: 20,
      extraHp: 5,
      description: 'Rally description',
    }),
    expectedCall: (data, target) => [{
      action: { dieValue: 10, maneuverName: 'Rally the Brave' },
      playerStats: data.playerStats,
      campaignName: CAMPAIGN,
      chosenName: target,
      totalHp: 20,
      extraHp: 5,
      description: 'Rally description',
    }],
    clearKey: 'rallyChoiceModal',
    // Two entries: pins forEach multiplicity — one addEntry per entry, none dropped/duplicated.
    logEntries: [grantEntry('Rally'), grantEntry('Bonus Feat')],
    expectedFlush: [grantEntry('Rally'), grantEntry('Bonus Feat')],
  },
];

describe('useCharActionsModalHandlers - combat superiority routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Gate: `if (!targetName || !modalData) return;` in all four handlers.
  it.each(
    MANEUVERS.flatMap(m => [
      { desc: `${m.name}: empty target`, m, target: '', data: m.data() },
      { desc: `${m.name}: null modalData`, m, target: m.target, data: null },
    ])
  )('refuses without side effects — $desc', async ({ m, target, data }) => {
    const { handlers, setPopupHtml, setModalState } = mount();
    await m.invoke(handlers, target, data);
    expect(m.service).not.toHaveBeenCalled();
    expect(setPopupHtml).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setModalState).not.toHaveBeenCalled();
  });

  it.each(MANEUVERS.map(m => [m]))(
    '$name confirm dispatches exact service payload, surfaces popup, clears modal',
    async (m) => {
      m.service.mockResolvedValue({ payload: `<p>${m.name}!</p>` });
      const { handlers, setPopupHtml, setModalState } = mount();
      const data = m.data(m.target);
      await m.invoke(handlers, m.target, data);
      expect(m.service).toHaveBeenCalledTimes(1);
      expect(m.service).toHaveBeenCalledWith(...m.expectedCall(data, m.target));
      expect(setPopupHtml).toHaveBeenCalledWith(`<p>${m.name}!</p>`);
      expect(setModalState).toHaveBeenCalledWith({ [m.clearKey]: null });
    }
  );

  // False branch of `if (result.payload)`: no popup, no log, but the clear is unconditional.
  it.each(MANEUVERS.map(m => [m]))(
    '$name confirm with no payload logs nothing but still clears the modal',
    async (m) => {
      m.service.mockResolvedValue({});
      const { handlers, setPopupHtml, setModalState } = mount();
      const data = m.data(m.target);
      await m.invoke(handlers, m.target, data);
      expect(m.service).toHaveBeenCalledTimes(1);
      expect(setPopupHtml).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(setModalState).toHaveBeenCalledWith({ [m.clearKey]: null });
    }
  );

  // MN-002 / MN-016 flush lane on the payload-present branch. Entries are forwarded verbatim,
  // exactly once each, keyed by the modalData campaignName. The sweeping row pins the route's
  // missing flush branch; popup + clear are already pinned by the dispatch lane above.
  it.each(MANEUVERS.map(m => [m]))(
    '$name confirm forwards each logEntries item once to addEntry(campaignName, entry)',
    async (m) => {
      m.service.mockResolvedValue({ payload: '<p>Applied</p>', logEntries: m.logEntries });
      const { handlers } = mount();
      const data = m.data(m.target);
      await m.invoke(handlers, m.target, data);
      expect(addEntry).toHaveBeenCalledTimes(m.expectedFlush.length);
      for (const entry of m.expectedFlush) {
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, entry);
      }
    }
  );
});
