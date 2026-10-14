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

// ── Tests ──

describe('TeleportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    tempTeleportHandler.isExtendedAvailable.mockReturnValue(true);
    tempTeleportHandler.confirmTeleport.mockReset();
  });

  // ── Standard teleport modal rendering ──

  describe('standard teleport modal', () => {
    it('renders header with action name and tree icon', () => {
      const action = makeAction({ name: 'Misty Step' });
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByText('Misty Step')).toBeInTheDocument();
    });

    it('renders header with moon icon when isMoonlightStep is true', () => {
      const action = makeAction({ name: 'Shadow Step' });
      render(<TeleportModal action={action} {...makeProps({ isMoonlightStep: true })} />);
      expect(screen.getByText('Shadow Step')).toBeInTheDocument();
      expect(screen.queryByLabelText('Standard teleport')).not.toBeInTheDocument();
    });

    it('displays advantage text for moonlight step and no radios', () => {
      const action = makeAction({ name: 'Shadow Step' });
      render(<TeleportModal action={action} {...makeProps({ isMoonlightStep: true })} />);
      expect(screen.getByText('Gains Advantage on next attack roll.')).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
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
      const standardRadio = screen.getByRole('radio', { name: '30 ft— Standard teleport' });
      const extendedRadio = screen.getByRole('radio', { name: '60 ft— Once per Rage' });
      expect(standardRadio).toBeChecked();
      expect(extendedRadio).not.toBeChecked();
      fireEvent.click(extendedRadio);
      expect(extendedRadio).toBeChecked();
      expect(standardRadio).not.toBeChecked();
    });

    it('calls onClose when Cancel is clicked', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('disables extended radio and shows used label when not available, preventing selection', () => {
      tempTeleportHandler.isExtendedAvailable.mockReturnValue(false);
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      const standardRadio = screen.getByRole('radio', { name: '30 ft— Standard teleport' });
      const extendedRadio = screen.getByRole('radio', { name: '60 ft— Already used this Rage' });
      expect(extendedRadio.disabled).toBe(true);
      fireEvent.click(extendedRadio);
      expect(extendedRadio).not.toBeChecked();
      expect(standardRadio).toBeChecked();
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

    it('renders swap-specific header text, distance, and Swap button', () => {
      render(<TeleportModal action={swapAction()} {...makeProps()} />);
      expect(screen.getByText(/Swap places with your illusion/)).toBeInTheDocument();
      expect(screen.getByText(/up to 30 ft/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Swap/ })).toBeInTheDocument();
    });

    it('uses custom distance from automation config or defaults to 30 ft', () => {
      const action = makeAction({
        automation: { type: 'teleport', effect: 'teleport_swap_with_illusion', distance: '45 ft' },
      });
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.getByText(/up to 45 ft/)).toBeInTheDocument();
    });
  });

  // ── Elemental stride modal ──

  describe('elemental stride modal', () => {
    const elementalProps = () => makeProps({ triggeredByElementalStride: true });

    it('renders with wind icon, Thunder label, distance instruction, and buttons', () => {
      render(<TeleportModal action={makeAction()} {...elementalProps()} />);
      expect(screen.getByText(/Thunder/)).toBeInTheDocument();
      expect(screen.getByText(/Teleport up to/)).toBeInTheDocument();
      expect(screen.getByText(/30 ft/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('uses teleportDistance from options or defaults to 30 ft', () => {
      const action = makeAction({
        automation: { options: [{ effect: 'teleport', teleportDistance: '60 ft' }] },
      });
      render(<TeleportModal action={action} {...elementalProps()} />);
      expect(screen.getByText(/up to 60 ft/)).toBeInTheDocument();
    });
  });

  // ── No result state on initial render (all modal types) ──

  describe('no result state on initial render', () => {
    it('standard modal', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('swap modal', () => {
      const action = makeAction({
        automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
      });
      render(<TeleportModal action={action} {...makeProps()} />);
      expect(screen.queryByText(/Swapped/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('elemental stride modal', () => {
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps({ triggeredByElementalStride: true })} />);
      expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Elemental stride confirm flow ──

  describe('elemental stride confirm flow', () => {
    it('shows result state with Done button and uses custom distance in result description', async () => {
      const onClose = vi.fn();
      const action = makeAction({
        automation: { options: [{ effect: 'teleport', teleportDistance: '60 ft' }] },
      });
      render(<TeleportModal action={action} {...makeProps({ triggeredByElementalStride: true, onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Standard teleport confirm flow ──

  describe('standard teleport confirm flow', () => {
    it('calls confirmTeleport with useExtended=false by default and shows result with Done button', async () => {
      const onClose = vi.fn();
      tempTeleportHandler.confirmTeleport.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Teleported 60 ft' },
      });
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));

      await waitFor(() => {
        expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
          action,
          mockPlayerStats,
          mockCampaignName,
          false
        );
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls confirmTeleport with useExtended=true when extended radio is selected', async () => {
      tempTeleportHandler.confirmTeleport.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Teleported 60 ft' },
      });
      const action = makeAction();
      render(<TeleportModal action={action} {...makeProps()} />);
      const extendedRadio = screen.getByRole('radio', { name: '60 ft— Once per Rage' });
      fireEvent.click(extendedRadio);
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
  });

  // ── Swap teleport confirm flow ──

  describe('swap teleport confirm flow', () => {
    it('calls confirmTeleport with correct arguments, shows result state with Done button', async () => {
      const onClose = vi.fn();
      tempTeleportHandler.confirmTeleport.mockResolvedValue({
        type: 'popup',
        payload: { description: 'Swapped places with your illusion.' },
      });
      const action = makeAction({
        automation: { type: 'teleport', effect: 'teleport_swap_with_illusion' },
      });
      render(<TeleportModal action={action} {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: /Swap/ }));

      await waitFor(() => {
        expect(tempTeleportHandler.confirmTeleport).toHaveBeenCalledWith(
          action,
          mockPlayerStats,
          mockCampaignName,
          false
        );
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
