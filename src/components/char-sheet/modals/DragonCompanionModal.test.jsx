// @improved-by-ai
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

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal overlay and modal container', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders the modal structure with header, body, and actions sections', () => {
      renderModal();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with dragon icon and action name', () => {
      renderModal();
      expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-dragon')).toBeInTheDocument();
    });

    it('renders a custom action name when provided', () => {
      renderModal({ action: { name: 'My Dragon', automation: {} } });
      expect(screen.getByText('My Dragon')).toBeInTheDocument();
    });

    it('describes the summon dragon behavior in the modal body', () => {
      renderModal();
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Cast');
      expect(body.textContent).toContain('Summon Dragon');
      expect(body.textContent).toContain('without material components or spell slot');
    });

    it('renders a Summon Dragon button with dragon icon in actions', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Summon Dragon/ })).toBeInTheDocument();
      expect(document.querySelector('.sp-actions .fa-solid.fa-dragon')).toBeInTheDocument();
    });

    it('renders a Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show result state on initial render', () => {
      renderModal();
      expect(screen.queryByText(/Dragon Companion: Free cast/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Concentration checkbox ──

  describe('concentration checkbox', () => {
    it('is unchecked by default', () => {
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      expect(checkbox).not.toBeChecked();
    });

    it('toggles when clicked', () => {
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      expect(checkbox).not.toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('shows normal concentration description when unchecked', () => {
      renderModal();
      expect(screen.getByText(/The dragon companion will require Concentration and last up to 1 hour/)).toBeInTheDocument();
      expect(screen.queryByText(/will not require Concentration/)).not.toBeInTheDocument();
    });

    it('shows skip concentration description when checked', () => {
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      fireEvent.click(checkbox);
      expect(screen.getByText(/The dragon companion will not require Concentration and will last 1 minute/)).toBeInTheDocument();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Confirm flow ──

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

    it('replaces initial UI with result after confirm completes', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Summon Dragon/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Skip Concentration/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Cast <.*>Summon Dragon<.*>/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('displays the result description from the handler response', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Dragon Companion: Free cast of Summon Dragon/)).toBeInTheDocument();
      });
    });

    it('renders result description with dangerouslySetInnerHTML for HTML content', async () => {
      const htmlResult = {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Dragon Companion',
          description: '<strong>Bold text</strong> and <em>italic text</em>.',
          automation: {},
        },
      };
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(htmlResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('strong')).toBeInTheDocument();
        expect(body.querySelector('em')).toBeInTheDocument();
      });
    });

    it('shows "Done" button and header icon after confirm', async () => {
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(document.querySelector('.sp-header .fa-solid.fa-dragon')).toBeInTheDocument();
        expect(screen.getByText('Dragon Companion')).toBeInTheDocument();
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

    it('calls onClose when overlay is clicked after confirm', async () => {
      const onClose = vi.fn();
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking modal content after confirm', async () => {
      const onClose = vi.fn();
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(defaultMockResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Result content variations ──

  describe('result content variations', () => {
    it('shows "Does not require Concentration" in result when noConcentration is true', async () => {
      const noConcResult = {
        ...defaultMockResult,
        payload: {
          ...defaultMockResult.payload,
          description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Does not require Concentration. Duration: 1 minute.',
        },
      };
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(noConcResult);
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      fireEvent.click(checkbox);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Does not require Concentration/)).toBeInTheDocument();
      });
    });

    it('shows duration in result when noConcentration is true', async () => {
      const noConcResult = {
        ...defaultMockResult,
        payload: {
          ...defaultMockResult.payload,
          description: 'Dragon Companion: Free cast of Summon Dragon (0 remaining). Duration: 1 minute.',
        },
      };
      dragonCompanionHandler.confirmDragonCompanion.mockResolvedValue(noConcResult);
      renderModal();
      const checkbox = screen.getByLabelText(/Skip Concentration/);
      fireEvent.click(checkbox);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Dragon/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Duration: 1 minute/)).toBeInTheDocument();
      });
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders header with undefined text when action.name is missing', () => {
      renderModal({ action: { automation: { spell: 'Summon Dragon', usesMax: 1 } } });
      const header = document.querySelector('.sp-header');
      expect(header.textContent.trim()).toBe('');
    });

    it('renders empty string in header when action.name is empty', () => {
      renderModal({ action: { name: '', automation: { spell: 'Summon Dragon', usesMax: 1 } } });
      const header = document.querySelector('.sp-header');
      expect(header.textContent.trim()).toBe('');
    });
  });
});
