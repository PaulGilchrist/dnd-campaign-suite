// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NaturalRecoveryModal from './NaturalRecoveryModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import * as useRuntimeState from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const mockOnClose = vi.fn();

function makePlayerStats(overrides = {}) {
  return {
    name: 'Druid1',
    class: { major: { name: 'Circle of the Moon' } },
    spellAbilities: {
      spells: [
        { name: 'Moonbeam', level: 2, prepared: 'Always' },
        { name: 'Cure Wounds', level: 1, prepared: 'Always' },
        { name: 'Healing Word', level: 1, prepared: 'Prepared' },
        { name: 'Druidcraft', level: 0, prepared: 'Always' },
      ],
    },
    ...overrides,
  };
}

function mockRuntimeValues(valuesBykey = {}) {
  useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => valuesBykey[key] ?? null);
}

function renderModal(playerStats, campaignName) {
  return {
    ...render(
      <NaturalRecoveryModal
        playerStats={playerStats ?? makePlayerStats()}
        campaignName={campaignName ?? 'test-campaign'}
        onClose={mockOnClose}
      />
    ),
    onClose: mockOnClose,
  };
}

describe('NaturalRecoveryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockImplementation(() => null);
  });

  it('offers Cancel and the list of Always-prepared level 1+ spells when no free cast is active', () => {
    renderModal();
    expect(screen.getByText('Natural Recovery')).toBeInTheDocument();
    expect(screen.getByText(/Free Cast — 1\/Long Rest/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
    // Eligibility: Always-prepared and level >= 1 only.
    expect(screen.getByRole('button', { name: /Moonbeam/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cure Wounds/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Healing Word/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Druidcraft/ })).not.toBeInTheDocument();
  });

  it('grants the free cast to the selected spell, logs it, and closes', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Cure Wounds/ }));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Druid1', 'naturalRecoveryFreeCast', ['Cure Wounds'], 'test-campaign'
    );
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid1',
        abilityName: 'Natural Recovery',
        description: 'Granted free cast: Cure Wounds',
      })
    );
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows the granted spell with a working Close button and no selection list once granted', () => {
    mockRuntimeValues({ naturalRecoveryFreeCast: ['Cure Wounds'] });
    renderModal();
    expect(screen.getByText(/Free cast granted to:/)).toBeInTheDocument();
    expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Moonbeam/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows a blocked message with a Close button and no selection list once used', () => {
    mockRuntimeValues({ naturalRecoveryFreeCastUsed: true });
    renderModal();
    expect(screen.getByText(/already used this long rest/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Moonbeam/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows a blocked message when no spells are eligible', () => {
    renderModal(makePlayerStats({ spellAbilities: { spells: [] } }));
    expect(screen.getByText(/No eligible spells found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('restricts Circle of the Land choices to matching land-type spells of level 1+', () => {
    mockRuntimeValues({ _circleOfTheLandType: 'arid' });
    const stats = makePlayerStats({
      class: { major: { name: 'Circle of the Land', spells: [
        { name: 'Blur', level: 3, landType: 'arid' },
        { name: 'Fireball', level: 5, landType: 'arid' },
        { name: 'Produce Flame', level: 0, landType: 'arid' },
        { name: 'Fog Cloud', level: 3, landType: 'polar' },
      ] } },
      spellAbilities: {
        spells: [
          { name: 'Blur', level: 3, prepared: 'Always' },
          { name: 'Fireball', level: 5, prepared: 'Always' },
          { name: 'Produce Flame', level: 0, prepared: 'Always' },
          { name: 'Fog Cloud', level: 3, prepared: 'Always' },
          { name: 'Cone of Cold', level: 9, prepared: 'Always' },
          { name: 'Healing Word', level: 1, prepared: 'Prepared' },
        ],
      },
    });
    renderModal(stats);
    expect(screen.getByRole('button', { name: /Blur/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fireball/ })).toBeInTheDocument();
    // Fails one filter each: land mismatch, level 0, not Always-prepared.
    expect(screen.queryByRole('button', { name: /Fog Cloud/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Produce Flame/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Healing Word/ })).not.toBeInTheDocument();
  });

  it('closes on Escape but not on a click of the overlay background', () => {
    const { container } = renderModal();
    fireEvent.click(container.querySelector('.nr-overlay'));
    expect(mockOnClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
