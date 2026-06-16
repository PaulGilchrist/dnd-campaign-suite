import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElderChampionRestoreModal from './ElderChampionRestoreModal.jsx';

// ── Mocked modules ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

// ── Re-import mocked modules ──

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Test fixtures ──

const baseProps = {
  action: { name: 'Elder Champion Restore' },
  playerStats: { name: 'Wizard1' },
  campaignName: 'test-campaign',
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('ElderChampionRestoreModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal container with proper CSS classes', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders header with fire icon and action name', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    const icon = document.querySelector('.fa-fire');
    expect(icon).toBeInTheDocument();
    expect(screen.getByText('Elder Champion Restore')).toBeInTheDocument();
  });

  it('renders first body message about Elder Champion already being used', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByText('Elder Champion has already been used this long rest.')).toBeInTheDocument();
  });

  it('renders second body message with spell slot info', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByText(/Restore its use by expending a level 5 spell slot/)).toBeInTheDocument();
  });

  it('displays available level 5 spell slot count from runtime value', () => {
    getRuntimeValue.mockReturnValue(3);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByText(/3 available/)).toBeInTheDocument();
  });

  it('displays 0 available when no spell slots are available', () => {
    getRuntimeValue.mockReturnValue(0);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByText(/0 available/)).toBeInTheDocument();
  });

  it('displays 0 available when runtime value is null', () => {
    getRuntimeValue.mockReturnValue(null);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByText(/0 available/)).toBeInTheDocument();
  });

  it('renders Expend Level 5 Slot button with xmark icon', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    const icon = document.querySelector('.fa-xmark');
    expect(icon).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Disabled state based on spell slots ──

  it('disables expend button when no level 5 slots available (0)', () => {
    getRuntimeValue.mockReturnValue(0);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeDisabled();
  });

  it('disables expend button when no level 5 slots available (null)', () => {
    getRuntimeValue.mockReturnValue(null);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeDisabled();
  });

  it('disables expend button when level 5 slots are negative', () => {
    getRuntimeValue.mockReturnValue(-1);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeDisabled();
  });

  it('enables expend button when level 5 slots are available', () => {
    getRuntimeValue.mockReturnValue(2);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeEnabled();
  });

  it('enables expend button when exactly 1 level 5 slot available', () => {
    getRuntimeValue.mockReturnValue(1);
    render(<ElderChampionRestoreModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Expend Level 5 Slot/ })).toBeEnabled();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<ElderChampionRestoreModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ElderChampionRestoreModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ElderChampionRestoreModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Confirm button ──

  it('calls onConfirm when Expend Level 5 Slot button is clicked', () => {
    const onConfirm = vi.fn();
    getRuntimeValue.mockReturnValue(1);
    render(<ElderChampionRestoreModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 5 Slot/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when expend button is disabled', () => {
    const onConfirm = vi.fn();
    getRuntimeValue.mockReturnValue(0);
    render(<ElderChampionRestoreModal {...makeProps({ onConfirm })} />);
    fireEvent.click(screen.getByRole('button', { name: /Expend Level 5 Slot/ }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Player name display ──

  it('uses playerStats name from playerStats prop', () => {
    render(<ElderChampionRestoreModal {...makeProps({ playerStats: { name: 'Sorcerer2' } })} />);
    expect(getRuntimeValue).toHaveBeenCalledWith('Sorcerer2', 'spellSlotLevel5', 'test-campaign');
  });

  // ── Campaign name usage ──

  it('passes campaignName to getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue(1);
    render(<ElderChampionRestoreModal {...makeProps({ campaignName: 'my-campaign' })} />);
    expect(getRuntimeValue).toHaveBeenCalledWith('Wizard1', 'spellSlotLevel5', 'my-campaign');
  });
});
