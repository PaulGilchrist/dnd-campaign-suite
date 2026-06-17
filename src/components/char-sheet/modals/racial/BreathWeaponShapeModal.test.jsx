import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BreathWeaponShapeModal from './BreathWeaponShapeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/automation/index.js', () => ({
  executeHandler: vi.fn(() => null),
}));

// ── Re-import mocked modules ──

import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { executeHandler } from '../../../../services/automation/index.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Breath Weapon',
  automation: { type: 'save_attack' },
};

const basePlayerStats = { name: 'Dragon1', level: 5 };

function makeProps(overrides) {
  return {
    action: baseAction,
    playerStats: basePlayerStats,
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Tests ──

describe('BreathWeaponShapeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with action name', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome dragon icon in header', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  it('displays the shape selection prompt', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getByText('Choose the shape of your breath weapon:')).toBeInTheDocument();
  });

  it('renders cone radio option with description', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getByText('15-foot Cone')).toBeInTheDocument();
    expect(screen.getByText(/Each creature in a 15-foot cone/)).toBeInTheDocument();
  });

  it('renders line radio option with description', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getByText('30-foot Line (5 feet wide)')).toBeInTheDocument();
    expect(screen.getByText(/Each creature in a 30-foot line 5 feet wide/)).toBeInTheDocument();
  });

  it('renders Choose Shape button disabled by default', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const chooseBtn = screen.getByRole('button', { name: 'Choose Shape' });
    expect(chooseBtn).toBeDisabled();
  });

  it('renders Font Awesome dragon icon on Choose Shape button', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-dragon');
    expect(icon).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Radio button state before choosing ──

  it('has no radio selected on initial render', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      expect(radio.checked).toBe(false);
    });
  });

  it('has two radio inputs with correct name attribute', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(2);
    radios.forEach(radio => {
      expect(radio.name).toBe('breathWeaponShape');
    });
  });

  it('marks cone radio as checked after clicking it', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    expect(radios[0].checked).toBe(true);
  });

  it('marks line radio as checked after clicking it', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);
  });

  it('unchecks cone when line is clicked', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[1]);
    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });

  it('unchecks line when cone is clicked', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    fireEvent.click(radios[0]);
    expect(radios[1].checked).toBe(false);
    expect(radios[0].checked).toBe(true);
  });

  // ── Choose Shape button - no selection ──

  it('does not call setRuntimeValue without selection', async () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
    });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not call executeHandler without selection', async () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
    });
    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('does not call onClose without selection', async () => {
    const onClose = vi.fn();
    render(<BreathWeaponShapeModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose Shape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Action name handling ──

  it('handles action with no name gracefully', () => {
    render(<BreathWeaponShapeModal {...makeProps({ action: { automation: { type: 'save_attack' } } })} />);
    expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
  });

  it('handles action being null gracefully', () => {
    render(<BreathWeaponShapeModal {...makeProps({ action: null })} />);
    expect(screen.getByText('Breath Weapon')).toBeInTheDocument();
  });

  // ── Post-selection state (modal unmounts after shape selected) ──

  it('returns null (renders nothing) after selection is made', async () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    await act(async () => {
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
    });
    await waitFor(() => {
      expect(document.querySelector('.sp-overlay')).not.toBeInTheDocument();
    });
  });

  it('hides Choose Shape button after selection', async () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    await act(async () => {
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Choose Shape' })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after selection', async () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    await act(async () => {
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('hides shape options after selection', async () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    await act(async () => {
      const radios = document.querySelectorAll('input[type="radio"]');
      fireEvent.click(radios[0]);
    });
    await waitFor(() => {
      expect(screen.queryByText('Choose the shape of your breath weapon:')).not.toBeInTheDocument();
    });
  });

  // ── Damage description verification ──

  it('displays DEX save info for both shapes', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getAllByText(/must make a DEX save/).length).toBe(2);
  });

  it('displays 1d10 damage info for both shapes', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getAllByText(/1d10 damage/).length).toBe(2);
  });

  it('displays half damage on success for both shapes', () => {
    render(<BreathWeaponShapeModal {...makeProps()} />);
    expect(screen.getAllByText(/On a success, half damage/).length).toBe(2);
  });
});
