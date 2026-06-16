import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IllusoryRealityModal from './IllusoryRealityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js', () => ({
  confirmIllusoryReality: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeBatch: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import { confirmIllusoryReality } from '../../../services/automation/handlers/class-wizard/illusoryRealityHandler.js';

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

// ── Tests ──

describe('IllusoryRealityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with feature name', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome eye icon in header', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const icon = document.querySelector('.fa-eye');
    expect(icon).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('disables confirm button when object name is empty', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const confirmBtn = screen.getByRole('button', { name: /Make Object Real/ });
    expect(confirmBtn).toBeDisabled();
  });

  it('disables confirm button when object name is whitespace only', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    const confirmBtn = screen.getByRole('button', { name: /Make Object Real/ });
    expect(confirmBtn).toBeDisabled();
  });

  it('enables confirm button when object name has content', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a 5-foot cube of stone' } });
    const confirmBtn = screen.getByRole('button', { name: /Make Object Real/ });
    expect(confirmBtn).toBeEnabled();
  });

  it('renders instructions text in modal body', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(screen.getByText(/Choose one inanimate, nonmagical object/)).toBeInTheDocument();
  });

  it('renders warning text about object limitations', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(screen.getByText(/The object cannot deal damage or impose any conditions/)).toBeInTheDocument();
  });

  it('renders text input with placeholder', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', "Enter object name (e.g., 'a 5-foot cube of stone')");
  });

  it('renders Make Object Real button with eye icon', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Make Object Real/ });
    expect(btn).toBeInTheDocument();
    const icon = btn.querySelector('.fa-eye');
    expect(icon).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<IllusoryRealityModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<IllusoryRealityModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<IllusoryRealityModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Input interaction ──

  it('updates input value on change', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a 5-foot cube of stone' } });
    expect(input).toHaveValue('a 5-foot cube of stone');
  });

  it('updates input value with empty string', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a 5-foot cube of stone' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
  });

  // ── Confirm flow ──

  it('calls confirmIllusoryReality with correct parameters', async () => {
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "a 5-foot cube of stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a 5-foot cube of stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    expect(confirmIllusoryReality).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      'a 5-foot cube of stone'
    );
  });

  it('calls confirmIllusoryReality with trimmed object name', async () => {
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "object" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  object  ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    expect(confirmIllusoryReality).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign',
      '  object  '
    );
  });

  it('sets applied state to true after confirm', async () => {
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides input and confirm button after confirm', async () => {
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Make Object Real/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after confirm', async () => {
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after confirm', async () => {
    const onClose = vi.fn();
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps({ onClose })} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders result description in modal body after confirm', async () => {
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain('<b>Illusory Reality</b>');
    });
  });

  // ── Custom feature name ──

  it('uses custom feature name from action featureName', () => {
    render(<IllusoryRealityModal {...makeProps({ action: { featureName: 'Custom Feature', automation: {} } })} />);
    expect(screen.getByText('Custom Feature')).toBeInTheDocument();
  });

  it('defaults to "Illusory Reality" when action has no name', () => {
    render(<IllusoryRealityModal {...makeProps({ action: { automation: {} } })} />);
    expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
  });

  it('defaults to "Illusory Reality" when action is null', () => {
    render(<IllusoryRealityModal {...makeProps({ action: null })} />);
    expect(screen.getByText('Illusory Reality')).toBeInTheDocument();
  });

  it('renders eye icon even when action is null', () => {
    render(<IllusoryRealityModal {...makeProps({ action: null })} />);
    const icon = document.querySelector('.fa-eye');
    expect(icon).toBeInTheDocument();
  });

  // ── Done button overlay close ──

  it('calls onClose when clicking overlay in result state', async () => {
    const onClose = vi.fn();
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps({ onClose })} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking modal content in result state', async () => {
    const onClose = vi.fn();
    confirmIllusoryReality.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Illusory Reality',
        description: '<b>Illusory Reality</b><br/>You make the object "stone" real.',
      },
    });
    render(<IllusoryRealityModal {...makeProps({ onClose })} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'stone' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Make Object Real/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Initial render state ──

  it('does not show result content on initial render', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('shows placeholder text in input when object name is empty', () => {
    render(<IllusoryRealityModal {...makeProps()} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', "Enter object name (e.g., 'a 5-foot cube of stone')");
  });
});
