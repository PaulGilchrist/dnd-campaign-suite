// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WildMagicTamedModal from './WildMagicTamedModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
  onTamedSurgeSelected: vi.fn(),
}));

import { onTamedSurgeSelected } from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

// ── Test fixtures ──

const defaultSurgeResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Tamed Surge',
    description: '<b>Tamed Surge: Tamed Surge!</b><br/><br/>You gain advantage.',
    automation: { type: 'wild_magic_tamed' },
  },
};

const baseProps = {
  featureName: 'Tamed Surge',
  availableSurges: [
    { effect: 'You gain advantage on the next attack roll you make this turn.' },
    { effect: 'Your speed doubles until the end of your next turn.' },
    { effect: 'You regain 2d8 hit points.' },
    { effect: 'A random creature within 60 feet of you becomes charmed until the end of your next turn.' },
    { effect: 'You emit a bright flash of light in a 10-foot radius. Each creature in that radius must succeed on a CON saving throw or be blinded until the end of your next turn.' },
  ],
  campaignName: 'test-campaign',
  playerStats: { name: 'Sorcerer1' },
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
  return render(<WildMagicTamedModal {...makeProps(overrides)} />);
}

// ── Tests ──

describe('WildMagicTamedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onTamedSurgeSelected.mockResolvedValue(defaultSurgeResult);
  });

  // ── Initial render ──

  describe('initial render', () => {
    it('renders the modal with header, instructional text, surge buttons, and Cancel button', () => {
      renderModal();
      expect(screen.getByText('Tamed Surge')).toBeInTheDocument();
      expect(screen.getByText(/Tamed Surge — Choose your effect:/)).toBeInTheDocument();
      expect(screen.getByText(/Choose one effect from the Wild Magic Surge table/)).toBeInTheDocument();
      expect(document.querySelectorAll('.sp-roll-btn')).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders a custom feature name', () => {
      renderModal({ featureName: 'Wild Magic Tamed' });
      expect(screen.getByText('Wild Magic Tamed')).toBeInTheDocument();
    });

    it('does not show the Done button or surge result before selection', () => {
      renderModal();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Tamed Surge!/)).not.toBeInTheDocument();
    });

    it('truncates long effect text to 120 characters with ellipsis', () => {
      renderModal();
      const buttons = document.querySelectorAll('.sp-roll-btn');
      expect(buttons[4].textContent).toContain('...');
      expect(buttons[4].textContent.length).toBeLessThanOrEqual(123);
      expect(buttons[0].textContent).toBe('You gain advantage on the next attack roll you make this turn.');
    });
  });

  // ── Surge selection ──

  describe('surge selection', () => {
    it('calls onTamedSurgeSelected with correct arguments when a surge is selected', async () => {
      renderModal();
      const buttons = document.querySelectorAll('.sp-roll-btn');
      fireEvent.click(buttons[0]);
      await waitFor(() => {
        expect(onTamedSurgeSelected).toHaveBeenCalledWith(
          { name: 'Tamed Surge', automation: { type: 'wild_magic_tamed' } },
          { name: 'Sorcerer1' },
          'test-campaign',
          baseProps.availableSurges[0]
        );
      });
    });

    it('passes custom campaignName and playerStats to onTamedSurgeSelected', async () => {
      const customStats = { name: 'Mage1', level: 5 };
      renderModal({ campaignName: 'my-campaign', playerStats: customStats });
      const buttons = document.querySelectorAll('.sp-roll-btn');
      fireEvent.click(buttons[0]);
      await waitFor(() => {
        expect(onTamedSurgeSelected).toHaveBeenCalledWith(
          expect.any(Object),
          customStats,
          'my-campaign',
          expect.any(Object)
        );
      });
    });

    it('swaps UI to show result after selection', async () => {
      renderModal();
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[0]);
      await waitFor(() => {
        expect(screen.getByText(/Tamed Surge!/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /advantage/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('renders the result description in the modal body', async () => {
      renderModal();
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[0]);
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('Tamed Surge!');
      });
    });

    it('calls onClose when Done button is clicked after selection', async () => {
      renderModal();
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[0]);
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked after selection', async () => {
      renderModal();
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[0]);
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking modal content after selection', async () => {
      renderModal();
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[0]);
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(baseProps.onClose).not.toHaveBeenCalled();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with an empty availableSurges array', () => {
      renderModal({ availableSurges: [] });
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(screen.getByText(/Tamed Surge — Choose your effect:/)).toBeInTheDocument();
      expect(document.querySelectorAll('.sp-roll-btn')).toHaveLength(0);
    });

    it('defaults playerStats to { name: "Player" } when undefined or null', async () => {
      renderModal({ playerStats: null });
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[0]);
      await waitFor(() => {
        expect(onTamedSurgeSelected).toHaveBeenCalledWith(
          expect.any(Object),
          { name: 'Player' },
          expect.any(String),
          expect.any(Object)
        );
      });
    });

    it('renders result with custom surge description from the handler', async () => {
      onTamedSurgeSelected.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Tamed Surge',
          description: '<b>Tamed Surge: Speed doubles!</b><br/><br/>Your speed doubles until the end of your next turn.',
          automation: { type: 'wild_magic_tamed' },
        },
      });
      renderModal();
      fireEvent.click(document.querySelectorAll('.sp-roll-btn')[1]);
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('Speed doubles!');
        expect(body.innerHTML).toContain('Your speed doubles');
      });
    });
  });
});
