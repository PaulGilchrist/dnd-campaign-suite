// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BoonOfEnergyResistanceModal from './BoonOfEnergyResistanceModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js', () => ({
  applyTypeChoice: vi.fn(),
}));

vi.mock('../../../../services/automation/common/choiceStorage.js', () => ({
  setChosenRuntimeValue: vi.fn(),
  getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ──

import * as boonHandler from '../../../../services/automation/handlers/reactions/boonOfEnergyResistanceHandler.js';

// ── Test fixtures ──

const defaultDamageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Necrotic', 'Poison', 'Psychic', 'Radiant', 'Thunder'];

function makeBaseAction(overrides) {
  return {
    name: 'Boon Of Energy Resistance',
    damageTypes: ['Acid', 'Cold', 'Fire', 'Lightning'],
    maxSelections: 2,
    automation: { type: 'test', validTypes: defaultDamageTypes },
    ...overrides,
  };
}

function makeProps(overrides) {
  return {
    action: makeBaseAction(),
    playerStats: { name: 'TestCharacter', level: 5 },
    campaignName: 'test-campaign',
    onClose: vi.fn(),
    ...overrides,
  };
}

// ── Helpers ──

function renderModal(props) {
  return render(<BoonOfEnergyResistanceModal {...makeProps(props)} />);
}

// ── Tests ──

describe('BoonOfEnergyResistanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boonHandler.applyTypeChoice.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Boon Of Energy Resistance',
        description: 'Fire selected. You gain resistance to these damage types.',
      },
    });
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the modal with overlay, header, body, and actions sections', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the header with shield icon and action name', () => {
      renderModal();
      expect(document.querySelector('.fa-shield-halved')).toBeInTheDocument();
      expect(screen.getByText('Boon Of Energy Resistance')).toBeInTheDocument();
    });

    it('renders damage type selection instructions when no existing types', () => {
      renderModal();
      expect(screen.getByText(/Choose 2 damage types/)).toBeInTheDocument();
    });

    it('shows selection counter starting at zero', () => {
      renderModal();
      expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
    });

    it('renders all damage types from action.damageTypes as checkboxes', () => {
      renderModal();
      expect(screen.getByLabelText('Acid')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
    });

    it('does not render damage types not listed in action.damageTypes', () => {
      renderModal();
      expect(screen.queryByLabelText('Necrotic')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Thunder')).not.toBeInTheDocument();
    });

    it('renders Cancel and Choose Damage Types buttons', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose Damage Types' })).toBeInTheDocument();
    });

    it('renders Font Awesome shield icon on the apply button', () => {
      renderModal();
      expect(document.querySelector('.sp-roll-btn .fa-shield-halved')).toBeInTheDocument();
    });

    it('disables the apply button when no types are selected', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Choose Damage Types' })).toBeDisabled();
    });

    it('does not show the Done button on initial render', () => {
      renderModal();
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });

  // ── Default values when action is null/missing ──

  describe('defaults when action fields are missing', () => {
    it('falls back to all nine energy types when action is null', () => {
      renderModal({ action: null });
      for (const type of defaultDamageTypes) {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      }
    });

    it('falls back to maxSelections of 2 when action.maxSelections is missing', () => {
      renderModal({ action: makeBaseAction({ maxSelections: undefined }) });
      expect(screen.getByText(/Selected: 0 \/ 2/)).toBeInTheDocument();
    });

    it('falls back to default name when action.name is missing', () => {
      renderModal({ action: makeBaseAction({ name: undefined }) });
      expect(screen.getByText('Boon Of Energy Resistance')).toBeInTheDocument();
    });
  });

  // ── Existing types display ──

  describe('existing types UI', () => {
    it('shows change instruction when existing types are provided', () => {
      renderModal({ action: makeBaseAction({ existingTypes: ['Fire', 'Cold'] }) });
      expect(screen.getByText(/Change your chosen damage types/)).toBeInTheDocument();
      expect(screen.getByText(/currently Fire, Cold/)).toBeInTheDocument();
    });

    it('marks existing types with a "current" label', () => {
      renderModal({ action: makeBaseAction({ existingTypes: ['Fire'] }) });
      expect(screen.getByText('(current)')).toBeInTheDocument();
    });

    it('changes the apply button label to "Change Damage Types" when existing types exist', () => {
      renderModal({ action: makeBaseAction({ existingTypes: ['Fire'] }) });
      expect(screen.getByRole('button', { name: 'Change Damage Types' })).toBeInTheDocument();
    });
  });

  // ── Overlay click behavior ──

  describe('overlay click behavior', () => {
    it('calls onClose when the overlay background is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ── Cancel button ──

  describe('Cancel button', () => {
    it('calls onClose when Cancel is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Checkbox selection ──

  describe('checkbox selection', () => {
    it('selects a damage type when its checkbox is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Fire')).toBeChecked();
    });

    it('deselects a damage type when its checkbox is clicked again', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Fire')).toBeChecked();
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
    });

    it('updates the selection counter after toggling types', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(document.querySelector('.sp-body p:nth-of-type(2)')).toHaveTextContent('Selected: 1 / 2');
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(document.querySelector('.sp-body p:nth-of-type(2)')).toHaveTextContent('Selected: 2 / 2');
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(document.querySelector('.sp-body p:nth-of-type(2)')).toHaveTextContent('Selected: 1 / 2');
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(document.querySelector('.sp-body p:nth-of-type(2)')).toHaveTextContent('Selected: 0 / 2');
    });

    it('prevents selecting more than maxSelections types', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.getByLabelText('Acid')).not.toBeChecked();
      expect(screen.getByText(/Selected: 2 \/ 2/)).toBeInTheDocument();
    });

    it('disables unchecked checkboxes when at max selection', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(screen.getByLabelText('Acid')).toBeDisabled();
      expect(screen.getByLabelText('Lightning')).toBeDisabled();
    });

    it('keeps selected checkboxes enabled when at max selection', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(screen.getByLabelText('Fire')).not.toBeDisabled();
      expect(screen.getByLabelText('Cold')).not.toBeDisabled();
    });

    it('re-enables other checkboxes after deselecting a type at max', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(screen.getByLabelText('Acid')).toBeDisabled();
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Acid')).not.toBeDisabled();
    });

    it('swaps a selected type for a different one via deselect then select', () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.getByLabelText('Acid')).toBeChecked();
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
    });
  });

  // ── Apply flow ──

  describe('apply flow', () => {
    it('does not call applyTypeChoice when no types are selected', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      expect(boonHandler.applyTypeChoice).not.toHaveBeenCalled();
    });

    it('calls applyTypeChoice with correct arguments when types are selected', async () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      expect(boonHandler.applyTypeChoice).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Boon Of Energy Resistance' }),
        { name: 'TestCharacter', level: 5 },
        'test-campaign',
        ['Fire', 'Cold']
      );
    });

    it('shows applied state after successful apply: Done button replaces selection UI', async () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose Damage Types' })).not.toBeInTheDocument();
      });
    });

    it('hides selection UI after apply', async () => {
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      await waitFor(() => {
        expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
      });
    });

    it('renders the handler result description via dangerouslySetInnerHTML', async () => {
      const mockResult = {
        payload: {
          description: '<p>Fire and Cold selected.</p>',
        },
      };
      boonHandler.applyTypeChoice.mockResolvedValue(mockResult);
      renderModal();
      fireEvent.click(screen.getByLabelText('Fire'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.innerHTML).toContain('<p>Fire and Cold selected.</p>');
      });
    });

    it('calls onClose when Done is clicked after apply', async () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByLabelText('Fire'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call applyTypeChoice when the apply button is clicked but selection is empty', async () => {
      renderModal();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Damage Types' }));
      });
      expect(boonHandler.applyTypeChoice).not.toHaveBeenCalled();
    });
  });

  // ── Apply with existing types ──

  describe('apply with existing types', () => {
    it('calls applyTypeChoice with the action containing existing types', async () => {
      const actionWithExisting = makeBaseAction({ existingTypes: ['Fire'] });
      renderModal({ action: actionWithExisting });
      fireEvent.click(screen.getByLabelText('Cold'));
      fireEvent.click(screen.getByLabelText('Lightning'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Change Damage Types' }));
      });
      expect(boonHandler.applyTypeChoice).toHaveBeenCalledWith(
        expect.objectContaining({ existingTypes: ['Fire'] }),
        { name: 'TestCharacter', level: 5 },
        'test-campaign',
        ['Cold', 'Lightning']
      );
    });
  });

  // ── Custom maxSelections ──

  describe('custom maxSelections', () => {
    it('uses the custom maxSelections value in the counter', () => {
      renderModal({ action: makeBaseAction({ maxSelections: 3 }) });
      expect(screen.getByText(/Selected: 0 \/ 3/)).toBeInTheDocument();
    });

    it('allows selecting up to the custom maxSelections', () => {
      renderModal({ action: makeBaseAction({ maxSelections: 3 }) });
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.getByText(/Selected: 3 \/ 3/)).toBeInTheDocument();
      expect(screen.getByLabelText('Lightning')).toBeDisabled();
    });

    it('prevents selecting beyond the custom maxSelections', () => {
      renderModal({ action: makeBaseAction({ maxSelections: 1 }) });
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(screen.getByLabelText('Fire')).toBeChecked();
      expect(screen.getByLabelText('Cold')).not.toBeChecked();
      expect(screen.getByText(/Selected: 1 \/ 1/)).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders with no checkboxes when damageTypes is empty', () => {
      renderModal({ action: makeBaseAction({ damageTypes: [] }) });
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes).toHaveLength(0);
    });

    it('treats empty existingTypes array as no existing types', () => {
      renderModal({ action: makeBaseAction({ existingTypes: [] }) });
      expect(screen.getByText(/Choose 2 damage types/)).toBeInTheDocument();
      expect(screen.queryByText(/(current)/)).not.toBeInTheDocument();
    });

    it('renders all nine default damage types when action is null', () => {
      renderModal({ action: null });
      for (const type of defaultDamageTypes) {
        expect(screen.getByLabelText(type)).toBeInTheDocument();
      }
    });

    it('does not show applied state on initial render with null action', () => {
      renderModal({ action: null });
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
  });
});
