// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

function getLegacyLabel(legacyName) {
  return screen.getByText(legacyName).closest('label');
}

// ── Tests ──

describe('FiendishLegacyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal overlay with selection UI', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
      expect(screen.getByText(/Choose a fiendish legacy/)).toBeInTheDocument();
      LEGACIES.forEach(name => {
        expect(getLegacyLabel(name)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(document.querySelector('input[name="fiendishLegacyOption"]:checked')).toBeNull();
    });

    it('renders descriptions and spellcasting ability for each legacy', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.getByText(/Resistance to Poison damage/)).toBeInTheDocument();
      expect(screen.getByText(/Resistance to Necrotic damage/)).toBeInTheDocument();
      expect(screen.getByText(/Resistance to Fire damage/)).toBeInTheDocument();
      const spans = screen.getAllByText(/Spellcasting ability: Charisma/);
      expect(spans).toHaveLength(3);
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    LEGACIES.forEach(legacyName => {
      it(`selects ${legacyName} legacy and enables apply button`, () => {
        render(<FiendishLegacyModal {...baseProps} />);
        fireEvent.click(getLegacyLabel(legacyName));
        expect(getLegacyLabel(legacyName).querySelector('input')).toBeChecked();
        expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeEnabled();
      });
    });

    it('deselects previous selection when a different legacy is clicked', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      fireEvent.click(getLegacyLabel('Infernal'));
      expect(getLegacyLabel('Abyssal').querySelector('input')).not.toBeChecked();
      expect(getLegacyLabel('Infernal').querySelector('input')).toBeChecked();
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    it('does not call confirmFiendishLegacy when apply is clicked without a selection', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      expect(confirmFiendishLegacy).not.toHaveBeenCalled();
    });

    LEGACIES.forEach(legacyName => {
      it(`calls confirmFiendishLegacy with correct args when ${legacyName} is selected`, async () => {
        confirmFiendishLegacy.mockResolvedValue({
          type: 'popup',
          payload: {
            type: 'automation_info',
            name: 'Fiendish Legacy',
            description: `Selected ${legacyName} legacy. Spellcasting ability: Charisma.`,
            automation: { type: 'fiendish_legacy' },
          },
        });
        render(<FiendishLegacyModal {...baseProps} />);
        fireEvent.click(getLegacyLabel(legacyName));
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
        });
        expect(confirmFiendishLegacy).toHaveBeenCalledWith(
          basePlayerStats,
          legacyName,
          'test-campaign'
        );
      });
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
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a fiendish legacy/)).not.toBeInTheDocument();
        expect(screen.getByText('Selected Abyssal legacy. Spellcasting ability: Charisma.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Select Legacy/ })).not.toBeInTheDocument();
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
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
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
      render(<FiendishLegacyModal {...makeProps({ onClose })} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked in result view', async () => {
      const onClose = vi.fn();
      render(<FiendishLegacyModal {...makeProps({ onClose })} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking modal content in result view', async () => {
      const onClose = vi.fn();
      render(<FiendishLegacyModal {...makeProps({ onClose })} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Null/undefined result handling ──

  describe('null/undefined result handling', () => {
    it('does not show result view when confirmFiendishLegacy returns falsy', async () => {
      confirmFiendishLegacy.mockResolvedValue(null);
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });

    it('does not show result view when confirmFiendishLegacy returns undefined', async () => {
      confirmFiendishLegacy.mockResolvedValue(undefined);
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });
});
