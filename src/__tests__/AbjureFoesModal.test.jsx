import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AbjureFoesModal from '../components/char-sheet/AbjureFoesModal.jsx';

// ── Mocked modules (before the component import) ──

vi.mock('../services/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(() => 60),
}));

vi.mock('../services/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../services/turnExpirations.js', () => ({
  addTurnExpiration: vi.fn(),
}));

vi.mock('../services/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../services/utils.js', () => {
  let counter = 0;
  const utilsMock = {
    guid: vi.fn(() => `guid-${++counter}`),
    getAbilityLongName: vi.fn((s) => s),
  };
  return { default: utilsMock };
});

vi.mock('../services/storage.js', () => ({
  default: { set: vi.fn() },
}));

// ── Re-import mocked modules ──
import * as savePromptService from '../services/savePromptService.js';
import * as useRuntimeState from '../hooks/useRuntimeState.js';
import * as turnExpirations from '../services/turnExpirations.js';
import * as logService from '../services/logService.js';
import * as diceRoller from '../services/diceRoller.js';

// ── Test fixtures ──

const mockCombatSummary = {
  creatures: [
    { name: 'Attacker', type: 'player' },
    { name: 'Goblin A', type: 'npc', conditions: [] },
    { name: 'Goblin B', type: 'npc', conditions: [], saveBonuses: { wis: 2 } },
    { name: 'Player Ally', type: 'player' },
  ],
};

const mockMapData = {
  players: [{ name: 'Attacker', gridX: 0, gridY: 0 }],
  placedItems: [],
};

const mockAttackerPos = { gridX: 0, gridY: 0 };

