import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FiendishLegacyModal from './FiendishLegacyModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-other/fiendishLegacyHandler.js', () => ({
  confirmFiendishLegacy: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import { confirmFiendishLegacy } from '../../../services/automation/handlers/class-other/fiendishLegacyHandler.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Fiendish Legacy' },
  playerStats: { name: 'Warlock1', level: 1, hitPoints: 30 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('FiendishLegacyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  // ── Initial render / display ──

  it('renders modal overlay and header', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon in header', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const icon = document.querySelector('.fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  it('displays instruction text', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(screen.getByText(/Choose a fiendish legacy/)).toBeInTheDocument();
  });

  it('renders all three legacy options', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(screen.getByText('Abyssal')).toBeInTheDocument();
    expect(screen.getByText('Chthonic')).toBeInTheDocument();
    expect(screen.getByText('Infernal')).toBeInTheDocument();
  });

  it('renders Font Awesome icons for each legacy', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(document.querySelector('.fa-dragon')).toBeInTheDocument();
    expect(document.querySelector('.fa-ghost')).toBeInTheDocument();
    expect(document.querySelector('.fa-fire')).toBeInTheDocument();
  });

  it('renders descriptions for each legacy option', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(screen.getByText(/Resistance to Poison damage/)).toBeInTheDocument();
    expect(screen.getByText(/Resistance to Necrotic damage/)).toBeInTheDocument();
    expect(screen.getByText(/Resistance to Fire damage/)).toBeInTheDocument();
  });

  it('renders spellcasting ability text for each legacy', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const spans = screen.getAllByText(/Spellcasting ability: Charisma/);
    expect(spans).toHaveLength(3);
  });

  it('renders Select Legacy button disabled by default', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const applyBtn = screen.getByRole('button', { name: /Select Legacy/ });
    expect(applyBtn).toBeDisabled();
  });

  it('renders Cancel button', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon on Select Legacy button', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const icon = screen.getByRole('button', { name: /Select Legacy/ }).querySelector('.fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Selection behavior ──

  it('does not select any legacy by default', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(document.querySelector('input[name="fiendishLegacyOption"]:checked')).not.toBeInTheDocument();
  });

  it('selects Abyssal legacy when clicked', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    fireEvent.click(abyssalLabel);
    expect(document.querySelector('input[name="fiendishLegacyOption"]:checked')).toBeInTheDocument();
  });

  it('selects Chthonic legacy when clicked', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const chthonicLabel = screen.getByText('Chthonic').closest('label');
    fireEvent.click(chthonicLabel);
    expect(document.querySelector('input[name="fiendishLegacyOption"]:checked')).toBeInTheDocument();
  });

  it('selects Infernal legacy when clicked', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    fireEvent.click(infernalLabel);
    expect(document.querySelector('input[name="fiendishLegacyOption"]:checked')).toBeInTheDocument();
  });

  it('enables Apply button after selection', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    fireEvent.click(infernalLabel);
    const applyBtn = screen.getByRole('button', { name: /Select Legacy/ });
    expect(applyBtn).not.toBeDisabled();
  });

  it('switches selection when clicking a different legacy', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    fireEvent.click(abyssalLabel);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    fireEvent.click(infernalLabel);
    expect(screen.getByText('Infernal').closest('label')).toBeInTheDocument();
  });

  // ── Apply flow ──

  it('does not call confirmFiendishLegacy when no selection', async () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).not.toHaveBeenCalled();
  });

  it('calls confirmFiendishLegacy with correct args when Abyssal selected', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    await act(async () => {
      fireEvent.click(abyssalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).toHaveBeenCalledWith(
      { name: 'Warlock1', level: 1, hitPoints: 30 },
      'Abyssal',
      'test-campaign'
    );
  });

  it('calls confirmFiendishLegacy with correct args when Chthonic selected', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Chthonic legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const chthonicLabel = screen.getByText('Chthonic').closest('label');
    await act(async () => {
      fireEvent.click(chthonicLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).toHaveBeenCalledWith(
      { name: 'Warlock1', level: 1, hitPoints: 30 },
      'Chthonic',
      'test-campaign'
    );
  });

  it('calls confirmFiendishLegacy with correct args when Infernal selected', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Infernal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    await act(async () => {
      fireEvent.click(infernalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).toHaveBeenCalledWith(
      { name: 'Warlock1', level: 1, hitPoints: 30 },
      'Infernal',
      'test-campaign'
    );
  });

  // ── Result state ──

  it('shows result screen after applying a legacy', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    await act(async () => {
      fireEvent.click(abyssalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    });
  });

  it('renders result with done button', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Infernal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    await act(async () => {
      fireEvent.click(infernalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides selection options after applying', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Chthonic legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const chthonicLabel = screen.getByText('Chthonic').closest('label');
    await act(async () => {
      fireEvent.click(chthonicLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/Choose a fiendish legacy/)).not.toBeInTheDocument();
    });
  });

  it('hides Select Legacy and Cancel buttons after applying', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    await act(async () => {
      fireEvent.click(abyssalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Select Legacy/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('displays result payload description', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Infernal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    await act(async () => {
      fireEvent.click(infernalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Selected Infernal legacy. Spellcasting ability: Charisma.')).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after applying', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    await act(async () => {
      fireEvent.click(abyssalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking result overlay', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Chthonic legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    const chthonicLabel = screen.getByText('Chthonic').closest('label');
    await act(async () => {
      fireEvent.click(chthonicLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close result when clicking inside modal content', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Infernal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    const onClose = vi.fn();
    render(<FiendishLegacyModal {...makeProps({ onClose })} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    await act(async () => {
      fireEvent.click(infernalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Result screen with null payload ──

  it('renders result screen with null payload', async () => {
    confirmFiendishLegacy.mockResolvedValue(null);
    render(<FiendishLegacyModal {...makeProps()} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    await act(async () => {
      fireEvent.click(infernalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Fiendish Legacy')).toBeInTheDocument();
    });
  });

  // ── Modal CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders result modal with proper CSS classes', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    await act(async () => {
      fireEvent.click(abyssalLabel);
    });
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

  // ── No selection edge case ──

  it('does not call confirmFiendishLegacy if apply clicked without selection', async () => {
    render(<FiendishLegacyModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).not.toHaveBeenCalled();
  });

  // ── Props passthrough ──

  it('passes playerStats to confirmFiendishLegacy', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Abyssal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps()} />);
    const abyssalLabel = screen.getByText('Abyssal').closest('label');
    await act(async () => {
      fireEvent.click(abyssalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Warlock1' }),
      expect.any(String),
      'test-campaign'
    );
  });

  it('passes campaignName to confirmFiendishLegacy', async () => {
    confirmFiendishLegacy.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Legacy',
        description: 'Selected Infernal legacy. Spellcasting ability: Charisma.',
        automation: { type: 'fiendish_legacy' },
      },
    });
    render(<FiendishLegacyModal {...makeProps({ campaignName: 'my-campaign' })} />);
    const infernalLabel = screen.getByText('Infernal').closest('label');
    await act(async () => {
      fireEvent.click(infernalLabel);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Select Legacy/ }));
    });
    expect(confirmFiendishLegacy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      'my-campaign'
    );
  });
});
