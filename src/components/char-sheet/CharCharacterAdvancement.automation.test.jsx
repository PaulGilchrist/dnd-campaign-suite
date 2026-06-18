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
      <div data-testid="popup" onClick={onClickOrKeyDown}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./modals/arcane/SpellMasteryModal.jsx', () => ({
  default: function SpellMasteryModal({ _payload, onConfirm, onClose }) {
    return (
      <div data-testid="spell-mastery-modal">
        <span>Spell Mastery Modal</span>
        <button data-testid="confirm-spell-mastery" onClick={() => onConfirm('level1', 'level2')}>Confirm</button>
        <button data-testid="close-spell-mastery" onClick={onClose}>Close</button>
      </div>
    );
  },
}));

vi.mock('./modals/arcane/SignatureSpellsModal.jsx', () => ({
  default: function SignatureSpellsModal({ _payload, onConfirm, onClose }) {
    return (
      <div data-testid="signature-spells-modal">
        <span>Signature Spells Modal</span>
        <button data-testid="confirm-signature-spells" onClick={() => onConfirm('spell1', 'spell2')}>Confirm</button>
        <button data-testid="close-signature-spells" onClick={onClose}>Close</button>
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

// useActionPopup is NOT mocked — the real implementation uses React.useState
// so setPopupHtml properly triggers re-renders

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

  it('renders clickable feature when it has automation', () => {
    render(<CharCharacterAdvancement {...baseProps} />);
    const feature = screen.getByText('Auto Feature:');
    expect(feature).toHaveClass('clickable');
  });

  it('calls executeHandler when clicking feature with automation', async () => {
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

  it('shows no popup when executeHandler returns null', async () => {
    mockExecuteHandler.mockResolvedValue(null);
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });
  });

  it('shows no popup when executeHandler returns undefined', async () => {
    mockExecuteHandler.mockResolvedValue(undefined);
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });
  });

  it('shows popup with string payload from executeHandler', async () => {
    mockExecuteHandler.mockResolvedValue({
      type: 'popup',
      payload: 'Simple popup message',
    });
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      const popup = screen.getByTestId('popup');
      expect(popup).toBeInTheDocument();
      expect(popup).toHaveTextContent('Simple popup message');
    });
  });

  it('dismisses popup when clicking on it', async () => {
    mockExecuteHandler.mockResolvedValue({
      type: 'popup',
      payload: 'Dismiss me',
    });
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('popup'));
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });
  });

  it('shows popup with object payload from executeHandler', async () => {
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

  it('shows popup with object payload using feature name as fallback', async () => {
    mockExecuteHandler.mockResolvedValue({
      type: 'popup',
      payload: { description: 'No name in payload' },
    });
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.getByText('Auto Feature')).toBeInTheDocument();
    });
  });

  it('shows spellMastery modal when executeHandler returns modal result', async () => {
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
  });

  it('shows signatureSpells modal when executeHandler returns modal result', async () => {
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
  });

  it('dismisses spellMastery modal when onSpellMasterySelected returns null', async () => {
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
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });
  });

  it('shows popup when spellMastery confirm returns popup with string payload', async () => {
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
      const popup = screen.getByTestId('popup');
      expect(popup).toHaveTextContent('Mastery learned!');
    });
  });

  it('shows popup when spellMastery confirm returns popup with object payload', async () => {
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

  it('shows popup when signatureSpells confirm returns popup with object payload', async () => {
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

  it('closes spellMastery modal without confirming', async () => {
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
    });
  });

  it('closes signatureSpells modal without confirming', async () => {
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
    });
  });

  it('ignores unknown result type from executeHandler', async () => {
    mockExecuteHandler.mockResolvedValue({ type: 'other', payload: 'test' });
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
      expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
      expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
    });
  });

  it('ignores unknown modal type from executeHandler', async () => {
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
      expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    });
  });

  it('shows popup when spellMastery confirm returns object payload without name', async () => {
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

  it('shows popup when spellMastery confirm returns object payload without description', async () => {
    mockExecuteHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'spellMastery',
      payload: { payload: { action: 'learn', spells: ['fireball'] } },
    });
    mockOnSpellMasterySelected.mockResolvedValue({
      type: 'popup',
      payload: { name: 'NoDescMastery' },
    });
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.getByTestId('spell-mastery-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-spell-mastery'));
    await waitFor(() => {
      expect(screen.queryByTestId('spell-mastery-modal')).not.toBeInTheDocument();
      expect(screen.getByText('NoDescMastery')).toBeInTheDocument();
    });
  });

  it('shows popup when signatureSpells confirm returns object payload without description', async () => {
    mockExecuteHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'signatureSpells',
      payload: { payload: { action: 'choose', spells: ['shield'] } },
    });
    mockOnSignatureSpellsSelected.mockResolvedValue({
      type: 'popup',
      payload: { name: 'NoDescSig' },
    });
    render(<CharCharacterAdvancement {...baseProps} />);
    fireEvent.click(screen.getByText('Auto Feature:'));
    await waitFor(() => {
      expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-signature-spells'));
    await waitFor(() => {
      expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      expect(screen.getByText('NoDescSig')).toBeInTheDocument();
    });
  });

  it('shows popup when signatureSpells confirm returns object payload without name', async () => {
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

  it('shows popup when signatureSpells confirm returns popup with string payload', async () => {
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
      const popup = screen.getByTestId('popup');
      expect(popup).toHaveTextContent('Signature string message');
    });
  });

  it('shows popup from executeHandler with object payload name only (no description)', async () => {
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

  it('does not call onSpellMasterySelected when modal is closed without confirming', async () => {
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
    });
    expect(mockOnSpellMasterySelected).not.toHaveBeenCalled();
  });
});
