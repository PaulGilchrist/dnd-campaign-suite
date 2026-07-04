// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WildMagicDoubleRollModal from './WildMagicDoubleRollModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
  onDoubleRollSelected: vi.fn(),
}));

import * as wildMagicSurgeHandler from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

// ── Test fixtures ──

const surgeTable = [
  { min: 1, max: 5, effect: 'You lose track of where you are until the spell ends. You disappear from the current plane of existence and appear in the Astral Plane. You remain there until the spell ends, at which point you return to the space you left behind or the closest available space.' },
  { min: 6, max: 10, effect: 'Each creature within 30 feet of you must succeed on a DC 15 Constitution saving throw or take 2d10 fire damage and be blinded for 1 minute. A creature takes half damage on a successful save.' },
  { min: 11, max: 15, effect: 'Your body becomes larger than normal. You gain advantage on Strength checks and Strength saving throws, your carrying capacity doubles, and you have disadvantage on Dexterity checks and Dexterity saving throws.' },
  { min: 16, max: 20, effect: 'You temporarily become untethered from reality. You gain resistance to all damage for 1 minute. You also can\'t be targeted by attacks or be chosen as the target of a spell.' },
];

const baseProps = {
  featureName: 'Wild Magic Surge',
  roll1: 14,
  roll2: 7,
  surgeTable,
  campaignName: 'test-campaign',
  playerStats: { name: 'Sorcerer1', level: 3 },
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
  return render(<WildMagicDoubleRollModal {...makeProps(overrides)} />);
}

// ── Tests ──

describe('WildMagicDoubleRollModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wildMagicSurgeHandler.onDoubleRollSelected.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Wild Magic Surge',
        description: '<b>Wild Magic Surge: SURGE! (Rolled 14)</b><br/><br/>Your body becomes larger than normal...',
      },
    });
  });

  // ── Initial render ──

  describe('initial render', () => {
    it('shows the feature name with bolt icon in the header', () => {
      renderModal();
      expect(screen.getByText('Wild Magic Surge')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });

    it('shows the feature name with a custom name', () => {
      renderModal({ featureName: 'Arcane Chaos' });
      expect(screen.getByText('Arcane Chaos')).toBeInTheDocument();
    });

    it('shows the roll selection prompt', () => {
      renderModal();
      expect(screen.getByText(/Choose your roll/)).toBeInTheDocument();
    });

    it('renders both roll buttons with their values', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Roll 1: 14/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Roll 2: 7/ })).toBeInTheDocument();
    });

    it('renders roll buttons with different roll values', () => {
      renderModal({ roll1: 1, roll2: 20 });
      expect(screen.getByRole('button', { name: /Roll 1: 1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Roll 2: 20/ })).toBeInTheDocument();
    });

    it('shows a truncated surge effect preview on each roll button', () => {
      renderModal();
      const roll1Btn = screen.getByRole('button', { name: /Roll 1: 14/ });
      const roll2Btn = screen.getByRole('button', { name: /Roll 2: 7/ });
      expect(roll1Btn.textContent).toContain('Your body becomes larger than normal');
      expect(roll2Btn.textContent).toContain('Each creature within 30 feet');
    });

    it('truncates long surge effect descriptions at 80 characters', () => {
      renderModal({ roll1: 1, roll2: 20 });
      const roll1Btn = screen.getByRole('button', { name: /Roll 1: 1/ });
      expect(roll1Btn.textContent).toContain('...');
    });

    it('does not show surge preview text when no matching surge entry exists', () => {
      renderModal({ surgeTable: [] });
      const roll1Btn = screen.getByRole('button', { name: /Roll 1: 14/ });
      expect(roll1Btn.textContent).not.toContain('...');
    });

    it('shows the Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show the result or Done button before selection', () => {
      renderModal();
      expect(screen.queryByText(/SURGE/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Roll selection flow ──

  describe('roll selection', () => {
    it('calls onDoubleRollSelected with roll 1 when Roll 1 is clicked', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        expect(wildMagicSurgeHandler.onDoubleRollSelected).toHaveBeenCalledWith(
          { featureName: 'Wild Magic Surge', surgeTable },
          { name: 'Sorcerer1', level: 3 },
          'test-campaign',
          14
        );
      });
    });

    it('calls onDoubleRollSelected with roll 2 when Roll 2 is clicked', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 2: 7/ }));
      await waitFor(() => {
        expect(wildMagicSurgeHandler.onDoubleRollSelected).toHaveBeenCalledWith(
          { featureName: 'Wild Magic Surge', surgeTable },
          { name: 'Sorcerer1', level: 3 },
          'test-campaign',
          7
        );
      });
    });

    it('swaps the UI to show the surge result after selection', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        expect(screen.getByText(/SURGE/)).toBeInTheDocument();
        expect(screen.queryByText(/Choose your roll/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Roll 1: 14/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Roll 2: 7/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('renders the surge result description in the body', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('SURGE');
        expect(body.innerHTML).toContain('larger than normal');
      });
    });

    it('shows the Done button after selection', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('calls onClose when Done button is clicked after roll 1', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Done button is clicked after roll 2', async () => {
      renderModal({ roll1: 3, roll2: 18 });
      fireEvent.click(screen.getByRole('button', { name: /Roll 2: 18/ }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked after selection', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('passes { name: "Player" } when playerStats is null', async () => {
      renderModal({ playerStats: null });
      fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
      await waitFor(() => {
        expect(wildMagicSurgeHandler.onDoubleRollSelected).toHaveBeenCalledWith(
          { featureName: 'Wild Magic Surge', surgeTable },
          { name: 'Player' },
          'test-campaign',
          14
        );
      });
    });

    it('renders without crashing when surge table is empty', () => {
      renderModal({ surgeTable: [] });
      expect(screen.getByRole('button', { name: /Roll 1: 14/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Roll 2: 7/ })).toBeInTheDocument();
    });

    it('handles onDoubleRollSelected rejection without crashing', async () => {
      const unhandledRejectionHandler = () => {};
      process.on('unhandledRejection', unhandledRejectionHandler);
      try {
        wildMagicSurgeHandler.onDoubleRollSelected.mockRejectedValue(new Error('Network error'));
        renderModal();
        fireEvent.click(screen.getByRole('button', { name: /Roll 1: 14/ }));
        await waitFor(() => {
          expect(screen.queryByText(/SURGE/)).not.toBeInTheDocument();
        });
      }
      finally {
        process.off('unhandledRejection', unhandledRejectionHandler);
      }
    });
  });
});
