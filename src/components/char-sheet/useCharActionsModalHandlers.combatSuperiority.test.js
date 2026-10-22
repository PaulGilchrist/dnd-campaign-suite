// @maintained-by-ai
// Routing-seam lane: combat-superiority maneuver-choice modal confirms in useCharActionsModalHandlers.
// Pins arg-gate refusals (isolated falsy legs), byte-exact dispatch payloads + arity to the
// combatSuperiorityHandler execute* services, popup surfacing on result.payload only,
// logEntries flush to the campaign log on the bait-and-switch/commander-strike/rally lanes (MN-002/MN-016),
// and modalState clears.
// Handler/service internals are owned by combatSuperiorityHandler.test.js,
// combatSuperiorityChoices.test.js and combatSuperiorityUtils tests; modal UI wiring
// lives in CharActionModals.inline-choice-modals.test.jsx and
// CharActionModals.secondary-targets.test.jsx — not restated here.
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

// One row per routed maneuver-confirm handler: how to invoke it, which service it must
// dispatch to with byte-exact args, and which modalState key it must clear.
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
  },
];

describe('useCharActionsModalHandlers - combat superiority routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  // MN-002 / MN-016: maneuver grants must reach the campaign log, keyed by the
  // modalData campaignName — bait-and-switch, commander-strike and rally all
  // flush logEntries (commander-strike row added with the same-class fix: the
  // ability_use grant from combatSuperiorityUtils.js executeCommanderStrikeChoice).
  it.each([
    {
      m: MANEUVERS[1],
      entry: {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Bait and Switch',
        description: 'Bait and Switch: Orc gains +7 AC until the start of TestChar\'s next turn.',
      },
    },
    {
      m: MANEUVERS[2],
      entry: {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Commander Strike',
        description: 'Commander Strike: Ally1 will add 12 to their next attack\'s damage roll.',
      },
    },
    {
      m: MANEUVERS[3],
      entry: {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Rally',
        description: 'Rally: HexWarlock gains 16 temporary hit points.',
        d10Roll: 7,
      },
    },
  ])('$m.name confirm flushes logEntries to the campaign log', async ({ m, entry }) => {
    m.service.mockResolvedValue({ payload: '<p>Applied</p>', logEntries: [entry] });
    const { handlers, setPopupHtml, setModalState } = mount();
    const data = m.data(m.target);
    await m.invoke(handlers, m.target, data);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, entry);
    // Exact flush count: one entry in, one addEntry out — no duplicates.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(setPopupHtml).toHaveBeenCalledWith('<p>Applied</p>');
    expect(setModalState).toHaveBeenCalledWith({ [m.clearKey]: null });
  });
});
