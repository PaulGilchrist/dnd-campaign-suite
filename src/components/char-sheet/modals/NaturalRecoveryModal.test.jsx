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

function renderModal(playerStats, campaignName, onClose) {
  const handleClose = onClose ?? vi.fn();
  return {
    ...render(
      <NaturalRecoveryModal
        playerStats={playerStats ?? makePlayerStats()}
        campaignName={campaignName ?? 'test-campaign'}
        onClose={handleClose}
      />
    ),
    handleClose,
  };
}

describe('NaturalRecoveryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockImplementation(() => null);
  });

  it('renders the modal with title', () => {
    renderModal();
    expect(screen.getByText(/Natural Recovery/)).toBeInTheDocument();
    expect(screen.getByText(/Free Cast/)).toBeInTheDocument();
  });

  it('shows only Always-prepared circle spells (level 1+)', () => {
    renderModal();
    expect(screen.getByText('Moonbeam')).toBeInTheDocument();
    expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
    expect(screen.queryByText('Healing Word')).not.toBeInTheDocument();
    expect(screen.queryByText('Druidcraft')).not.toBeInTheDocument();
  });

  it('sets naturalRecoveryFreeCast when a spell is selected', () => {
    renderModal();
    fireEvent.click(screen.getByText('Moonbeam'));
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Druid1',
      'naturalRecoveryFreeCast',
      ['Moonbeam'],
      'test-campaign'
    );
  });

  it('logs the ability use when a spell is selected', () => {
    renderModal();
    fireEvent.click(screen.getByText('Cure Wounds'));
    expect(addEntry).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'Druid1',
        abilityName: 'Natural Recovery',
        description: 'Granted free cast: Cure Wounds',
      })
    );
  });

  it('calls onClose after selecting a spell', () => {
    const { handleClose } = renderModal();
    fireEvent.click(screen.getByText('Moonbeam'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('shows granted message when free cast is already granted', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'naturalRecoveryFreeCast') return ['Moonbeam'];
      return null;
    });
    renderModal();
    expect(screen.getByText(/Free cast granted to/)).toBeInTheDocument();
    expect(screen.getByText('Moonbeam')).toBeInTheDocument();
  });

  it('shows used message when free cast is already used', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'naturalRecoveryFreeCastUsed') return true;
      return null;
    });
    renderModal();
    expect(screen.getByText(/already used this long rest/)).toBeInTheDocument();
  });

  it('shows close button when already granted', () => {
    useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'naturalRecoveryFreeCast') return ['Moonbeam'];
      return null;
    });
    renderModal();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('shows cancel button when not yet granted', () => {
    renderModal();
    expect(screen.getByText(/Cancel/)).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const { handleClose } = renderModal();
    fireEvent.click(screen.getByText(/Cancel/));
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    const { handleClose } = renderModal();
    fireEvent.click(screen.getByText(/Natural Recovery/).closest('.nr-overlay'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const { handleClose } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  describe('Circle of the Land — Arid filtering', () => {
    it('filters to only Arid land spells for Circle of the Land', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_circleOfTheLandType') return 'arid';
        return null;
      });
      const stats = makePlayerStats({
        class: { major: { name: 'Circle of the Land', spells: [
          { name: 'Blur', level: 3, landType: 'arid' },
          { name: 'Burning Hands', level: 3, landType: 'arid' },
          { name: 'Fire Bolt', level: 3, landType: 'arid' },
          { name: 'Fireball', level: 5, landType: 'arid' },
          { name: 'Blight', level: 7, landType: 'arid' },
          { name: 'Wall of Stone', level: 9, landType: 'arid' },
          { name: 'Fog Cloud', level: 3, landType: 'polar' },
          { name: 'Cone of Cold', level: 9, landType: 'polar' },
        ] } },
        spellAbilities: {
          spells: [
            { name: 'Blur', level: 3, prepared: 'Always' },
            { name: 'Fireball', level: 5, prepared: 'Always' },
            { name: 'Fog Cloud', level: 3, prepared: 'Always' },
            { name: 'Cone of Cold', level: 9, prepared: 'Always' },
            { name: 'Healing Word', level: 1, prepared: 'Prepared' },
          ],
        },
      });
      renderModal(stats);
      expect(screen.getByText('Blur')).toBeInTheDocument();
      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.queryByText('Fog Cloud')).not.toBeInTheDocument();
      expect(screen.queryByText('Cone of Cold')).not.toBeInTheDocument();
      expect(screen.queryByText('Healing Word')).not.toBeInTheDocument();
    });

    it('excludes Arid cantrips (level 0)', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_circleOfTheLandType') return 'arid';
        return null;
      });
      const stats = makePlayerStats({
        class: { major: { name: 'Circle of the Land', spells: [
          { name: 'Fire Bolt', level: 3, landType: 'arid' },
          { name: 'Burning Hands', level: 3, landType: 'arid' },
        ] } },
        spellAbilities: {
          spells: [
            { name: 'Fire Bolt', level: 0, prepared: 'Always' },
            { name: 'Burning Hands', level: 3, prepared: 'Always' },
          ],
        },
      });
      renderModal(stats);
      expect(screen.queryByText('Fire Bolt')).not.toBeInTheDocument();
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    });
  });

  describe('non-Land circles', () => {
    it('shows all circle spells for Circle of the Moon', () => {
      const stats = makePlayerStats({
        class: { major: { name: 'Circle of the Moon' } },
        spellAbilities: {
          spells: [
            { name: 'Moonbeam', level: 3, prepared: 'Always' },
            { name: 'Cure Wounds', level: 3, prepared: 'Always' },
            { name: 'Conjure Animals', level: 5, prepared: 'Always' },
          ],
        },
      });
      renderModal(stats);
      expect(screen.getByText('Moonbeam')).toBeInTheDocument();
      expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
      expect(screen.getByText('Conjure Animals')).toBeInTheDocument();
    });

    it('shows all circle spells for Circle of the Sea', () => {
      const stats = makePlayerStats({
        class: { major: { name: 'Circle of the Sea' } },
        spellAbilities: {
          spells: [
            { name: 'Fog Cloud', level: 3, prepared: 'Always' },
            { name: 'Lightning Bolt', level: 5, prepared: 'Always' },
          ],
        },
      });
      renderModal(stats);
      expect(screen.getByText('Fog Cloud')).toBeInTheDocument();
      expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    });

    it('excludes cantrips from Circle of the Stars', () => {
      const stats = makePlayerStats({
        class: { major: { name: 'Circle of the Stars' } },
        spellAbilities: {
          spells: [
            { name: 'Guidance', level: 0, prepared: 'Always' },
            { name: 'Guiding Bolt', level: 1, prepared: 'Always' },
          ],
        },
      });
      renderModal(stats);
      expect(screen.queryByText('Guidance')).not.toBeInTheDocument();
      expect(screen.getByText('Guiding Bolt')).toBeInTheDocument();
    });
  });
});
