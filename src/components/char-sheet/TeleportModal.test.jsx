import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeleportModal from './TeleportModal.jsx';

// ── Mocked modules ──

vi.mock('../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn(),
  isExtendedAvailable: vi.fn(() => true),
}));

// ── Re-import mocked modules ──

import * as tempTeleportHandler from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Paladin1', level: 5, hitPoints: 40 };
const mockCampaignName = 'test-campaign';
const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

function makeAction(overrides) {
  return {
    name: 'Misty Step',
    automation: {
      type: 'teleport',
      effect: 'teleport',
      distance: '30 ft',
      extendedDistance: '60 ft',
      ...(overrides || {}),
    },
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('TeleportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(true);
  });

  // ── Standard teleport modal (default) ──

  it('renders the modal overlay and structure', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('renders the header with tree icon and action name', () => {
    const action = makeAction({ name: 'Misty Step' });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('Misty Step')).toBeInTheDocument();
    const icon = document.querySelector('.fa-solid.fa-tree');
    expect(icon).toBeInTheDocument();
  });

  it('displays teleport instruction text', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('Teleport to an unoccupied space you can see:')).toBeInTheDocument();
  });

  it('renders standard distance radio option with default 60 ft', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('60 ft')).toBeInTheDocument();
    expect(screen.getByText('— Standard teleport')).toBeInTheDocument();
  });

  it('renders extended distance radio option with default 150 ft', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('150 ft')).toBeInTheDocument();
    expect(screen.getByText('— Once per Rage')).toBeInTheDocument();
  });

  it('defaults standard distance to 60 ft when auto.distance is missing', () => {
    const action = makeAction({ automation: { type: 'teleport', effect: 'teleport' } });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('60 ft')).toBeInTheDocument();
  });

  it('defaults extended distance to 150 ft when auto.extendedDistance is missing', () => {
    const action = makeAction({ automation: { type: 'teleport', effect: 'teleport', distance: '30 ft' } });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('150 ft')).toBeInTheDocument();
  });

  it('uses custom distance values from automation config', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport', distance: '30 ft', extendedDistance: '60 ft' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('30 ft')).toBeInTheDocument();
    expect(screen.getByText('60 ft')).toBeInTheDocument();
  });

  it('has standard distance radio selected by default', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios[0].checked).toBe(true);
  });

  it('switches extended distance selection on click', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  it('renders Teleport button with tree icon', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const teleportBtn = screen.getByRole('button', { name: /Teleport/ });
    expect(teleportBtn).toBeInTheDocument();
    expect(teleportBtn.querySelector('.fa-solid.fa-tree')).toBeInTheDocument();
    expect(teleportBtn.classList.contains('sp-roll-btn')).toBe(true);
  });

  it('renders Cancel button', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Extended distance disabled state ──

  it('disables extended distance radio when not available', () => {
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    expect(radios[1].disabled).toBe(true);
  });

  it('shows "Already used this Rage" when extended not available', () => {
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText('— Already used this Rage')).toBeInTheDocument();
  });

  it('does not switch to extended when disabled', () => {
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(false);
    expect(radios[0].checked).toBe(true);
  });

  // ── Bring allies display ──

  it('shows bring allies message when allyCount > 0 and bringAllies is true', () => {
    const action = makeAction({
      automation: {
        type: 'teleport',
        effect: 'teleport',
        bringAllies: true,
        allyCount: 3,
        teleportRange: '30 ft',
      },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText(/bring up to 3 willing creatures/)).toBeInTheDocument();
    expect(screen.getByText(/30 ft/)).toBeInTheDocument();
  });

  it('does not show bring allies message when bringAllies is false', () => {
    const action = makeAction({
      automation: {
        type: 'teleport',
        effect: 'teleport',
        bringAllies: false,
        allyCount: 0,
      },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.queryByText(/bring up to/)).not.toBeInTheDocument();
  });

  it('does not show bring allies message when allyCount is 0', () => {
    const action = makeAction({
      automation: {
        type: 'teleport',
        effect: 'teleport',
        bringAllies: true,
        allyCount: 0,
      },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.queryByText(/bring up to/)).not.toBeInTheDocument();
  });

  it('uses default teleportRange of 10 ft when not specified', () => {
    const action = makeAction({
      automation: {
        type: 'teleport',
        effect: 'teleport',
        bringAllies: true,
        allyCount: 2,
      },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText(/10 ft/)).toBeInTheDocument();
  });

  // ── Cancel / close behavior ──

  it('calls onClose when Cancel button is clicked', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal content', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  // ── Teleport swap with illusion modal ──

  it('renders swap modal when effect is teleport_swap_with_illusion', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion', distance: '30 ft' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText(/Swap places with your illusion/)).toBeInTheDocument();
  });

  it('renders swap modal with arrows-rotate icon in header', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-arrows-rotate');
    expect(icon).toBeInTheDocument();
  });

  it('uses custom distance from automation for swap modal', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion', distance: '45 ft' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText(/up to 45 ft/)).toBeInTheDocument();
  });

  it('defaults swap distance to 30 ft when auto.distance is missing', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByText(/up to 30 ft/)).toBeInTheDocument();
  });

  it('renders Swap button with arrows-rotate icon in swap modal', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    const swapBtn = screen.getByRole('button', { name: /Swap/ });
    expect(swapBtn).toBeInTheDocument();
    expect(swapBtn.querySelector('.fa-solid.fa-arrows-rotate')).toBeInTheDocument();
  });

  it('renders Cancel button in swap modal', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Elemental stride modal ──

  it('renders elemental stride modal when triggeredByElementalStride is true', () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByText(/Teleport up to/)).toBeInTheDocument();
  });

  it('renders Thunder label in elemental stride header', () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByText(/Thunder/)).toBeInTheDocument();
  });

  it('renders wind icon in elemental stride header', () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    const icon = document.querySelector('.fa-solid.fa-wind');
    expect(icon).toBeInTheDocument();
  });

  it('uses teleportDistance from elemental option when available', () => {
    const action = makeAction({
      options: [{ effect: 'teleport', teleportDistance: '60 ft' }],
    });
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByText(/up to 60 ft/)).toBeInTheDocument();
  });

  it('defaults elemental distance to 30 ft when no teleportDistance option', () => {
    const action = makeAction({
      options: [{ effect: 'other' }],
    });
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByText(/up to 30 ft/)).toBeInTheDocument();
  });

  it('defaults elemental distance to 30 ft when options is empty', () => {
    const action = makeAction({ options: [] });
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByText(/up to 30 ft/)).toBeInTheDocument();
  });

  it('defaults elemental distance to 30 ft when options is null', () => {
    const action = makeAction({ automation: { ...makeAction().automation } });
    action.automation.options = undefined;
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByText(/up to 30 ft/)).toBeInTheDocument();
  });

  it('renders Teleport button with wind icon in elemental stride modal', () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    const teleportBtn = screen.getByRole('button', { name: /Teleport/ });
    expect(teleportBtn.querySelector('.fa-solid.fa-wind')).toBeInTheDocument();
  });

  it('renders Cancel button in elemental stride modal', () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Elemental stride confirm flow ──

  it('shows result state after elemental stride teleport', async () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(screen.getByText(/Teleported 30 ft/)).toBeInTheDocument();
    });
  });

  it('shows wind icon in elemental stride result header', async () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-solid.fa-wind');
      expect(icon).toBeInTheDocument();
    });
  });

  it('shows Done button after elemental stride teleport', async () => {
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done clicked after elemental stride teleport', async () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click after elemental stride teleport', async () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking modal content after elemental stride teleport', async () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('uses custom elemental distance in result description', async () => {
    const action = makeAction({
      options: [{ effect: 'teleport', teleportDistance: '60 ft' }],
    });
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
    });
  });

  // ── Confirm teleport with confirmTeleport handler ──

  it('calls confirmTeleport on standard teleport confirm', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 60 ft' },
    });
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
        action,
        mockPlayerStats,
        mockCampaignName,
        false
      );
    });
  });

  it('calls confirmTeleport with useExtended=true when extended selected', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 150 ft' },
    });
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    const radios = document.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
        action,
        mockPlayerStats,
        mockCampaignName,
        true
      );
    });
  });

  it('shows confirmTeleport result after async call', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 60 ft to an unoccupied space you can see.' },
    });
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Teleported 60 ft');
    });
  });

  it('shows tree icon in result header for standard teleport', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 60 ft' },
    });
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-solid.fa-tree');
      expect(icon).toBeInTheDocument();
    });
  });

  it('shows Done button after confirmTeleport result', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 60 ft' },
    });
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done clicked after confirmTeleport result', async () => {
    const onClose = vi.fn();
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 60 ft' },
    });
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Swap teleport result ──

  it('calls confirmTeleport for swap teleport', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Swapped places with your illusion.' },
    });
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Swap/ }));

    await waitFor(() => {
      expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalled();
    });
  });

  it('shows arrows-rotate icon in swap result header', async () => {
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Swapped places with your illusion.' },
    });
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Swap/ }));

    await waitFor(() => {
      const icon = document.querySelector('.sp-header .fa-solid.fa-arrows-rotate');
      expect(icon).toBeInTheDocument();
    });
  });

  // ── Overlay click behavior (all modal variants) ──

  it('closes on overlay click for standard modal', () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click for swap modal', () => {
    const onClose = vi.fn();
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click for elemental stride modal', () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Modal click behavior (all variants) ──

  it('does not close when clicking modal content for standard modal', () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking modal content for swap modal', () => {
    const onClose = vi.fn();
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when clicking modal content for elemental stride modal', () => {
    const onClose = vi.fn();
    const action = makeAction();
    render(<TeleportModal action={action} triggeredByElementalStride={true} {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Edge cases ──

  it('does not show result or buttons on initial render for standard modal', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not show result on initial render for swap modal', () => {
    const action = makeAction({
      automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
    });
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(screen.queryByText(/Swapped/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Swap/ })).toBeInTheDocument();
  });

  it('renders with proper CSS classes for all modal types', () => {
    const action = makeAction();
    render(<TeleportModal action={action} {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toHaveClass('sp-overlay');
    expect(document.querySelector('.sp-modal')).toHaveClass('sp-modal');
    expect(document.querySelector('.sp-header')).toHaveClass('sp-header');
    expect(document.querySelector('.sp-body')).toHaveClass('sp-body');
    expect(document.querySelector('.sp-actions')).toHaveClass('sp-actions');
  });
});