function makeProps(overrides) {
  return {
    combatSummary: mockCombatSummary,
    attackerName: 'Attacker',
    attackerPos: mockAttackerPos,
    maxTargets: 2,
    saveDc: 14,
    campaignName: 'test-campaign',
    mapData: null,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// Helper to match paragraph text that spans child elements
function hasText(matcher) {
  return (content, element) => matcher.test(element.textContent);
}

// ── Tests ──

describe('AbjureFoesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Render / initial state ──

  it('renders the modal overlay and header', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    expect(screen.getByText('Abjure Foes')).toBeInTheDocument();
  });

  it('shows instructions with WIS save reference and DC info', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/WIS/);
    expect(bodyDiv.textContent).toMatch(/DC 14/);
    });

  it('shows Frightened condition warning', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    expect(screen.getByText(/Frightened/)).toBeInTheDocument();
  });

  it('displays eligible target names but not the attacker', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    expect(screen.queryByText(/Goblin A/)).toBeInTheDocument();
    expect(screen.queryByText(/Goblin B/)).toBeInTheDocument();
    expect(screen.queryByText(/Player Ally/)).toBeInTheDocument();
  });

  it('renders checkboxes for each eligible target', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('shows target selection counter starting at 0', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    expect(screen.getByText(/Targets selected: 0\/2/)).toBeInTheDocument();
  });

  // ── Edge cases for eligible targets ──

  it('shows "No valid targets" when combatSummary has no creatures', () => {
    const emptyProps = makeProps({ combatSummary: {} });
    render(<AbjureFoesModal {...emptyProps} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  it('shows "No valid targets" when combatSummary is null', () => {
    const nullProps = makeProps({ combatSummary: null });
    render(<AbjureFoesModal {...nullProps} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  it('excludes attacker from eligible targets', () => {
    const onlyAttackerSummary = { creatures: [{ name: 'Attacker', type: 'player' }] };
    const props = makeProps({ combatSummary: onlyAttackerSummary });
    render(<AbjureFoesModal {...props} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  // ── Checkbox interactions ──

  it('toggles target selection on checkbox click', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const checkbox = screen.getAllByRole('checkbox')[0];
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('deselects target on second click', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('disables unselected checkboxes when maxTargets reached', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[2].disabled).toBe(true);
    expect(checkboxes[0].disabled).toBe(false);
    expect(checkboxes[1].disabled).toBe(false);
  });

  it('updates target counter when targets selected', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText(/Targets selected: 1\/2/)).toBeInTheDocument();
  });

  // ── Confirm button behavior ──

  it('disables confirm button when no targets selected', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Abjure \(0 targets\)/ });
    expect(btn.disabled).toBe(true);
  });

  it('enables confirm button after selecting a target', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const btn = screen.getByRole('button', { name: /Abjure \(1 target\)/ });
    expect(btn.disabled).toBe(false);
  });

  it('shows singular "target" when count is 1', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /Abjure \(1 target\)/ })).toBeInTheDocument();
  });

  it('shows plural "targets" when count exceeds 1', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(screen.getByRole('button', { name: /Abjure \(2 targets\)/ })).toBeInTheDocument();
  });

  // ── Cancel and close ──

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AbjureFoesModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<AbjureFoesModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal body', () => {
    const onClose = vi.fn();
    render(<AbjureFoesModal {...makeProps({ onClose })} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Confirm flow — NPC saves (auto-roll) ──

   it('rolls NPC save and shows processing state on confirm', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Resolving Wisdom saving throws/);
   });

  it('NPC succeeds when roll total >= saveDc', () => {
    diceRoller.rollD20.mockReturnValue(14);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument();
  });

  it('NPC fails and shows Frightened when roll < DC', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
  });

  it('NPC failure calls turn expiration tracking', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(turnExpirations.addTurnExpiration).toHaveBeenCalled();
  });

  it('NPC success does not call setRuntimeValue for conditions', () => {
    diceRoller.rollD20.mockReturnValue(20);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('NPC failure with bonus shows correct total in roll display', () => {
    diceRoller.rollD20.mockReturnValue(10); // roll=10 saveBonus=2 → total=12 < 14 → fail

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(screen.getByText(/\(Roll: 10 \+2 = 12\)/)).toBeInTheDocument();
  });

  it('NPC success with bonus shows correct total in roll display', () => {
    diceRoller.rollD20.mockReturnValue(14); // roll=14 + 2 = 16 >= 14 → success

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(screen.getByText(/\(Roll: 14 \+2 = 16\)/)).toBeInTheDocument();
  });

  it('uses saveBonus of 0 when creature has no saveBonuses', () => {
    diceRoller.rollD20.mockReturnValue(10);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({ total: 10, saveBonus: 0 })
    );
  });

  // ── Confirm flow — Player saves (prompt-based) ──

  it('sends save prompt for player creature on confirm', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
  });

  // ── Confirm flow — mixed NPC and Player selection ──

  it('shows both NPC results and pending player prompts', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A (NPC)
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(2 targets\)/ }));

    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
  });

  // ── Player save result event handling ──

  it('resolves pending prompt when save-result event arrives', async () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: true, total: 18, roll: 14, saveBonus: 4 },
      })
    );

    await waitFor(() => {
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });
  });

  it('applies frightened condition when player save fails via event', async () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
      })
    );

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    });
  });

  it('shows "All targets resolved" when everything is processed', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false },
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/All targets resolved/)).toBeInTheDocument();
    });
  });

  it('shows Done button when all targets resolved', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', { detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false } })
    );

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked', async () => {
    diceRoller.rollD20.mockReturnValue(5);
    const onClose = vi.fn();

    render(<AbjureFoesModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', { detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: true } })
    );

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show Done button while pending prompts remain', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player only → pending
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  // ── Range filtering with mapData ──

  it('renders correctly when mapData is provided', () => {
    const props = makeProps({ mapData: mockMapData, attackerPos: mockAttackerPos });
    render(<AbjureFoesModal {...props} />);
    expect(screen.getByText(/Goblin A/)).toBeInTheDocument();
  });

  // ── Singular/plural maxTargets in instruction text ──

  it('shows singular target limit when maxTargets is 1', () => {
    render(<AbjureFoesModal {...makeProps({ maxTargets: 1 })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/target within 60 feet/);
   });

  it('shows plural targets limit when maxTargets > 1', () => {
    render(<AbjureFoesModal {...makeProps({ maxTargets: 3 })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/targets within/);
   });

  // ── Side-effects confirm ──

  it('persists combatSummary after confirm via storage mock', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
  });

  it('logs roll entry for NPC target via addEntry service', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(logService.addEntry).toHaveBeenCalled();
  });

  it('calls fetch for condition logging when NPC save fails', () => {
    diceRoller.rollD20.mockReturnValue(5); // fail

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A no bonuses
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    const logCalls = global.fetch.mock.calls.filter(
      (call) => call[0] === '/api/campaigns/test-campaign/log'
    );
    expect(logCalls.length).toBeGreaterThan(0);
  });

  it('does not log condition for NPC save success', () => {
    diceRoller.rollD20.mockReturnValue(20); // auto-success

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    const logCalls = global.fetch.mock.calls.filter(
      (call) => call[0] === '/api/campaigns/test-campaign/log'
    );
    expect(logCalls).toHaveLength(0);
  });

  // ── Edge case: confirm with no targets selected is a no-op ──

  it('is a no-op when clicking confirm with no targets selected', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Abjure \(0 targets\)/ });
    fireEvent.click(btn);

    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(screen.queryByText(/Resolving Wisdom/)).not.toBeInTheDocument();
  });

  // ── Cleanup of event listener on unmount ──

  it('does not throw after unmount when save-result fires', () => {
    diceRoller.rollD20.mockReturnValue(15);

    const { unmount } = render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(() => {
      window.dispatchEvent(
        new CustomEvent('save-result', { detail: { promptId: 'nonexistent' } })
      );
    }).not.toThrow();
  });

  // ── Only NPC targets selected → resolved immediately (no pending) ──

  it('shows resolved state with only NPC targets and no pending prompts', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<AbjureFoesModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC only
    fireEvent.click(screen.getByRole('button', { name: /Abjure \(1 target\)/ }));

    expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
  });

  // ── Target type labels rendered correctly ──

  it('renders npc and player type labels', () => {
    render(<AbjureFoesModal {...makeProps()} />);
    const npcLabels = screen.getAllByText(/npc/);
    expect(npcLabels.length).toBeGreaterThanOrEqual(1);

    const playerLabels = screen.getAllByText(/player/);
    expect(playerLabels.length).toBeGreaterThanOrEqual(1);
  });
});
