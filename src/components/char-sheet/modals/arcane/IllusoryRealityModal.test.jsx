// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IllusoryRealityModal from './IllusoryRealityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js', () => ({
  confirmIllusoryReality: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeBatch: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import { confirmIllusoryReality } from '../../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Illusory Reality',
  automation: {},
};

const basePlayerStats = {
  name: 'Wizard1',
  level: 14,
  spellSlots: { 1: 4, 2: 3 },
};

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

const mockConfirmResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Illusory Reality',
    description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
  },
};

// ── Helpers ──

function renderModal(props) {
  return render(<IllusoryRealityModal {...makeProps(props)} />);
}

async function fillAndConfirm(objectValue) {
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: objectValue } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
  });
}

// ── Tests ──

describe('IllusoryRealityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders overlay, modal, header, body, and actions containers', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the feature name in the header', () => {
      renderModal();
      expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
    });

    it('renders a Font Awesome eye icon in the header', () => {
      renderModal();
      expect(document.querySelector('.sp-header .fa-eye')).toBeInTheDocument();
    });

    it('renders instructions text in the modal body', () => {
      renderModal();
      expect(screen.getByText(/Choose one inanimate, nonmagical object/)).toBeInTheDocument();
    });

    it('renders the warning text about object limitations', () => {
      renderModal();
      expect(screen.getByText(/The object cannot deal damage or impose any conditions/)).toBeInTheDocument();
    });

    it('renders a text input with the correct placeholder', () => {
      renderModal();
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute(
        'placeholder',
        "Enter object name (e.g., 'a 5-foot cube of stone')"
      );
    });

    it('renders the Make Object Real button with an eye icon', () => {
      renderModal();
      const btn = screen.getByRole('button', { name: /Make Object Real/ });
      const icon = btn.querySelector('.fa-eye');
      expect(icon).toBeInTheDocument();
    });

    it('renders a Cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show a Done button before confirmation', () => {
      renderModal();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('does not show result content on initial render', () => {
      renderModal();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Feature name resolution ──

  describe('feature name', () => {
    it('uses custom featureName from action when provided', () => {
      renderModal({ action: { featureName: 'Custom Feature', automation: {} } });
      expect(screen.getByText('Custom Feature')).toBeInTheDocument();
    });

    it('falls back to "Illusory Reality" when action.name is absent', () => {
      renderModal({ action: { automation: {} } });
      expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
    });

    it('falls back to "Illusory Reality" when action is null', () => {
      renderModal({ action: null });
      expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
    });

    it('renders the eye icon when action is null', () => {
      renderModal({ action: null });
      expect(document.querySelector('.sp-header .fa-eye')).toBeInTheDocument();
    });
  });

  // ── Confirm button disabled state ──

  describe('confirm button disabled state', () => {
    it('is disabled when the input is empty', () => {
      renderModal();
      const btn = screen.getByRole('button', { name: /Make Object Real/ });
      expect(btn).toBeDisabled();
    });

    it('is disabled when the input contains only whitespace', () => {
      renderModal();
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });
      const btn = screen.getByRole('button', { name: /Make Object Real/ });
      expect(btn).toBeDisabled();
    });

    it('is enabled when the input has non-whitespace content', () => {
      renderModal();
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a 5-foot cube of stone' } });
      const btn = screen.getByRole('button', { name: /Make Object Real/ });
      expect(btn).toBeEnabled();
    });
  });

  // ── Input interaction ──

  describe('input interaction', () => {
    it('updates the input value on change', () => {
      renderModal();
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a 5-foot cube of stone' } });
      expect(input).toHaveValue('a 5-foot cube of stone');
    });

    it('updates the input value to empty string after setting a value', () => {
      renderModal();
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'something' } });
      fireEvent.change(input, { target: { value: '' } });
      expect(input).toHaveValue('');
    });
  });

  // ── Overlay and modal click behavior ──

  describe('overlay click behavior', () => {
    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Cancel button ──

  describe('cancel button', () => {
    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Confirm flow ──

  describe('confirmation flow', () => {
    beforeEach(() => {
      confirmIllusoryReality.mockResolvedValue(mockConfirmResult);
    });

    it('calls confirmIllusoryReality with correct parameters', async () => {
      renderModal();
      await fillAndConfirm('a 5-foot cube of stone');
      expect(confirmIllusoryReality).toHaveBeenCalledWith(
        baseAction,
        basePlayerStats,
        'test-campaign',
        'a 5-foot cube of stone'
      );
    });

    it('passes the object name as-is (untrimmed) to the handler', async () => {
      renderModal();
      await fillAndConfirm('  object  ');
      expect(confirmIllusoryReality).toHaveBeenCalledWith(
        baseAction,
        basePlayerStats,
        'test-campaign',
        '  object  '
      );
    });

    it('transitions to result state after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides the text input after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('hides the Make Object Real button after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Make Object Real/ })).not.toBeInTheDocument();
      });
    });

    it('hides the Cancel button after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('renders the result description in the modal body', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('<b>Illusory Reality</b>');
      });
    });

    it('calls onClose when Done button is clicked after confirm', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      await fillAndConfirm('stone');
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay in result state', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      await fillAndConfirm('stone');
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking modal content in result state', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      await fillAndConfirm('stone');
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('preserves modal CSS classes in result state', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      });
    });

    it('renders the eye icon in the result state header', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(document.querySelector('.sp-header .fa-eye')).toBeInTheDocument();
      });
    });
  });

});
