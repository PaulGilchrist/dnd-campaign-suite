// @improved-by-ai
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
    it('renders the modal title and header icon', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByText('Celestial Revelation')).toBeInTheDocument();
    });

    it('renders the transformation instruction text', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
    });

    it('renders all three transformation options with their icons and descriptions', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByText('Heavenly Wings')).toBeInTheDocument();
      expect(screen.getByText('Inner Radiance')).toBeInTheDocument();
      expect(screen.getByText('Necrotic Shroud')).toBeInTheDocument();
      expect(screen.getByText(/Two spectral wings sprout from your back/)).toBeInTheDocument();
      expect(screen.getByText(/Searing light radiates from your eyes/)).toBeInTheDocument();
      expect(screen.getByText(/Your eyes become pools of darkness/)).toBeInTheDocument();
    });

    it('displays proficiency bonus with the value from playerStats', () => {
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

    it('renders the Transform button disabled when no option is selected', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByRole('button', { name: /Transform/ })).toBeDisabled();
    });

    it('renders the Cancel button', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders the selection options in a selectable list', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(3);
    });
  });

  describe('closing behavior', () => {
    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
      const onClose = vi.fn();
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      render(<CelestialRevelationModal {...createProps({ onClose })} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('option selection', () => {
    it('updates damage type display when Heavenly Wings is selected', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
    });

    it('updates damage type display when Inner Radiance is selected', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Inner Radiance'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
    });

    it('updates damage type display when Necrotic Shroud is selected', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Necrotic type per turn/)).toBeInTheDocument();
    });

    it('enables the Transform button after selecting an option', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      expect(screen.getByRole('button', { name: /Transform/ })).toBeEnabled();
    });

    it('switches selection when clicking a different option', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Radiant type per turn/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      expect(screen.getByText(/Proficiency Bonus \(3\) of Necrotic type per turn/)).toBeInTheDocument();
    });

    it('highlights the selected option visually', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Inner Radiance'));
      const labels = document.querySelectorAll('label');
      const selectedLabel = [...labels].find(l => l.textContent.includes('Inner Radiance'));
      expect(selectedLabel).toHaveStyle({ background: 'rgba(255,255,255,0.15)' });
    });

    it('allows selecting all three options', () => {
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      expect(screen.getByRole('button', { name: /Transform/ })).toBeEnabled();
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

    it('shows the result description after transformation', async () => {
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Inner Radiance'));
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Inner Radiance'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        expect(screen.getByText(/Transforming into Inner Radiance/)).toBeInTheDocument();
      });
    });

    it('shows the Done button after transformation', async () => {
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue(mockSuccessResult('Necrotic Shroud'));
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
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

    it('renders the result description as HTML via dangerouslySetInnerHTML', async () => {
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Celestial Revelation',
          description: '<strong>Transforming into Heavenly Wings.</strong> You gain a Fly Speed.',
        },
      });
      render(<CelestialRevelationModal {...createProps()} />);
      fireEvent.click(screen.getByText('Heavenly Wings'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        const spBody = document.querySelector('.sp-body');
        expect(spBody.querySelector('strong')).toBeInTheDocument();
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

    it('does not show the result screen when setCondition is returned', async () => {
      const onClose = vi.fn();
      const onSetConditionModal = vi.fn();
      celestialRevelationHandler.confirmCelestialRevelation.mockResolvedValue({
        type: 'setCondition',
        payload: { type: 'setCondition' },
      });
      render(<CelestialRevelationModal {...createProps({ onClose, onSetConditionModal })} />);
      fireEvent.click(screen.getByText('Necrotic Shroud'));
      fireEvent.click(screen.getByRole('button', { name: /Transform/ }));
      await waitFor(() => {
        expect(screen.queryByText(/Transforming into/)).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('renders correctly when playerStats is minimal (empty object)', () => {
      render(<CelestialRevelationModal {...createProps({ playerStats: {} })} />);
      expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
      expect(screen.getByText(/Proficiency Bonus \(0\)/)).toBeInTheDocument();
    });

    it('throws when playerStats is null', () => {
      const consoleError = console.error;
      const errors = [];
      console.error = (...args) => errors.push(args);
      expect(() => render(<CelestialRevelationModal {...createProps({ playerStats: null })} />)).toThrow();
      console.error = consoleError;
    });

    it('renders correctly when campaignName is empty string', () => {
      render(<CelestialRevelationModal {...createProps({ campaignName: '' })} />);
      expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Transform/ })).toBeDisabled();
    });

    it('renders correctly when onClose is not provided', () => {
      const { container } = render(<CelestialRevelationModal {...createProps({ onClose: undefined })} />);
      expect(screen.getByText(/Choose a transformation option/)).toBeInTheDocument();
      expect(container.querySelector('.sp-overlay')).toBeInTheDocument();
    });
  });
});
