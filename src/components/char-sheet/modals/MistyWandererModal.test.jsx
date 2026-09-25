// @improved-by-ai
// @cleaned-by-ai
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
  getRuntimeValue: vi.fn(() => undefined),
}));

// ── Re-import mocked modules ──

import { confirmMistyWanderer } from '../../../services/automation/handlers/class-warlock/mistyWandererHandler.js';

// ── Test fixtures ──

const baseAction = { name: 'Misty Wanderer' };

const basePlayerStats = { name: 'Warlock1', level: 3 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// Shared mock result reused across confirm-related tests
const mockResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Misty Wanderer',
    description: 'Misty Wanderer: Cast Misty Step (0 remaining).',
  },
};

// ── Tests ──

describe('MistyWandererModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal with overlay, header, body, and action buttons', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(screen.getByText('Misty Wanderer')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cast Misty Step/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('renders the body content with Misty Step description and ally selection prompt', () => {
      render(<MistyWandererModal {...makeProps()} />);
      expect(screen.getByText(/Bring a willing creature within 5 feet/)).toBeInTheDocument();
      expect(screen.getByText(/The creature appears in an unoccupied space within 5 feet/)).toBeInTheDocument();
    });

    it('renders a select dropdown with None as the default option', () => {
      render(<MistyWandererModal {...makeProps()} />);
      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');
    });
  });

  // ── Custom action name ──

  describe('action name display', () => {
    it('displays the custom action name in the header', () => {
      render(<MistyWandererModal {...makeProps({ action: makeAction({ name: 'Custom Misty Step' }) })} />);
      expect(screen.getByText('Custom Misty Step')).toBeInTheDocument();
    });
  });

  // ── Ally selection ──

  describe('ally selection', () => {
    // CLA-229: the companion select must be populated from combatSummary —
    // previously it was hardcoded to <option value="">None</option> only,
    // making the "bring one willing creature" half unreachable.
    it('populates the companion select with combatants other than the caster', () => {
      mockCombatSummary = {
        creatures: [
          { name: 'Warlock1', type: 'player' },
          { name: 'HexWarlock', type: 'player' },
          { name: 'Goblin Boss', type: 'monster' },
        ],
      };
      render(<MistyWandererModal {...makeProps()} />);
      const select = screen.getByRole('combobox');
      const optionValues = Array.from(select.querySelectorAll('option')).map(o => o.value);
      expect(optionValues).toEqual(['', 'HexWarlock', 'Goblin Boss']);
      mockCombatSummary = { creatures: [] };
    });

    it('shows free casts remaining from the pool (CLA-229)', () => {
      render(<MistyWandererModal {...makeProps({ usesMax: 3 })} />);
      expect(screen.getByText(/Free casts remaining: 3 \/ 3/)).toBeInTheDocument();
    });

    it('passes the selected ally name to confirmMistyWanderer when an ally is chosen', async () => {
      confirmMistyWanderer.mockResolvedValue(mockResult);
      render(<MistyWandererModal {...makeProps()} />);
      const select = screen.getByRole('combobox');
      Object.defineProperty(select, 'value', { get: () => 'Ally1', configurable: true });
      fireEvent.change(select);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(confirmMistyWanderer).toHaveBeenCalledWith(
          baseAction,
          basePlayerStats,
          'test-campaign',
          true,
          'Ally1'
        );
      });
    });
  });

  // ── Confirm flow and result display ──

  describe('confirm flow', () => {
    beforeEach(() => {
      confirmMistyWanderer.mockResolvedValue(mockResult);
    });

    it('displays the result description and Done button after confirm', async () => {
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toHaveTextContent('Misty Wanderer: Cast Misty Step');
      });
    });

    it('shows ally name in result description when ally was brought', async () => {
      confirmMistyWanderer.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Misty Wanderer',
          description: 'Misty Wanderer: Cast Misty Step (0 remaining). Brought Ally1 to an unoccupied space within 5 feet of your destination.',
        },
      });
      render(<MistyWandererModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        expect(document.querySelector('.sp-body')).toHaveTextContent('Ally1');
        expect(document.querySelector('.sp-body')).toHaveTextContent('Brought');
      });
    });
  });

  // ── Result close behavior ──

  describe('result close behavior', () => {
    beforeEach(() => {
      confirmMistyWanderer.mockResolvedValue(mockResult);
    });

    it('calls onClose when Done button is clicked after confirm', async () => {
      const onClose = vi.fn();
      render(<MistyWandererModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Cast Misty Step/ }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Dismiss behavior ──

  describe('dismiss behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<MistyWandererModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking the modal overlay background', () => {
      const onClose = vi.fn();
      render(<MistyWandererModal {...makeProps({ onClose })} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });
});
