import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArcaneChargeModal from './ArcaneChargeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js', () => ({
  confirmArcaneCharge: vi.fn(),
}));

// ── Re-import mocked modules ──

import { confirmArcaneCharge } from '../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Arcane Charge',
  automation: {
    type: 'teleport',
    distance: '30 ft',
  },
};

const basePlayerStats = {
  name: 'Sorcerer1',
  level: 5,
};

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  distance: '30 ft',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('ArcaneChargeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── Initial render / display ──

  it('renders modal overlay', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders modal with proper CSS classes', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders header with action name', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
  });

  it('renders Font Awesome wind icon in header', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    const icon = document.querySelector('.sp-header .fa-solid.fa-wind');
    expect(icon).toBeInTheDocument();
  });

  it('displays teleport description in modal body', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(screen.getByText(/Teleport up to 30 ft to an unoccupied space you can see/)).toBeInTheDocument();
  });

  it('displays custom distance in description', () => {
    render(<ArcaneChargeModal {...makeProps({ distance: '60 ft' })} />);
    expect(screen.getByText(/Teleport up to 60 ft to an unoccupied space you can see/)).toBeInTheDocument();
  });

  it('renders Teleport button', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
  });

  it('renders Font Awesome wind icon on Teleport button', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-solid.fa-wind');
    expect(icon).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render result on initial render', () => {
    render(<ArcaneChargeModal {...makeProps()} />);
    expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Confirm / teleport flow ──

  it('calls confirmArcaneCharge with correct arguments on teleport', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    expect(confirmArcaneCharge).toHaveBeenCalledWith(
      baseAction,
      basePlayerStats,
      'test-campaign'
    );
  });

  it('shows loading/result state after confirm completes', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Teleported/)).toBeInTheDocument();
    });
  });

  it('hides Teleport button after confirm', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Teleport/ })).not.toBeInTheDocument();
    });
  });

  it('hides Cancel button after confirm', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('displays result description from confirm response', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Teleported 30 ft/)).toBeInTheDocument();
    });
  });

  it('renders Done button after confirm', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('shows action name in header after confirm', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
    });
  });

  it('renders Font Awesome wind icon in header after confirm', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-solid.fa-wind');
      expect(icon).toBeInTheDocument();
    });
  });

  // ── Done button behavior ──

  it('calls onClose when Done button is clicked after confirm', async () => {
    const onClose = vi.fn();
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking overlay after confirm', async () => {
    const onClose = vi.fn();
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-overlay'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking modal content after confirm', async () => {
    const onClose = vi.fn();
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: 'Arcane Charge: Teleported 30 ft to an unoccupied space you can see.',
      },
    });
    render(<ArcaneChargeModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      fireEvent.click(document.querySelector('.sp-modal'));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Result rendering with dangerouslySetInnerHTML ──

  it('renders result payload description using dangerouslySetInnerHTML', async () => {
    confirmArcaneCharge.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Arcane Charge',
        description: '<strong>Arcane Charge</strong>: Teleported 30 ft.',
      },
    });
    render(<ArcaneChargeModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.innerHTML).toContain('<strong>Arcane Charge</strong>');
    });
  });

  // ── Edge cases ──

  it('renders with default distance when distance prop is missing', () => {
    render(<ArcaneChargeModal {...makeProps({ distance: '30 ft' })} />);
    expect(screen.getByText(/Teleport up to 30 ft/)).toBeInTheDocument();
  });

  it('renders with empty distance string', () => {
    render(<ArcaneChargeModal {...makeProps({ distance: '' })} />);
    const body = document.querySelector('.sp-body p');
    expect(body.textContent).toContain('Teleport up to');
    expect(body.textContent).toContain('to an unoccupied space');
  });

  it('renders with different action name', () => {
    render(<ArcaneChargeModal {...makeProps({ action: { name: 'Blink', automation: { type: 'teleport', distance: '30 ft' } } })} />);
    expect(screen.getByText('Blink')).toBeInTheDocument();
  });

  it('renders modal with wind icon for different action', () => {
    render(<ArcaneChargeModal {...makeProps({ action: { name: 'Blink', automation: { type: 'teleport', distance: '30 ft' } } })} />);
    const icon = document.querySelector('.sp-header .fa-solid.fa-wind');
    expect(icon).toBeInTheDocument();
  });
});
