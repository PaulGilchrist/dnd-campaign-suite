// @improved-by-ai
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
    it('renders the modal overlay structure with all expected sections', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with the action name and wind icon', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-wind')).toBeInTheDocument();
    });

    it('renders the description with the distance prop value', () => {
      render(<ArcaneChargeModal {...makeProps({ distance: '60 ft' })} />);
      expect(screen.getByText(/Teleport up to 60 ft to an unoccupied space you can see/)).toBeInTheDocument();
    });

    it('renders the Teleport and Cancel buttons', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Teleport/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders the wind icon on the Teleport button', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      const teleportBtn = screen.getByRole('button', { name: /Teleport/ });
      expect(teleportBtn.querySelector('.fa-solid.fa-wind')).toBeInTheDocument();
    });

    it('does not show a result or Done button on initial render', () => {
      render(<ArcaneChargeModal {...makeProps()} />);
      expect(screen.queryByText(/Teleported/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });

    it('renders with a custom action name', () => {
      render(<ArcaneChargeModal {...makeProps({ action: { name: 'Blink', automation: { type: 'teleport', distance: '30 ft' } } })} />);
      expect(screen.getByText('Blink')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-wind')).toBeInTheDocument();
    });

    it('renders description with an empty distance string', () => {
      render(<ArcaneChargeModal {...makeProps({ distance: '' })} />);
      const body = document.querySelector('.sp-body p');
      expect(body.textContent).toContain('Teleport up to');
      expect(body.textContent).toContain('to an unoccupied space');
    });
  });

  // ── Close / dismiss behavior ──

  describe('close behavior', () => {
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

    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
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

    it('hides Teleport and Cancel buttons and shows Done button after confirm', async () => {
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse());
      render(<ArcaneChargeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Teleport/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('shows the result description from the handler response', async () => {
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse('Arcane Charge: Teleported 60 ft to a new position.'));
      render(<ArcaneChargeModal {...makeProps({ distance: '60 ft' })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        expect(screen.getByText(/Teleported 60 ft/)).toBeInTheDocument();
      });
    });

    it('renders the result body with dangerouslySetInnerHTML for HTML content', async () => {
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

    it('keeps the header and wind icon visible in the result state', async () => {
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse());
      render(<ArcaneChargeModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        expect(screen.getByText('Arcane Charge')).toBeInTheDocument();
        expect(document.querySelector('.sp-header .fa-solid.fa-wind')).toBeInTheDocument();
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

    it('does not call onClose when the modal content is clicked after confirm', async () => {
      const onClose = vi.fn();
      confirmArcaneCharge.mockResolvedValue(defaultConfirmResponse());
      render(<ArcaneChargeModal {...makeProps({ onClose })} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Teleport/ }));
      });
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });


});
