// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MistyWandererModal from './MistyWandererModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/mistyWandererHandler.js', () => ({
  confirmMistyWanderer: vi.fn(),
}));

// CLA-229: companion select is populated from the live combatSummary.
let mockCombatSummary = { creatures: [] };
vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => mockCombatSummary),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules ──

import { confirmMistyWanderer } from '../../../services/automation/handlers/class-warlock/mistyWandererHandler.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures ──

const baseAction = { name: 'Misty Wanderer' };
const basePlayerStats = { name: 'Warlock1', level: 3 };

const mockResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Misty Wanderer',
    description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
  },
};

function makeProps(overrides) {
  return {
    action: baseAction,
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('MistyWandererModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCombatSummary = { creatures: [] };
    getRuntimeValue.mockReturnValue(undefined);
    confirmMistyWanderer.mockResolvedValue(mockResult);
  });

  it('renders header, spell description, companion prompt, and pre-confirm controls', () => {
    const action = { ...baseAction, name: 'Custom Misty Step' };
    render(<MistyWandererModal {...makeProps({ action })} />);

    // Header shows the action name (not a hardcoded label)
    expect(screen.getByText('Custom Misty Step')).toBeInTheDocument();
    expect(screen.getByText(/Bring a willing creature within 5 feet/)).toBeInTheDocument();
    expect(screen.getByText(/The creature appears in an unoccupied space within 5 feet/)).toBeInTheDocument();
    // Fresh character with no stored pool defaults to max; Done only appears post-cast
    expect(screen.getByText(/Free casts remaining: 1 \/ 1/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Cast Misty Step/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('populates the companion select with combatants other than the caster (CLA-229)', () => {
    mockCombatSummary = {
      creatures: [
        { name: 'Warlock1', type: 'player' },
        { name: 'HexWarlock', type: 'player' },
        { name: 'Goblin Boss', type: 'monster' },
      ],
    };
    render(<MistyWandererModal {...makeProps()} />);
    const optionValues = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map(o => o.value);
    expect(optionValues).toEqual(['', 'HexWarlock', 'Goblin Boss']);
  });

  it('reads free casts remaining from the runtime pool, defaulting to max', () => {
    const { rerender } = render(<MistyWandererModal {...makeProps({ usesMax: 3 })} />);
    expect(getRuntimeValue).toHaveBeenCalledWith(
      'Warlock1',
      expect.stringContaining('freeCastCount'),
      'test-campaign'
    );
    expect(screen.getByText(/Free casts remaining: 3 \/ 3/)).toBeInTheDocument();

    getRuntimeValue.mockReturnValue(2);
    rerender(<MistyWandererModal {...makeProps({ usesMax: 3 })} />);
    expect(screen.getByText(/Free casts remaining: 2 \/ 3/)).toBeInTheDocument();
  });

  it('casts with no companion, shows the result view, and Done closes the modal', async () => {
    const onClose = vi.fn();
    render(<MistyWandererModal {...makeProps({ onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
    expect(confirmMistyWanderer).toHaveBeenCalledWith(baseAction, basePlayerStats, 'test-campaign', false, null);
    expect(document.querySelector('.sp-body')).toHaveTextContent('Misty Wanderer: Cast Misty Step (0 remaining).');
    expect(screen.queryByRole('button', { name: /Cast Misty Step/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes the selected companion to confirmMistyWanderer', async () => {
    mockCombatSummary = { creatures: [{ name: 'HexWarlock', type: 'player' }] };
    render(<MistyWandererModal {...makeProps()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'HexWarlock' } });
    fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));

    await waitFor(() => {
      expect(confirmMistyWanderer).toHaveBeenCalledWith(baseAction, basePlayerStats, 'test-campaign', true, 'HexWarlock');
    });
  });

  it('Cancel closes the modal; clicking the overlay background does not', () => {
    const onClose = vi.fn();
    render(<MistyWandererModal {...makeProps({ onClose })} />);

    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
