// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IllusoryRealityModal from './IllusoryRealityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js', () => ({
  confirmIllusoryReality: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  setRuntimeBatch: vi.fn().mockResolvedValue(undefined),
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

function makePopupResult(featureName) {
  const name = featureName || 'Illusory Reality';
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name,
      description: `<b>${name}</b><br/><br/>You use your Bonus Action to make the object <b>"stone"</b> real.<br/><br/>The object cannot deal damage or impose any conditions.<br/><br/><em>The object persists until you roll initiative, finish a short rest, or finish a long rest. It disappears if you use this feature again.</em>`,
    },
  };
}

// ── Helpers ──

function renderModal(props) {
  return render(<IllusoryRealityModal {...makeProps(props)} />);
}

async function fillAndConfirm(objectValue) {
  const input = screen.getByRole('textbox');
  await act(async () => {
    fireEvent.change(input, { target: { value: objectValue } });
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
    it('renders the modal with header, body, buttons, and input', () => {
      renderModal();
      expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
      expect(screen.getByText(/Choose one inanimate, nonmagical object/)).toBeInTheDocument();
      expect(screen.getByText(/The object cannot deal damage or impose any conditions/)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Make Object Real/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('falls back to "Illusory Reality" when action name is absent or null', () => {
      renderModal({ action: { automation: {} } });
      expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
    });

    it('is disabled when the input is empty or whitespace-only', () => {
      renderModal();
      const btn = screen.getByRole('button', { name: /Make Object Real/ });
      expect(btn).toBeDisabled();

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });
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

  // ── Cancel button ──

  describe('cancel button', () => {
    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Overlay close behavior ──

  describe('overlay close behavior', () => {
    it('does not call onClose when the overlay background is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not call onClose when the modal content is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Confirmation flow ──

  describe('confirmation flow', () => {
    beforeEach(() => {
      confirmIllusoryReality.mockResolvedValue(makePopupResult('Illusory Reality'));
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

    it('transitions to result state after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides the input and action buttons after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Make Object Real/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('renders the result description after confirm', async () => {
      renderModal();
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.getByText(/You use your Bonus Action to make the object/)).toBeInTheDocument();
      });
    });

    it('uses custom featureName in the result header when provided', async () => {
      renderModal({ action: { featureName: 'Custom Feature', automation: {} } });
      confirmIllusoryReality.mockResolvedValue(makePopupResult('Custom Feature'));
      await fillAndConfirm('stone');
      await waitFor(() => {
        const header = document.querySelector('.sp-header');
        expect(header.textContent).toContain('Custom Feature');
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
  });

  // ── Handler returns error popup ──

  describe('handler returns error popup', () => {
    it('displays the error message when handler returns a popup result', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      confirmIllusoryReality.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Illusory Reality',
          description: 'Illusory Reality: You must specify an inanimate, nonmagical object.',
        },
      });
      await fillAndConfirm('stone');
      await waitFor(() => {
        expect(screen.getByText(/Illusory Reality: You must specify/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });
  });

});
