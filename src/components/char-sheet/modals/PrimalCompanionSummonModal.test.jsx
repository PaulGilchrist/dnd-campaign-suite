// @maintained-by-ai 2026-11-27
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

function renderModal(overrides) {
  return render(<PrimalCompanionSummonModal {...baseProps} {...(overrides || {})} />);
}

async function summonSelected() {
  fireEvent.click(screen.getByRole('radio', { name: /Beast of the Sea/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Summon Primal Companion/ }));
  });
}

describe('PrimalCompanionSummonModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every companion type with its AC, HP, speed, and attack stats, with Cancel and a disabled Summon button', () => {
    renderModal();
    expect(screen.getByText('Choose a primal beast to bond with:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Summon Primal Companion/ })).toBeDisabled();

    const body = screen.getByText('Choose a primal beast to bond with:').parentElement;
    expect(body.textContent).toContain('Beast of the Land');
    expect(body.textContent).toContain('Medium');
    expect(body.textContent).toContain('AC 13 + WIS modifier, HP 7+5xRanger level');
    expect(body.textContent).toContain('Speed: 40 ft');
    expect(body.textContent).toContain('Bite: 1d6 + WIS modifier Slashing');
    // specialSpeed and per-type variant stats render too
    expect(body.textContent).toContain('Speed: 30 ft, Swim 30 ft');
    expect(body.textContent).toContain('HP 5+4xRanger level');
    expect(body.textContent).toContain('Beak: 1d4 + WIS modifier Piercing');
  });

  it('omits stat lines for missing fields rather than rendering "undefined" (ledger :194)', () => {
    renderModal({
      action: {
        name: 'Summon Primal Companion',
        automation: {
          companionTypes: [
            { name: 'Peaceful Beast', size: 'Medium', hpBase: 10, hpPerLevel: 3, attacks: [] },
          ],
        },
      },
    });
    const body = screen.getByText('Choose a primal beast to bond with:').parentElement;
    expect(body.textContent).toContain('Peaceful Beast');
    expect(body.textContent).toContain('HP 10+3xRanger level');
    expect(body.textContent).not.toContain('undefined');
    expect(body.textContent).not.toContain('AC');
    expect(body.textContent).not.toContain('Speed');
    expect(body.textContent).not.toContain('Attack');
    expect(body.textContent).not.toContain('Bite');
  });

  it('gates Summon on a selection, submits the newest pick, and stays on the selection screen when the handler returns no result', async () => {
    primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue(null);
    const onClose = vi.fn();
    renderModal({ onClose });
    const summonBtn = screen.getByRole('button', { name: /Summon Primal Companion/ });

    fireEvent.click(summonBtn);
    expect(primalCompanionHandler.confirmPrimalCompanionSummon).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: /Beast of the Land/ }));
    expect(summonBtn).toBeEnabled();

    // switching selection stays enabled, marks only the newest pick, and submits it
    fireEvent.click(screen.getByRole('radio', { name: /Beast of the Sea/ }));
    expect(summonBtn).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Beast of the Sea/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Beast of the Land/ })).not.toBeChecked();

    await act(async () => {
      fireEvent.click(summonBtn);
    });
    expect(primalCompanionHandler.confirmPrimalCompanionSummon).toHaveBeenCalledTimes(1);
    expect(primalCompanionHandler.confirmPrimalCompanionSummon).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Summon Primal Companion' }),
      expect.objectContaining({ name: 'Ranger1' }),
      'test-campaign',
      'Beast of the Sea',
    );

    // a null result keeps the selection UI in place — no result screen, no close
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByText('Choose a primal beast to bond with:')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('replaces the selection UI with the HTML description and closes via Done after a successful summon', async () => {
    primalCompanionHandler.confirmPrimalCompanionSummon.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Summon Primal Companion',
        description: '<p>The beast appears and awaits your command.</p>',
      },
    });
    const onClose = vi.fn();
    renderModal({ onClose });
    await summonSelected();

    await waitFor(() => expect(screen.getByText('The beast appears and awaits your command.')).toBeInTheDocument());
    expect(screen.getByText('The beast appears and awaits your command.').closest('p')).toBeInTheDocument();
    expect(screen.queryByText('Choose a primal beast to bond with:')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Beast of the Sea/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Cancel but not on overlay click', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByText('Choose a primal beast to bond with:').closest('.sp-overlay'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders an empty, disabled selection screen when the action data is missing', () => {
    // action?.automation?.companionTypes || [] — the null action exercises every optional link
    renderModal({ action: null });
    expect(screen.getByText('Primal Companion')).toBeInTheDocument();
    expect(screen.getByText('Choose a primal beast to bond with:')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Summon Primal Companion/ })).toBeDisabled();
  });
});
