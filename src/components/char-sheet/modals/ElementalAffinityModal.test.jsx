import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalAffinityModal from './ElementalAffinityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  setChosenRuntimeValue: vi.fn(),
  getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as elementalAffinityHandler from '../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Elemental Affinity',
  automation: {
    type: 'class_feature',
    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'],
  },
};

const baseProps = {
  action: baseAction,
  playerStats: { name: 'Sorcerer1', level: 1, charismaModifier: 3 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// ── Tests ──

describe('ElementalAffinityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal content container', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('renders modal header with bolt icon', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('renders header with action name', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
  });

  it('renders default name when action name is missing', () => {
    render(<ElementalAffinityModal {...makeProps({ action: { automation: baseAction.automation } })} />);
    expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
  });

  it('renders description text for new selection', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.getByText(/Choose one damage type/)).toBeInTheDocument();
  });

  it('renders description text for changing existing type', () => {
    const actionWithExisting = makeAction({ existingType: 'Fire' });
    render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText(/Change damage type \(currently Fire\)/)).toBeInTheDocument();
  });

  it('renders all five damage type options', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
    expect(screen.getByLabelText('Poison')).toBeInTheDocument();
  });

  it('renders radio inputs for each damage type', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios).toHaveLength(5);
  });

  it('renders radio inputs with same name attribute', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[name="elementalAffinityOption"]');
    expect(radios).toHaveLength(5);
  });

  it('marks existing type with (current) label', () => {
    const actionWithExisting = makeAction({ existingType: 'Fire' });
    render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByText('(current)')).toBeInTheDocument();
  });

  it('does not show (current) label when no existing type', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.queryByText('(current)')).not.toBeInTheDocument();
  });

  it('renders apply button with "Choose Damage Type" text for new selection', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
  });

  it('renders apply button with "Change Damage Type" text for existing type', () => {
    const actionWithExisting = makeAction({ existingType: 'Fire' });
    render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
    expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
  });

  it('renders Font Awesome bolt icon on apply button', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('disables apply button when no type selected', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Damage Type/ })).toBeDisabled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Radio button selection ──

  it('selects a damage type when radio is clicked', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByLabelText('Fire')).toBeChecked();
  });

  it('deselects previous selection when different radio is clicked', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    fireEvent.click(screen.getByLabelText('Cold'));
    expect(screen.getByLabelText('Fire')).not.toBeChecked();
    expect(screen.getByLabelText('Cold')).toBeChecked();
  });

  it('enables apply button after selecting a type', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    expect(screen.getByRole('button', { name: /Damage Type/ })).toBeEnabled();
  });

  // ── Apply flow ──

  it('calls applyTypeChoice when apply button is clicked with selection', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    expect(elementalAffinityHandler.applyTypeChoice).toHaveBeenCalledWith(
      baseAction,
      baseProps.playerStats,
      'test-campaign',
      'Fire'
    );
  });

  it('does not call applyTypeChoice when apply button is clicked without selection', async () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    expect(elementalAffinityHandler.applyTypeChoice).not.toHaveBeenCalled();
  });

  it('shows result view after successful apply', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected. You gain resistance to Fire damage.' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Fire selected/)).toBeInTheDocument();
    });
  });

  it('renders header in result view', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
    });
  });

  it('renders description from result payload', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected. You gain resistance to Fire damage.' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Fire selected/)).toBeInTheDocument();
    });
  });

  it('renders Done button in result view', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides radio buttons after apply', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Fire')).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after apply', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked in result view', async () => {
    const onClose = vi.fn();
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked in result view', async () => {
    const onClose = vi.fn();
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking modal content in result view', async () => {
    const onClose = vi.fn();
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Fire selected' },
    });
    render(<ElementalAffinityModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Custom damage types ──

  it('renders custom damage types from action automation', () => {
    const customAction = makeAction({
      automation: { type: 'class_feature', damageTypes: ['Fire', 'Cold'] },
    });
    render(<ElementalAffinityModal {...makeProps({ action: customAction })} />);
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Lightning')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
  });

  it('defaults to all five types when damageTypes is not provided', () => {
    const noTypesAction = makeAction({ automation: { type: 'class_feature' } });
    render(<ElementalAffinityModal {...makeProps({ action: noTypesAction })} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
    expect(screen.getByLabelText('Poison')).toBeInTheDocument();
  });

  // ── Existing type visual indicators ──

  it('shows (current) label next to existing type', () => {
    const actionWithExisting = makeAction({ existingType: 'Lightning' });
    render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
    const labels = document.querySelectorAll('label');
    const lightningLabel = Array.from(labels).find(l => l.textContent.includes('Lightning') && l.textContent.includes('(current)'));
    expect(lightningLabel).toBeInTheDocument();
  });

  // ── CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<ElementalAffinityModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Null/undefined action handling ──

  it('renders with default name when action is undefined', () => {
    render(<ElementalAffinityModal {...makeProps({ action: undefined })} />);
    expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
  });

  it('renders default damage types when action is undefined', () => {
    render(<ElementalAffinityModal {...makeProps({ action: undefined })} />);
    expect(screen.getByLabelText('Acid')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
  });

  // ── Result view with null result ──

  it('does not show result view when result is null', async () => {
    elementalAffinityHandler.applyTypeChoice.mockResolvedValue(null);
    render(<ElementalAffinityModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText('Fire'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
    });
    // Should still show the selection view since applied becomes true but result is null
    // The component checks `applied && result` so it should still show selection UI
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeInTheDocument();
    });
  });
});
