// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PrimalCompanionSummonModal from './PrimalCompanionSummonModal.jsx';

vi.mock('../../../services/automation/handlers/class-ranger/primalCompanionHandler.js', () => ({
  confirmPrimalCompanionSummon: vi.fn(),
}));

import * as primalCompanionHandler from '../../../services/automation/handlers/class-ranger/primalCompanionHandler.js';

const baseProps = {
  action: {
    name: 'Summon Primal Companion',
    automation: {
      companionTypes: [
        {
          name: 'Beast of the Land',
          size: 'Medium',
          acFormula: '13 + WIS modifier',
          hpBase: 7,
          hpPerLevel: 5,
          speed: '40 ft',
          attacks: [{ name: 'Bite', damageDice: '1d6 + WIS modifier', damageFlat: '', damageType: 'Slashing' }],
        },
        {
          name: 'Beast of the Sea',
          size: 'Medium',
          acFormula: '13 + WIS modifier',
          hpBase: 7,
          hpPerLevel: 5,
          speed: '30 ft',
          specialSpeed: 'Swim 30 ft',
          attacks: [{ name: 'Bite', damageDice: '1d6 + WIS modifier', damageFlat: '', damageType: 'Piercing' }],
        },
        {
          name: 'Beast of the Sky',
          size: 'Small',
          acFormula: '13 + WIS modifier',
          hpBase: 5,
          hpPerLevel: 4,
          speed: '20 ft',
          specialSpeed: 'Fly 40 ft',
          attacks: [{ name: 'Beak', damageDice: '1d4 + WIS modifier', damageFlat: '', damageType: 'Piercing' }],
        },
      ],
    },
  },
  playerStats: { name: 'Ranger1', level: 5 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderModal(overrides) {
  return render(<PrimalCompanionSummonModal {...makeProps(overrides)} />);
}

const mockPopupResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Primal Companion',
    automationType: 'summon',
    description: 'Ranger1 summons a Primal Companion (Beast of the Land). It acts on your turn, right after you.',
    automation: { type: 'summon' },
  },
};

describe('PrimalCompanionSummonModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render ──

  describe('initial render', () => {
    it('displays the companion selection prompt, all companion options, cancel button, and disabled summon button', () => {
      renderModal();
      expect(screen.getByText('Summon Primal Companion')).toBeInTheDocument();
      expect(screen.getByText('Choose a primal beast to bond with:')).toBeInTheDocument();
      expect(screen.getByText('Beast of the Land')).toBeInTheDocument();
      expect(screen.getByText('Beast of the Sea')).toBeInTheDocument();
      expect(screen.getByText('Beast of the Sky')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Summon Primal Companion/ })).toBeDisabled();
    });
  });

  // ── Companion type info display ──

  describe('companion type info display', () => {
    it('renders stats for default companion types', () => {
      renderModal();
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('AC 13 + WIS modifier');
      expect(body.textContent).toContain('HP 7+5xRanger level');
      expect(body.textContent).toContain('40 ft');
      expect(body.textContent).toContain('1d6 + WIS modifier');
      expect(body.textContent).toContain('Slashing');
    });

    it('renders no attacks info when attacks array is empty', () => {
      const props = makeProps({
        action: {
          name: 'Summon Primal Companion',
          automation: {
            companionTypes: [
              {
                name: 'Peaceful Beast',
                size: 'Medium',
                acFormula: '12',
                hpBase: 10,
                hpPerLevel: 3,
                attacks: [],
              },
            ],
          },
        },
      });
      render(<PrimalCompanionSummonModal {...props} />);
      expect(screen.getByText('Peaceful Beast')).toBeInTheDocument();
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('AC 12');
      expect(body.textContent).toContain('HP 10+3xRanger level');
      expect(body.textContent).not.toContain('Attack');
    });

    it('renders companion with no AC formula', () => {
      const props = makeProps({
        action: {
          name: 'Summon Primal Companion',
          automation: {
            companionTypes: [
              {
                name: 'Mystic Beast',
                size: 'Medium',
                hpBase: 10,
                hpPerLevel: 3,
                attacks: [],
              },
            ],
          },
        },
      });
      render(<PrimalCompanionSummonModal {...props} />);
      expect(screen.getByText('Mystic Beast')).toBeInTheDocument();
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('HP 10+3xRanger level');
    });
  });

  // ── Companion type selection ──

  describe('companion type selection', () => {
    it('enables summon button when a companion type is selected and updates on switch', async () => {
      renderModal();
      const summonBtn = screen.getByRole('button', { name: /Summon Primal Companion/ });
      expect(summonBtn).toBeDisabled();

      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Sea'));
      });
      expect(summonBtn).toBeEnabled();

      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      expect(summonBtn).toBeEnabled();

      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Sky'));
      });
      expect(summonBtn).toBeEnabled();
    });
  });

  // ── Confirm behavior ──

  describe('confirm behavior', () => {
    it('calls confirmPrimalCompanionSummon with the selected type', async () => {
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(mockPopupResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      expect(primalCompanionHandler.confirmPrimalCompanionSummon).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Summon Primal Companion' }),
        expect.objectContaining({ name: 'Ranger1' }),
        'test-campaign',
        'Beast of the Land',
      );
    });

    it('does not call confirmPrimalCompanionSummon when no type is selected', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      expect(primalCompanionHandler.confirmPrimalCompanionSummon).not.toHaveBeenCalled();
    });

    it('shows the result screen after a successful summon', async () => {
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(mockPopupResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('renders description as HTML in the result body', async () => {
      const customResult = {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Summon Primal Companion',
          description: '<p>The beast appears and awaits your command.</p>',
        },
      };
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(customResult);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('p')).toBeInTheDocument();
      });
    });

    it('does not show result screen when handler returns null', async () => {
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(null);
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('closes on cancel button click', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking the overlay background', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });



    it('closes on Done button click in result screen', async () => {
      const onClose = vi.fn();
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(mockPopupResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking the overlay in result screen', async () => {
      const onClose = vi.fn();
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(mockPopupResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('does not close when clicking the modal in result screen', async () => {
      const onClose = vi.fn();
      primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(mockPopupResult);
      renderModal({ onClose });
      await act(async () => {
        fireEvent.click(screen.getByText('Beast of the Land'));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
      });
      await waitFor(() => {
        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Null safety ──

  describe('null safety', () => {
    it('renders with no companion types when automation is missing', () => {
      const props = makeProps({
        action: { name: 'Summon Primal Companion' },
      });
      render(<PrimalCompanionSummonModal {...props} />);
      expect(screen.getByText('Summon Primal Companion')).toBeInTheDocument();
      expect(screen.getByText('Choose a primal beast to bond with:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Summon Primal Companion/ })).toBeInTheDocument();
    });

    it('renders with empty companion types array', () => {
      const props = makeProps({
        action: {
          name: 'Summon Primal Companion',
          automation: { companionTypes: [] },
        },
      });
      render(<PrimalCompanionSummonModal {...props} />);
      expect(screen.getByText('Summon Primal Companion')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Summon Primal Companion/ })).toBeDisabled();
    });

    it('renders with nullish action', () => {
      const props = makeProps({
        action: null,
      });
      render(<PrimalCompanionSummonModal {...props} />);
      expect(screen.getByText('Primal Companion')).toBeInTheDocument();
    });
  });
});
