// @improved-by-ai
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
    it('renders modal overlay and structure with all CSS classes', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the dragon icon in the header', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      const icon = document.querySelector('.sp-header .fa-solid.fa-dragon');
      expect(icon).toBeInTheDocument();
    });

    it('renders the action name in the header', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    });

    it('renders the selection prompt text', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.getByText(/Choose a fiendish legacy/)).toBeInTheDocument();
    });

    it('renders all three legacy options with labels', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      LEGACIES.forEach(name => {
        expect(getLegacyLabel(name)).toBeInTheDocument();
      });
    });

    it('renders the correct icon for each legacy', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(document.querySelector('.sp-body .fa-dragon')).toBeInTheDocument();
      expect(document.querySelector('.sp-body .fa-ghost')).toBeInTheDocument();
      expect(document.querySelector('.sp-body .fa-fire')).toBeInTheDocument();
    });

    it('renders descriptions for each legacy option', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.getByText(/Resistance to Poison damage/)).toBeInTheDocument();
      expect(screen.getByText(/Resistance to Necrotic damage/)).toBeInTheDocument();
      expect(screen.getByText(/Resistance to Fire damage/)).toBeInTheDocument();
    });

    it('renders spellcasting ability text for each legacy', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      const spans = screen.getAllByText(/Spellcasting ability: Charisma/);
      expect(spans).toHaveLength(3);
    });

    it('disables the apply button when no legacy is selected', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeDisabled();
    });

    it('renders Cancel button', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders the dragon icon inside the apply button', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      const applyBtn = screen.getByRole('button', { name: /Select Legacy/ });
      expect(applyBtn.querySelector('.fa-solid.fa-dragon')).toBeInTheDocument();
    });

    it('has no radio button checked on initial render', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(document.querySelector('input[name="fiendishLegacyOption"]:checked')).toBeNull();
    });

    it('does not show result view elements on initial render', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    LEGACIES.forEach(legacyName => {
      it(`selects ${legacyName} legacy when clicked`, () => {
        render(<FiendishLegacyModal {...baseProps} />);
        fireEvent.click(getLegacyLabel(legacyName));
        expect(getLegacyLabel(legacyName).querySelector('input')).toBeChecked();
      });
    });

    it('deselects previous selection when a different legacy is clicked', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      fireEvent.click(getLegacyLabel('Infernal'));
      expect(getLegacyLabel('Abyssal').querySelector('input')).not.toBeChecked();
      expect(getLegacyLabel('Infernal').querySelector('input')).toBeChecked();
    });

    it('enables apply button after selecting a legacy', () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      expect(screen.getByRole('button', { name: /Select Legacy/ })).toBeEnabled();
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

    it('calls confirmFiendishLegacy only once on apply', async () => {
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Legacy',
          description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
          automation: { type: 'fiendish_legacy' },
        },
      });
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      expect(confirmFiendishLegacy).toHaveBeenCalledTimes(1);
    });

    it('passes the campaignName prop to confirmFiendishLegacy', async () => {
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Legacy',
          description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
          automation: { type: 'fiendish_legacy' },
        },
      });
      render(<FiendishLegacyModal {...makeProps({ campaignName: 'my-campaign' })} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      expect(confirmFiendishLegacy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        'my-campaign'
      );
    });

    it('passes the playerStats prop to confirmFiendishLegacy', async () => {
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Legacy',
          description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
          automation: { type: 'fiendish_legacy' },
        },
      });
      const customStats = { name: 'Warlock2', level: 5, hitPoints: 60 };
      render(<FiendishLegacyModal {...makeProps({ playerStats: customStats })} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      expect(confirmFiendishLegacy).toHaveBeenCalledWith(
        customStats,
        expect.any(String),
        expect.any(String)
      );
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

    it('shows result view after successful apply', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a fiendish legacy/)).not.toBeInTheDocument();
      });
    });

    it('renders the dragon icon in the result header', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-header .fa-solid.fa-dragon')).toBeInTheDocument();
      });
    });

    it('renders the action name in the result header', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
      });
    });

    it('renders result description from payload in the sp-body', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Selected Abyssal legacy. Spellcasting ability: Charisma.')).toBeInTheDocument();
      });
    });

    it('renders result with proper CSS classes', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
      });
    });

    it('renders Done button in result view', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides radio buttons after apply', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText('Abyssal')).not.toBeInTheDocument();
      });
    });

    it('hides Cancel button after apply', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      });
    });

    it('hides the selection prompt after apply', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Choose a fiendish legacy/)).not.toBeInTheDocument();
      });
    });

    it('hides the Select Legacy button after apply', async () => {
      render(<FiendishLegacyModal {...baseProps} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Select Legacy/ })).not.toBeInTheDocument();
      });
    });

    it('renders result with custom action name', async () => {
      const customAction = { name: 'Custom Legacy' };
      confirmFiendishLegacy.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Custom Legacy',
          description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
          automation: { type: 'fiendish_legacy' },
        },
      });
      render(<FiendishLegacyModal {...makeProps({ action: customAction })} />);
      fireEvent.click(getLegacyLabel('Abyssal'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
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
    it('does not show result view when confirmFiendishLegacy returns null', async () => {
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

  // ── HTML rendering in result view ──

  describe('HTML rendering in result view', () => {
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
});
