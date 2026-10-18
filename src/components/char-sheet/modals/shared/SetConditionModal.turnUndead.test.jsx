// @maintained-by-ai
// Lane: Turn Undead semantics in SetConditionModal only — the featureName→turnUndead
// eligibility wiring (via this modal's dispatch of the base filter), the TU empty state,
// and the turn-undead-result event contract (exact payload, silence on all-saves, and
// waiting on pending player prompts). Non-TU render/selection/prompt payloads live in
// SetConditionModal.test.jsx; immunity denial, Channel Divinity spend, and roll/condition
// log seams live in SetConditionModal.sideEffects.test.jsx; isTurnUndeadValidTarget roster
// filtering (join-time monsterType, suffix-strip fallback, dead exclusion) lives in
// AreaEffectTargetModalBase.targets.test.jsx — not re-filtered here.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SetConditionModal from './SetConditionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(() => 60),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../../services/ui/utils.js', () => {
  const utilsMock = {
    guid: vi.fn(() => 'test-guid'),
    getAbilityLongName: vi.fn((s) => s),
    getName: vi.fn((name) => name || 'Unknown'),
  };
  return { default: utilsMock };
});

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';

// ── Test fixtures ──

const mockCombatSummary = {
  creatures: [
    { name: 'Attacker', type: 'player' },
    { name: 'Skeleton A', type: 'npc', conditions: [] },
    // Zombie B carries a lowercase-keyed save bonus: 20 + 2 beats DC 14 in the mixed-roll pin.
    { name: 'Zombie B', type: 'npc', conditions: [], saveBonuses: { wis: 2 } },
    { name: 'Player Ally', type: 'player' },
    { name: 'Goblin C', type: 'npc', conditions: [] },
  ],
};

// 'Undead' vs 'undead' — the join-time/base lookup must be case-insensitive.
const mockMonsters = [
  { name: 'Skeleton A', type: 'Undead' },
  { name: 'Zombie B', type: 'undead' },
  { name: 'Goblin C', type: 'Humanoid' },
  { name: 'Player Ally', type: 'Undead' },
];

const mockAttackerPos = { gridX: 0, gridY: 0 };

function makeProps(overrides) {
  return {
    combatSummary: mockCombatSummary,
    attackerName: 'Attacker',
    attackerPos: mockAttackerPos,
    saveDc: 14,
    campaignName: 'test-campaign',
    mapData: null,
    monsters: mockMonsters,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function getCheckboxByCreature(container, creatureName) {
  return within(container).queryAllByRole('checkbox').find(cb =>
    cb.closest('label')?.textContent.includes(creatureName)
  );
}

// Pass-through spy (see beforeEach) so dispatched events remain assertable AND heard.
function turnUndeadEvents() {
  return window.dispatchEvent.mock.calls.map(c => c[0]).filter(e => e.type === 'turn-undead-result');
}

// ── Tests ──

describe('SetConditionModal - Turn Undead', () => {
  let originalDispatch;

  beforeEach(() => {
    originalDispatch = window.dispatchEvent.bind(window);
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => originalDispatch(event));
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes featureName "Turn Undead" through undead-only eligibility and unlimited-target copy', () => {
    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);

    // Only undead survive the turnUndead branch of the base filter (types matched
    // case-insensitively); Goblin C (Humanoid) is dropped, attacker always excluded.
    expect(within(container).queryAllByRole('checkbox')).toHaveLength(3);
    expect(getCheckboxByCreature(container, 'Skeleton A')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Zombie B')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Player Ally')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Goblin C')).toBeUndefined();

    // Default maxTargets=Infinity renders the "all undead in range" copy, not a numeric cap.
    expect(screen.getByText(/Targets selected: 0\/3 \(all undead in range\)/)).toBeInTheDocument();
  });

  it('shows the TU empty state with an inert disabled confirm when no undead exist', () => {
    const { container } = render(<SetConditionModal {...makeProps({
      featureName: 'Turn Undead',
      combatSummary: {
        creatures: [
          { name: 'Attacker', type: 'player' },
          { name: 'Goblin A', type: 'npc', conditions: [] },
        ],
      },
      monsters: [{ name: 'Goblin A', type: 'Humanoid' }],
    })} />);

    expect(screen.getByText('No undead creatures found within range.')).toBeInTheDocument();
    expect(screen.queryByText(/Select creatures within/)).not.toBeInTheDocument();
    expect(within(container).queryAllByRole('checkbox')).toHaveLength(0);

    const confirm = screen.getByRole('button', { name: /Turn Undead \(0 targets\)/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
    expect(screen.queryByText(/Resolving WIS/)).not.toBeInTheDocument();
  });

  it('dispatches turn-undead-result with exactly the failed NPCs, and stays silent when every target saves', async () => {
    // Skeleton A rolls 5 (fails DC 14); Zombie B rolls 20 + 2 wis = 22 (saves).
    diceRoller.rollD20.mockReturnValueOnce(5).mockReturnValueOnce(20);

    const view = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(getCheckboxByCreature(view.container, 'Skeleton A'));
    fireEvent.click(getCheckboxByCreature(view.container, 'Zombie B'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    await waitFor(() => expect(turnUndeadEvents()).toHaveLength(1));
    // Full cross-component contract — useInitiativeEffects consumes failedTargets /
    // attackerName / campaignName and needs saveType + saveDc context for the save log.
    expect(turnUndeadEvents()[0].detail).toEqual({
      failedTargets: ['Skeleton A'],
      attackerName: 'Attacker',
      saveDc: 14,
      saveType: 'WIS',
      campaignName: 'test-campaign',
    });
    view.unmount();

    // Positive-leg-gated absence: re-run the same flow with every target saving —
    // saves are recorded (apply genuinely ran), yet the event never fires.
    vi.clearAllMocks();
    diceRoller.rollD20.mockReturnValue(20);
    const savedView = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(getCheckboxByCreature(savedView.container, 'Zombie B'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    await waitFor(() => expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Zombie B', expect.objectContaining({ success: true })));
    expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument();
    expect(turnUndeadEvents()).toHaveLength(0);
  });

  it('holds turn-undead-result until a pending player save resolves, then includes the player in failedTargets', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const view = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(getCheckboxByCreature(view.container, 'Skeleton A'));
    fireEvent.click(getCheckboxByCreature(view.container, 'Player Ally'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    // NPC already failed, but the event waits for the player's pending prompt.
    expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    expect(turnUndeadEvents()).toHaveLength(0);

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: savePromptService.sendSavePrompt.mock.calls[0][1].promptId, success: false },
    }));

    await waitFor(() => expect(turnUndeadEvents()).toHaveLength(1));
    expect(turnUndeadEvents()[0].detail.failedTargets).toEqual(['Skeleton A', 'Player Ally']);
  });
});
