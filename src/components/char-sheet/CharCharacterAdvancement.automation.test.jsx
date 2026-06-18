// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharCharacterAdvancement from './CharCharacterAdvancement.jsx';

const { mockExecuteHandler, mockOnSpellMasterySelected, mockOnSignatureSpellsSelected } = vi.hoisted(() => ({
  mockExecuteHandler: vi.fn(),
  mockOnSpellMasterySelected: vi.fn(),
  mockOnSignatureSpellsSelected: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn((feature) => !!(feature?.automation)),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: mockExecuteHandler,
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../common/Popup.jsx', () => ({
  default: function Popup({ html, onClickOrKeyDown }) {
    return (
      <div data-testid="popup-overlay" onClick={onClickOrKeyDown}>
        <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          <span className="dice-roll-hint">click to dismiss</span>
        </div>
      </div>
    );
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: function SpellMasteryModal({ payload, onConfirm, onClose }) {
    return (
      <div data-testid="spell-mastery-modal" role="dialog" onClick={onClose}>
        <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
          <span>Spell Mastery Modal</span>
          <button data-testid="confirm-spell-mastery" onClick={() => onConfirm(payload?.level1Options?.[0] || 'level1', payload?.level2Options?.[0] || 'level2')}>Confirm</button>
          <button data-testid="close-spell-mastery" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  },
}));

vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: function SignatureSpellsModal({ payload, onConfirm, onClose }) {
    return (
      <div data-testid="signature-spells-modal" role="dialog" onClick={onClose}>
        <div className="popup-modal" onClick={(e) => e.stopPropagation()}>
          <span>Signature Spells Modal</span>
          <button data-testid="confirm-signature-spells" onClick={() => onConfirm(payload?.level3Options?.[0] || 'spell1', payload?.level3Options?.[1] || 'spell2')}>Confirm</button>
          <button data-testid="close-signature-spells" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  },
}));

vi.mock('../../services/automation/handlers/class-wizard/spellMasteryHandler.js', () => ({
  onSpellMasterySelected: mockOnSpellMasterySelected,
  handle: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/automation/handlers/class-wizard/signatureSpellsHandler.js', () => ({
  onSignatureSpellsSelected: mockOnSignatureSpellsSelected,
  handle: vi.fn().mockResolvedValue(null),
}));

