import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DragonCompanionModal from './DragonCompanionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js', () => ({
  confirmDragonCompanion: vi.fn(),
}));

import * as dragonCompanionHandler from '../../../services/automation/handlers/class-sorcerer/dragonCompanionHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: {
    name: 'Dragon Companion',
    automation: { spell: 'Summon Dragon', usesMax: 1 },
  },
  playerStats: { name: 'Sorcerer1', level: 1 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
  return render(<DragonCompanionModal {...makeProps(overrides)} />);
}

const mockPopupResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Dragon Companion',
    description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Duration: 1 minute.',
    automation: { spell: 'Summon Dragon', usesMax: 1 },
  },
};

// ── Tests ──

describe('DragonCompanionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders modal header, cast description, and controls', () => {
      renderModal();
      expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Summon Dragon/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Skip Concentration/)).toBeInTheDocument();
      expect(document.querySelector('.sp-body p')).toHaveTextContent(/Cast.*Summon Dragon.*without material components or spell slot/);
    });

    it('shows normal concentration description when unchecked', () => {
      renderModal();
      expect(screen.getByText(/will require Concentration and last up to 1 hour/)).toBeInTheDocument();
      expect(screen.queryByText(/will not require Concentration/)).not.toBeInTheDocument();
    });

    it('toggling skip concentration checkbox updates description and checkbox state', () => {
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      expect(checkbox.checked).toBe(false);
      expect(screen.getByText(/will require Concentration and last up to 1 hour/)).toBeInTheDocument();

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      expect(screen.getByText(/will not require Concentration and will last 1 minute/)).toBeInTheDocument();
      expect(screen.queryByText(/will require Concentration/)).not.toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('closes on Cancel button click', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when modal content is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('confirm flow', () => {
    it.each`
      noConcentration | skipConcentration
      ${false}        | ${false}
      ${true}         | ${true}
    `('calls confirmDragonCompanion with noConcentration=$noConcentration when skip concentration is $skipConcentration', async ({ noConcentration, skipConcentration }) => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(mockPopupResult);
      renderModal();
      if (skipConcentration) {
        fireEvent.click(screen.getByLabelText(/Skip Concentration/));
      }
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      expect(dragonCompanionHandler.confirmDragonCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dragon Companion' }),
        expect.objectContaining({ name: 'Sorcerer1' }),
        'test-campaign',
        noConcentration
      );
    });

    it('replaces initial UI with result description and Done button after confirm', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(mockPopupResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Summon Dragon/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Skip Concentration/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.getByText(/Dragon Companion: Free cast of Summon Dragon/)).toBeInTheDocument();
      });
    });

    it('closes on Done button click after confirm', async () => {
      const onClose = vi.fn();
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(mockPopupResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when modal content is clicked after confirm', async () => {
      const onClose = vi.fn();
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(mockPopupResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
