// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArcaneChargeModal from './ArcaneChargeModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js', () => ({
  confirmArcaneCharge: vi.fn(),
}));

// ── Re-import mocked modules ──

import { confirmArcaneCharge } from '../../../../services/automation/handlers/class-sorcerer/arcaneChargeHandler.js';

// ── Test fixtures ──

const defaultAction = {
  name: 'Arcane Charge',
  automation: {
    type: 'teleport',
    distance: '30 ft',
  },
};

const defaultPlayerStats = {
  name: 'Sorcerer1',
  level: 5,
};

const defaultCampaignName = 'test-campaign';
const defaultDistance = '30 ft';

const defaultOnClose = vi.fn();

function makeProps(overrides) {
  return {
    action: { ...defaultAction, ...(overrides?.action || {}) },
    playerStats: { ...defaultPlayerStats, ...(overrides?.playerStats || {}) },
    campaignName: overrides?.campaignName ?? defaultCampaignName,
    distance: overrides?.distance ?? defaultDistance,
    onClose: overrides?.onClose ?? defaultOnClose,
  };
}

function defaultConfirmResponse(description) {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: defaultAction.name,
      description: description ?? `Arcane Charge: Teleported ${defaultDistance} to an unoccupied space you can see.`,
    },
  };
}

// ── Tests ──

describe('ArcaneChargeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal with action name and description', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
      expect(screen.getByText(/Teleport up to 30 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });

    it('renders the Teleport and Cancel buttons', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show a result or Done button on initial render', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('renders with a custom action name', () => {
      render(<ArcaneChargeModal {...makeProps({ action: { name: 'Blink', automation: { type: 'teleport', distance: '30 ft' } } })} />);
      expect(screen.getByText('Blink')).toBeInTheDocument();
    });

    it('renders description with a custom distance', () => {
      render(<ArcaneChargeModal {...makeProps({ distance: '60 ft' })} />);
      expect(screen.getByText(/Teleport up to 60 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });
  });

  // ── Close / dismiss behavior ──

  describe('close behavior', () => {
    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the overlay background is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the modal content is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Confirm / teleport flow ──

  describe('teleport confirm', () => {
    it('calls confirmArcaneCharge with action, playerStats, and campaignName', async () => {
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse());
      const playerStats = { name: 'CustomSorcerer', level: 10 };
      const campaignName = 'my-campaign';
      render(<ArcaneChargeModal {...makeProps({ playerStats, campaignName })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      expect(confirmArcaneCharge).toHaveBeenCalledWith(
        defaultAction,
        playerStats,
        campaignName
      );
    });

    it('swaps buttons and shows result description after confirm', async () => {
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse('Arcane Charge: Teleported 60 ft to a new position.'));
      render(<ArcaneChargeModal {...makeProps({ distance: '60 ft' })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Teleport/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
      });
    });

    it('renders HTML content in the result body', async () => {
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse('<strong>Arcane Charge</strong>: Teleported 30 ft.'));
      render(<ArcaneChargeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('<strong>Arcane Charge</strong>');
      });
    });
  });

  // ── Done button and post-confirm close behavior ──

  describe('post-confirm close', () => {
    it('calls onClose when the Done button is clicked', async () => {
      const onClose = vi.fn();
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse());
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the overlay is clicked after confirm', async () => {
      const onClose = vi.fn();
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse());
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with undefined props without throwing', () => {
      render(<ArcaneChargeModal {...makeProps({ action: null, playerStats: undefined, campaignName: undefined, onClose: undefined })} />);
      expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
    });

    it('renders description with distance 0', () => {
      render(<ArcaneChargeModal {...makeProps({ distance: 0 })} />);
      expect(screen.getByText(/Teleport up to 0 to an unoccupied space you can see/)).toBeInTheDocument();
    });

    it('renders description with distance null falling back to default', () => {
      render(<ArcaneChargeModal {...makeProps({ distance: null })} />);
      expect(screen.getByText(/Teleport up to 30 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });
  });

});
