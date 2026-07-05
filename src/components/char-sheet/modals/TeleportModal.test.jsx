// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeleportModal from './TeleportModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn(),
  isExtendedAvailable: vi.fn(() => true),
}));

// ── Re-import mocked modules ──

import * as tempTeleportHandler from '../../../services/automation/handlers/class-warlock/tempTeleportHandler.js';

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
      ...(overrides?.automation || {}),
    },
    ...(overrides || {}),
  };
}

// ── Helpers ──

function getRadios(container) {
  return container.querySelectorAll('input[type="radio"]');
}

// ── Tests ──

describe('TeleportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(true);
  });

  // ── Standard teleport modal rendering ──

  describe('standard teleport modal', () => {
    it('renders header with action name and tree icon', () => {
      const action = makeAction({ name: 'Misty Step' });
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByText('Misty Step')).toBeInTheDocument();
    });

    it('displays teleport instruction text', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByText('Teleport to an unoccupied space you can see:')).toBeInTheDocument();
    });

    it('renders standard and extended distance radios with correct labels', () => {
      const action = makeAction({
        automation: { type: 'teleport', effect: 'teleport' },
      });
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByText('60 ft')).toBeInTheDocument();
      expect(screen.getByText('150 ft')).toBeInTheDocument();
      expect(screen.getByText('— Standard teleport')).toBeInTheDocument();
      expect(screen.getByText('— Once per Rage')).toBeInTheDocument();
    });

    it('uses custom distance values from automation config', () => {
      const action = makeAction({
        automation: { type: 'teleport', effect: 'teleport', distance: '30 ft', extendedDistance: '60 ft' },
      });
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByText('30 ft')).toBeInTheDocument();
      expect(screen.getByText('60 ft')).toBeInTheDocument();
    });

    it('selects standard distance radio by default and allows switching', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      const radios = getRadios(document);
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
      fireEvent.click(radios[1]);
      expect(radios[1]).toBeChecked();
      expect(radios[0]).not.toBeChecked();
    });

    it('renders Teleport and Cancel buttons', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show result state on initial render', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Extended distance disabled state ──

  describe('extended distance availability', () => {
    it('disables extended distance radio and shows used label when not available', () => {
      tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      const radios = getRadios(document);
      expect(radios[1].disabled).toBe(true);
      expect(screen.getByText('— Already used this Rage')).toBeInTheDocument();
    });

    it('prevents switching to disabled extended radio', () => {
      tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      const radios = getRadios(document);
      fireEvent.click(radios[1]);
      expect(radios[1]).not.toBeChecked();
      expect(radios[0]).toBeChecked();
    });
  });

  // ── Bring allies display ──

  describe('bring allies message', () => {
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

    it('hides bring allies message when bringAllies is false or allyCount is 0', () => {
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
  });

  // ── Swap teleport modal ──

  describe('swap teleport modal', () => {
    const swapAction = () =>
      makeAction({
        automation: { type: 'teleport', effect: 'teleport_swap_with_illusion', distance: '30 ft' },
      });

    it('renders swap-specific header text and Swap button', () => {
      render(<TeleportModal action={swapAction()} {...makeProps()} />);
      expect(screen.getByText(/Swap places with your illusion/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Swap/ })).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<TeleportModal action={swapAction()} {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('uses custom distance from automation config or defaults to 30 ft', () => {
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

    it('does not show result state on initial render', () => {
      render(<TeleportModal action={swapAction()} {...makeProps()} />);
      expect(screen.queryByText(/Swapped/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Elemental stride modal ──

  describe('elemental stride modal', () => {
    const elementalProps = () => makeProps({ triggeredByElementalStride: true });

    it('renders with wind icon and Thunder label in header', () => {
      render(<TeleportModal action={makeAction()} {...elementalProps()} />);
      expect(screen.getByText(/Thunder/)).toBeInTheDocument();
    });

    it('displays teleport distance instruction with correct distance', () => {
      render(<TeleportModal action={makeAction()} {...elementalProps()} />);
      expect(screen.getByText(/Teleport up to/)).toBeInTheDocument();
    });

    it('uses teleportDistance from options when available', () => {
      const action = makeAction({
        automation: { options: [{ effect: 'teleport', teleportDistance: '60 ft' }] },
      });
      render(<TeleportModal action={action} {...elementalProps()} />);
      expect(screen.getByText(/up to 60 ft/)).toBeInTheDocument();
    });

    it('defaults elemental distance to 30 ft when options is missing or has no teleport entry', () => {
      const action = makeAction({ automation: { options: [{ effect: 'other' }] } });
      render(<TeleportModal action={action} {...elementalProps()} />);
      expect(screen.getByText(/up to 30 ft/)).toBeInTheDocument();
    });

    it('renders Teleport and Cancel buttons', () => {
      render(<TeleportModal action={makeAction()} {...elementalProps()} />);
      expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Elemental stride confirm flow ──

  describe('elemental stride confirm flow', () => {
    it('shows result state with Done button after teleport click', async () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps({ triggeredByElementalStride: true })} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        expect(screen.getByText(/Teleported 30 ft/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('calls onClose when Done is clicked in result state', async () => {
      const onClose = vi.fn();
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps({ triggeredByElementalStride: true, onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('uses custom elemental distance in result description', async () => {
      const action = makeAction({
        automation: { options: [{ effect: 'teleport', teleportDistance: '60 ft' }] },
      });
      render(<TeleportModal action={action} {...makeProps({ triggeredByElementalStride: true })} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
      });
    });
  });

  // ── Standard teleport confirm flow ──

  describe('standard teleport confirm flow', () => {
    it('calls confirmTeleport with useExtended=false by default', async () => {
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

    it('calls confirmTeleport with useExtended=true when extended radio is selected', async () => {
      tempTeleportHandler.confirmTeleport.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Teleported 150 ft' },
      });
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      const radios = getRadios(document);
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

    it('renders result description from confirmTeleport response', async () => {
      tempTeleportHandler.confirmTeleport.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Teleported 60 ft to an unoccupied space you can see.' },
      });
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
      });
    });

    it('shows Done button and calls onClose after confirmTeleport resolves', async () => {
      const onClose = vi.fn();
      tempTeleportHandler.confirmTeleport.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Teleported 60 ft' },
      });
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Swap teleport confirm flow ──

  describe('swap teleport confirm flow', () => {
    it('calls confirmTeleport when Swap button is clicked', async () => {
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
  });
});
