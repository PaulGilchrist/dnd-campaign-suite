// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CircleOfTheLandSpellsModal from './CircleOfTheLandSpellsModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useSyncedState: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    playerStats: {
      name: 'Eldara',
      class: {
        major: {
          spells: [
            { name: 'Armor of Agathys', level: 1, landType: 'arid' },
            { name: 'Misty Step', level: 2, landType: 'arid' },
            { name: 'Fog Cloud', level: 1, landType: 'temperate' },
            { name: 'Silence', level: 2, landType: 'temperate' },
            { name: 'Sleet Storm', level: 3, landType: 'polar' },
            { name: 'Ice Storm', level: 4, landType: 'polar' },
            { name: 'Barkskin', level: 2, landType: 'tropical' },
            { name: 'Spore Dust', level: 3, landType: 'tropical' },
          ],
        },
      },
    },
    campaignName: 'test-campaign',
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

describe('CircleOfTheLandSpellsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders the modal with all land types, icons, and actions', () => {
      render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      expect(screen.getByText('Circle of the Land Spells')).toBeInTheDocument();
      expect(document.querySelector('.fa-solid.fa-leaf')).toBeInTheDocument();
      expect(screen.getByText(/Choose your land type to determine bonus prepared spells/)).toBeInTheDocument();
      expect(screen.getByText('Arid')).toBeInTheDocument();
      expect(screen.getByText('Polar')).toBeInTheDocument();
      expect(screen.getByText('Temperate')).toBeInTheDocument();
      expect(screen.getByText('Tropical')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByText('Arid').querySelector('.fa-solid.fa-sun')).toBeInTheDocument();
      expect(screen.getByText('Polar').querySelector('.fa-solid.fa-snowflake')).toBeInTheDocument();
      expect(screen.getByText('Temperate').querySelector('.fa-solid.fa-cloud-sun')).toBeInTheDocument();
      expect(screen.getByText('Tropical').querySelector('.fa-solid.fa-leaf')).toBeInTheDocument();
    });

    it('shows spells on hover for all land types', () => {
      render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      const aridBtn = screen.getByText('Arid').closest('button');
      const polarBtn = screen.getByText('Polar').closest('button');
      const tempBtn = screen.getByText('Temperate').closest('button');
      const tropBtn = screen.getByText('Tropical').closest('button');

      fireEvent.mouseEnter(aridBtn);
      expect(screen.getByText('Armor of Agathys')).toBeInTheDocument();
      expect(screen.getByText('Misty Step')).toBeInTheDocument();

      fireEvent.mouseEnter(polarBtn);
      expect(screen.getByText('Sleet Storm')).toBeInTheDocument();
      expect(screen.getByText('Ice Storm')).toBeInTheDocument();

      fireEvent.mouseEnter(tempBtn);
      expect(screen.getByText('Fog Cloud')).toBeInTheDocument();
      expect(screen.getByText('Silence')).toBeInTheDocument();

      fireEvent.mouseEnter(tropBtn);
      expect(screen.getByText('Barkskin')).toBeInTheDocument();
      expect(screen.getByText('Spore Dust')).toBeInTheDocument();
    });

    it('filters spells correctly per land type', () => {
      render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      const aridBtn = screen.getByText('Arid').closest('button');
      fireEvent.mouseEnter(aridBtn);
      expect(screen.getByText('Armor of Agathys')).toBeInTheDocument();
      expect(screen.queryByText('Fog Cloud')).not.toBeInTheDocument();
      expect(screen.queryByText('Sleet Storm')).not.toBeInTheDocument();
      expect(screen.queryByText('Barkskin')).not.toBeInTheDocument();
    });

    it('handles missing data gracefully', () => {
      render(<CircleOfTheLandSpellsModal {...makeProps({ playerStats: { name: 'Eldara', class: {} } })} />);
      expect(screen.getByText('Circle of the Land Spells')).toBeInTheDocument();
      expect(screen.getByText('Arid')).toBeInTheDocument();
    });

    it('shows current land type from runtime state', () => {
      vi.mocked(getRuntimeValue).mockReturnValue('temperate');
      render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      expect(screen.getByText('Current selection: temperate')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('saves land type and logs when a type is clicked', () => {
      render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      const aridBtn = screen.getByText('Arid').closest('button');
      fireEvent.click(aridBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Eldara', '_circleOfTheLandType', 'Arid', 'test-campaign');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        characterName: 'Eldara',
        abilityName: 'Circle of the Land Spells',
        description: expect.stringContaining('Chose land type: Arid'),
      }));
    });

    it('uses playerStats.name for runtime state and logging', () => {
      const props = makeProps({
        playerStats: { ...makeProps().playerStats, name: 'Gromak' },
      });
      render(<CircleOfTheLandSpellsModal {...props} />);
      const aridBtn = screen.getByText('Arid').closest('button');
      fireEvent.click(aridBtn);
      expect(setRuntimeValue).toHaveBeenCalledWith('Gromak', '_circleOfTheLandType', 'Arid', 'test-campaign');
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ characterName: 'Gromak' }));
    });
  });

  describe('close behavior', () => {
    it('calls onClose via cancel button or escape key, but not via overlay click', () => {
      const { unmount } = render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      unmount();

      vi.clearAllMocks();
      const { unmount: unmount2 } = render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.cotl-overlay'));
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      unmount2();

      vi.clearAllMocks();
      const { unmount: unmount3 } = render(<CircleOfTheLandSpellsModal {...makeProps()} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      unmount3();
    });
  });
});
