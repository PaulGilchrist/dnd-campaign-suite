// @cleaned-by-ai
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

const defaultMockResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Dragon Companion',
    description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Duration: 1 minute.<br/><br/><em>Open your spell sheet and cast Summon Dragon normally — no spell slot or material components will be consumed.</em>',
    automation: { spell: 'Summon Dragon', usesMax: 1 },
  },
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
  return render(<DragonCompanionModal {...makeProps(overrides)} />);
}

// ── Tests ──

describe('DragonCompanionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the modal with header, description, concentration checkbox, and action buttons', () => {
      renderModal();
      expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Summon Dragon/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Skip Concentration/)).toBeInTheDocument();
      expect(screen.getByText(/Cast/)).toBeInTheDocument();
      expect(screen.getByText(/without material components or spell slot/)).toBeInTheDocument();
    });

    it('shows normal concentration description unchecked, and skip description when checked', () => {
      renderModal();
      expect(screen.getByText(/will require Concentration and last up to 1 hour/)).toBeInTheDocument();
      expect(screen.queryByText(/will not require Concentration/)).not.toBeInTheDocument();

      const checkbox = screen.getByLabelText(/Skip Concentration/);
      fireEvent.click(checkbox);
      expect(screen.getByText(/will not require Concentration and will last 1 minute/)).toBeInTheDocument();
      expect(screen.queryByText(/will require Concentration/)).not.toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirm flow', () => {
    it('calls confirmDragonCompanion with noConcentration=false when checkbox is unchecked', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      expect(dragonCompanionHandler.confirmDragonCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dragon Companion' }),
        expect.objectContaining({ name: 'Sorcerer1' }),
        'test-campaign',
        false
      );
    });

    it('calls confirmDragonCompanion with noConcentration=true when checkbox is checked', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      fireEvent.click(checkbox);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      expect(dragonCompanionHandler.confirmDragonCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Dragon Companion' }),
        expect.objectContaining({ name: 'Sorcerer1' }),
        'test-campaign',
        true
      );
    });

    it('replaces initial UI with result description and Done button after confirm', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
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

    it('calls onClose when Done button is clicked after confirm', async () => {
      const onClose = vi.fn();
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
