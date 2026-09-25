// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FiendishLegacyModal from './FiendishLegacyModal.jsx';
import { confirmFiendishLegacy } from '../../../services/automation/handlers/class-other/fiendishLegacyHandler.js';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-other/fiendishLegacyHandler.js', () => ({
  confirmFiendishLegacy: vi.fn(),
}));

// ── Test fixtures ──

const baseAction = { name: 'Fiendish Legacy' };

const basePlayerStats = { name: 'Warlock1', level: 1, hitPoints: 30 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

const LEGACIES = ['Abyssal', 'Chthonic', 'Infernal'];

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(props) {
  return render(<FiendishLegacyModal {...props} />);
}

function getLegacyInput(legacyName) {
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    const text = label.textContent;
    if (text.includes(legacyName)) {
      return label.querySelector('input[type="radio"]');
    }
  }
  return null;
}

// ── Tests ──

describe('FiendishLegacyModal', () => {
  let unhandledHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress unhandled rejection warnings from mockRejectedValue in error handling tests
    unhandledHandler = () => {};
    globalThis.addEventListener('unhandledrejection', unhandledHandler);
  });

  afterEach(() => {
    globalThis.removeEventListener('unhandledrejection', unhandledHandler);
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal overlay with selection UI', () => {
      renderModal(baseProps);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
      expect(screen.getByText(/Choose a fiendish legacy/)).toBeInTheDocument();
      LEGACIES.forEach(name => {
        const input = getLegacyInput(name);
        expect(input).toBeInTheDocument();
        expect(input.type).toBe('radio');
        expect(input.name).toBe('fiendishLegacyOption');
      });
      expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    it('selects a legacy and enables apply button', () => {
      LEGACIES.forEach(legacyName => {
        renderModal(baseProps);
        const input = getLegacyInput(legacyName);
        fireEvent.click(input);
        expect(input).toBeChecked();
        expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeEnabled();
        cleanup();
      });
    });

    it('deselects previous selection when a different legacy is clicked', () => {
      renderModal(baseProps);
      const abyssalInput = getLegacyInput('Abyssal');
      const infernalInput = getLegacyInput('Infernal');
      fireEvent.click(abyssalInput);
      expect(abyssalInput).toBeChecked();
      expect(infernalInput).not.toBeChecked();
      fireEvent.click(infernalInput);
      expect(abyssalInput).not.toBeChecked();
      expect(infernalInput).toBeChecked();
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    it('does not call confirmFiendishLegacy when apply is clicked without a selection', async () => {
      renderModal(baseProps);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      expect(confirmFiendishLegacy).not.toHaveBeenCalled();
    });

    it('calls confirmFiendishLegacy with correct args for each legacy', async () => {
      for (const legacyName of LEGACIES) {
        confirmFiendishLegacy.mockResolvedValue({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Fiendish Legacy',
            description: `Selected ${legacyName} legacy. Spellcasting ability: Charisma.`,
            automation: { type: 'fiendish_legacy' },
          },
        });
        renderModal(baseProps);
        const input = getLegacyInput(legacyName);
        fireEvent.click(input);
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
        });
        expect(confirmFiendishLegacy).toHaveBeenCalledWith(
          basePlayerStats,
          legacyName,
          'test-campaign'
        );
        cleanup();
      }
    });
  });

  // ── Result view ──

  describe('result view', () => {
    beforeEach(() => {
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Legacy',
          description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
          automation: { type: 'fiendish_legacy' },
        },
      });
    });

    it('shows result view with description and Done button after successful apply', async () => {
      renderModal(baseProps);
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a fiendish legacy/)).not.toBeInTheDocument();
        expect(screen.getByText('Selected Abyssal legacy. Spellcasting ability: Charisma.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Select Legacy/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('renders result description as HTML via dangerouslySetInnerHTML', async () => {
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Legacy',
          description: '<strong>Fiendish Legacy:</strong> Abyssal selected. <em>Spellcasting ability: Charisma.</em>',
          automation: { type: 'fiendish_legacy' },
        },
      });
      renderModal(baseProps);
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('strong')).toBeInTheDocument();
        expect(body.querySelector('em')).toBeInTheDocument();
      });
    });
  });

  // ── Result view close behavior ──

  describe('result view close behavior', () => {
    beforeEach(() => {
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Legacy',
          description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
          automation: { type: 'fiendish_legacy' },
        },
      });
    });

    it('calls onClose when Done button is clicked in result view', async () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked in result view', async () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('does not close when clicking modal content in result view', async () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('does not show result view when confirmFiendishLegacy rejects', async () => {
      confirmFiendishLegacy.mockRejectedValue(new Error('Network error'));
      renderModal(baseProps);
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });

    it('keeps selection buttons and cancel visible after error', async () => {
      confirmFiendishLegacy.mockRejectedValue(new Error('Failed'));
      renderModal(baseProps);
      fireEvent.click(getLegacyInput('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked on initial render', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not call onClose when clicking modal content on initial render', () => {
      const onClose = vi.fn();
      renderModal(makeProps({ onClose }));
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
