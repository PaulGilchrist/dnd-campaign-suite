import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SingleResistanceSelectionModal from './SingleResistanceSelectionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as fiendishResilienceHandler from '../../../services/automation/handlers/class-warlock/fiendishResilienceHandler.js';

// ── Test fixtures ──

const baseAction = {
  name: 'Fiendish Resilience',
  automation: {
    type: 'choice',
    damageTypes: ['Acid', 'Fire', 'Cold'],
  },
};

const basePlayerStats = {
  name: 'Warlock1',
  level: 5,
  hitPoints: 30,
};

const defaultProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...defaultProps, ...(overrides || {}) };
}

const DEFAULT_DAMAGE_TYPES = [
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Lightning',
  'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant',
  'Slashing', 'Thunder',
];

const mockSuccessResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Fiendish Resilience',
    description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
  },
};

// ── Helpers ──

function selectDamageType(type) {
  const radios = document.querySelectorAll('input[name="resistanceSelectionOption"]');
  const target = [...radios].find(radio => {
    const label = radio.closest('label');
    return label && label.textContent.includes(type);
  });
  if (target) {
    fireEvent.click(target);
  }
}

// ── Tests ──

describe('SingleResistanceSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal header with the action name', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
    });

    it('renders the instruction paragraph for a new selection', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(
        screen.getByText(/Choose one damage type/)
      ).toBeInTheDocument();
    });

    it('renders the instruction paragraph with current type when existingType is set', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<SingleResistanceSelectionModal {...makeProps({ action: actionWithExisting })} />);
      expect(
        screen.getByText(/Change damage type \(currently Fire\)/)
      ).toBeInTheDocument();
    });

    it('renders radio options for each damage type in automation', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(screen.getByLabelText('Acid')).toBeInTheDocument();
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    });

    it('marks the existing type with "(current)" label when no selection is made', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<SingleResistanceSelectionModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('falls back to default damage types when automation is missing or empty', () => {
      render(<SingleResistanceSelectionModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: {} } })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders only the provided damage types', () => {
      render(<SingleResistanceSelectionModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: ['Fire', 'Cold'] } } })} />);
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
      expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
    });

    it('does not have a selected option on initial render', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(screen.getByLabelText('Acid')).not.toBeChecked();
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
      expect(screen.getByLabelText('Cold')).not.toBeChecked();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    it('selects a radio option including the existing type', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<SingleResistanceSelectionModal {...makeProps({ action: actionWithExisting })} />);
      selectDamageType('Fire');
      expect(screen.getByLabelText('Fire')).toBeChecked();
      selectDamageType('Acid');
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
      expect(screen.getByLabelText('Acid')).toBeChecked();
    });
  });

  // ── Buttons ──

  describe('buttons', () => {
    it('renders the apply button with correct text based on existing type', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<SingleResistanceSelectionModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
    });

    it('disables the apply button when no option is selected and enables it when one is selected', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeDisabled();
      selectDamageType('Acid');
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeEnabled();
    });

    it('renders the Cancel button', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<SingleResistanceSelectionModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when the modal content is clicked', () => {
      const onClose = vi.fn();
      render(<SingleResistanceSelectionModal {...makeProps({ onClose })} />);
      const modal = screen.getByRole('button', { name: 'Cancel' }).closest('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when the Done button is clicked after apply', async () => {
      const onClose = vi.fn();
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<SingleResistanceSelectionModal {...makeProps({ onClose })} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      await screen.findByRole('button', { name: 'Done' });
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    it('calls applyTypeChoice with correct parameters on apply', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
        baseAction,
        basePlayerStats,
        'test-campaign',
        'Acid',
      );
    });

    it('calls applyTypeChoice with existingType when changing damage type', async () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<SingleResistanceSelectionModal {...makeProps({ action: actionWithExisting })} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Change Damage Type' }));
      expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
        actionWithExisting,
        basePlayerStats,
        'test-campaign',
        'Acid',
      );
    });

    it('does not call applyTypeChoice when no option is selected', () => {
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();
    });

    it('calls onConfirm with the selected type instead of applyTypeChoice', () => {
      const onConfirm = vi.fn();
      render(<SingleResistanceSelectionModal {...makeProps({ onConfirm })} />);
      selectDamageType('Fire');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      expect(onConfirm).toHaveBeenCalledWith('Fire');
      expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();
    });
  });

  // ── Result screen ──

  describe('result screen', () => {
    it('transitions to result screen after successful apply, showing Done button and hiding selection UI', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      await screen.findByRole('button', { name: 'Done' });
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Choose Damage Type' })).not.toBeInTheDocument();
    });

    it('displays the result description from applyTypeChoice', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      await screen.findByText('Fiendish Resilience: Acid selected. You gain resistance to Acid damage.');
    });

    it('renders HTML content via dangerouslySetInnerHTML', async () => {
      const htmlResult = {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Resilience',
          description: '<strong>Fiendish Resilience:</strong> Acid selected. You gain resistance to <em>Acid</em> damage.',
        },
      };
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(htmlResult);
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      await screen.findByRole('button', { name: 'Done' });
      const modal = screen.getByRole('button', { name: 'Done' }).closest('.sp-modal');
      const body = modal.querySelector('.sp-body');
      expect(body.querySelector('strong')).toBeInTheDocument();
      expect(body.querySelector('em')).toBeInTheDocument();
    });

    it('renders result with a custom action name', async () => {
      const customAction = { name: 'Custom Resilience', automation: { damageTypes: ['Fire'] } };
      const customResult = {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Custom Resilience',
          description: 'Custom Resilience: Fire selected.',
        },
      };
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(customResult);
      render(<SingleResistanceSelectionModal {...makeProps({ action: customAction })} />);
      selectDamageType('Fire');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      await screen.findByText('Custom Resilience');
      expect(screen.getByText('Custom Resilience')).toBeInTheDocument();
    });
  });

  // ── Null result handling ──

  describe('null result handling', () => {
    it('does not show result view when applyTypeChoice returns null or undefined', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(null);
      render(<SingleResistanceSelectionModal {...defaultProps} />);
      selectDamageType('Acid');
      fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Type' }));
      await screen.findByRole('button', { name: 'Choose Damage Type' });
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Edge cases / null safety ──

  describe('edge cases', () => {
    it('renders without crashing when action is null, showing default title and damage types', () => {
      render(<SingleResistanceSelectionModal {...makeProps({ action: null })} />);
      expect(screen.getByText('Resistance Selection')).toBeInTheDocument();
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders no radio options when damageTypes is an empty array', () => {
      render(<SingleResistanceSelectionModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: [] } } })} />);
      expect(screen.queryAllByRole('radio').length).toBe(0);
    });

    it('renders custom title when provided', () => {
      render(<SingleResistanceSelectionModal {...makeProps({ title: 'Elemental Resistance' })} />);
      expect(screen.getByText('Elemental Resistance')).toBeInTheDocument();
    });
  });
});
