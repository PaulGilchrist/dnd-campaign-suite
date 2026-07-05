// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CelestialRevelationModal from './CelestialRevelationModal.jsx';

vi.mock('../../../services/automation/handlers/class-sorcerer/celestialRevelationHandler.js', () => ({
  confirmCelestialRevelation: vi.fn(),
}));

import * as celestialRevelationHandler from '../../../services/automation/handlers/class-sorcerer/celestialRevelationHandler.js';

const createProps = (overrides = {}) => ({
  action: { name: 'Celestial Revelation' },
  playerStats: { name: 'Sorcerer1', level: 5, proficiency: 3 },
  campaignName: 'test-campaign',
  onClose: vi.fn(),
  ...overrides,
});

const mockSuccessResult = (optionName) => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Celestial Revelation',
    description: `Transforming into ${optionName}. The transformation lasts for 1 minute or until you end it.`,
  },
});

describe('CelestialRevelationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the modal with title, instruction text, all three options, and buttons', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByText('Celestial Revelation')).toBeInTheDocument();
      expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
      expect(screen.getByText('Heavenly Wings')).toBeInTheDocument();
      expect(screen.getByText('Inner Radiance')).toBeInTheDocument();
      expect(screen.getByText('Necrotic Shroud')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Transform/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('displays the proficiency bonus from playerStats', () => {
      render(<CelestialRevelationModal {...createProps({ playerStats: { name: 'S1', level: 3, proficiency: 5 } })} />);
      expect(screen.getByText(/Proficiency Bonus \(5\)/)).toBeInTheDocument();
    });

    it('displays 0 for proficiency bonus when not provided', () => {
      render(<CelestialRevelationModal {...createProps({ playerStats: { name: 'S1', level: 3 } })} />);
      expect(screen.getByText(/Proficiency Bonus \(0\)/)).toBeInTheDocument();
    });

    it('shows a dash for damage type when no option is selected', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByText(/— type per turn/)).toBeInTheDocument();
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('option selection', () => {
    it('updates damage type display when an option is selected', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Transform/ })).toBeEnabled();
    });

    it('switches selection when clicking a different option', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Necrotic type per turn/)).toBeInTheDocument();
    });
  });

  describe('transformation flow', () => {
    it('calls confirmCelestialRevelation with correct arguments when Transform is clicked', async () => {
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Heavenly Wings'));
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        expect(celestialRevelationHandler.confirmCelestialRevelation).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Sorcerer1', level: 5, proficiency: 3 }),
          'Heavenly Wings',
          'test-campaign'
        );
      });
    });

    it('does not call confirmCelestialRevelation when no option is selected', async () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      expect(celestialRevelationHandler.confirmCelestialRevelation).not.toHaveBeenCalled();
    });

    it('shows the result description and Done button after transformation', async () => {
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Inner Radiance'));
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Inner Radiance'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        expect(screen.getByText(/Transforming into Inner Radiance/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('hides selection options and Transform button after transformation', async () => {
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Heavenly Wings'));
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        expect(screen.queryByText(/Choose a transformation option/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Transform/ })).not.toBeInTheDocument();
      });
    });
  });

  describe('post-transformation closing behavior', () => {
    it('calls onClose when the Done button is clicked after transformation', async () => {
      const onClose = vi.fn();
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Heavenly Wings'));
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay after transformation', async () => {
      const onClose = vi.fn();
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Inner Radiance'));
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(screen.getByText('Inner Radiance'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-overlay'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the result modal', async () => {
      const onClose = vi.fn();
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Necrotic Shroud'));
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        fireEvent.click(document.querySelector('.sp-modal'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('setCondition response path', () => {
    it('calls onClose and onSetConditionModal when confirmCelestialRevelation returns setCondition type', async () => {
      const onClose = vi.fn();
      const onSetConditionModal = vi.fn();
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
        type: 'setCondition',
        payload: {
          type: 'setCondition',
          name: 'Necrotic Shroud',
          automation: {
            type: 'set_condition',
            saveType: 'CHA',
            saveDc: 'ability',
            condition: 'frightened',
            range: '10 ft',
            duration: 'until_end_of_next_turn',
          },
        },
      });
      render(<CelestialRevelationModal {...createProps({ onClose, onSetConditionModal })} />);
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSetConditionModal).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('edge cases', () => {
    it('renders correctly when playerStats is minimal (empty object)', () => {
      render(<CelestialRevelationModal {...createProps({ playerStats: {} })} />);
      expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
      expect(screen.getByText(/Proficiency Bonus \(0\)/)).toBeInTheDocument();
    });
  });
});
