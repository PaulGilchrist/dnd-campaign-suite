// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ElementalAffinityModal from './ElementalAffinityModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../services/automation/common/choiceStorage.js', () => ({
  setChosenRuntimeValue: vi.fn(),
  getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as elementalAffinityHandler from '../../../services/automation/handlers/class-sorcerer/elementalAffinityHandler.js';


// ── Test fixtures ──

const DEFAULT_DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];

const baseAction = {
  name: 'Elemental Affinity',
  automation: {
    type: 'class_feature',
    damageTypes: DEFAULT_DAMAGE_TYPES,
  },
};

const basePlayerStats = { name: 'Sorcerer1', level: 1, charismaModifier: 3 };

const baseProps = {
  action: baseAction,
  playerStats: basePlayerStats,
  campaignName: 'test-campaign',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function makeAction(overrides) {
  return { ...baseAction, ...(overrides || {}) };
}

// ── Helpers ──

function selectType(type) {
  fireEvent.click(screen.getByLabelText(type));
}

function clickDoneButton() {
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

function clickCancelButton() {
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
}

function waitForApply() {
  return waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: /Damage Type/ }));
  });
}

function waitForResult() {
  return waitFor(() => {
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
}

// ── Tests ──

describe('ElementalAffinityModal', () => {
  let unhandledRejectionHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    unhandledRejectionHandler = null;
  });

  afterEach(() => {
    if (unhandledRejectionHandler) {
      process.off('unhandledRejection', unhandledRejectionHandler);
    }
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders modal with action name in header', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    });

    it('defaults to "Elemental Affinity" when action name is missing', () => {
      render(<ElementalAffinityModal {...makeProps({ action: { automation: baseAction.automation } })} />);
      expect(screen.getByText('Elemental Affinity')).toBeInTheDocument();
    });

    it('renders all five default damage type radio options', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      DEFAULT_DAMAGE_TYPES.forEach(type => {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      });
    });

    it('renders description for new selection', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByText(/Choose one damage type/)).toBeInTheDocument();
    });

    it('renders description for changing existing type', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByText(/Change damage type \(currently Fire\)/)).toBeInTheDocument();
    });

    it('marks existing type with (current) label', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('hides (current) label when no existing type', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.queryByText('(current)')).not.toBeInTheDocument();
    });

    it('renders apply and cancel buttons', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByRole('button', { name: 'Choose Damage Type' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('disables apply button when no type is selected', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeDisabled();
    });

    it('uses "Change Damage Type" button text when existing type is set', () => {
      const actionWithExisting = makeAction({ existingType: 'Fire' });
      render(<ElementalAffinityModal {...makeProps({ action: actionWithExisting })} />);
      expect(screen.getByRole('button', { name: 'Change Damage Type' })).toBeInTheDocument();
    });
  });

  // ── Radio selection ──

  describe('radio selection', () => {
    it('selects a damage type when its radio is clicked', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      expect(screen.getByLabelText('Fire')).toBeChecked();
    });

    it('enables apply button after selecting a type', () => {
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeEnabled();
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    beforeEach(() => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elemental Affinity',
          description: 'Elemental Affinity: Fire selected. You gain resistance to Fire damage. When you cast a spell that deals Fire damage, add your Charisma modifier to one damage roll.',
        },
      });
    });

    it('calls applyTypeChoice with correct arguments and shows result view', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      await waitForApply();

      expect(elementalAffinityHandler.applyTypeChoice).toHaveBeenCalledWith(
        baseAction,
        basePlayerStats,
        'test-campaign',
        'Fire'
      );
      await waitForResult();
      expect(screen.getByText(/Fire selected/)).toBeInTheDocument();
    });

    it('does not call applyTypeChoice when apply is clicked without a selection', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      await waitForApply();
      expect(elementalAffinityHandler.applyTypeChoice).not.toHaveBeenCalled();
    });

    it('hides selection controls after successful apply', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      expect(screen.queryByLabelText('Fire')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Choose one damage type/)).not.toBeInTheDocument();
    });

    it('renders result description from payload', async () => {
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      expect(screen.getByText(/resistance to Fire damage/)).toBeInTheDocument();
    });

    it('renders result with custom action name', async () => {
      const customAction = makeAction({ name: 'Custom Affinity' });
      render(<ElementalAffinityModal {...makeProps({ action: customAction })} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      expect(screen.getByText('Custom Affinity')).toBeInTheDocument();
    });

    it('does not show result view when applyTypeChoice returns null or undefined', async () => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue(null);
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      await waitForApply();
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('keeps selection view when applyTypeChoice throws', async () => {
      unhandledRejectionHandler = vi.fn();
      process.on('unhandledRejection', unhandledRejectionHandler);
      elementalAffinityHandler.applyTypeChoice.mockRejectedValue(new Error('Network error'));
      render(<ElementalAffinityModal {...baseProps} />);
      selectType('Fire');
      await waitForApply();
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Result view close behavior ──

  describe('result view close behavior', () => {
    beforeEach(() => {
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elemental Affinity',
          description: 'Elemental Affinity: Fire selected.',
        },
      });
    });

    it('calls onClose when Done button is clicked in result view', async () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      clickDoneButton();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when overlay is clicked in result view', async () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('does not call onClose when result modal content is clicked', async () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Custom damage types ──

  describe('custom damage types', () => {
    it('renders custom damage types from action automation', () => {
      const customAction = makeAction({
        automation: { type: 'class_feature', damageTypes: ['Fire', 'Cold'] },
      });
      render(<ElementalAffinityModal {...makeProps({ action: customAction })} />);
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
      expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Lightning')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
    });

    it('renders no options and disables apply when damageTypes is an empty array', () => {
      const emptyTypesAction = makeAction({ automation: { type: 'class_feature', damageTypes: [] } });
      render(<ElementalAffinityModal {...makeProps({ action: emptyTypesAction })} />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(0);
      expect(screen.getByRole('button', { name: /Damage Type/ })).toBeDisabled();
    });
  });

  // ── Cancel button ──

  describe('cancel button', () => {
    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      clickCancelButton();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call applyTypeChoice when Cancel is clicked', () => {
      const onClose = vi.fn();
      render(<ElementalAffinityModal {...makeProps({ onClose })} />);
      selectType('Fire');
      clickCancelButton();
      expect(elementalAffinityHandler.applyTypeChoice).not.toHaveBeenCalled();
    });
  });

  // ── elemental_adept effect ──

  describe('elemental_adept effect', () => {
    it('renders elemental_adept description text when effect is set', () => {
      const adeptAction = makeAction({
        automation: {
          type: 'class_feature',
          damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
          effect: 'elemental_adept',
        },
      });
      render(<ElementalAffinityModal {...makeProps({ action: adeptAction })} />);
      expect(screen.getByText(/Choose one of the following damage types/)).toBeInTheDocument();
      expect(screen.getByText(/ignore Resistance/)).toBeInTheDocument();
      expect(screen.getByText(/treat any 1 on a damage die as a 2/)).toBeInTheDocument();
    });

    it('renders Thunder in the options when elemental_adept', () => {
      const adeptAction = makeAction({
        automation: {
          type: 'class_feature',
          damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
          effect: 'elemental_adept',
        },
      });
      render(<ElementalAffinityModal {...makeProps({ action: adeptAction })} />);
      expect(screen.getByLabelText('Thunder')).toBeInTheDocument();
      expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
    });

    it('shows elemental_adept popup description after apply', async () => {
      const adeptAction = makeAction({
        name: 'Elemental Affinity',
        effect: 'elemental_adept',
        automation: {
          type: 'class_feature',
          damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'],
          effect: 'elemental_adept',
        },
      });
      elementalAffinityHandler.applyTypeChoice.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Elemental Affinity',
          description: 'Elemental Affinity: Fire selected. Spells you cast ignore Resistance to damage of the chosen type. In addition, when you roll damage for a spell you cast that deals damage of that type, you can treat any 1 on a damage die as a 2.',
        },
      });
      render(<ElementalAffinityModal {...makeProps({ action: adeptAction })} />);
      selectType('Fire');
      await waitForApply();
      await waitForResult();
      expect(screen.getByText(/ignore Resistance/)).toBeInTheDocument();
      expect(screen.getByText(/treat any 1 on a damage die as a 2/)).toBeInTheDocument();
    });
  });
});
