// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeleportModal from './TeleportModal.jsx';

// ── Mocked modules ──
// Handler internals (movement, token relocation, extended-flag lifecycle) are
// covered by tempTeleportHandler.test.js and tempTeleportHandler.cla366-transposition.test.js.
// This file owns only the modal UI lane: view selection, copy, radios, exact
// payloads handed to confirmTeleport, and close handling.

vi.mock('../../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn(),
  isExtendedAvailable: vi.fn(() => true),
}));

import * as tempTeleportHandler from '../../../services/automation/handlers/class-warlock/tempTeleportHandler.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Paladin1', level: 5, hitPoints: 40 };
const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: mockPlayerStats,
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function makeAction(overrides) {
  return {
    name: 'Misty Step',
    automation: {
      type: 'teleport',
      effect: 'teleport',
      ...(overrides?.automation || {}),
    },
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('TeleportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(true);
  });

  it('renders the standard modal with default distance selected and closes on Cancel', () => {
    const props = makeProps();
    render(<TeleportModal action={makeAction({ automation: { distance: '30 ft', extendedDistance: '60 ft' } })} {...props} />);

    expect(screen.getByText('Misty Step')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '30 ft— Standard teleport' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '60 ft— Once per Rage' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
    // No result state before confirming
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to 60 ft / 150 ft radios when automation omits distances', () => {
    render(<TeleportModal action={makeAction()} {...makeProps()} />);

    expect(screen.getByRole('radio', { name: '60 ft— Standard teleport' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '150 ft— Once per Rage' })).toBeInTheDocument();
  });

  it('submits the selected distance to confirmTeleport and shows the handler result', async () => {
    // Standard (default) leg — payload must carry useExtended=false
    const onClose = vi.fn();
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Teleported 60 ft' },
    });
    const action = makeAction({ automation: { distance: '30 ft', extendedDistance: '60 ft' } });
    const { unmount } = render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
        action, mockPlayerStats, mockCampaignName, false
      );
    });
    expect(screen.getByText('Teleported 60 ft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    // Extended leg — selecting the extended radio must flip the payload flag
    const props = makeProps();
    render(<TeleportModal action={action} {...props} />);
    const extendedRadio = screen.getByRole('radio', { name: '60 ft— Once per Rage' });
    fireEvent.click(extendedRadio);
    expect(extendedRadio).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

    await waitFor(() => {
      expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
        action, mockPlayerStats, mockCampaignName, true
      );
    });
  });

  it('disables the extended radio and blocks selection when unavailable', () => {
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
    const action = makeAction({ automation: { distance: '30 ft', extendedDistance: '60 ft' } });
    render(<TeleportModal action={action} {...makeProps()} />);

    expect(tempTeleportHandler.isExtendedAvailable).toHaveBeenCalledWith(mockPlayerStats.name, mockCampaignName);
    const extendedRadio = screen.getByRole('radio', { name: '60 ft— Already used this Rage' });
    expect(extendedRadio.disabled).toBe(true);
    fireEvent.click(extendedRadio);
    expect(extendedRadio).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '30 ft— Standard teleport' })).toBeChecked();
    expect(tempTeleportHandler.confirmTeleport).not.toHaveBeenCalled();
  });

  it('moonlight step shows advantage copy instead of distance radios', () => {
    render(<TeleportModal action={makeAction({ name: 'Shadow Step' })} {...makeProps({ isMoonlightStep: true })} />);

    expect(screen.getByText('Gains Advantage on next attack roll.')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('shows the bring-allies note with ally count and destination range, hidden when flag is off', () => {
    const withAllies = makeAction({
      automation: { distance: '30 ft', bringAllies: true, allyCount: 3, teleportRange: '30 ft' },
    });
    const { unmount } = render(<TeleportModal action={withAllies} {...makeProps()} />);
    expect(screen.getByText(/bring up to 3 willing creatures/)).toBeInTheDocument();
    expect(screen.getByText(/within 30 ft of your destination/)).toBeInTheDocument();
    unmount();

    const withoutAllies = makeAction({ automation: { distance: '30 ft', bringAllies: false, allyCount: 0 } });
    render(<TeleportModal action={withoutAllies} {...makeProps()} />);
    expect(screen.queryByText(/bring up to/)).not.toBeInTheDocument();
  });

  it('swap modal shows fallback and custom distances, swaps with useExtended=false, Done closes', async () => {
    // Fallback leg: automation omits distance → copy must read "up to 30 ft"
    const fallbackAction = makeAction({ automation: { effect: 'teleport_swap_with_illusion' } });
    const { unmount } = render(<TeleportModal action={fallbackAction} {...makeProps()} />);
    expect(screen.getByText(/Swap places with your illusion \(up to 30 ft\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    unmount();

    // Custom distance + confirm flow
    const onClose = vi.fn();
    tempTeleportHandler.confirmTeleport.mockResolvedValue({
      type: 'popup',
      payload: { description: 'Swapped places with your illusion.' },
    });
    const action = makeAction({ automation: { effect: 'teleport_swap_with_illusion', distance: '45 ft' } });
    render(<TeleportModal action={action} {...makeProps({ onClose })} />);
    expect(screen.getByText(/up to 45 ft/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Swap/ }));
    await waitFor(() => {
      expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
        action, mockPlayerStats, mockCampaignName, false
      );
    });
    expect(screen.getByText('Swapped places with your illusion.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('elemental stride uses modal-built result and bypasses confirmTeleport', async () => {
    // Fallback leg: no teleport option in automation → "up to 30 ft"
    const fallbackAction = makeAction();
    const { unmount } = render(
      <TeleportModal action={fallbackAction} {...makeProps({ triggeredByElementalStride: true })} />
    );
    expect(screen.getByText(/Thunder/)).toBeInTheDocument();
    expect(screen.getByText(/Teleport up to 30 ft/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    unmount();

    // Custom distance + confirm
    const onClose = vi.fn();
    const action = makeAction({ automation: { options: [{ effect: 'teleport', teleportDistance: '60 ft' }] } });
    render(
      <TeleportModal action={action} {...makeProps({ triggeredByElementalStride: true, onClose })} />
    );
    expect(screen.getByText(/Teleport up to 60 ft/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
    await waitFor(() => {
      expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(tempTeleportHandler.confirmTeleport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
