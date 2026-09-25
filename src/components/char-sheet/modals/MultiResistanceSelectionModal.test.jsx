// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MultiResistanceSelectionModal from './MultiResistanceSelectionModal.jsx';

function createMocks() {
  return {
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };
}

function makeProps(overrides = {}) {
  const { onConfirm, onClose } = createMocks();
  return {
    title: 'Resistance Selection',
    icon: 'fa-shield-halved',
    damageTypes: ['Acid', 'Fire', 'Cold', 'Lightning'],
    existingTypes: [],
    maxSelections: 2,
    onConfirm,
    onClose,
    ...overrides,
  };
}

const defaultResult = {
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: 'Resistance Selection',
    description: 'Resistance to Acid and Fire selected.',
  },
};

describe('MultiResistanceSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the modal overlay and content', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders the header with title and icon', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ title: 'Resistance Selection', icon: 'fa-shield-halved' })} />);
      expect(screen.getByText('Resistance Selection')).toBeInTheDocument();
      expect(document.querySelectorAll('i.fa-solid.fa-shield-halved').length).toBeGreaterThan(0);
    });

    it('renders the instruction paragraph for a new selection', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      expect(screen.getByText(/Choose 2 damage types to gain resistance to:/)).toBeInTheDocument();
    });

    it('renders checkboxes for each damage type', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      expect(screen.getByLabelText('Acid')).toBeInTheDocument();
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
      expect(screen.getByLabelText('Cold')).toBeInTheDocument();
      expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
    });

    it('renders all checkboxes unchecked on initial render', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      expect(screen.getByLabelText('Acid')).not.toBeChecked();
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
      expect(screen.getByLabelText('Cold')).not.toBeChecked();
      expect(screen.getByLabelText('Lightning')).not.toBeChecked();
    });

    it('disables the Choose Resistances button when no types are selected', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeDisabled();
    });
  });

  describe('existing types', () => {
    it('renders the instruction paragraph for changing existing types', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire', 'Cold'] })} />);
      expect(screen.getByText(/Change resistance types \(currently Fire, Cold\):/)).toBeInTheDocument();
    });

    it('marks existing types as selected on initial render', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire', 'Cold'] })} />);
      expect(screen.getByLabelText('Fire')).toBeChecked();
      expect(screen.getByLabelText('Cold')).toBeChecked();
      expect(screen.getByLabelText('Acid')).not.toBeChecked();
      expect(screen.getByLabelText('Lightning')).not.toBeChecked();
    });

    it('shows "(current)" label for deselected existing types and hides it when re-selected', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire', 'Cold'], maxSelections: 2 })} />);
      fireEvent.click(screen.getByLabelText('Fire'));
      const fireLabel = Array.from(document.querySelectorAll('label')).find(l => l.textContent.includes('Fire'));
      expect(fireLabel.textContent).toContain('(current)');
      fireEvent.click(fireLabel);
      expect(fireLabel.textContent).not.toContain('(current)');
    });

    it('changes button text to "Change Resistances" when existing types exist', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire'] })} />);
      expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeInTheDocument();
    });

    it('enables the Change Resistances button when existing types exist', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire'] })} />);
      expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeEnabled();
    });

    it('disables the Change Resistances button after deselecting all existing types', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Fire'] })} />);
      expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeEnabled();
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByRole('button', { name: 'Change Resistances' })).toBeDisabled();
    });
  });

  describe('selection behavior', () => {
    it('selects multiple types up to maxSelections', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Acid')).toBeChecked();
      expect(screen.getByLabelText('Fire')).toBeChecked();
    });

    it('prevents selecting more than maxSelections', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Cold')).toBeDisabled();
      expect(screen.getByLabelText('Lightning')).toBeDisabled();
    });

    it('enables the confirm button after selecting types', () => {
      const props = makeProps();
      render(<MultiResistanceSelectionModal {...props} />);
      expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeDisabled();
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeEnabled();
    });

    it('allows deselecting a type after reaching maxSelections', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Cold')).toBeDisabled();
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.getByLabelText('Cold')).not.toBeDisabled();
    });

    it('allows switching selection (deselect one, select another)', () => {
      render(<MultiResistanceSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Cold')).toBeDisabled();
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      expect(screen.getByLabelText('Cold')).toBeChecked();
      expect(screen.getByLabelText('Fire')).not.toBeChecked();
    });
  });

  describe('maxSelections variations', () => {
    it('allows selecting exactly 1 type when maxSelections is 1', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ maxSelections: 1 })} />);
      expect(screen.getByText(/Choose 1 damage type to gain resistance to:/)).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(screen.getByLabelText('Fire')).toBeDisabled();
    });

    it('allows selecting all types when maxSelections equals the number of types', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ maxSelections: 4 })} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      fireEvent.click(screen.getByLabelText('Cold'));
      fireEvent.click(screen.getByLabelText('Lightning'));
      expect(screen.getByLabelText('Acid')).toBeChecked();
      expect(screen.getByLabelText('Fire')).toBeChecked();
      expect(screen.getByLabelText('Cold')).toBeChecked();
      expect(screen.getByLabelText('Lightning')).toBeChecked();
    });

    it('allows selecting all types when maxSelections exceeds the number of types', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ maxSelections: 10 })} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      expect(screen.getByLabelText('Cold')).not.toBeDisabled();
    });
  });

  describe('confirm flow', () => {
    it('calls onConfirm with selected types when confirmed', async () => {
      const props = makeProps();
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      expect(props.onConfirm).toHaveBeenCalledWith(['Acid', 'Fire']);
    });

    it('calls onConfirm with a single type when maxSelections is 1', async () => {
      const props = makeProps({ maxSelections: 1 });
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Cold'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      expect(props.onConfirm).toHaveBeenCalledWith(['Cold']);
    });

    it('calls onConfirm with existing types when no changes made', async () => {
      const props = makeProps({ existingTypes: ['Fire', 'Cold'] });
      render(<MultiResistanceSelectionModal {...props} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Change Resistances' }));
      });
      expect(props.onConfirm).toHaveBeenCalledWith(['Fire', 'Cold']);
    });

    it('transitions to result state after confirm', async () => {
      const props = makeProps();
      props.onConfirm.mockResolvedValue(defaultResult);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      });
    });

    it('does not transition to result state when onConfirm returns null', async () => {
      const props = makeProps();
      props.onConfirm.mockResolvedValue(null);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Choose Resistances' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      });
    });
  });

  describe('result screen', () => {
    it('displays the result description from onConfirm', async () => {
      const props = makeProps();
      props.onConfirm.mockResolvedValue(defaultResult);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        expect(screen.getByText('Resistance to Acid and Fire selected.')).toBeInTheDocument();
      });
    });

    it('renders HTML content in result description', async () => {
      const htmlResult = {
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Resistance Selection',
          description: '<strong>Resistance:</strong> Acid and <em>Fire</em> selected.',
        },
      };
      const props = makeProps();
      props.onConfirm.mockResolvedValue(htmlResult);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        const body = document.querySelector('.sp-body');
        expect(body.querySelector('strong')).toBeInTheDocument();
        expect(body.querySelector('em')).toBeInTheDocument();
      });
    });

    it('hides selection checkboxes in result state', async () => {
      const props = makeProps();
      props.onConfirm.mockResolvedValue(defaultResult);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        expect(screen.queryByLabelText('Acid')).not.toBeInTheDocument();
      });
    });

    it('hides Cancel and Choose buttons in result state', async () => {
      const props = makeProps();
      props.onConfirm.mockResolvedValue(defaultResult);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Choose Resistances' })).not.toBeInTheDocument();
      });
    });
  });

  describe('close behavior', () => {
    it('calls onClose when Cancel button is clicked', () => {
      const props = makeProps();
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Done button is clicked in result state', async () => {
      const props = makeProps();
      props.onConfirm.mockResolvedValue(defaultResult);
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Choose Resistances' }));
      });
      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      });
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when clicking the overlay background', () => {
      const props = makeProps();
      render(<MultiResistanceSelectionModal {...props} />);
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(props.onClose).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not close when clicking inside the modal content', () => {
      const props = makeProps();
      render(<MultiResistanceSelectionModal {...props} />);
      const modal = document.querySelector('.sp-modal');
      fireEvent.click(modal);
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('does not close when clicking a checkbox label', () => {
      const props = makeProps();
      render(<MultiResistanceSelectionModal {...props} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      expect(props.onClose).not.toHaveBeenCalled();
    });

  });

  describe('customization props', () => {
    it('renders custom title when provided', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ title: 'Elemental Resistance' })} />);
      expect(screen.getByText('Elemental Resistance')).toBeInTheDocument();
    });

    it('renders custom icon when provided', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ icon: 'fa-fire' })} />);
      expect(document.querySelectorAll('i.fa-solid.fa-fire').length).toBeGreaterThan(0);
    });

    it('renders default title when not provided', () => {
      const props = makeProps({ title: undefined, damageTypes: ['Fire'], maxSelections: 1 });
      render(<MultiResistanceSelectionModal {...props} />);
      expect(screen.getByText('Resistance Selection')).toBeInTheDocument();
    });

    it('renders default icon when not provided', () => {
      const props = makeProps({ icon: undefined, title: 'Test', damageTypes: ['Fire'], maxSelections: 1 });
      render(<MultiResistanceSelectionModal {...props} />);
      expect(document.querySelectorAll('i.fa-solid.fa-shield-halved').length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('renders with empty damage types array', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ damageTypes: [] })} />);
      expect(screen.getByText(/Choose 2 damage types to gain resistance to:/)).toBeInTheDocument();
      expect(screen.queryAllByRole('checkbox').length).toBe(0);
    });

    it('renders with no existing types (undefined)', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: undefined })} />);
      expect(screen.getByText(/Choose 2 damage types to gain resistance to:/)).toBeInTheDocument();
    });

    it('renders with all damage types as existing types', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Acid', 'Fire', 'Cold', 'Lightning'] })} />);
      expect(screen.getByText(/Change resistance types \(currently Acid, Fire, Cold, Lightning\):/)).toBeInTheDocument();
      expect(screen.getByLabelText('Acid')).toBeChecked();
      expect(screen.getByLabelText('Fire')).toBeChecked();
      expect(screen.getByLabelText('Cold')).toBeChecked();
      expect(screen.getByLabelText('Lightning')).toBeChecked();
    });

    it('shows "(current)" for existing types when some are deselected', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Acid', 'Fire', 'Cold', 'Lightning'], maxSelections: 2 })} />);
      fireEvent.click(screen.getByLabelText('Acid'));
      fireEvent.click(screen.getByLabelText('Fire'));
      const labels = Array.from(document.querySelectorAll('label'));
      const acidLabel = labels.find(l => l.textContent.includes('Acid'));
      const fireLabel = labels.find(l => l.textContent.includes('Fire'));
      expect(acidLabel.textContent).toContain('(current)');
      expect(fireLabel.textContent).toContain('(current)');
      const coldLabel = labels.find(l => l.textContent.includes('Cold'));
      const lightningLabel = labels.find(l => l.textContent.includes('Lightning'));
      expect(coldLabel.textContent).not.toContain('(current)');
      expect(lightningLabel.textContent).not.toContain('(current)');
    });

    it('handles existingTypes containing types not in damageTypes', () => {
      render(<MultiResistanceSelectionModal {...makeProps({ existingTypes: ['Poison'], damageTypes: ['Acid', 'Fire'] })} />);
      expect(screen.getByText(/Change resistance types \(currently Poison\):/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Poison')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Acid')).toBeInTheDocument();
      expect(screen.getByLabelText('Fire')).toBeInTheDocument();
    });
  });
});
