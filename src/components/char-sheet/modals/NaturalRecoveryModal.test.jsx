// @improved-by-ai
// @cleaned-by-ai
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

  describe('rendering', () => {
    it('renders the modal title and subtitle', () => {
      renderModal();
      expect(screen.getByText('Natural Recovery')).toBeInTheDocument();
      expect(screen.getByText(/Free Cast — 1\/Long Rest/)).toBeInTheDocument();
    });

    it('renders a Cancel button when no free cast is active', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
    });

    it('renders a Close button when free cast is already granted or used', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Moonbeam'];
        if (key === 'naturalRecoveryFreeCastUsed') return true;
        return null;
      });
      renderModal();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('renders no spell selection buttons when free cast is already granted or used', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Moonbeam'];
        if (key === 'naturalRecoveryFreeCastUsed') return true;
        return null;
      });
      renderModal();
      expect(screen.queryByRole('button', { name: 'Moonbeam' })).not.toBeInTheDocument();
    });
  });

  describe('already granted state', () => {
    it('displays the granted spell name', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Cure Wounds'];
        return null;
      });
      renderModal();
      expect(screen.getByText(/Free cast granted to:/)).toBeInTheDocument();
      expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
    });

  });

  describe('already used state', () => {
    it('displays a blocked message when free cast is already used', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCastUsed') return true;
        return null;
      });
      renderModal();
      expect(screen.getByText(/already used this long rest/)).toBeInTheDocument();
    });
  });

  describe('spell selection', () => {
    it('shows only Always-prepared circle spells at level 1+', () => {
      renderModal();
      expect(screen.getByText('Moonbeam')).toBeInTheDocument();
      expect(screen.getByText('Cure Wounds')).toBeInTheDocument();
      expect(screen.queryByText('Healing Word')).not.toBeInTheDocument();
      expect(screen.queryByText('Druidcraft')).not.toBeInTheDocument();
    });

    it('logs an ability_use entry when a spell is selected', () => {
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

    it('closes the modal after selecting a spell', () => {
      renderModal();
      fireEvent.click(screen.getByText('Moonbeam'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

  });

  describe('close behavior', () => {
    it('calls onClose when the Cancel button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the Close button is clicked', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'naturalRecoveryFreeCast') return ['Moonbeam'];
        return null;
      });
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the overlay background is clicked', () => {
      renderModal();
      const overlay = document.querySelector('.nr-overlay');
      fireEvent.click(overlay);
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(document.querySelector('.nr-modal')).toBeInTheDocument();
    });

    it('does not call onClose when the modal content is clicked', () => {
      renderModal();
      const modal = document.querySelector('.nr-modal');
      fireEvent.click(modal);
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      renderModal();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('no eligible spells', () => {
    it('displays a blocked message when there are no eligible spells', () => {
      const stats = makePlayerStats({
        spellAbilities: { spells: [] },
      });
      renderModal(stats);
      expect(screen.getByText(/No eligible spells found/)).toBeInTheDocument();
    });

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

    it('shows no eligible spells when no land spells match the type', () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_circleOfTheLandType') return 'arid';
        return null;
      });
      const stats = makePlayerStats({
        class: { major: { name: 'Circle of the Land', spells: [
          { name: 'Fog Cloud', level: 3, landType: 'polar' },
        ] } },
        spellAbilities: {
          spells: [
            { name: 'Fog Cloud', level: 3, prepared: 'Always' },
          ],
        },
      });
      renderModal(stats);
      expect(screen.getByText(/No eligible spells found/)).toBeInTheDocument();
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
