// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FiendishResilienceModal from './FiendishResilienceModal.jsx';

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

// ── Helpers ──

function selectDamageType(type) {
  fireEvent.click(screen.getByLabelText(type));
}

async function clickApplyButton(buttonName) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: buttonName }));
  });
}

// ── Tests ──

describe('FiendishResilienceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal overlay and content', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders the header with the action name', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
    });

    it('renders the instruction paragraph for a new selection', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(
        screen.getByText(/Choose one damage type/)
      ).toBeInTheDocument();
    });

    it('renders the instruction paragraph with current type when existingType is set', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
      expect(
        screen.getByText(/Change damage type \(currently Fire\)/)
      ).toBeInTheDocument();
    });

    it('renders radio options for each damage type', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(screen.getByLabelText('Acid')).toBeInTheDocument();
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
    });

    it('marks the existing type with "(current)" label when no selection is made', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('removes the "(current)" label after a type is selected', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
      selectDamageType('Acid');
      expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    });

    it('falls back to default damage types when automation is missing', () => {
      render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience' } })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('falls back to default damage types when automation is an empty object', () => {
      render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: {} } })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders no radio options when damageTypes is an empty array', () => {
      render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: [] } } })} />);
      expect(document.querySelectorAll('input[type="radio"]').length).toBe(0);
    });

    it('renders only the provided damage types', () => {
      render(<FiendishResilienceModal {...makeProps({ action: { name: 'Fiendish Resilience', automation: { damageTypes: ['Fire', 'Cold'] } } })} />);
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
      expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
    });

    it('does not have a selected option on initial render', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(
        document.querySelector('input[name="fiendishResilienceOption"]:checked')
      ).toBeNull();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    it('selects a radio option when clicked', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      expect(screen.getByLabelText('Acid')).toBeChecked();
    });

    it('allows selecting the existing type', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
      const fireRadio = document.querySelector('input[name="fiendishResilienceOption"][value="Fire"]') ||
        [...document.querySelectorAll('input[name="fiendishResilienceOption"]')].find(input => {
          const label = input.closest('label');
          return label && label.textContent.includes('Fire');
        });
      fireEvent.click(fireRadio);
      expect(fireRadio).toBeChecked();
    });
  });

  // ── Buttons ──

  describe('buttons', () => {
    it('renders the apply button with correct text when no existing type', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
    });

    it('renders the apply button with correct text when existing type is set', () => {
      const actionWithExisting = { ...baseAction, existingType: 'Fire' };
      render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
    });

    it('disables the apply button when no option is selected', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeDisabled();
    });

    it('enables the apply button when an option is selected', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeEnabled();
    });

    it('renders the Cancel button', () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  // ── Overlay / close behavior ──

  describe('close behavior', () => {
    it('calls onClose when the Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<FiendishResilienceModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the Done button is clicked after apply', async () => {
      const onClose = vi.fn();
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Fiendish Resilience',
          description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
        },
      });
      render(<FiendishResilienceModal {...makeProps({ onClose })} />);
      selectDamageType('Acid');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    const mockSuccessResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    };

    it('calls applyTypeChoice with correct parameters on apply', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      await clickApplyButton('Choose Damage Type');
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
      render(<FiendishResilienceModal {...makeProps({ action: actionWithExisting })} />);
      selectDamageType('Acid');
      await clickApplyButton('Change Damage Type');
      expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
        actionWithExisting,
        basePlayerStats,
        'test-campaign',
        'Acid',
      );
    });

    it('does not call applyTypeChoice when no option is selected', async () => {
      render(<FiendishResilienceModal {...defaultProps} />);
      await clickApplyButton('Choose Damage Type');
      expect(fiendishResilienceHandler.applyTypeChoice).not.toHaveBeenCalled();
    });

    it('passes playerStats to applyTypeChoice', async () => {
      const customPlayerStats = { name: 'Warlock2', level: 10, hitPoints: 50 };
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<FiendishResilienceModal {...makeProps({ playerStats: customPlayerStats })} />);
      selectDamageType('Fire');
      await clickApplyButton('Choose Damage Type');
      expect(fiendishResilienceHandler.applyTypeChoice).toHaveBeenCalledWith(
        baseAction,
        customPlayerStats,
        'test-campaign',
        'Fire',
      );
    });

    it('transitions to the result screen after successful apply', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockSuccessResult);
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
      });
    });
  });

  // ── Result screen ──

  describe('result screen', () => {
    const mockResult = {
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Fiendish Resilience',
        description: 'Fiendish Resilience: Acid selected. You gain resistance to Acid damage.',
      },
    };

    it('displays the result description from applyTypeChoice', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(mockResult);
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        expect(
          screen.getByText('Fiendish Resilience: Acid selected. You gain resistance to Acid damage.')
        ).toBeInTheDocument();
      });
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
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('strong')).toBeInTheDocument();
        expect(body.querySelector('em')).toBeInTheDocument();
      });
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
      render(<FiendishResilienceModal {...makeProps({ action: customAction })} />);
      selectDamageType('Fire');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        expect(screen.getByText('Custom Resilience')).toBeInTheDocument();
      });
    });
  });

  // ── Null result handling ──

  describe('null result handling', () => {
    it('does not show result view when applyTypeChoice returns null', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(null);
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Acid');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });

    it('does not show result view when applyTypeChoice returns undefined', async () => {
      fiendishResilienceHandler.applyTypeChoice.mockResolvedValue(undefined);
      render(<FiendishResilienceModal {...defaultProps} />);
      selectDamageType('Cold');
      await clickApplyButton('Choose Damage Type');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  // ── Edge cases / null safety ──

  describe('edge cases', () => {
    it('renders without crashing when action is null', () => {
      render(<FiendishResilienceModal {...makeProps({ action: null })} />);
      expect(screen.getByText('Fiendish Resilience')).toBeInTheDocument();
    });

    it('renders default damage types when action is null and falls back', () => {
      render(<FiendishResilienceModal {...makeProps({ action: null })} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });
  });
});