describe('CharCharacterAdvancement - Automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePlayerStats = {
    name: 'Test Character',
    characterAdvancement: [
      {
        name: 'Auto Feature',
        description: 'Has automation',
        automation: { type: 'test' },
      },
    ],
  };

  const baseProps = {
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
  };

  describe('feature click behavior', () => {
    it('renders clickable feature when it has automation', () => {
      render(<CharCharacterAdvancement {...baseProps} />);
      const feature = screen.getByText('Auto Feature:');
      expect(feature).toHaveClass('clickable');
    });

    it('calls executeHandler with correct arguments when clicking automated feature', async () => {
      mockExecuteHandler.mockResolvedValue(null);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(mockExecuteHandler).toHaveBeenCalledWith(
          basePlayerStats.characterAdvancement[0],
          basePlayerStats,
          'test-campaign'
        );
      });
    });
  });

  describe('executeHandler null/undefined results', () => {
    it('does not render popup when executeHandler returns null', async () => {
      mockExecuteHandler.mockResolvedValue(null);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });

    it('does not render popup when executeHandler returns undefined', async () => {
      mockExecuteHandler.mockResolvedValue(undefined);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });

    it('does not render popup when executeHandler returns a non-popup/non-modal result', async () => {
      mockExecuteHandler.mockResolvedValue({ type: 'other', payload: 'ignored' });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('executeHandler popup results', () => {
    it('renders popup with string payload from executeHandler', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: 'Simple popup message',
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        const popup = screen.getByTestId('popup-overlay');
        expect(popup).toHaveTextContent('Simple popup message');
      });
    });

    it('renders popup with object payload containing name and description from executeHandler', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Test Popup', description: 'Popup description' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByText('Test Popup')).toBeInTheDocument();
        expect(screen.getByText('Popup description')).toBeInTheDocument();
      });
    });

    it('renders feature name as popup title fallback when payload has no name', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Missing name payload' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByText('Auto Feature')).toBeInTheDocument();
        expect(screen.getByText('Missing name payload')).toBeInTheDocument();
      });
    });

    it('renders popup with object payload containing name only (no description)', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: { name: 'NameOnly' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByText('NameOnly')).toBeInTheDocument();
      });
    });

    it('renders click-to-dismiss hint in popup', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: 'Dismiss me',
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toHaveTextContent('click to dismiss');
      });
    });

    it('dismisses popup when clicking the overlay', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: 'Dismiss me',
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('popup-overlay'));
      await waitFor(() => {
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });

    it('does not dismiss popup when clicking the modal content area', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'popup',
        payload: 'Modal content',
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('popup-overlay').querySelector('.popup-modal'));
      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });
  });

  describe('executeHandler modal results', () => {
    it('renders spellMastery modal when executeHandler returns modal result', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        const modal = screen.getByTestId('spell-mastery-modal');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('role', 'dialog');
      });
    });

    it('renders signatureSpells modal when executeHandler returns modal result', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        const modal = screen.getByTestId('signature-spells-modal');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('role', 'dialog');
      });
    });

    it('does not render any modal for unknown modalName from executeHandler', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'unknown_modal',
        payload: { some: 'data' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('spellMastery modal interactions', () => {
    it('calls onSpellMasterySelected with correct arguments on confirm', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      mockOnSpellMasterySelected.mockResolvedValue(null);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-spell-mastery'));
      await waitFor(() => {
        expect(mockOnSpellMasterySelected).toHaveBeenCalledWith(
          'learn',
          basePlayerStats,
          'test-campaign',
          'level1',
          'level2'
        );
      });
    });

    it('hides modal and shows string popup when onSpellMasterySelected returns popup', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      mockOnSpellMasterySelected.mockResolvedValue({
        type: 'popup',
        payload: 'Mastery learned!',
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-spell-mastery'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        const popup = screen.getByTestId('popup-overlay');
        expect(popup).toHaveTextContent('Mastery learned!');
      });
    });

    it('hides modal and shows object popup when onSpellMasterySelected returns popup with name and description', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      mockOnSpellMasterySelected.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Mastery', description: 'You mastered a spell!' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-spell-mastery'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        expect(screen.getByText('Mastery')).toBeInTheDocument();
        expect(screen.getByText('You mastered a spell!')).toBeInTheDocument();
      });
    });

    it('uses "Spell Mastery" as fallback title when popup payload has no name', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      mockOnSpellMasterySelected.mockResolvedValue({
        type: 'popup',
        payload: { description: 'No name here' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-spell-mastery'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        expect(screen.getByText('Spell Mastery')).toBeInTheDocument();
        expect(screen.getByText('No name here')).toBeInTheDocument();
      });
    });

    it('hides modal without showing popup when onSpellMasterySelected returns null', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      mockOnSpellMasterySelected.mockResolvedValue(null);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-spell-mastery'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });

    it('hides modal without calling handler when closed via close button', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('close-spell-mastery'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        expect(mockOnSpellMasterySelected).not.toHaveBeenCalled();
      });
    });

    it('hides modal without calling handler when clicking overlay', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'spellMastery',
        payload: { payload: { action: 'learn', spells: ['fireball'] } },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('spell-mastery-modal'));
      await waitFor(() => {
        expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
        expect(mockOnSpellMasterySelected).not.toHaveBeenCalled();
      });
    });
  });

  describe('signatureSpells modal interactions', () => {
    it('calls onSignatureSpellsSelected with correct arguments on confirm', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      mockOnSignatureSpellsSelected.mockResolvedValue(null);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-signature-spells'));
      await waitFor(() => {
        expect(mockOnSignatureSpellsSelected).toHaveBeenCalledWith(
          'choose',
          basePlayerStats,
          'test-campaign',
          'spell1',
          'spell2'
        );
      });
    });

    it('hides modal and shows string popup when onSignatureSpellsSelected returns popup', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      mockOnSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: 'Signature string message',
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-signature-spells'));
      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
        const popup = screen.getByTestId('popup-overlay');
        expect(popup).toHaveTextContent('Signature string message');
      });
    });

    it('hides modal and shows object popup when onSignatureSpellsSelected returns popup with name and description', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      mockOnSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: { name: 'Signature', description: 'Signature spells set!' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-signature-spells'));
      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
        expect(screen.getByText('Signature')).toBeInTheDocument();
        expect(screen.getByText('Signature spells set!')).toBeInTheDocument();
      });
    });

    it('uses "Signature Spells" as fallback title when popup payload has no name', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      mockOnSignatureSpellsSelected.mockResolvedValue({
        type: 'popup',
        payload: { description: 'No name sig' },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-signature-spells'));
      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
        expect(screen.getByText('Signature Spells')).toBeInTheDocument();
        expect(screen.getByText('No name sig')).toBeInTheDocument();
      });
    });

    it('hides modal without showing popup when onSignatureSpellsSelected returns null', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      mockOnSignatureSpellsSelected.mockResolvedValue(null);
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('confirm-signature-spells'));
      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('popup-overlay')).not.toBeInTheDocument();
      });
    });

    it('hides modal without calling handler when closed via close button', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('close-signature-spells'));
      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
        expect(mockOnSignatureSpellsSelected).not.toHaveBeenCalled();
      });
    });

    it('hides modal without calling handler when clicking overlay', async () => {
      mockExecuteHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'signatureSpells',
        payload: { payload: { action: 'choose', spells: ['shield'] } },
      });
      render(<CharCharacterAdvancement {...baseProps} />);
      fireEvent.click(screen.getByText('Auto Feature:'));
      await waitFor(() => {
        expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('signature-spells-modal'));
      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
        expect(mockOnSignatureSpellsSelected).not.toHaveBeenCalled();
      });
    });
  });


});
